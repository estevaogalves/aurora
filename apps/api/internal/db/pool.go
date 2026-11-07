package db

import (
	"context"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PoolOptions configura o pool de conexões DA API (não as migrations).
type PoolOptions struct {
	// Máximo de conexões abertas. É reduzido se passar do que o servidor aguenta (veja ClampConns).
	MaxConns int
	// statement_timeout aplicado a cada conexão do pool. 0 = sem limite (ex.: pooler em modo transação
	// que rejeita parâmetros de inicialização; nesse caso use ALTER ROLE ... SET statement_timeout).
	StatementTimeout time.Duration
}

// PoolInfo diz o que foi efetivamente aplicado.
type PoolInfo struct {
	MaxConns                  int
	Clamped                   bool // MaxConns pedido foi reduzido
	ServerMax, ServerReserved int  // 0 se não deu para consultar o servidor
}

// ClampConns limita o pool para ficar abaixo do max_connections do Postgres com margem: desconta as
// conexões reservadas a superusuários e mais 20% (mínimo 10) para migrations, manutenção e outras
// réplicas/ferramentas. Se DB_MAX_CONNS x réplicas passar disso, ajuste o valor por réplica.
func ClampConns(configured, serverMax, serverReserved int) (effective int, clamped bool) {
	if serverMax <= 0 {
		return configured, false // servidor não consultado: confia no valor configurado
	}
	budget := serverMax - serverReserved
	margin := max(10, budget/5)
	allowed := max(1, budget-margin)
	if configured > allowed {
		return allowed, true
	}
	return configured, false
}

// ConnectAPI abre o pool da API com limite de conexões e statement_timeout. As migrations NÃO usam
// este pool (veja MigrateURL): uma migration longa não pode ser cortada pelo timeout da API.
func ConnectAPI(ctx context.Context, url string, opt PoolOptions) (*pgxpool.Pool, PoolInfo, error) {
	var info PoolInfo
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		return nil, info, err
	}

	info.ServerMax, info.ServerReserved = serverConnLimits(ctx, url)
	maxConns := max(1, opt.MaxConns)
	info.MaxConns, info.Clamped = ClampConns(maxConns, info.ServerMax, info.ServerReserved)
	cfg.MaxConns = int32(info.MaxConns)

	if opt.StatementTimeout > 0 {
		if cfg.ConnConfig.RuntimeParams == nil {
			cfg.ConnConfig.RuntimeParams = map[string]string{}
		}
		cfg.ConnConfig.RuntimeParams["statement_timeout"] = strconv.FormatInt(opt.StatementTimeout.Milliseconds(), 10)
	}

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, info, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, info, err
	}
	return pool, info, nil
}

// serverConnLimits lê max_connections e superuser_reserved_connections. Falha silenciosa: (0, 0).
func serverConnLimits(ctx context.Context, url string) (maxConns, reserved int) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, url)
	if err != nil {
		return 0, 0
	}
	defer conn.Close(context.Background())
	if err := conn.QueryRow(ctx,
		`SELECT current_setting('max_connections')::int, current_setting('superuser_reserved_connections')::int`,
	).Scan(&maxConns, &reserved); err != nil {
		return 0, 0
	}
	return maxConns, reserved
}
