package db

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestClampConns(t *testing.T) {
	cases := []struct {
		name                          string
		configured, max, reserved     int
		want                          int
		clamped                       bool
	}{
		{"padrão 10 com max_connections=100", 10, 100, 3, 10, false},
		{"pedir demais é reduzido (100 → 97 - 19 = 78)", 500, 100, 3, 78, true},
		{"exatamente no limite", 78, 100, 3, 78, false},
		{"servidor pequeno (20 → 17 - 10 = 7)", 10, 20, 3, 7, true},
		{"servidor minúsculo: ao menos 1", 10, 5, 3, 1, true},
		{"servidor não consultado: confia no configurado", 40, 0, 0, 40, false},
	}
	for _, c := range cases {
		got, clamped := ClampConns(c.configured, c.max, c.reserved)
		if got != c.want || clamped != c.clamped {
			t.Errorf("%s: got %d,%v want %d,%v", c.name, got, clamped, c.want, c.clamped)
		}
	}
}

func testURL(t *testing.T) string {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definida; teste de integração pulado")
	}
	return url
}

// statement_timeout vale SÓ no pool da API; o pool usado nas migrations (Connect) fica sem limite.
func TestStatementTimeoutOnlyOnAPIPool(t *testing.T) {
	url := testURL(t)
	ctx := context.Background()

	api, info, err := ConnectAPI(ctx, url, PoolOptions{MaxConns: 3, StatementTimeout: 300 * time.Millisecond})
	if err != nil {
		t.Fatal(err)
	}
	defer api.Close()
	if info.MaxConns != 3 {
		t.Errorf("MaxConns efetivo = %d", info.MaxConns)
	}
	if got := int(api.Config().MaxConns); got != 3 {
		t.Errorf("pool com %d conexões, esperado 3", got)
	}

	var v string
	if err := api.QueryRow(ctx, "SHOW statement_timeout").Scan(&v); err != nil || v != "300ms" {
		t.Fatalf("pool da API: statement_timeout=%q err=%v", v, err)
	}
	// uma consulta lenta é cortada (SQLSTATE 57014 = query_canceled)
	_, err = api.Exec(ctx, "SELECT pg_sleep(2)")
	if err == nil || !strings.Contains(err.Error(), "57014") {
		t.Fatalf("consulta lenta deveria ser cancelada pelo timeout, err=%v", err)
	}

	// pool das migrations: sem timeout, e uma consulta do mesmo tamanho termina
	mig, err := Connect(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer mig.Close()
	if err := mig.QueryRow(ctx, "SHOW statement_timeout").Scan(&v); err != nil || v != "0" {
		t.Fatalf("pool das migrations: statement_timeout=%q err=%v (deveria ser 0)", v, err)
	}
	if _, err := mig.Exec(ctx, "SELECT pg_sleep(0.6)"); err != nil {
		t.Fatalf("o pool das migrations não pode ter timeout: %v", err)
	}
}

func TestConnectAPIClampsToServer(t *testing.T) {
	url := testURL(t)
	pool, info, err := ConnectAPI(context.Background(), url, PoolOptions{MaxConns: 100000})
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if info.ServerMax == 0 {
		t.Skip("não foi possível consultar max_connections")
	}
	if !info.Clamped || info.MaxConns >= info.ServerMax {
		t.Fatalf("100000 conexões deveria ser reduzido abaixo de max_connections=%d: %+v", info.ServerMax, info)
	}
	if int(pool.Config().MaxConns) != info.MaxConns {
		t.Errorf("pool com %d, info diz %d", pool.Config().MaxConns, info.MaxConns)
	}
}
