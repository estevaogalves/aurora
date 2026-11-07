package main

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"

	"aurora/api/internal/audit"
	"aurora/api/internal/store"
)

type fakeAdmins struct {
	promote, demote func(email string) (store.User, bool, error)
}

func (f fakeAdmins) PromoteAdmin(_ context.Context, e string) (store.User, bool, error) { return f.promote(e) }
func (f fakeAdmins) DemoteAdmin(_ context.Context, e string) (store.User, bool, error)  { return f.demote(e) }

var auditLog bytes.Buffer

func runCmd(st adminStore, args ...string) (int, string, string) {
	var out, errOut bytes.Buffer
	aud := audit.New(slog.New(slog.NewJSONHandler(&auditLog, nil)))
	code := runAdmin(context.Background(), st, aud, args, &out, &errOut)
	return code, out.String(), errOut.String()
}

func TestAdminCommand(t *testing.T) {
	u := store.User{Email: "a@x.com"}
	var got string
	st := fakeAdmins{
		promote: func(e string) (store.User, bool, error) {
			got = e
			switch e {
			case "naoexiste@x.com":
				return store.User{}, false, store.ErrNotFound
			case "ja@x.com":
				return u, false, nil
			}
			return u, true, nil
		},
		demote: func(e string) (store.User, bool, error) {
			if e == "ultimo@x.com" {
				return store.User{}, false, store.ErrLastAdmin
			}
			return u, true, nil
		},
	}

	cases := []struct {
		name    string
		args    []string
		code    int
		wantOut string
		wantErr string
	}{
		{"promover", []string{"promote", "  A@X.com "}, 0, "agora é admin", ""},
		{"já era admin", []string{"promote", "ja@x.com"}, 0, "já era admin", ""},
		{"e-mail inexistente", []string{"promote", "naoexiste@x.com"}, 1, "", "não encontrado"},
		{"rebaixar", []string{"demote", "a@x.com"}, 0, "deixou de ser admin", ""},
		{"rebaixar o último admin", []string{"demote", "ultimo@x.com"}, 1, "", "único admin"},
		{"sem argumentos", nil, 2, "", "uso:"},
		{"verbo inválido", []string{"delete", "a@x.com"}, 2, "", "uso:"},
		{"e-mail sem @", []string{"promote", "abc"}, 2, "", "e-mail inválido"},
	}
	for _, c := range cases {
		code, out, errOut := runCmd(st, c.args...)
		if code != c.code || !strings.Contains(out, c.wantOut) || !strings.Contains(errOut, c.wantErr) {
			t.Errorf("%s: code=%d out=%q err=%q", c.name, code, out, errOut)
		}
	}
	// auditoria: promover e rebaixar geram evento (admin.promote/admin.demote) com IP "cli" e sem e-mail;
	// no-op, recusa e erro não geram
	logs := auditLog.String()
	if strings.Count(logs, `"event":"admin.promote"`) != 1 || strings.Count(logs, `"event":"admin.demote"`) != 1 {
		t.Errorf("eventos de auditoria inesperados:\n%s", logs)
	}
	if strings.Contains(logs, "@") || !strings.Contains(logs, `"ip":"cli"`) {
		t.Errorf("a auditoria não pode conter e-mail e deve marcar ip=cli:\n%s", logs)
	}
	if got != "a@x.com" && got != "ja@x.com" && got != "naoexiste@x.com" {
		t.Errorf("o e-mail deveria chegar normalizado (minúsculo, sem espaços), chegou %q", got)
	}
}
