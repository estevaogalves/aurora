package httpapi_test

import (
	"testing"

	"aurora/api/internal/domain"
)

// Renda "distribuir separado" (13º, bônus): só uma marca, só para renda variável.
func TestIncomeSeparateFlag(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	income := func(extra map[string]any) map[string]any {
		m := map[string]any{"name": "13º salário", "amount": 500000, "type": "income", "category": "Renda", "month": "2026-12"}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}

	// só renda variável pode ser marcada
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"separate": true, "fixed": true})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 100, "type": "expense", "category": "Alimentação", "month": "2026-12", "separate": true}), 400)

	r := e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"separate": true}))
	want(t, r, 201)
	var got domain.Transaction
	r.json(t, &got)
	if !got.Separate || got.Fixed {
		t.Fatalf("criada: %+v", got)
	}

	// sem a marca, a renda segue como sempre (e o GET /data devolve a marca)
	r = e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"name": "Salário"}))
	want(t, r, 201)
	var plain domain.Transaction
	r.json(t, &plain)
	if plain.Separate {
		t.Fatalf("renda comum não deveria vir marcada: %+v", plain)
	}
	byName := map[string]bool{}
	for _, tr := range loadData(t, e, tk).Transactions {
		byName[tr.Name] = tr.Separate
	}
	if !byName["13º salário"] || byName["Salário"] {
		t.Fatalf("GET /data: %v", byName)
	}

	// desmarcar e marcar de novo
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"separate": false}), 200)
	if d := loadData(t, e, tk); d.Transactions[0].Separate {
		t.Fatalf("depois de desmarcar: %+v", d.Transactions[0])
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"separate": true}), 200)

	// virar fixa estando marcada é recusado (e nada muda); desmarcando junto, passa
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"fixed": true}), 422)
	if d := loadData(t, e, tk); d.Transactions[0].Fixed || !d.Transactions[0].Separate {
		t.Fatalf("a recusa deixou o lançamento pela metade: %+v", d.Transactions[0])
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"fixed": true, "separate": false}), 200)

	// despesa não pode ser marcada por PATCH
	r = e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Cinema", "amount": 100, "type": "expense", "category": "Lazer", "month": "2026-12"})
	want(t, r, 201)
	var exp domain.Transaction
	r.json(t, &exp)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+exp.ID, tk, map[string]any{"separate": true}), 422)

	// importar e exportar levam a marca; marca inválida recusa tudo
	pack := map[string]any{"transactions": []map[string]any{income(map[string]any{"separate": true, "id": "x1"})}}
	r = e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, 201)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.Transactions) != 1 || !out.Transactions[0].Separate {
		t.Fatalf("importação perdeu a marca: %+v", out.Transactions)
	}
	bad := map[string]any{"transactions": []map[string]any{income(map[string]any{"separate": true, "fixed": true})}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, bad), 400)
}
