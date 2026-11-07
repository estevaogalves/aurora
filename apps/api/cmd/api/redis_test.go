package main

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
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
