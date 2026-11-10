// Package config lê a configuração da API das variáveis de ambiente.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// "production" (padrão) ou "development". Em produção, COOKIE_SECURE=false é recusado.
	AppEnv      string
	Addr        string
	// Arquivo do banco SQLite (DB_PATH). A pasta é criada se não existir.
	DBPath string
	// Opcional: URL de um Redis externo. Vazia (padrão), a API sobe um Redis embutido no próprio processo
	// (cache, limites de requisição e refresh tokens ficam na memória e somem ao reiniciar).
	RedisURL     string
	JWTSecret    string
	AccessTTL    time.Duration
	RefreshTTL   time.Duration
	CookieSecure bool
	// Confia em X-Forwarded-For/X-Real-IP (só ligue atrás de um proxy seu).
	TrustProxy    bool
	AllowedOrigin []string
	// Limite de tentativas de login por e-mail+IP na janela.
	LoginMaxAttempts int
	LoginWindow      time.Duration

	// Hashing de senha (argon2id usa 64 MiB por hash). 0 = calcular pelo limite de memória do processo.
	HashMaxConcurrency int
	// Quantos pedidos podem esperar por uma vaga de hash. 0 = 4 x a concorrência.
	HashMaxQueue int
	// Tempo máximo na fila; depois disso a API responde 503.
	HashQueueTimeout time.Duration
	// Cadastros por IP na janela (429 ao passar). A chave é o IP: com proxy na frente, TRUST_PROXY deve estar ligado.
	RegisterMaxPerIP int
	RegisterWindow   time.Duration
	// REGISTRATION_ENABLED=false fecha o cadastro (403 com mensagem clara). Guardado ao contrário para que o
	// valor zero (testes, Config montada à mão) continue significando "cadastro aberto".
	RegistrationDisabled bool
	// Requisições autenticadas por usuário na janela (429 ao passar). 0 = sem limite (testes).
	APIRateMax    int
	APIRateWindow time.Duration

	// Tetos de requisição (calibragem em httpapi/limits.go).
	MaxBodyBytes         int64 // corpo de uma requisição comum
	MaxImportBytes       int64 // corpo da importação
	MaxImportItems       int   // itens por coleção na importação
	MaxMonthOverrides    int   // hiddenMonths + monthlyValues de UMA despesa fixa
	MaxCustomCategories  int   // categorias próprias na importação
	MaxDistributionItems int   // itens da distribuição do saldo
}

func Load() (Config, error) {
	c := Config{
		AppEnv:             strings.ToLower(env("APP_ENV", "production")),
		Addr:               env("API_ADDR", ":8080"),
		DBPath:             env("DB_PATH", "/data/aurora.db"),
		RedisURL:           os.Getenv("REDIS_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		AccessTTL:          envDuration("ACCESS_TTL", 15*time.Minute),
		RefreshTTL:         envDuration("REFRESH_TTL", 30*24*time.Hour),
		CookieSecure:       envBool("COOKIE_SECURE", true),
		TrustProxy:         envBool("TRUST_PROXY", false),
		LoginMaxAttempts:   envInt("LOGIN_MAX_ATTEMPTS", 5),
		LoginWindow:        envDuration("LOGIN_WINDOW", 15*time.Minute),

		HashMaxConcurrency: envInt("HASH_MAX_CONCURRENCY", 0),
		HashMaxQueue:       envInt("HASH_MAX_QUEUE", 0),
		HashQueueTimeout:   envDuration("HASH_QUEUE_TIMEOUT", 3*time.Second),
		RegisterMaxPerIP:   envInt("REGISTER_MAX_PER_IP", 5),
		RegisterWindow:     envDuration("REGISTER_WINDOW", time.Hour),
		APIRateMax:         envInt("API_RATE_MAX", 600),
		APIRateWindow:      envDuration("API_RATE_WINDOW", time.Minute),

		MaxBodyBytes:         int64(envInt("MAX_BODY_BYTES", 256<<10)),
		MaxImportBytes:       int64(envInt("MAX_IMPORT_BYTES", 10<<20)),
		MaxImportItems:       envInt("MAX_IMPORT_ITEMS", 25000),
		MaxMonthOverrides:    envInt("MAX_MONTH_OVERRIDES", 600),
		MaxCustomCategories:  envInt("MAX_CUSTOM_CATEGORIES", 200),
		MaxDistributionItems: envInt("MAX_DISTRIBUTION_ITEMS", 50),
	}
	for _, o := range strings.Split(env("CORS_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.AllowedOrigin = append(c.AllowedOrigin, o)
		}
	}

	var problems []error
	// Valor inválido NÃO pode deixar o cadastro aberto por engano (ex.: "nao" ou "off" digitados para fechá-lo).
	if v := strings.TrimSpace(os.Getenv("REGISTRATION_ENABLED")); v != "" {
		enabled, err := strconv.ParseBool(v)
		if err != nil {
			problems = append(problems, fmt.Errorf("REGISTRATION_ENABLED=%q inválido: use true ou false", v))
		}
		c.RegistrationDisabled = err == nil && !enabled
	}
	switch c.AppEnv {
	case "production":
		if !c.CookieSecure {
			problems = append(problems, errors.New("COOKIE_SECURE=false não é permitido com APP_ENV=production: sirva por HTTPS ou use APP_ENV=development só em desenvolvimento local"))
		}
	case "development":
	default:
		problems = append(problems, fmt.Errorf("APP_ENV deve ser production ou development, recebi %q", c.AppEnv))
	}
	if c.DBPath == "" {
		problems = append(problems, errors.New("DB_PATH não pode ficar vazio"))
	}
	if err := checkJWTSecret(c.JWTSecret); err != nil {
		problems = append(problems, err)
	}
	return c, errors.Join(problems...)
}

// RedisURLHasPassword diz se a URL do Redis traz senha (redis://:senha@host ou redis://usuario:senha@host).
func RedisURLHasPassword(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.User == nil {
		return false
	}
	pw, ok := u.User.Password()
	return ok && pw != ""
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
