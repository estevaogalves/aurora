package domain

import "testing"

func gm(typ, date string, amount int64) GoalMovement {
	return GoalMovement{ID: typ + date, GoalID: "g", Type: typ, Date: date, Amount: amount}
}

func TestReplayGoal(t *testing.T) {
	g := Goal{ID: "g", Name: "Viagem", Target: 500000}

	cases := []struct {
		name         string
		movements    []GoalMovement
		saved, yield int64
	}{
		{"sem movimentações", nil, 0, 0},
		{"aportes somam", []GoalMovement{gm(GoalContribution, "2026-01-05", 10000), gm(GoalContribution, "2026-02-05", 2500)}, 12500, 0},
		{"retirada subtrai e nunca passa de zero", []GoalMovement{gm(GoalContribution, "2026-01-05", 1000), gm(GoalWithdrawal, "2026-01-06", 5000)}, 0, 0},
		{"rendimento soma ao guardado e ao total de rendimentos", []GoalMovement{gm(GoalContribution, "2026-01-05", 10000), gm(GoalYield, "2026-01-31", 300)}, 10300, 300},
		{"ajuste define o guardado e não mexe nos rendimentos", []GoalMovement{gm(GoalYield, "2026-01-01", 300), gm(GoalAdjustment, "2026-01-02", 50000), gm(GoalContribution, "2026-01-03", 100)}, 50100, 300},
		{"ordena por data, não pela ordem de cadastro", []GoalMovement{gm(GoalWithdrawal, "2026-03-01", 4000), gm(GoalContribution, "2026-01-01", 10000)}, 6000, 0},
		{"mesma data: vale a ordem de cadastro", []GoalMovement{gm(GoalAdjustment, "2026-01-01", 700), gm(GoalContribution, "2026-01-01", 100)}, 800, 0},
		// o começo de histórico das metas antigas (migration 00017): rendimentos primeiro e depois o ajuste
		{"saldo inicial de meta antiga com rendimentos", []GoalMovement{gm(GoalYield, "2026-01-01", 300), gm(GoalAdjustment, "2026-01-01", 10300)}, 10300, 300},
		{"saldo inicial com guardado abaixo dos rendimentos", []GoalMovement{gm(GoalYield, "2026-01-01", 300), gm(GoalAdjustment, "2026-01-01", 100)}, 100, 300},
	}
	for _, c := range cases {
		got := ReplayGoal(g, c.movements)
		if got.Saved != c.saved || got.YieldTotal != c.yield {
			t.Errorf("%s: guardado %d (esperado %d), rendimentos %d (esperado %d)", c.name, got.Saved, c.saved, got.YieldTotal, c.yield)
		}
		if got.Name != "Viagem" || got.Target != 500000 {
			t.Errorf("%s: o resto da meta mudou: %+v", c.name, got)
		}
	}

	// só as movimentações da própria meta contam
	other := GoalMovement{ID: "x", GoalID: "outra", Type: GoalContribution, Date: "2026-01-01", Amount: 999}
	if got := ReplayGoal(g, []GoalMovement{other, gm(GoalContribution, "2026-01-01", 10)}); got.Saved != 10 {
		t.Errorf("movimentação de outra meta contou: %+v", got)
	}
}

func TestValidOrigin(t *testing.T) {
	for _, ok := range []string{"", "distribution|2026-11|balance|emergency", "distribution|2026-12|3f2a9c0e-1b2d-4c3e-8f4a-5b6c7d8e9f00|invest"} {
		if !ValidOrigin(ok) {
			t.Errorf("%q deveria ser válida", ok)
		}
	}
	for _, bad := range []string{"manual", "distribution|2026-13|balance|emergency", "distribution|2026-11|balance", "distribution|2026-11|ba lance|emergency", "distribution|2026-11||emergency"} {
		if ValidOrigin(bad) {
			t.Errorf("%q deveria ser recusada", bad)
		}
	}
}
