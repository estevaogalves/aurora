package config

import (
	"strings"
	"testing"
)

func TestCheckJWTSecret(t *testing.T) {
	good := "9f2c6b1e4a7d8035c1be92f46ad07e3b58c4d1a9f06e27b3" // 48 caracteres variados
	cases := []struct {
		name, secret string
		ok           bool
	}{
		{"vazio", "", false},
		{"curto", "abc123", false},
		{"31 caracteres", good[:31], false},
		{"padrão do compose/.env.example", "dev-only-secret-change-me-0123456789abcdef", false},
		{"exemplo em maiúsculas", strings.ToUpper("meu-segredo-de-exemplo-bem-comprido-123456"), false},
		{"um caractere repetido", strings.Repeat("k", 64), false},
		{"poucos caracteres distintos", strings.Repeat("ab12", 16), false},
		{"hex de openssl rand -hex 32", "3f9a1c7e5b2d48860e1fa3c9d7b45e2a91c06d8b7f3e4a5c2d1b0e9f8a7c6d5b", true},
		{"48 caracteres variados", good, true},
	}
	for _, c := range cases {
		if err := checkJWTSecret(c.secret); (err == nil) != c.ok {
			t.Errorf("%s: ok=%v, erro=%v", c.name, c.ok, err)
		}
	}
}

func TestLoadRejectsExampleSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", "dev-only-secret-change-me-0123456789abcdef")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("Load devia recusar o segredo de exemplo, erro=%v", err)
	}
	t.Setenv("JWT_SECRET", "3f9a1c7e5b2d48860e1fa3c9d7b45e2a91c06d8b7f3e4a5c2d1b0e9f8a7c6d5b")
	if _, err := Load(); err != nil {
		t.Fatalf("segredo forte deveria passar: %v", err)
	}
}
