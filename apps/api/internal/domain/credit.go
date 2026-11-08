package domain

import (
	"fmt"
	"strconv"
)

// Ajustes por parcela de uma compra no crédito. A chave do mapa é a posição ("1" a "N").
// É a versão em Go de apps/web/src/domain/credit.ts: as regras precisam ser as mesmas.

// MaxInstallments é o limite de parcelas de uma compra.
const MaxInstallments = 360

func (c CreditTransaction) adjustment(n int) InstallmentAdjustment {
	return c.Adjustments[strconv.Itoa(n)]
}

func (c CreditTransaction) isOpen(n int) bool {
	if c.Recurring {
		return false
	}
	a := c.adjustment(n)
	return !a.Removed && a.Advanced == nil
}

// InstallmentMonth é o mês original da parcela n (1..N).
func InstallmentMonth(c CreditTransaction, n int) string { return ChangeMonth(c.StartMonth, n-1) }

// InstallmentValue é o valor da parcela n antes de qualquer desconto: o ajustado, ou a divisão do total.
func InstallmentValue(c CreditTransaction, n int) int64 {
	if v := c.adjustment(n).Value; v != nil {
		return *v
	}
	return SplitInstallments(c.TotalAmount, c.Installments)[n-1]
}

// LastOpenInstallment é a última parcela que não foi excluída nem adiantada; 0 se não sobrou nenhuma.
func LastOpenInstallment(c CreditTransaction) int {
	for n := c.Installments; n >= 1; n-- {
		if c.isOpen(n) {
			return n
		}
	}
	return 0
}

// CanAdvance: só a última parcela em aberto, e só se cair depois de today (mês atual, "YYYY-MM").
func CanAdvance(c CreditTransaction, n int, today string) bool {
	return n >= 1 && n == LastOpenInstallment(c) && CompareMonths(InstallmentMonth(c, n), today) > 0
}

// ValidateDiscount: desconto entre zero e o valor da parcela, sem zerar o valor adiantado. "" se válido.
func ValidateDiscount(value, discount int64) string {
	if discount < 0 {
		return "O desconto não pode ser negativo."
	}
	if value-discount <= 0 {
		return "O desconto deve ser menor que o valor da parcela."
	}
	return ""
}

func withAdjustment(c CreditTransaction, n int, a InstallmentAdjustment) map[string]InstallmentAdjustment {
	out := make(map[string]InstallmentAdjustment, len(c.Adjustments)+1)
	for k, v := range c.Adjustments {
		out[k] = v
	}
	out[strconv.Itoa(n)] = a
	return out
}

// AdvanceInstallment adianta a parcela n: o valor com desconto passa a ser cobrado em today.
// Devolve os novos ajustes, ou a mensagem do motivo de não poder.
func AdvanceInstallment(c CreditTransaction, n int, discount int64, today string) (map[string]InstallmentAdjustment, string) {
	if n < 1 || n > c.Installments || n != LastOpenInstallment(c) {
		return nil, "Só a última parcela da compra pode ser adiantada."
	}
	if !CanAdvance(c, n, today) {
		return nil, "Só é possível adiantar parcelas de meses futuros."
	}
	value := InstallmentValue(c, n)
	if msg := ValidateDiscount(value, discount); msg != "" {
		return nil, msg
	}
	a := c.adjustment(n)
	a.Advanced = &InstallmentAdvance{Month: today, Discount: discount, Amount: value - discount}
	return withAdjustment(c, n, a), ""
}

// EditInstallment muda só o valor da parcela n (centavos). Adiantadas e excluídas não mudam.
func EditInstallment(c CreditTransaction, n int, cents int64) (map[string]InstallmentAdjustment, string) {
	if n < 1 || n > c.Installments || !c.isOpen(n) {
		return nil, "Esta parcela não pode ser alterada."
	}
	if cents <= 0 {
		return nil, "Informe um valor maior que zero."
	}
	a := c.adjustment(n)
	a.Value = &cents
	return withAdjustment(c, n, a), ""
}

// RemoveInstallment exclui só a cobrança da parcela n; as outras mantêm número e mês.
func RemoveInstallment(c CreditTransaction, n int) (map[string]InstallmentAdjustment, string) {
	if n < 1 || n > c.Installments || !c.isOpen(n) {
		return nil, "Esta parcela não pode ser excluída."
	}
	a := c.adjustment(n)
	a.Removed = true
	return withAdjustment(c, n, a), ""
}

// ValidateAdjustments confere os ajustes vindos de fora (importação): posições dentro de 1..N,
// valores positivos, e adiantamentos coerentes (mês válido, desconto >= 0, valor adiantado > 0).
func ValidateAdjustments(c CreditTransaction) string {
	for key, a := range c.Adjustments {
		n, err := strconv.Atoi(key)
		if err != nil || n < 1 || n > c.Installments {
			return fmt.Sprintf("Parcela %q fora do intervalo da compra.", key)
		}
		if a.Value != nil && *a.Value <= 0 {
			return "O valor de uma parcela ajustada deve ser maior que zero."
		}
		if a.Advanced != nil {
			adv := a.Advanced
			if !IsValidMonth(adv.Month) || adv.Discount < 0 || adv.Amount <= 0 {
				return "Parcela adiantada inválida."
			}
			if a.Removed {
				return "Uma parcela não pode ser adiantada e excluída ao mesmo tempo."
			}
		}
	}
	return ""
}

// CanChangeInstallments: o número de parcelas só muda enquanto a compra não tem ajustes.
func CanChangeInstallments(c CreditTransaction) bool { return len(c.Adjustments) == 0 }

// CancelRecurrence encerra a recorrência: o último mês cobrado passa a ser `last`, que nunca fica antes
// de `today` nem de StartMonth (o que já foi cobrado fica como está). Devolve o EndMonth, ou a mensagem do motivo.
func CancelRecurrence(c CreditTransaction, last, today string) (string, string) {
	if !c.Recurring {
		return "", "Só compras recorrentes podem ter a recorrência cancelada."
	}
	if c.EndMonth != "" {
		return "", "A recorrência desta compra já foi cancelada."
	}
	if !IsValidMonth(last) {
		return "", "Mês inválido."
	}
	if CompareMonths(last, today) < 0 {
		last = today
	}
	if CompareMonths(last, c.StartMonth) < 0 {
		last = c.StartMonth
	}
	return last, ""
}
