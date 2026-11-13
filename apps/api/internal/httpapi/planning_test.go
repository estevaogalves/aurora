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

	// parcelas antecipadas: valida mês, valores, data, ids e o início do calendário
	ant := func(mut func(a map[string]any), start string) map[string]any {
		a := map[string]any{"originalValue": 70000, "paidValue": 20000, "paidOn": "2026-11-10", "batchId": "b1", "transactionId": "t1"}
		mut(a)
		debt := map[string]any{"id": "d1", "name": "X", "installmentValue": 70000, "totalInstallments": 40, "paidInstallments": 1, "nextMonth": "2026-12", "anticipations": map[string]any{"2030-02": a}}
		if start != "" {
			debt["startMonth"] = start
		}
		return debt
	}
	bad(func(m map[string]any) { m["debts"] = []any{ant(func(a map[string]any) {}, "")} }) // sem startMonth
	bad(func(m map[string]any) {
		m["debts"] = []any{ant(func(a map[string]any) { a["paidValue"] = 0 }, "2026-11")}
	}) // valor zero
	bad(func(m map[string]any) {
		m["debts"] = []any{ant(func(a map[string]any) { a["paidOn"] = "ontem" }, "2026-11")}
	}) // data
	bad(func(m map[string]any) {
		m["debts"] = []any{ant(func(a map[string]any) { a["batchId"] = "" }, "2026-11")}
	}) // lote
	bad(func(m map[string]any) { m["debts"] = []any{ant(func(a map[string]any) {}, "2026-13")} }) // mês de início
	okAnt := map[string]any{}
	for k, v := range valid {
		okAnt[k] = v
	}
	okAnt["debts"] = []any{ant(func(a map[string]any) {}, "2026-11")}
	want(t, e.do(t, "PUT", "/api/v1/settings/planning", tk, okAnt), http.StatusNoContent)
	if got := load(); got.Debts[0].StartMonth != "2026-11" || got.Debts[0].Anticipations["2030-02"].PaidValue != 20000 || got.Debts[0].Anticipations["2030-02"].OriginalValue != 70000 {
		t.Fatalf("antecipação não voltou: %+v", got.Debts[0])
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
