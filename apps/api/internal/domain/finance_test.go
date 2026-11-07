package domain

import (
	"reflect"
	"testing"
)

func TestMonthMath(t *testing.T) {
	cases := []struct {
		in     string
		off    int
		expect string
	}{
		{"2026-01", -1, "2025-12"},
		{"2026-12", 1, "2027-01"},
		{"2026-03", 14, "2027-05"},
		{"2026-03", -15, "2024-12"},
	}
	for _, c := range cases {
		if got := ChangeMonth(c.in, c.off); got != c.expect {
			t.Errorf("ChangeMonth(%s,%d)=%s, esperado %s", c.in, c.off, got, c.expect)
		}
	}
	if MonthsDifference("2027-02", "2026-11") != 3 {
		t.Error("MonthsDifference errado")
	}
	if !IsValidMonth("2026-12") || IsValidMonth("2026-13") || IsValidMonth("26-01") {
		t.Error("IsValidMonth errado")
	}
	if got := MonthsBetween("2026-11", "2027-02"); !reflect.DeepEqual(got, []string{"2026-11", "2026-12", "2027-01", "2027-02"}) {
		t.Errorf("MonthsBetween=%v", got)
	}
}

func TestSplitInstallments(t *testing.T) {
	if got := SplitInstallments(1000, 3); !reflect.DeepEqual(got, []int64{334, 333, 333}) {
		t.Errorf("got %v", got)
	}
	var sum int64
	for _, p := range SplitInstallments(12345, 7) {
		sum += p
	}
	if sum != 12345 {
		t.Errorf("soma das parcelas=%d", sum)
	}
	if got := SplitInstallments(500, 0); !reflect.DeepEqual(got, []int64{500}) {
		t.Errorf("count 0 deveria virar 1 parcela, got %v", got)
	}
}

func TestFixedTransactions(t *testing.T) {
	rent := Transaction{ID: "a", Type: "expense", Category: "Moradia", Amount: 100000, Fixed: true, Month: "2026-03",
		HiddenMonths: []string{"2026-05"}, MonthlyValues: map[string]int64{"2026-04": 0, "2026-06": 120000}}
	oneOff := Transaction{ID: "b", Type: "expense", Category: "Lazer", Amount: 5000, Month: "2026-04"}
	list := []Transaction{rent, oneOff}

	amount := func(month string) (int64, int) {
		var sum int64
		got := TransactionsByMonth(list, month)
		for _, tr := range got {
			sum += tr.Amount
		}
		return sum, len(got)
	}

	if s, n := amount("2026-02"); s != 0 || n != 0 {
		t.Errorf("antes do início não vale: %d/%d", s, n)
	}
	if s, _ := amount("2026-03"); s != 100000 {
		t.Errorf("mar=%d", s)
	}
	// 0 por mês é válido e a despesa avulsa continua só no mês dela
	if s, n := amount("2026-04"); s != 5000 || n != 2 {
		t.Errorf("abr=%d n=%d", s, n)
	}
	if s, n := amount("2026-05"); s != 0 || n != 0 {
		t.Errorf("mês oculto: %d/%d", s, n)
	}
	if s, _ := amount("2026-06"); s != 120000 {
		t.Errorf("jun=%d", s)
	}
	if s, _ := amount("2026-07"); s != 100000 {
		t.Errorf("jul=%d", s)
	}
}

func TestMonthSummaryAndCredit(t *testing.T) {
	txs := []Transaction{
		{ID: "1", Type: "income", Category: "Renda", Amount: 500000, Fixed: true, Month: "2026-01"},
		{ID: "2", Type: "expense", Category: "Moradia", Amount: 150000, Month: "2026-02"},
	}
	credits := []CreditTransaction{{ID: "c", Name: "TV", TotalAmount: 100000, Installments: 3, StartMonth: "2026-01", Category: "Lazer"}}

	s := GetMonthSummary(txs, credits, "2026-02")
	if s.TotalIncome != 500000 || s.CreditExpense != 33333 || s.TotalExpense != 183333 || s.Balance != 316667 {
		t.Errorf("resumo errado: %+v", s)
	}
	if s.ByCategory[CreditCategory] != 33333 || s.ByCategory["Moradia"] != 150000 {
		t.Errorf("categorias: %+v", s.ByCategory)
	}
	// 1ª parcela leva o centavo que sobra
	if p := CreditByMonth(credits, "2026-01")[0]; p.InstallmentValue != 33334 || p.CurrentInstallment != 1 {
		t.Errorf("parcela 1: %+v", p)
	}
	if got := CreditByMonth(credits, "2026-04"); len(got) != 0 {
		t.Errorf("não cobra depois da última parcela: %v", got)
	}
	if s := GetMonthSummary(nil, nil, "2026-01"); s.ExpensePercentage != 0 || s.Balance != 0 {
		t.Errorf("mês vazio: %+v", s)
	}
}

func TestProjection(t *testing.T) {
	txs := []Transaction{
		{ID: "1", Type: "income", Amount: 300000, Fixed: true, Month: "2026-01"},
		{ID: "2", Type: "expense", Amount: 100000, Fixed: true, Month: "2026-01"},
		{ID: "3", Type: "expense", Amount: 99999, Month: "2026-01"}, // variável não entra na projeção
	}
	credits := []CreditTransaction{{ID: "c", TotalAmount: 20000, Installments: 2, StartMonth: "2026-02"}}
	extras := []ExtraExpense{{ID: "e", Amount: 50000, Month: "2026-03"}}

	p := GetProjection(txs, credits, extras, "2026-02", 3)
	if len(p) != 3 {
		t.Fatalf("len=%d", len(p))
	}
	if p[0].Expense != 110000 || p[0].Balance != 190000 || p[0].Accumulated != 190000 {
		t.Errorf("fev: %+v", p[0])
	}
	if p[1].ExtraExpense != 50000 || p[1].Balance != 140000 || p[1].Accumulated != 330000 {
		t.Errorf("mar: %+v", p[1])
	}
	if p[2].Expense != 100000 || p[2].Accumulated != 530000 {
		t.Errorf("abr: %+v", p[2])
	}
}

func TestCompare(t *testing.T) {
	txs := []Transaction{
		{ID: "1", Type: "income", Category: "Renda", Amount: 100000, Month: "2026-01"},
		{ID: "2", Type: "expense", Category: "Moradia", Amount: 70000, Month: "2026-01"},
		{ID: "3", Type: "income", Category: "Renda", Amount: 100000, Month: "2026-02"},
		{ID: "4", Type: "expense", Category: "Lazer", Amount: 20000, Month: "2026-02"},
	}
	c := Compare(txs, nil, []string{"2026-01", "2026-02"})
	if c.Income != 200000 || c.Expense != 90000 || c.Balance != 110000 {
		t.Errorf("totais: %+v", c)
	}
	if c.TopCategory == nil || c.TopCategory.Category != "Moradia" {
		t.Errorf("top: %+v", c.TopCategory)
	}
	if !reflect.DeepEqual(c.Ranking, []string{"2026-02", "2026-01"}) {
		t.Errorf("ranking: %v", c.Ranking)
	}
}
