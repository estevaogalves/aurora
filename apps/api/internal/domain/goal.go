package domain

import (
	"regexp"
	"sort"
)

// Histórico de metas e porquinhos, no mesmo conceito dos investimentos (investment.go): cada aporte, retirada,
// rendimento ou ajuste é uma movimentação datada, e o valor guardado é refeito por elas (ReplayGoal).
// É a versão em Go de replayGoal (apps/web/src/domain/goals.ts) e as duas têm que dar o mesmo resultado.

// Tipos de movimentação de meta: aporte soma ao guardado; retirada subtrai (nunca abaixo de zero); rendimento soma
// ao guardado e ao total de rendimentos; ajuste define o novo valor guardado (Amount é o valor, não a diferença).
const (
	GoalContribution = "contribution"
	GoalWithdrawal   = "withdrawal"
	GoalYield        = "yield"
	GoalAdjustment   = "adjustment"
)

// GoalMovement é uma movimentação datada de uma meta ou porquinho. Amount em centavos, Date "AAAA-MM-DD".
type GoalMovement struct {
	ID     string `json:"id"`
	GoalID string `json:"goalId"`
	Type   string `json:"type"`
	Date   string `json:"date"`
	Amount int64  `json:"amount"`
	Note   string `json:"note,omitempty"`
	// Origin: vazio = lançado à mão; "distribution|AAAA-MM|fonte|fatia" = enviado pela sugestão do saldo.
	Origin string `json:"origin,omitempty"`
}

// IsGoalMovementType diz se t é um tipo de movimentação de meta conhecido.
func IsGoalMovementType(t string) bool {
	switch t {
	case GoalContribution, GoalWithdrawal, GoalYield, GoalAdjustment:
		return true
	}
	return false
}

var originRe = regexp.MustCompile(`^distribution\|\d{4}-(0[1-9]|1[0-2])\|[A-Za-z0-9_-]{1,64}\|[A-Za-z0-9_-]{1,64}$`)

// ValidOrigin confere a origem de uma movimentação: vazia ou "distribution|AAAA-MM|fonte|fatia".
func ValidOrigin(o string) bool { return o == "" || originRe.MatchString(o) }

// SortGoalMovements devolve as movimentações em ordem cronológica. Na mesma data, a registrada primeiro vem antes.
func SortGoalMovements(movements []GoalMovement) []GoalMovement {
	out := append([]GoalMovement(nil), movements...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	return out
}

// ReplayGoal recalcula o guardado e o total de rendimentos refazendo as movimentações da meta em ordem de data.
// O guardado nunca fica negativo.
func ReplayGoal(g Goal, movements []GoalMovement) Goal {
	var own []GoalMovement
	for _, m := range movements {
		if m.GoalID == g.ID {
			own = append(own, m)
		}
	}
	var saved, yield int64
	for _, m := range SortGoalMovements(own) {
		switch m.Type {
		case GoalContribution:
			saved += m.Amount
		case GoalWithdrawal:
			saved -= m.Amount
			if saved < 0 {
				saved = 0
			}
		case GoalYield:
			saved += m.Amount
			yield += m.Amount
		default: // ajuste: define o valor guardado
			saved = m.Amount
		}
	}
	if saved < 0 {
		saved = 0
	}
	next := g
	next.Saved = saved
	next.YieldTotal = yield
	return next
}
