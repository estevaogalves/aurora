// Comando api: servidor HTTP do Aurora.
package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"aurora/api/internal/config"
	"aurora/api/internal/db"
	"aurora/api/internal/httpapi"
	"aurora/api/internal/store"
	"aurora/api/internal/sysmem"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if len(os.Args) > 1 && os.Args[1] == "admin" {
		os.Exit(adminMain(os.Args[2:]))
	}
	if err := run(log); err != nil {
		log.Error("falha ao iniciar", "err", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if os.Getenv("ADMIN_EMAIL") != "" {
		log.Warn("ADMIN_EMAIL não tem mais efeito: o admin só é concedido por `api admin promote <e-mail>`")
	}

	// Cada hash de senha aloca 64 MiB. Com limite de memória no container e sem GOMEMLIMIT definido,
	// faz o coletor de lixo apertar antes de o kernel matar o processo (OOM).
	if lim := sysmem.Limit(); lim > 0 && os.Getenv("GOMEMLIMIT") == "" {
		debug.SetMemoryLimit(int64(lim / 100 * 85))
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// As migrations rodam numa conexão própria, SEM statement_timeout (uma migration longa não pode ser
	// cortada), e só depois abrimos o pool da API, com limite de conexões e timeout.
	migrateURL := cfg.MigrateDatabaseURL
	if migrateURL == "" {
		migrateURL = cfg.DatabaseURL
	}
	if err := db.MigrateURL(ctx, migrateURL); err != nil {
		return err
	}
	pool, poolInfo, err := db.ConnectAPI(ctx, cfg.DatabaseURL, db.PoolOptions{
		MaxConns: cfg.DBMaxConns, StatementTimeout: cfg.DBStatementTimeout,
	})
	if err != nil {
		return err
	}
	defer pool.Close()
	log.Info("pool do banco", "max_conns", poolInfo.MaxConns, "statement_timeout", cfg.DBStatementTimeout.String(),
		"servidor_max_connections", poolInfo.ServerMax)
	if poolInfo.Clamped {
		log.Warn("DB_MAX_CONNS reduzido para caber no max_connections do servidor",
			"pedido", cfg.DBMaxConns, "efetivo", poolInfo.MaxConns)
	}

	if cfg.AppEnv == "production" && !config.RedisURLHasPassword(cfg.RedisURL) {
		log.Warn("REDIS_URL sem senha: quem alcançar o Redis lê/escreve refresh tokens e contadores. " +
			"Exija senha no Redis e informe-a na URL (redis://:senha@host:6379/0)")
	}
	rdb, err := connectRedis(ctx, cfg.RedisURL)
	if err != nil {
		return err
	}
	defer rdb.Close()

	st := store.New(pool)
	srv, err := httpapi.New(cfg, st, rdb, log)
	if err != nil {
		return err
	}

	// limpa de vez em quando os registros de refresh tokens vencidos
	go func() {
		t := time.NewTicker(6 * time.Hour)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				if err := st.PurgeExpiredRefreshTokens(ctx); err != nil {
					log.Warn("limpeza de refresh tokens", "err", err)
				}
			}
		}
	}()

	httpSrv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("API no ar", "addr", cfg.Addr)
		errCh <- httpSrv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		log.Info("encerrando")
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return httpSrv.Shutdown(shutdown)
	}
}
