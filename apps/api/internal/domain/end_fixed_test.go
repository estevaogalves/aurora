package domain

import "testing"

// Espelha apps/web/src/domain/endFixed.test.ts: a regra em Go e a do front têm que dar o mesmo resultado.

func fixedCartao() Transaction {
	return Transaction{ID: "c", Name: "Cartão", Amount: 30000, Type: "expense", Category: "Outros", Fixed: true, Month: "2026-06", MonthlyValues: map[string]int64{"2026-11": 73247}}
}

func TestFixedEndMonth(t *testing.T) {
	ended := fixedCartao()
	ended.EndMonth = "2026-11"

	for month, want := range map[string]bool{"2026-05": false, "2026-06": true, "2026-10": true, "2026-11": true, "2026-12": false, "2030-01": false} {
		if got := IsFixedActiveIn(ended, month); got != want {
			t.Fatalf("IsFixedActiveIn(%s)=%v, esperado %v", month, got, want)
		}
	}

	// sem fim, segue valendo (o comportamento de sempre)
	if !IsFixedActiveIn(fixedCartao(), "2030-01") {
		t.Fatal("fixa sem fim deveria seguir valendo")
	}

	// oculto e encerrado convivem
	hidden := ended
	hidden.EndMonth = "2026-12"
	hidden.HiddenMonths = []string{"2026-12"}
	if IsFixedActiveIn(hidden, "2026-12") || IsFixedActiveIn(hidden, "2027-01") || !IsFixedActiveIn(hidden, "2026-11") {
		t.Fatal("oculto e encerrado não convivem")
	}
}

func TestEndedFixedKeepsEarlierMonthsAndDropsLaterTotals(t *testing.T) {
	rent := Transaction{ID: "a", Name: "Aluguel", Amount: 100000, Type: "expense", Category: "Moradia", Fixed: true, Month: "2026-01"}
	before := []Transaction{fixedCartao(), rent}
	endedCard := fixedCartao()
	endedCard.EndMonth = "2026-11"
	after := []Transaction{endedCard, rent}

	if a, b := GetMonthSummary(before, nil, "2026-11"), GetMonthSummary(after, nil, "2026-11"); a.TotalExpense != b.TotalExpense || b.TotalExpense != 73247+100000 {
		t.Fatalf("novembro mudou: antes=%d depois=%d", a.TotalExpense, b.TotalExpense)
	}
	if got := GetMonthSummary(before, nil, "2026-12").TotalExpense; got != 30000+100000 {
		t.Fatalf("dezembro antes: %d", got)
	}
	if got := GetMonthSummary(after, nil, "2026-12").TotalExpense; got != 100000 {
		t.Fatalf("dezembro depois: %d", got)
	}
	proj := GetProjection(after, nil, nil, "2026-11", 3)
	if proj[0].Expense != 173247 || proj[1].Expense != 100000 || proj[2].Expense != 100000 {
		t.Fatalf("projeção: %+v", proj)
	}
}
