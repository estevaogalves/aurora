// Package domain é a lógica financeira pura (sem banco, sem HTTP).
// É a versão em Go de apps/web/src/domain. Todo dinheiro é em CENTAVOS (int64).
package domain

// Transaction é uma renda ou despesa. Fixas repetem todo mês a partir de Month.
type Transaction struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Amount   int64  `json:"amount"`
	Type     string `json:"type"` // "income" | "expense"
	Category string `json:"category"`
	Notes    string `json:"notes,omitempty"`
	Fixed    bool   `json:"fixed,omitempty"`
	Month    string `json:"month"`
	// Fixas: meses ocultados e valores específicos de um mês.
	HiddenMonths  []string         `json:"hiddenMonths,omitempty"`
	MonthlyValues map[string]int64 `json:"monthlyValues,omitempty"`
}

type CreditTransaction struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	TotalAmount  int64  `json:"totalAmount"`
	Installments int    `json:"installments"`
	StartMonth   string `json:"startMonth"`
	Category     string `json:"category"`
}

type Note struct {
	ID      string `json:"id"`
	Content string `json:"content"`
	Date    string `json:"date"`
	Pinned  bool   `json:"pinned"`
	Month   string `json:"month"`
}

type CreditInstallment struct {
	ID                 string `json:"id"`
	Name               string `json:"name"`
	Category           string `json:"category"`
	Installments       int    `json:"installments"`
	CurrentInstallment int    `json:"currentInstallment"`
	InstallmentValue   int64  `json:"installmentValue"`
	TotalAmount        int64  `json:"totalAmount"`
}

type ExtraExpense struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Amount int64  `json:"amount"`
	Month  string `json:"month"`
}

type CustomCategory struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"`
}

type Goal struct {
	ID         string  `json:"id"`
	Name       string  `json:"name"`
	Target     int64   `json:"target"`
	Saved      int64   `json:"saved"`
	Monthly    int64   `json:"monthly"`
	Deadline   *string `json:"deadline"`
	YieldTotal int64   `json:"yieldTotal,omitempty"`
}

type DistributionItem struct {
	ID      string `json:"id"`
	Label   string `json:"label"`
	Percent int    `json:"percent"`
	Custom  bool   `json:"custom,omitempty"`
}

// FinanceData é tudo o que o app guarda; é o mesmo formato do front.
type FinanceData struct {
	Transactions       []Transaction       `json:"transactions"`
	CreditTransactions []CreditTransaction `json:"creditTransactions"`
	Notes              []Note              `json:"notes"`
	Goals              []Goal              `json:"goals"`
	ExtraExpenses      []ExtraExpense      `json:"extraExpenses"`
	CustomCategories   []CustomCategory    `json:"customCategories"`
	Distribution       []DistributionItem  `json:"distribution"`
	SeenAlerts         []string            `json:"seenAlerts"`
	// Resposta ao tour de cada tela: "done" (viu até o fim) ou "dismissed" (recusou, fechou ou pulou).
	Onboarding map[string]string `json:"onboarding"`
}

// Normalize troca listas nil por vazias, para o JSON nunca sair com null.
func (d *FinanceData) Normalize() {
	if d.Transactions == nil {
		d.Transactions = []Transaction{}
	}
	if d.CreditTransactions == nil {
		d.CreditTransactions = []CreditTransaction{}
	}
	if d.Notes == nil {
		d.Notes = []Note{}
	}
	if d.Goals == nil {
		d.Goals = []Goal{}
	}
	if d.ExtraExpenses == nil {
		d.ExtraExpenses = []ExtraExpense{}
	}
	if d.CustomCategories == nil {
		d.CustomCategories = []CustomCategory{}
	}
	if d.SeenAlerts == nil {
		d.SeenAlerts = []string{}
	}
	if d.Onboarding == nil {
		d.Onboarding = map[string]string{}
	}
}

type MonthSummary struct {
	Month             string           `json:"month"`
	TotalIncome       int64            `json:"totalIncome"`
	TotalExpense      int64            `json:"totalExpense"`
	CreditExpense     int64            `json:"creditExpense"`
	Balance           int64            `json:"balance"`
	ExpensePercentage float64          `json:"expensePercentage"`
	ByCategory        map[string]int64 `json:"byCategory"`
}

type ProjectionMonth struct {
	Month         string `json:"month"`
	Income        int64  `json:"income"`
	Expense       int64  `json:"expense"`
	CreditExpense int64  `json:"creditExpense"`
	ExtraExpense  int64  `json:"extraExpense"`
	Balance       int64  `json:"balance"`
	Accumulated   int64  `json:"accumulated"`
}

type CategoryTotal struct {
	Category string `json:"category"`
	Value    int64  `json:"value"`
}

// Comparison compara vários meses lado a lado.
type Comparison struct {
	Months      []MonthSummary `json:"months"`
	Income      int64          `json:"income"`
	Expense     int64          `json:"expense"`
	Balance     int64          `json:"balance"`
	TopCategory *CategoryTotal `json:"topCategory"`
	// Ranking: meses do melhor para o pior saldo.
	Ranking []string `json:"ranking"`
}
