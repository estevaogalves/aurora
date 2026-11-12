package httpapi_test

import (
	"testing"

	"aurora/api/internal/domain"
)

// Editar categoria: nome e cor. Os lançamentos guardam a categoria pelo nome, então renomear leva junto as despesas
// e as compras no crédito do usuário.
func TestUpdateCategoryRenamesEntries(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken

	mk := func(token, name, color string) string {
		t.Helper()
		r := e.do(t, "POST", "/api/v1/categories", token, map[string]any{"name": name, "color": color})
		want(t, r, 201)
		var c domain.CustomCategory
		r.json(t, &c)
		return c.ID
	}
	pets := mk(tk, "Pets", "#FF8800")
	mk(tk, "Casa", "#00FF88")
	otherPets := mk(other, "Pets", "#112233")

	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Ração", "amount": 5000, "type": "expense", "category": "Pets", "month": "2026-11"}), 201)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Mercado", "amount": 3000, "type": "expense", "category": "Alimentação", "month": "2026-11"}), 201)
	want(t, e.do(t, "POST", "/api/v1/credits", tk, map[string]any{"name": "Caminha", "totalAmount": 30000, "installments": 3, "startMonth": "2026-11", "category": "Pets"}), 201)
	// a outra conta usa o mesmo nome e não pode ser tocada
	want(t, e.do(t, "POST", "/api/v1/transactions", other, map[string]any{"name": "Petisco", "amount": 900, "type": "expense", "category": "Pets", "month": "2026-11"}), 201)

	// só a cor: nada é renomeado
	r := e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"color": "#123ABC"})
	want(t, r, 200)
	var got domain.CustomCategory
	r.json(t, &got)
	if got.Name != "Pets" || got.Color != "#123ABC" {
		t.Fatalf("depois da cor: %+v", got)
	}

	// renomear leva as despesas e as compras no crédito
	r = e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"name": "  Bichos  ", "color": "#ABCDEF"})
	want(t, r, 200)
	r.json(t, &got)
	if got.Name != "Bichos" || got.Color != "#ABCDEF" {
		t.Fatalf("depois de renomear: %+v", got)
	}
	d := loadData(t, e, tk)
	cats := map[string]string{}
	for _, tr := range d.Transactions {
		cats[tr.Name] = tr.Category
	}
	if cats["Ração"] != "Bichos" || cats["Mercado"] != "Alimentação" || d.CreditTransactions[0].Category != "Bichos" {
		t.Fatalf("lançamentos depois de renomear: %v / crédito %q", cats, d.CreditTransactions[0].Category)
	}
	if d.CustomCategories[0].Name == "" || len(d.CustomCategories) != 2 {
		t.Fatalf("categorias: %+v", d.CustomCategories)
	}
	od := loadData(t, e, other)
	if od.Transactions[0].Category != "Pets" || od.CustomCategories[0].Name != "Pets" {
		t.Fatalf("a outra conta foi alterada: %+v / %+v", od.Transactions, od.CustomCategories)
	}

	// trocar só a caixa é permitido e leva os lançamentos
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"name": "bichos"}), 200)
	if c := loadData(t, e, tk).Transactions; c[0].Category != "bichos" && c[1].Category != "bichos" {
		t.Fatalf("caixa não propagou: %+v", c)
	}

	// validações e duplicata (mesmo nome de outra categoria, sem diferenciar maiúsculas)
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"name": "casa"}), 409)
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"name": "   "}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+pets, tk, map[string]any{"color": "vermelho"}), 400)
	// a duplicata não deixou nada pela metade
	if c := loadData(t, e, tk).Transactions; c[0].Category == "casa" || c[1].Category == "casa" {
		t.Fatalf("duplicata mexeu nos lançamentos: %+v", c)
	}

	// outra conta não enxerga; id inválido ou inexistente é 404
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+pets, other, map[string]any{"name": "Invasor"}), 404)
	want(t, e.do(t, "PATCH", "/api/v1/categories/"+otherPets, tk, map[string]any{"name": "Invasor"}), 404)
	want(t, e.do(t, "PATCH", "/api/v1/categories/nao-e-uuid", tk, map[string]any{"name": "X"}), 404)
}
