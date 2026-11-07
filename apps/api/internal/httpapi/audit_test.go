package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"aurora/api/internal/config"
)

// SEC-13: logs de auditoria só com hora, tipo do evento, id do usuário e IP.

type syncBuffer struct {
	mu sync.Mutex
	b  bytes.Buffer
}

func (s *syncBuffer) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.Write(p)
}

func (s *syncBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.b.String()
}

type auditEvent struct {
	Event  string `json:"event"`
	UserID string `json:"user_id"`
	IP     string `json:"ip"`
	Keys   []string
}

// auditEvents devolve só as linhas msg="audit" e confere que cada uma tem exatamente os campos permitidos.
func (e *env) auditEvents(t *testing.T) []auditEvent {
	t.Helper()
	allowed := map[string]bool{"time": true, "level": true, "msg": true, "event": true, "user_id": true, "ip": true}
	var out []auditEvent
	for _, line := range strings.Split(strings.TrimSpace(e.logs.String()), "\n") {
		if line == "" {
			continue
		}
		var raw map[string]any
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			t.Fatalf("linha de log que não é JSON: %q", line)
		}
		if raw["msg"] != "audit" {
			continue
		}
		var ev auditEvent
		for k := range raw {
			ev.Keys = append(ev.Keys, k)
			if !allowed[k] {
				t.Fatalf("campo %q não é permitido na auditoria: %s", k, line)
			}
		}
		sort.Strings(ev.Keys)
		for _, must := range []string{"time", "event", "ip"} {
			if _, ok := raw[must]; !ok {
				t.Fatalf("faltou %q no evento: %s", must, line)
			}
		}
		_ = json.Unmarshal([]byte(line), &ev)
		out = append(out, ev)
	}
	return out
}

func (e *env) names(t *testing.T) []string {
	var n []string
	for _, ev := range e.auditEvents(t) {
		n = append(n, ev.Event)
	}
	return n
}

func has(list []auditEvent, event, user string) bool {
	for _, ev := range list {
		if ev.Event == event && ev.UserID == user {
			return true
		}
	}
	return false
}

func TestAuditEventsAndNoSensitiveData(t *testing.T) {
	e := setup(t) // LoginMaxAttempts = 3

	const secretPassword = "senha-ultra-secreta-9X!"
	email := fmt.Sprintf("auditoria-%d@aurora.test", time.Now().UnixNano())
	reg := e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": email, "name": "Nome Sensivel Silva", "password": secretPassword})
	want(t, reg, 201)
	var s session
	reg.json(t, &s)
	s.refresh = reg.cookie("aurora_refresh")
	uid := s.User.ID

	// 3 senhas erradas do usuário existente -> login_failed COM id; e-mail que não existe -> SEM id
	for i := 0; i < 3; i++ {
		want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": "errada-" + secretPassword}), 401)
	}
	ghost := fmt.Sprintf("fantasma-%d@aurora.test", time.Now().UnixNano())
	want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": ghost, "password": secretPassword}), 401)
	// bloqueado
	want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": secretPassword}), 429)
	e.mr.FastForward(time.Hour)

	// sessão A: login ok e logout (revoga o refresh e gera auth.logout)
	login := func() (session, *http.Cookie) {
		r := e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": secretPassword})
		want(t, r, 200)
		var x session
		r.json(t, &x)
		return x, r.cookie("aurora_refresh")
	}
	_, cookieA := login()
	want(t, e.do(t, "POST", "/api/v1/auth/logout", "", nil, cookieA), 204)

	// sessão B: refresh normal e depois reuso do token já gasto (encerra as sessões)
	s2, old := login()
	rf := e.do(t, "POST", "/api/v1/auth/refresh", "", nil, old)
	want(t, rf, 200)
	newer := rf.cookie("aurora_refresh")
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, old), 401)

	// refresh com um token qualquer -> refresh_invalid, sem id
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, &http.Cookie{Name: "aurora_refresh", Value: "lixo-qualquer"}), 401)

	// admin lista usuários
	if _, _, err := e.st.PromoteAdmin(context.Background(), email); err != nil {
		t.Fatal(err)
	}
	adm := e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": secretPassword})
	var as session
	adm.json(t, &as)
	e.mr.FastForward(time.Hour)
	want(t, e.do(t, "GET", "/api/v1/admin/users", as.AccessToken, nil), 200)

	evs := e.auditEvents(t)
	for _, c := range []struct{ event, user string }{
		{"auth.register", uid},
		{"auth.login_failed", uid},
		{"auth.login_failed", ""}, // e-mail inexistente: sem id
		{"auth.login_blocked", ""},
		{"auth.login_success", uid},
		{"auth.logout", uid},
		{"auth.refresh", uid},
		{"auth.refresh_reuse", uid},
		{"auth.refresh_invalid", ""},
		{"admin.list_users", uid},
	} {
		if !has(evs, c.event, c.user) {
			t.Errorf("faltou o evento %s (user_id=%q). Eventos: %v", c.event, c.user, e.names(t))
		}
	}

	// IP sempre presente e igual ao do cliente de teste
	for _, ev := range evs {
		if ev.IP != "127.0.0.1" {
			t.Errorf("ip = %q", ev.IP)
		}
	}

	// NADA sensível em NENHUMA linha do log (nem de auditoria, nem de acesso, nem de erro)
	all := e.logs.String()
	for name, secret := range map[string]string{
		"senha":                 secretPassword,
		"senha errada":          "errada-" + secretPassword,
		"e-mail":                email,
		"e-mail inexistente":    ghost,
		"nome":                  "Nome Sensivel Silva",
		"access token":          s2.AccessToken,
		"access token do admin": as.AccessToken,
		"refresh token":         old.Value,
		"refresh token novo":    newer.Value,
	} {
		if secret != "" && strings.Contains(all, secret) {
			t.Errorf("o log contém %s", name)
		}
	}
}

func TestRegisterRateLimitedIsAudited(t *testing.T) {
	e := setup(t, func(c *config.Config) { c.RegisterMaxPerIP = 1; c.RegisterWindow = time.Hour })
	e.register(t, "")
	r := e.do(t, "POST", "/api/v1/auth/register", "", map[string]string{"email": "x-" + fmt.Sprint(time.Now().UnixNano()) + "@aurora.test", "name": "x", "password": "senha-forte-123"})
	want(t, r, 429)
	if !has(e.auditEvents(t), "auth.register_rate_limited", "") {
		t.Errorf("faltou auth.register_rate_limited: %v", e.names(t))
	}
}
