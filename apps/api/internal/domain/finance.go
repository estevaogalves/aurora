package domain

import "sort"

// CreditCategory é a categoria em que as parcelas entram nos resumos.
const CreditCategory = "Crédito/Parcelado"

// SplitInstallments divide o total em N parcelas; os centavos que sobram vão
// uma a uma para as primeiras. 1000 em 3 -> [334, 333, 333].
func SplitInstallments(total int64, count int) []int64 {
	if count < 1 {
		count = 1
	}
	n := int64(count)
	base := total / n
	rest := total - base*n
	out := make([]int64, count)
	for i := range out {
		out[i] = base
		if int64(i) < rest {
			out[i]++
		}
	}
	return out
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// IsFixedActiveIn: a fixa vale do mês em que foi criada em diante, menos nos ocultados.
func IsFixedActiveIn(t Transaction, month string) bool {
	if !t.Fixed || CompareMonths(month, t.Month) < 0 {
		return false
	}
	return !contains(t.HiddenMonths, month)
}

// TransactionsByMonth devolve o que vale no mês, com o valor específico do mês aplicado.
// Zero é um valor válido: só ignora quando não há valor definido.
func TransactionsByMonth(list []Transaction, month string) []Transaction {
	out := []Transaction{}
	for _, t := range list {
		if t.Fixed {
			if !IsFixedActiveIn(t, month) {
				continue
			}
			if v, ok := t.MonthlyValues[month]; ok {
				t.Amount = v
			}
		} else if t.Month != month {
			continue
		}
		out = append(out, t)
	}
	return out
}

// RecurringCharges: a compra recorrente cobra neste mês (depois de StartMonth e, se cancelada, até EndMonth).
func RecurringCharges(c CreditTransaction, month string) bool {
	if !c.Recurring || CompareMonths(month, c.StartMonth) < 0 {
		return false
	}
	return c.EndMonth == "" || CompareMonths(month, c.EndMonth) <= 0
}

// InstallmentNumber diz em qual parcela (1..N) a compra está no mês; 0 se não cobra.
// Recorrente não tem parcelas: devolve 0 (use RecurringCharges).
func InstallmentNumber(c CreditTransaction, month string) int {
	if c.Recurring {
		return 0
	}
	diff := MonthsDifference(month, c.StartMonth)
	if diff < 0 || diff >= c.Installments {
		return 0
	}
	return diff + 1
}

// CreditByMonth lista as parcelas que caem no mês: as normais e as adiantadas para este mês.
func CreditByMonth(credits []CreditTransaction, month string) []CreditInstallment {
	out := []CreditInstallment{}
	for _, c := range credits {
		base := CreditInstallment{
			ID: c.ID, Name: c.Name, Category: c.Category,
			Installments: c.Installments, TotalAmount: c.TotalAmount,
		}
		if RecurringCharges(c, month) {
			item := base
			item.Installments = 0
			item.Recurring = true
			item.CurrentInstallment = MonthsDifference(month, c.StartMonth) + 1
			item.InstallmentValue = c.TotalAmount
			out = append(out, item)
			continue
		}
		if n := InstallmentNumber(c, month); n != 0 && c.isOpen(n) {
			item := base
			item.CurrentInstallment = n
			item.InstallmentValue = InstallmentValue(c, n)
			item.Adjusted = c.adjustment(n).Value != nil
			out = append(out, item)
		}
		// adiantadas: cobradas no mês em que o usuário adiantou, em ordem de parcela
		for n := 1; n <= c.Installments; n++ {
			adv := c.adjustment(n).Advanced
			if adv == nil || adv.Month != month {
				continue
			}
			item := base
			item.CurrentInstallment = n
			item.InstallmentValue = adv.Amount
			item.Advanced = &AdvancedInfo{OriginalMonth: InstallmentMonth(c, n), Discount: adv.Discount, OriginalValue: adv.Amount + adv.Discount}
			out = append(out, item)
		}
	}
	return out
}

func creditTotal(credits []CreditTransaction, month string) int64 {
	var sum int64
	for _, c := range CreditByMonth(credits, month) {
		sum += c.InstallmentValue
	}
	return sum
}

// GetMonthSummary: renda, despesas (com as parcelas do crédito), saldo e por categoria.
func GetMonthSummary(transactions []Transaction, credits []CreditTransaction, month string) MonthSummary {
	var income, direct int64
	byCategory := map[string]int64{}

	for _, t := range TransactionsByMonth(transactions, month) {
		if t.Type == "income" {
			income += t.Amount
		} else {
			direct += t.Amount
			byCategory[t.Category] += t.Amount
		}
	}

	credit := creditTotal(credits, month)
	if credit > 0 {
		byCategory[CreditCategory] += credit
	}

	expense := direct + credit
	var pct float64
	if income != 0 {
		pct = float64(expense) / float64(income) * 100
	}
	return MonthSummary{
		Month: month, TotalIncome: income, TotalExpense: expense, CreditExpense: credit,
		Balance: income - expense, ExpensePercentage: pct, ByCategory: byCategory,
	}
}

func fixedTotal(list []Transaction, month, kind string) int64 {
	var sum int64
	for _, t := range TransactionsByMonth(list, month) {
		if t.Fixed && t.Type == kind {
			sum += t.Amount
		}
	}
	return sum
}

// GetProjection prevê `count` meses a partir de start (inclusive): rendas fixas,
// despesas fixas, parcelas do crédito e despesas extras planejadas.
func GetProjection(transactions []Transaction, credits []CreditTransaction, extras []ExtraExpense, start string, count int) []ProjectionMonth {
	out := make([]ProjectionMonth, 0, count)
	var acc int64
	for i := 0; i < count; i++ {
		month := ChangeMonth(start, i)
		income := fixedTotal(transactions, month, "income")
		fixedExp := fixedTotal(transactions, month, "expense")
		credit := creditTotal(credits, month)
		var extra int64
		for _, e := range extras {
			if e.Month == month {
				extra += e.Amount
			}
		}
		expense := fixedExp + credit + extra
		balance := income - expense
		acc += balance
		out = append(out, ProjectionMonth{
			Month: month, Income: income, Expense: expense, CreditExpense: credit,
			ExtraExpense: extra, Balance: balance, Accumulated: acc,
		})
	}
	return out
}

// Compare junta os resumos dos meses, os totais, a categoria mais cara e o ranking por saldo.
func Compare(transactions []Transaction, credits []CreditTransaction, months []string) Comparison {
	cmp := Comparison{Months: []MonthSummary{}, Ranking: []string{}}
	byCategory := map[string]int64{}

	for _, m := range months {
		s := GetMonthSummary(transactions, credits, m)
		cmp.Months = append(cmp.Months, s)
		cmp.Income += s.TotalIncome
		cmp.Expense += s.TotalExpense
		for c, v := range s.ByCategory {
			byCategory[c] += v
		}
	}
	cmp.Balance = cmp.Income - cmp.Expense

	// categoria mais cara (desempate pelo nome, para o resultado ser estável)
	for c, v := range byCategory {
		if cmp.TopCategory == nil || v > cmp.TopCategory.Value ||
			(v == cmp.TopCategory.Value && c < cmp.TopCategory.Category) {
			cmp.TopCategory = &CategoryTotal{Category: c, Value: v}
		}
	}

	sorted := append([]MonthSummary(nil), cmp.Months...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Balance > sorted[j].Balance })
	for _, s := range sorted {
		cmp.Ranking = append(cmp.Ranking, s.Month)
	}
	return cmp
}
