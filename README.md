# Aurora

Controle financeiro pessoal: rendas, despesas (fixas e comuns), compras no crédito, metas, projeção, comparação entre meses e relatórios em PDF.

Monorepo pnpm:

| Pasta | O que é |
|---|---|
| `apps/web` | Front: React 19, TypeScript, Vite, Tailwind, Zustand |
| `apps/api` | Backend: Go (chi, pgx, sqlc, goose), Postgres e Redis. Detalhes em [`apps/api/README.md`](apps/api/README.md) |
| `packages/api-types` | Tipos TypeScript gerados de `docs/openapi.yaml` |
| `docs` | Contrato da API (`openapi.yaml`) e o acompanhamento das fases (`REFERENCIAS.md`) |

## Começando

Pré-requisitos: Node 22+, pnpm 11 (`corepack enable`) e Docker. Go não precisa estar instalado.

```bash
make env                # cria o .env com JWT_SECRET, POSTGRES_PASSWORD e REDIS_PASSWORD aleatórios (obrigatórios; sem valor padrão)
make up                  # tudo no Docker: http://localhost:8080
```

Para desenvolver o front com recarga automática, contra a API no Docker:

```bash
make dev                 # Postgres + Redis + API no Docker, front em http://localhost:5173
```

Só o front, sem backend (dados no `localStorage`, sem login):

```bash
pnpm install
pnpm dev
```

O servidor de desenvolvimento só escuta em `localhost` e só aceita `localhost`/IPs no cabeçalho `Host` (protege contra DNS
rebinding). Abrir de outro aparelho é opt-in, a cada execução:

```bash
pnpm dev --host                                   # abre na rede local (celular): http://<IP-do-computador>:5173
DEV_ALLOWED_HOSTS=meu-app.ngrok.app pnpm dev      # túnel (ngrok, Cloudflare Tunnel): libera só esse nome
#   PowerShell: $env:DEV_ALLOWED_HOSTS="meu-app.ngrok.app"; pnpm dev
```
`DEV_ALLOWED_HOSTS` aceita vários nomes separados por vírgula (`.ngrok.app` com ponto libera subdomínios); curingas são recusados.

## Banco externo

Para usar um Postgres local ou o Supabase em vez do container, veja `.env.example` e a seção "Banco externo" em [`apps/api/README.md`](apps/api/README.md).

## Modos de dados

O front escolhe de onde vêm os dados por `VITE_DATA_SOURCE` (veja `apps/web/.env.example`):

- `local` (padrão do `pnpm dev`): `localStorage`, sem conta.
- `api`: backend Go, com cadastro e login. É o que o `docker compose` usa.

Quem já tinha dados no navegador pode levá-los para a conta em **Importar dados locais** (menu do usuário). Os dados do navegador não são apagados.

## Comandos

`make help` lista todos. Os principais:

| Comando | O que faz |
|---|---|
| `make up` / `make down` | Sobe e para tudo no Docker |
| `make dev` | API no Docker e front em modo dev |
| `make test` | Testes do front (Vitest) e da API (Go, com Postgres no Docker) |
| `make check` | O que o CI roda no front: lint, `tsc -b`, testes, build e tipos da API |
| `make generate` | Regenera os tipos (`openapi.yaml`) e o código do sqlc |
| `make clean` | Para tudo e apaga o banco do Docker |

## Contrato da API

`docs/openapi.yaml` descreve a API. Depois de mudar o YAML, rode `make generate` e faça commit de `packages/api-types/src/schema.d.ts`. O CI falha se os tipos estiverem fora de sincronia. O YAML é escrito à mão: o backend não o valida, então atualize-o junto com qualquer mudança nos endpoints.

## CI

`.github/workflows/ci.yml`, em todo push na `main` e em pull requests:

- **Front:** tipos gerados em dia, `eslint`, `tsc -b`, Vitest e build.
- **API:** `go vet`, `go test` (com Postgres de verdade, incluindo os testes de integração) e `sqlc diff`.

## Variáveis de ambiente

- Raiz (`docker compose`): veja `.env.example`. Em produção use `APP_ENV=production` (padrão), um `JWT_SECRET`, uma `POSTGRES_PASSWORD` e uma `REDIS_PASSWORD` próprios e HTTPS: a API recusa `COOKIE_SECURE=false` nesse modo.
- API: tabela completa em `apps/api/README.md`.
- Front: `apps/web/.env.example`.
