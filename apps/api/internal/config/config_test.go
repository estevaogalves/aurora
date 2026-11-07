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

const strongSecret = "3f9a1c7e5b2d48860e1fa3c9d7b45e2a91c06d8b7f3e4a5c2d1b0e9f8a7c6d5b"

func baseEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("JWT_SECRET", strongSecret)
	t.Setenv("APP_ENV", "")
	t.Setenv("COOKIE_SECURE", "")
}

func TestCookieSecureDefaultsToTrue(t *testing.T) {
	baseEnv(t)
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if !c.CookieSecure || c.AppEnv != "production" {
		t.Fatalf("padrões: CookieSecure=%v AppEnv=%q", c.CookieSecure, c.AppEnv)
	}
}

func TestProductionRefusesInsecureCookie(t *testing.T) {
	baseEnv(t)
	t.Setenv("COOKIE_SECURE", "false")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "COOKIE_SECURE") {
		t.Fatalf("produção com COOKIE_SECURE=false deveria falhar, erro=%v", err)
	}
	t.Setenv("APP_ENV", "production")
	if _, err := Load(); err == nil {
		t.Fatal("APP_ENV=production explícito também deveria falhar")
	}
}

func TestDevelopmentAllowsInsecureCookie(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "development")
	t.Setenv("COOKIE_SECURE", "false")
	c, err := Load()
	if err != nil || c.CookieSecure {
		t.Fatalf("dev deveria permitir cookie sem Secure: err=%v secure=%v", err, c.CookieSecure)
	}
}

func TestUnknownAppEnvIsRejected(t *testing.T) {
	baseEnv(t)
	t.Setenv("APP_ENV", "staging")
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("APP_ENV desconhecido deveria falhar, erro=%v", err)
	}
}

func TestAbuseProtectionDefaults(t *testing.T) {
	baseEnv(t)
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.RegisterMaxPerIP != 5 || c.RegisterWindow.String() != "1h0m0s" {
		t.Errorf("cadastro por IP: %d / %v", c.RegisterMaxPerIP, c.RegisterWindow)
	}
	if c.HashMaxConcurrency != 0 || c.HashMaxQueue != 0 || c.HashQueueTimeout.String() != "3s" {
		t.Errorf("hash: %d / %d / %v", c.HashMaxConcurrency, c.HashMaxQueue, c.HashQueueTimeout)
	}

	// valores vazios vindos do compose (VAR=) continuam valendo os padrões
	t.Setenv("HASH_MAX_CONCURRENCY", "")
	t.Setenv("REGISTER_MAX_PER_IP", "")
	t.Setenv("HASH_QUEUE_TIMEOUT", "")
	if c2, err := Load(); err != nil || c2.RegisterMaxPerIP != 5 || c2.HashQueueTimeout.String() != "3s" {
		t.Errorf("vazio deveria cair no padrão: %+v %v", c2, err)
	}

	t.Setenv("HASH_MAX_CONCURRENCY", "2")
	t.Setenv("REGISTER_MAX_PER_IP", "9")
	t.Setenv("HASH_QUEUE_TIMEOUT", "500ms")
	c3, _ := Load()
	if c3.HashMaxConcurrency != 2 || c3.RegisterMaxPerIP != 9 || c3.HashQueueTimeout.String() != "500ms" {
		t.Errorf("sobrescrita: %+v", c3)
	}
}

func TestLimitsAndPoolDefaults(t *testing.T) {
	baseEnv(t)
	c, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if c.DBMaxConns != 10 || c.DBStatementTimeout.String() != "15s" {
		t.Errorf("pool: %d / %v", c.DBMaxConns, c.DBStatementTimeout)
	}
	if c.MaxBodyBytes != 256<<10 || c.MaxImportBytes != 10<<20 || c.MaxImportItems != 25000 ||
		c.MaxMonthOverrides != 600 || c.MaxCustomCategories != 200 || c.MaxDistributionItems != 50 {
		t.Errorf("tetos: %+v", c)
	}

	t.Setenv("DB_MAX_CONNS", "25")
	t.Setenv("DB_STATEMENT_TIMEOUT", "0") // desliga (pooler que rejeita parâmetros de inicialização)
	t.Setenv("MAX_IMPORT_ITEMS", "1000")
	t.Setenv("MAX_BODY_BYTES", "4096")
	c, _ = Load()
	if c.DBMaxConns != 25 || c.DBStatementTimeout != 0 || c.MaxImportItems != 1000 || c.MaxBodyBytes != 4096 {
		t.Errorf("sobrescrita: %+v", c)
	}

	t.Setenv("DB_STATEMENT_TIMEOUT", "-5s") // inválido volta ao padrão
	t.Setenv("DB_MAX_CONNS", "-1")
	c, _ = Load()
	if c.DBStatementTimeout.String() != "15s" || c.DBMaxConns != 10 {
		t.Errorf("inválidos deveriam cair no padrão: %v / %d", c.DBStatementTimeout, c.DBMaxConns)
	}
}
