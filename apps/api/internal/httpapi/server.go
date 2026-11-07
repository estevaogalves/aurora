// Package httpapi expõe a API REST (chi). Tudo fica sob /api/v1.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"runtime"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"aurora/api/internal/audit"
	"aurora/api/internal/auth"
	"aurora/api/internal/cache"
	"aurora/api/internal/config"
	"aurora/api/internal/store"
	"aurora/api/internal/sysmem"
)

type Server struct {
	cfg     config.Config
	store   *store.Store
	rdb     *redis.Client
	jwt     *auth.JWT
	refresh *auth.Refresh
	limiter *auth.LoginLimiter
	cache   *cache.Summaries
	log     *slog.Logger
	// hash usado para gastar o mesmo tempo quando o e-mail não existe (evita revelar quem tem conta)
	dummyHash string
	// limita os hashes argon2id simultâneos (cada um usa 64 MiB)
	hasher *auth.HashLimiter
	// cadastros por IP; nil = sem limite (RegisterMaxPerIP <= 0)
	registerLimiter *auth.RateLimiter
	lim             Limits
	audit           *audit.Logger
}

func New(cfg config.Config, st *store.Store, rdb *redis.Client, log *slog.Logger) (*Server, error) {
	dummy, err := auth.HashPassword("senha-que-ninguem-usa")
	if err != nil {
		return nil, err
	}

	slots := cfg.HashMaxConcurrency
	if slots <= 0 {
		slots = auth.AutoConcurrency(sysmem.Limit(), runtime.NumCPU())
	}
	queue := cfg.HashMaxQueue
	if queue <= 0 {
		queue = 4 * slots
	}
	timeout := cfg.HashQueueTimeout
	if timeout <= 0 {
		timeout = 3 * time.Second
	}
	log.Info("limite de hashing", "concorrencia", slots, "fila", queue, "timeout", timeout.String())

	s := &Server{
		cfg: cfg, store: st, rdb: rdb, log: log, dummyHash: dummy,
		jwt:     auth.NewJWT(cfg.JWTSecret, cfg.AccessTTL),
		refresh: auth.NewRefresh(rdb, cfg.RefreshTTL),
		limiter: auth.NewLoginLimiter(rdb, cfg.LoginMaxAttempts, cfg.LoginWindow),
		cache:   cache.NewSummaries(rdb),
		hasher:  auth.NewHashLimiter(slots, queue, timeout),
		lim:     limitsFrom(cfg),
		audit:   audit.New(log),
	}
	if cfg.RegisterMaxPerIP > 0 {
		window := cfg.RegisterWindow
		if window <= 0 {
			window = time.Hour
		}
		s.registerLimiter = auth.NewRateLimiter(rdb, "register", cfg.RegisterMaxPerIP, window)
	}
	return s, nil
}

// busy responde 503 quando a fila de hashing está cheia ou demorou demais.
func (s *Server) busy(w http.ResponseWriter) {
	w.Header().Set("Retry-After", "2")
	writeError(w, http.StatusServiceUnavailable, "Servidor ocupado. Tente novamente em instantes.")
}

func (s *Server) Router() http.Handler {
	r := chi.NewRouter()
	if s.cfg.TrustProxy {
		r.Use(middleware.RealIP)
	}
	r.Use(middleware.RequestID, middleware.Recoverer, apiHeaders, s.accessLog)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.cfg.AllowedOrigin,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", s.health)

	r.Route("/api/v1", func(r chi.Router) {
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", s.register)
			r.Post("/login", s.login)
			r.Post("/refresh", s.refreshSession)
			r.Post("/logout", s.logout)
		})

		r.Group(func(r chi.Router) {
			r.Use(s.authenticate)

			r.Get("/me", s.me)
			r.Get("/data", s.getData)
			r.Post("/import", s.importData)

			r.Route("/transactions", func(r chi.Router) {
				r.Post("/", s.createTransaction)
				r.Patch("/{id}", s.updateTransaction)
				r.Delete("/{id}", s.deleteTransaction)
			})
			r.Route("/credits", func(r chi.Router) {
				r.Post("/", s.createCredit)
				r.Patch("/{id}", s.updateCredit)
				r.Delete("/{id}", s.deleteCredit)
			})
			r.Route("/goals", func(r chi.Router) {
				r.Post("/", s.createGoal)
				r.Patch("/{id}", s.updateGoal)
				r.Delete("/{id}", s.deleteGoal)
			})
			r.Route("/extra-expenses", func(r chi.Router) {
				r.Post("/", s.createExtra)
				r.Patch("/{id}", s.updateExtra)
				r.Delete("/{id}", s.deleteExtra)
			})
			r.Route("/notes", func(r chi.Router) {
				r.Post("/", s.createNote)
				r.Patch("/{id}", s.updateNote)
				r.Delete("/{id}", s.deleteNote)
			})
			r.Route("/categories", func(r chi.Router) {
				r.Post("/", s.createCategory)
				r.Delete("/{id}", s.deleteCategory)
			})
			r.Put("/settings/distribution", s.putDistribution)
			r.Put("/settings/seen-alerts", s.putSeenAlerts)
			r.Put("/settings/onboarding/{screen}", s.putOnboarding)

			r.Get("/summary/{month}", s.summary)
			r.Get("/projection", s.projection)
			r.Get("/comparison", s.comparison)

			r.With(s.requireAdmin).Get("/admin/users", s.adminUsers)
		})
	})
	return r
}

/* ---------- middlewares ---------- */

type ctxKey int

const (
	ctxUserID ctxKey = iota
	ctxRole
)

func (s *Server) authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		const prefix = "Bearer "
		h := r.Header.Get("Authorization")
		if len(h) <= len(prefix) || h[:len(prefix)] != prefix {
			writeError(w, http.StatusUnauthorized, "Faça login para continuar.")
			return
		}
		claims, err := s.jwt.Parse(h[len(prefix):])
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Sessão expirada. Faça login novamente.")
			return
		}
		id, err := claims.UserID()
		if err != nil {
			writeError(w, http.StatusUnauthorized, "Sessão inválida.")
			return
		}
		ctx := context.WithValue(r.Context(), ctxUserID, id)
		ctx = context.WithValue(ctx, ctxRole, claims.Role)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s *Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if role, _ := r.Context().Value(ctxRole).(string); role != "admin" {
			writeError(w, http.StatusForbidden, "Acesso restrito a administradores.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		s.log.Info("http", "method", r.Method, "path", r.URL.Path, "status", ww.Status(),
			"ms", time.Since(start).Milliseconds(), "request_id", middleware.GetReqID(r.Context()))
	})
}

func userID(r *http.Request) uuid.UUID {
	id, _ := r.Context().Value(ctxUserID).(uuid.UUID)
	return id
}

/* ---------- respostas ---------- */

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decode(w http.ResponseWriter, r *http.Request, dst any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		var tooBig *http.MaxBytesError
		switch {
		case errors.As(err, &tooBig):
			writeError(w, http.StatusRequestEntityTooLarge, "Requisição grande demais.")
		case errors.Is(err, io.EOF):
			writeError(w, http.StatusBadRequest, "Corpo da requisição vazio.")
		default:
			writeError(w, http.StatusBadRequest, "JSON inválido.")
		}
		return false
	}
	return true
}

// fail traduz erros do store em respostas HTTP.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, store.ErrNotFound):
		writeError(w, http.StatusNotFound, "Registro não encontrado.")
	case errors.Is(err, store.ErrDuplicate):
		writeError(w, http.StatusConflict, "Já existe um registro igual.")
	case errors.Is(err, store.ErrHasData):
		writeError(w, http.StatusConflict, "A conta já tem dados. Use replace=true para substituí-los.")
	default:
		s.log.Error("erro interno", "err", err, "path", r.URL.Path)
		writeError(w, http.StatusInternalServerError, "Erro interno. Tente novamente.")
	}
}

// touch invalida o cache dos resumos do usuário. Chamado a cada escrita.
func (s *Server) touch(ctx context.Context, uid uuid.UUID) {
	if err := s.cache.Invalidate(ctx, uid); err != nil {
		s.log.Warn("falha ao invalidar cache", "err", err)
	}
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.store.Pool().Ping(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "banco indisponível")
		return
	}
	if err := s.rdb.Ping(ctx).Err(); err != nil {
		writeError(w, http.StatusServiceUnavailable, "redis indisponível")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
