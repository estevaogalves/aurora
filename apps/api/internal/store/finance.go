package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
	"aurora/api/internal/sqlitetypes"
	"aurora/api/internal/store/sqlcgen"
)

/* ---------- transações ---------- */

// TransactionPatch: só os campos preenchidos mudam.
// HiddenMonths e MonthlyValues, quando vêm, substituem a lista/mapa inteiro (como no front).
type TransactionPatch struct {
	Name          *string
	Amount        *int64
	Category      *string
	Notes         *string
	Fixed         *bool
	HiddenMonths  *[]string
	MonthlyValues *map[string]int64
	MonthlyNotes  *map[string]string
	VariableAmount *bool
	// CardID: nil não muda; ponteiro para "" solta a despesa do cartão. PurchaseDate: dia da compra no cartão.
	CardID       *string
	PurchaseDate *string
	// EndMonth: último mês em que a fixa vale. nil não muda; ponteiro para "" tira o fim.
	EndMonth *string
	// DistGroup: distribuição da sugestão do saldo (0 = Dist 1, 2 a 20). nil não muda.
	DistGroup *int
	// DueDay: dia do vencimento (1 a 31; 0 tira o dia). nil não muda.
	DueDay *int
	// Tags: lista inteira de etiquetas (vazia tira todas). nil não muda.
	Tags *[]string
}

func (s *Store) CreateTransaction(ctx context.Context, userID uuid.UUID, t domain.Transaction) (domain.Transaction, error) {
	var out domain.Transaction
	err := s.inTx(ctx, func(q *sqlcgen.Queries) error {
		if err := ownsCard(ctx, q, userID, t.CardID); err != nil {
			return err
		}
		var err error
		out, err = createTransaction(ctx, q, userID, t)
		return err
	})
	return out, mapErr(err)
}

func createTransaction(ctx context.Context, q *sqlcgen.Queries, userID uuid.UUID, t domain.Transaction) (domain.Transaction, error) {
	row, err := q.CreateTransaction(ctx, sqlcgen.CreateTransactionParams{
		ID: clientID(t.ID), UserID: userID, Name: t.Name, AmountCents: t.Amount, Type: t.Type,
		Category: t.Category, Notes: t.Notes, Fixed: t.Fixed, Month: t.Month, VariableAmount: t.VariableAmount,
		CardID: nullID(t.CardID), PurchaseDate: t.PurchaseDate, EndMonth: t.EndMonth, DistGroup: int64(t.DistGroup), DueDay: int64(t.DueDay), Tags: sqlitetypes.JSON(tagsJSON(t.Tags)),
	})
	if err != nil {
		return domain.Transaction{}, err
	}
	var ov []sqlcgen.FixedOverride
	if t.Fixed {
		hidden := map[string]bool{}
		for _, m := range t.HiddenMonths {
			hidden[m] = true
		}
		ov, err = writeOverrides(ctx, q, row.ID, hidden, t.MonthlyValues)
		if err != nil {
			return domain.Transaction{}, err
		}
	}
	return transactionFrom(row, ov), nil
}

// writeOverrides regrava as ocultações e valores por mês de uma fixa.
func writeOverrides(ctx context.Context, q *sqlcgen.Queries, id uuid.UUID, hidden map[string]bool, values map[string]int64) ([]sqlcgen.FixedOverride, error) {
	if err := q.DeleteTransactionOverrides(ctx, id); err != nil {
		return nil, err
	}
	months := map[string]struct{}{}
	for m, h := range hidden {
		if h {
			months[m] = struct{}{}
		}
	}
	for m := range values {
		months[m] = struct{}{}
	}
	for m := range months {
		p := sqlcgen.InsertOverrideParams{TransactionID: id, Month: m, Hidden: hidden[m]}
		if v, ok := values[m]; ok {
			p.AmountCents.Int64, p.AmountCents.Valid = v, true
		}
		if err := q.InsertOverride(ctx, p); err != nil {
			return nil, err
		}
	}
	return q.ListTransactionOverrides(ctx, id)
}

func (s *Store) UpdateTransaction(ctx context.Context, userID uuid.UUID, id string, p TransactionPatch) (domain.Transaction, error) {
	tid, err := parseID(id)
	if err != nil {
		return domain.Transaction{}, err
	}
	var out domain.Transaction
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		arg := sqlcgen.UpdateTransactionParams{
			Name: text(p.Name), AmountCents: int8v(p.Amount), Category: text(p.Category),
			Notes: text(p.Notes), Fixed: boolv(p.Fixed), VariableAmount: boolv(p.VariableAmount),
			PurchaseDate: text(p.PurchaseDate), EndMonth: text(p.EndMonth), ID: tid, UserID: userID,
		}
		if p.DistGroup != nil {
			arg.DistGroup.Int64, arg.DistGroup.Valid = int64(*p.DistGroup), true
		}
		if p.DueDay != nil {
			arg.DueDay.Int64, arg.DueDay.Valid = int64(*p.DueDay), true
		}
		if p.Tags != nil {
			raw, err := jsonMarshal(*p.Tags)
			if err != nil {
				return err
			}
			arg.Tags = sqlitetypes.JSON(raw)
		}
		row, err := q.UpdateTransaction(ctx, arg)
		if err != nil {
			return mapErr(err)
		}
		// o cartão só muda quando veio na requisição; id vazio solta a despesa do cartão (no SQLite é uma consulta à parte)
		if p.CardID != nil {
			if err := ownsCard(ctx, q, userID, *p.CardID); err != nil {
				return err
			}
			if row, err = q.SetTransactionCard(ctx, sqlcgen.SetTransactionCardParams{CardID: nullID(*p.CardID), ID: tid, UserID: userID}); err != nil {
				return mapErr(err)
			}
		}
		// o resultado tem que ser uma despesa avulsa válida: virar fixa com cartão, por exemplo, é recusado
		if err := checkCardState(row.Fixed, row.Type, row.CardID, row.PurchaseDate); err != nil {
			return err
		}
		if err := checkEndState(row.Fixed, row.Month, row.EndMonth); err != nil {
			return err
		}
		if err := checkDistGroupState(row.Fixed, row.Type, int(row.DistGroup)); err != nil {
			return err
		}

		if p.MonthlyNotes != nil && row.Fixed {
			raw, err := json.Marshal(*p.MonthlyNotes)
			if err != nil {
				return err
			}
			if row, err = q.SetTransactionMonthlyNotes(ctx, sqlcgen.SetTransactionMonthlyNotesParams{ID: tid, UserID: userID, MonthlyNotes: raw}); err != nil {
				return err
			}
		}

		var ov []sqlcgen.FixedOverride
		switch {
		case !row.Fixed:
			// deixou de ser fixa (ou nunca foi): não há valor nem ocultação por mês
			if err := q.DeleteTransactionOverrides(ctx, tid); err != nil {
				return err
			}
		case p.HiddenMonths != nil || p.MonthlyValues != nil:
			cur, err := q.ListTransactionOverrides(ctx, tid)
			if err != nil {
				return err
			}
			hidden := map[string]bool{}
			values := map[string]int64{}
			for _, o := range cur {
				if o.Hidden {
					hidden[o.Month] = true
				}
				if o.AmountCents.Valid {
					values[o.Month] = o.AmountCents.Int64
				}
			}
			if p.HiddenMonths != nil {
				hidden = map[string]bool{}
				for _, m := range *p.HiddenMonths {
					hidden[m] = true
				}
			}
			if p.MonthlyValues != nil {
				values = *p.MonthlyValues
			}
			if ov, err = writeOverrides(ctx, q, tid, hidden, values); err != nil {
				return err
			}
		default:
			if ov, err = q.ListTransactionOverrides(ctx, tid); err != nil {
				return err
			}
		}
		out = transactionFrom(row, ov)
		return nil
	})
	return out, mapErr(err)
}

func (s *Store) DeleteTransaction(ctx context.Context, userID uuid.UUID, id string) error {
	tid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteTransaction(ctx, sqlcgen.DeleteTransactionParams{ID: tid, UserID: userID}))
}

/* ---------- pagamentos ---------- */

// SetTransactionPayment marca (p != nil) ou desmarca (p == nil) o pagamento de uma despesa em um mês.
// Só registro: nada aqui mexe em valores. Uma despesa avulsa só tem o seu próprio mês; uma fixa, do mês inicial em diante.
func (s *Store) SetTransactionPayment(ctx context.Context, userID uuid.UUID, id, month string, p *domain.Payment) (domain.Transaction, error) {
	tid, err := parseID(id)
	if err != nil {
		return domain.Transaction{}, err
	}
	var out domain.Transaction
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetTransactionForUpdate(ctx, sqlcgen.GetTransactionForUpdateParams{ID: tid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if cur.Type != "expense" {
			return &ValidationError{"Só despesas podem ser marcadas como pagas."}
		}
		if cur.CardID.Valid && p != nil {
			return &ValidationError{"Despesa no cartão é paga pela fatura do cartão."}
		}
		if (!cur.Fixed && month != cur.Month) || (cur.Fixed && (domain.CompareMonths(month, cur.Month) < 0 || (cur.EndMonth != "" && domain.CompareMonths(month, cur.EndMonth) > 0))) {
			return &ValidationError{"Esta despesa não existe neste mês."}
		}
		payments := map[string]domain.Payment{}
		if len(cur.Payments) > 0 {
			_ = json.Unmarshal(cur.Payments, &payments)
		}
		if p == nil {
			delete(payments, month)
		} else {
			payments[month] = *p
		}
		raw, err := json.Marshal(payments)
		if err != nil {
			return err
		}
		row, err := q.SetTransactionPayments(ctx, sqlcgen.SetTransactionPaymentsParams{ID: tid, UserID: userID, Payments: raw})
		if err != nil {
			return mapErr(err)
		}
		var ov []sqlcgen.FixedOverride
		if row.Fixed {
			if ov, err = q.ListTransactionOverrides(ctx, tid); err != nil {
				return err
			}
		}
		out = transactionFrom(row, ov)
		return nil
	})
	return out, err
}

// SetExtraPayment marca (p != nil) ou desmarca (p == nil) o pagamento de uma despesa extra.
func (s *Store) SetExtraPayment(ctx context.Context, userID uuid.UUID, id string, p *domain.Payment) (domain.ExtraExpense, error) {
	eid, err := parseID(id)
	if err != nil {
		return domain.ExtraExpense{}, err
	}
	var raw []byte // nil grava NULL
	if p != nil {
		if raw, err = json.Marshal(p); err != nil {
			return domain.ExtraExpense{}, err
		}
	}
	var out domain.ExtraExpense
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetExtraExpenseForUpdate(ctx, sqlcgen.GetExtraExpenseForUpdateParams{ID: eid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if cur.CardID.Valid && p != nil {
			return &ValidationError{"Despesa no cartão é paga pela fatura do cartão."}
		}
		row, err := q.SetExtraExpensePayment(ctx, sqlcgen.SetExtraExpensePaymentParams{ID: eid, UserID: userID, Payment: raw})
		if err != nil {
			return mapErr(err)
		}
		out = extraFrom(row)
		return nil
	})
	return out, err
}

/* ---------- crédito ---------- */

type CreditPatch struct {
	Name         *string
	TotalAmount  *int64
	Installments *int
	StartMonth   *string
	Category     *string
	// EndMonth cancela a recorrência (veja domain.CancelRecurrence); Today é o mês atual.
	EndMonth *string
	Today    string
	BillingDay     *int
	VariableAmount *bool
	// CardID: nil não muda; ponteiro para "" solta a compra do cartão.
	CardID *string
}

// ownsCard recusa um cartão que não existe ou é de outra conta. id vazio = sem cartão.
func ownsCard(ctx context.Context, q *sqlcgen.Queries, userID uuid.UUID, id string) error {
	if id == "" {
		return nil
	}
	cards, err := q.ListCreditCards(ctx, userID)
	if err != nil {
		return err
	}
	for _, k := range cards {
		if k.ID.String() == id {
			return nil
		}
	}
	return &ValidationError{"Cartão não encontrado."}
}

func (s *Store) CreateCredit(ctx context.Context, userID uuid.UUID, c domain.CreditTransaction) (domain.CreditTransaction, error) {
	if err := ownsCard(ctx, s.q, userID, c.CardID); err != nil {
		return domain.CreditTransaction{}, err
	}
	row, err := s.q.CreateCredit(ctx, creditParams(userID, c))
	return creditFrom(row), mapErr(err)
}

func creditParams(userID uuid.UUID, c domain.CreditTransaction) sqlcgen.CreateCreditParams {
	adjustments, err := json.Marshal(c.Adjustments)
	if err != nil || len(c.Adjustments) == 0 {
		adjustments = []byte("{}")
	}
	return sqlcgen.CreateCreditParams{
		ID: clientID(c.ID), UserID: userID, Name: c.Name, TotalCents: c.TotalAmount,
		Installments: int64(c.Installments), StartMonth: c.StartMonth, Category: c.Category,
		Adjustments: adjustments,
		Recurring: c.Recurring, EndMonth: text(nilIfEmpty(c.EndMonth)), BillingDay: int64(c.BillingDay),
		CardID: nullID(c.CardID), VariableAmount: c.VariableAmount,
	}
}

// UpdateCredit edita a compra inteira ("todas as parcelas"). Os ajustes por parcela (adiantadas,
// excluídas, com valor próprio) não mudam, e o número de parcelas só muda enquanto não houver ajustes.
func (s *Store) UpdateCredit(ctx context.Context, userID uuid.UUID, id string, p CreditPatch) (domain.CreditTransaction, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditTransaction{}, err
	}
	var out domain.CreditTransaction
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetCreditForUpdate(ctx, sqlcgen.GetCreditForUpdateParams{ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if p.CardID != nil {
			if err := ownsCard(ctx, q, userID, *p.CardID); err != nil {
				return err
			}
		}
		if p.Installments != nil && *p.Installments != int(cur.Installments) && !domain.CanChangeInstallments(creditFrom(cur)) {
			return &ValidationError{"Não dá para mudar o número de parcelas de uma compra com parcelas ajustadas, excluídas ou adiantadas."}
		}
		var endMonth *string
		if p.EndMonth != nil {
			end, msg := domain.CancelRecurrence(creditFrom(cur), *p.EndMonth, p.Today)
			if msg != "" {
				return &ValidationError{msg}
			}
			endMonth = &end
		}
		arg := sqlcgen.UpdateCreditParams{
			Name: text(p.Name), TotalCents: int8v(p.TotalAmount), StartMonth: text(p.StartMonth),
			Category: text(p.Category), EndMonth: text(endMonth), ID: cid, UserID: userID,
		}
		if p.BillingDay != nil {
			arg.BillingDay.Int64, arg.BillingDay.Valid = int64(*p.BillingDay), true
		}
		arg.VariableAmount = boolv(p.VariableAmount)
		if p.Installments != nil {
			arg.Installments.Int64, arg.Installments.Valid = int64(*p.Installments), true
		}
		row, err := q.UpdateCredit(ctx, arg)
		if err != nil {
			return mapErr(err)
		}
		// card_id so muda quando veio na requisicao; id vazio solta a compra do cartao
		if p.CardID != nil {
			if row, err = q.SetCreditCard(ctx, sqlcgen.SetCreditCardParams{CardID: nullID(*p.CardID), ID: cid, UserID: userID}); err != nil {
				return mapErr(err)
			}
		}
		out = creditFrom(row)
		return nil
	})
	return out, err
}

// AdjustCredit aplica uma regra de ajuste por parcela (adiantar, editar, excluir) dentro de uma
// transação com a linha travada, então duas chamadas ao mesmo tempo não se atropelam.
// `rule` recebe a compra atual e devolve os novos ajustes ou a mensagem de recusa.
func (s *Store) AdjustCredit(ctx context.Context, userID uuid.UUID, id string, rule func(domain.CreditTransaction) (map[string]domain.InstallmentAdjustment, string)) (domain.CreditTransaction, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditTransaction{}, err
	}
	var out domain.CreditTransaction
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetCreditForUpdate(ctx, sqlcgen.GetCreditForUpdateParams{ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		adj, msg := rule(creditFrom(cur))
		if msg != "" {
			return &ValidationError{msg}
		}
		raw, err := json.Marshal(adj)
		if err != nil {
			return err
		}
		row, err := q.SetCreditAdjustments(ctx, sqlcgen.SetCreditAdjustmentsParams{ID: cid, UserID: userID, Adjustments: raw})
		out = creditFrom(row)
		return mapErr(err)
	})
	return out, err
}

func (s *Store) DeleteCredit(ctx context.Context, userID uuid.UUID, id string) error {
	cid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteCredit(ctx, sqlcgen.DeleteCreditParams{ID: cid, UserID: userID}))
}

/* ---------- cartões de crédito ---------- */

type CardPatch struct {
	Name       *string
	ClosingDay *int
	DueDay     *int
	// Limit: teto mensal da fatura em centavos (0 = sem teto).
	Limit *int64
}

func nullID(id string) uuid.NullUUID {
	u, err := uuid.Parse(id)
	return uuid.NullUUID{UUID: u, Valid: err == nil && id != ""}
}

func (s *Store) CreateCreditCard(ctx context.Context, userID uuid.UUID, c domain.CreditCard) (domain.CreditCard, error) {
	row, err := s.q.CreateCreditCard(ctx, sqlcgen.CreateCreditCardParams{ID: clientID(c.ID), UserID: userID, Name: c.Name, ClosingDay: int64(c.ClosingDay), DueDay: int64(c.DueDay), LimitCents: c.Limit, Payments: cardPayments(c.Payments)})
	return cardFrom(row), mapErr(err)
}

// cardPayments serializa os pagamentos das faturas ("{}" quando não há nenhum).
func cardPayments(p map[string]domain.Payment) []byte {
	raw, err := json.Marshal(p)
	if err != nil || len(p) == 0 {
		return []byte("{}")
	}
	return raw
}

// cardAdjustments serializa os ajustes das faturas ("{}" quando não há nenhum).
func cardAdjustments(a map[string][]domain.InvoiceAdjustment) []byte {
	raw, err := json.Marshal(a)
	if err != nil || len(a) == 0 {
		return []byte("{}")
	}
	return raw
}

// parseCardAdjustments lê os ajustes gravados. Aceita também o formato antigo, de um ajuste só por mês
// ({"2026-12": {"amount": -37}}), que vira uma lista de um item.
func parseCardAdjustments(raw []byte) map[string][]domain.InvoiceAdjustment {
	out := map[string][]domain.InvoiceAdjustment{}
	if len(raw) == 0 {
		return out
	}
	var byMonth map[string]json.RawMessage
	if json.Unmarshal(raw, &byMonth) != nil {
		return out
	}
	for month, v := range byMonth {
		var list []domain.InvoiceAdjustment
		if json.Unmarshal(v, &list) == nil {
			if len(list) > 0 {
				out[month] = list
			}
			continue
		}
		var one domain.InvoiceAdjustment
		if json.Unmarshal(v, &one) == nil && one.Amount != 0 {
			one.ID = "antigo-" + month
			out[month] = []domain.InvoiceAdjustment{one}
		}
	}
	return out
}

// SetCardAdjustments troca a lista de ajustes da fatura do cartão que vence em `month` (lista vazia remove).
// Só registro: nada aqui mexe em despesas.
func (s *Store) SetCardAdjustments(ctx context.Context, userID uuid.UUID, id, month string, list []domain.InvoiceAdjustment) (domain.CreditCard, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditCard{}, err
	}
	var out domain.CreditCard
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetCreditCardForUpdate(ctx, sqlcgen.GetCreditCardForUpdateParams{ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		adjustments := parseCardAdjustments(cur.Adjustments)
		if len(list) == 0 {
			delete(adjustments, month)
		} else {
			adjustments[month] = list
		}
		row, err := q.SetCreditCardAdjustments(ctx, sqlcgen.SetCreditCardAdjustmentsParams{ID: cid, UserID: userID, Adjustments: cardAdjustments(adjustments)})
		if err != nil {
			return mapErr(err)
		}
		out = cardFrom(row)
		return nil
	})
	return out, err
}

// SetCardPayment marca (p != nil) ou desmarca (p == nil) o pagamento da fatura do cartão que vence em `month`.
// Só registro: nada aqui mexe em valores.
func (s *Store) SetCardPayment(ctx context.Context, userID uuid.UUID, id, month string, p *domain.Payment) (domain.CreditCard, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditCard{}, err
	}
	var out domain.CreditCard
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetCreditCardForUpdate(ctx, sqlcgen.GetCreditCardForUpdateParams{ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		payments := map[string]domain.Payment{}
		if len(cur.Payments) > 0 {
			_ = json.Unmarshal(cur.Payments, &payments)
		}
		if p == nil {
			delete(payments, month)
		} else {
			payments[month] = *p
		}
		row, err := q.SetCreditCardPayments(ctx, sqlcgen.SetCreditCardPaymentsParams{ID: cid, UserID: userID, Payments: cardPayments(payments)})
		if err != nil {
			return mapErr(err)
		}
		out = cardFrom(row)
		return nil
	})
	return out, err
}

func (s *Store) UpdateCreditCard(ctx context.Context, userID uuid.UUID, id string, p CardPatch) (domain.CreditCard, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditCard{}, err
	}
	arg := sqlcgen.UpdateCreditCardParams{Name: text(p.Name), LimitCents: int8v(p.Limit), ID: cid, UserID: userID}
	if p.ClosingDay != nil {
		arg.ClosingDay.Int64, arg.ClosingDay.Valid = int64(*p.ClosingDay), true
	}
	if p.DueDay != nil {
		arg.DueDay.Int64, arg.DueDay.Valid = int64(*p.DueDay), true
	}
	row, err := s.q.UpdateCreditCard(ctx, arg)
	return cardFrom(row), mapErr(err)
}

// DeleteCreditCard apaga o cartão; as compras ligadas a ele ficam sem cartão (ON DELETE SET NULL).
func (s *Store) DeleteCreditCard(ctx context.Context, userID uuid.UUID, id string) error {
	cid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteCreditCard(ctx, sqlcgen.DeleteCreditCardParams{ID: cid, UserID: userID}))
}

/* ---------- metas ---------- */

type GoalPatch struct {
	Name       *string
	Target     *int64
	Saved      *int64
	Monthly    *int64
	YieldTotal *int64
	// SetDeadline indica que o prazo veio na requisição; Deadline nil limpa o prazo.
	SetDeadline bool
	Deadline    *string
}

// CreateGoal cria a meta. O guardado e os rendimentos são derivados do histórico: se a meta já chega com valor
// (clientes antigos e importações antigas), ele vira o começo do histórico ("Saldo inicial") na mesma transação.
func (s *Store) CreateGoal(ctx context.Context, userID uuid.UUID, g domain.Goal) (domain.Goal, error) {
	var out domain.Goal
	err := s.inTx(ctx, func(q *sqlcgen.Queries) error {
		created, err := q.CreateGoal(ctx, goalParams(userID, g))
		if err != nil {
			return err
		}
		out = goalFrom(created)
		if g.Saved <= 0 && g.YieldTotal <= 0 {
			return nil
		}
		if err := insertGoalOpening(ctx, q, userID, created.ID, g.Saved, g.YieldTotal, today()); err != nil {
			return err
		}
		out, err = refreshGoal(ctx, q, userID, created.ID)
		return err
	})
	return out, mapErr(err)
}

// goalParams: o guardado e os rendimentos entram zerados; quem os define é o histórico (refreshGoal).
func goalParams(userID uuid.UUID, g domain.Goal) sqlcgen.CreateGoalParams {
	return sqlcgen.CreateGoalParams{
		ID: clientID(g.ID), UserID: userID, Name: g.Name, TargetCents: g.Target,
		MonthlyCents: g.Monthly, Deadline: text(g.Deadline), Piggy: g.Piggy,
	}
}

func (s *Store) UpdateGoal(ctx context.Context, userID uuid.UUID, id string, p GoalPatch) (domain.Goal, error) {
	gid, err := parseID(id)
	if err != nil {
		return domain.Goal{}, err
	}
	// Saved vira um ajuste no histórico (clientes antigos que ainda mandam o guardado no PATCH); YieldTotal é
	// derivado dos rendimentos do histórico e não pode ser escrito direto.
	var out domain.Goal
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetGoalForUpdate(ctx, sqlcgen.GetGoalForUpdateParams{ID: gid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		row, err := q.UpdateGoal(ctx, sqlcgen.UpdateGoalParams{
			Name: text(p.Name), TargetCents: int8v(p.Target), MonthlyCents: int8v(p.Monthly), ID: gid, UserID: userID,
		})
		if err != nil {
			return err
		}
		// o prazo so muda quando veio na requisicao; Deadline nil limpa
		if p.SetDeadline {
			if row, err = q.SetGoalDeadline(ctx, sqlcgen.SetGoalDeadlineParams{Deadline: text(p.Deadline), ID: gid, UserID: userID}); err != nil {
				return err
			}
		}
		out = goalFrom(row)
		if p.Saved != nil && *p.Saved != cur.SavedCents {
			if _, err := q.CreateGoalMovement(ctx, sqlcgen.CreateGoalMovementParams{
				ID: uuid.New(), UserID: userID, GoalID: gid, Type: domain.GoalAdjustment, Date: today(), AmountCents: *p.Saved, Note: "Ajuste do valor guardado",
			}); err != nil {
				return err
			}
			out, err = refreshGoal(ctx, q, userID, gid)
		}
		return err
	})
	return out, mapErr(err)
}

func (s *Store) DeleteGoal(ctx context.Context, userID uuid.UUID, id string) error {
	gid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteGoal(ctx, sqlcgen.DeleteGoalParams{ID: gid, UserID: userID}))
}

/* ---------- despesas extras ---------- */

type ExtraPatch struct {
	Name   *string
	Amount *int64
	Month  *string
	// CardID: nil não muda; ponteiro para "" solta a despesa do cartão. PurchaseDate: dia da compra no cartão.
	CardID       *string
	PurchaseDate *string
}

func (s *Store) CreateExtra(ctx context.Context, userID uuid.UUID, e domain.ExtraExpense) (domain.ExtraExpense, error) {
	if err := ownsCard(ctx, s.q, userID, e.CardID); err != nil {
		return domain.ExtraExpense{}, err
	}
	row, err := s.q.CreateExtraExpense(ctx, sqlcgen.CreateExtraExpenseParams{
		ID: clientID(e.ID), UserID: userID, Name: e.Name, AmountCents: e.Amount, Month: e.Month,
		CardID: nullID(e.CardID), PurchaseDate: e.PurchaseDate,
	})
	return extraFrom(row), mapErr(err)
}

func (s *Store) UpdateExtra(ctx context.Context, userID uuid.UUID, id string, p ExtraPatch) (domain.ExtraExpense, error) {
	eid, err := parseID(id)
	if err != nil {
		return domain.ExtraExpense{}, err
	}
	var out domain.ExtraExpense
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		arg := sqlcgen.UpdateExtraExpenseParams{
			Name: text(p.Name), AmountCents: int8v(p.Amount), Month: text(p.Month), PurchaseDate: text(p.PurchaseDate), ID: eid, UserID: userID,
		}
		row, err := q.UpdateExtraExpense(ctx, arg)
		if err != nil {
			return mapErr(err)
		}
		// o cartão só muda quando veio na requisição; id vazio solta a despesa do cartão (no SQLite é uma consulta à parte)
		if p.CardID != nil {
			if err := ownsCard(ctx, q, userID, *p.CardID); err != nil {
				return err
			}
			if row, err = q.SetExtraExpenseCard(ctx, sqlcgen.SetExtraExpenseCardParams{CardID: nullID(*p.CardID), ID: eid, UserID: userID}); err != nil {
				return mapErr(err)
			}
		}
		if err := checkCardState(false, "expense", row.CardID, row.PurchaseDate); err != nil {
			return err
		}
		out = extraFrom(row)
		return nil
	})
	return out, mapErr(err)
}

func (s *Store) DeleteExtra(ctx context.Context, userID uuid.UUID, id string) error {
	eid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteExtraExpense(ctx, sqlcgen.DeleteExtraExpenseParams{ID: eid, UserID: userID}))
}

/* ---------- anotações ---------- */

type NotePatch struct {
	Content *string
	Date    *string
	Pinned  *bool
	Month   *string
}

func (s *Store) CreateNote(ctx context.Context, userID uuid.UUID, n domain.Note) (domain.Note, error) {
	row, err := s.q.CreateNote(ctx, sqlcgen.CreateNoteParams{
		ID: clientID(n.ID), UserID: userID, Content: n.Content, Date: n.Date, Pinned: n.Pinned, Month: n.Month,
	})
	return noteFrom(row), mapErr(err)
}

func (s *Store) UpdateNote(ctx context.Context, userID uuid.UUID, id string, p NotePatch) (domain.Note, error) {
	nid, err := parseID(id)
	if err != nil {
		return domain.Note{}, err
	}
	row, err := s.q.UpdateNote(ctx, sqlcgen.UpdateNoteParams{
		Content: text(p.Content), Date: text(p.Date), Pinned: boolv(p.Pinned), Month: text(p.Month),
		ID: nid, UserID: userID,
	})
	return noteFrom(row), mapErr(err)
}

func (s *Store) DeleteNote(ctx context.Context, userID uuid.UUID, id string) error {
	nid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteNote(ctx, sqlcgen.DeleteNoteParams{ID: nid, UserID: userID}))
}

/* ---------- categorias ---------- */

func (s *Store) CreateCategory(ctx context.Context, userID uuid.UUID, c domain.CustomCategory) (domain.CustomCategory, error) {
	row, err := s.q.CreateCategory(ctx, sqlcgen.CreateCategoryParams{ID: clientID(c.ID), UserID: userID, Name: c.Name, Color: c.Color})
	return domain.CustomCategory{ID: row.ID.String(), Name: row.Name, Color: row.Color}, mapErr(err)
}

// CategoryPatch: nil não muda.
type CategoryPatch struct {
	Name  *string
	Color *string
}

// UpdateCategory troca o nome e/ou a cor de uma categoria. Os lançamentos guardam a categoria pelo nome, então,
// quando o nome muda, as despesas e as compras no crédito do usuário que usavam o nome antigo passam para o novo,
// tudo na mesma transação. Nome repetido (sem diferenciar maiúsculas) volta como ErrDuplicate.
func (s *Store) UpdateCategory(ctx context.Context, userID uuid.UUID, id string, p CategoryPatch) (domain.CustomCategory, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CustomCategory{}, err
	}
	var out domain.CustomCategory
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetCategoryForUpdate(ctx, sqlcgen.GetCategoryForUpdateParams{ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		row, err := q.UpdateCategory(ctx, sqlcgen.UpdateCategoryParams{Name: text(p.Name), Color: text(p.Color), ID: cid, UserID: userID})
		if err != nil {
			return mapErr(err)
		}
		if row.Name != cur.Name {
			if _, err := q.RenameTransactionCategory(ctx, sqlcgen.RenameTransactionCategoryParams{UserID: userID, OldName: cur.Name, NewName: row.Name}); err != nil {
				return err
			}
			if _, err := q.RenameCreditCategory(ctx, sqlcgen.RenameCreditCategoryParams{UserID: userID, OldName: cur.Name, NewName: row.Name}); err != nil {
				return err
			}
		}
		out = domain.CustomCategory{ID: row.ID.String(), Name: row.Name, Color: row.Color}
		return nil
	})
	return out, err
}

func (s *Store) DeleteCategory(ctx context.Context, userID uuid.UUID, id string) error {
	cid, err := parseID(id)
	if err != nil {
		return err
	}
	return notFoundIfZero(s.q.DeleteCategory(ctx, sqlcgen.DeleteCategoryParams{ID: cid, UserID: userID}))
}

/* ---------- importação ---------- */

// Import grava os dados vindos do localStorage numa transação só.
// Sem `replace`, recusa (ErrHasData) se a conta já tem dados, para não duplicar.
// Os ids de origem são ignorados (o banco gera os novos).
func (s *Store) Import(ctx context.Context, userID uuid.UUID, d domain.FinanceData, replace bool) (domain.FinanceData, error) {
	err := s.inTx(ctx, func(q *sqlcgen.Queries) error {
		if !replace {
			empty, err := emptyIn(ctx, q, userID)
			if err != nil {
				return err
			}
			if !empty {
				return ErrHasData
			}
		} else {
			for _, wipe := range []func(context.Context, uuid.UUID) error{
				q.WipeTransactions, q.WipeCredits, q.WipeCreditCards, q.WipeGoals, q.WipeInvestments, q.WipeExtraExpenses, q.WipeNotes, q.WipeCategories,
			} {
				if err := wipe(ctx, userID); err != nil {
					return err
				}
			}
		}

		// os ids de origem são ignorados: os cartões ganham ids novos e as compras e despesas passam a apontar para eles
		newCard := map[string]string{}
		for _, k := range d.CreditCards {
			created, err := q.CreateCreditCard(ctx, sqlcgen.CreateCreditCardParams{ID: uuid.New(), UserID: userID, Name: k.Name, ClosingDay: int64(k.ClosingDay), DueDay: int64(k.DueDay), LimitCents: k.Limit, Payments: cardPayments(k.Payments)})
			if err != nil {
				return err
			}
			if len(k.Adjustments) > 0 {
				if _, err := q.SetCreditCardAdjustments(ctx, sqlcgen.SetCreditCardAdjustmentsParams{ID: created.ID, UserID: userID, Adjustments: cardAdjustments(k.Adjustments)}); err != nil {
					return err
				}
			}
			newCard[k.ID] = created.ID.String()
		}

		for _, t := range d.Transactions {
			t.CardID = newCard[t.CardID]
			created, err := createTransaction(ctx, q, userID, t)
			if err != nil {
				return err
			}
			if len(t.MonthlyNotes) > 0 {
				raw, err := json.Marshal(t.MonthlyNotes)
				if err != nil {
					return err
				}
				tid, err := parseID(created.ID)
				if err != nil {
					return err
				}
				if _, err := q.SetTransactionMonthlyNotes(ctx, sqlcgen.SetTransactionMonthlyNotesParams{ID: tid, UserID: userID, MonthlyNotes: raw}); err != nil {
					return err
				}
			}
			if len(t.Payments) > 0 {
				raw, err := json.Marshal(t.Payments)
				if err != nil {
					return err
				}
				tid, err := parseID(created.ID)
				if err != nil {
					return err
				}
				if _, err := q.SetTransactionPayments(ctx, sqlcgen.SetTransactionPaymentsParams{ID: tid, UserID: userID, Payments: raw}); err != nil {
					return err
				}
			}
		}
		for _, c := range d.CreditTransactions {
			c.CardID = newCard[c.CardID]
			if _, err := q.CreateCredit(ctx, creditParams(userID, c)); err != nil {
				return err
			}
		}
		for _, n := range d.Notes {
			if _, err := q.CreateNote(ctx, sqlcgen.CreateNoteParams{ID: clientID(n.ID), UserID: userID, Content: n.Content, Date: n.Date, Pinned: n.Pinned, Month: n.Month}); err != nil {
				return err
			}
		}
		// metas: ganham o id do banco e as movimentações do pacote passam a apontar para elas. O guardado vem do
		// histórico; uma meta de pacote antigo (sem histórico) ganha o "Saldo inicial" com o que tinha guardado.
		newGoal := map[string]uuid.UUID{}
		withHistory := map[string]bool{}
		for _, m := range d.GoalMovements {
			withHistory[m.GoalID] = true
		}
		for _, g := range d.Goals {
			created, err := q.CreateGoal(ctx, goalParams(userID, g))
			if err != nil {
				return err
			}
			newGoal[g.ID] = created.ID
			if !withHistory[g.ID] {
				if err := insertGoalOpening(ctx, q, userID, created.ID, g.Saved, g.YieldTotal, today()); err != nil {
					return err
				}
			}
		}
		for _, m := range d.GoalMovements {
			gid, ok := newGoal[m.GoalID]
			if !ok {
				return &ValidationError{"Movimentação de uma meta que não está no pacote."}
			}
			if _, err := q.CreateGoalMovement(ctx, sqlcgen.CreateGoalMovementParams{
				ID: uuid.New(),
				UserID: userID, GoalID: gid, Type: m.Type, Date: m.Date, AmountCents: m.Amount, Note: m.Note, Origin: m.Origin,
			}); err != nil {
				return err
			}
		}
		for _, id := range newGoal {
			if _, err := refreshGoal(ctx, q, userID, id); err != nil {
				return err
			}
		}
		// investimentos ganham ids novos (como os cartões) e as movimentações passam a apontar para eles.
		// Valor atual, cotas e preço médio vêm como estão no pacote: a importação não refaz a conta.
		newInvestment := map[string]uuid.UUID{}
		for _, inv := range d.Investments {
			created, err := q.CreateInvestment(ctx, investmentParams(userID, uuid.New(), inv))
			if err != nil {
				return err
			}
			newInvestment[inv.ID] = created.ID
		}
		for _, m := range d.InvestmentMovements {
			iid, ok := newInvestment[m.InvestmentID]
			if !ok {
				return &ValidationError{"Movimentação de um investimento que não está no pacote."}
			}
			if _, err := q.CreateInvestmentMovement(ctx, sqlcgen.CreateInvestmentMovementParams{
				ID: uuid.New(),
				UserID: userID, InvestmentID: iid, Type: m.Type, Date: m.Date, AmountCents: m.Amount,
				Quantity: m.Quantity, UnitPriceCents: nullInt8(m.UnitPrice), Note: m.Note, Origin: m.Origin,
			}); err != nil {
				return err
			}
		}
		for _, e := range d.ExtraExpenses {
			created, err := q.CreateExtraExpense(ctx, sqlcgen.CreateExtraExpenseParams{ID: clientID(e.ID), UserID: userID, Name: e.Name, AmountCents: e.Amount, Month: e.Month, CardID: nullID(newCard[e.CardID]), PurchaseDate: e.PurchaseDate})
			if err != nil {
				return err
			}
			if e.Payment != nil {
				raw, err := json.Marshal(e.Payment)
				if err != nil {
					return err
				}
				if _, err := q.SetExtraExpensePayment(ctx, sqlcgen.SetExtraExpensePaymentParams{ID: created.ID, UserID: userID, Payment: raw}); err != nil {
					return err
				}
			}
		}
		for _, c := range d.CustomCategories {
			if _, err := q.CreateCategory(ctx, sqlcgen.CreateCategoryParams{ID: clientID(c.ID), UserID: userID, Name: c.Name, Color: c.Color}); err != nil {
				return err
			}
		}

		var raw []byte
		if d.Distribution != nil {
			var err error
			if raw, err = jsonMarshal(d.Distribution); err != nil {
				return err
			}
		}
		if err := q.SetDistribution(ctx, sqlcgen.SetDistributionParams{UserID: userID, Distribution: raw}); err != nil {
			return err
		}
		overrides := d.DistributionOverrides
		if overrides == nil {
			overrides = map[string][]domain.DistributionItem{}
		}
		rawOverrides, err := jsonMarshal(overrides)
		if err != nil {
			return err
		}
		if err := q.SetDistributionOverrides(ctx, sqlcgen.SetDistributionOverridesParams{UserID: userID, DistributionOverrides: rawOverrides}); err != nil {
			return err
		}
		planning := domain.Planning{Budgets: d.Budgets, Debts: d.Debts, Closings: d.Closings, DividendAssets: d.DividendAssets}
		planning.Normalize()
		rawPlanning, err := jsonMarshal(planning)
		if err != nil {
			return err
		}
		if err := q.SetPlanning(ctx, sqlcgen.SetPlanningParams{UserID: userID, Planning: sqlitetypes.JSON(rawPlanning)}); err != nil {
			return err
		}
		seen := d.SeenAlerts
		if seen == nil {
			seen = []string{}
		}
		if err := q.SetSeenAlerts(ctx, sqlcgen.SetSeenAlertsParams{UserID: userID, SeenAlerts: seen}); err != nil {
			return err
		}
		// quem já viu os tours no navegador não precisa vê-los de novo na conta
		if len(d.Onboarding) > 0 {
			raw, err := jsonMarshal(d.Onboarding)
			if err != nil {
				return err
			}
			return q.MergeOnboarding(ctx, sqlcgen.MergeOnboardingParams{UserID: userID, Onboarding: raw})
		}
		return nil
	})
	if err != nil {
		return domain.FinanceData{}, mapErr(err)
	}
	return s.LoadData(ctx, userID)
}

func emptyIn(ctx context.Context, q *sqlcgen.Queries, userID uuid.UUID) (bool, error) {
	if r, err := q.ListTransactions(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListCredits(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListCreditCards(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListNotes(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListGoals(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListInvestments(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListExtraExpenses(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListCategories(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	return true, nil
}
