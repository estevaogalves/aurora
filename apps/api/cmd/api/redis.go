package main

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"aurora/api/internal/config"
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

// openRedis devolve o cliente do Redis. Com REDIS_URL, usa esse Redis (e exige senha em produção). Sem ela, sobe um
// Redis embutido no próprio processo (miniredis): nada para instalar nem manter, e a API vira um serviço só.
// O que fica nele (refresh tokens, limites de requisição, cache dos resumos) é descartável e some ao reiniciar.
func openRedis(ctx context.Context, cfg config.Config, log *slog.Logger) (*redis.Client, func(), error) {
	if cfg.RedisURL != "" {
		if cfg.AppEnv == "production" && !config.RedisURLHasPassword(cfg.RedisURL) {
			log.Warn("REDIS_URL sem senha: quem alcançar o Redis lê/escreve refresh tokens e contadores. " +
				"Exija senha no Redis e informe-a na URL (redis://:senha@host:6379/0)")
		}
		rdb, err := connectRedis(ctx, cfg.RedisURL)
		if err != nil {
			return nil, nil, err
		}
		return rdb, func() { rdb.Close() }, nil
	}

	mr := miniredis.NewMiniRedis()
	// só no loopback do próprio processo: nada de fora alcança
	if err := mr.StartAddr("127.0.0.1:0"); err != nil {
		return nil, nil, errors.Join(errors.New("não foi possível iniciar o Redis embutido"), err)
	}
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	if err := rdb.Ping(ctx).Err(); err != nil {
		rdb.Close()
		mr.Close()
		return nil, nil, errors.Join(errors.New("redis embutido indisponível"), err)
	}
	// o miniredis não expira chaves sozinho: avançamos o relógio dele com o tempo real (TTL de tokens, janelas de limite)
	stop := make(chan struct{})
	go func() {
		t := time.NewTicker(time.Second)
		defer t.Stop()
		last := time.Now()
		for {
			select {
			case now := <-t.C:
				mr.FastForward(now.Sub(last))
				last = now
			case <-stop:
				return
			}
		}
	}()
	log.Info("Redis embutido (em memória)", "addr", mr.Addr())
	return rdb, func() { close(stop); rdb.Close(); mr.Close() }, nil
}
