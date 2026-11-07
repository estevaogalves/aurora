# Aurora API

Backend em Go: chi, pgx, sqlc, goose, Redis. Tudo sob `/api/v1`.

## Rodar

```bash
docker compose up --build        # na raiz: Postgres, Redis, API e web
# web em http://localhost:8080 · API direta em http://127.0.0.1:8081
```

Sem Docker, com Go 1.26+ e um Postgres/Redis locais:

```bash
export DATABASE_URL=postgres://aurora:aurora@localhost:5432/aurora?sslmode=disable
export JWT_SECRET=$(openssl rand -hex 32)
export APP_ENV=development COOKIE_SECURE=false   # só em dev local, sem HTTPS
go run ./cmd/api          # aplica as migrations ao iniciar
```

| Variável | Padrão | Para quê |
|---|---|---|
| `DATABASE_URL` | (obrigatória) | Postgres |
| `JWT_SECRET` | (obrigatória, 32+ caracteres) | assinatura do token de acesso |
| `MIGRATE_DATABASE_URL` | vazio | conexão direta só para as migrations (use com pooler em modo transação) |
| `REDIS_URL` | `redis://localhost:6379/0` | refresh tokens, rate limit, cache |
| `API_ADDR` | `:8080` | endereço do servidor |
| `ACCESS_TTL` / `REFRESH_TTL` | `15m` / `720h` | validade dos tokens |
| `APP_ENV` | `production` | `production` ou `development`; em `production` a API não inicia com `COOKIE_SECURE=false` |
| `COOKIE_SECURE` | `true` | cookie de refresh só por HTTPS (`false` só com `APP_ENV=development`) |
| `CORS_ORIGINS` | `http://localhost:5173` | origens permitidas, separadas por vírgula |
| `ADMIN_EMAIL` | vazio | quem se cadastra com este e-mail vira `admin` |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW` | `5` / `15m` | limite de logins com falha |
| `HASH_MAX_CONCURRENCY` | automático | hashes de senha (argon2id, 64 MiB cada) ao mesmo tempo; automático = 40% do limite de memória / 64 MiB, no máximo o nº de CPUs |
| `HASH_MAX_QUEUE` / `HASH_QUEUE_TIMEOUT` | `4×` a concorrência / `3s` | fila de espera por uma vaga de hash; fila cheia ou tempo esgotado => `503` + `Retry-After` |
| `REGISTER_MAX_PER_IP` / `REGISTER_WINDOW` | `5` / `1h` | cadastros por IP na janela; passou => `429` + `Retry-After` (a chave é o IP: veja `TRUST_PROXY`) |
| `TRUST_PROXY` | `false` (no compose: `true`) | ler o IP do cliente de `X-Real-IP`/`X-Forwarded-For`. **Só ligue se a API for alcançável apenas por um proxy que sobrescreve esses cabeçalhos** (o nginx do projeto faz isso); senão qualquer cliente forja o IP e escapa dos limites. Veja `docs/ip-real-atras-de-proxy.md` |

## Como funciona

- **Dinheiro** sempre em centavos inteiros (`bigint`). Meses como `"AAAA-MM"`. O JSON usa o mesmo formato do front (`FinanceData`), então o `ApiRepository` do front é direto.
- **Login:** senha com argon2id. O token de acesso (JWT, 15 min) vai no corpo; o refresh token vai em cookie `httpOnly` (`aurora_refresh`, path `/api/v1/auth`).
- **Refresh rotativo:** cada token vale uma vez. O Redis guarda só o **hash** (SHA-256). Se um token já gasto reaparece, todas as sessões do usuário são encerradas.
- **Rate limit:** falhas de login por e-mail+IP no Redis; estourou, responde `429` com `Retry-After`. Login com sucesso zera o contador.
- **Cache:** `GET /summary/{mês}` fica no Redis (1 h). Toda escrita incrementa uma versão por usuário, o que invalida todos os resumos dele de uma vez. O cabeçalho `X-Cache` mostra `HIT` ou `MISS`.
- **Fixas:** valor específico e mês ocultado ficam em `fixed_overrides`. No JSON voltam como `monthlyValues` e `hiddenMonths`.
- **Importação:** `POST /import` grava tudo numa transação; sem `?replace=true`, recusa (`409`) se a conta já tem dados.

## Endpoints

| | |
|---|---|
| `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` | sessão |
| `GET /me` · `GET /admin/users` (admin) | usuário |
| `GET /data` | tudo do usuário (`FinanceData`) |
| `POST /import[?replace=true]` | importar o `localStorage` |
| `POST`, `PATCH /{id}`, `DELETE /{id}` em `/transactions`, `/credits`, `/goals`, `/extra-expenses`, `/notes` | CRUD |
| `POST`, `DELETE /{id}` em `/categories` | categorias próprias |
| `PUT /settings/distribution` · `/settings/seen-alerts` | configurações |
| `GET /summary/{mês}` · `/projection?start=&count=` · `/comparison?months=a,b` | cálculos |
| `GET /healthz` | saúde (banco e Redis) |

`PATCH` muda só os campos enviados. Em metas, `"deadline": null` limpa o prazo; sem a chave, o prazo não muda. `hiddenMonths` e `monthlyValues`, quando enviados, substituem a lista/mapa inteiro. Nas criações o `id` enviado pelo cliente (UUID) é respeitado; ausente ou inválido, o banco gera um. O contrato completo está em `docs/openapi.yaml`.

## Desenvolvimento

```bash
go test ./...                                   # unitários (domínio e auth)
TEST_DATABASE_URL=postgres://... go test ./...  # inclui os testes de integração da API
```

- Migrations: `internal/db/migrations` (goose, embutidas no binário e aplicadas ao iniciar).
- Queries: `internal/db/queries/*.sql`. Depois de mudar queries ou migrations, regenere com `sqlc generate` (saída em `internal/store/sqlcgen`, versionada).
- `internal/domain` é a versão em Go de `apps/web/src/domain` (mesmas regras e mesmos testes de conta).

## Banco externo (Postgres local ou Supabase)

A API só precisa de `DATABASE_URL`; as migrations rodam ao iniciar. O Redis continua obrigatório (refresh tokens, rate limit e cache), e o Supabase não o oferece: use um Redis local ou um serviço como o Upstash (`rediss://...`).

**Postgres na própria máquina:** crie usuário e banco (`CREATE USER aurora ...; CREATE DATABASE aurora OWNER aurora;`) e use `postgres://aurora:senha@localhost:5432/aurora?sslmode=disable`. A migration 1 cria a extensão `pgcrypto`, então o usuário precisa de permissão para isso na primeira vez. Com a API no Docker, o host é `host.docker.internal`, e o Postgres precisa aceitar conexões vindas da rede do Docker: com `listen_addresses = 'localhost'` (o padrão de muitas instalações) a conexão é recusada. Ajuste `listen_addresses` e o `pg_hba.conf` (ou rode a API fora do Docker, com `localhost`).

**Supabase:** use a connection string do projeto com `sslmode=require`.

- Conexão direta (porta 5432) e *session pooler* funcionam sem ajustes (a direta é só IPv6 no plano gratuito).
- *Transaction pooler* (porta 6543) não aceita os prepared statements do `pgx`: acrescente `default_query_exec_mode=simple_protocol` à `DATABASE_URL` e defina `MIGRATE_DATABASE_URL` com a conexão direta ou session, para o goose.
- A migration 2 liga o RLS (sem policies) em todas as tabelas, para que a API REST do Supabase, que expõe o schema `public`, não devolva nada com a chave pública. A API conecta como dono das tabelas e não é afetada.
- O Supabase Auth não é usado: o Aurora tem usuários e sessões próprios.

Em produção: `APP_ENV=production`, `COOKIE_SECURE=true` (obrigatório), `JWT_SECRET` forte e `CORS_ORIGINS` com o domínio real. Nunca aponte `TEST_DATABASE_URL` para o banco real, pois os testes criam dados.
