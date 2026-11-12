package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Despesas no cartão: cartão e dia da compra nas despesas (comuns e extras), teto do cartão, mês da fatura nos
// relatórios, soltar ao apagar o cartão e importação.

func newCard(t *testing.T, e *env, tk string, body map[string]any) domain.CreditCard {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/credit-cards", tk, body)
	want(t, r, http.StatusCreated)
	var c domain.CreditCard
	r.json(t, &c)
	return c
}

func loadData(t *testing.T, e *env, tk string) domain.FinanceData {
	t.Helper()
	var d domain.FinanceData
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &d)
	return d
}

func TestCardExpenseValidation(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})
	other := e.register(t, "").AccessToken
	foreign := newCard(t, e, other, map[string]any{"name": "Alheio", "closingDay": 2, "dueDay": 9})

	expense := func(extra map[string]any) map[string]any {
		m := map[string]any{"name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11"}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}

	// com cartão, o dia da compra é obrigatório e tem que ser uma data real
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": card.ID})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": card.ID, "purchaseDate": "2026-02-30"})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"purchaseDate": "07/11/2026"})), 400)
	// despesa fixa e renda não têm cartão
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": card.ID, "purchaseDate": "2026-11-07", "fixed": true})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": card.ID, "purchaseDate": "2026-11-07", "type": "income"})), 400)
	// cartão de outra conta
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": foreign.ID, "purchaseDate": "2026-11-07"})), 422)
	want(t, e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "X", "amount": 1, "month": "2026-12", "cardId": foreign.ID, "purchaseDate": "2026-12-01"}), 422)
	// extra: mesmas regras
	want(t, e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "X", "amount": 1, "month": "2026-12", "cardId": card.ID}), 400)

	r := e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"cardId": card.ID, "purchaseDate": "2026-11-07"}))
	want(t, r, http.StatusCreated)
	var tx domain.Transaction
	r.json(t, &tx)
	if tx.CardID != card.ID || tx.PurchaseDate != "2026-11-07" || tx.Month != "2026-11" {
		t.Fatalf("criada=%+v", tx)
	}

	// o dia da compra sem cartão é aceito (é o que fica no histórico depois que o cartão sai)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, expense(map[string]any{"purchaseDate": "2026-11-07"})), 201)
}

func TestCardExpensePatchAndRelease(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})

	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11"})
	want(t, r, 201)
	var tx domain.Transaction
	r.json(t, &tx)
	r = e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "Presente", "amount": 9000, "month": "2026-12"})
	want(t, r, 201)
	var ex domain.ExtraExpense
	r.json(t, &ex)

	// ligar ao cartão exige o dia da compra no mesmo pedido (ou já guardado)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"cardId": card.ID}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"cardId": card.ID, "purchaseDate": "2026-11-07"}), 200)
	want(t, e.do(t, "PATCH", "/api/v1/extra-expenses/"+ex.ID, tk, map[string]any{"cardId": card.ID}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/extra-expenses/"+ex.ID, tk, map[string]any{"cardId": card.ID, "purchaseDate": "2026-12-01"}), 200)

	// virar fixa com cartão é recusado, e nada muda
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"fixed": true}), 422)
	if d := loadData(t, e, tk); d.Transactions[0].Fixed || d.Transactions[0].CardID != card.ID {
		t.Fatalf("a recusa não desfez: %+v", d.Transactions[0])
	}

	// trocar só o dia da compra mantém o cartão
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"purchaseDate": "2026-11-01"}), 200)
	if d := loadData(t, e, tk); d.Transactions[0].CardID != card.ID || d.Transactions[0].PurchaseDate != "2026-11-01" {
		t.Fatalf("depois do patch: %+v", d.Transactions[0])
	}

	// soltar: cardId "" tira o cartão e o dia da compra fica
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"cardId": ""}), 200)
	d := loadData(t, e, tk)
	if d.Transactions[0].CardID != "" || d.Transactions[0].PurchaseDate != "2026-11-01" {
		t.Fatalf("depois de soltar: %+v", d.Transactions[0])
	}

	// apagar o cartão solta as despesas e as extras, sem apagar nenhuma
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"cardId": card.ID}), 200)
	want(t, e.do(t, "DELETE", "/api/v1/credit-cards/"+card.ID, tk, nil), http.StatusNoContent)
	d = loadData(t, e, tk)
	if len(d.Transactions) != 1 || len(d.ExtraExpenses) != 1 || d.Transactions[0].CardID != "" || d.ExtraExpenses[0].CardID != "" {
		t.Fatalf("depois de apagar o cartão: %+v %+v", d.Transactions, d.ExtraExpenses)
	}
	if d.Transactions[0].PurchaseDate != "2026-11-01" || d.ExtraExpenses[0].PurchaseDate != "2026-12-01" {
		t.Fatalf("o dia da compra deveria ficar no histórico: %+v %+v", d.Transactions[0], d.ExtraExpenses[0])
	}
}

func TestCardLimit(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	want(t, e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "X", "closingDay": 2, "dueDay": 9, "limit": -1}), 400)
	want(t, e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "X", "closingDay": 2, "dueDay": 9, "limit": domain.MaxInvestmentCents + 1}), 400)

	// sem teto: o campo nem aparece
	plain := newCard(t, e, tk, map[string]any{"name": "Sem teto", "closingDay": 2, "dueDay": 9})
	if plain.Limit != 0 {
		t.Fatalf("sem teto: %+v", plain)
	}
	card := newCard(t, e, tk, map[string]any{"name": "Com teto", "closingDay": 2, "dueDay": 9, "limit": 30000})
	if card.Limit != 30000 {
		t.Fatalf("com teto: %+v", card)
	}

	want(t, e.do(t, "PATCH", "/api/v1/credit-cards/"+card.ID, tk, map[string]any{"limit": 45000}), 200)
	want(t, e.do(t, "PATCH", "/api/v1/credit-cards/"+card.ID, tk, map[string]any{"limit": -5}), 400)
	// editar outro campo não mexe no teto; limit 0 tira o teto
	want(t, e.do(t, "PATCH", "/api/v1/credit-cards/"+card.ID, tk, map[string]any{"name": "Renomeado"}), 200)
	for _, c := range loadData(t, e, tk).CreditCards {
		if c.ID == card.ID && (c.Limit != 45000 || c.Name != "Renomeado") {
			t.Fatalf("depois de editar: %+v", c)
		}
	}
	want(t, e.do(t, "PATCH", "/api/v1/credit-cards/"+card.ID, tk, map[string]any{"limit": 0}), 200)
	for _, c := range loadData(t, e, tk).CreditCards {
		if c.ID == card.ID && c.Limit != 0 {
			t.Fatalf("limit 0 deveria tirar o teto: %+v", c)
		}
	}
}

func TestCardExpensesShiftReports(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})

	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "month": "2026-11"}), 201)
	// compra de 07/11 (depois do fechamento, dia 2) vence em dezembro; a de 01/11 vence em novembro
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-07"}), 201)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Padaria", "amount": 700, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-01"}), 201)
	want(t, e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "Viagem", "amount": 8000, "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-20"}), 201)

	summary := func(month string) domain.MonthSummary {
		r := e.do(t, "GET", "/api/v1/summary/"+month, tk, nil)
		want(t, r, 200)
		var s domain.MonthSummary
		r.json(t, &s)
		return s
	}
	if got := summary("2026-11").TotalExpense; got != 100000+700 {
		t.Fatalf("novembro: %d", got)
	}
	if got := summary("2026-12").TotalExpense; got != 5000 {
		t.Fatalf("dezembro: %d", got)
	}

	// a despesa extra com cartão aparece na projeção do mês da fatura
	r := e.do(t, "GET", "/api/v1/projection?start=2026-11&count=2", tk, nil)
	want(t, r, 200)
	var proj []domain.ProjectionMonth
	r.json(t, &proj)
	if proj[0].ExtraExpense != 0 || proj[1].ExtraExpense != 8000 {
		t.Fatalf("projeção: %+v", proj)
	}

	// sem o cartão cadastrado, tudo volta ao mês em que foi lançado e nenhum valor some
	want(t, e.do(t, "DELETE", "/api/v1/credit-cards/"+card.ID, tk, nil), http.StatusNoContent)
	if got := summary("2026-11").TotalExpense; got != 100000+5000+700 {
		t.Fatalf("novembro sem o cartão: %d", got)
	}
}

func TestCardExpensesImportAndExport(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	pack := map[string]any{
		"creditCards": []map[string]any{{"id": "cartao-a", "name": "Nubank", "closingDay": 2, "dueDay": 9, "limit": 30000}},
		"transactions": []map[string]any{
			{"id": "t1", "name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": "cartao-a", "purchaseDate": "2026-11-07"},
			{"id": "t2", "name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "month": "2026-11"},
		},
		"extraExpenses": []map[string]any{{"id": "e1", "name": "Viagem", "amount": 8000, "month": "2026-11", "cardId": "cartao-a", "purchaseDate": "2026-11-20"}},
	}

	// despesa fixa com cartão no pacote é recusada
	broken := map[string]any{
		"creditCards":  pack["creditCards"],
		"transactions": []map[string]any{{"id": "x", "name": "X", "amount": 1, "type": "expense", "category": "Outros", "month": "2026-11", "fixed": true, "cardId": "cartao-a", "purchaseDate": "2026-11-07"}},
	}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, broken), 400)

	r := e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, http.StatusCreated)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.CreditCards) != 1 || out.CreditCards[0].Limit != 30000 {
		t.Fatalf("cartões: %+v", out.CreditCards)
	}
	newID := out.CreditCards[0].ID
	if newID == "cartao-a" {
		t.Fatal("o cartão deveria ganhar um id novo")
	}
	var linked, free int
	for _, tx := range out.Transactions {
		if tx.CardID == newID && tx.PurchaseDate == "2026-11-07" {
			linked++
		} else if tx.CardID == "" {
			free++
		}
	}
	if linked != 1 || free != 1 || len(out.ExtraExpenses) != 1 || out.ExtraExpenses[0].CardID != newID || out.ExtraExpenses[0].PurchaseDate != "2026-11-20" {
		t.Fatalf("despesas apontam para o cartão novo? %+v %+v", out.Transactions, out.ExtraExpenses)
	}

	// importar de novo troca tudo, sem duplicar
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, pack), http.StatusCreated)
	if d := loadData(t, e, tk); len(d.Transactions) != 2 || len(d.CreditCards) != 1 || len(d.ExtraExpenses) != 1 {
		t.Fatalf("depois do segundo import: %d despesas, %d cartões, %d extras", len(d.Transactions), len(d.CreditCards), len(d.ExtraExpenses))
	}

	// a exportação da conta leva os campos
	r = e.do(t, "GET", "/api/v1/me/export", tk, nil)
	want(t, r, 200)
	var exp struct {
		Data domain.FinanceData `json:"data"`
	}
	r.json(t, &exp)
	if exp.Data.CreditCards[0].Limit != 30000 {
		t.Fatalf("exportação sem o teto: %+v", exp.Data.CreditCards)
	}
}

func TestCardInvoicePayment(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})
	url := "/api/v1/credit-cards/" + card.ID + "/payments/2026-12"

	// forma, data e mês são conferidos
	want(t, e.do(t, "PUT", url, tk, map[string]any{"method": "cheque", "date": "2026-11-01"}), 400)
	want(t, e.do(t, "PUT", url, tk, map[string]any{"method": "pix", "date": "09/12/2026"}), 400)
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/"+card.ID+"/payments/dezembro", tk, map[string]any{"method": "pix", "date": "2026-11-01"}), 400)
	// só boleto pode ter data futura (agendado)
	want(t, e.do(t, "PUT", url, tk, map[string]any{"method": "pix", "date": "2099-01-01"}), 400)
	want(t, e.do(t, "PUT", url, tk, map[string]any{"method": "boleto", "date": "2099-01-01", "notes": "agendado"}), 200)

	// marcar como paga devolve o cartão com o pagamento daquele mês, e os outros meses seguem sem pagamento
	r := e.do(t, "PUT", url, tk, map[string]any{"method": "pix", "date": "2026-11-01", "notes": "pago no app"})
	want(t, r, 200)
	var paid domain.CreditCard
	r.json(t, &paid)
	if p := paid.Payments["2026-12"]; p.Method != "pix" || p.Date != "2026-11-01" || p.Notes != "pago no app" || len(paid.Payments) != 1 {
		t.Fatalf("depois de pagar: %+v", paid.Payments)
	}
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/"+card.ID+"/payments/2027-01", tk, map[string]any{"method": "debit", "date": "2026-11-02"}), 200)
	if d := loadData(t, e, tk); len(d.CreditCards[0].Payments) != 2 {
		t.Fatalf("o GET /data deveria trazer os dois pagamentos: %+v", d.CreditCards[0].Payments)
	}

	// o pagamento é só registro: o valor do mês não muda
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-07"}), 201)
	r = e.do(t, "GET", "/api/v1/summary/2026-12", tk, nil)
	want(t, r, 200)
	var sum domain.MonthSummary
	r.json(t, &sum)
	if sum.TotalExpense != 5000 {
		t.Fatalf("o pagamento da fatura mexeu no total: %d", sum.TotalExpense)
	}

	// outra conta não enxerga nem altera
	want(t, e.do(t, "PUT", url, other, map[string]any{"method": "pix", "date": "2026-11-01"}), 404)
	want(t, e.do(t, "DELETE", url, other, nil), 404)

	// desmarcar
	r = e.do(t, "DELETE", url, tk, nil)
	want(t, r, 200)
	var cleared domain.CreditCard
	r.json(t, &cleared)
	if _, still := cleared.Payments["2026-12"]; still || len(cleared.Payments) != 1 {
		t.Fatalf("depois de desmarcar: %+v", cleared.Payments)
	}
	// desmarcar o que não está pago não dá erro (idempotente), e cartão inexistente é 404
	want(t, e.do(t, "DELETE", url, tk, nil), 200)
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/nao-e-uuid/payments/2026-12", tk, map[string]any{"method": "pix", "date": "2026-11-01"}), 404)

	// criar o cartão ignora pagamentos no corpo (só o endpoint próprio e a importação gravam)
	made := newCard(t, e, tk, map[string]any{"name": "Outro", "closingDay": 5, "dueDay": 12, "payments": map[string]any{"2026-12": map[string]any{"method": "pix", "date": "2026-11-03"}}})
	if len(made.Payments) != 0 {
		t.Fatalf("a criação deveria ignorar os pagamentos: %+v", made.Payments)
	}

	// importar e exportar levam os pagamentos
	pack := map[string]any{"creditCards": []map[string]any{{"id": "c1", "name": "Inter", "closingDay": 25, "dueDay": 5, "payments": map[string]any{"2026-12": map[string]any{"method": "boleto", "date": "2026-12-05"}}}}}
	r = e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, http.StatusCreated)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.CreditCards) != 1 || out.CreditCards[0].Payments["2026-12"].Method != "boleto" {
		t.Fatalf("importação perdeu o pagamento: %+v", out.CreditCards)
	}
	bad := map[string]any{"creditCards": []map[string]any{{"id": "c1", "name": "Inter", "closingDay": 25, "dueDay": 5, "payments": map[string]any{"2026-12": map[string]any{"method": "cheque", "date": "2026-12-05"}}}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, bad), 400)
}

func TestCardExpenseIsPaidByTheInvoice(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})
	pix := map[string]any{"method": "pix", "date": "2026-11-01"}

	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Padaria", "amount": 4200, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-01"})
	want(t, r, 201)
	var tx domain.Transaction
	r.json(t, &tx)
	r = e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "Presente", "amount": 9000, "month": "2026-12", "cardId": card.ID, "purchaseDate": "2026-12-01"})
	want(t, r, 201)
	var ex domain.ExtraExpense
	r.json(t, &ex)
	plain := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 100, "type": "expense", "category": "Alimentação", "month": "2026-11"})
	want(t, plain, 201)
	var free domain.Transaction
	plain.json(t, &free)

	// despesa e extra no cartão não são pagas sozinhas
	want(t, e.do(t, "PUT", "/api/v1/transactions/"+tx.ID+"/payments/2026-11", tk, pix), 422)
	want(t, e.do(t, "PUT", "/api/v1/extra-expenses/"+ex.ID+"/payment", tk, pix), 422)
	// e nada ficou gravado
	d := loadData(t, e, tk)
	for _, x := range d.Transactions {
		if x.ID == tx.ID && len(x.Payments) != 0 {
			t.Fatalf("a despesa no cartão ficou com pagamento: %+v", x.Payments)
		}
	}
	if d.ExtraExpenses[0].Payment != nil {
		t.Fatalf("a extra no cartão ficou com pagamento: %+v", d.ExtraExpenses[0].Payment)
	}

	// despesa sem cartão paga normalmente; desmarcar continua liberado em qualquer caso
	want(t, e.do(t, "PUT", "/api/v1/transactions/"+free.ID+"/payments/2026-11", tk, pix), 200)
	want(t, e.do(t, "DELETE", "/api/v1/transactions/"+tx.ID+"/payments/2026-11", tk, nil), 200)
	want(t, e.do(t, "DELETE", "/api/v1/extra-expenses/"+ex.ID+"/payment", tk, nil), 200)

	// soltar do cartão devolve o pagamento individual
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"cardId": ""}), 200)
	want(t, e.do(t, "PUT", "/api/v1/transactions/"+tx.ID+"/payments/2026-11", tk, pix), 200)

	// e a fatura paga normalmente
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/"+card.ID+"/payments/2026-12", tk, pix), 200)
}

// Ajustes da fatura (descontos e acréscimos): vários por mês, só registro, com leitura do formato antigo.
func TestCardInvoiceAdjustments(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken
	card := newCard(t, e, tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})
	url := "/api/v1/credit-cards/" + card.ID + "/adjustments/2026-12"
	item := func(id string, amount int64, note string) map[string]any {
		return map[string]any{"id": id, "amount": amount, "note": note}
	}

	// lista, valor, id e mês são conferidos
	want(t, e.do(t, "PUT", url, tk, []map[string]any{item("a", 0, "")}), 400)
	want(t, e.do(t, "PUT", url, tk, []map[string]any{{"amount": -37}}), 400)
	want(t, e.do(t, "PUT", url, tk, []map[string]any{item("a", -37, ""), item("a", 5, "")}), 400)
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/"+card.ID+"/adjustments/dezembro", tk, []map[string]any{item("a", -37, "")}), 400)

	// vários ajustes no mesmo mês voltam na ordem, e os outros meses ficam separados
	r := e.do(t, "PUT", url, tk, []map[string]any{item("a", -37, "desconto"), item("b", 120, "juros")})
	want(t, r, 200)
	var got domain.CreditCard
	r.json(t, &got)
	list := got.Adjustments["2026-12"]
	if len(list) != 2 || list[0].ID != "a" || list[0].Amount != -37 || list[1].Amount != 120 || list[1].Note != "juros" {
		t.Fatalf("depois de lançar: %+v", got.Adjustments)
	}
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/"+card.ID+"/adjustments/2027-01", tk, []map[string]any{item("c", -5, "")}), 200)
	if d := loadData(t, e, tk); len(d.CreditCards[0].Adjustments) != 2 || len(d.CreditCards[0].Adjustments["2026-12"]) != 2 {
		t.Fatalf("o GET /data deveria trazer os dois meses: %+v", d.CreditCards[0].Adjustments)
	}

	// trocar a lista substitui a anterior
	r = e.do(t, "PUT", url, tk, []map[string]any{item("b", 120, "juros")})
	want(t, r, 200)
	r.json(t, &got)
	if len(got.Adjustments["2026-12"]) != 1 {
		t.Fatalf("depois de trocar: %+v", got.Adjustments)
	}

	// outra conta não enxerga nem altera
	want(t, e.do(t, "PUT", url, other, []map[string]any{item("a", -37, "")}), 404)
	want(t, e.do(t, "DELETE", url, other, nil), 404)

	// o ajuste é só registro: a fatura e o resumo do servidor não mudam
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 5000, "type": "expense", "category": "Alimentação", "month": "2026-11", "cardId": card.ID, "purchaseDate": "2026-11-07"}), 201)
	r = e.do(t, "GET", "/api/v1/summary/2026-12", tk, nil)
	want(t, r, 200)
	var sum domain.MonthSummary
	r.json(t, &sum)
	if sum.TotalExpense != 5000 {
		t.Fatalf("o ajuste mexeu no resumo do servidor: %d", sum.TotalExpense)
	}

	// remover tudo (e remover de novo não dá erro); lista vazia também remove
	r = e.do(t, "DELETE", url, tk, nil)
	want(t, r, 200)
	var cleared domain.CreditCard
	r.json(t, &cleared)
	if _, still := cleared.Adjustments["2026-12"]; still || len(cleared.Adjustments) != 1 {
		t.Fatalf("depois de remover: %+v", cleared.Adjustments)
	}
	want(t, e.do(t, "DELETE", url, tk, nil), 200)
	want(t, e.do(t, "PUT", url, tk, []map[string]any{}), 200)
	want(t, e.do(t, "PUT", "/api/v1/credit-cards/nao-e-uuid/adjustments/2026-12", tk, []map[string]any{item("a", -37, "")}), 404)

	// criar o cartão ignora ajustes no corpo (só o endpoint próprio e a importação gravam)
	made := newCard(t, e, tk, map[string]any{"name": "Outro", "closingDay": 5, "dueDay": 12, "adjustments": map[string]any{"2026-12": []map[string]any{item("a", -9, "")}}})
	if len(made.Adjustments) != 0 {
		t.Fatalf("a criação deveria ignorar os ajustes: %+v", made.Adjustments)
	}

	// importar e exportar levam os ajustes; o formato antigo (um ajuste só por mês) não é aceito na importação nova,
	// mas um ajuste inválido é recusado
	pack := map[string]any{"creditCards": []map[string]any{{"id": "c1", "name": "Inter", "closingDay": 25, "dueDay": 5, "adjustments": map[string]any{"2026-12": []map[string]any{item("a", -50, "cashback"), item("b", 10, "iof")}}}}}
	r = e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, http.StatusCreated)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.CreditCards) != 1 || len(out.CreditCards[0].Adjustments["2026-12"]) != 2 || out.CreditCards[0].Adjustments["2026-12"][0].Note != "cashback" {
		t.Fatalf("importação perdeu os ajustes: %+v", out.CreditCards)
	}
	bad := map[string]any{"creditCards": []map[string]any{{"id": "c1", "name": "Inter", "closingDay": 25, "dueDay": 5, "adjustments": map[string]any{"2026-12": []map[string]any{item("a", 0, "")}}}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, bad), 400)
}
