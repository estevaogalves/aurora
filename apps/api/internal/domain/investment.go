package domain

import (
	"math"
	"sort"
	"time"
)

// Famílias de investimento aceitas (as mesmas do front).
var investmentFamilies = map[string]bool{"fixed": true, "treasury": true, "liquid": true, "equity": true, "fund": true, "other": true}

// Tipos de movimentação: aporte e resgate mexem no dinheiro que entra e sai; rendimento soma ao valor atual
// sem ser aporte; ajuste define o novo valor atual (Amount é o valor, não a diferença).
const (
	MovementContribution = "contribution"
	MovementRedemption   = "redemption"
	MovementYield        = "yield"
	MovementAdjustment   = "adjustment"
)

// MaxInvestmentCents é o maior valor aceito num campo de dinheiro de investimento: R$ 1 bilhão.
const MaxInvestmentCents int64 = 100_000_000_000

// Investment é um investimento registrado à mão. Fica separado do fluxo de caixa: não entra em receitas,
// despesas nem saldo. Valores em centavos; datas "AAAA-MM-DD".
type Investment struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Family      string `json:"family"`
	Product     string `json:"product,omitempty"`
	Institution string `json:"institution"`
	AppliedAt   string `json:"appliedAt"`
	// CurrentValue: quanto vale hoje. Refeito por ReplayInvestment a cada movimentação.
	CurrentValue int64  `json:"currentValue"`
	MaturityDate string `json:"maturityDate,omitempty"`
	Indexer      string `json:"indexer,omitempty"`
	Rate         string `json:"rate,omitempty"`
	Liquidity    string `json:"liquidity,omitempty"`
	GraceUntil   string `json:"graceUntil,omitempty"`
	EarlyRedeem  bool   `json:"earlyRedeem,omitempty"`
	// Quantity (cotas, fracionário) e AvgPrice (centavos por cota) só existem em quem controla quantidade.
	Quantity   *float64 `json:"quantity,omitempty"`
	AvgPrice   *int64   `json:"avgPrice,omitempty"`
	RedeemDays int      `json:"redeemDays,omitempty"`
	Ticker     string   `json:"ticker,omitempty"`
	Fees       string   `json:"fees,omitempty"`
	Notes      string   `json:"notes,omitempty"`
}

// InvestmentMovement é uma movimentação datada de um investimento.
type InvestmentMovement struct {
	ID           string `json:"id"`
	InvestmentID string `json:"investmentId"`
	Type         string `json:"type"`
	Date         string `json:"date"`
	// Amount: valor total da movimentação, em centavos.
	Amount int64 `json:"amount"`
	// Quantity e UnitPrice: cotas e preço por cota (centavos), quando o investimento controla quantidade.
	Quantity  *float64 `json:"quantity,omitempty"`
	UnitPrice *int64   `json:"unitPrice,omitempty"`
	// Note: observação livre. Origin: vazio = lançado à mão; "distribution|AAAA-MM|fonte|fatia" = enviado pela
	// sugestão do saldo (veja ValidOrigin).
	Note   string `json:"note,omitempty"`
	Origin string `json:"origin,omitempty"`
}

// IsInvestmentFamily diz se f é uma família conhecida.
func IsInvestmentFamily(f string) bool { return investmentFamilies[f] }

// IsMovementType diz se t é um tipo de movimentação conhecido.
func IsMovementType(t string) bool {
	switch t {
	case MovementContribution, MovementRedemption, MovementYield, MovementAdjustment:
		return true
	}
	return false
}

// IsValidDate confere uma data "AAAA-MM-DD" real (nada de 2026-02-30).
func IsValidDate(s string) bool {
	if len(s) != 10 {
		return false
	}
	_, err := time.Parse("2006-01-02", s)
	return err == nil
}

// jsRound arredonda como o Math.round do JavaScript (metade para cima), para a regra bater com a do front.
func jsRound(x float64) float64 { return math.Floor(x + 0.5) }

// SortMovements devolve as movimentações em ordem cronológica. Na mesma data, a registrada primeiro vem antes.
func SortMovements(movements []InvestmentMovement) []InvestmentMovement {
	out := append([]InvestmentMovement(nil), movements...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Date < out[j].Date })
	return out
}

// ReplayInvestment recalcula valor atual, cotas e preço médio refazendo as movimentações do investimento em
// ordem de data. É a versão em Go de replayInvestment (apps/web/src/domain/investments.ts) e as duas têm que
// dar o mesmo resultado. O valor nunca fica negativo. Cotas e preço médio só mudam se alguma movimentação
// trouxer quantidade; sem isso, os valores que o investimento já tinha ficam como estão.
func ReplayInvestment(inv Investment, movements []InvestmentMovement) Investment {
	var own []InvestmentMovement
	for _, m := range movements {
		if m.InvestmentID == inv.ID {
			own = append(own, m)
		}
	}

	var value int64
	var qty, cost float64
	hasQty := false

	for _, m := range SortMovements(own) {
		q := 0.0
		if m.Quantity != nil {
			q = *m.Quantity
		}
		switch m.Type {
		case MovementContribution:
			value += m.Amount
			if q != 0 {
				hasQty = true
				qty += q
				if m.UnitPrice != nil && *m.UnitPrice != 0 {
					cost += q * float64(*m.UnitPrice)
				} else {
					cost += float64(m.Amount)
				}
			}
		case MovementRedemption:
			value -= m.Amount
			if value < 0 {
				value = 0
			}
			if q != 0 {
				hasQty = true
				left := math.Max(0, qty-q)
				if qty > 0 {
					cost *= left / qty
				} else {
					cost = 0
				}
				qty = left
			}
		case MovementYield:
			value += m.Amount
		default: // ajuste: define o valor atual
			value = m.Amount
		}
	}

	next := inv
	if value < 0 {
		value = 0
	}
	next.CurrentValue = value
	if hasQty {
		next.Quantity = &qty
		if qty > 0 {
			avg := int64(jsRound(cost / qty))
			next.AvgPrice = &avg
		} else {
			next.AvgPrice = nil
		}
	}
	return next
}

// InvestmentTotals são os totais de um investimento, calculados a partir das movimentações.
type InvestmentTotals struct {
	Contributed int64
	Redeemed    int64
	// Profit: valor atual + resgates − aportes.
	Profit int64
}

// GetInvestmentTotals soma aportes e resgates de um investimento e calcula o lucro (ou prejuízo).
func GetInvestmentTotals(inv Investment, movements []InvestmentMovement) InvestmentTotals {
	var t InvestmentTotals
	for _, m := range movements {
		if m.InvestmentID != inv.ID {
			continue
		}
		switch m.Type {
		case MovementContribution:
			t.Contributed += m.Amount
		case MovementRedemption:
			t.Redeemed += m.Amount
		}
	}
	t.Profit = inv.CurrentValue + t.Redeemed - t.Contributed
	return t
}
