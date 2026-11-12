package httpapi_test

import (
	"testing"

	"aurora/api/internal/domain"
)

// Distribuições da sugestão do saldo: a renda variável escolhe a Dist em que entra (0 = Dist 1, 2 a 20 = própria).
func TestIncomeDistGroup(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	income := func(extra map[string]any) map[string]any {
		m := map[string]any{"name": "13º salário", "amount": 500000, "type": "income", "category": "Renda", "month": "2026-12"}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}

	// só renda variável pode ter distribuição própria; o número fica entre 2 e 20 (0 é a Dist 1)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"distGroup": 2, "fixed": true})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 100, "type": "expense", "category": "Alimentação", "month": "2026-12", "distGroup": 2}), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"distGroup": 1})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"distGroup": 21})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"distGroup": -3})), 400)

	r := e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"distGroup": 2}))
	want(t, r, 201)
	var got domain.Transaction
	r.json(t, &got)
	if got.DistGroup != 2 || got.Fixed {
		t.Fatalf("criada: %+v", got)
	}
	r = e.do(t, "POST", "/api/v1/transactions", tk, income(map[string]any{"name": "Salário"}))
	want(t, r, 201)
	var plain domain.Transaction
	r.json(t, &plain)
	if plain.DistGroup != 0 {
		t.Fatalf("renda comum fica na Dist 1: %+v", plain)
	}
	byName := map[string]int{}
	for _, tr := range loadData(t, e, tk).Transactions {
		byName[tr.Name] = tr.DistGroup
	}
	if byName["13º salário"] != 2 || byName["Salário"] != 0 {
		t.Fatalf("GET /data: %v", byName)
	}

	// trocar de distribuição, voltar para a Dist 1 (0) e número inválido
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"distGroup": 3}), 200)
	if d := loadData(t, e, tk); d.Transactions[0].DistGroup != 3 {
		t.Fatalf("depois de trocar: %+v", d.Transactions[0])
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"distGroup": 1}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"distGroup": 21}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"distGroup": 0}), 200)
	if d := loadData(t, e, tk); d.Transactions[0].DistGroup != 0 {
		t.Fatalf("depois de voltar para a Dist 1: %+v", d.Transactions[0])
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"distGroup": 2}), 200)

	// virar fixa estando numa distribuição própria é recusado (e nada muda); voltando para a Dist 1 junto, passa
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"fixed": true}), 422)
	if d := loadData(t, e, tk); d.Transactions[0].Fixed || d.Transactions[0].DistGroup != 2 {
		t.Fatalf("a recusa deixou o lançamento pela metade: %+v", d.Transactions[0])
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+got.ID, tk, map[string]any{"fixed": true, "distGroup": 0}), 200)

	// despesa não entra numa distribuição por PATCH
	r = e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Cinema", "amount": 100, "type": "expense", "category": "Lazer", "month": "2026-12"})
	want(t, r, 201)
	var exp domain.Transaction
	r.json(t, &exp)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+exp.ID, tk, map[string]any{"distGroup": 2}), 422)

	// importar e exportar levam a distribuição; número inválido recusa tudo
	pack := map[string]any{"transactions": []map[string]any{income(map[string]any{"distGroup": 2, "id": "x1"})}}
	r = e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, 201)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.Transactions) != 1 || out.Transactions[0].DistGroup != 2 {
		t.Fatalf("importação perdeu a distribuição: %+v", out.Transactions)
	}
	bad := map[string]any{"transactions": []map[string]any{income(map[string]any{"distGroup": 1})}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, bad), 400)
}

func items(invest int) []map[string]any {
	return []map[string]any{
		{"id": "emergency", "label": "Reserva", "percent": 100 - invest - 20 - 10 - 10},
		{"id": "invest", "label": "Investir", "percent": invest},
		{"id": "leisure", "label": "Lazer", "percent": 20},
		{"id": "education", "label": "Educação", "percent": 10},
		{"id": "costs", "label": "Gastos", "percent": 10},
	}
}

// brokenItems soma 90%: a distribuição é recusada.
func brokenItems() []map[string]any {
	out := items(30)
	out[0]["percent"] = 20
	return out
}

// Percentuais próprios de uma distribuição (Dist 2 em diante) de um mês: só daquela distribuição e daquele mês.
func TestDistributionOverrides(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken
	url := "/api/v1/settings/distribution-overrides/2026-12/2"

	// mês, número e percentuais são conferidos
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/dezembro/2", tk, map[string]any{"items": items(30)}), 400)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2026-12/1", tk, map[string]any{"items": items(30)}), 400)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2026-12/21", tk, map[string]any{"items": items(30)}), 400)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2026-12/abc", tk, map[string]any{"items": items(30)}), 400)
	want(t, e.do(t, "PUT", url, tk, map[string]any{"items": brokenItems()}), 400) // soma 90
	want(t, e.do(t, "PUT", url, tk, map[string]any{"items": []map[string]any{{"id": "emergency", "label": "Reserva", "percent": 100}}}), 400)

	want(t, e.do(t, "PUT", url, tk, map[string]any{"items": items(30)}), 204)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2026-12/3", tk, map[string]any{"items": items(40)}), 204)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2027-01/2", tk, map[string]any{"items": items(10)}), 204)

	d := loadData(t, e, tk)
	if len(d.DistributionOverrides) != 3 || len(d.DistributionOverrides["2026-12|2"]) != 5 || d.DistributionOverrides["2026-12|2"][1].Percent != 30 || d.DistributionOverrides["2026-12|3"][1].Percent != 40 {
		t.Fatalf("overrides: %+v", d.DistributionOverrides)
	}
	// o padrão (Dist 1) não foi tocado, e a outra conta não vê nada
	if d.Distribution != nil {
		t.Fatalf("o padrão não deveria mudar: %+v", d.Distribution)
	}
	if od := loadData(t, e, other); len(od.DistributionOverrides) != 0 {
		t.Fatalf("a outra conta enxergou: %+v", od.DistributionOverrides)
	}

	// trocar só uma chave não apaga as outras; null limpa só aquela
	want(t, e.do(t, "PUT", url, tk, map[string]any{"items": items(15)}), 204)
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2026-12/3", tk, map[string]any{"items": nil}), 204)
	d = loadData(t, e, tk)
	if len(d.DistributionOverrides) != 2 || d.DistributionOverrides["2026-12|2"][1].Percent != 15 {
		t.Fatalf("depois de trocar e limpar: %+v", d.DistributionOverrides)
	}
	// limpar o que não existe não dá erro
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution-overrides/2030-01/9", tk, map[string]any{"items": nil}), 204)

	// importar e exportar levam os percentuais próprios; chave ou soma inválida recusa tudo
	pack := map[string]any{"distributionOverrides": map[string]any{"2026-12|2": items(30)}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, pack), 201)
	if d := loadData(t, e, tk); len(d.DistributionOverrides) != 1 || d.DistributionOverrides["2026-12|2"][1].Percent != 30 {
		t.Fatalf("importação: %+v", d.DistributionOverrides)
	}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, map[string]any{"distributionOverrides": map[string]any{"2026-12|1": items(30)}}), 400)
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, map[string]any{"distributionOverrides": map[string]any{"2026-12|2": brokenItems()}}), 400)
}
