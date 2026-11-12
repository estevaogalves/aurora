package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Encerrar uma despesa ou renda fixa a partir de um mês (end_month = último mês em que vale).

func TestEndFixedExpense(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	fixed := func(extra map[string]any) map[string]any {
		m := map[string]any{"name": "Cartão", "amount": 30000, "type": "expense", "category": "Outros", "month": "2026-06", "fixed": true, "variableAmount": true, "monthlyValues": map[string]any{"2026-11": 73247}}
		for k, v := range extra {
			m[k] = v
		}
		return m
	}

	// validação na criação
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, fixed(map[string]any{"endMonth": "novembro"})), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, fixed(map[string]any{"endMonth": "2026-05"})), 400) // antes do início
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Comum", "amount": 1, "type": "expense", "category": "Outros", "month": "2026-06", "endMonth": "2026-11"}), 400)

	r := e.do(t, "POST", "/api/v1/transactions", tk, fixed(nil))
	want(t, r, 201)
	var card domain.Transaction
	r.json(t, &card)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "month": "2026-01", "fixed": true}), 201)

	summary := func(month string) int64 {
		r := e.do(t, "GET", "/api/v1/summary/"+month, tk, nil)
		want(t, r, 200)
		var s domain.MonthSummary
		r.json(t, &s)
		return s.TotalExpense
	}
	beforeNov, beforeDec := summary("2026-11"), summary("2026-12")
	if beforeNov != 73247+100000 || beforeDec != 30000+100000 {
		t.Fatalf("antes de encerrar: nov=%d dez=%d", beforeNov, beforeDec)
	}

	// encerrar: o último mês em que vale é novembro
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"endMonth": "2026-11"}), 200)
	if got := summary("2026-11"); got != beforeNov {
		t.Fatalf("novembro mudou ao encerrar: %d", got)
	}
	if got := summary("2026-12"); got != 100000 {
		t.Fatalf("dezembro depois de encerrar: %d", got)
	}
	if got := summary("2027-05"); got != 100000 {
		t.Fatalf("2027-05 depois de encerrar: %d", got)
	}
	d := loadData(t, e, tk)
	var saved domain.Transaction
	for _, x := range d.Transactions {
		if x.ID == card.ID {
			saved = x
		}
	}
	if saved.EndMonth != "2026-11" || saved.MonthlyValues["2026-11"] != 73247 || !saved.Fixed {
		t.Fatalf("o valor de novembro e a fixa deveriam continuar: %+v", saved)
	}

	// fim inválido
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"endMonth": "2026-05"}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"endMonth": "xx"}), 400)

	// pagamento só nos meses em que ela vale
	pix := map[string]any{"method": "pix", "date": "2026-11-01"}
	want(t, e.do(t, "PUT", "/api/v1/transactions/"+card.ID+"/payments/2026-11", tk, pix), 200)
	want(t, e.do(t, "PUT", "/api/v1/transactions/"+card.ID+"/payments/2026-12", tk, pix), 422)

	// reativar: "" tira o fim
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"endMonth": ""}), 200)
	if got := summary("2026-12"); got != beforeDec {
		t.Fatalf("depois de reativar: %d", got)
	}

	// deixar de ser fixa no mesmo pedido que tira o fim é aceito; com o fim mantido, é recusado
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"endMonth": "2026-11"}), 200)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"fixed": false}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+card.ID, tk, map[string]any{"fixed": false, "endMonth": ""}), 200)
}

func TestEndFixedIsolationImportExport(t *testing.T) {
	e := setup(t)
	a := e.register(t, "").AccessToken
	b := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/transactions", a, map[string]any{"name": "Fixa", "amount": 1000, "type": "expense", "category": "Outros", "month": "2026-01", "fixed": true})
	want(t, r, 201)
	var tx domain.Transaction
	r.json(t, &tx)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, b, map[string]any{"endMonth": "2026-06"}), http.StatusNotFound)

	pack := map[string]any{"transactions": []map[string]any{
		{"id": "x1", "name": "Encerrada", "amount": 5000, "type": "expense", "category": "Outros", "month": "2026-01", "fixed": true, "endMonth": "2026-11"},
		{"id": "x2", "name": "Aberta", "amount": 7000, "type": "income", "category": "Renda", "month": "2026-01", "fixed": true},
	}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", a, map[string]any{"transactions": []map[string]any{{"id": "x", "name": "Ruim", "amount": 1, "type": "expense", "category": "Outros", "month": "2026-01", "fixed": true, "endMonth": "2025-01"}}}), 400)
	r = e.do(t, "POST", "/api/v1/import?replace=true", a, pack)
	want(t, r, http.StatusCreated)
	var out domain.FinanceData
	r.json(t, &out)
	ends := map[string]string{}
	for _, x := range out.Transactions {
		ends[x.Name] = x.EndMonth
	}
	if ends["Encerrada"] != "2026-11" || ends["Aberta"] != "" {
		t.Fatalf("importação: %+v", ends)
	}
}

// Reativar depois do fim: o front tira o fim e oculta os meses do intervalo no mesmo pedido; só valem os meses
// a partir da reativação, e o intervalo continua desativado.
func TestResumeFixedKeepsTheGapDeactivated(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Cartão", "amount": 30000, "type": "expense", "category": "Outros", "month": "2026-06", "fixed": true})
	want(t, r, 201)
	var tx domain.Transaction
	r.json(t, &tx)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"endMonth": "2026-11"}), 200)

	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+tx.ID, tk, map[string]any{"endMonth": "", "hiddenMonths": []string{"2026-12", "2027-01"}}), 200)

	total := func(month string) int64 {
		r := e.do(t, "GET", "/api/v1/summary/"+month, tk, nil)
		want(t, r, 200)
		var s domain.MonthSummary
		r.json(t, &s)
		return s.TotalExpense
	}
	got := []int64{total("2026-11"), total("2026-12"), total("2027-01"), total("2027-02"), total("2027-09")}
	if got[0] != 30000 || got[1] != 0 || got[2] != 0 || got[3] != 30000 || got[4] != 30000 {
		t.Fatalf("totais nov/dez/jan/fev/set = %v", got)
	}
	d := loadData(t, e, tk)
	if d.Transactions[0].EndMonth != "" || len(d.Transactions[0].HiddenMonths) != 2 {
		t.Fatalf("depois de reativar: %+v", d.Transactions[0])
	}
}
