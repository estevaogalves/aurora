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
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW` | `5` / `15m` | limite de logins com falha |
| `HASH_MAX_CONCURRENCY` | automático | hashes de senha (argon2id, 64 MiB cada) ao mesmo tempo; automático = 40% do limite de memória / 64 MiB, no máximo o nº de CPUs |
| `HASH_MAX_QUEUE` / `HASH_QUEUE_TIMEOUT` | `4×` a concorrência / `3s` | fila de espera por uma vaga de hash; fila cheia ou tempo esgotado => `503` + `Retry-After` |
| `REGISTER_MAX_PER_IP` / `REGISTER_WINDOW` | `5` / `1h` | cadastros por IP na janela; passou => `429` + `Retry-After` (a chave é o IP: veja `TRUST_PROXY`) |
| `DB_MAX_CONNS` | `10` | conexões do pool da API; reduzido sozinho para caber no `max_connections` do servidor (descontadas as reservadas e 20% de margem). Com várias réplicas: valor × réplicas deve caber |
| `DB_STATEMENT_TIMEOUT` | `15s` | `statement_timeout` **só do pool da API** (migrations usam outra conexão, sem limite). `0` desliga (pooler em modo transação que rejeita o parâmetro: use `ALTER ROLE ... SET statement_timeout`) |
| `MAX_BODY_BYTES` / `MAX_IMPORT_BYTES` | `256 KiB` / `10 MiB` | corpo máximo de uma requisição / da importação (413 ao passar) |
| `MAX_IMPORT_ITEMS` | `25000` | itens por coleção na importação (400 ao passar) |
| `MAX_MONTH_OVERRIDES` | `600` | `hiddenMonths` + `monthlyValues` de uma despesa fixa (50 anos) |
| `MAX_CUSTOM_CATEGORIES` / `MAX_DISTRIBUTION_ITEMS` | `200` / `50` | categorias próprias na importação / itens da distribuição do saldo |
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

## Administração (papel de admin)

O papel `admin` **nunca** é concedido pelo cadastro (o e-mail não é verificado). Só por comando, no servidor, com
acesso ao banco, depois de a pessoa se cadastrar:

```bash
docker compose exec api api admin promote voce@dominio.com
docker compose exec api api admin demote  voce@dominio.com
```

- `promote` falha com mensagem clara se o e-mail não existe; é idempotente.
- `demote` recusa rebaixar o **último** admin (travado em transação: dois rebaixamentos simultâneos não zeram a lista).
- O papel viaja no token de acesso: vale a partir do próximo login (ou em até `ACCESS_TTL`, 15 min).
- Sem Docker: `DATABASE_URL=... go run ./cmd/api admin promote voce@dominio.com`.
- A variável antiga `ADMIN_EMAIL` não tem mais efeito (a API só registra um aviso se ela estiver definida).

## Logs de auditoria

Eventos de segurança saem no stdout como JSON, com `"msg":"audit"` e **somente** quatro informações: hora (`time`),
tipo (`event`), id do usuário (`user_id`, ausente quando não se sabe quem é) e IP (`ip`; `cli` nos comandos de `api admin`).
Nunca entram senha, e-mail, nome, token, cookie nem corpo de requisição (o pacote `internal/audit` não aceita outros campos).

| `event` | Quando |
|---|---|
| `auth.register` / `auth.register_rate_limited` | cadastro criado / recusado pelo limite por IP |
| `auth.login_success` / `auth.login_failed` | login ok / senha errada (`user_id` presente se o e-mail existe, ausente se não existe) |
| `auth.login_blocked` | bloqueado pelo limite de tentativas |
| `auth.refresh` / `auth.refresh_invalid` / `auth.refresh_reuse` | renovação / token desconhecido / **token já gasto reapareceu** (sessões do usuário encerradas) |
| `auth.logout` | logout com token válido |
| `admin.list_users` | acesso a `GET /admin/users` |
| `admin.promote` / `admin.demote` | `api admin promote|demote` (`user_id` = a pessoa afetada) |

```bash
docker compose logs api | grep '"msg":"audit"'                               # todos os eventos
docker compose logs api | grep '"event":"auth.login_failed"'                 # logins falhos
docker compose logs api | grep '"event":"auth.refresh_reuse"'                # possível roubo de sessão
```

Para detectar força bruta, procure muitos `auth.login_failed`/`auth.login_blocked` do mesmo `ip` (com `TRUST_PROXY` correto,
veja `docs/ip-real-atras-de-proxy.md`) ou do mesmo `user_id`. O log não tem rotação própria: configure no Docker/orquestrador.

## Senha do Redis

O Redis guarda refresh tokens (só o hash), contadores de limite e cache. Por isso exige senha: no compose, `REDIS_PASSWORD`
é **obrigatória** (sem valor padrão; `make env` gera), o `redis-server` sobe com `--requirepass`, e a `REDIS_URL` padrão da API
já leva a senha (`redis://:SENHA@redis:6379/0`). Com Redis externo, informe a senha na `REDIS_URL` (e defina `REDIS_PASSWORD` com
qualquer valor: o compose exige a variável). Em `APP_ENV=production`, a API registra um aviso se a `REDIS_URL` não tiver senha.

**Como comprovar:**
```bash
docker compose exec redis sh -c 'redis-cli ping'                     # PONG  (o healthcheck usa REDISCLI_AUTH)
docker run --rm --network <pasta>_default redis:7-alpine redis-cli -h redis ping      # NOAUTH Authentication required.
docker run --rm --network <pasta>_default redis:7-alpine redis-cli -h redis -a errada ping   # WRONGPASS
```

**Trocar a senha** (procedimento executado e verificado). O Redis do compose não persiste dados (`--save ""`), então não há o que
migrar: trocar a senha **desloga todos** (todos fazem login de novo, o que já acontece a cada reinício do Redis).
```bash
NEW=$(openssl rand -hex 24)                                   # só letras e números (vai dentro da URL)
sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$NEW/" .env
docker compose up -d                                          # recria redis e api com a senha nova
docker compose ps                                             # todos "healthy"
```
Com Redis externo: troque no provedor e atualize a `REDIS_URL`.
