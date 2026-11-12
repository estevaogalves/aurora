# Manter a versão SQLite em dia com a `main`

A `main` usa Postgres. Esta branch (`local-sqlite`) é a mesma aplicação com o banco em arquivo (`data/aurora.db`).
O front e a maior parte do Go são idênticos: só a camada do banco muda. Para trazer as novidades da `main`:

1. `git merge origin/main` nesta branch. Os arquivos de banco vão conflitar; o resto entra limpo.
2. **Migrations:** para cada migration nova da `main` (ex.: `00019_algo.sql`), crie o arquivo **com o mesmo número** em
   `apps/api/internal/db/migrations/`, em SQLite. Assim as versões do banco ficam iguais nas duas branches.
   Nunca edite a `00001_init.sql`: quem já usa o app tem o banco na versão anterior e só recebe migrations novas.
3. **Consultas** (`internal/db/queries/*.sql`): traduza para SQLite.
   - `$1`, `$2` viram `?`; `FOR UPDATE` sai (as transações já começam com `BEGIN IMMEDIATE`).
   - `COALESCE(NULLIF($1::uuid, ...), gen_random_uuid())` sai: o `id` é gerado no Go (`clientID` / `uuid.New()`).
   - "Só muda se veio na requisição" (`CASE WHEN set_x ...`) vira uma consulta separada (ex.: `SetTransactionCard`).
   - `jsonb` vira `json_*` (`json_object`, `json_patch`, `json_remove`); tipos: `uuid`, `jsontext` e `real` (cotas).
4. `docker run --rm -v "$PWD/apps/api":/src -w /src sqlc/sqlc:1.31.1 generate` e corrija o Go até compilar
   (nomes de parâmetro no lugar de `Column1`, `int64` no lugar de `int32`, `sql.Null*` no lugar de `pgtype.*`).
5. Testes: `go vet ./... && go test ./...` em `apps/api` (usa um arquivo SQLite temporário) e `sqlc diff`.
   O teste `TestUpgradeFromVersion1...` em `internal/db` confere que um banco antigo atualiza sem perder dados:
   acrescente nele o que a migration nova mexer.
