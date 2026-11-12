package domain

import "testing"

// Espelham os casos de apps/web/src/domain/cardInvoice.test.ts: a regra em Go e a do front têm que dar o mesmo resultado.

var (
	nubankCard = CreditCard{ID: "nu", Name: "Nubank", ClosingDay: 2, DueDay: 9}
	interCard  = CreditCard{ID: "in", Name: "Inter", ClosingDay: 25, DueDay: 5, Limit: 30000}
)

func cardTx(id, cardID, purchase string) Transaction {
	return Transaction{ID: id, Name: id, Amount: 1000, Type: "expense", Category: "Alimentação", Month: purchase[:7], CardID: cardID, PurchaseDate: purchase}
}

func TestResolveCardTransactions(t *testing.T) {
	t.Run("até o fechamento vale no mês; depois, no mês seguinte", func(t *testing.T) {
		got := ResolveCardTransactions([]Transaction{cardTx("a", "nu", "2026-11-01"), cardTx("b", "nu", "2026-11-02"), cardTx("c", "nu", "2026-11-07")}, []CreditCard{nubankCard})
		if got[0].Month != "2026-11" || got[1].Month != "2026-11" || got[2].Month != "2026-12" {
			t.Fatalf("meses=%s %s %s", got[0].Month, got[1].Month, got[2].Month)
		}
	})

	t.Run("guarda o dia da compra e não altera a lista recebida", func(t *testing.T) {
		saved := []Transaction{cardTx("a", "nu", "2026-11-07")}
		got := ResolveCardTransactions(saved, []CreditCard{nubankCard})
		if got[0].Month != "2026-12" || got[0].PurchaseDate != "2026-11-07" || got[0].CardID != "nu" {
			t.Fatalf("got=%+v", got[0])
		}
		if saved[0].Month != "2026-11" {
			t.Fatalf("alterou o original: %s", saved[0].Month)
		}
	})

	t.Run("fixa, renda, sem cartão, cartão apagado e sem dia ficam como estão", func(t *testing.T) {
		fixed := cardTx("fixa", "nu", "2026-11-07")
		fixed.Fixed = true
		income := cardTx("renda", "nu", "2026-11-07")
		income.Type = "income"
		noDate := cardTx("sem-data", "nu", "2026-11-07")
		noDate.PurchaseDate = ""
		list := []Transaction{fixed, income, {ID: "comum", Type: "expense", Month: "2026-11"}, cardTx("orfa", "apagado", "2026-11-07"), noDate}
		for i, x := range ResolveCardTransactions(list, []CreditCard{nubankCard}) {
			if x.Month != "2026-11" {
				t.Fatalf("item %d (%s) mudou para %s", i, x.ID, x.Month)
			}
		}
	})

	t.Run("sem cartões devolve a mesma lista", func(t *testing.T) {
		list := []Transaction{cardTx("a", "nu", "2026-11-07")}
		if got := ResolveCardTransactions(list, nil); &got[0] != &list[0] {
			t.Fatal("deveria devolver a própria lista")
		}
	})
}

func TestResolveCardExtras(t *testing.T) {
	// virada de ano acompanha o vencimento: compra em 26/12 (fecha dia 25) vence em 05/02
	got := ResolveCardExtras([]ExtraExpense{{ID: "e", Amount: 9000, Month: "2026-12", CardID: "in", PurchaseDate: "2026-12-26"}, {ID: "x", Amount: 1, Month: "2026-12"}}, []CreditCard{interCard})
	if got[0].Month != "2027-02" || got[1].Month != "2026-12" {
		t.Fatalf("meses=%s %s", got[0].Month, got[1].Month)
	}
}
