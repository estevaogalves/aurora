package domain

import "time"

// Pagamento de uma despesa: só registro para consulta e relatórios. Não entra em nenhuma conta
// (saldo, resumo, projeção, comparação). É a versão em Go de apps/web/src/domain/payment.ts.

// PaymentMethods são as formas aceitas.
var PaymentMethods = map[string]bool{"pix": true, "debit": true, "credit": true, "boleto": true}

// Payment é o pagamento de uma despesa: a forma, o dia ("YYYY-MM-DD") e uma observação opcional.
type Payment struct {
	Method string `json:"method"`
	Date   string `json:"date"`
	Notes  string `json:"notes,omitempty"`
}

// ValidatePayment confere a forma e a data. "" se válido (o tamanho da observação é checado na borda HTTP).
func ValidatePayment(p Payment) string {
	if !PaymentMethods[p.Method] {
		return "Forma de pagamento inválida."
	}
	day, err := time.Parse("2006-01-02", p.Date)
	if err != nil {
		return "Data do pagamento inválida. Use o formato AAAA-MM-DD."
	}
	// só boleto pode ter data futura (pagamento agendado, compensado em dia útil); um dia de folga para o fuso do usuário
	if p.Method != "boleto" && day.After(time.Now().UTC().AddDate(0, 0, 1)) {
		return "Só boleto pode ter data futura (pagamento agendado)."
	}
	return ""
}
