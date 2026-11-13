package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Planejamento: orçamento por categoria, dívidas, fechamento do mês e carteira de dividendos. Só marcas: nada muda
// valores nem totais.
func TestPlanning(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	load := func() domain.FinanceData {
		r := e.do(t, "GET", "/api/v1/data", tk, nil)
		want(t, r, http.StatusOK)
		var d domain.FinanceData
		r.json(t, &d)
		return d
	}
	// conta nova: tudo vazio (e nunca null)
	d := load()
	if d.Budgets == nil || d.Debts == nil || d.Closings == nil || d.DividendAssets == nil {
		t.Fatalf("planejamento deveria vir vazio, não nulo: %+v", d)
	}

	valid := map[string]any{
		"budgets":        map[string]any{"Alimentação": map[string]any{"2026-11": 80000, "2027-01": 0}},
		"debts":          []any{map[string]any{"id": "d1", "name": "Consórcio moto", "installmentValue": 69700, "totalInstallments": 60, "paidInstallments": 12, "nextMonth": "2026-12", "linkedTransactionId": "abc", "paidValues": map[string]any{"2026-11": 60000}}},
		"closings":       map[string]any{"2026-10": map[string]any{"closedAt": "2026-11-01", "income": 300000, "expense": 250000, "balance": 50000, "byCategory": map[string]any{"Moradia": 100000}, "note": "gastei menos"}},
		"dividendAssets": []any{map[string]any{"id": "a1", "name": "HGLG11", "invested": 1000000, "monthlyDividends": 8000}},
	}
	want(t, e.do(t, "PUT", "/api/v1/settings/planning", tk, valid), http.StatusNoContent)

	d = load()
	if d.Budgets["Alimentação"]["2026-11"] != 80000 || len(d.Debts) != 1 || d.Debts[0].PaidInstallments != 12 || d.Debts[0].PaidValues["2026-11"] != 60000 ||
		d.Closings["2026-10"].Balance != 50000 || d.Closings["2026-10"].ByCategory["Moradia"] != 100000 || d.DividendAssets[0].Name != "HGLG11" {
		t.Fatalf("depois de salvar: %+v", d)
	}

	// valores inválidos são recusados
	bad := func(mut func(m map[string]any)) {
		m := map[string]any{}
		for k, v := range valid {
			m[k] = v
		}
		mut(m)
		want(t, e.do(t, "PUT", "/api/v1/settings/planning", tk, m), http.StatusBadRequest)
	}
	bad(func(m map[string]any) { m["budgets"] = map[string]any{"Alimentação": map[string]any{"2026-13": 1}} })
	bad(func(m map[string]any) { m["budgets"] = map[string]any{"Alimentação": map[string]any{"2026-11": -5}} })
	bad(func(m map[string]any) {
		m["debts"] = []any{map[string]any{"id": "d1", "name": "X", "installmentValue": 100, "totalInstallments": 10, "paidInstallments": 11, "nextMonth": "2026-12"}}
	})
	bad(func(m map[string]any) {
		m["debts"] = []any{map[string]any{"id": "d1", "name": "X", "installmentValue": 0, "totalInstallments": 10, "paidInstallments": 1, "nextMonth": "2026-12"}}
	})
	bad(func(m map[string]any) {
		m["debts"] = []any{map[string]any{"id": "d1", "name": "X", "installmentValue": 100, "totalInstallments": 10, "paidInstallments": 1, "nextMonth": "2026-12", "paidValues": map[string]any{"2026-13": 5}}}
	})
	bad(func(m map[string]any) {
		m["closings"] = map[string]any{"2026-10": map[string]any{"closedAt": "ontem", "income": 1, "expense": 1, "balance": 0}}
	})
	bad(func(m map[string]any) {
		m["dividendAssets"] = []any{map[string]any{"id": "a1", "name": "", "invested": 1}}
	})

	// consórcio (linear e progressivo) e dívida: tipo, modelo, acréscimo, posição e pagamentos
	debt := func(extra map[string]any) []any {
		d := map[string]any{"id": "d1", "name": "X", "installmentValue": 10000, "totalInstallments": 5, "paidInstallments": 1, "nextMonth": "2026-12"}
		for k, v := range extra {
			d[k] = v
		}
		return []any{d}
	}
	bad(func(m map[string]any) { m["debts"] = debt(map[string]any{"kind": "financiamento"}) })
	bad(func(m map[string]any) { m["debts"] = debt(map[string]any{"kind": "debt", "model": "linear"}) }) // modelo só em consórcio
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"kind": "consortium", "model": "progressive"})
	}) // sem acréscimo
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"kind": "consortium", "model": "progressive", "increment": -5})
	})
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"kind": "consortium", "model": "linear", "increment": 5000})
	}) // acréscimo no linear
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"kind": "consortium", "model": "geométrico"})
	})
	bad(func(m map[string]any) { m["debts"] = debt(map[string]any{"trackedFrom": "2026-13"}) })
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"payments": map[string]any{"2026-11": map[string]any{"method": "cheque", "date": "2026-11-10"}}})
	})
	bad(func(m map[string]any) {
		m["debts"] = debt(map[string]any{"payments": map[string]any{"2026-11": map[string]any{"method": "pix", "date": "ontem"}}})
	})
	okDebts := map[string]any{}
	for k, v := range valid {
		okDebts[k] = v
	}
	okDebts["debts"] = []any{
		debt(map[string]any{"kind": "consortium", "model": "progressive", "increment": 5000, "trackedFrom": "2026-11", "paidValues": map[string]any{"2026-11": 10000},
			"payments": map[string]any{"2026-11": map[string]any{"method": "pix", "date": "2026-11-10"}}})[0],
		debt(map[string]any{"id": "d2", "kind": "consortium", "model": "linear"})[0],
		debt(map[string]any{"id": "d3"})[0], // cadastro sem tipo: dívida comum
	}
	want(t, e.do(t, "PUT", "/api/v1/settings/planning", tk, okDebts), http.StatusNoContent)
	if got := load(); len(got.Debts) != 3 || got.Debts[0].Increment != 5000 || got.Debts[0].Model != "progressive" || got.Debts[0].TrackedFrom != "2026-11" ||
		got.Debts[0].Payments["2026-11"].Method != "pix" || got.Debts[0].PaidValues["2026-11"] != 10000 || got.Debts[1].Model != "linear" || got.Debts[2].Kind != "" {
		t.Fatalf("dívidas não voltaram como salvas: %+v", got.Debts)
	}
	want(t, e.do(t, "PUT", "/api/v1/settings/planning", tk, valid), http.StatusNoContent) // volta ao estado anterior

	// o que já estava salvo continua depois dos pedidos recusados
	if got := load(); len(got.Debts) != 1 {
		t.Fatalf("recusar não pode apagar o que já existe: %d dívidas", len(got.Debts))
	}

	// outra conta não vê o planejamento desta
	other := e.register(t, "").AccessToken
	r := e.do(t, "GET", "/api/v1/data", other, nil)
	var od domain.FinanceData
	r.json(t, &od)
	if len(od.Debts) != 0 || len(od.Budgets) != 0 {
		t.Fatalf("vazamento entre contas: %+v", od)
	}
}
