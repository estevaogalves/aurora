package db

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/google/uuid"
	"github.com/pressly/goose/v3"
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

// Quem já usa o Aurora com SQLite tem um aurora.db na versão 1 (só o 00001). Ao ligar a versão nova, as migrations
// 00012 a 00023 têm que rodar sozinhas, sem perder nada, e as metas existentes ganham o histórico ("Saldo inicial")
// que reproduz exatamente o valor que já estava guardado.
func TestUpgradeFromVersion1KeepsDataAndBackfillsGoalHistory(t *testing.T) {
	ctx := context.Background()
	d, err := Open(ctx, filepath.Join(t.TempDir(), "antigo.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()

	// banco "antigo": só a migration 1
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatal(err)
	}
	if err := goose.UpToContext(ctx, d, "migrations", 1); err != nil {
		t.Fatalf("migrar até a versão 1: %v", err)
	}
	exec := func(q string, args ...any) {
		t.Helper()
		if _, err := d.ExecContext(ctx, q, args...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	exec("INSERT INTO users (id, email, password_hash) VALUES ('u1', 'a@b.c', 'x')")
	exec("INSERT INTO transactions (id, user_id, name, amount_cents, type, category, month) VALUES ('t1', 'u1', 'Aluguel', 150000, 'expense', 'Moradia', '2026-11')")
	exec("INSERT INTO credit_cards (id, user_id, name, closing_day, due_day) VALUES ('c1', 'u1', 'Nubank', 2, 9)")
	exec("INSERT INTO goals (id, user_id, name, target_cents, saved_cents, yield_total_cents, piggy) VALUES ('g1', 'u1', 'Viagem', 500000, 10300, 300, 0)")
	exec("INSERT INTO goals (id, user_id, name, target_cents, saved_cents, yield_total_cents, piggy) VALUES ('g2', 'u1', 'Só rendimento gasto', 100000, 100, 300, 0)")
	exec("INSERT INTO goals (id, user_id, name, target_cents, saved_cents, yield_total_cents, piggy) VALUES ('g3', 'u1', 'Vazia', 100000, 0, 0, 0)")
	exec("INSERT INTO goals (id, user_id, name, target_cents, saved_cents, yield_total_cents, piggy) VALUES ('g4', 'u1', 'Porquinho', 0, 2500, 0, 1)")

	// ligar a versão nova: o Migrate aplica as pendentes
	if err := Migrate(ctx, d); err != nil {
		t.Fatalf("atualizar: %v", err)
	}
	var version int64
	if err := d.QueryRowContext(ctx, "SELECT max(version_id) FROM goose_db_version").Scan(&version); err != nil || version != 23 {
		t.Fatalf("versão depois de atualizar: %d %v", version, err)
	}

	// os dados de antes continuam, e as colunas novas ganharam os valores padrão
	var name string
	var cents, group int64
	var end, purchase string
	if err := d.QueryRowContext(ctx, "SELECT name, amount_cents, dist_group, end_month, purchase_date FROM transactions WHERE id = 't1'").Scan(&name, &cents, &group, &end, &purchase); err != nil {
		t.Fatal(err)
	}
	if name != "Aluguel" || cents != 150000 || group != 0 || end != "" || purchase != "" {
		t.Fatalf("lançamento depois de atualizar: %s %d %d %q %q", name, cents, group, end, purchase)
	}
	var limit int64
	var payments, adjustments string
	if err := d.QueryRowContext(ctx, "SELECT limit_cents, payments, adjustments FROM credit_cards WHERE id = 'c1'").Scan(&limit, &payments, &adjustments); err != nil {
		t.Fatal(err)
	}
	if limit != 0 || payments != "{}" || adjustments != "{}" {
		t.Fatalf("cartão depois de atualizar: %d %s %s", limit, payments, adjustments)
	}

	// cada meta com valor ganhou o histórico, e refazer a conta devolve exatamente o que estava guardado
	replay := func(goal string) (saved, yield int64, rows int) {
		t.Helper()
		r, err := d.QueryContext(ctx, "SELECT id, type, amount_cents FROM goal_movements WHERE goal_id = ? ORDER BY created_at, rowid", goal)
		if err != nil {
			t.Fatal(err)
		}
		defer r.Close()
		for r.Next() {
			var id, typ string
			var amount int64
			if err := r.Scan(&id, &typ, &amount); err != nil {
				t.Fatal(err)
			}
			if _, err := uuid.Parse(id); err != nil {
				t.Fatalf("o id do histórico precisa ser um UUID válido: %q", id)
			}
			rows++
			switch typ {
			case "yield":
				saved += amount
				yield += amount
			case "adjustment":
				saved = amount
			}
		}
		return saved, yield, rows
	}
	for _, c := range []struct {
		goal         string
		saved, yield int64
		rows         int
	}{
		{"g1", 10300, 300, 2},
		{"g2", 100, 300, 2},
		{"g3", 0, 0, 0},
		{"g4", 2500, 0, 1},
	} {
		saved, yield, rows := replay(c.goal)
		if saved != c.saved || yield != c.yield || rows != c.rows {
			t.Errorf("%s: guardado %d (esperado %d), rendimentos %d (esperado %d), %d movimentos (esperado %d)", c.goal, saved, c.saved, yield, c.yield, rows, c.rows)
		}
	}

	// a atualização é segura de repetir (a API roda Migrate a cada subida)
	if err := Migrate(ctx, d); err != nil {
		t.Fatalf("migrar de novo: %v", err)
	}
	var n int
	if err := d.QueryRowContext(ctx, "SELECT count(*) FROM goal_movements").Scan(&n); err != nil || n != 5 {
		t.Fatalf("migrar de novo não pode duplicar o histórico: %d %v", n, err)
	}
}

// A migration 00019 refaz as tabelas de investimentos (o SQLite não altera um CHECK no lugar): os investimentos e
// as movimentações que já existiam têm que continuar iguais, e o negócio próprio passa a ser aceito.
func TestBusinessMigrationKeepsInvestments(t *testing.T) {
	ctx := context.Background()
	d, err := Open(ctx, filepath.Join(t.TempDir(), "antigo.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatal(err)
	}
	if err := goose.UpToContext(ctx, d, "migrations", 18); err != nil {
		t.Fatal(err)
	}
	exec := func(q string) {
		t.Helper()
		if _, err := d.ExecContext(ctx, q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	exec("INSERT INTO users (id, email, password_hash) VALUES ('u1', 'a@b.c', 'x')")
	exec("INSERT INTO investments (id, user_id, name, family, institution, applied_at, current_value_cents, fees) VALUES ('i1', 'u1', 'CDB', 'fixed', 'Banco A', '2026-01-01', 105000, 'IR')")
	exec("INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents, note, origin) VALUES ('m1', 'u1', 'i1', 'contribution', '2026-01-01', 100000, 'primeiro', 'distribution|2026-01|a|1')")
	exec("INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents) VALUES ('m2', 'u1', 'i1', 'yield', '2026-02-01', 5000)")

	if err := Migrate(ctx, d); err != nil {
		t.Fatalf("atualizar: %v", err)
	}
	var name, fees, note, origin string
	var value int64
	if err := d.QueryRowContext(ctx, "SELECT name, fees, current_value_cents FROM investments WHERE id = 'i1'").Scan(&name, &fees, &value); err != nil || name != "CDB" || fees != "IR" || value != 105000 {
		t.Fatalf("investimento depois de atualizar: %q %q %d %v", name, fees, value, err)
	}
	if err := d.QueryRowContext(ctx, "SELECT note, origin FROM investment_movements WHERE id = 'm1'").Scan(&note, &origin); err != nil || note != "primeiro" || origin != "distribution|2026-01|a|1" {
		t.Fatalf("movimentação depois de atualizar: %q %q %v", note, origin, err)
	}
	var n int
	if err := d.QueryRowContext(ctx, "SELECT count(*) FROM investment_movements").Scan(&n); err != nil || n != 2 {
		t.Fatalf("movimentações: %d %v", n, err)
	}
	// o negócio próprio e o recebimento agora são aceitos; o apagar em cascata continua valendo
	exec("INSERT INTO investments (id, user_id, name, family, institution, applied_at) VALUES ('b1', 'u1', 'Revenda', 'business', 'Negócio próprio', '2026-03-01')")
	exec("INSERT INTO investment_movements (id, user_id, investment_id, type, date, amount_cents) VALUES ('m3', 'u1', 'b1', 'income', '2026-03-02', 8000)")
	exec("DELETE FROM investments WHERE id = 'b1'")
	if err := d.QueryRowContext(ctx, "SELECT count(*) FROM investment_movements WHERE investment_id = 'b1'").Scan(&n); err != nil || n != 0 {
		t.Fatalf("cascata: %d %v", n, err)
	}
}

// As migrations 00020 a 00023 (dia do vencimento, planejamento, etiquetas e comprovantes) só acrescentam colunas com valor
// padrão e uma tabela: o que já existia continua igual, e apagar o lançamento leva os comprovantes junto.
func TestMigrations20to23KeepOldData(t *testing.T) {
	ctx := context.Background()
	d, err := Open(ctx, filepath.Join(t.TempDir(), "antigo.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	goose.SetBaseFS(migrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		t.Fatal(err)
	}
	if err := goose.UpToContext(ctx, d, "migrations", 19); err != nil {
		t.Fatal(err)
	}
	exec := func(q string) {
		t.Helper()
		if _, err := d.ExecContext(ctx, q); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	exec("INSERT INTO users (id, email, password_hash) VALUES ('u1', 'a@b.c', 'x')")
	exec("INSERT INTO user_settings (user_id, seen_alerts) VALUES ('u1', '[\"k\"]')")
	exec("INSERT INTO transactions (id, user_id, name, amount_cents, type, category, month) VALUES ('t1', 'u1', 'Aluguel', 150000, 'expense', 'Moradia', '2026-11')")

	if err := Migrate(ctx, d); err != nil {
		t.Fatalf("atualizar: %v", err)
	}
	var name string
	var cents, dueDay int64
	var tags, planning, seen string
	if err := d.QueryRowContext(ctx, "SELECT name, amount_cents, due_day, tags FROM transactions WHERE id = 't1'").Scan(&name, &cents, &dueDay, &tags); err != nil {
		t.Fatal(err)
	}
	if name != "Aluguel" || cents != 150000 || dueDay != 0 || tags != "[]" {
		t.Fatalf("lançamento depois de atualizar: %s %d %d %s", name, cents, dueDay, tags)
	}
	if err := d.QueryRowContext(ctx, "SELECT planning, seen_alerts FROM user_settings WHERE user_id = 'u1'").Scan(&planning, &seen); err != nil || planning != "{}" || seen != `["k"]` {
		t.Fatalf("configurações depois de atualizar: %q %q %v", planning, seen, err)
	}

	// comprovante: só os tipos aceitos, e apagar o lançamento leva o comprovante
	exec("INSERT INTO transaction_receipts (id, user_id, transaction_id, name, mime, size_bytes, data) VALUES ('r1', 'u1', 't1', 'nota.png', 'image/png', 3, x'89504e')")
	if _, err := d.ExecContext(ctx, "INSERT INTO transaction_receipts (id, user_id, transaction_id, name, mime, size_bytes, data) VALUES ('r2', 'u1', 't1', 'x.svg', 'image/svg+xml', 3, x'3c7376')"); err == nil {
		t.Fatal("SVG deveria ser recusado pela migration")
	}
	exec("DELETE FROM transactions WHERE id = 't1'")
	var n int
	if err := d.QueryRowContext(ctx, "SELECT count(*) FROM transaction_receipts").Scan(&n); err != nil || n != 0 {
		t.Fatalf("cascata dos comprovantes: %d %v", n, err)
	}
}
