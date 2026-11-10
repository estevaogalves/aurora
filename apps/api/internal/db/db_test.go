package db

import (
	"context"
	"path/filepath"
	"testing"
)

func TestOpenAndMigrate(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "sub", "aurora.db") // a pasta é criada se não existir
	d, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	// migrar duas vezes é seguro (a API roda Migrate a cada subida)
	for i := 0; i < 2; i++ {
		if err := Migrate(ctx, d); err != nil {
			t.Fatalf("migrate #%d: %v", i+1, err)
		}
	}

	// o SQLite não liga as chaves estrangeiras sozinho: o schema depende delas (ON DELETE CASCADE)
	var fk int
	if err := d.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&fk); err != nil || fk != 1 {
		t.Fatalf("foreign_keys deveria estar ligado: %d %v", fk, err)
	}
	var mode string
	if err := d.QueryRowContext(ctx, "PRAGMA journal_mode").Scan(&mode); err != nil || mode != "wal" {
		t.Fatalf("journal_mode deveria ser wal: %q %v", mode, err)
	}

	// o ON DELETE CASCADE funciona: apagar o usuário apaga o que é dele
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := d.ExecContext(ctx, q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	exec("INSERT INTO users (id, email, password_hash) VALUES ('u1', 'a@b.c', 'x')")
	exec("INSERT INTO notes (id, user_id, content, month) VALUES ('n1', 'u1', 'oi', '2026-11')")
	exec("DELETE FROM users WHERE id = 'u1'")
	var n int
	if err := d.QueryRowContext(ctx, "SELECT count(*) FROM notes").Scan(&n); err != nil || n != 0 {
		t.Fatalf("a cascata deveria apagar as notas: n=%d err=%v", n, err)
	}

	// e o arquivo existe de verdade no caminho pedido
	d.Close()
	d2, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer d2.Close()
	if err := d2.QueryRowContext(ctx, "SELECT count(*) FROM users").Scan(&n); err != nil {
		t.Fatalf("reabrir o arquivo: %v", err)
	}
}

func TestOpenEmptyPath(t *testing.T) {
	if _, err := Open(context.Background(), ""); err == nil {
		t.Fatal("caminho vazio deveria dar erro")
	}
}
