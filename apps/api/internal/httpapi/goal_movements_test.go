package httpapi_test

import (
	"strings"
	"testing"

	"aurora/api/internal/domain"
)

type goalMovementOut struct {
	Movement *domain.GoalMovement `json:"movement"`
	Goal     domain.Goal          `json:"goal"`
}

func newGoal(t *testing.T, e *env, tk string, body map[string]any) domain.Goal {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/goals", tk, body)
	want(t, r, 201)
	var g domain.Goal
	r.json(t, &g)
	return g
}

// Histórico de metas e porquinhos: cada movimentação refaz o guardado no servidor.
func TestGoalMovementsRecomputeOnServer(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	g := newGoal(t, e, tk, map[string]any{"name": "Viagem", "target": 500000, "monthly": 0, "deadline": nil})
	mv := func(typ, date string, amount int64) map[string]any {
		return map[string]any{"goalId": g.ID, "type": typ, "date": date, "amount": amount}
	}
	post := func(body map[string]any) goalMovementOut {
		t.Helper()
		r := e.do(t, "POST", "/api/v1/goal-movements", tk, body)
		want(t, r, 201)
		var out goalMovementOut
		r.json(t, &out)
		return out
	}

	// aporte, rendimento e retirada refazem o guardado; o rendimento soma também no total de rendimentos
	post(mv("contribution", "2026-11-01", 10000))
	post(mv("yield", "2026-11-30", 300))
	out := post(mv("withdrawal", "2026-11-15", 2000))
	if out.Goal.Saved != 8300 || out.Goal.YieldTotal != 300 || out.Movement == nil || out.Movement.ID == "" {
		t.Fatalf("depois de aportar, render e retirar: %+v", out)
	}

	// nota e origem (vinda da sugestão do saldo) ficam guardadas
	r := e.do(t, "POST", "/api/v1/goal-movements", tk, map[string]any{
		"goalId": g.ID, "type": "contribution", "date": "2026-11-20", "amount": 500, "note": "sobra do mês", "origin": "distribution|2026-11|balance|emergency",
	})
	want(t, r, 201)
	var sent goalMovementOut
	r.json(t, &sent)
	if sent.Movement.Note != "sobra do mês" || sent.Movement.Origin != "distribution|2026-11|balance|emergency" || sent.Goal.Saved != 8800 {
		t.Fatalf("com nota e origem: %+v", sent)
	}

	// corrigir refaz tudo: a retirada de 2000 vira 1000
	var withdrawalID string
	for _, m := range loadData(t, e, tk).GoalMovements {
		if m.Type == "withdrawal" {
			withdrawalID = m.ID
		}
	}
	r = e.do(t, "PATCH", "/api/v1/goal-movements/"+withdrawalID, tk, map[string]any{"amount": 1000})
	want(t, r, 200)
	r.json(t, &out)
	if out.Goal.Saved != 9800 || out.Movement.Amount != 1000 {
		t.Fatalf("depois de corrigir: %+v", out)
	}

	// um ajuste define o valor guardado (a diferença some do histórico, mas a data manda)
	post(mv("adjustment", "2026-12-01", 50000))
	if d := loadData(t, e, tk); d.Goals[0].Saved != 50000 || d.Goals[0].YieldTotal != 300 || len(d.GoalMovements) != 5 {
		t.Fatalf("depois do ajuste: %+v / %d movimentos", d.Goals[0], len(d.GoalMovements))
	}

	// apagar uma movimentação refaz a meta
	r = e.do(t, "DELETE", "/api/v1/goal-movements/"+withdrawalID, tk, nil)
	want(t, r, 200)
	var del goalMovementOut
	r.json(t, &del)
	if del.Movement != nil || del.Goal.Saved != 50000 {
		t.Fatalf("depois de apagar: %+v", del)
	}
	want(t, e.do(t, "DELETE", "/api/v1/goal-movements/"+withdrawalID, tk, nil), 404)

	// apagar a meta apaga o histórico dela
	want(t, e.do(t, "DELETE", "/api/v1/goals/"+g.ID, tk, nil), 204)
	if d := loadData(t, e, tk); len(d.GoalMovements) != 0 {
		t.Fatalf("o histórico deveria ir junto com a meta: %+v", d.GoalMovements)
	}
}

func TestGoalMovementValidationAndIsolation(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken
	g := newGoal(t, e, tk, map[string]any{"name": "Porquinho", "piggy": true, "target": 0, "monthly": 0, "deadline": nil})
	ok := map[string]any{"goalId": g.ID, "type": "contribution", "date": "2026-11-01", "amount": 100}
	with := func(k string, v any) map[string]any {
		m := map[string]any{}
		for a, b := range ok {
			m[a] = b
		}
		m[k] = v
		return m
	}

	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("type", "resgate")), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("date", "01/11/2026")), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("amount", -5)), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("amount", domain.MaxInvestmentCents+1)), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("origin", "manual")), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("note", strings.Repeat("x", 201))), 400)
	want(t, e.do(t, "POST", "/api/v1/goal-movements", tk, with("goalId", "nao-e-uuid")), 404)

	// outra conta não enxerga a meta nem as movimentações
	want(t, e.do(t, "POST", "/api/v1/goal-movements", other, ok), 404)
	r := e.do(t, "POST", "/api/v1/goal-movements", tk, ok)
	want(t, r, 201)
	var out goalMovementOut
	r.json(t, &out)
	want(t, e.do(t, "PATCH", "/api/v1/goal-movements/"+out.Movement.ID, other, map[string]any{"amount": 1}), 404)
	want(t, e.do(t, "DELETE", "/api/v1/goal-movements/"+out.Movement.ID, other, nil), 404)
	want(t, e.do(t, "PATCH", "/api/v1/goal-movements/"+out.Movement.ID, tk, map[string]any{"type": "xx"}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/goal-movements/"+out.Movement.ID, tk, map[string]any{"origin": "xx"}), 400)
	if d := loadData(t, e, other); len(d.GoalMovements) != 0 {
		t.Fatalf("a outra conta enxergou o histórico: %+v", d.GoalMovements)
	}
}

// Clientes antigos ainda mandam o guardado ao criar e no PATCH: viram movimentações do histórico.
func TestGoalSavedBecomesHistory(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	g := newGoal(t, e, tk, map[string]any{"name": "Reserva", "target": 100000, "saved": 5000, "yieldTotal": 200, "monthly": 0, "deadline": nil})
	if g.Saved != 5000 || g.YieldTotal != 200 {
		t.Fatalf("criada com valor inicial: %+v", g)
	}
	d := loadData(t, e, tk)
	if len(d.GoalMovements) != 2 || d.GoalMovements[0].Type != "yield" || d.GoalMovements[1].Type != "adjustment" || d.GoalMovements[1].Note != "Saldo inicial" {
		t.Fatalf("o valor inicial deveria virar histórico: %+v", d.GoalMovements)
	}

	// PATCH com guardado novo vira um ajuste; o total de rendimentos não pode ser escrito direto
	want(t, e.do(t, "PATCH", "/api/v1/goals/"+g.ID, tk, map[string]any{"saved": 9000, "yieldTotal": 999999, "name": "Reserva nova"}), 200)
	d = loadData(t, e, tk)
	if d.Goals[0].Saved != 9000 || d.Goals[0].YieldTotal != 200 || d.Goals[0].Name != "Reserva nova" || len(d.GoalMovements) != 3 {
		t.Fatalf("depois do PATCH: %+v / %d movimentos", d.Goals[0], len(d.GoalMovements))
	}
	// mesmo valor: nada de movimentação nova
	want(t, e.do(t, "PATCH", "/api/v1/goals/"+g.ID, tk, map[string]any{"saved": 9000}), 200)
	if d := loadData(t, e, tk); len(d.GoalMovements) != 3 {
		t.Fatalf("PATCH sem mudança criou movimentação: %d", len(d.GoalMovements))
	}
}

func TestGoalMovementsImportExport(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	pack := map[string]any{
		"goals": []map[string]any{
			{"id": "g1", "name": "Viagem", "target": 100000, "saved": 1, "monthly": 0, "deadline": nil},
			{"id": "g2", "name": "Pacote antigo", "target": 50000, "saved": 7000, "yieldTotal": 100, "monthly": 0, "deadline": nil},
		},
		"goalMovements": []map[string]any{
			{"id": "m1", "goalId": "g1", "type": "contribution", "date": "2026-11-01", "amount": 20000, "note": "primeiro", "origin": "distribution|2026-11|balance|invest"},
			{"id": "m2", "goalId": "g1", "type": "withdrawal", "date": "2026-11-05", "amount": 5000},
		},
	}
	r := e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, 201)
	var out domain.FinanceData
	r.json(t, &out)
	saved := map[string]int64{}
	for _, g := range out.Goals {
		saved[g.Name] = g.Saved
	}
	// o guardado vem do histórico do pacote (não do campo `saved`); a meta sem histórico ganha o saldo inicial
	if saved["Viagem"] != 15000 || saved["Pacote antigo"] != 7000 || len(out.GoalMovements) != 2+2 {
		t.Fatalf("importação: %+v / %d movimentos", saved, len(out.GoalMovements))
	}
	var origin string
	for _, m := range out.GoalMovements {
		if m.Note == "primeiro" {
			origin = m.Origin
		}
	}
	if origin != "distribution|2026-11|balance|invest" {
		t.Fatalf("a origem não foi importada: %q", origin)
	}
	if out.GoalMovements[0].GoalID == "g1" {
		t.Error("o id da meta de origem deveria ser trocado pelo do banco")
	}

	// movimentação de meta que não está no pacote, ou inválida, recusa tudo
	badRef := map[string]any{"goals": pack["goals"], "goalMovements": []map[string]any{{"goalId": "fantasma", "type": "contribution", "date": "2026-11-01", "amount": 1}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, badRef), 400)
	badType := map[string]any{"goals": pack["goals"], "goalMovements": []map[string]any{{"goalId": "g1", "type": "xx", "date": "2026-11-01", "amount": 1}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, badType), 400)
	if d := loadData(t, e, tk); len(d.Goals) != 2 {
		t.Fatalf("importação inválida não deveria apagar o que já estava: %+v", d.Goals)
	}
}

// Investimentos também guardam nota e origem nas movimentações.
func TestInvestmentMovementNoteAndOrigin(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/investments", tk, map[string]any{"name": "CDB", "family": "fixed", "institution": "Banco", "appliedAt": "2026-11-01"})
	want(t, r, 201)
	var inv domain.Investment
	r.json(t, &inv)
	r = e.do(t, "POST", "/api/v1/investment-movements", tk, map[string]any{
		"investmentId": inv.ID, "type": "contribution", "date": "2026-11-02", "amount": 30000, "note": "sobra do mês", "origin": "distribution|2026-11|balance|invest",
	})
	want(t, r, 201)
	var out struct {
		Movement domain.InvestmentMovement `json:"movement"`
	}
	r.json(t, &out)
	if out.Movement.Note != "sobra do mês" || out.Movement.Origin != "distribution|2026-11|balance|invest" {
		t.Fatalf("nota e origem: %+v", out.Movement)
	}
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, map[string]any{"investmentId": inv.ID, "type": "contribution", "date": "2026-11-02", "amount": 1, "origin": "xx"}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/investment-movements/"+out.Movement.ID, tk, map[string]any{"note": "nova"}), 200)
	if d := loadData(t, e, tk); d.InvestmentMovements[0].Note != "nova" || d.InvestmentMovements[0].Origin == "" {
		t.Fatalf("depois do PATCH: %+v", d.InvestmentMovements[0])
	}
}
