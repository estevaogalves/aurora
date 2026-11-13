package domain

// Planejamento do usuário (orçamento por categoria, dívidas, fechamento do mês e carteira de dividendos). Valores em
// centavos; meses "AAAA-MM". Só marcas e anotações: nada aqui muda valor, saldo, projeção ou relatório.

// Limites de tamanho (também usados na validação).
const (
	MaxBudgetCategories = 80
	MaxBudgetChanges    = 60
	MaxDebts            = 100
	MaxDebtInstallments = 600
	MaxClosings         = 240
	MaxDividendAssets   = 100
)

// Budgets: categoria -> mês -> limite mensal em centavos. Cada par é uma mudança de limite: o limite de um mês é o
// da última mudança até ele (o limite herda para os meses seguintes até o usuário mudar). 0 = sem limite desde o mês.
type Budgets map[string]map[string]int64

// Debt é uma dívida ou consórcio em parcelas. É independente das despesas fixas: as parcelas são calculadas pelo
// front e aparecem em Lançamentos sozinhas (nada é gravado por mês).
type Debt struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Kind: "debt" ou "consortium". Vazio (cadastros antigos) = dívida comum.
	Kind string `json:"kind,omitempty"`
	// Model: só consórcio, "linear" ou "progressive". Vazio = linear.
	Model string `json:"model,omitempty"`
	// InstallmentValue: valor da parcela (linear) ou da primeira parcela (progressivo), em centavos.
	InstallmentValue int64 `json:"installmentValue"`
	// Increment: acréscimo fixo a cada parcela, em centavos. Só no consórcio progressivo (maior que zero).
	Increment         int64 `json:"increment,omitempty"`
	TotalInstallments int   `json:"totalInstallments"`
	PaidInstallments  int   `json:"paidInstallments"`
	// NextMonth: mês da próxima parcela a pagar. A quitação é NextMonth + (restantes − 1) meses.
	NextMonth string `json:"nextMonth"`
	// TrackedFrom: primeiro mês que aparece em Lançamentos (o que foi pago antes do cadastro não vira lançamento).
	TrackedFrom string `json:"trackedFrom,omitempty"`
	// Payments: pagamento de cada parcela paga pelo app, por mês da parcela.
	Payments map[string]Payment `json:"payments,omitempty"`
	// PaidValues: valor realmente pago em cada parcela paga, por mês da parcela (centavos).
	PaidValues map[string]int64 `json:"paidValues,omitempty"`
	// PrepaidLast: consórcio linear com a última parcela paga antes da hora (junto com uma parcela do mês).
	PrepaidLast *PrepaidLast `json:"prepaidLast,omitempty"`
	Note        string       `json:"note,omitempty"`
	// LinkedTransactionID: OBSOLETO. Modelo antigo, em que a dívida seguia uma despesa fixa. Só é lido para que o front
	// descarte esses cadastros; nunca mais é gravado pelo app.
	LinkedTransactionID string `json:"linkedTransactionId,omitempty"`
}

// PrepaidLast é a última parcela de um consórcio linear paga antes da hora.
type PrepaidLast struct {
	// Value: centavos realmente pagos na última parcela.
	Value   int64   `json:"value"`
	Payment Payment `json:"payment"`
}

// MonthClosing é o retrato de um mês fechado.
type MonthClosing struct {
	// ClosedAt: data do fechamento, "AAAA-MM-DD".
	ClosedAt string `json:"closedAt"`
	Income   int64  `json:"income"`
	Expense  int64  `json:"expense"`
	Balance  int64  `json:"balance"`
	// ByCategory: despesas por categoria no momento do fechamento.
	ByCategory map[string]int64 `json:"byCategory"`
	// Note: anotação de aprendizado do mês.
	Note string `json:"note,omitempty"`
}

// DividendAsset é um ativo da carteira manual de dividendos (sem integração com corretora).
type DividendAsset struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	// Invested: valor investido; MonthlyDividends: proventos recebidos por mês (média). Centavos.
	Invested         int64 `json:"invested"`
	MonthlyDividends int64 `json:"monthlyDividends"`
}

// Planning é o conjunto guardado em user_settings.planning.
type Planning struct {
	Budgets        Budgets                 `json:"budgets"`
	Debts          []Debt                  `json:"debts"`
	Closings       map[string]MonthClosing `json:"closings"`
	DividendAssets []DividendAsset         `json:"dividendAssets"`
}

// Normalize troca nil por vazio, para o JSON nunca sair com null.
func (p *Planning) Normalize() {
	if p.Budgets == nil {
		p.Budgets = Budgets{}
	}
	if p.Debts == nil {
		p.Debts = []Debt{}
	}
	if p.Closings == nil {
		p.Closings = map[string]MonthClosing{}
	}
	if p.DividendAssets == nil {
		p.DividendAssets = []DividendAsset{}
	}
	for k, c := range p.Closings {
		if c.ByCategory == nil {
			c.ByCategory = map[string]int64{}
			p.Closings[k] = c
		}
	}
}
