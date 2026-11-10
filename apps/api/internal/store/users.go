package store

import (
	"context"
	"time"

	"github.com/google/uuid"

	"aurora/api/internal/domain"
	"aurora/api/internal/store/sqlcgen"
)

type User = sqlcgen.User

// CreateUser cadastra o usuário e já cria as configurações dele. ErrDuplicate se o e-mail existe.
func (s *Store) CreateUser(ctx context.Context, email, name, passwordHash, role string) (User, error) {
	var u User
	err := s.inTx(ctx, func(q *sqlcgen.Queries) error {
		var err error
		u, err = q.CreateUser(ctx, sqlcgen.CreateUserParams{ID: uuid.New(), Email: email, Name: name, PasswordHash: passwordHash, Role: role})
		if err != nil {
			return err
		}
		return q.EnsureSettings(ctx, u.ID)
	})
	return u, mapErr(err)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	u, err := s.q.GetUserByEmail(ctx, email)
	return u, mapErr(err)
}

func (s *Store) UserByID(ctx context.Context, id uuid.UUID) (User, error) {
	u, err := s.q.GetUserByID(ctx, id)
	return u, mapErr(err)
}

func (s *Store) ListUsers(ctx context.Context) ([]User, error) { return s.q.ListUsers(ctx) }

func (s *Store) CountUsers(ctx context.Context) (int64, error) { return s.q.CountUsers(ctx) }

/* ---------- refresh tokens (registro no banco; o hash "vivo" fica no Redis) ---------- */

func (s *Store) SaveRefreshToken(ctx context.Context, userID uuid.UUID, hash string, expires time.Time) error {
	return s.q.CreateRefreshToken(ctx, sqlcgen.CreateRefreshTokenParams{
		UserID: userID, TokenHash: hash, ExpiresAt: expires.UTC(),
	})
}

// RefreshTokenWasRevoked: o token existe e já foi gasto/revogado (sinal de reutilização).
func (s *Store) RefreshTokenWasRevoked(ctx context.Context, hash string) (uuid.UUID, bool, error) {
	row, err := s.q.GetRefreshToken(ctx, hash)
	if err != nil {
		return uuid.Nil, false, mapErr(err)
	}
	return row.UserID, row.RevokedAt.Valid, nil
}

func (s *Store) RevokeRefreshToken(ctx context.Context, hash string) error {
	return s.q.RevokeRefreshToken(ctx, hash)
}

func (s *Store) RevokeUserRefreshTokens(ctx context.Context, userID uuid.UUID) error {
	_, err := s.q.RevokeUserRefreshTokens(ctx, userID)
	return err
}

func (s *Store) PurgeExpiredRefreshTokens(ctx context.Context) error {
	return s.q.DeleteExpiredRefreshTokens(ctx)
}

/* ---------- configurações ---------- */

func (s *Store) SetDistribution(ctx context.Context, userID uuid.UUID, items []domain.DistributionItem) error {
	var raw []byte // nil = padrão
	if items != nil {
		var err error
		if raw, err = jsonMarshal(items); err != nil {
			return err
		}
	}
	return s.q.SetDistribution(ctx, sqlcgen.SetDistributionParams{UserID: userID, Distribution: raw})
}

func (s *Store) SetSeenAlerts(ctx context.Context, userID uuid.UUID, keys []string) error {
	if keys == nil {
		keys = []string{}
	}
	return s.q.SetSeenAlerts(ctx, sqlcgen.SetSeenAlertsParams{UserID: userID, SeenAlerts: keys})
}

// SetOnboarding grava a resposta de uma tela, sem mexer nas outras.
func (s *Store) SetOnboarding(ctx context.Context, userID uuid.UUID, screen, state string) error {
	return s.q.SetOnboardingScreen(ctx, sqlcgen.SetOnboardingScreenParams{UserID: userID, Screen: screen, State: state})
}

/* ---------- papéis (só pelo comando `api admin`, nunca por requisição) ---------- */

// PromoteAdmin dá o papel de admin ao usuário já cadastrado. changed=false se já era admin.
// ErrNotFound se o e-mail não existe.
func (s *Store) PromoteAdmin(ctx context.Context, email string) (u User, changed bool, err error) {
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		cur, err := q.GetUserByEmail(ctx, email)
		if err != nil {
			return err
		}
		if cur.Role == "admin" {
			u = cur
			return nil
		}
		u, err = q.SetUserRole(ctx, sqlcgen.SetUserRoleParams{ID: cur.ID, Role: "admin"})
		changed = err == nil
		return err
	})
	return u, changed, mapErr(err)
}

// DemoteAdmin tira o papel de admin. Recusa (ErrLastAdmin) rebaixar o último admin, para a
// administração nunca ficar sem dono. changed=false se o usuário já não era admin.
// Os admins ficam travados na transação: dois rebaixamentos simultâneos não zeram a lista.
func (s *Store) DemoteAdmin(ctx context.Context, email string) (u User, changed bool, err error) {
	err = s.inTx(ctx, func(q *sqlcgen.Queries) error {
		admins, err := q.LockAdmins(ctx)
		if err != nil {
			return err
		}
		cur, err := q.GetUserByEmail(ctx, email)
		if err != nil {
			return err
		}
		if cur.Role != "admin" {
			u = cur
			return nil
		}
		if len(admins) <= 1 {
			return ErrLastAdmin
		}
		u, err = q.SetUserRole(ctx, sqlcgen.SetUserRoleParams{ID: cur.ID, Role: "user"})
		changed = err == nil
		return err
	})
	return u, changed, mapErr(err)
}

/* ---------- LGPD: exclusão da conta ---------- */

// DeleteUser apaga a conta e todos os dados dela (cascata). ErrNotFound se ela não existe.
func (s *Store) DeleteUser(ctx context.Context, id uuid.UUID) error {
	n, err := s.q.DeleteUser(ctx, id)
	if err != nil {
		return mapErr(err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
