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
	// Fixas: observação de um mês. A observação é só do mês: Notes vale no mês de criação e não se repete.
	MonthlyNotes map[string]string `json:"monthlyNotes,omitempty"`
	// VariableAmount: fixa de valor variável. Amount é uma estimativa; os meses com valor em MonthlyValues têm o valor real.
	VariableAmount bool `json:"variableAmount,omitempty"`
	// Despesas: pagamento por mês ("2026-11"). Só registro, não entra em conta nenhuma.
	Payments map[string]Payment `json:"payments,omitempty"`
}

type CreditTransaction struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	TotalAmount  int64  `json:"totalAmount"`
	Installments int    `json:"installments"`
	StartMonth   string `json:"startMonth"`
	Category     string `json:"category"`
	// Ajustes por parcela, pela posição ("1" a "N"): valor próprio, excluída ou adiantada.
	Adjustments map[string]InstallmentAdjustment `json:"adjustments,omitempty"`
	// Recorrente (assinatura no cartão): TotalAmount é o valor cobrado todo mês a partir de StartMonth,
	// sem divisão em parcelas. EndMonth é o último mês cobrado, preenchido ao cancelar a recorrência.
	Recurring bool   `json:"recurring,omitempty"`
	EndMonth  string `json:"endMonth,omitempty"`
	// BillingDay: dia do mês da cobrança (1 a 31), escolhido pela data de início. 0 = não informado.
	// Em meses mais curtos a cobrança cai no último dia do mês.
	BillingDay int `json:"billingDay,omitempty"`
	// CardID: cartão da compra. Com cartão, o valor entra no mês do vencimento da fatura (ResolveCredits).
	CardID string `json:"cardId,omitempty"`
	// VariableAmount: recorrente de valor variável. TotalAmount é uma estimativa; o valor real de cada mês
	// fica em Adjustments[n].Value.
	VariableAmount bool `json:"variableAmount,omitempty"`
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
	Adjusted           bool          `json:"adjusted,omitempty"`
	Estimated          bool          `json:"estimated,omitempty"`
	Recurring          bool          `json:"recurring,omitempty"`
	Advanced           *AdvancedInfo `json:"advanced,omitempty"`
}

type ExtraExpense struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Amount int64  `json:"amount"`
	Month  string `json:"month"`
	// Pagamento da despesa (única, pois ela existe em um só mês). Só registro, não entra em conta nenhuma.
	Payment *Payment `json:"payment,omitempty"`
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
	// Porquinho: guardado sem valor de meta obrigatório (Target pode ser 0). Não muda depois de criado.
	Piggy bool `json:"piggy,omitempty"`
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
	CreditCards        []CreditCard        `json:"creditCards"`
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
	if d.CreditCards == nil {
		d.CreditCards = []CreditCard{}
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

// InstallmentAdvance: parcela adiantada, cobrada em Month (o mês de hoje no momento do adiantamento).
type InstallmentAdvance struct {
	Month    string `json:"month"`
	Discount int64  `json:"discount"`
	// Amount é o que foi cobrado em Month (valor da parcela menos o desconto).
	Amount int64 `json:"amount"`
}

// InstallmentAdjustment é o ajuste de uma parcela: valor próprio, excluída ou adiantada.
type InstallmentAdjustment struct {
	Value    *int64              `json:"value,omitempty"`
	Removed  bool                `json:"removed,omitempty"`
	Advanced *InstallmentAdvance `json:"advanced,omitempty"`
}

// AdvancedInfo acompanha a parcela adiantada que cai em um mês.
type AdvancedInfo struct {
	OriginalMonth string `json:"originalMonth"`
	Discount      int64  `json:"discount"`
	OriginalValue int64  `json:"originalValue"`
}
