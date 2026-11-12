package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"aurora/api/internal/domain"
	"aurora/api/internal/store"
)

// Histórico de metas e porquinhos: cada movimentação refaz o guardado da meta no servidor (domain.ReplayGoal),
// como as movimentações de investimento. Nada aqui mexe em receitas, despesas, saldo ou relatórios.

// goalMovementResult: a movimentação e a meta já refeita (guardado e total de rendimentos).
type goalMovementResult struct {
	Movement *domain.GoalMovement `json:"movement,omitempty"`
	Goal     domain.Goal          `json:"goal"`
}

func (s *Server) createGoalMovement(w http.ResponseWriter, r *http.Request) {
	var in domain.GoalMovement
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, validateGoalMovement(in)) {
		return
	}
	m, g, err := s.store.CreateGoalMovement(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, goalMovementResult{Movement: &m, Goal: g})
}

type goalMovementPatchReq struct {
	Type   *string `json:"type"`
	Date   *string `json:"date"`
	Amount *int64  `json:"amount"`
	Note   *string `json:"note"`
	Origin *string `json:"origin"`
}

func (s *Server) updateGoalMovement(w http.ResponseWriter, r *http.Request) {
	var in goalMovementPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	msg := ""
	if in.Type != nil {
		msg = first(msg, checkGoalMovementType(*in.Type))
	}
	if in.Date != nil {
		msg = first(msg, checkDate("Data", *in.Date, false))
	}
	if in.Amount != nil {
		msg = first(msg, checkInvestmentCents("O valor", *in.Amount))
	}
	if in.Note != nil {
		msg = first(msg, checkMovementNote(*in.Note))
	}
	if in.Origin != nil {
		msg = first(msg, checkOrigin(*in.Origin))
	}
	if bad(w, msg) {
		return
	}
	m, g, err := s.store.UpdateGoalMovement(r.Context(), userID(r), chi.URLParam(r, "id"),
		store.GoalMovementPatch{Type: in.Type, Date: in.Date, Amount: in.Amount, Note: in.Note, Origin: in.Origin})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, goalMovementResult{Movement: &m, Goal: g})
}

func (s *Server) deleteGoalMovement(w http.ResponseWriter, r *http.Request) {
	g, err := s.store.DeleteGoalMovement(r.Context(), userID(r), chi.URLParam(r, "id"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, goalMovementResult{Goal: g})
}
