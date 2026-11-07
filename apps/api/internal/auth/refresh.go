package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

var ErrRefreshInvalid = errors.New("refresh token inválido")

// Refresh guarda o HASH dos refresh tokens no Redis (nunca o token em si).
// Cada token vale uma vez só: ao renovar, o antigo é consumido (rotação).
type Refresh struct {
	rdb *redis.Client
	ttl time.Duration
}

func NewRefresh(rdb *redis.Client, ttl time.Duration) *Refresh {
	return &Refresh{rdb: rdb, ttl: ttl}
}

func refreshKey(hash string) string    { return "refresh:" + hash }
func userTokensKey(u uuid.UUID) string { return "user_refresh:" + u.String() }

// HashToken é o SHA-256 em hexadecimal do token.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// Issue cria um token novo para o usuário e devolve (token, hash, expiração).
func (r *Refresh) Issue(ctx context.Context, userID uuid.UUID) (string, string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", time.Time{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	hash := HashToken(token)

	pipe := r.rdb.TxPipeline()
	pipe.Set(ctx, refreshKey(hash), userID.String(), r.ttl)
	pipe.SAdd(ctx, userTokensKey(userID), hash)
	pipe.Expire(ctx, userTokensKey(userID), r.ttl)
	if _, err := pipe.Exec(ctx); err != nil {
		return "", "", time.Time{}, err
	}
	return token, hash, time.Now().Add(r.ttl), nil
}

// Consume gasta o token (GETDEL) e devolve o dono. Token desconhecido, expirado ou já usado: erro.
func (r *Refresh) Consume(ctx context.Context, token string) (uuid.UUID, string, error) {
	hash := HashToken(token)
	val, err := r.rdb.GetDel(ctx, refreshKey(hash)).Result()
	if errors.Is(err, redis.Nil) {
		return uuid.Nil, hash, ErrRefreshInvalid
	}
	if err != nil {
		return uuid.Nil, hash, err
	}
	userID, err := uuid.Parse(val)
	if err != nil {
		return uuid.Nil, hash, ErrRefreshInvalid
	}
	r.rdb.SRem(ctx, userTokensKey(userID), hash)
	return userID, hash, nil
}

// Revoke apaga um token (logout).
func (r *Refresh) Revoke(ctx context.Context, token string) (uuid.UUID, error) {
	id, _, err := r.Consume(ctx, token)
	if errors.Is(err, ErrRefreshInvalid) {
		return uuid.Nil, nil
	}
	return id, err
}

// RevokeAll apaga todos os tokens do usuário (usado quando um token já gasto reaparece).
func (r *Refresh) RevokeAll(ctx context.Context, userID uuid.UUID) error {
	hashes, err := r.rdb.SMembers(ctx, userTokensKey(userID)).Result()
	if err != nil {
		return err
	}
	keys := make([]string, 0, len(hashes)+1)
	for _, h := range hashes {
		keys = append(keys, refreshKey(h))
	}
	keys = append(keys, userTokensKey(userID))
	return r.rdb.Del(ctx, keys...).Err()
}
