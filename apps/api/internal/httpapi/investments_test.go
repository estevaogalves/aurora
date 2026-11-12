package httpapi_test

import (
	"net/http"
	"testing"

	"aurora/api/internal/domain"
)

// Investimentos: cadastro, movimentações que refazem o valor atual no servidor, isolamento entre contas,
// importação e a garantia de que o resumo do mês não muda.

type movementResult struct {
	Movement   *domain.InvestmentMovement `json:"movement"`
	Investment domain.Investment          `json:"investment"`
}

func newInvestment(t *testing.T, e *env, tk string, body map[string]any) domain.Investment {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/investments", tk, body)
	want(t, r, http.StatusCreated)
	var inv domain.Investment
	r.json(t, &inv)
	return inv
}

func addMovement(t *testing.T, e *env, tk string, body map[string]any) movementResult {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/investment-movements", tk, body)
	want(t, r, http.StatusCreated)
	var res movementResult
	r.json(t, &res)
	return res
}

func TestInvestmentValidation(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	ok := map[string]any{"name": "CDB 110%", "family": "fixed", "institution": "Banco A", "appliedAt": "2026-01-01", "currentValue": 100000}
	with := func(k string, v any) map[string]any {
		m := map[string]any{}
		for key, val := range ok {
			m[key] = val
		}
		m[k] = v
		return m
	}

	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("name", " ")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("institution", "")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("family", "bitcoin")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("appliedAt", "2026-02-30")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("appliedAt", "")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("maturityDate", "01/12/2026")), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("currentValue", -1)), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("currentValue", domain.MaxInvestmentCents+1)), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("quantity", -3)), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, with("redeemDays", 99999)), 400)
	want(t, e.do(t, "POST", "/api/v1/investments", tk, ok), 201)

	// movimentação: tipo, data e valores
	inv := newInvestment(t, e, tk, ok)
	mv := func(k string, v any) map[string]any {
		return map[string]any{"investmentId": inv.ID, "type": "contribution", "date": "2026-03-01", "amount": 1000, k: v}
	}
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, mv("type", "gift")), 400)
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, mv("date", "2026-3-1")), 400)
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, mv("amount", -5)), 400)
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, mv("quantity", -1)), 400)
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, mv("unitPrice", -1)), 400)
	// investimento que não existe
	want(t, e.do(t, "POST", "/api/v1/investment-movements", tk, map[string]any{"investmentId": "nao-e-uuid", "type": "yield", "date": "2026-03-01", "amount": 1}), 404)
}

func TestInvestmentMovementsRecomputeOnServer(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// renda fixa: o servidor refaz o valor atual a cada movimentação
	cdb := newInvestment(t, e, tk, map[string]any{"name": "CDB", "family": "fixed", "institution": "Banco A", "appliedAt": "2026-01-01", "currentValue": 0})
	first := addMovement(t, e, tk, map[string]any{"investmentId": cdb.ID, "type": "contribution", "date": "2026-03-01", "amount": 100000})
	if first.Investment.CurrentValue != 100000 || first.Movement == nil || first.Movement.ID == "" {
		t.Fatalf("depois do aporte: %+v", first)
	}
	addMovement(t, e, tk, map[string]any{"investmentId": cdb.ID, "type": "yield", "date": "2026-03-02", "amount": 10000})
	red := addMovement(t, e, tk, map[string]any{"investmentId": cdb.ID, "type": "redemption", "date": "2026-03-03", "amount": 40000})
	if red.Investment.CurrentValue != 70000 {
		t.Fatalf("depois do resgate: %d", red.Investment.CurrentValue)
	}

	// um aporte retroativo entra na ordem das datas
	addMovement(t, e, tk, map[string]any{"investmentId": cdb.ID, "type": "adjustment", "date": "2026-03-01", "amount": 150000})
	var data domain.FinanceData
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	// ajuste (150000) no mesmo dia do aporte, registrado depois: 100000 -> 150000, +10000, -40000
	if got := data.Investments[0].CurrentValue; got != 120000 {
		t.Fatalf("valor com ajuste retroativo: %d", got)
	}
	if len(data.InvestmentMovements) != 4 {
		t.Fatalf("movimentações=%d", len(data.InvestmentMovements))
	}

	// corrigir o valor do resgate refaz o investimento
	r := e.do(t, "PATCH", "/api/v1/investment-movements/"+red.Movement.ID, tk, map[string]any{"amount": 20000})
	want(t, r, 200)
	var upd movementResult
	r.json(t, &upd)
	if upd.Investment.CurrentValue != 140000 || upd.Movement.Amount != 20000 {
		t.Fatalf("depois de corrigir: %+v", upd)
	}

	// excluir a movimentação refaz de novo
	r = e.do(t, "DELETE", "/api/v1/investment-movements/"+red.Movement.ID, tk, nil)
	want(t, r, 200)
	var del movementResult
	r.json(t, &del)
	if del.Investment.CurrentValue != 160000 {
		t.Fatalf("depois de excluir: %d", del.Investment.CurrentValue)
	}
	want(t, e.do(t, "DELETE", "/api/v1/investment-movements/"+red.Movement.ID, tk, nil), http.StatusNotFound)

	// cotas e preço médio (fracionário)
	fii := newInvestment(t, e, tk, map[string]any{"name": "HGLG11", "family": "equity", "institution": "Corretora", "appliedAt": "2026-01-01", "currentValue": 0})
	addMovement(t, e, tk, map[string]any{"investmentId": fii.ID, "type": "contribution", "date": "2026-01-01", "amount": 300000, "quantity": 100, "unitPrice": 3000})
	res := addMovement(t, e, tk, map[string]any{"investmentId": fii.ID, "type": "contribution", "date": "2026-02-01", "amount": 50000, "quantity": 10, "unitPrice": 5000})
	if res.Investment.Quantity == nil || *res.Investment.Quantity != 110 || res.Investment.AvgPrice == nil || *res.Investment.AvgPrice != 3182 {
		t.Fatalf("cotas=%v preço médio=%v", res.Investment.Quantity, res.Investment.AvgPrice)
	}
	res = addMovement(t, e, tk, map[string]any{"investmentId": fii.ID, "type": "redemption", "date": "2026-03-01", "amount": 100000, "quantity": 20, "unitPrice": 5000})
	if *res.Investment.Quantity != 90 || res.Investment.CurrentValue != 250000 {
		t.Fatalf("depois da venda: cotas=%v valor=%d", *res.Investment.Quantity, res.Investment.CurrentValue)
	}
	frac := addMovement(t, e, tk, map[string]any{"investmentId": fii.ID, "type": "contribution", "date": "2026-04-01", "amount": 1500, "quantity": 0.25, "unitPrice": 6000})
	if *frac.Investment.Quantity != 90.25 {
		t.Fatalf("cota fracionária: %v", *frac.Investment.Quantity)
	}

	// limpar a quantidade corrigindo a movimentação (null) é aceito
	want(t, e.do(t, "PATCH", "/api/v1/investment-movements/"+frac.Movement.ID, tk, map[string]any{"quantity": nil, "unitPrice": nil}), 200)
	want(t, e.do(t, "PATCH", "/api/v1/investment-movements/"+frac.Movement.ID, tk, map[string]any{"quantity": "muitas"}), 400)
}

func TestInvestmentPatchAndDelete(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	inv := newInvestment(t, e, tk, map[string]any{
		"name": "Tesouro Selic", "family": "treasury", "product": "Tesouro Selic", "institution": "Corretora",
		"appliedAt": "2026-01-01", "currentValue": 50000, "maturityDate": "2029-03-01", "rate": "Selic + 0,1%", "quantity": 2.5, "avgPrice": 20000,
	})

	// só o que vem muda; texto vazio limpa; null limpa cotas e preço médio
	r := e.do(t, "PATCH", "/api/v1/investments/"+inv.ID, tk, map[string]any{"name": " Tesouro Selic 2029 ", "maturityDate": "", "currentValue": 55000, "quantity": nil, "avgPrice": nil})
	want(t, r, 200)
	var got domain.Investment
	r.json(t, &got)
	if got.Name != "Tesouro Selic 2029" || got.MaturityDate != "" || got.CurrentValue != 55000 || got.Quantity != nil || got.AvgPrice != nil || got.Rate != "Selic + 0,1%" || got.Family != "treasury" {
		t.Fatalf("depois do patch: %+v", got)
	}
	want(t, e.do(t, "PATCH", "/api/v1/investments/"+inv.ID, tk, map[string]any{"family": "nope"}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/investments/"+inv.ID, tk, map[string]any{"currentValue": -1}), 400)

	// apagar o investimento apaga as movimentações
	addMovement(t, e, tk, map[string]any{"investmentId": inv.ID, "type": "contribution", "date": "2026-03-01", "amount": 1000})
	want(t, e.do(t, "DELETE", "/api/v1/investments/"+inv.ID, tk, nil), http.StatusNoContent)
	want(t, e.do(t, "DELETE", "/api/v1/investments/"+inv.ID, tk, nil), http.StatusNotFound)
	var data domain.FinanceData
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Investments) != 0 || len(data.InvestmentMovements) != 0 {
		t.Fatalf("sobrou: %+v %+v", data.Investments, data.InvestmentMovements)
	}
}

func TestInvestmentsAreIsolatedPerAccount(t *testing.T) {
	e := setup(t)
	a := e.register(t, "").AccessToken
	b := e.register(t, "").AccessToken
	inv := newInvestment(t, e, a, map[string]any{"name": "CDB", "family": "fixed", "institution": "Banco A", "appliedAt": "2026-01-01", "currentValue": 1000})
	m := addMovement(t, e, a, map[string]any{"investmentId": inv.ID, "type": "contribution", "date": "2026-03-01", "amount": 1000})

	want(t, e.do(t, "PATCH", "/api/v1/investments/"+inv.ID, b, map[string]any{"name": "meu"}), http.StatusNotFound)
	want(t, e.do(t, "DELETE", "/api/v1/investments/"+inv.ID, b, nil), http.StatusNotFound)
	want(t, e.do(t, "POST", "/api/v1/investment-movements", b, map[string]any{"investmentId": inv.ID, "type": "yield", "date": "2026-03-02", "amount": 5}), http.StatusNotFound)
	want(t, e.do(t, "PATCH", "/api/v1/investment-movements/"+m.Movement.ID, b, map[string]any{"amount": 1}), http.StatusNotFound)
	want(t, e.do(t, "DELETE", "/api/v1/investment-movements/"+m.Movement.ID, b, nil), http.StatusNotFound)

	var data domain.FinanceData
	e.do(t, "GET", "/api/v1/data", b, nil).json(t, &data)
	if len(data.Investments) != 0 || len(data.InvestmentMovements) != 0 {
		t.Fatalf("a outra conta enxergou: %+v", data.Investments)
	}
	e.do(t, "GET", "/api/v1/data", a, nil).json(t, &data)
	if len(data.Investments) != 1 || data.Investments[0].CurrentValue != 1000 {
		t.Fatalf("a conta dona perdeu o investimento: %+v", data.Investments)
	}
}

func TestInvestmentsDoNotChangeMonthSummary(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Salário", "amount": 500000, "type": "income", "category": "Salário", "month": "2026-03"}), 201)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Aluguel", "amount": 120000, "type": "expense", "category": "Moradia", "month": "2026-03"}), 201)

	summary := func() domain.MonthSummary {
		r := e.do(t, "GET", "/api/v1/summary/2026-03", tk, nil)
		want(t, r, 200)
		var s domain.MonthSummary
		r.json(t, &s)
		return s
	}
	before := summary()

	inv := newInvestment(t, e, tk, map[string]any{"name": "CDB", "family": "fixed", "institution": "Banco A", "appliedAt": "2026-03-01", "currentValue": 0})
	addMovement(t, e, tk, map[string]any{"investmentId": inv.ID, "type": "contribution", "date": "2026-03-05", "amount": 200000})
	addMovement(t, e, tk, map[string]any{"investmentId": inv.ID, "type": "redemption", "date": "2026-03-20", "amount": 50000})

	after := summary()
	if before.TotalIncome != after.TotalIncome || before.TotalExpense != after.TotalExpense || before.Balance != after.Balance || before.CreditExpense != after.CreditExpense {
		t.Fatalf("o resumo mudou com investimentos: antes=%+v depois=%+v", before, after)
	}
}

func TestInvestmentsImportAndExport(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	pack := map[string]any{
		"investments": []map[string]any{
			{"id": "inv-a", "name": "FII", "family": "equity", "institution": "Corretora", "appliedAt": "2026-01-01", "currentValue": 12345, "quantity": 7.5, "avgPrice": 1646},
			{"id": "inv-b", "name": "Poupança", "family": "liquid", "product": "Poupança", "institution": "Banco", "appliedAt": "2026-02-01", "currentValue": 5000},
		},
		"investmentMovements": []map[string]any{
			{"id": "mov-1", "investmentId": "inv-a", "type": "contribution", "date": "2026-01-01", "amount": 12345, "quantity": 7.5, "unitPrice": 1646},
		},
	}

	// pacote com movimentação de investimento que não existe é recusado
	bad := map[string]any{"investmentMovements": []map[string]any{{"id": "m", "investmentId": "fantasma", "type": "yield", "date": "2026-01-01", "amount": 1}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, bad), 400)
	// investimento inválido no pacote também
	broken := map[string]any{"investments": []map[string]any{{"id": "x", "name": "X", "family": "???", "institution": "B", "appliedAt": "2026-01-01", "currentValue": 1}}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, broken), 400)

	r := e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, http.StatusCreated)
	var out domain.FinanceData
	r.json(t, &out)
	if len(out.Investments) != 2 || len(out.InvestmentMovements) != 1 {
		t.Fatalf("importado: %+v", out)
	}
	// o valor atual vem como está no pacote (a importação não refaz a conta) e a movimentação aponta para o id novo
	var fii domain.Investment
	for _, i := range out.Investments {
		if i.Name == "FII" {
			fii = i
		}
	}
	if fii.CurrentValue != 12345 || fii.Quantity == nil || *fii.Quantity != 7.5 || out.InvestmentMovements[0].InvestmentID != fii.ID {
		t.Fatalf("fii=%+v mov=%+v", fii, out.InvestmentMovements[0])
	}

	// sem replace, conta que já tem investimento recusa
	want(t, e.do(t, "POST", "/api/v1/import", tk, pack), http.StatusConflict)

	// importar de novo com replace troca tudo, sem duplicar
	r = e.do(t, "POST", "/api/v1/import?replace=true", tk, pack)
	want(t, r, http.StatusCreated)
	r.json(t, &out)
	if len(out.Investments) != 2 || len(out.InvestmentMovements) != 1 {
		t.Fatalf("depois do segundo import: %d investimentos, %d movimentações", len(out.Investments), len(out.InvestmentMovements))
	}

	// a exportação da conta leva os investimentos
	r = e.do(t, "GET", "/api/v1/me/export", tk, nil)
	want(t, r, 200)
	var exp struct {
		Data domain.FinanceData `json:"data"`
	}
	r.json(t, &exp)
	if len(exp.Data.Investments) != 2 || len(exp.Data.InvestmentMovements) != 1 {
		t.Fatalf("exportação: %+v", exp.Data)
	}
}

// Negócio próprio: investimentos consecutivos, recebimentos e saques. O valor atual é o saldo a sacar e o
// lucro é recebido − investido (a migration 00019 libera a família "business" e o tipo "income").
func TestBusinessInvestment(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	biz := newInvestment(t, e, tk, map[string]any{"name": "Revenda", "family": "business", "institution": "Negócio próprio", "appliedAt": "2026-01-01", "currentValue": 0})

	mv := func(typ string, amount int, date string) movementResult {
		return addMovement(t, e, tk, map[string]any{"investmentId": biz.ID, "type": typ, "date": date, "amount": amount})
	}
	mv("contribution", 100000, "2026-01-01")
	if r := mv("contribution", 50000, "2026-02-01"); r.Investment.CurrentValue != 0 {
		t.Fatalf("investimento não pode entrar no saldo a sacar: %d", r.Investment.CurrentValue)
	}
	mv("income", 80000, "2026-02-10")
	if r := mv("income", 100000, "2026-03-10"); r.Investment.CurrentValue != 180000 {
		t.Fatalf("saldo após recebimentos: %d", r.Investment.CurrentValue)
	}
	if r := mv("redemption", 30000, "2026-03-15"); r.Investment.CurrentValue != 150000 {
		t.Fatalf("saldo após saque: %d", r.Investment.CurrentValue)
	}
}
