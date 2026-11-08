package domain

import "testing"

const today = "2026-11"

func buy(id string, total int64, n int) CreditTransaction {
	return CreditTransaction{ID: id, Name: "Compra", TotalAmount: total, Installments: n, StartMonth: today, Category: "Outros"}
}

func must(t *testing.T, c CreditTransaction, adj map[string]InstallmentAdjustment, msg string) CreditTransaction {
	t.Helper()
	if msg != "" {
		t.Fatalf("esperava sucesso, veio: %s", msg)
	}
	c.Adjustments = adj
	return c
}

func creditSum(c CreditTransaction, month string) int64 { return creditTotal([]CreditTransaction{c}, month) }

func TestCanAdvanceOnlyLastFutureInstallment(t *testing.T) {
	c := buy("a", 30000, 3)
	if !CanAdvance(c, 3, today) || CanAdvance(c, 2, today) || CanAdvance(c, 1, today) {
		t.Error("só a 3 (última e futura) pode ser adiantada")
	}
	if CanAdvance(c, 3, "2027-01") || CanAdvance(c, 3, "2027-02") {
		t.Error("última no mês atual ou passada não pode ser adiantada")
	}
	if CanAdvance(buy("b", 10000, 1), 1, today) {
		t.Error("compra de 1 parcela no mês atual não pode ser adiantada")
	}
}

func TestAdvanceMovesAmountToCurrentMonth(t *testing.T) {
	c := buy("a", 20000, 2) // 2x de R$ 100
	adj, msg := AdvanceInstallment(c, 2, 800, today)
	adv := must(t, c, adj, msg)
	if got := creditSum(adv, "2026-11"); got != 10000+9200 {
		t.Errorf("mês atual=%d, esperado 19200", got)
	}
	if got := creditSum(adv, "2026-12"); got != 0 {
		t.Errorf("dezembro=%d, esperado 0", got)
	}
	items := CreditByMonth([]CreditTransaction{adv}, "2026-11")
	if len(items) != 2 || items[1].Advanced == nil || items[1].Advanced.OriginalMonth != "2026-12" ||
		items[1].Advanced.Discount != 800 || items[1].CurrentInstallment != 2 {
		t.Errorf("itens do mês atual=%+v", items)
	}
	// a original não foi alterada (cópia)
	if len(c.Adjustments) != 0 {
		t.Error("AdvanceInstallment não pode mudar a compra recebida")
	}
}

func TestAdvanceKeepsOtherInstallments(t *testing.T) {
	c := buy("a", 30000, 3)
	adj, msg := AdvanceInstallment(c, 3, 0, today)
	adv := must(t, c, adj, msg)
	if creditSum(adv, "2026-11") != 20000 || creditSum(adv, "2026-12") != 10000 || creditSum(adv, "2027-01") != 0 {
		t.Error("1ª e 2ª devem ficar nos seus meses")
	}
	if LastOpenInstallment(adv) != 2 || !CanAdvance(adv, 2, today) {
		t.Error("a 2ª vira a última e pode ser adiantada")
	}
	if _, msg := AdvanceInstallment(adv, 3, 0, today); msg == "" {
		t.Error("não pode adiantar de novo a mesma parcela")
	}
}

func TestAdvanceRejections(t *testing.T) {
	c := buy("a", 30000, 3)
	for _, n := range []int{1, 2, 0, 4} {
		if _, msg := AdvanceInstallment(c, n, 0, today); msg == "" {
			t.Errorf("parcela %d não pode ser adiantada", n)
		}
	}
	if _, msg := AdvanceInstallment(c, 3, 0, "2027-01"); msg == "" {
		t.Error("parcela do mês atual não pode ser adiantada")
	}
	for _, d := range []int64{-1, 10000, 20000} {
		if _, msg := AdvanceInstallment(c, 3, d, today); msg == "" {
			t.Errorf("desconto %d deveria ser rejeitado", d)
		}
	}
	if _, msg := AdvanceInstallment(c, 3, 9999, today); msg != "" {
		t.Errorf("desconto de 9999 é válido: %s", msg)
	}
}

func TestEditAndRemoveSingleInstallment(t *testing.T) {
	c := buy("a", 30000, 3)
	adj, msg := EditInstallment(c, 2, 15000)
	e := must(t, c, adj, msg)
	if creditSum(e, "2026-11") != 10000 || creditSum(e, "2026-12") != 15000 || creditSum(e, "2027-01") != 10000 {
		t.Error("só a parcela 2 muda")
	}
	adj, msg = RemoveInstallment(e, 2)
	r := must(t, e, adj, msg)
	if creditSum(r, "2026-12") != 0 || creditSum(r, "2027-01") != 10000 {
		t.Error("excluir remove só a parcela 2")
	}
	if _, msg := EditInstallment(r, 2, 5000); msg == "" {
		t.Error("parcela excluída não pode ser editada")
	}

	adj, msg = AdvanceInstallment(c, 3, 0, today)
	a := must(t, c, adj, msg)
	if _, msg := EditInstallment(a, 3, 5000); msg == "" {
		t.Error("parcela adiantada não pode ser editada")
	}
	if _, msg := RemoveInstallment(a, 3); msg == "" {
		t.Error("parcela adiantada não pode ser excluída")
	}
}

func TestValidateAdjustmentsAndInstallmentsChange(t *testing.T) {
	c := buy("a", 30000, 3)
	if !CanChangeInstallments(c) {
		t.Error("sem ajustes, o número de parcelas pode mudar")
	}
	v := int64(0)
	c.Adjustments = map[string]InstallmentAdjustment{"1": {Value: &v}}
	if ValidateAdjustments(c) == "" {
		t.Error("valor zero deveria ser inválido")
	}
	c.Adjustments = map[string]InstallmentAdjustment{"9": {Removed: true}}
	if ValidateAdjustments(c) == "" {
		t.Error("posição fora do intervalo deveria ser inválida")
	}
	c.Adjustments = map[string]InstallmentAdjustment{"3": {Advanced: &InstallmentAdvance{Month: "2026-11", Discount: -1, Amount: 100}}}
	if ValidateAdjustments(c) == "" {
		t.Error("desconto negativo deveria ser inválido")
	}
	c.Adjustments = map[string]InstallmentAdjustment{"3": {Advanced: &InstallmentAdvance{Month: "2026-11", Discount: 800, Amount: 9200}}}
	if ValidateAdjustments(c) != "" || CanChangeInstallments(c) {
		t.Error("ajuste válido; com ajustes não muda o número de parcelas")
	}
}

func TestSummaryAndProjectionReflectAdvance(t *testing.T) {
	c := buy("a", 20000, 2)
	adj, msg := AdvanceInstallment(c, 2, 800, today)
	adv := must(t, c, adj, msg)
	s := GetMonthSummary(nil, []CreditTransaction{adv}, "2026-11")
	if s.CreditExpense != 19200 || s.TotalExpense != 19200 {
		t.Errorf("resumo=%+v", s)
	}
	p := GetProjection(nil, []CreditTransaction{adv}, nil, "2026-11", 2)
	if p[0].CreditExpense != 19200 || p[1].CreditExpense != 0 {
		t.Errorf("projeção=%+v", p)
	}
}

func subscription(start, end string) CreditTransaction {
	return CreditTransaction{ID: "r", Name: "Streaming", TotalAmount: 3990, Installments: 1, StartMonth: start, Category: "Lazer", Recurring: true, EndMonth: end}
}

func TestRecurringChargesEveryMonthFromStart(t *testing.T) {
	c := subscription("2026-11", "")
	if got := creditSum(c, "2026-10"); got != 0 {
		t.Errorf("antes do início cobrou %d", got)
	}
	for _, m := range []string{"2026-11", "2027-03", "2030-01"} {
		if got := creditSum(c, m); got != 3990 {
			t.Errorf("%s: cobrou %d, queria 3990", m, got)
		}
	}
	item := CreditByMonth([]CreditTransaction{c}, "2027-01")[0]
	if !item.Recurring || item.Installments != 0 {
		t.Errorf("item=%+v", item)
	}
}

func TestRecurringStopsAfterEndMonth(t *testing.T) {
	c := subscription("2026-09", "2026-12")
	for m, want := range map[string]int64{"2026-09": 3990, "2026-12": 3990, "2027-01": 0, "2027-06": 0} {
		if got := creditSum(c, m); got != want {
			t.Errorf("%s: cobrou %d, queria %d", m, got, want)
		}
	}
}

func TestCancelRecurrence(t *testing.T) {
	c := subscription("2026-09", "")
	// mês escolhido no futuro vale como está
	if end, msg := CancelRecurrence(c, "2027-02", today); msg != "" || end != "2027-02" {
		t.Errorf("end=%q msg=%q", end, msg)
	}
	// mês passado: nunca antes do mês atual (o que já foi cobrado fica)
	if end, msg := CancelRecurrence(c, "2026-09", today); msg != "" || end != today {
		t.Errorf("end=%q msg=%q", end, msg)
	}
	if _, msg := CancelRecurrence(c, "xx", today); msg == "" {
		t.Error("mês inválido deveria ser recusado")
	}
	if _, msg := CancelRecurrence(subscription("2026-09", "2026-12"), "2027-01", today); msg == "" {
		t.Error("recorrência já cancelada")
	}
	if _, msg := CancelRecurrence(buy("p", 10000, 2), "2027-01", today); msg == "" {
		t.Error("compra parcelada não tem recorrência")
	}
}

func TestRecurringHasNoInstallmentAdjustments(t *testing.T) {
	c := subscription("2026-11", "")
	if _, msg := EditInstallment(c, 1, 100); msg == "" {
		t.Error("editar parcela de recorrente")
	}
	if _, msg := RemoveInstallment(c, 1); msg == "" {
		t.Error("excluir parcela de recorrente")
	}
	if _, msg := AdvanceInstallment(c, 1, 0, "2026-01"); msg == "" {
		t.Error("adiantar parcela de recorrente")
	}
}
