package store

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
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
}

func (s *Store) CreateTransaction(ctx context.Context, userID uuid.UUID, t domain.Transaction) (domain.Transaction, error) {
	var out domain.Transaction
	err := s.inTx(ctx, func(q *sqlcgen.Queries) error {
		var err error
		out, err = createTransaction(ctx, q, userID, t)
		return err
	})
	return out, mapErr(err)
}

func createTransaction(ctx context.Context, q *sqlcgen.Queries, userID uuid.UUID, t domain.Transaction) (domain.Transaction, error) {
	row, err := q.CreateTransaction(ctx, sqlcgen.CreateTransactionParams{
		Column1: clientID(t.ID), UserID: userID, Name: t.Name, AmountCents: t.Amount, Type: t.Type,
		Category: t.Category, Notes: t.Notes, Fixed: t.Fixed, Month: t.Month,
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
		row, err := q.UpdateTransaction(ctx, sqlcgen.UpdateTransactionParams{
			Name: text(p.Name), AmountCents: int8v(p.Amount), Category: text(p.Category),
			Notes: text(p.Notes), Fixed: boolv(p.Fixed), ID: tid, UserID: userID,
		})
		if err != nil {
			return err
		}

		if p.MonthlyNotes != nil && row.Fixed {
			raw, err := json.Marshal(*p.MonthlyNotes)
			if err != nil {
				return err
			}
			if row, err = q.SetTransactionMonthlyNotes(ctx, sqlcgen.SetTransactionMonthlyNotesParams{ID: tid, UserID: userID, Column3: raw}); err != nil {
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
		if (!cur.Fixed && month != cur.Month) || (cur.Fixed && domain.CompareMonths(month, cur.Month) < 0) {
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
		row, err := q.SetTransactionPayments(ctx, sqlcgen.SetTransactionPaymentsParams{ID: tid, UserID: userID, Column3: raw})
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
	row, err := s.q.SetExtraExpensePayment(ctx, sqlcgen.SetExtraExpensePaymentParams{ID: eid, UserID: userID, Column3: raw})
	return extraFrom(row), mapErr(err)
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
		Column1: clientID(c.ID), UserID: userID, Name: c.Name, TotalCents: c.TotalAmount,
		Installments: int32(c.Installments), StartMonth: c.StartMonth, Category: c.Category,
		Column8: adjustments,
		Recurring: c.Recurring, EndMonth: text(nilIfEmpty(c.EndMonth)), BillingDay: int32(c.BillingDay),
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
			arg.BillingDay.Int32, arg.BillingDay.Valid = int32(*p.BillingDay), true
		}
		arg.VariableAmount = boolv(p.VariableAmount)
		if p.CardID != nil {
			arg.SetCard, arg.CardID = true, nullID(*p.CardID)
		}
		if p.Installments != nil {
			arg.Installments.Int32, arg.Installments.Valid = int32(*p.Installments), true
		}
		row, err := q.UpdateCredit(ctx, arg)
		out = creditFrom(row)
		return mapErr(err)
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
		row, err := q.SetCreditAdjustments(ctx, sqlcgen.SetCreditAdjustmentsParams{ID: cid, UserID: userID, Column3: raw})
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
}

func nullID(id string) uuid.NullUUID {
	u, err := uuid.Parse(id)
	return uuid.NullUUID{UUID: u, Valid: err == nil && id != ""}
}

func (s *Store) CreateCreditCard(ctx context.Context, userID uuid.UUID, c domain.CreditCard) (domain.CreditCard, error) {
	row, err := s.q.CreateCreditCard(ctx, sqlcgen.CreateCreditCardParams{Column1: clientID(c.ID), UserID: userID, Name: c.Name, ClosingDay: int32(c.ClosingDay), DueDay: int32(c.DueDay)})
	return cardFrom(row), mapErr(err)
}

func (s *Store) UpdateCreditCard(ctx context.Context, userID uuid.UUID, id string, p CardPatch) (domain.CreditCard, error) {
	cid, err := parseID(id)
	if err != nil {
		return domain.CreditCard{}, err
	}
	arg := sqlcgen.UpdateCreditCardParams{Name: text(p.Name), ID: cid, UserID: userID}
	if p.ClosingDay != nil {
		arg.ClosingDay.Int32, arg.ClosingDay.Valid = int32(*p.ClosingDay), true
	}
	if p.DueDay != nil {
		arg.DueDay.Int32, arg.DueDay.Valid = int32(*p.DueDay), true
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

func (s *Store) CreateGoal(ctx context.Context, userID uuid.UUID, g domain.Goal) (domain.Goal, error) {
	row, err := s.q.CreateGoal(ctx, goalParams(userID, g))
	return goalFrom(row), mapErr(err)
}

func goalParams(userID uuid.UUID, g domain.Goal) sqlcgen.CreateGoalParams {
	return sqlcgen.CreateGoalParams{
		Column1: clientID(g.ID), UserID: userID, Name: g.Name, TargetCents: g.Target, SavedCents: g.Saved,
		MonthlyCents: g.Monthly, Deadline: text(g.Deadline), YieldTotalCents: g.YieldTotal, Piggy: g.Piggy,
	}
}

func (s *Store) UpdateGoal(ctx context.Context, userID uuid.UUID, id string, p GoalPatch) (domain.Goal, error) {
	gid, err := parseID(id)
	if err != nil {
		return domain.Goal{}, err
	}
	row, err := s.q.UpdateGoal(ctx, sqlcgen.UpdateGoalParams{
		Name: text(p.Name), TargetCents: int8v(p.Target), SavedCents: int8v(p.Saved),
		MonthlyCents: int8v(p.Monthly), YieldTotalCents: int8v(p.YieldTotal),
		SetDeadline: p.SetDeadline, Deadline: text(p.Deadline), ID: gid, UserID: userID,
	})
	return goalFrom(row), mapErr(err)
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
}

func (s *Store) CreateExtra(ctx context.Context, userID uuid.UUID, e domain.ExtraExpense) (domain.ExtraExpense, error) {
	row, err := s.q.CreateExtraExpense(ctx, sqlcgen.CreateExtraExpenseParams{
		Column1: clientID(e.ID), UserID: userID, Name: e.Name, AmountCents: e.Amount, Month: e.Month,
	})
	return extraFrom(row), mapErr(err)
}

func (s *Store) UpdateExtra(ctx context.Context, userID uuid.UUID, id string, p ExtraPatch) (domain.ExtraExpense, error) {
	eid, err := parseID(id)
	if err != nil {
		return domain.ExtraExpense{}, err
	}
	row, err := s.q.UpdateExtraExpense(ctx, sqlcgen.UpdateExtraExpenseParams{
		Name: text(p.Name), AmountCents: int8v(p.Amount), Month: text(p.Month), ID: eid, UserID: userID,
	})
	return extraFrom(row), mapErr(err)
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
		Column1: clientID(n.ID), UserID: userID, Content: n.Content, Date: n.Date, Pinned: n.Pinned, Month: n.Month,
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
	row, err := s.q.CreateCategory(ctx, sqlcgen.CreateCategoryParams{Column1: clientID(c.ID), UserID: userID, Name: c.Name, Color: c.Color})
	return domain.CustomCategory{ID: row.ID.String(), Name: row.Name, Color: row.Color}, mapErr(err)
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
				q.WipeTransactions, q.WipeCredits, q.WipeCreditCards, q.WipeGoals, q.WipeExtraExpenses, q.WipeNotes, q.WipeCategories,
			} {
				if err := wipe(ctx, userID); err != nil {
					return err
				}
			}
		}

		for _, t := range d.Transactions {
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
				if _, err := q.SetTransactionMonthlyNotes(ctx, sqlcgen.SetTransactionMonthlyNotesParams{ID: tid, UserID: userID, Column3: raw}); err != nil {
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
				if _, err := q.SetTransactionPayments(ctx, sqlcgen.SetTransactionPaymentsParams{ID: tid, UserID: userID, Column3: raw}); err != nil {
					return err
				}
			}
		}
		// os ids de origem são ignorados: os cartões ganham ids novos e as compras passam a apontar para eles
		newCard := map[string]string{}
		for _, k := range d.CreditCards {
			created, err := q.CreateCreditCard(ctx, sqlcgen.CreateCreditCardParams{UserID: userID, Name: k.Name, ClosingDay: int32(k.ClosingDay), DueDay: int32(k.DueDay)})
			if err != nil {
				return err
			}
			newCard[k.ID] = created.ID.String()
		}
		for _, c := range d.CreditTransactions {
			c.CardID = newCard[c.CardID]
			if _, err := q.CreateCredit(ctx, creditParams(userID, c)); err != nil {
				return err
			}
		}
		for _, n := range d.Notes {
			if _, err := q.CreateNote(ctx, sqlcgen.CreateNoteParams{Column1: clientID(n.ID), UserID: userID, Content: n.Content, Date: n.Date, Pinned: n.Pinned, Month: n.Month}); err != nil {
				return err
			}
		}
		for _, g := range d.Goals {
			if _, err := q.CreateGoal(ctx, goalParams(userID, g)); err != nil {
				return err
			}
		}
		for _, e := range d.ExtraExpenses {
			created, err := q.CreateExtraExpense(ctx, sqlcgen.CreateExtraExpenseParams{Column1: clientID(e.ID), UserID: userID, Name: e.Name, AmountCents: e.Amount, Month: e.Month})
			if err != nil {
				return err
			}
			if e.Payment != nil {
				raw, err := json.Marshal(e.Payment)
				if err != nil {
					return err
				}
				if _, err := q.SetExtraExpensePayment(ctx, sqlcgen.SetExtraExpensePaymentParams{ID: created.ID, UserID: userID, Column3: raw}); err != nil {
					return err
				}
			}
		}
		for _, c := range d.CustomCategories {
			if _, err := q.CreateCategory(ctx, sqlcgen.CreateCategoryParams{Column1: clientID(c.ID), UserID: userID, Name: c.Name, Color: c.Color}); err != nil {
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
	if r, err := q.ListExtraExpenses(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	if r, err := q.ListCategories(ctx, userID); err != nil || len(r) > 0 {
		return false, err
	}
	return true, nil
}
