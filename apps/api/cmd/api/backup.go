package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"aurora/api/internal/db"
)

// backupMain faz `api backup <arquivo>`: uma cópia consistente do banco, feita com a API no ar (VACUUM INTO),
// sem a pausa nem o risco de copiar o .db e o -wal em momentos diferentes. O destino não pode existir.
func backupMain(args []string) int {
	if len(args) != 1 {
		fmt.Fprintln(os.Stderr, "uso: api backup <arquivo-de-destino.db>")
		return 2
	}
	path := os.Getenv("DB_PATH")
	if path == "" {
		path = "/data/aurora.db"
	}
	ctx := context.Background()
	d, err := openForBackup(ctx, path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro: %v\n", err)
		return 1
	}
	defer d.Close()
	if err := backupTo(ctx, d, args[0]); err != nil {
		fmt.Fprintf(os.Stderr, "erro: %v\n", err)
		return 1
	}
	fmt.Println("backup criado:", args[0])
	return 0
}

// backupTo grava uma cópia consistente do banco em dest. Recusa sobrescrever um arquivo que já existe.
func backupTo(ctx context.Context, d *sql.DB, dest string) error {
	if _, err := os.Stat(dest); err == nil {
		return fmt.Errorf("%s já existe", dest)
	}
	if _, err := d.ExecContext(ctx, "VACUUM INTO ?", dest); err != nil {
		return err
	}
	return os.Chmod(dest, 0o600)
}

func openForBackup(ctx context.Context, path string) (*sql.DB, error) {
	if _, err := os.Stat(path); err != nil {
		return nil, fmt.Errorf("banco não encontrado em %s: %w", path, err)
	}
	return db.Open(ctx, path)
}
