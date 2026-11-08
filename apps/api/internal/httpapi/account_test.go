package httpapi_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"aurora/api/internal/config"
)

func TestLogoutRevokesAccessToken(t *testing.T) {
	e := setup(t)
	s := e.register(t, "")
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 200)

	want(t, e.do(t, "POST", "/api/v1/auth/logout", s.AccessToken, nil, s.refresh), 204)
	// o token de acesso não vale mais, mesmo antes de expirar
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 401)
}

func TestExportAccount(t *testing.T) {
	e := setup(t)
	a, b := e.register(t, ""), e.register(t, "")
	want(t, e.do(t, "POST", "/api/v1/transactions", a.AccessToken, map[string]any{
		"name": "Mercado", "amount": 1234, "type": "expense", "category": "Alimentação", "month": "2026-11",
	}), 201)

	want(t, e.do(t, "GET", "/api/v1/me/export", "", nil), 401)
	r := e.do(t, "GET", "/api/v1/me/export", a.AccessToken, nil)
	want(t, r, 200)
	if !strings.Contains(string(r.Body), "Mercado") || !strings.Contains(string(r.Body), a.User.Email) {
		t.Fatalf("export sem os dados do titular: %s", r.Body)
	}
	if strings.Contains(string(r.Body), "password") {
		t.Fatalf("export não pode conter hash de senha: %s", r.Body)
	}
	// o outro usuário não vê nada do primeiro
	rb := e.do(t, "GET", "/api/v1/me/export", b.AccessToken, nil)
	if strings.Contains(string(rb.Body), "Mercado") || strings.Contains(string(rb.Body), a.User.Email) {
		t.Fatalf("export vazou dados de outro usuário: %s", rb.Body)
	}
}

func TestDeleteAccount(t *testing.T) {
	e := setup(t)
	s := e.register(t, "")
	other := e.register(t, "")
	want(t, e.do(t, "POST", "/api/v1/transactions", s.AccessToken, map[string]any{
		"name": "Aluguel", "amount": 100000, "type": "expense", "category": "Moradia", "month": "2026-11",
	}), 201)

	want(t, e.do(t, "DELETE", "/api/v1/me", "", map[string]string{"password": "senha-forte-123"}), 401)
	// senha errada: nada é apagado
	want(t, e.do(t, "DELETE", "/api/v1/me", s.AccessToken, map[string]string{"password": "errada-errada"}), 403)
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 200)

	want(t, e.do(t, "DELETE", "/api/v1/me", s.AccessToken, map[string]string{"password": "senha-forte-123"}), 204)
	// token de acesso e refresh deixam de valer; não dá para entrar de novo
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 401)
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, s.refresh), 401)
	want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": s.User.Email, "password": "senha-forte-123"}), 401)

	// os dados sumiram do banco e o outro usuário não foi tocado
	if _, err := e.st.UserByID(t.Context(), mustUUID(t, s.User.ID)); err == nil {
		t.Fatal("usuário ainda existe no banco")
	}
	want(t, e.do(t, "GET", "/api/v1/me", other.AccessToken, nil), 200)
}

func TestDeleteAccountPasswordBruteForceIsLimited(t *testing.T) {
	e := setup(t) // LoginMaxAttempts = 3
	s := e.register(t, "")
	for i := 0; i < 3; i++ {
		want(t, e.do(t, "DELETE", "/api/v1/me", s.AccessToken, map[string]string{"password": "errada-errada"}), 403)
	}
	// bloqueado: nem a senha certa passa até a janela acabar
	want(t, e.do(t, "DELETE", "/api/v1/me", s.AccessToken, map[string]string{"password": "senha-forte-123"}), http.StatusTooManyRequests)
}

func TestAPIRateLimitPerUser(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.APIRateMax = 5 })
	a, b := e.register(t, ""), e.register(t, "")
	for i := 0; i < 5; i++ {
		want(t, e.do(t, "GET", "/api/v1/me", a.AccessToken, nil), 200)
	}
	r := e.do(t, "GET", "/api/v1/me", a.AccessToken, nil)
	want(t, r, http.StatusTooManyRequests)
	if r.Header.Get("Retry-After") == "" {
		t.Error("falta Retry-After")
	}
	// o limite é por usuário: o outro segue normal
	want(t, e.do(t, "GET", "/api/v1/me", b.AccessToken, nil), 200)
}

func mustUUID(t *testing.T, s string) uuid.UUID {
	t.Helper()
	id, err := uuid.Parse(s)
	if err != nil {
		t.Fatal(err)
	}
	return id
}
