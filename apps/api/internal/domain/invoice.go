package domain

import (
	"fmt"
	"time"
)

// Fatura do cartão de crédito. É a versão em Go de apps/web/src/domain/invoice.ts: as regras precisam ser as mesmas.

// CreditCard guarda só o nome e os dias de fechamento e vencimento (1 a 31). Nada sensível.
type CreditCard struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ClosingDay int    `json:"closingDay"`
	DueDay     int    `json:"dueDay"`
}

// Invoice é a fatura em que uma cobrança cai. Datas "YYYY-MM-DD". Month é o mês do vencimento,
// em que o valor é contabilizado.
type Invoice struct {
	ClosingDate string `json:"closingDate"`
	DueDate     string `json:"dueDate"`
	Month       string `json:"month"`
}

// ChargeDate é "YYYY-MM-DD" da cobrança em `month`: o dia escolhido, ou o último dia do mês quando ele é mais curto.
func ChargeDate(day int, month string) string {
	y, m := parseMonth(month)
	last := time.Date(y, time.Month(m)+1, 0, 0, 0, 0, 0, time.UTC).Day()
	if day > last {
		day = last
	}
	return fmt.Sprintf("%s-%02d", month, day)
}

// GetInvoice devolve a fatura de uma compra feita em purchaseDate ("YYYY-MM-DD"):
// dia da compra maior que o fechamento fecha no mês seguinte, senão no mês da compra; vence no próximo
// dia de vencimento depois do fechamento (vencimento <= fechamento: mês seguinte). `installment` (1 = primeira)
// empurra a fatura um mês por parcela.
func GetInvoice(card CreditCard, purchaseDate string, installment int) Invoice {
	if installment < 1 {
		installment = 1
	}
	purchaseMonth := purchaseDate[:7]
	var day int
	fmt.Sscanf(purchaseDate[8:10], "%d", &day)
	closingThisMonth := 0
	var closing int
	fmt.Sscanf(ChargeDate(card.ClosingDay, purchaseMonth)[8:10], "%d", &closing)
	if day > closing {
		closingThisMonth = 1
	}
	closingMonth := ChangeMonth(purchaseMonth, closingThisMonth+installment-1)
	dueMonth := closingMonth
	if card.DueDay <= card.ClosingDay {
		dueMonth = ChangeMonth(closingMonth, 1)
	}
	return Invoice{
		ClosingDate: ChargeDate(card.ClosingDay, closingMonth),
		DueDate:     ChargeDate(card.DueDay, dueMonth),
		Month:       dueMonth,
	}
}

// ResolveCredits desloca StartMonth (e EndMonth) das compras com cartão para o mês do vencimento da fatura.
// Sem cartão, ou sem dia de cobrança, ficam como estão. Não altera a lista recebida.
func ResolveCredits(credits []CreditTransaction, cards []CreditCard) []CreditTransaction {
	if len(cards) == 0 {
		return credits
	}
	byID := make(map[string]CreditCard, len(cards))
	for _, k := range cards {
		byID[k.ID] = k
	}
	out := make([]CreditTransaction, len(credits))
	for i, c := range credits {
		out[i] = c
		card, ok := byID[c.CardID]
		if c.CardID == "" || !ok || c.BillingDay == 0 {
			continue
		}
		first := GetInvoice(card, ChargeDate(c.BillingDay, c.StartMonth), 1).Month
		if first == c.StartMonth {
			continue
		}
		shift := MonthsDifference(first, c.StartMonth)
		out[i].StartMonth = first
		if c.EndMonth != "" {
			out[i].EndMonth = ChangeMonth(c.EndMonth, shift)
		}
	}
	return out
}
