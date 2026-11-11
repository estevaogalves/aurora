package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"aurora/api/internal/domain"
	"aurora/api/internal/store"
)

// Investimentos ficam à parte do fluxo de caixa: nada aqui mexe em receitas, despesas, saldo ou relatórios.

// nullable lê um campo opcional de um PATCH: ausente (set=false, não muda), null (set=true, v=nil, limpa)
// ou valor. ok=false se não for do tipo esperado.
func nullable[T any](raw json.RawMessage) (set bool, v *T, ok bool) {
	if raw == nil {
		return false, nil, true
	}
	if string(raw) == "null" {
		return true, nil, true
	}
	var x T
	if err := json.Unmarshal(raw, &x); err != nil {
		return true, nil, false
	}
	return true, &x, true
}

func (s *Server) createInvestment(w http.ResponseWriter, r *http.Request) {
	var in domain.Investment
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	in.Institution = strings.TrimSpace(in.Institution)
	if bad(w, validateInvestment(in)) {
		return
	}
	out, err := s.store.CreateInvestment(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type investmentPatchReq struct {
	Name         *string `json:"name"`
	Family       *string `json:"family"`
	Product      *string `json:"product"`
	Institution  *string `json:"institution"`
	AppliedAt    *string `json:"appliedAt"`
	CurrentValue *int64  `json:"currentValue"`
	MaturityDate *string `json:"maturityDate"`
	Indexer      *string `json:"indexer"`
	Rate         *string `json:"rate"`
	Liquidity    *string `json:"liquidity"`
	GraceUntil   *string `json:"graceUntil"`
	EarlyRedeem  *bool   `json:"earlyRedeem"`
	RedeemDays   *int    `json:"redeemDays"`
	Ticker       *string `json:"ticker"`
	Fees         *string `json:"fees"`
	Notes        *string `json:"notes"`
	// RawMessage distingue "não veio" (não muda) de "veio null" (limpa).
	Quantity json.RawMessage `json:"quantity"`
	AvgPrice json.RawMessage `json:"avgPrice"`
}

func (s *Server) updateInvestment(w http.ResponseWriter, r *http.Request) {
	var in investmentPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	patch := store.InvestmentPatch{
		Name: trimmed(in.Name), Family: in.Family, Product: in.Product, Institution: trimmed(in.Institution),
		AppliedAt: in.AppliedAt, CurrentValue: in.CurrentValue, MaturityDate: in.MaturityDate, Indexer: in.Indexer,
		Rate: in.Rate, Liquidity: in.Liquidity, GraceUntil: in.GraceUntil, EarlyRedeem: in.EarlyRedeem,
		RedeemDays: in.RedeemDays, Ticker: in.Ticker, Fees: in.Fees, Notes: in.Notes,
	}

	msg := ""
	if in.Name != nil {
		msg = first(msg, checkName(*in.Name))
	}
	if in.Institution != nil {
		msg = first(msg, checkName(*in.Institution))
	}
	if in.Family != nil {
		msg = first(msg, checkFamily(*in.Family))
	}
	if in.AppliedAt != nil {
		msg = first(msg, checkDate("Data da aplicação", *in.AppliedAt, false))
	}
	if in.MaturityDate != nil {
		msg = first(msg, checkDate("Vencimento", *in.MaturityDate, true))
	}
	if in.GraceUntil != nil {
		msg = first(msg, checkDate("Carência", *in.GraceUntil, true))
	}
	if in.CurrentValue != nil {
		msg = first(msg, checkInvestmentCents("O valor atual", *in.CurrentValue))
	}
	if in.RedeemDays != nil {
		msg = first(msg, checkRedeemDays(*in.RedeemDays))
	}
	for _, t := range []struct {
		label string
		v     *string
		max   int
	}{{"Produto", in.Product, 60}, {"Indexador", in.Indexer, 40}, {"Taxa", in.Rate, 80}, {"Liquidez", in.Liquidity, 80},
		{"Código do ativo", in.Ticker, 40}, {"A observação", in.Fees, maxNotes}, {"A observação", in.Notes, maxNotes}} {
		if t.v != nil {
			msg = first(msg, checkText(t.label, *t.v, t.max))
		}
	}

	var ok bool
	patch.SetQuantity, patch.Quantity, ok = nullable[float64](in.Quantity)
	if !ok {
		msg = first(msg, "A quantidade de cotas é inválida.")
	}
	msg = first(msg, checkQuantity(patch.Quantity))
	patch.SetAvgPrice, patch.AvgPrice, ok = nullable[int64](in.AvgPrice)
	if !ok {
		msg = first(msg, "O preço médio é inválido.")
	}
	msg = first(msg, checkOptionalCents("O preço médio", patch.AvgPrice))
	if bad(w, msg) {
		return
	}

	out, err := s.store.UpdateInvestment(r.Context(), userID(r), chi.URLParam(r, "id"), patch)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteInvestment(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteInvestment(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- movimentações ---------- */

// investmentMovementResult: a movimentação e o investimento já refeito (valor atual, cotas e preço médio).
type investmentMovementResult struct {
	Movement   *domain.InvestmentMovement `json:"movement,omitempty"`
	Investment domain.Investment          `json:"investment"`
}

func (s *Server) createInvestmentMovement(w http.ResponseWriter, r *http.Request) {
	var in domain.InvestmentMovement
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, validateMovement(in)) {
		return
	}
	m, inv, err := s.store.CreateInvestmentMovement(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, investmentMovementResult{Movement: &m, Investment: inv})
}

type movementPatchReq struct {
	Type   *string `json:"type"`
	Date   *string `json:"date"`
	Amount *int64  `json:"amount"`
	// RawMessage distingue "não veio" (não muda) de "veio null" (limpa).
	Quantity  json.RawMessage `json:"quantity"`
	UnitPrice json.RawMessage `json:"unitPrice"`
}

func (s *Server) updateInvestmentMovement(w http.ResponseWriter, r *http.Request) {
	var in movementPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	patch := store.MovementPatch{Type: in.Type, Date: in.Date, Amount: in.Amount}

	msg := ""
	if in.Type != nil {
		msg = first(msg, checkMovementType(*in.Type))
	}
	if in.Date != nil {
		msg = first(msg, checkDate("Data", *in.Date, false))
	}
	if in.Amount != nil {
		msg = first(msg, checkInvestmentCents("O valor", *in.Amount))
	}
	var ok bool
	patch.SetQuantity, patch.Quantity, ok = nullable[float64](in.Quantity)
	if !ok {
		msg = first(msg, "A quantidade de cotas é inválida.")
	}
	msg = first(msg, checkQuantity(patch.Quantity))
	patch.SetUnitPrice, patch.UnitPrice, ok = nullable[int64](in.UnitPrice)
	if !ok {
		msg = first(msg, "O preço por cota é inválido.")
	}
	msg = first(msg, checkOptionalCents("O preço por cota", patch.UnitPrice))
	if bad(w, msg) {
		return
	}

	m, inv, err := s.store.UpdateInvestmentMovement(r.Context(), userID(r), chi.URLParam(r, "id"), patch)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, investmentMovementResult{Movement: &m, Investment: inv})
}

func (s *Server) deleteInvestmentMovement(w http.ResponseWriter, r *http.Request) {
	inv, err := s.store.DeleteInvestmentMovement(r.Context(), userID(r), chi.URLParam(r, "id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, investmentMovementResult{Investment: inv})
}
