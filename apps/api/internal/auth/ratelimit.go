package auth

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

// LoginLimiter conta tentativas de login com falha por chave (e-mail + IP) numa janela.
type LoginLimiter struct {
	rdb    *redis.Client
	max    int
	window time.Duration
}

func NewLoginLimiter(rdb *redis.Client, max int, window time.Duration) *LoginLimiter {
	return &LoginLimiter{rdb: rdb, max: max, window: window}
}

func limitKey(key string) string { return "ratelimit:login:" + key }

// Blocked diz se a chave já estourou o limite e, se sim, em quanto tempo libera.
func (l *LoginLimiter) Blocked(ctx context.Context, key string) (bool, time.Duration, error) {
	n, err := l.rdb.Get(ctx, limitKey(key)).Int()
	if err == redis.Nil {
		return false, 0, nil
	}
	if err != nil {
		return false, 0, err
	}
	if n < l.max {
		return false, 0, nil
	}
	ttl, err := l.rdb.TTL(ctx, limitKey(key)).Result()
	if err != nil || ttl < 0 {
		ttl = l.window
	}
	return true, ttl, nil
}

// Fail registra uma tentativa que falhou. A janela começa na primeira falha.
func (l *LoginLimiter) Fail(ctx context.Context, key string) error {
	pipe := l.rdb.TxPipeline()
	incr := pipe.Incr(ctx, limitKey(key))
	pipe.ExpireNX(ctx, limitKey(key), l.window)
	_, err := pipe.Exec(ctx)
	_ = incr
	return err
}

// Reset zera o contador (login com sucesso).
func (l *LoginLimiter) Reset(ctx context.Context, key string) error {
	return l.rdb.Del(ctx, limitKey(key)).Err()
}

// RateLimiter conta TODAS as tentativas por chave (ex.: IP) numa janela fixa, no Redis.
// Diferente do LoginLimiter, que só conta falhas.
type RateLimiter struct {
	rdb    *redis.Client
	prefix string
	max    int
	window time.Duration
}

func NewRateLimiter(rdb *redis.Client, prefix string, max int, window time.Duration) *RateLimiter {
	return &RateLimiter{rdb: rdb, prefix: prefix, max: max, window: window}
}

// Hit registra uma tentativa. allowed=false quando passou do máximo; wait diz quando libera.
func (l *RateLimiter) Hit(ctx context.Context, key string) (allowed bool, wait time.Duration, err error) {
	k := "ratelimit:" + l.prefix + ":" + key
	pipe := l.rdb.TxPipeline()
	incr := pipe.Incr(ctx, k)
	pipe.ExpireNX(ctx, k, l.window)
	if _, err := pipe.Exec(ctx); err != nil {
		return false, 0, err
	}
	if incr.Val() <= int64(l.max) {
		return true, 0, nil
	}
	ttl, err := l.rdb.TTL(ctx, k).Result()
	if err != nil || ttl <= 0 {
		ttl = l.window
	}
	return false, ttl, nil
}
