package auth

import (
	"context"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Revoker invalida tokens de acesso antes do vencimento (logout, exclusão de conta, reuso de refresh).
// Guarda no Redis só o necessário: o jti de um token revogado (até ele expirar) e, por usuário, o instante
// até o qual tokens emitidos são recusados (inclusive o mesmo segundo: iat tem precisão de 1 s).
type Revoker struct {
	rdb *redis.Client
	ttl time.Duration // vida máxima de um token de acesso
	now func() time.Time
}

func NewRevoker(rdb *redis.Client, accessTTL time.Duration) *Revoker {
	return &Revoker{rdb: rdb, ttl: accessTTL, now: time.Now}
}

func jtiKey(jti string) string        { return "revoked_jti:" + jti }
func cutoffKey(u uuid.UUID) string    { return "revoked_before:" + u.String() }

// RevokeToken recusa este token até a hora em que ele expiraria de qualquer jeito.
func (r *Revoker) RevokeToken(ctx context.Context, c *Claims) error {
	if c.ID == "" || c.ExpiresAt == nil {
		return nil
	}
	left := c.ExpiresAt.Time.Sub(r.now())
	if left <= 0 {
		return nil
	}
	return r.rdb.Set(ctx, jtiKey(c.ID), "1", left).Err()
}

// RevokeUser recusa todos os tokens de acesso do usuário emitidos até agora.
func (r *Revoker) RevokeUser(ctx context.Context, u uuid.UUID) error {
	return r.rdb.Set(ctx, cutoffKey(u), strconv.FormatInt(r.now().Unix(), 10), r.ttl+time.Minute).Err()
}

// IsRevoked diz se o token foi revogado. Erro do Redis volta como erro: quem chama deve negar o acesso.
func (r *Revoker) IsRevoked(ctx context.Context, c *Claims) (bool, error) {
	if c.ID != "" {
		n, err := r.rdb.Exists(ctx, jtiKey(c.ID)).Result()
		if err != nil {
			return false, err
		}
		if n > 0 {
			return true, nil
		}
	}
	uid, err := c.UserID()
	if err != nil {
		return true, nil
	}
	v, err := r.rdb.Get(ctx, cutoffKey(uid)).Result()
	if err == redis.Nil {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	cut, perr := strconv.ParseInt(v, 10, 64)
	if perr != nil {
		return true, nil
	}
	return c.IssuedAt == nil || c.IssuedAt.Unix() <= cut, nil
}
