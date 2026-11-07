package main

import (
	"context"
	"errors"

	"github.com/redis/go-redis/v9"
)

// connectRedis abre o cliente a partir da REDIS_URL (a senha vai na URL: redis://:senha@host:6379/0) e confere
// a conexão com um PING. Com o servidor exigindo senha e a URL sem ela (ou com a errada), o PING falha.
func connectRedis(ctx context.Context, url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opt)
	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		return nil, errors.Join(errors.New("redis indisponível"), err)
	}
	return rdb, nil
}
