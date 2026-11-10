package domain

import "testing"

func TestGetInvoice(t *testing.T) {
	card := CreditCard{ClosingDay: 2, DueDay: 9}
	cases := []struct {
		name       string
		card       CreditCard
		date       string
		n          int
		close, due string
		month      string
	}{
		{"depois do fechamento", card, "2026-11-07", 1, "2026-12-02", "2026-12-09", "2026-12"},
		{"antes do fechamento", card, "2026-11-01", 1, "2026-11-02", "2026-11-09", "2026-11"},
		{"no dia do fechamento", card, "2026-11-02", 1, "2026-11-02", "2026-11-09", "2026-11"},
		{"vencimento <= fechamento", CreditCard{ClosingDay: 25, DueDay: 5}, "2026-11-10", 1, "2026-11-25", "2026-12-05", "2026-12"},
		{"virada de ano", card, "2026-12-20", 1, "2027-01-02", "2027-01-09", "2027-01"},
		{"fevereiro curto", CreditCard{ClosingDay: 31, DueDay: 30}, "2027-02-28", 1, "2027-02-28", "2027-03-30", "2027-03"},
		{"bissexto", CreditCard{ClosingDay: 31, DueDay: 30}, "2028-02-29", 1, "2028-02-29", "2028-03-30", "2028-03"},
		{"3a parcela", card, "2026-11-07", 3, "2027-02-02", "2027-02-09", "2027-02"},
	}
	for _, c := range cases {
		got := GetInvoice(c.card, c.date, c.n)
		if got.ClosingDate != c.close || got.DueDate != c.due || got.Month != c.month {
			t.Errorf("%s: got %+v, quero %s / %s / %s", c.name, got, c.close, c.due, c.month)
		}
	}
}

func TestResolveCreditsSaldoDeNovembro(t *testing.T) {
	card := CreditCard{ID: "k", Name: "Nubank", ClosingDay: 2, DueDay: 9}
	credits := []CreditTransaction{
		{ID: "w", Name: "WellHub", TotalAmount: 9999, Installments: 1, StartMonth: "2026-11", BillingDay: 6, Recurring: true, CardID: "k"},
		{ID: "c", Name: "Claude", TotalAmount: 11850, Installments: 1, StartMonth: "2026-11", BillingDay: 11, Recurring: true, VariableAmount: true, CardID: "k"},
		{ID: "x", Name: "Sem cartão", TotalAmount: 1000, Installments: 1, StartMonth: "2026-11", BillingDay: 6, Recurring: true},
	}
	resolved := ResolveCredits(credits, []CreditCard{card})
	if got := creditTotal(resolved, "2026-11"); got != 1000 {
		t.Errorf("novembro: %d, quero 1000 (só a compra sem cartão)", got)
	}
	if got := creditTotal(resolved, "2026-12"); got != 9999+11850+1000 {
		t.Errorf("dezembro: %d", got)
	}
	if credits[0].StartMonth != "2026-11" {
		t.Error("não pode alterar a lista original")
	}
}

func TestValorRealDeRecorrenciaVariavel(t *testing.T) {
	c := CreditTransaction{ID: "c", TotalAmount: 11850, Installments: 1, StartMonth: "2026-12", Recurring: true, VariableAmount: true}
	adj, msg := EditInstallment(c, 2, 11809)
	if msg != "" {
		t.Fatal(msg)
	}
	c.Adjustments = adj
	if InstallmentValue(c, 1) != 11850 || InstallmentValue(c, 2) != 11809 || InstallmentValue(c, 3) != 11850 {
		t.Error("só o mês 2 deve ter o valor real")
	}
	items := CreditByMonth([]CreditTransaction{c}, "2027-01")
	if len(items) != 1 || !items[0].Adjusted || items[0].InstallmentValue != 11809 {
		t.Errorf("item: %+v", items)
	}
	if it := CreditByMonth([]CreditTransaction{c}, "2026-12"); !it[0].Estimated {
		t.Error("mês sem valor real deve vir como estimado")
	}
	if _, msg := EditInstallment(CreditTransaction{Recurring: true, StartMonth: "2026-12"}, 1, 100); msg == "" {
		t.Error("recorrente comum não aceita valor por mês")
	}
	back, msg := ClearActualValue(c, 2)
	if msg != "" || len(back) != 0 {
		t.Errorf("voltar ao estimado: %v %q", back, msg)
	}
}
