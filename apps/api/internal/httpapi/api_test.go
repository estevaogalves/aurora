package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"aurora/api/internal/config"
	"aurora/api/internal/db"
	"aurora/api/internal/httpapi"
	"aurora/api/internal/store"
)

// Testes de integração: precisam de um Postgres (TEST_DATABASE_URL). Sem ele, são pulados.
// Exemplo: TEST_DATABASE_URL=postgres://aurora:aurora@localhost:5432/aurora_test go test ./...

type env struct {
	srv *httptest.Server
	mr  *miniredis.Miniredis
	cfg config.Config
}

func setup(t *testing.T) *env {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definida; teste de integração pulado")
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}

	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })

	cfg := config.Config{
		JWTSecret: strings.Repeat("k", 32), AccessTTL: 15 * time.Minute, RefreshTTL: time.Hour,
		LoginMaxAttempts: 3, LoginWindow: time.Minute, AllowedOrigin: []string{"http://localhost:5173"},
		AdminEmail: "admin@aurora.test",
	}
	srv, err := httpapi.New(cfg, store.New(pool), rdb, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(ts.Close)
	return &env{srv: ts, mr: mr, cfg: cfg}
}

type resp struct {
	Status  int
	Body    []byte
	Header  http.Header
	Cookies []*http.Cookie
}

func (r resp) json(t *testing.T, v any) {
	t.Helper()
	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("JSON inválido (%d): %s", r.Status, r.Body)
	}
}

func (r resp) cookie(name string) *http.Cookie {
	for _, c := range r.Cookies {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func (e *env) do(t *testing.T, method, path, token string, body any, cookies ...*http.Cookie) resp {
	t.Helper()
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, e.srv.URL+path, rd)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return resp{Status: res.StatusCode, Body: raw, Header: res.Header, Cookies: res.Cookies()}
}

type session struct {
	AccessToken string `json:"accessToken"`
	User        struct {
		ID, Email, Role string
	} `json:"user"`
	refresh *http.Cookie
}

var counter int

func (e *env) register(t *testing.T, email string) session {
	t.Helper()
	if email == "" {
		counter++
		email = fmt.Sprintf("user%d-%d@aurora.test", time.Now().UnixNano(), counter)
	}
	r := e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": email, "name": "Teste", "password": "senha-forte-123"})
	if r.Status != http.StatusCreated {
		t.Fatalf("register: %d %s", r.Status, r.Body)
	}
	var s session
	r.json(t, &s)
	s.refresh = r.cookie("aurora_refresh")
	return s
}

func want(t *testing.T, r resp, status int) {
	t.Helper()
	if r.Status != status {
		t.Fatalf("status %d, esperado %d: %s", r.Status, status, r.Body)
	}
}

func TestAuthFlow(t *testing.T) {
	e := setup(t)

	s := e.register(t, "")
	if s.User.Role != "user" || s.AccessToken == "" {
		t.Fatalf("sessão: %+v", s)
	}
	c := s.refresh
	if c == nil || !c.HttpOnly || c.Path != "/api/v1/auth" || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie de refresh deveria ser httpOnly e restrito: %+v", c)
	}

	// cadastro duplicado (mesmo e-mail em outra caixa) e dados inválidos
	r := e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": strings.ToUpper(s.User.Email), "password": "senha-forte-123"})
	want(t, r, http.StatusConflict)
	want(t, e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": "nao-e-email", "password": "senha-forte-123"}), 400)
	want(t, e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": "novo@aurora.test", "password": "curta"}), 400)

	// rotas protegidas
	want(t, e.do(t, "GET", "/api/v1/me", "", nil), 401)
	want(t, e.do(t, "GET", "/api/v1/me", "token-falso", nil), 401)
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 200)

	// refresh rotativo: o token novo funciona, o antigo não
	r = e.do(t, "POST", "/api/v1/auth/refresh", "", nil, c)
	want(t, r, 200)
	newCookie := r.cookie("aurora_refresh")
	if newCookie == nil || newCookie.Value == c.Value {
		t.Fatal("o refresh deveria girar o token")
	}
	var renewed session
	r.json(t, &renewed)
	want(t, e.do(t, "GET", "/api/v1/me", renewed.AccessToken, nil), 200)

	// reutilizar o token antigo derruba também o novo
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, c), 401)
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, newCookie), 401)

	// sem cookie
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil), 401)

	// logout invalida o refresh
	s2 := e.register(t, "")
	want(t, e.do(t, "POST", "/api/v1/auth/logout", "", nil, s2.refresh), 204)
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, s2.refresh), 401)
}

func TestLoginAndRateLimit(t *testing.T) {
	e := setup(t)
	s := e.register(t, "")
	login := func(pw string) resp {
		return e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": s.User.Email, "password": pw})
	}

	want(t, login("senha-forte-123"), 200)
	// e-mail inexistente responde igual a senha errada
	r := e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": "ninguem@aurora.test", "password": "x"})
	want(t, r, 401)

	for i := 0; i < 3; i++ {
		want(t, login("errada"), 401)
	}
	// estourou o limite: nem a senha certa entra
	r = login("senha-forte-123")
	want(t, r, 429)
	if r.Header.Get("Retry-After") == "" {
		t.Error("faltou o cabeçalho Retry-After")
	}

	// a janela passa e libera
	e.mr.FastForward(2 * time.Minute)
	want(t, login("senha-forte-123"), 200)
}

func TestAdminRole(t *testing.T) {
	e := setup(t)
	user := e.register(t, "")
	want(t, e.do(t, "GET", "/api/v1/admin/users", user.AccessToken, nil), 403)

	// o admin é definido por ADMIN_EMAIL; o e-mail pode já existir de uma execução anterior
	r := e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": e.cfg.AdminEmail, "password": "senha-forte-123"})
	var admin session
	if r.Status == 200 {
		r.json(t, &admin)
	} else {
		admin = e.register(t, e.cfg.AdminEmail)
	}
	if admin.User.Role != "admin" {
		t.Fatalf("papel: %q", admin.User.Role)
	}
	want(t, e.do(t, "GET", "/api/v1/admin/users", admin.AccessToken, nil), 200)
}

type tx struct {
	ID            string           `json:"id"`
	Name          string           `json:"name"`
	Amount        int64            `json:"amount"`
	Fixed         bool             `json:"fixed"`
	HiddenMonths  []string         `json:"hiddenMonths"`
	MonthlyValues map[string]int64 `json:"monthlyValues"`
}

func TestTransactionsAndOverrides(t *testing.T) {
	e := setup(t)
	s := e.register(t, "")
	tk := s.AccessToken

	// validação
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "", "amount": 1, "type": "expense", "category": "Moradia", "month": "2026-03"}), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "x", "amount": 1, "type": "outro", "category": "Moradia", "month": "2026-03"}), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "x", "amount": 1, "type": "expense", "category": "Moradia", "month": "03/2026"}), 400)
	want(t, e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "x", "amount": -5, "type": "expense", "category": "Moradia", "month": "2026-03"}), 400)

	r := e.do(t, "POST", "/api/v1/transactions", tk, map[string]any{"name": "Aluguel", "amount": 150000, "type": "expense", "category": "Moradia", "month": "2026-03", "fixed": true})
	want(t, r, 201)
	var rent tx
	r.json(t, &rent)

	// valor específico + ocultar mês, como o front faz
	r = e.do(t, "PATCH", "/api/v1/transactions/"+rent.ID, tk, map[string]any{"monthlyValues": map[string]int64{"2026-04": 0, "2026-06": 170000}, "hiddenMonths": []string{"2026-05"}})
	want(t, r, 200)
	r.json(t, &rent)
	if rent.MonthlyValues["2026-04"] != 0 || rent.MonthlyValues["2026-06"] != 170000 || len(rent.MonthlyValues) != 2 {
		t.Errorf("monthlyValues: %v", rent.MonthlyValues)
	}
	if len(rent.HiddenMonths) != 1 || rent.HiddenMonths[0] != "2026-05" {
		t.Errorf("hiddenMonths: %v", rent.HiddenMonths)
	}

	// restaurar o mês (lista vazia) mantém os valores
	r = e.do(t, "PATCH", "/api/v1/transactions/"+rent.ID, tk, map[string]any{"hiddenMonths": []string{}})
	want(t, r, 200)
	rent = tx{}
	r.json(t, &rent)
	if len(rent.HiddenMonths) != 0 || len(rent.MonthlyValues) != 2 {
		t.Errorf("após restaurar: %+v", rent)
	}

	// editar só o nome não mexe nos meses
	r = e.do(t, "PATCH", "/api/v1/transactions/"+rent.ID, tk, map[string]any{"name": "Aluguel novo"})
	rent = tx{}
	r.json(t, &rent)
	if rent.Name != "Aluguel novo" || rent.Amount != 150000 || len(rent.MonthlyValues) != 2 {
		t.Errorf("patch parcial: %+v", rent)
	}

	// o GET /data vem no formato do front
	var data struct {
		Transactions []tx     `json:"transactions"`
		Goals        []any    `json:"goals"`
		SeenAlerts   []string `json:"seenAlerts"`
	}
	r = e.do(t, "GET", "/api/v1/data", tk, nil)
	want(t, r, 200)
	r.json(t, &data)
	if len(data.Transactions) != 1 || data.Transactions[0].MonthlyValues["2026-06"] != 170000 {
		t.Errorf("data: %s", r.Body)
	}
	if data.Goals == nil || data.SeenAlerts == nil {
		t.Errorf("listas vazias devem sair como [], não null: %s", r.Body)
	}

	// deixar de ser fixa apaga os valores por mês
	r = e.do(t, "PATCH", "/api/v1/transactions/"+rent.ID, tk, map[string]any{"fixed": false})
	want(t, r, 200)
	rent = tx{}
	r.json(t, &rent)
	if rent.Fixed || len(rent.MonthlyValues) != 0 || len(rent.HiddenMonths) != 0 {
		t.Errorf("após desfixar: %+v", rent)
	}

	want(t, e.do(t, "DELETE", "/api/v1/transactions/"+rent.ID, tk, nil), 204)
	want(t, e.do(t, "DELETE", "/api/v1/transactions/"+rent.ID, tk, nil), 404)
	want(t, e.do(t, "PATCH", "/api/v1/transactions/nao-e-uuid", tk, map[string]any{"name": "x"}), 404)
}

func TestUsersAreIsolated(t *testing.T) {
	e := setup(t)
	a, b := e.register(t, ""), e.register(t, "")

	r := e.do(t, "POST", "/api/v1/transactions", a.AccessToken, map[string]any{"name": "Segredo", "amount": 100, "type": "expense", "category": "Outros", "month": "2026-03"})
	var created tx
	r.json(t, &created)

	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+created.ID, b.AccessToken, map[string]any{"name": "hack"}), 404)
	want(t, e.do(t, "DELETE", "/api/v1/transactions/"+created.ID, b.AccessToken, nil), 404)

	var data struct{ Transactions []tx }
	e.do(t, "GET", "/api/v1/data", b.AccessToken, nil).json(t, &data)
	if len(data.Transactions) != 0 {
		t.Error("o usuário B enxergou dados do A")
	}
	e.do(t, "GET", "/api/v1/data", a.AccessToken, nil).json(t, &data)
	if len(data.Transactions) != 1 || data.Transactions[0].Name != "Segredo" {
		t.Errorf("os dados do A sumiram: %+v", data)
	}
}

func TestOtherEntities(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	// crédito
	r := e.do(t, "POST", "/api/v1/credits", tk, map[string]any{"name": "TV", "totalAmount": 100000, "installments": 3, "startMonth": "2026-01", "category": "Lazer"})
	want(t, r, 201)
	var credit struct{ ID string }
	r.json(t, &credit)
	want(t, e.do(t, "POST", "/api/v1/credits", tk, map[string]any{"name": "TV", "totalAmount": 1, "installments": 0, "startMonth": "2026-01", "category": "Lazer"}), 400)
	want(t, e.do(t, "PATCH", "/api/v1/credits/"+credit.ID, tk, map[string]any{"installments": 4}), 200)

	// meta: o prazo pode ser limpo com null e não muda se nem vier
	r = e.do(t, "POST", "/api/v1/goals", tk, map[string]any{"name": "Viagem", "target": 500000, "saved": 0, "monthly": 50000, "deadline": "2027-06"})
	want(t, r, 201)
	var goal struct {
		ID       string
		Deadline *string
		Saved    int64
	}
	r.json(t, &goal)
	r = e.do(t, "PATCH", "/api/v1/goals/"+goal.ID, tk, map[string]any{"saved": 10000, "yieldTotal": 300})
	want(t, r, 200)
	r.json(t, &goal)
	if goal.Deadline == nil || *goal.Deadline != "2027-06" || goal.Saved != 10000 {
		t.Errorf("prazo não deveria mudar: %s", r.Body)
	}
	r = e.do(t, "PATCH", "/api/v1/goals/"+goal.ID, tk, map[string]any{"deadline": nil})
	want(t, r, 200)
	goal.Deadline = new(string)
	r.json(t, &goal)
	if goal.Deadline != nil {
		t.Errorf("deadline:null deveria limpar o prazo: %s", r.Body)
	}
	want(t, e.do(t, "PATCH", "/api/v1/goals/"+goal.ID, tk, map[string]any{"deadline": "junho"}), 400)

	// despesa extra, anotação, categoria
	r = e.do(t, "POST", "/api/v1/extra-expenses", tk, map[string]any{"name": "IPVA", "amount": 90000, "month": "2026-07"})
	want(t, r, 201)
	var extra struct{ ID string }
	r.json(t, &extra)
	want(t, e.do(t, "PATCH", "/api/v1/extra-expenses/"+extra.ID, tk, map[string]any{"amount": 95000}), 200)

	r = e.do(t, "POST", "/api/v1/notes", tk, map[string]any{"content": "pagar o IPVA", "date": "07/11", "month": "2026-11"})
	want(t, r, 201)
	var note struct{ ID string }
	r.json(t, &note)
	want(t, e.do(t, "PATCH", "/api/v1/notes/"+note.ID, tk, map[string]any{"pinned": true}), 200)
	want(t, e.do(t, "POST", "/api/v1/notes", tk, map[string]any{"content": "  ", "month": "2026-11"}), 400)

	r = e.do(t, "POST", "/api/v1/categories", tk, map[string]any{"name": "Pets", "color": "#FF8800"})
	want(t, r, 201)
	var cat struct{ ID string }
	r.json(t, &cat)
	want(t, e.do(t, "POST", "/api/v1/categories", tk, map[string]any{"name": "pets", "color": "#FF8800"}), 409)
	want(t, e.do(t, "POST", "/api/v1/categories", tk, map[string]any{"name": "Cor", "color": "vermelho"}), 400)
	want(t, e.do(t, "DELETE", "/api/v1/categories/"+cat.ID, tk, nil), 204)

	// configurações
	items := []map[string]any{
		{"id": "emergency", "label": "Reserva", "percent": 40}, {"id": "invest", "label": "Investir", "percent": 20},
		{"id": "leisure", "label": "Lazer", "percent": 20}, {"id": "education", "label": "Educação", "percent": 10},
		{"id": "costs", "label": "Gastos", "percent": 10},
	}
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution", tk, map[string]any{"items": items}), 204)
	items[0]["percent"] = 50
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution", tk, map[string]any{"items": items}), 400) // soma 110
	want(t, e.do(t, "PUT", "/api/v1/settings/seen-alerts", tk, map[string]any{"keys": []string{"a:2026-01:now"}}), 204)

	var data struct {
		Distribution []struct {
			ID      string
			Percent int
		}
		SeenAlerts []string
		Goals      []struct{ YieldTotal int64 }
		Credits    []struct{ Installments int } `json:"creditTransactions"`
	}
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Distribution) != 5 || data.Distribution[0].Percent != 40 || len(data.SeenAlerts) != 1 {
		t.Errorf("settings: %+v", data)
	}
	if data.Goals[0].YieldTotal != 300 || data.Credits[0].Installments != 4 {
		t.Errorf("dados: %+v", data)
	}

	// voltar ao padrão
	want(t, e.do(t, "PUT", "/api/v1/settings/distribution", tk, map[string]any{"items": nil}), 204)
	var again struct{ Distribution []any }
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &again)
	if again.Distribution != nil {
		t.Errorf("distribution deveria voltar a null: %v", again.Distribution)
	}
}

type summaryDTO struct {
	TotalIncome   int64            `json:"totalIncome"`
	TotalExpense  int64            `json:"totalExpense"`
	CreditExpense int64            `json:"creditExpense"`
	Balance       int64            `json:"balance"`
	ByCategory    map[string]int64 `json:"byCategory"`
}

func TestSummaryCacheAndReports(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken
	post := func(path string, body map[string]any) {
		t.Helper()
		want(t, e.do(t, "POST", path, tk, body), 201)
	}

	post("/api/v1/transactions", map[string]any{"name": "Salário", "amount": 500000, "type": "income", "category": "Renda", "month": "2026-01", "fixed": true})
	post("/api/v1/transactions", map[string]any{"name": "Aluguel", "amount": 150000, "type": "expense", "category": "Moradia", "month": "2026-01", "fixed": true})
	post("/api/v1/transactions", map[string]any{"name": "Mercado", "amount": 30000, "type": "expense", "category": "Alimentação", "month": "2026-02"})
	post("/api/v1/credits", map[string]any{"name": "TV", "totalAmount": 100000, "installments": 3, "startMonth": "2026-01", "category": "Lazer"})
	post("/api/v1/extra-expenses", map[string]any{"name": "IPVA", "amount": 40000, "month": "2026-03"})

	get := func(month string) (summaryDTO, string) {
		t.Helper()
		r := e.do(t, "GET", "/api/v1/summary/"+month, tk, nil)
		want(t, r, 200)
		var s summaryDTO
		r.json(t, &s)
		return s, r.Header.Get("X-Cache")
	}

	s, cache := get("2026-02")
	if cache != "MISS" || s.TotalIncome != 500000 || s.TotalExpense != 150000+30000+33333 || s.CreditExpense != 33333 {
		t.Errorf("resumo: %+v (%s)", s, cache)
	}
	if s.ByCategory["Crédito/Parcelado"] != 33333 {
		t.Errorf("categorias: %v", s.ByCategory)
	}
	if _, cache := get("2026-02"); cache != "HIT" {
		t.Errorf("segunda leitura deveria vir do cache, veio %s", cache)
	}

	// escrever invalida o cache do usuário
	post("/api/v1/transactions", map[string]any{"name": "Cinema", "amount": 5000, "type": "expense", "category": "Lazer", "month": "2026-02"})
	s, cache = get("2026-02")
	if cache != "MISS" || s.TotalExpense != 150000+30000+5000+33333 {
		t.Errorf("depois da escrita: %+v (%s)", s, cache)
	}

	// o cache de um usuário não vaza para outro
	other := e.register(t, "").AccessToken
	r := e.do(t, "GET", "/api/v1/summary/2026-02", other, nil)
	var empty summaryDTO
	r.json(t, &empty)
	if r.Header.Get("X-Cache") != "MISS" || empty.TotalIncome != 0 {
		t.Errorf("outro usuário: %s", r.Body)
	}
	want(t, e.do(t, "GET", "/api/v1/summary/2026-13", tk, nil), 400)

	// projeção: fixas + parcelas + extras
	r = e.do(t, "GET", "/api/v1/projection?start=2026-02&count=3", tk, nil)
	want(t, r, 200)
	var proj []struct {
		Month                string
		Income, Expense      int64
		ExtraExpense         int64
		Balance, Accumulated int64
	}
	r.json(t, &proj)
	if len(proj) != 3 || proj[0].Expense != 150000+33333 || proj[1].ExtraExpense != 40000 || proj[2].Accumulated != proj[0].Balance+proj[1].Balance+proj[2].Balance {
		t.Errorf("projeção: %+v", proj)
	}
	want(t, e.do(t, "GET", "/api/v1/projection?count=0", tk, nil), 400)
	want(t, e.do(t, "GET", "/api/v1/projection?count=99", tk, nil), 400)

	// comparação
	r = e.do(t, "GET", "/api/v1/comparison?months=2026-01,2026-02", tk, nil)
	want(t, r, 200)
	var cmp struct {
		Months  []summaryDTO
		Ranking []string
		Balance int64
	}
	r.json(t, &cmp)
	if len(cmp.Months) != 2 || len(cmp.Ranking) != 2 || cmp.Ranking[0] != "2026-01" {
		t.Errorf("comparação: %s", r.Body)
	}
	want(t, e.do(t, "GET", "/api/v1/comparison?months=2026-01", tk, nil), 400)
	want(t, e.do(t, "GET", "/api/v1/comparison?months=2026-01,xx", tk, nil), 400)
}

func TestImport(t *testing.T) {
	e := setup(t)
	tk := e.register(t, "").AccessToken

	payload := map[string]any{
		"transactions": []map[string]any{
			{"id": "abc", "name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "month": "2026-03", "fixed": true, "hiddenMonths": []string{"2026-05"}, "monthlyValues": map[string]int64{"2026-04": 0}},
			{"id": "def", "name": "Salário", "amount": 400000, "type": "income", "category": "Renda", "month": "2026-03"},
		},
		"creditTransactions": []map[string]any{{"name": "TV", "totalAmount": 90000, "installments": 3, "startMonth": "2026-03", "category": "Lazer"}},
		"notes":              []map[string]any{{"content": "oi", "date": "01/03", "month": "2026-03"}},
		"goals":              []map[string]any{{"name": "Viagem", "target": 100000, "saved": 5000, "monthly": 1000, "deadline": "2027-01"}},
		"extraExpenses":      []map[string]any{{"name": "IPVA", "amount": 30000, "month": "2026-04"}},
		"customCategories":   []map[string]any{{"name": "Pets", "color": "#112233"}},
		"distribution":       nil,
		"seenAlerts":         []string{"x:2027-01:soon"},
	}

	r := e.do(t, "POST", "/api/v1/import", tk, payload)
	want(t, r, 201)
	var out struct {
		Transactions []tx `json:"transactions"`
		Notes        []any
		SeenAlerts   []string
	}
	r.json(t, &out)
	if len(out.Transactions) != 2 || len(out.Notes) != 1 || len(out.SeenAlerts) != 1 {
		t.Fatalf("importado: %s", r.Body)
	}
	if out.Transactions[0].ID == "abc" {
		t.Error("o id de origem deveria ser trocado pelo do banco")
	}
	if len(out.Transactions[0].HiddenMonths) != 1 || out.Transactions[0].MonthlyValues["2026-04"] != 0 {
		t.Errorf("overrides não importados: %+v", out.Transactions[0])
	}

	// importar de novo não duplica, a não ser que peça para substituir
	want(t, e.do(t, "POST", "/api/v1/import", tk, payload), 409)
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", tk, payload), 201)
	var data struct{ Transactions []tx }
	e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &data)
	if len(data.Transactions) != 2 {
		t.Errorf("após substituir: %d transações", len(data.Transactions))
	}

	// dado inválido recusa tudo (nada é gravado pela metade)
	fresh := e.register(t, "").AccessToken
	bad := map[string]any{"transactions": []map[string]any{
		{"name": "Ok", "amount": 1, "type": "expense", "category": "Outros", "month": "2026-03"},
		{"name": "Quebrado", "amount": 1, "type": "expense", "category": "Outros", "month": "março"},
	}}
	want(t, e.do(t, "POST", "/api/v1/import", fresh, bad), 400)
	e.do(t, "GET", "/api/v1/data", fresh, nil).json(t, &data)
	if len(data.Transactions) != 0 {
		t.Error("importação inválida não deveria gravar nada")
	}
}

func TestHealthAndCORS(t *testing.T) {
	e := setup(t)
	want(t, e.do(t, "GET", "/healthz", "", nil), 200)

	req, _ := http.NewRequest("OPTIONS", e.srv.URL+"/api/v1/data", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.Header.Get("Access-Control-Allow-Origin") != "http://localhost:5173" || res.Header.Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("CORS: %v", res.Header)
	}
}

// O front cria o UUID e usa o mesmo id nas atualizações seguintes; a API precisa respeitá-lo.
func TestClientGeneratedIDs(t *testing.T) {
	e := setup(t)
	a, b := e.register(t, ""), e.register(t, "")
	id := "6f1c1f4e-8a3b-4a43-9a52-1d3c8f0b7a11"

	r := e.do(t, "POST", "/api/v1/transactions", a.AccessToken, map[string]any{"id": id, "name": "Mercado", "amount": 1000, "type": "expense", "category": "Outros", "month": "2026-03"})
	want(t, r, 201)
	var created tx
	r.json(t, &created)
	if created.ID != id {
		t.Fatalf("id = %s, esperado o enviado pelo cliente (%s)", created.ID, id)
	}
	want(t, e.do(t, "PATCH", "/api/v1/transactions/"+id, a.AccessToken, map[string]any{"name": "Feira"}), 200)

	// id que já existe em outra conta: conflito, sem vazar nem sobrescrever
	want(t, e.do(t, "POST", "/api/v1/transactions", b.AccessToken, map[string]any{"id": id, "name": "Outro", "amount": 1, "type": "expense", "category": "Outros", "month": "2026-03"}), 409)

	// id que não é UUID: o banco gera um
	r = e.do(t, "POST", "/api/v1/goals", a.AccessToken, map[string]any{"id": "abc", "name": "Viagem", "target": 5000})
	want(t, r, 201)
	var g struct{ ID string }
	r.json(t, &g)
	if g.ID == "" || g.ID == "abc" {
		t.Errorf("id de meta = %q", g.ID)
	}
}

func TestOnboarding(t *testing.T) {
	e := setup(t)
	a, b := e.register(t, "").AccessToken, e.register(t, "").AccessToken

	read := func(tk string) map[string]string {
		var d struct{ Onboarding map[string]string }
		e.do(t, "GET", "/api/v1/data", tk, nil).json(t, &d)
		return d.Onboarding
	}
	if got := read(a); got == nil || len(got) != 0 {
		t.Fatalf("conta nova deveria vir com mapa vazio, veio %#v", got)
	}

	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/painel", a, map[string]string{"state": "done"}), 204)
	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/metas", a, map[string]string{"state": "dismissed"}), 204)
	// mudar uma tela não apaga as outras
	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/painel", a, map[string]string{"state": "dismissed"}), 204)
	got := read(a)
	if len(got) != 2 || got["painel"] != "dismissed" || got["metas"] != "dismissed" {
		t.Errorf("onboarding = %#v", got)
	}
	if len(read(b)) != 0 {
		t.Error("o onboarding de A apareceu para B")
	}

	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/painel", a, map[string]string{"state": "talvez"}), 400)
	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/Tela_Ruim", a, map[string]string{"state": "done"}), 400)
	want(t, e.do(t, "PUT", "/api/v1/settings/onboarding/painel", "", map[string]string{"state": "done"}), 401)

	// importação: respostas dos tours do navegador entram na conta
	imp := map[string]any{"onboarding": map[string]string{"projecao": "done"}}
	want(t, e.do(t, "POST", "/api/v1/import", b, imp), 201)
	if got := read(b); got["projecao"] != "done" {
		t.Errorf("após importar: %#v", got)
	}
	bad := map[string]any{"onboarding": map[string]string{"painel": "x"}}
	want(t, e.do(t, "POST", "/api/v1/import?replace=true", b, bad), 400)
}
