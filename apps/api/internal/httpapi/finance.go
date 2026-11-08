package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"aurora/api/internal/domain"
	"aurora/api/internal/store"
)

// bad responde 400 com a mensagem e devolve true (para usar em `if bad(w, msg) { return }`).
func bad(w http.ResponseWriter, msg string) bool {
	if msg == "" {
		return false
	}
	writeError(w, http.StatusBadRequest, msg)
	return true
}

func trimmed(p *string) *string {
	if p == nil {
		return nil
	}
	v := strings.TrimSpace(*p)
	return &v
}

/* ---------- transações ---------- */

func (s *Server) createTransaction(w http.ResponseWriter, r *http.Request) {
	var in domain.Transaction
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if !in.Fixed {
		in.HiddenMonths, in.MonthlyValues = nil, nil
	}
	if bad(w, s.lim.validateTransaction(in)) {
		return
	}
	out, err := s.store.CreateTransaction(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type transactionPatchReq struct {
	Name          *string           `json:"name"`
	Amount        *int64            `json:"amount"`
	Category      *string           `json:"category"`
	Notes         *string           `json:"notes"`
	Fixed         *bool             `json:"fixed"`
	HiddenMonths  *[]string         `json:"hiddenMonths"`
	MonthlyValues *map[string]int64 `json:"monthlyValues"`
}

func (s *Server) updateTransaction(w http.ResponseWriter, r *http.Request) {
	var in transactionPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	msg := ""
	if in.Name != nil {
		msg = first(msg, checkName(*in.Name))
	}
	if in.Amount != nil {
		msg = first(msg, checkAmount(*in.Amount))
	}
	if in.Category != nil {
		msg = first(msg, checkCategory(*in.Category))
	}
	if in.Notes != nil {
		msg = first(msg, checkNotes(*in.Notes))
	}
	var hidden []string
	var values map[string]int64
	if in.HiddenMonths != nil {
		hidden = *in.HiddenMonths
	}
	if in.MonthlyValues != nil {
		values = *in.MonthlyValues
	}
	if bad(w, first(msg, checkMonthMap(hidden, values, s.lim.MonthOverrides))) {
		return
	}

	out, err := s.store.UpdateTransaction(r.Context(), userID(r), chi.URLParam(r, "id"), store.TransactionPatch{
		Name: trimmed(in.Name), Amount: in.Amount, Category: in.Category, Notes: in.Notes, Fixed: in.Fixed,
		HiddenMonths: in.HiddenMonths, MonthlyValues: in.MonthlyValues,
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteTransaction(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteTransaction(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- pagamentos (só registro; não mudam nenhum valor) ---------- */

func (s *Server) setTransactionPayment(w http.ResponseWriter, r *http.Request) {
	var in domain.Payment
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	month := chi.URLParam(r, "month")
	if bad(w, first(checkMonth(month), checkPayment(in))) {
		return
	}
	s.respondTransactionPayment(w, r, month, &in)
}

func (s *Server) clearTransactionPayment(w http.ResponseWriter, r *http.Request) {
	month := chi.URLParam(r, "month")
	if bad(w, checkMonth(month)) {
		return
	}
	s.respondTransactionPayment(w, r, month, nil)
}

func (s *Server) respondTransactionPayment(w http.ResponseWriter, r *http.Request, month string, p *domain.Payment) {
	out, err := s.store.SetTransactionPayment(r.Context(), userID(r), chi.URLParam(r, "id"), month, p)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) setExtraPayment(w http.ResponseWriter, r *http.Request) {
	var in domain.Payment
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, checkPayment(in)) {
		return
	}
	s.respondExtraPayment(w, r, &in)
}

func (s *Server) clearExtraPayment(w http.ResponseWriter, r *http.Request) {
	s.respondExtraPayment(w, r, nil)
}

func (s *Server) respondExtraPayment(w http.ResponseWriter, r *http.Request, p *domain.Payment) {
	out, err := s.store.SetExtraPayment(r.Context(), userID(r), chi.URLParam(r, "id"), p)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

/* ---------- crédito ---------- */

func (s *Server) createCredit(w http.ResponseWriter, r *http.Request) {
	var in domain.CreditTransaction
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	// ajustes (adiantar, editar, excluir parcela) só pelos endpoints próprios, que aplicam as regras
	in.Adjustments = nil
	// recorrente: sem parcelas, e só o cancelamento (PATCH) define o mês final
	if in.Recurring {
		in.Installments = 1
		in.EndMonth = ""
	} else {
		in.EndMonth = ""
	}
	in.Name = strings.TrimSpace(in.Name)
	if bad(w, validateCredit(in)) {
		return
	}
	out, err := s.store.CreateCredit(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type creditPatchReq struct {
	Name         *string `json:"name"`
	TotalAmount  *int64  `json:"totalAmount"`
	Installments *int    `json:"installments"`
	StartMonth   *string `json:"startMonth"`
	Category     *string `json:"category"`
	// EndMonth cancela a recorrência: é o último mês que ainda cobra (o servidor nunca o põe antes do mês atual).
	EndMonth *string `json:"endMonth"`
}

func (s *Server) updateCredit(w http.ResponseWriter, r *http.Request) {
	var in creditPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	msg := ""
	if in.Name != nil {
		msg = first(msg, checkName(*in.Name))
	}
	if in.TotalAmount != nil {
		msg = first(msg, checkAmount(*in.TotalAmount))
	}
	if in.Installments != nil && (*in.Installments < 1 || *in.Installments > 360) {
		msg = first(msg, "O número de parcelas deve ficar entre 1 e 360.")
	}
	if in.StartMonth != nil {
		msg = first(msg, checkMonth(*in.StartMonth))
	}
	if in.Category != nil {
		msg = first(msg, checkCategory(*in.Category))
	}
	if in.EndMonth != nil {
		msg = first(msg, checkMonth(*in.EndMonth))
	}
	if bad(w, msg) {
		return
	}
	out, err := s.store.UpdateCredit(r.Context(), userID(r), chi.URLParam(r, "id"), store.CreditPatch{
		Name: trimmed(in.Name), TotalAmount: in.TotalAmount, Installments: in.Installments,
		StartMonth: in.StartMonth, Category: in.Category, EndMonth: in.EndMonth, Today: currentMonth(),
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteCredit(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteCredit(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- metas ---------- */

func (s *Server) createGoal(w http.ResponseWriter, r *http.Request) {
	var in domain.Goal
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if bad(w, validateGoal(in)) {
		return
	}
	out, err := s.store.CreateGoal(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type goalPatchReq struct {
	Name       *string `json:"name"`
	Target     *int64  `json:"target"`
	Saved      *int64  `json:"saved"`
	Monthly    *int64  `json:"monthly"`
	YieldTotal *int64  `json:"yieldTotal"`
	// RawMessage distingue "não veio" (nil) de "veio null" (limpa o prazo).
	Deadline json.RawMessage `json:"deadline"`
}

func (s *Server) updateGoal(w http.ResponseWriter, r *http.Request) {
	var in goalPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	patch := store.GoalPatch{Name: trimmed(in.Name), Target: in.Target, Saved: in.Saved, Monthly: in.Monthly, YieldTotal: in.YieldTotal}

	msg := ""
	if in.Name != nil {
		msg = first(msg, checkName(*in.Name))
	}
	for _, v := range []*int64{in.Target, in.Saved, in.Monthly, in.YieldTotal} {
		if v != nil {
			msg = first(msg, checkAmount(*v))
		}
	}
	if in.Deadline != nil {
		patch.SetDeadline = true
		if string(in.Deadline) != "null" {
			var d string
			if err := json.Unmarshal(in.Deadline, &d); err != nil {
				msg = first(msg, "Prazo inválido.")
			} else {
				msg = first(msg, checkMonth(d))
				patch.Deadline = &d
			}
		}
	}
	if bad(w, msg) {
		return
	}

	out, err := s.store.UpdateGoal(r.Context(), userID(r), chi.URLParam(r, "id"), patch)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteGoal(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteGoal(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- despesas extras ---------- */

func (s *Server) createExtra(w http.ResponseWriter, r *http.Request) {
	var in domain.ExtraExpense
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if bad(w, validateExtra(in)) {
		return
	}
	out, err := s.store.CreateExtra(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type extraPatchReq struct {
	Name   *string `json:"name"`
	Amount *int64  `json:"amount"`
	Month  *string `json:"month"`
}

func (s *Server) updateExtra(w http.ResponseWriter, r *http.Request) {
	var in extraPatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	msg := ""
	if in.Name != nil {
		msg = first(msg, checkName(*in.Name))
	}
	if in.Amount != nil {
		msg = first(msg, checkAmount(*in.Amount))
	}
	if in.Month != nil {
		msg = first(msg, checkMonth(*in.Month))
	}
	if bad(w, msg) {
		return
	}
	out, err := s.store.UpdateExtra(r.Context(), userID(r), chi.URLParam(r, "id"),
		store.ExtraPatch{Name: trimmed(in.Name), Amount: in.Amount, Month: in.Month})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteExtra(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteExtra(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- anotações ---------- */

func (s *Server) createNote(w http.ResponseWriter, r *http.Request) {
	var in domain.Note
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, validateNote(in)) {
		return
	}
	out, err := s.store.CreateNote(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

type notePatchReq struct {
	Content *string `json:"content"`
	Date    *string `json:"date"`
	Pinned  *bool   `json:"pinned"`
	Month   *string `json:"month"`
}

func (s *Server) updateNote(w http.ResponseWriter, r *http.Request) {
	var in notePatchReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	msg := ""
	if in.Content != nil && strings.TrimSpace(*in.Content) == "" {
		msg = "A anotação não pode ficar vazia."
	}
	if in.Month != nil {
		msg = first(msg, checkMonth(*in.Month))
	}
	if bad(w, msg) {
		return
	}
	out, err := s.store.UpdateNote(r.Context(), userID(r), chi.URLParam(r, "id"),
		store.NotePatch{Content: in.Content, Date: in.Date, Pinned: in.Pinned, Month: in.Month})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) deleteNote(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteNote(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- categorias e configurações ---------- */

func (s *Server) createCategory(w http.ResponseWriter, r *http.Request) {
	var in domain.CustomCategory
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	in.Name = strings.TrimSpace(in.Name)
	if bad(w, validateCategoryInput(in)) {
		return
	}
	out, err := s.store.CreateCategory(r.Context(), userID(r), in)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}

func (s *Server) deleteCategory(w http.ResponseWriter, r *http.Request) {
	if err := s.store.DeleteCategory(r.Context(), userID(r), chi.URLParam(r, "id")); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) putDistribution(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Items []domain.DistributionItem `json:"items"` // null volta ao padrão
	}
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if len(in.Items) > s.lim.DistributionItems {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("Categorias demais na distribuição (máximo %d).", s.lim.DistributionItems))
		return
	}
	if in.Items != nil && bad(w, domain.ValidateDistribution(in.Items)) {
		return
	}
	if err := s.store.SetDistribution(r.Context(), userID(r), in.Items); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) putSeenAlerts(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Keys []string `json:"keys"`
	}
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if len(in.Keys) > 1000 {
		writeError(w, http.StatusBadRequest, "Avisos demais.")
		return
	}
	if err := s.store.SetSeenAlerts(r.Context(), userID(r), in.Keys); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// putOnboarding: PUT /settings/onboarding/{screen} com {"state":"done"|"dismissed"}.
func (s *Server) putOnboarding(w http.ResponseWriter, r *http.Request) {
	screen := chi.URLParam(r, "screen")
	var in struct {
		State string `json:"state"`
	}
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if !screenRe.MatchString(screen) {
		writeError(w, http.StatusBadRequest, "Tela inválida.")
		return
	}
	if in.State != "done" && in.State != "dismissed" {
		writeError(w, http.StatusBadRequest, "O estado deve ser done ou dismissed.")
		return
	}
	if err := s.store.SetOnboarding(r.Context(), userID(r), screen, in.State); err != nil {
		s.fail(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

/* ---------- parcelas de uma compra no crédito ---------- */

// installmentNumber lê {n} da URL; 0 se não for um inteiro positivo.
func installmentNumber(r *http.Request) int {
	n, err := strconv.Atoi(chi.URLParam(r, "n"))
	if err != nil || n < 1 || n > domain.MaxInstallments {
		return 0
	}
	return n
}

// adjustInstallment roda uma regra de ajuste por parcela e responde com a compra atualizada.
// Quem manda é o servidor: dono da conta (a consulta filtra por usuário), regra da parcela e mês atual.
func (s *Server) adjustInstallment(w http.ResponseWriter, r *http.Request, rule func(c domain.CreditTransaction, n int) (map[string]domain.InstallmentAdjustment, string)) {
	n := installmentNumber(r)
	if n == 0 {
		writeError(w, http.StatusBadRequest, "Parcela inválida.")
		return
	}
	out, err := s.store.AdjustCredit(r.Context(), userID(r), chi.URLParam(r, "id"), func(c domain.CreditTransaction) (map[string]domain.InstallmentAdjustment, string) {
		return rule(c, n)
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusOK, out)
}

type advanceReq struct {
	// Discount em centavos: zero ou mais, e menor que o valor da parcela.
	Discount int64 `json:"discount"`
}

func (s *Server) advanceInstallment(w http.ResponseWriter, r *http.Request) {
	var in advanceReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, checkAmount(in.Discount)) {
		return
	}
	today := currentMonth()
	s.adjustInstallment(w, r, func(c domain.CreditTransaction, n int) (map[string]domain.InstallmentAdjustment, string) {
		return domain.AdvanceInstallment(c, n, in.Discount, today)
	})
}

type installmentValueReq struct {
	Value int64 `json:"value"`
}

func (s *Server) editInstallment(w http.ResponseWriter, r *http.Request) {
	var in installmentValueReq
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, checkAmount(in.Value)) {
		return
	}
	s.adjustInstallment(w, r, func(c domain.CreditTransaction, n int) (map[string]domain.InstallmentAdjustment, string) {
		return domain.EditInstallment(c, n, in.Value)
	})
}

func (s *Server) removeInstallment(w http.ResponseWriter, r *http.Request) {
	s.adjustInstallment(w, r, func(c domain.CreditTransaction, n int) (map[string]domain.InstallmentAdjustment, string) {
		return domain.RemoveInstallment(c, n)
	})
}
