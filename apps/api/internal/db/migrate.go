// Package db abre o banco SQLite (um arquivo) e aplica as migrations (goose, embutidas no binário).
package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite" // driver SQLite em Go puro (sem CGO)
)

//go:embed migrations/*.sql
var migrations embed.FS

// Open abre (criando, se preciso) o arquivo do banco e confere a conexão.
//
//   - WAL: leituras não bloqueiam a escrita e o arquivo sobrevive a um desligamento brusco.
//   - foreign_keys: o SQLite não liga as chaves estrangeiras sozinho, e o schema depende do ON DELETE CASCADE.
//   - busy_timeout: uma escrita espera a outra terminar em vez de falhar na hora.
//   - _txlock=immediate: toda transação já começa reservando a escrita (BEGIN IMMEDIATE). Só uma escreve por vez,
//     o que faz o papel do SELECT ... FOR UPDATE (duas edições da mesma linha não se atropelam).
func Open(ctx context.Context, path string) (*sql.DB, error) {
	if path == "" {
		return nil, fmt.Errorf("caminho do banco vazio")
	}
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o750); err != nil {
			return nil, fmt.Errorf("criar a pasta do banco: %w", err)
		}
	}
	q := []string{
		"_pragma=foreign_keys(1)",
		"_pragma=busy_timeout(5000)",
		"_pragma=journal_mode(WAL)",
		"_pragma=synchronous(NORMAL)",
		"_txlock=immediate",
	}
	dsn := "file:" + filepath.ToSlash(path) + "?" + strings.Join(q, "&")
	d, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, err
	}
	// poucas conexões: o SQLite aceita um escritor só, e uma API pessoal não precisa de mais
	d.SetMaxOpenConns(4)
	if err := d.PingContext(ctx); err != nil {
		d.Close()
		return nil, fmt.Errorf("banco indisponível: %w", err)
	}
	return d, nil
}

// Migrate aplica as migrations pendentes.
func Migrate(ctx context.Context, d *sql.DB) error {
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return err
	}
	return goose.UpContext(ctx, d, "migrations")
}
