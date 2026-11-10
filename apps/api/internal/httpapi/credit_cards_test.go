package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Cartões de crédito e recorrência de valor variável.

func TestCreditCardsAndVariableRecurrence(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// validação: só nome e dias 1..31
	want(t, e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "", "closingDay": 2, "dueDay": 9}), 400)
	want(t, e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "Nubank", "closingDay": 0, "dueDay": 9}), 400)
	want(t, e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 32}), 400)

	r := e.do(t, "POST", "/api/v1/credit-cards", tk, map[string]any{"name": "Nubank", "closingDay": 2, "dueDay": 9})
	want(t, r, http.StatusCreated)
	var card domain.CreditCard
	r.json(t, &card)

	// recorrência de valor variável ligada ao cartão
	r = e.do(t, "POST", "/api/v1/credits", tk, map[string]any{
		"name": "Claude", "totalAmount": 11850, "installments": 1, "startMonth": "2026-11", "category": "Outros",
		"recurring": true, "variableAmount": true, "billingDay": 11, "cardId": card.ID,
	})
	want(t, r, http.StatusCreated)
	var c domain.CreditTransaction
	r.json(t, &c)
	if c.CardID != card.ID || !c.VariableAmount || c.BillingDay != 11 {
		t.Fatalf("compra=%+v", c)
	}

	// cartão que não é desta conta é recusado
	other := e.register(t, "outra@example.com").AccessToken
	r = e.do(t, "POST", "/api/v1/credits", other, map[string]any{
		"name": "X", "totalAmount": 100, "installments": 1, "startMonth": "2026-11", "category": "Outros", "cardId": card.ID,
	})
	want(t, r, 422)

	// valor real só de um mês; os outros seguem estimados
	want(t, e.do(t, "PUT", installmentURL(c.ID, "2"), tk, map[string]any{"value": 11809}), 200)
	want(t, e.do(t, "PUT", installmentURL(c.ID, "0"), tk, map[string]any{"value": 11809}), 400)
	r = e.do(t, "DELETE", installmentURL(c.ID, "2")+"/value", tk, nil)
	want(t, r, 200)
	want(t, e.do(t, "DELETE", installmentURL(c.ID, "2")+"/value", tk, nil), 422) // já estimado
	want(t, e.do(t, "PUT", installmentURL(c.ID, "3"), tk, map[string]any{"value": 11900}), 200)

	// editar cartão e soltar a compra do cartão
	want(t, e.do(t, "PATCH", "/api/v1/credit-cards/"+card.ID, tk, map[string]any{"closingDay": 5}), 200)
	r = e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"cardId": ""})
	want(t, r, 200)
	var detached domain.CreditTransaction
	r.json(t, &detached)
	if detached.CardID != "" || detached.Adjustments["3"].Value == nil {
		t.Fatalf("depois de soltar: %+v", detached)
	}
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"cardId": card.ID}), 200)

	// apagar o cartão solta a compra e não apaga nada
	want(t, e.do(t, "DELETE", "/api/v1/credit-cards/"+card.ID, tk, nil), http.StatusNoContent)
	want(t, e.do(t, "DELETE", "/api/v1/credit-cards/"+card.ID, tk, nil), http.StatusNotFound)
	r = e.do(t, "GET", "/api/v1/data", tk, nil)
	want(t, r, 200)
	var data domain.FinanceData
	r.json(t, &data)
	if len(data.CreditCards) != 0 || len(data.CreditTransactions) != 1 || data.CreditTransactions[0].CardID != "" {
		t.Fatalf("dados=%+v", data)
	}
}

// A observação de uma fixa é só do mês: monthlyNotes guarda a dos outros meses.
func TestFixedMonthlyNotes(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "fixed": true, "month": "2026-11", "notes": "de novembro"})
	want(t, r, http.StatusCreated)
	var tx domain.Transaction
	r.json(t, &tx)

	r = e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"monthlyNotes": map[string]string{"2026-12": "só dezembro"}})
	want(t, r, 200)
	var out domain.Transaction
	r.json(t, &out)
	if out.Notes != "de novembro" || out.MonthlyNotes["2026-12"] != "só dezembro" {
		t.Fatalf("depois do patch: %+v", out)
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"monthlyNotes": map[string]string{"dezembro": "x"}}), 400)

	r = e.do(t, "GET", "/api/v1/data", tk, nil)
	var data domain.FinanceData
	r.json(t, &data)
	if len(data.Transactions) != 1 || data.Transactions[0].MonthlyNotes["2026-12"] != "só dezembro" {
		t.Fatalf("dados: %+v", data.Transactions)
	}
}

// Despesa/renda fixa de valor variável: o valor da fixa é a estimativa e o valor real de um mês é um monthlyValues.
func TestFixedTransactionVariableAmount(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// só fixa tem valor variável: numa lançada avulsa a marca é ignorada
	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{
		"name": "Avulsa", "amount": 5000, "type": "expense", "category": "Outros", "month": "2026-11", "variableAmount": true,
	})
	want(t, r, http.StatusCreated)
	var plain domain.Transaction
	r.json(t, &plain)
	if plain.VariableAmount {
		t.Fatalf("avulsa não pode ser variável: %+v", plain)
	}

	r = e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{
		"name": "Luz", "amount": 18000, "type": "expense", "category": "Moradia", "month": "2026-11", "fixed": true, "variableAmount": true,
	})
	want(t, r, http.StatusCreated)
	var luz domain.Transaction
	r.json(t, &luz)
	if !luz.VariableAmount || !luz.Fixed {
		t.Fatalf("luz=%+v", luz)
	}

	// valor real de um mês; voltar ao estimado = tirar o mês do mapa
	r = e.do(t, "PATCH", "/api/v1/transactions/"+luz.ID, tk, map[string]any{"monthlyValues": map[string]int64{"2026-12": 21050}})
	want(t, r, 200)
	var real domain.Transaction
	r.json(t, &real)
	if !real.VariableAmount || real.MonthlyValues["2026-12"] != 21050 {
		t.Fatalf("com valor real: %+v", real)
	}
	r = e.do(t, "PATCH", "/api/v1/transactions/"+luz.ID, tk, map[string]any{"monthlyValues": map[string]int64{}})
	want(t, r, 200)
	var back domain.Transaction
	r.json(t, &back)
	if len(back.MonthlyValues) != 0 || !back.VariableAmount {
		t.Fatalf("de volta ao estimado: %+v", back)
	}

	// desligar o variável sem mexer no resto, e deixar de ser fixa também desliga
	r = e.do(t, "PATCH", "/api/v1/transactions/"+luz.ID, tk, map[string]any{"variableAmount": false})
	want(t, r, 200)
	var off domain.Transaction
	r.json(t, &off)
	if off.VariableAmount || !off.Fixed {
		t.Fatalf("desligada: %+v", off)
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+luz.ID, tk, map[string]any{"variableAmount": true}), 200)
	r = e.do(t, "PATCH", "/api/v1/transactions/"+luz.ID, tk, map[string]any{"fixed": false})
	want(t, r, 200)
	var unfixed domain.Transaction
	r.json(t, &unfixed)
	if unfixed.VariableAmount {
		t.Fatalf("deixou de ser fixa e continua variável: %+v", unfixed)
	}
}
