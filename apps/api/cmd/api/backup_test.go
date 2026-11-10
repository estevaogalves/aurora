package main

import (
	"context"
	"path/filepath"
	"testing"

	"aurora/api/internal/db"
)

func TestBackupToIsConsistentCopy(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()
	d, err := db.Open(ctx, filepath.Join(dir, "aurora.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if err := db.Migrate(ctx, d); err != nil {
		t.Fatal(err)
	}
	if _, err := d.ExecContext(ctx, "INSERT INTO users (id, email, password_hash) VALUES ('u1', 'a@b.c', 'x')"); err != nil {
		t.Fatal(err)
	}

	dest := filepath.Join(dir, "copia.db")
	if err := backupTo(ctx, d, dest); err != nil {
		t.Fatal(err)
	}
	// a cópia abre sozinha e tem os dados
	c, err := db.Open(ctx, dest)
	if err != nil {
		t.Fatal(err)
	}
	defer c.Close()
	var n int
	if err := c.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); err != nil || n != 1 {
		t.Fatalf("a cópia deveria ter 1 usuário: n=%d err=%v", n, err)
	}
	// não sobrescreve um backup que já existe
	if err := backupTo(ctx, d, dest); err == nil {
		t.Fatal("deveria recusar sobrescrever")
	}
}
