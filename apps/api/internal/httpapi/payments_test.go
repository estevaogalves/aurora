package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"aurora/api/internal/domain"
)

type paidResp struct {
	ID       string                    `json:"id"`
	Payments map[string]domain.Payment `json:"payments"`
	Payment  *domain.Payment           `json:"payment"`
	Amount   int64                     `json:"amount"`
}

func newExpense(e *env, t *testing.T, token string, body map[string]any) paidResp {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/transactions", token, body)
	want(t, r, http.StatusCreated)
	var out paidResp
	r.json(t, &out)
	return out
}

func TestTransactionPayments(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	now := thisMonth()
	next := domain.ChangeMonth(now, 1)

	one := newExpense(e, t, tk, map[string]any{"name": "Mercado", "amount": 15000, "type": "expense", "category": "Alimentação", "month": now})
	fixed := newExpense(e, t, tk, map[string]any{"name": "Aluguel", "amount": 90000, "type": "expense", "category": "Moradia", "fixed": true, "month": now})
	income := newExpense(e, t, tk, map[string]any{"name": "Salário", "amount": 500000, "type": "income", "category": "Renda", "month": now})
	today := time.Now().Format("2006-01-02")
	pay := map[string]any{"method": "pix", "date": today, "notes": "ok"}
	url := func(id, m string) string { return "/api/v1/transactions/" + id + "/payments/" + m }

	// marcar: devolve o pagamento e não mexe no valor
	r := e.do(t, "PUT", url(one.ID, now), tk, pay)
	want(t, r, 200)
	var out paidResp
	r.json(t, &out)
	if out.Payments[now].Method != "pix" || out.Payments[now].Notes != "ok" || out.Amount != 15000 {
		t.Fatalf("pago=%+v", out)
	}

	// data futura: só boleto (agendado); pix e cartão recusam
	future := map[string]any{"method": "pix", "date": "2999-01-01"}
	want(t, e.do(t, "PUT", url(one.ID, now), tk, future), 400)
	future["method"] = "debit"
	want(t, e.do(t, "PUT", url(one.ID, now), tk, future), 400)
	future["method"] = "boleto"
	want(t, e.do(t, "PUT", url(one.ID, now), tk, future), 200)
	want(t, e.do(t, "PUT", url(one.ID, now), tk, pay), 200)
	pay["method"] = "boleto"
	want(t, e.do(t, "PUT", url(one.ID, now), tk, pay), 200)

	// despesa avulsa só tem o seu mês; renda não é paga; entradas inválidas
	want(t, e.do(t, "PUT", url(one.ID, next), tk, pay), 422)
	want(t, e.do(t, "PUT", url(income.ID, now), tk, pay), 422)
	want(t, e.do(t, "PUT", url(one.ID, now), tk, map[string]any{"method": "dinheiro", "date": today}), 400)
	want(t, e.do(t, "PUT", url(one.ID, now), tk, map[string]any{"method": "pix", "date": "ontem"}), 400)
	want(t, e.do(t, "PUT", url(one.ID, "x"), tk, pay), 400)

	// fixa: paga em um mês, não em outro; meses antes do início não valem
	want(t, e.do(t, "PUT", url(fixed.ID, next), tk, pay), 200)
	want(t, e.do(t, "PUT", url(fixed.ID, domain.ChangeMonth(now, -1)), tk, pay), 422)

	// outro usuário não enxerga
	other := e.register(t, "").AccessToken
	want(t, e.do(t, "PUT", url(one.ID, now), other, pay), 404)

	// persistiu; desmarcar remove só o mês pedido
	var data struct {
		Transactions []paidResp `json:"transactions"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	got := map[string]paidResp{}
	for _, tr := range data.Transactions {
		got[tr.ID] = tr
	}
	if got[one.ID].Payments[now].Method != "boleto" || got[fixed.ID].Payments[next].Method != "boleto" || len(got[fixed.ID].Payments) != 1 {
		t.Fatalf("dados=%+v", got)
	}
	want(t, e.do(t, "DELETE", url(one.ID, now), tk, nil), 200)
	data.Transactions = nil
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	for _, tr := range data.Transactions {
		if tr.ID == one.ID && len(tr.Payments) != 0 {
			t.Fatalf("não desmarcou: %+v", tr)
		}
	}

	// o resumo do mês não muda com o pagamento
	var sum struct {
		TotalExpense int64 `json:"totalExpense"`
	}
	e.do(t, "GET", "/api/v1/summary/"+now, tk, nil).json(t, &sum)
	if sum.TotalExpense != 15000+90000 {
		t.Fatalf("total=%d", sum.TotalExpense)
	}
}

func TestExtraExpensePayment(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	r := e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "IPVA", "amount": 200000, "month": domain.ChangeMonth(thisMonth(), 2)})
	want(t, r, 201)
	var x paidResp
	r.json(t, &x)
	url := "/api/v1/extra-expenses/" + x.ID + "/payment"

	r = e.do(t, "PUT", url, tk, map[string]any{"method": "credit", "date": "2026-11-08"})
	want(t, r, 200)
	r.json(t, &x)
	if x.Payment == nil || x.Payment.Method != "credit" {
		t.Fatalf("extra=%+v", x)
	}
	want(t, e.do(t, "PUT", url, tk, map[string]any{"method": "?", "date": "2026-11-08"}), 400)
	want(t, e.do(t, "PUT", url, e.register(t, "").AccessToken, map[string]any{"method": "pix", "date": "2026-11-08"}), 404)

	want(t, e.do(t, "DELETE", url, tk, nil), 200)
	var data struct {
		Extras []paidResp `json:"extraExpenses"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Extras) != 1 || data.Extras[0].Payment != nil {
		t.Fatalf("extras=%+v", data.Extras)
	}
}

func TestImportKeepsPayments(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	body := map[string]any{
		"transactions":  []map[string]any{{"id": "", "name": "Luz", "amount": 12000, "type": "expense", "category": "Moradia", "month": "2026-11", "payments": map[string]any{"2026-11": map[string]any{"method": "debit", "date": "2026-11-03"}}}},
		"extraExpenses": []map[string]any{{"name": "Viagem", "amount": 50000, "month": "2027-01", "payment": map[string]any{"method": "pix", "date": "2026-11-03"}}},
	}
	want(t, e.do(t, "POST", "/api/v1/import", tk, body), 201)
	var data struct {
		Transactions []paidResp `json:"transactions"`
		Extras       []paidResp `json:"extraExpenses"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Transactions) != 1 || data.Transactions[0].Payments["2026-11"].Method != "debit" || len(data.Extras) != 1 || data.Extras[0].Payment == nil {
		t.Fatalf("importado=%+v / %+v", data.Transactions, data.Extras)
	}
	// forma inválida na importação é recusada
	bad := map[string]any{"transactions": []map[string]any{{"name": "Luz", "amount": 1, "type": "expense", "category": "Moradia", "month": "2026-11", "payments": map[string]any{"2026-11": map[string]any{"method": "x", "date": "2026-11-03"}}}}}
	want(t, e.do(t, "POST", "/api/v1/import", tk, bad), 400)
}
