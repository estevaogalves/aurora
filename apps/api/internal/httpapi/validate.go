package httpapi

import (
	"fmt"
	"regexp"
	"strings"

	"aurora/api/internal/domain"
)

const (
	maxName  = 120
	maxNotes = 500
)

var screenRe = regexp.MustCompile(`^[a-z][a-z0-9-]{0,39}$`)

// validateOnboarding confere o pacote de respostas dos tours (importação).
func validateOnboarding(m map[string]string) string {
	if len(m) > 50 {
		return "Telas demais em onboarding."
	}
	for screen, state := range m {
		if !screenRe.MatchString(screen) || (state != "done" && state != "dismissed") {
			return "Onboarding inválido."
		}
	}
	return ""
}

var colorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// Cada validador devolve a mensagem do problema ou "" se está tudo certo.

func checkName(name string) string {
	switch n := len([]rune(strings.TrimSpace(name))); {
	case n == 0:
		return "Informe um nome."
	case n > maxName:
		return "O nome é grande demais."
	}
	return ""
}

func checkMonth(m string) string {
	if !domain.IsValidMonth(m) {
		return "Mês inválido. Use o formato AAAA-MM."
	}
	return ""
}

func checkNotes(n string) string {
	if len([]rune(n)) > maxNotes {
		return "A observação é grande demais."
	}
	return ""
}

func checkAmount(v int64) string {
	if v < 0 {
		return "O valor não pode ser negativo."
	}
	return ""
}

func first(msgs ...string) string {
	for _, m := range msgs {
		if m != "" {
			return m
		}
	}
	return ""
}

func checkMonthMap(hidden []string, values map[string]int64, maxEntries int) string {
	if len(hidden)+len(values) > maxEntries {
		return fmt.Sprintf("Meses ajustados demais em uma despesa fixa (máximo %d).", maxEntries)
	}
	for _, m := range hidden {
		if msg := checkMonth(m); msg != "" {
			return msg
		}
	}
	for m, v := range values {
		if msg := first(checkMonth(m), checkAmount(v)); msg != "" {
			return msg
		}
	}
	return ""
}

func (l Limits) validateTransaction(t domain.Transaction) string {
	if t.Type != "income" && t.Type != "expense" {
		return "O tipo deve ser income ou expense."
	}
	if len(t.Payments) > l.MonthOverrides {
		return "Pagamentos demais em um lançamento."
	}
	return first(checkName(t.Name), checkAmount(t.Amount), checkMonth(t.Month), checkNotes(t.Notes),
		checkCategory(t.Category), checkMonthMap(t.HiddenMonths, t.MonthlyValues, l.MonthOverrides), checkPayments(t))
}

func checkCategory(c string) string {
	if strings.TrimSpace(c) == "" {
		return "Informe a categoria."
	}
	if len([]rune(c)) > 60 {
		return "O nome da categoria é grande demais."
	}
	return ""
}

func validateCredit(c domain.CreditTransaction) string {
	if c.Recurring {
		// sem parcelas: o valor mensal fica em TotalAmount e o fim, se houver, em EndMonth
		if c.Installments != 1 {
			return "Compra recorrente não tem parcelas."
		}
		if len(c.Adjustments) > 0 {
			return "Compra recorrente não tem ajustes de parcela."
		}
		if c.EndMonth != "" {
			if m := checkMonth(c.EndMonth); m != "" || domain.CompareMonths(c.EndMonth, c.StartMonth) < 0 {
				return "O mês final da recorrência é inválido."
			}
		}
	} else if c.EndMonth != "" {
		return "Só compras recorrentes têm mês final."
	}
	if c.Installments < 1 || c.Installments > 360 {
		return "O número de parcelas deve ficar entre 1 e 360."
	}
	msg := first(checkName(c.Name), checkAmount(c.TotalAmount), checkMonth(c.StartMonth), checkCategory(c.Category))
	if msg != "" {
		return msg
	}
	for _, a := range c.Adjustments {
		if a.Value != nil {
			msg = first(msg, checkAmount(*a.Value))
		}
		if a.Advanced != nil {
			msg = first(msg, checkAmount(a.Advanced.Discount), checkAmount(a.Advanced.Amount))
		}
	}
	return first(msg, domain.ValidateAdjustments(c))
}

func validateGoal(g domain.Goal) string {
	// meta comum precisa de um valor-alvo; o porquinho pode ficar sem
	if !g.Piggy && g.Target <= 0 {
		return "Informe o valor da meta."
	}
	msg := first(checkName(g.Name), checkAmount(g.Target), checkAmount(g.Saved), checkAmount(g.Monthly))
	if msg == "" && g.Deadline != nil {
		msg = checkMonth(*g.Deadline)
	}
	return msg
}

// checkPayment confere a forma, a data e o tamanho da observação de um pagamento.
func checkPayment(p domain.Payment) string {
	return first(domain.ValidatePayment(p), checkNotes(p.Notes))
}

func validateExtra(e domain.ExtraExpense) string {
	msg := first(checkName(e.Name), checkAmount(e.Amount), checkMonth(e.Month))
	if e.Payment != nil {
		msg = first(msg, checkPayment(*e.Payment))
	}
	return msg
}

// checkPayments confere os pagamentos por mês de uma despesa (importação).
func checkPayments(t domain.Transaction) string {
	if len(t.Payments) > 0 && t.Type != "expense" {
		return "Só despesas têm pagamento."
	}
	for m, p := range t.Payments {
		if msg := first(checkMonth(m), checkPayment(p)); msg != "" {
			return msg
		}
	}
	return ""
}

func validateNote(n domain.Note) string {
	if strings.TrimSpace(n.Content) == "" {
		return "A anotação não pode ficar vazia."
	}
	if len([]rune(n.Content)) > 2000 {
		return "A anotação é grande demais."
	}
	return checkMonth(n.Month)
}

func validateCategoryInput(c domain.CustomCategory) string {
	if !colorRe.MatchString(c.Color) {
		return "A cor deve ser um hexadecimal no formato #RRGGBB."
	}
	return first(checkName(c.Name), checkCategory(c.Name))
}

// validateData confere um pacote completo (importação).
func (l Limits) validateData(d domain.FinanceData) string {
	// tetos de volume antes de qualquer validação item a item
	for _, c := range []struct {
		name   string
		n, max int
	}{
		{"lançamentos", len(d.Transactions), l.ImportItems},
		{"compras no crédito", len(d.CreditTransactions), l.ImportItems},
		{"anotações", len(d.Notes), l.ImportItems},
		{"metas", len(d.Goals), l.ImportItems},
		{"despesas extras", len(d.ExtraExpenses), l.ImportItems},
		{"categorias próprias", len(d.CustomCategories), l.CustomCategories},
		{"itens da distribuição", len(d.Distribution), l.DistributionItems},
		{"avisos vistos", len(d.SeenAlerts), l.SeenAlerts},
	} {
		if c.n > c.max {
			return fmt.Sprintf("Importação grande demais: %d %s (máximo %d).", c.n, c.name, c.max)
		}
	}

	for _, t := range d.Transactions {
		if m := l.validateTransaction(t); m != "" {
			return "Lançamento " + quote(t.Name) + ": " + m
		}
	}
	for _, c := range d.CreditTransactions {
		if m := validateCredit(c); m != "" {
			return "Crédito " + quote(c.Name) + ": " + m
		}
	}
	for _, n := range d.Notes {
		if m := validateNote(n); m != "" {
			return "Anotação: " + m
		}
	}
	for _, g := range d.Goals {
		if m := validateGoal(g); m != "" {
			return "Meta " + quote(g.Name) + ": " + m
		}
	}
	for _, e := range d.ExtraExpenses {
		if m := validateExtra(e); m != "" {
			return "Despesa extra " + quote(e.Name) + ": " + m
		}
	}
	seen := map[string]bool{}
	for _, c := range d.CustomCategories {
		if m := validateCategoryInput(c); m != "" {
			return "Categoria " + quote(c.Name) + ": " + m
		}
		key := strings.ToLower(strings.TrimSpace(c.Name))
		if seen[key] {
			return "Categoria " + quote(c.Name) + ": nome repetido."
		}
		seen[key] = true
	}
	if d.Distribution != nil {
		if m := domain.ValidateDistribution(d.Distribution); m != "" {
			return m
		}
	}
	return validateOnboarding(d.Onboarding)
}

func quote(s string) string { return "\"" + strings.TrimSpace(s) + "\"" }
