package main

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"

	"aurora/api/internal/config"
)

// SEC-14: o Redis exige senha e a API só conecta com a senha certa na REDIS_URL.
func TestConnectRedisWithPassword(t *testing.T) {
	mr := miniredis.RunT(t)
	mr.RequireAuth("senha-do-redis-123")
	ctx := context.Background()

	// com a senha certa na URL, conecta e funciona
	rdb, err := connectRedis(ctx, fmt.Sprintf("redis://:senha-do-redis-123@%s/0", mr.Addr()))
	if err != nil {
		t.Fatalf("com a senha certa deveria conectar: %v", err)
	}
	defer rdb.Close()
	if err := rdb.Set(ctx, "k", "v", 0).Err(); err != nil {
		t.Fatalf("comando autenticado falhou: %v", err)
	}

	// sem senha e com a senha errada: a API não sobe (erro claro de Redis indisponível)
	for name, url := range map[string]string{
		"sem senha":        fmt.Sprintf("redis://%s/0", mr.Addr()),
		"com senha errada": fmt.Sprintf("redis://:outra@%s/0", mr.Addr()),
	} {
		if _, err := connectRedis(ctx, url); err == nil || !strings.Contains(err.Error(), "redis indisponível") {
			t.Errorf("%s: deveria falhar com 'redis indisponível', erro=%v", name, err)
		}
	}

	// o servidor realmente rejeita um cliente sem autenticação (o teste não passa por acaso)
	if _, err := connectRedis(ctx, "redis://"+mr.Addr()+"/0"); err == nil {
		t.Error("o servidor deveria exigir autenticação")
	}
}

func TestConnectRedisInvalidURL(t *testing.T) {
	if _, err := connectRedis(context.Background(), "http://nao-e-redis"); err == nil {
		t.Fatal("URL que não é de Redis deveria dar erro")
	}
}

// Sem REDIS_URL a API sobe um Redis embutido. O miniredis não expira chaves sozinho: o relógio avançado em
// openRedis é o que faz o TTL (refresh tokens, janelas de limite) valer de verdade.
func TestEmbeddedRedisExpiresKeys(t *testing.T) {
	ctx := context.Background()
	rdb, closeFn, err := openRedis(ctx, config.Config{AppEnv: "development"}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	defer closeFn()

	if err := rdb.Set(ctx, "k", "v", 1*time.Second).Err(); err != nil {
		t.Fatal(err)
	}
	if got, err := rdb.Get(ctx, "k").Result(); err != nil || got != "v" {
		t.Fatalf("antes de expirar: %q %v", got, err)
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := rdb.Get(ctx, "k").Result(); err != nil {
			return // expirou
		}
		time.Sleep(200 * time.Millisecond)
	}
	t.Fatal("a chave com TTL de 1s deveria ter expirado")
}
