// Comando api: servidor HTTP do Aurora.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
	"time"

	"github.com/redis/go-redis/v9"

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

	if cfg.MigrateDatabaseURL != "" {
		if err := db.MigrateURL(ctx, cfg.MigrateDatabaseURL); err != nil {
			return err
		}
	}
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if cfg.MigrateDatabaseURL == "" {
		if err := db.Migrate(ctx, pool); err != nil {
			return err
		}
	}

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return errors.Join(errors.New("redis indisponível"), err)
	}

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
