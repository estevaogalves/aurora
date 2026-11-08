package httpapi

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"aurora/api/internal/audit"
	"aurora/api/internal/auth"
	"aurora/api/internal/store"
)

const refreshCookie = "aurora_refresh"

type userDTO struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func toUserDTO(u store.User) userDTO {
	return userDTO{ID: u.ID.String(), Email: u.Email, Name: u.Name, Role: u.Role}
}

type sessionDTO struct {
	AccessToken string    `json:"accessToken"`
	ExpiresAt   time.Time `json:"expiresAt"`
	User        userDTO   `json:"user"`
}

type credentials struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	// Cadastro fechado (REGISTRATION_ENABLED=false): responde antes de ler o corpo, de contar o limite por IP
	// ou de gastar um hash. O login de quem já tem conta não muda.
	if s.cfg.RegistrationDisabled {
		writeError(w, http.StatusForbidden, "O cadastro está fechado no momento. Quem já tem conta pode entrar normalmente.")
		return
	}
	var in credentials
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	name := strings.TrimSpace(in.Name)
	if _, err := mail.ParseAddress(email); err != nil || !strings.Contains(email, "@") || len(email) > 254 {
		writeError(w, http.StatusBadRequest, "Informe um e-mail válido.")
		return
	}
	if len(in.Password) < 8 {
		writeError(w, http.StatusBadRequest, "A senha precisa ter ao menos 8 caracteres.")
		return
	}
	if len(in.Password) > 128 {
		writeError(w, http.StatusBadRequest, "A senha pode ter no máximo 128 caracteres.")
		return
	}
	if len(name) > 100 {
		writeError(w, http.StatusBadRequest, "O nome pode ter no máximo 100 caracteres.")
		return
	}

	// Só tentativas que chegam até o hash (o passo caro) contam para o limite por IP.
	if s.registerLimiter != nil {
		allowed, wait, err := s.registerLimiter.Hit(r.Context(), clientIP(r))
		if err != nil {
			s.fail(w, r, err)
			return
		}
		if !allowed {
			s.audit.Log(r.Context(), audit.RegisterRateLimited, uuid.Nil, clientIP(r))
			w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
			writeError(w, http.StatusTooManyRequests, "Muitos cadastros deste endereço. Tente novamente mais tarde.")
			return
		}
	}

	hash, err := s.hasher.Hash(r.Context(), in.Password)
	if errors.Is(err, auth.ErrBusy) {
		s.busy(w)
		return
	}
	if errors.Is(err, context.Canceled) {
		return // o cliente desistiu
	}
	if err != nil {
		s.fail(w, r, err)
		return
	}
	// O papel de admin nunca vem do cadastro (e-mail não é verificado): só pelo comando `api admin promote`.
	user, err := s.store.CreateUser(r.Context(), email, name, hash, "user")
	if err == store.ErrDuplicate {
		writeError(w, http.StatusConflict, "Já existe uma conta com esse e-mail.")
		return
	}
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.audit.Log(r.Context(), audit.Register, user.ID, clientIP(r))
	s.startSession(w, r, user, http.StatusCreated)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var in credentials
	if !decode(w, r, &in, s.lim.Body) {
		return
	}
	email := strings.ToLower(strings.TrimSpace(in.Email))
	key := email + "|" + clientIP(r)
	ctx := r.Context()

	blocked, wait, err := s.limiter.Blocked(ctx, key)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if blocked {
		s.audit.Log(ctx, audit.LoginBlocked, uuid.Nil, clientIP(r))
		w.Header().Set("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
		writeError(w, http.StatusTooManyRequests, "Muitas tentativas. Tente novamente em alguns minutos.")
		return
	}

	user, err := s.store.UserByEmail(ctx, email)
	hash := s.dummyHash
	if err == nil {
		hash = user.PasswordHash
	} else if err != store.ErrNotFound {
		s.fail(w, r, err)
		return
	}
	ok, verr := s.hasher.Verify(ctx, in.Password, hash)
	if errors.Is(verr, auth.ErrBusy) {
		s.busy(w) // sobrecarga não conta como tentativa errada do usuário
		return
	}
	if errors.Is(verr, context.Canceled) {
		return // o cliente desistiu
	}
	if err != nil || !ok {
		if ferr := s.limiter.Fail(ctx, key); ferr != nil {
			s.log.Warn("falha ao registrar tentativa de login", "err", ferr)
		}
		// user.ID é o id do dono do e-mail, ou uuid.Nil se o e-mail não existe (nunca registramos o e-mail)
		s.audit.Log(ctx, audit.LoginFailed, user.ID, clientIP(r))
		writeError(w, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}

	_ = s.limiter.Reset(ctx, key)
	s.audit.Log(ctx, audit.LoginSuccess, user.ID, clientIP(r))
	s.startSession(w, r, user, http.StatusOK)
}

// startSession emite o token de acesso (no corpo) e o refresh token (cookie httpOnly).
func (s *Server) startSession(w http.ResponseWriter, r *http.Request, user store.User, status int) {
	ctx := r.Context()
	access, exp, err := s.jwt.Issue(user.ID, user.Role)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	token, hash, refreshExp, err := s.refresh.Issue(ctx, user.ID)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	if err := s.store.SaveRefreshToken(ctx, user.ID, hash, refreshExp); err != nil {
		s.fail(w, r, err)
		return
	}
	s.setRefreshCookie(w, token, int(s.cfg.RefreshTTL.Seconds()))
	writeJSON(w, status, sessionDTO{AccessToken: access, ExpiresAt: exp, User: toUserDTO(user)})
}

func (s *Server) setRefreshCookie(w http.ResponseWriter, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: refreshCookie, Value: value, Path: "/api/v1/auth", MaxAge: maxAge,
		HttpOnly: true, Secure: s.cfg.CookieSecure, SameSite: http.SameSiteLaxMode,
	})
}

func (s *Server) clearRefreshCookie(w http.ResponseWriter) { s.setRefreshCookie(w, "", -1) }

// refreshSession troca o refresh token por um par novo (rotação). Cada token vale uma vez:
// se um token já gasto aparece de novo, todas as sessões do usuário são encerradas.
func (s *Server) refreshSession(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	c, err := r.Cookie(refreshCookie)
	if err != nil || c.Value == "" {
		writeError(w, http.StatusUnauthorized, "Sessão expirada. Faça login novamente.")
		return
	}

	uid, hash, err := s.refresh.Consume(ctx, c.Value)
	if err == auth.ErrRefreshInvalid {
		if owner, revoked, derr := s.store.RefreshTokenWasRevoked(ctx, hash); derr == nil && revoked {
			s.audit.Log(ctx, audit.RefreshReuse, owner, clientIP(r))
			_ = s.refresh.RevokeAll(ctx, owner)
			_ = s.store.RevokeUserRefreshTokens(ctx, owner)
		} else {
			s.audit.Log(ctx, audit.RefreshInvalid, uuid.Nil, clientIP(r))
		}
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "Sessão expirada. Faça login novamente.")
		return
	}
	if err != nil {
		s.fail(w, r, err)
		return
	}
	_ = s.store.RevokeRefreshToken(ctx, hash)

	user, err := s.store.UserByID(ctx, uid)
	if err == store.ErrNotFound {
		s.clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "Sessão expirada. Faça login novamente.")
		return
	}
	if err != nil {
		s.fail(w, r, err)
		return
	}
	s.audit.Log(ctx, audit.Refresh, user.ID, clientIP(r))
	s.startSession(w, r, user, http.StatusOK)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(refreshCookie); err == nil && c.Value != "" {
		if id, _ := s.refresh.Revoke(r.Context(), c.Value); id != uuid.Nil {
			s.audit.Log(r.Context(), audit.Logout, id, clientIP(r))
		}
		_ = s.store.RevokeRefreshToken(r.Context(), auth.HashToken(c.Value))
	}
	s.clearRefreshCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	user, err := s.store.UserByID(r.Context(), userID(r))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toUserDTO(user))
}

func (s *Server) adminUsers(w http.ResponseWriter, r *http.Request) {
	s.audit.Log(r.Context(), audit.AdminListUsers, userID(r), clientIP(r))
	users, err := s.store.ListUsers(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := make([]userDTO, 0, len(users))
	for _, u := range users {
		out = append(out, toUserDTO(u))
	}
	writeJSON(w, http.StatusOK, out)
}
