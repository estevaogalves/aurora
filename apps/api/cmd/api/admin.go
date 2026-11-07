package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"aurora/api/internal/db"
	"aurora/api/internal/store"
)

// adminMain liga o comando ao banco (só precisa de DATABASE_URL; não exige JWT_SECRET nem sobe o servidor).
func adminMain(args []string) int {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL é obrigatória")
		return 1
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		fmt.Fprintf(os.Stderr, "erro: %v\n", err)
		return 1
	}
	defer pool.Close()
	return runAdmin(ctx, store.New(pool), args, os.Stdout, os.Stderr)
}

// adminStore é o que o comando `api admin` precisa do banco (facilita o teste).
type adminStore interface {
	PromoteAdmin(ctx context.Context, email string) (store.User, bool, error)
	DemoteAdmin(ctx context.Context, email string) (store.User, bool, error)
}

const adminUsage = `uso: api admin promote <e-mail>
     api admin demote <e-mail>

O papel de admin só é concedido por este comando, executado no servidor com acesso ao banco
(DATABASE_URL). Exemplo com o compose:
  docker compose exec api api admin promote voce@dominio.com
Quem já está com a sessão aberta só passa a valer como admin no próximo login (ou em até ACCESS_TTL).`

// runAdmin executa `api admin <promote|demote> <e-mail>` e devolve o código de saída
// (0 ok, 1 falha, 2 uso incorreto).
func runAdmin(ctx context.Context, st adminStore, args []string, out, errOut io.Writer) int {
	if len(args) != 2 || (args[0] != "promote" && args[0] != "demote") {
		fmt.Fprintln(errOut, adminUsage)
		return 2
	}
	email := strings.ToLower(strings.TrimSpace(args[1]))
	if !strings.Contains(email, "@") {
		fmt.Fprintf(errOut, "e-mail inválido: %q\n", args[1])
		return 2
	}

	var (
		u       store.User
		changed bool
		err     error
	)
	if args[0] == "promote" {
		u, changed, err = st.PromoteAdmin(ctx, email)
	} else {
		u, changed, err = st.DemoteAdmin(ctx, email)
	}

	switch {
	case errors.Is(err, store.ErrNotFound):
		fmt.Fprintf(errOut, "usuário %q não encontrado: a pessoa precisa se cadastrar antes de ser promovida ou rebaixada\n", email)
		return 1
	case errors.Is(err, store.ErrLastAdmin):
		fmt.Fprintf(errOut, "recusado: %q é o único admin. Promova outro usuário antes de rebaixá-lo\n", email)
		return 1
	case err != nil:
		fmt.Fprintf(errOut, "erro: %v\n", err)
		return 1
	}

	switch {
	case args[0] == "promote" && changed:
		fmt.Fprintf(out, "%s agora é admin\n", u.Email)
	case args[0] == "promote":
		fmt.Fprintf(out, "%s já era admin (nada mudou)\n", u.Email)
	case changed:
		fmt.Fprintf(out, "%s deixou de ser admin\n", u.Email)
	default:
		fmt.Fprintf(out, "%s não era admin (nada mudou)\n", u.Email)
	}
	return 0
}
