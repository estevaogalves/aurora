package httpapi

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"aurora/api/internal/domain"
)

func currentMonth() string { return time.Now().Format("2006-01") }

// getData devolve tudo do usuário (é o que o ApiRepository.load usa).
func (s *Server) getData(w http.ResponseWriter, r *http.Request) {
	d, err := s.store.LoadData(r.Context(), userID(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}

// summary: resumo do mês, com cache no Redis (invalidado a cada escrita).
func (s *Server) summary(w http.ResponseWriter, r *http.Request) {
	month := chi.URLParam(r, "month")
	if bad(w, checkMonth(month)) {
		return
	}
	uid := userID(r)

	if cached, ok := s.cache.Get(r.Context(), uid, month); ok {
		w.Header().Set("X-Cache", "HIT")
		writeJSON(w, http.StatusOK, cached)
		return
	}

	d, err := s.store.LoadData(r.Context(), uid)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	sum := domain.GetMonthSummary(d.Transactions, d.CreditTransactions, month)
	s.cache.Set(r.Context(), uid, month, sum)
	w.Header().Set("X-Cache", "MISS")
	writeJSON(w, http.StatusOK, sum)
}

// projection: GET /projection?start=AAAA-MM&count=12 (padrão: mês atual, 12 meses).
func (s *Server) projection(w http.ResponseWriter, r *http.Request) {
	start := r.URL.Query().Get("start")
	if start == "" {
		start = currentMonth()
	}
	count := 12
	if v := r.URL.Query().Get("count"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 60 {
			writeError(w, http.StatusBadRequest, "count deve ficar entre 1 e 60.")
			return
		}
		count = n
	}
	if bad(w, checkMonth(start)) {
		return
	}

	d, err := s.store.LoadData(r.Context(), userID(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.GetProjection(d.Transactions, d.CreditTransactions, d.ExtraExpenses, start, count))
}

// comparison: GET /comparison?months=2026-01,2026-02 (de 2 a 12 meses).
func (s *Server) comparison(w http.ResponseWriter, r *http.Request) {
	raw := strings.Split(r.URL.Query().Get("months"), ",")
	seen := map[string]bool{}
	months := []string{}
	for _, m := range raw {
		m = strings.TrimSpace(m)
		if m == "" || seen[m] {
			continue
		}
		if bad(w, checkMonth(m)) {
			return
		}
		seen[m] = true
		months = append(months, m)
	}
	if len(months) < 2 || len(months) > 12 {
		writeError(w, http.StatusBadRequest, "Informe de 2 a 12 meses em months (ex.: months=2026-01,2026-02).")
		return
	}

	d, err := s.store.LoadData(r.Context(), userID(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, domain.Compare(d.Transactions, d.CreditTransactions, months))
}

const maxImportBody = 10 << 20 // 10 MiB

// importData: POST /import[?replace=true] com os dados do localStorage (formato do front).
func (s *Server) importData(w http.ResponseWriter, r *http.Request) {
	var in domain.FinanceData
	if !decode(w, r, &in, maxImportBody) {
		return
	}
	if bad(w, validateData(in)) {
		return
	}
	replace := r.URL.Query().Get("replace") == "true"
	out, err := s.store.Import(r.Context(), userID(r), in, replace)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	writeJSON(w, http.StatusCreated, out)
}
