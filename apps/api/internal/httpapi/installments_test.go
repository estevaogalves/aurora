package httpapi_test

import (
	"net/http"
	"testing"
	"time"

	"aurora/api/internal/domain"
)

// Compras no crédito: adiantar, editar e excluir uma parcela. O servidor é quem decide.

type creditResp struct {
	ID          string                                  `json:"id"`
	Adjustments map[string]domain.InstallmentAdjustment `json:"adjustments"`
	Installment int                                     `json:"installments"`
	Total       int64                                   `json:"totalAmount"`
}

func thisMonth() string { return time.Now().Format("2006-01") }

func (e *env) newCredit(t *testing.T, token string, total int64, installments int, start string) creditResp {
	t.Helper()
	r := e.do(t, "POST", "/api/v1/credits", token, map[string]any{"name": "Notebook", "totalAmount": total, "installments": installments, "startMonth": start, "category": "Outros"})
	want(t, r, http.StatusCreated)
	var c creditResp
	r.json(t, &c)
	return c
}

func installmentURL(id string, n string) string { return "/api/v1/credits/" + id + "/installments/" + n }

func advance(e *env, t *testing.T, token, id, n string, discount int64) resp {
	return e.do(t, "POST", installmentURL(id, n)+"/advance", token, map[string]any{"discount": discount})
}

func TestAdvanceLastFutureInstallment(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	now := thisMonth()
	c := e.newCredit(t, tk, 30000, 3, now) // 3x de R$ 100: agora, +1, +2

	// as demais parcelas não podem ser adiantadas
	want(t, advance(e, t, tk, c.ID, "1", 0), 422)
	want(t, advance(e, t, tk, c.ID, "2", 0), 422)
	want(t, advance(e, t, tk, c.ID, "9", 0), 422)
	want(t, advance(e, t, tk, c.ID, "x", 0), 400)

	// desconto inválido: negativo (400), igual ou maior que o valor da parcela (422)
	want(t, advance(e, t, tk, c.ID, "3", -1), 400)
	want(t, advance(e, t, tk, c.ID, "3", 10000), 422)
	want(t, advance(e, t, tk, c.ID, "3", 20000), 422)

	// valor válido: R$ 100 com R$ 8 de desconto => R$ 92 cobrados neste mês
	r := advance(e, t, tk, c.ID, "3", 800)
	want(t, r, 200)
	var out creditResp
	r.json(t, &out)
	adv := out.Adjustments["3"].Advanced
	if adv == nil || adv.Month != now || adv.Amount != 9200 || adv.Discount != 800 {
		t.Fatalf("adiantamento=%+v", out.Adjustments)
	}

	// não adianta de novo; a 2 passou a ser a última e pode
	want(t, advance(e, t, tk, c.ID, "3", 0), 422)
	want(t, advance(e, t, tk, c.ID, "2", 0), 200)
	// agora a última em aberto é a 1, do mês atual: não pode mais
	want(t, advance(e, t, tk, c.ID, "1", 0), 422)

	// persistiu: o GET /data traz os ajustes
	var data struct {
		Credits []creditResp `json:"creditTransactions"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Credits) != 1 || data.Credits[0].Adjustments["3"].Advanced == nil || data.Credits[0].Adjustments["2"].Advanced == nil {
		t.Fatalf("dados=%+v", data.Credits)
	}
}

func TestAdvanceRejectsCurrentAndPastInstallments(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	// última parcela no mês atual
	c := e.newCredit(t, tk, 20000, 2, domain.ChangeMonth(thisMonth(), -1))
	want(t, advance(e, t, tk, c.ID, "2", 0), 422)
	// última parcela no passado
	c = e.newCredit(t, tk, 20000, 2, domain.ChangeMonth(thisMonth(), -6))
	want(t, advance(e, t, tk, c.ID, "2", 0), 422)
	// compra de uma parcela só, neste mês
	c = e.newCredit(t, tk, 10000, 1, thisMonth())
	want(t, advance(e, t, tk, c.ID, "1", 0), 422)
}

func TestInstallmentsOnlyForTheOwner(t *testing.T) {
	e := setup(t)
	owner := e.register(t, "").AccessToken
	other := e.register(t, "").AccessToken
	c := e.newCredit(t, owner, 30000, 3, thisMonth())

	want(t, advance(e, t, other, c.ID, "3", 0), 404)
	want(t, e.do(t, "PUT", installmentURL(c.ID, "2"), other, map[string]any{"value": 5000}), 404)
	want(t, e.do(t, "DELETE", installmentURL(c.ID, "2"), other, nil), 404)
	want(t, advance(e, t, "", c.ID, "3", 0), 401)

	// nada mudou para o dono
	var data struct {
		Credits []creditResp `json:"creditTransactions"`
	}
	e.do(t, "GET", "/api/v1/data", owner, nil).json(t, &data)
	if len(data.Credits[0].Adjustments) != 0 {
		t.Errorf("ajustes não deveriam existir: %+v", data.Credits[0].Adjustments)
	}
}

func TestEditAndRemoveSingleInstallmentAndEditAll(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	c := e.newCredit(t, tk, 30000, 3, thisMonth())

	// só esta parcela: valor próprio e exclusão
	r := e.do(t, "PUT", installmentURL(c.ID, "2"), tk, map[string]any{"value": 15000})
	want(t, r, 200)
	var out creditResp
	r.json(t, &out)
	if v := out.Adjustments["2"].Value; v == nil || *v != 15000 {
		t.Fatalf("ajuste=%+v", out.Adjustments)
	}
	want(t, e.do(t, "PUT", installmentURL(c.ID, "2"), tk, map[string]any{"value": 0}), 422)
	want(t, e.do(t, "DELETE", installmentURL(c.ID, "1"), tk, nil), 200)
	want(t, e.do(t, "DELETE", installmentURL(c.ID, "1"), tk, nil), 422) // já excluída

	// adiantada não pode ser alterada individualmente
	want(t, advance(e, t, tk, c.ID, "3", 0), 200)
	want(t, e.do(t, "PUT", installmentURL(c.ID, "3"), tk, map[string]any{"value": 5000}), 422)
	want(t, e.do(t, "DELETE", installmentURL(c.ID, "3"), tk, nil), 422)

	// todas: nome e total mudam, os ajustes ficam; o nº de parcelas não muda com ajustes
	r = e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"name": "Notebook novo", "totalAmount": 60000})
	want(t, r, 200)
	r.json(t, &out)
	if out.Total != 60000 || out.Adjustments["3"].Advanced == nil || !out.Adjustments["1"].Removed || out.Adjustments["2"].Value == nil {
		t.Fatalf("editar todas mexeu nos ajustes: %s", r.Body)
	}
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"installments": 5}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"installments": 3}), 200)

	// sem ajustes, o nº de parcelas pode mudar
	plain := e.newCredit(t, tk, 30000, 3, thisMonth())
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+plain.ID, tk, map[string]any{"installments": 5}), 200)

	// excluir a compra inteira continua removendo tudo
	want(t, e.do(t, "DELETE", "/api/v1/credits/"+c.ID, tk, nil), 204)
}

func TestCreateCreditIgnoresClientAdjustmentsButImportKeepsThem(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// no cadastro normal o cliente não consegue "fabricar" um adiantamento
	r := e.do(t, "POST", "/api/v1/credits", tk, map[string]any{
		"name": "TV", "totalAmount": 20000, "installments": 2, "startMonth": thisMonth(), "category": "Lazer",
		"adjustments": map[string]any{"2": map[string]any{"advanced": map[string]any{"month": thisMonth(), "discount": 0, "amount": 1}}},
	})
	want(t, r, 201)
	var c creditResp
	r.json(t, &c)
	if len(c.Adjustments) != 0 {
		t.Errorf("ajustes do cliente deveriam ser ignorados: %+v", c.Adjustments)
	}

	// importação (backup): os ajustes são mantidos, mas validados
	imp := func(adj map[string]any) resp {
		return e.do(t, "POST", "/api/v1/import?replace=true", tk, map[string]any{
			"creditTransactions": []map[string]any{{"id": "", "name": "TV", "totalAmount": 20000, "installments": 2, "startMonth": thisMonth(), "category": "Lazer", "adjustments": adj}},
		})
	}
	want(t, imp(map[string]any{"2": map[string]any{"advanced": map[string]any{"month": thisMonth(), "discount": 800, "amount": 9200}}}), 201)
	var data struct {
		Credits []creditResp `json:"creditTransactions"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Credits) != 1 || data.Credits[0].Adjustments["2"].Advanced == nil {
		t.Fatalf("importação perdeu o adiantamento: %+v", data.Credits)
	}
	want(t, imp(map[string]any{"9": map[string]any{"removed": true}}), 400)
	want(t, imp(map[string]any{"2": map[string]any{"value": 0}}), 400)
}

type recurringResp struct {
	ID        string `json:"id"`
	Recurring bool   `json:"recurring"`
	EndMonth  string `json:"endMonth"`
	Total     int64  `json:"totalAmount"`
	Count     int    `json:"installments"`
}

func TestRecurringCreditAndCancel(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	now := thisMonth()

	// o servidor impõe 1 "parcela" e ignora o mês final enviado na criação
	r := e.do(t, "POST", "/api/v1/credits", tk, map[string]any{"name": "Streaming", "totalAmount": 3990, "installments": 12, "startMonth": now, "category": "Lazer", "recurring": true, "endMonth": "2020-01"})
	want(t, r, http.StatusCreated)
	var c recurringResp
	r.json(t, &c)
	if !c.Recurring || c.Count != 1 || c.EndMonth != "" || c.Total != 3990 {
		t.Fatalf("criada=%+v", c)
	}

	// parcela de recorrente não se ajusta
	want(t, e.do(t, "PUT", installmentURL(c.ID, "1"), tk, map[string]any{"value": 100}), 422)

	// compra parcelada comum não tem recorrência para cancelar
	normal := e.newCredit(t, tk, 30000, 3, now)
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+normal.ID, tk, map[string]any{"endMonth": now}), 422)

	// cancelar com mês passado vale a partir do mês atual: o que já foi cobrado fica
	r = e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"endMonth": domain.ChangeMonth(now, -3)})
	want(t, r, 200)
	r.json(t, &c)
	if c.EndMonth != now || !c.Recurring {
		t.Fatalf("cancelada=%+v", c)
	}
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"endMonth": now}), 422)
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+c.ID, tk, map[string]any{"endMonth": "x"}), 400)

	// o resumo do mês seguinte só traz a parcela da compra comum (30000 em 3x), não a assinatura
	var sum struct {
		CreditExpense int64 `json:"creditExpense"`
	}
	e.do(t, "GET", "/api/v1/summary/"+domain.ChangeMonth(now, 1), tk, nil).json(t, &sum)
	if sum.CreditExpense != 10000 {
		t.Fatalf("cobrou depois de cancelar: %d", sum.CreditExpense)
	}
}
