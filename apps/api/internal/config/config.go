// Package config lê a configuração da API das variáveis de ambiente.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// "production" (padrão) ou "development". Em produção, COOKIE_SECURE=false é recusado.
	AppEnv      string
	Addr        string
	DatabaseURL string
	// Opcional: conexão direta só para as migrations (use quando DatabaseURL passa por um pooler em modo transação).
	MigrateDatabaseURL string
	RedisURL           string
	JWTSecret          string
	AccessTTL          time.Duration
	RefreshTTL         time.Duration
	CookieSecure       bool
	// Confia em X-Forwarded-For/X-Real-IP (só ligue atrás de um proxy seu).
	TrustProxy    bool
	AllowedOrigin []string
	// Se preenchido, o usuário com este e-mail vira admin ao se cadastrar.
	AdminEmail string
	// Limite de tentativas de login por e-mail+IP na janela.
	LoginMaxAttempts int
	LoginWindow      time.Duration
}

func Load() (Config, error) {
	c := Config{
		AppEnv:             strings.ToLower(env("APP_ENV", "production")),
		Addr:               env("API_ADDR", ":8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		MigrateDatabaseURL: os.Getenv("MIGRATE_DATABASE_URL"),
		RedisURL:           env("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		AccessTTL:          envDuration("ACCESS_TTL", 15*time.Minute),
		RefreshTTL:         envDuration("REFRESH_TTL", 30*24*time.Hour),
		CookieSecure:       envBool("COOKIE_SECURE", true),
		TrustProxy:         envBool("TRUST_PROXY", false),
		AdminEmail:         strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))),
		LoginMaxAttempts:   envInt("LOGIN_MAX_ATTEMPTS", 5),
		LoginWindow:        envDuration("LOGIN_WINDOW", 15*time.Minute),
	}
	for _, o := range strings.Split(env("CORS_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.AllowedOrigin = append(c.AllowedOrigin, o)
		}
	}

	var problems []error
	switch c.AppEnv {
	case "production":
		if !c.CookieSecure {
			problems = append(problems, errors.New("COOKIE_SECURE=false não é permitido com APP_ENV=production: sirva por HTTPS ou use APP_ENV=development só em desenvolvimento local"))
		}
	case "development":
	default:
		problems = append(problems, fmt.Errorf("APP_ENV deve ser production ou development, recebi %q", c.AppEnv))
	}
	if c.DatabaseURL == "" {
		problems = append(problems, errors.New("DATABASE_URL é obrigatória"))
	}
	if err := checkJWTSecret(c.JWTSecret); err != nil {
		problems = append(problems, err)
	}
	return c, errors.Join(problems...)
}

// weakSecretMarkers são trechos que denunciam segredos de exemplo (do .env.example, do README, de tutoriais).
var weakSecretMarkers = []string{
	"dev-only", "change-me", "changeme", "example", "exemplo", "placeholder",
	"your-secret", "your_secret", "password", "senha", "0123456789abcdef",
}

const (
	minSecretLen      = 32
	minSecretDistinct = 10
)

// checkJWTSecret recusa segredo ausente, curto, de exemplo ou de baixa entropia (ex.: "aaaa…").
// Gere um bom com: openssl rand -hex 32
func checkJWTSecret(secret string) error {
	if len(secret) < minSecretLen {
		return errors.New("JWT_SECRET é obrigatória e precisa ter ao menos 32 caracteres (gere com: openssl rand -hex 32)")
	}
	lower := strings.ToLower(secret)
	for _, m := range weakSecretMarkers {
		if strings.Contains(lower, m) {
			return errors.New("JWT_SECRET parece um valor de exemplo; gere um segredo próprio com: openssl rand -hex 32")
		}
	}
	distinct := map[rune]struct{}{}
	for _, r := range secret {
		distinct[r] = struct{}{}
	}
	if len(distinct) < minSecretDistinct {
		return errors.New("JWT_SECRET tem pouca variedade de caracteres; gere um segredo aleatório com: openssl rand -hex 32")
	}
	return nil
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	if v, err := strconv.ParseBool(os.Getenv(key)); err == nil {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return def
}

func envDuration(key string, def time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
		fmt.Fprintf(os.Stderr, "aviso: %s=%q inválido, usando %s\n", key, v, def)
	}
	return def
}
