package httpapi

import (
	"net/http"

	"aurora/api/internal/domain"
)

// Planejamento do usuário: orçamento por categoria, dívidas, fechamento do mês e carteira de dividendos. Só marcas e
// anotações: nada aqui mexe em receitas, despesas, saldo, projeção ou relatórios.

func checkID(label, id string) string {
	if id == "" || len([]rune(id)) > 64 {
		return label + ": identificador inválido."
	}
	return ""
}

func checkCents(label string, v int64) string {
	if v < 0 || v > domain.MaxInvestmentCents {
		return label + " fora do limite (0 a R$ 1 bilhão)."
	}
	return ""
}

// validatePlanning confere o planejamento inteiro. Devolve a mensagem do primeiro problema, ou "".
func validatePlanning(p domain.Planning) string {
	if len(p.Budgets) > domain.MaxBudgetCategories {
		return "Categorias demais no orçamento."
	}
	for category, changes := range p.Budgets {
		if msg := first(checkCategory(category), checkText("Categoria do orçamento", category, 40)); msg != "" {
			return msg
		}
		if len(changes) > domain.MaxBudgetChanges {
			return "Limites demais para a categoria " + quote(category) + "."
		}
		for month, limit := range changes {
			if msg := first(checkMonth(month), checkCents("O limite", limit)); msg != "" {
				return "Orçamento de " + quote(category) + ": " + msg
			}
		}
	}

	if len(p.Debts) > domain.MaxDebts {
		return "Dívidas demais."
	}
	seen := map[string]bool{}
	for _, d := range p.Debts {
		msg := first(
			checkID("Dívida", d.ID), checkName(d.Name), checkText("A observação", d.Note, 200),
			checkMonth(d.NextMonth), checkCents("O valor da parcela", d.InstallmentValue),
		)
		switch {
		case msg != "":
		case seen[d.ID]:
			msg = "identificador repetido."
		case d.InstallmentValue <= 0:
			msg = "o valor da parcela precisa ser maior que zero."
		case d.TotalInstallments < 1 || d.TotalInstallments > domain.MaxDebtInstallments:
			msg = "o total de parcelas deve ficar entre 1 e 600."
		case d.PaidInstallments < 0 || d.PaidInstallments > d.TotalInstallments:
			msg = "as parcelas pagas devem ficar entre 0 e o total."
		case len(d.LinkedTransactionID) > 64:
			msg = "vínculo inválido."
		case len(d.PaidValues) > domain.MaxDebtInstallments || len(d.Payments) > domain.MaxDebtInstallments:
			msg = "pagamentos demais."
		case d.Kind != "" && d.Kind != "debt" && d.Kind != "consortium":
			msg = "tipo inválido (dívida ou consórcio)."
		case d.Model != "" && d.Kind != "consortium":
			msg = "só consórcio tem modelo de parcela."
		case d.Model != "" && d.Model != "linear" && d.Model != "progressive":
			msg = "modelo de parcela inválido (linear ou progressivo)."
		case d.Model == "progressive" && d.Increment <= 0:
			msg = "no consórcio progressivo, o acréscimo mensal precisa ser maior que zero."
		case d.Model != "progressive" && d.Increment != 0:
			msg = "só o consórcio progressivo tem acréscimo."
		case d.Model == "progressive" && d.InstallmentValue+int64(d.TotalInstallments-1)*d.Increment > domain.MaxInvestmentCents:
			msg = "a última parcela passa do limite de R$ 1 bilhão."
		case d.TrackedFrom != "" && checkMonth(d.TrackedFrom) != "":
			msg = checkMonth(d.TrackedFrom)
		}
		for month, v := range d.PaidValues {
			if msg != "" {
				break
			}
			msg = first(checkMonth(month), checkCents("O valor pago", v))
		}
		for month, p := range d.Payments {
			if msg != "" {
				break
			}
			msg = first(checkMonth(month), checkPayment(p))
		}
		if msg != "" {
			return "Dívida " + quote(d.Name) + ": " + msg
		}
		seen[d.ID] = true
	}

	if len(p.Closings) > domain.MaxClosings {
		return "Meses fechados demais."
	}
	for month, c := range p.Closings {
		msg := first(checkMonth(month), checkDate("Data do fechamento", c.ClosedAt, false), checkText("A anotação", c.Note, maxNotes))
		if msg == "" && (c.Income < 0 || c.Income > domain.MaxInvestmentCents || c.Expense < 0 || c.Expense > domain.MaxInvestmentCents ||
			c.Balance > domain.MaxInvestmentCents || c.Balance < -domain.MaxInvestmentCents) {
			msg = "valores do fechamento fora do limite."
		}
		if msg == "" && len(c.ByCategory) > domain.MaxBudgetCategories {
			msg = "categorias demais."
		}
		for category, v := range c.ByCategory {
			if msg != "" {
				break
			}
			msg = first(checkText("Categoria", category, 40), checkCents("O valor da categoria", v))
		}
		if msg != "" {
			return "Fechamento de " + quote(month) + ": " + msg
		}
	}

	if len(p.DividendAssets) > domain.MaxDividendAssets {
		return "Ativos demais na carteira de dividendos."
	}
	seenAsset := map[string]bool{}
	for _, a := range p.DividendAssets {
		msg := first(checkID("Ativo", a.ID), checkText("O nome do ativo", a.Name, 60), checkCents("O valor investido", a.Invested), checkCents("Os proventos", a.MonthlyDividends))
		if msg == "" && a.Name == "" {
			msg = "dê um nome ao ativo."
		}
		if msg == "" && seenAsset[a.ID] {
			msg = "identificador repetido."
		}
		if msg != "" {
			return "Ativo " + quote(a.Name) + ": " + msg
		}
		seenAsset[a.ID] = true
	}
	return ""
}

// putPlanning: PUT /settings/planning troca o planejamento inteiro (o front manda tudo a cada mudança).
func (s *Server) putPlanning(w http.ResponseWriter, r *http.Request) {
	var in domain.Planning
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	if bad(w, validatePlanning(in)) {
		return
	}
	if err := s.store.SetPlanning(r.Context(), userID(r), in); err != nil {
		s.fail(w, r, err)
		return
	}
	s.touch(r.Context(), userID(r))
	w.WriteHeader(http.StatusNoContent)
}
