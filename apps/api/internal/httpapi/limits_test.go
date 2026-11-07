package httpapi_test

import (
	"fmt"
	"strings"
	"testing"

	"aurora/api/internal/config"
)

// SEC-09: tetos de tamanho de uma requisição (não são cota por usuário).

func manyTx(n int) []map[string]any {
	out := make([]map[string]any, n)
	for i := range out {
		out[i] = map[string]any{"name": fmt.Sprintf("Item %d", i), "amount": 100, "type": "expense", "category": "Outros", "month": "2026-03"}
	}
	return out
}

func overrides(n int) map[string]int64 {
	m := map[string]int64{}
	for i := 0; i < n; i++ {
		m[fmt.Sprintf("%04d-%02d", 2000+i/12, i%12+1)] = int64(i)
	}
	return m
}

func TestImportItemCeiling(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.MaxImportItems = 3; c.MaxCustomCategories = 1 })
	tk := e.register(t, "").AccessToken

	r := e.do(t, "POST", "/api/v1/import", tk, map[string]any{"transactions": manyTx(4)})
	want(t, r, 400)
	if !strings.Contains(string(r.Body), "grande demais") {
		t.Errorf("mensagem: %s", r.Body)
	}
	want(t, e.do(t, "POST", "/api/v1/import", tk, map[string]any{
		"customCategories": []map[string]any{{"name": "A", "color": "#112233"}, {"name": "B", "color": "#112233"}},
	}), 400)
	want(t, e.do(t, "POST", "/api/v1/import", tk, map[string]any{"transactions": manyTx(3)}), 201)
}

func TestMonthOverridesCeiling(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.MaxMonthOverrides = 5 })
	tk := e.register(t, "").AccessToken
	base := func(n int) map[string]any {
		return map[string]any{"name": "Aluguel", "amount": 1, "type": "expense", "category": "Moradia", "month": "2026-01", "fixed": true, "monthlyValues": overrides(n)}
	}
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, base(6)), 400)
	r := e.do(t, "POST", "/api/v1/transactions", tk, base(5))
	want(t, r, 201)
	var created tx
	r.json(t, &created)

	// o PATCH também respeita o teto
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+created.ID, tk, map[string]any{"monthlyValues": overrides(6)}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+created.ID, tk, map[string]any{"hiddenMonths": []string{"2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"}}), 400)
}

func TestBodyCeilings(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.MaxBodyBytes = 1024; c.MaxImportBytes = 4096 })
	tk := e.register(t, "").AccessToken

	// anotação válida (<= 2000 caracteres), mas o corpo passa de 1 KiB: 413
	note := map[string]any{"content": strings.Repeat("a", 1500), "date": "01/03", "month": "2026-03"}
	want(t, e.do(t, "POST", "/api/v1/notes", tk, note), 413)
	note["content"] = "curta"
	want(t, e.do(t, "POST", "/api/v1/notes", tk, note), 201)

	// a importação tem teto próprio, maior
	want(t, e.do(t, "POST", "/api/v1/import", tk, map[string]any{"transactions": manyTx(200)}), 413)
}

func TestDistributionItemsCeiling(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.MaxDistributionItems = 5 })
	tk := e.register(t, "").AccessToken
	items := []map[string]any{
		{"id": "emergency", "label": "Reserva", "percent": 10}, {"id": "invest", "label": "Investir", "percent": 10},
		{"id": "leisure", "label": "Lazer", "percent": 10}, {"id": "education", "label": "Estudos", "percent": 10},
		{"id": "costs", "label": "Custos", "percent": 50}, {"id": "extra", "label": "Viagem", "percent": 10},
	}
	// 6 itens > teto de 5
	r := e.do(t, "PUT", "/api/v1/settings/distribution", tk, map[string]any{"items": items})
	want(t, r, 400)
	if !strings.Contains(string(r.Body), "Categorias demais") {
		t.Errorf("mensagem: %s", r.Body)
	}
}

// Calibragem: o maior volume legítimo continua passando com os padrões (config zerada = padrões).
func TestDefaultCeilingsFitLegitimateUse(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// 50 anos de ajustes mensais em UMA fixa: 600 entradas passam, 601 não
	fixed := func(n int) map[string]any {
		return map[string]any{"name": "Aluguel", "amount": 1, "type": "expense", "category": "Moradia", "month": "1990-01", "fixed": true, "monthlyValues": overrides(n)}
	}
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, fixed(600)), 201)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, fixed(601)), 400)

	// uma importação grande (2.000 lançamentos, muito acima do uso típico) cabe
	big := e.register(t, "").AccessToken
	want(t, e.do(t, "POST", "/api/v1/import", big, map[string]any{"transactions": manyTx(2000)}), 201)
}
