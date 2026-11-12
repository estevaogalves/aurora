package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Dia do vencimento: só despesa, de 1 a 31, 0 tira o dia. Só marca: não muda valor nenhum.
func TestTransactionDueDay(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	post := func(body map[string]any) resp { return e.do(t, "POST", "/api/v1/transactions", tk, body) }

	r := post(map[string]any{"name": "Internet", "amount": 12000, "type": "expense", "category": "Moradia", "month": "2026-11", "fixed": true, "dueDay": 15})
	want(t, r, http.StatusCreated)
	var tx domain.Transaction
	r.json(t, &tx)
	if tx.DueDay != 15 || tx.Amount != 12000 {
		t.Fatalf("criada: dueDay=%d amount=%d", tx.DueDay, tx.Amount)
	}

	// sem dia: continua 0
	r = post(map[string]any{"name": "Padaria", "amount": 3000, "type": "expense", "category": "Alimentação", "month": "2026-11"})
	want(t, r, http.StatusCreated)
	var plain domain.Transaction
	r.json(t, &plain)
	if plain.DueDay != 0 {
		t.Fatalf("sem dia deveria ser 0: %d", plain.DueDay)
	}

	// dia inválido, e renda não tem vencimento
	want(t, post(map[string]any{"name": "X", "amount": 100, "type": "expense", "category": "Outros", "month": "2026-11", "dueDay": 32}), http.StatusBadRequest)
	want(t, post(map[string]any{"name": "X", "amount": 100, "type": "expense", "category": "Outros", "month": "2026-11", "dueDay": -1}), http.StatusBadRequest)
	want(t, post(map[string]any{"name": "Salário", "amount": 100, "type": "income", "category": "Renda", "month": "2026-11", "dueDay": 5}), http.StatusBadRequest)

	// editar: troca o dia, e 0 tira
	patch := func(day any) domain.Transaction {
		r := e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"dueDay": day})
		want(t, r, http.StatusOK)
		var out domain.Transaction
		r.json(t, &out)
		return out
	}
	if got := patch(28); got.DueDay != 28 || got.Amount != 12000 {
		t.Fatalf("depois de editar: dueDay=%d amount=%d", got.DueDay, got.Amount)
	}
	if got := patch(0); got.DueDay != 0 {
		t.Fatalf("0 deveria tirar o dia: %d", got.DueDay)
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"dueDay": 40}), http.StatusBadRequest)
}
