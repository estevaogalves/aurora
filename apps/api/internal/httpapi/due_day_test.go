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

// Etiquetas: até 10, de 1 a 30 letras, sem repetir; a lista inteira troca; vazia tira todas. Só marcas.
func TestTransactionTags(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	base := map[string]any{"name": "Passagem", "amount": 50000, "type": "expense", "category": "Lazer", "month": "2026-11"}
	with := func(tags any) map[string]any {
		m := map[string]any{}
		for k, v := range base {
			m[k] = v
		}
		m["tags"] = tags
		return m
	}

	r := e.do(t, "POST", "/api/v1/transactions", tk, with([]string{"viagem", "Heitor"}))
	want(t, r, http.StatusCreated)
	var tx domain.Transaction
	r.json(t, &tx)
	if len(tx.Tags) != 2 || tx.Tags[0] != "viagem" || tx.Amount != 50000 {
		t.Fatalf("criada: %+v", tx)
	}

	// inválidas
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, with([]string{"a", "A"})), http.StatusBadRequest)                          // repetida
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, with([]string{""})), http.StatusBadRequest)                                // vazia
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, with([]string{" viagem"})), http.StatusBadRequest)                         // espaço na ponta
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, with([]string{"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})), http.StatusBadRequest) // 31 letras
	many := make([]string, 11)
	for i := range many {
		many[i] = string(rune('a' + i))
	}
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, with(many)), http.StatusBadRequest)

	patch := func(tags any) domain.Transaction {
		r := e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"tags": tags})
		want(t, r, http.StatusOK)
		var out domain.Transaction
		r.json(t, &out)
		return out
	}
	if got := patch([]string{"trabalho"}); len(got.Tags) != 1 || got.Tags[0] != "trabalho" || got.Amount != 50000 {
		t.Fatalf("trocar: %+v", got)
	}
	if got := patch([]string{}); len(got.Tags) != 0 {
		t.Fatalf("vazia deveria tirar todas: %+v", got.Tags)
	}
	// um PATCH sem a chave não mexe nas etiquetas
	patch([]string{"x"})
	r = e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"name": "Passagem 2"})
	want(t, r, http.StatusOK)
	var kept domain.Transaction
	r.json(t, &kept)
	if len(kept.Tags) != 1 || kept.Tags[0] != "x" {
		t.Fatalf("sem a chave não muda: %+v", kept.Tags)
	}
}
