// Package cache guarda no Redis o resumo mensal de cada usuário.
//
// A invalidação usa uma "versão" por usuário: toda escrita incrementa a versão e a
// chave do resumo inclui a versão, então os resumos antigos deixam de ser lidos
// (e expiram sozinhos pelo TTL). Assim não precisa varrer nem apagar chave por chave.
package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"

	"aurora/api/internal/domain"
)

const summaryTTL = time.Hour

type Summaries struct {
	rdb *redis.Client
}

func NewSummaries(rdb *redis.Client) *Summaries { return &Summaries{rdb: rdb} }

func versionKey(u uuid.UUID) string { return "summary_ver:" + u.String() }

func (c *Summaries) version(ctx context.Context, u uuid.UUID) (int64, error) {
	v, err := c.rdb.Get(ctx, versionKey(u)).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, nil
	}
	return v, err
}

func (c *Summaries) key(ctx context.Context, u uuid.UUID, month string) (string, error) {
	v, err := c.version(ctx, u)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("summary:%s:%d:%s", u, v, month), nil
}

// Get devolve o resumo guardado; ok=false se não há (ou se o Redis falhou).
func (c *Summaries) Get(ctx context.Context, u uuid.UUID, month string) (domain.MonthSummary, bool) {
	key, err := c.key(ctx, u, month)
	if err != nil {
		return domain.MonthSummary{}, false
	}
	raw, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return domain.MonthSummary{}, false
	}
	var s domain.MonthSummary
	if json.Unmarshal(raw, &s) != nil {
		return domain.MonthSummary{}, false
	}
	return s, true
}

func (c *Summaries) Set(ctx context.Context, u uuid.UUID, month string, s domain.MonthSummary) {
	key, err := c.key(ctx, u, month)
	if err != nil {
		return
	}
	raw, err := json.Marshal(s)
	if err != nil {
		return
	}
	c.rdb.Set(ctx, key, raw, summaryTTL)
}

// Invalidate descarta todos os resumos do usuário. Chamado a cada escrita.
func (c *Summaries) Invalidate(ctx context.Context, u uuid.UUID) error {
	return c.rdb.Incr(ctx, versionKey(u)).Err()
}
