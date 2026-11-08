package httpapi_test

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"aurora/api/internal/auth"
	"aurora/api/internal/config"
)

// REGISTRATION_ENABLED=false: o cadastro responde 403 com mensagem clara; o login continua.
func TestRegistrationClosed(t *testing.T) {
	e := setup(t, func(c *config.Config) {
		c.RegistrationDisabled = true
		c.RegisterMaxPerIP = 1 // se o cadastro fechado contasse no limite por IP, o 2º pedido daria 429
		c.RegisterWindow = time.Hour
	})
	ctx := context.Background()

	email := fmt.Sprintf("fechado-%d@aurora.test", time.Now().UnixNano())
	body := map[string]string{"email": email, "name": "Fulano", "password": "senha-forte-123"}

	for i := 0; i < 3; i++ {
		r := e.do(t, "POST", "/api/v1/auth/register", "", body)
		want(t, r, 403)
		if !strings.Contains(string(r.Body), "cadastro está fechado") {
			t.Fatalf("mensagem pouco clara: %s", r.Body)
		}
	}
	// pedido sem corpo ou inválido também recebe o mesmo 403 (decide antes de ler o corpo)
	want(t, e.do(t, "POST", "/api/v1/auth/register", "", nil), 403)

	// nada foi criado: o e-mail não consegue entrar
	want(t, e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": "senha-forte-123"}), 401)

	// quem já tem conta continua entrando e usando a API (conta criada direto no banco, como se fosse antiga)
	hash, err := auth.HashPassword("senha-forte-123")
	if err != nil {
		t.Fatal(err)
	}
	old := fmt.Sprintf("antigo-%d@aurora.test", time.Now().UnixNano())
	if _, err := e.st.CreateUser(ctx, old, "Antigo", hash, "user"); err != nil {
		t.Fatal(err)
	}
	r := e.do(t, "POST", "/api/v1/auth/login", "", map[string]string{"email": old, "password": "senha-forte-123"})
	want(t, r, 200)
	var s session
	r.json(t, &s)
	want(t, e.do(t, "GET", "/api/v1/me", s.AccessToken, nil), 200)
	want(t, e.do(t, "POST", "/api/v1/auth/refresh", "", nil, r.cookie("aurora_refresh")), 200)
}

// Padrão: cadastro aberto (a flag só existe para fechar).
func TestRegistrationOpenByDefault(t *testing.T) {
	e := setup(t)
	if s := e.register(t, ""); s.User.Role != "user" {
		t.Fatalf("papel: %q", s.User.Role)
	}
}
