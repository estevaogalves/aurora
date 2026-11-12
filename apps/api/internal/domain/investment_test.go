package domain

import (
	"math"
	"strconv"
	"testing"
)

// Estes casos espelham apps/web/src/domain/investments.test.ts: a regra em Go e a do front têm que
// dar o mesmo resultado (o servidor refaz o investimento a cada movimentação).

var (
	cdb = Investment{ID: "i1", Name: "CDB 110%", Family: "fixed", Institution: "Banco A", AppliedAt: "2026-01-01", MaturityDate: "2026-12-01"}
	fii = Investment{ID: "i2", Name: "HGLG11", Family: "equity", Institution: "Corretora B", AppliedAt: "2026-01-01"}
)

var seq int

func mov(invID, typ string, amount int64, date string) InvestmentMovement {
	seq++
	return InvestmentMovement{ID: "m" + strconv.Itoa(seq), InvestmentID: invID, Type: typ, Date: date, Amount: amount}
}

func withQty(m InvestmentMovement, qty float64, unit int64) InvestmentMovement {
	m.Quantity, m.UnitPrice = &qty, &unit
	return m
}

func TestReplayValueAndProfit(t *testing.T) {
	t.Run("aporte novo não aparece como lucro, rendimento sim", func(t *testing.T) {
		movs := []InvestmentMovement{mov("i1", MovementContribution, 100000, "2026-03-01"), mov("i1", MovementYield, 5000, "2026-03-02"), mov("i1", MovementContribution, 50000, "2026-03-03")}
		inv := ReplayInvestment(cdb, movs)
		tot := GetInvestmentTotals(inv, movs)
		if inv.CurrentValue != 155000 || tot.Contributed != 150000 || tot.Profit != 5000 {
			t.Fatalf("inv=%d totais=%+v", inv.CurrentValue, tot)
		}
	})

	t.Run("resgate parcial e total não distorcem o lucro", func(t *testing.T) {
		base := []InvestmentMovement{mov("i1", MovementContribution, 100000, "2026-03-01"), mov("i1", MovementYield, 10000, "2026-03-02")}
		partial := append(append([]InvestmentMovement{}, base...), mov("i1", MovementRedemption, 40000, "2026-03-03"))
		p := ReplayInvestment(cdb, partial)
		if p.CurrentValue != 70000 || GetInvestmentTotals(p, partial).Profit != 10000 {
			t.Fatalf("parcial: valor=%d lucro=%d", p.CurrentValue, GetInvestmentTotals(p, partial).Profit)
		}
		total := append(append([]InvestmentMovement{}, base...), mov("i1", MovementRedemption, 110000, "2026-03-03"))
		a := ReplayInvestment(cdb, total)
		if a.CurrentValue != 0 || GetInvestmentTotals(a, total).Profit != 10000 {
			t.Fatalf("total: valor=%d lucro=%d", a.CurrentValue, GetInvestmentTotals(a, total).Profit)
		}
	})

	t.Run("atualização de valor define o valor e o lucro acompanha", func(t *testing.T) {
		movs := []InvestmentMovement{mov("i1", MovementContribution, 90000, "2026-03-01"), mov("i1", MovementAdjustment, 95000, "2026-03-02")}
		inv := ReplayInvestment(cdb, movs)
		if inv.CurrentValue != 95000 || GetInvestmentTotals(inv, movs).Profit != 5000 {
			t.Fatalf("valor=%d", inv.CurrentValue)
		}
	})

	t.Run("o valor nunca fica negativo", func(t *testing.T) {
		inv := ReplayInvestment(cdb, []InvestmentMovement{mov("i1", MovementContribution, 1000, "2026-03-01"), mov("i1", MovementRedemption, 5000, "2026-03-02")})
		if inv.CurrentValue != 0 {
			t.Fatalf("valor=%d", inv.CurrentValue)
		}
	})

	t.Run("segue a data, não a ordem de cadastro, e excluir recalcula", func(t *testing.T) {
		late := mov("i1", MovementContribution, 10000, "2026-03-10")
		early := mov("i1", MovementContribution, 20000, "2026-01-05")
		if got := SortMovements([]InvestmentMovement{late, early}); got[0].Date != "2026-01-05" {
			t.Fatalf("ordem=%v", got)
		}
		if v := ReplayInvestment(cdb, []InvestmentMovement{late, early}).CurrentValue; v != 30000 {
			t.Fatalf("valor=%d", v)
		}
		if v := ReplayInvestment(cdb, []InvestmentMovement{late}).CurrentValue; v != 10000 {
			t.Fatalf("depois de excluir: %d", v)
		}
		// o ajuste do meio vale pela data: o aporte posterior soma depois dele
		adjust := mov("i1", MovementAdjustment, 50000, "2026-02-01")
		if v := ReplayInvestment(cdb, []InvestmentMovement{late, early, adjust}).CurrentValue; v != 60000 {
			t.Fatalf("com ajuste: %d", v)
		}
	})

	t.Run("mesma data: a registrada primeiro vem antes", func(t *testing.T) {
		movs := []InvestmentMovement{mov("i1", MovementContribution, 1000, "2026-03-01"), mov("i1", MovementAdjustment, 5000, "2026-03-01"), mov("i1", MovementYield, 200, "2026-03-01")}
		if v := ReplayInvestment(cdb, movs).CurrentValue; v != 5200 {
			t.Fatalf("valor=%d", v)
		}
	})

	t.Run("ignora movimentação de outro investimento", func(t *testing.T) {
		inv := ReplayInvestment(cdb, []InvestmentMovement{mov("i1", MovementContribution, 1000, "2026-03-01"), mov("i2", MovementContribution, 9999, "2026-03-01")})
		if inv.CurrentValue != 1000 {
			t.Fatalf("valor=%d", inv.CurrentValue)
		}
	})
}

func TestReplayQuantityAndAveragePrice(t *testing.T) {
	movs := []InvestmentMovement{
		withQty(mov("i2", MovementContribution, 300000, "2026-01-01"), 100, 3000),
		withQty(mov("i2", MovementContribution, 50000, "2026-02-01"), 10, 5000),
	}
	inv := ReplayInvestment(fii, movs)
	wantAvg := int64(math.Round(350000.0 / 110.0))
	if inv.Quantity == nil || *inv.Quantity != 110 || inv.AvgPrice == nil || *inv.AvgPrice != wantAvg {
		t.Fatalf("cotas=%v preço médio=%v", inv.Quantity, inv.AvgPrice)
	}

	sold := ReplayInvestment(fii, append(append([]InvestmentMovement{}, movs...), withQty(mov("i2", MovementRedemption, 100000, "2026-03-01"), 20, 5000)))
	if *sold.Quantity != 90 || *sold.AvgPrice != wantAvg {
		t.Fatalf("depois do resgate: cotas=%v preço médio=%v", *sold.Quantity, *sold.AvgPrice)
	}

	// vender tudo zera as cotas e tira o preço médio
	all := ReplayInvestment(fii, append(append([]InvestmentMovement{}, movs...), withQty(mov("i2", MovementRedemption, 350000, "2026-03-01"), 110, 3200)))
	if all.Quantity == nil || *all.Quantity != 0 || all.AvgPrice != nil {
		t.Fatalf("venda total: cotas=%v preço médio=%v", all.Quantity, all.AvgPrice)
	}

	// vender mais do que tem não deixa cotas negativas
	over := ReplayInvestment(fii, []InvestmentMovement{withQty(mov("i2", MovementContribution, 1000, "2026-01-01"), 1, 1000), withQty(mov("i2", MovementRedemption, 9000, "2026-02-01"), 5, 1800)})
	if *over.Quantity != 0 {
		t.Fatalf("cotas=%v", *over.Quantity)
	}
}

func TestReplayMatchesFrontRounding(t *testing.T) {
	// JS: Math.round(2.5) = 3 e Math.round(0.5) = 1 (metade para cima); math.Round de Go também, mas
	// jsRound precisa concordar nos casos de .5 exato.
	for in, want := range map[float64]float64{2.5: 3, 0.5: 1, 1.4999: 1, 7.5: 8} {
		if got := jsRound(in); got != want {
			t.Fatalf("jsRound(%v)=%v, esperado %v", in, got, want)
		}
	}
	// preço médio com .5 exato: 5 cotas a 3 centavos + 1 a 4 = 19/... usa 1 cota a 100 e 1 a 101 => 100,5 => 101
	movs := []InvestmentMovement{withQty(mov("i2", MovementContribution, 100, "2026-01-01"), 1, 100), withQty(mov("i2", MovementContribution, 101, "2026-01-02"), 1, 101)}
	if inv := ReplayInvestment(fii, movs); *inv.AvgPrice != 101 {
		t.Fatalf("preço médio=%d, esperado 101", *inv.AvgPrice)
	}
}

func TestReplayWithoutQuantityKeepsShares(t *testing.T) {
	q := 5.0
	with := cdb
	with.Quantity = &q
	inv := ReplayInvestment(with, []InvestmentMovement{mov("i1", MovementContribution, 1000, "2026-03-01")})
	if inv.Quantity == nil || *inv.Quantity != 5 {
		t.Fatalf("cotas=%v", inv.Quantity)
	}
}

func TestFractionalShares(t *testing.T) {
	movs := []InvestmentMovement{withQty(mov("i2", MovementContribution, 10000, "2026-01-01"), 0.5, 20000)}
	inv := ReplayInvestment(fii, movs)
	if *inv.Quantity != 0.5 || *inv.AvgPrice != 20000 {
		t.Fatalf("cotas=%v preço médio=%v", *inv.Quantity, *inv.AvgPrice)
	}
}

func TestIsValidDate(t *testing.T) {
	for d, ok := range map[string]bool{"2026-02-28": true, "2028-02-29": true, "2026-02-30": false, "2026-13-01": false, "2026-1-1": false, "": false, "01/02/2026": false} {
		if IsValidDate(d) != ok {
			t.Fatalf("IsValidDate(%q) deveria ser %v", d, ok)
		}
	}
}
