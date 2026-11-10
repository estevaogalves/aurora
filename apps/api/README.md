# Aurora API

Backend em Go: chi, sqlc, goose, SQLite (`modernc.org/sqlite`, sem CGO) e Redis embutido (miniredis). Tudo sob `/api/v1`.

> Esta é a branch `local-sqlite`: o banco é um arquivo (`DB_PATH`, padrão `/data/aurora.db`) e não há Postgres nem Redis externos. As seções de Postgres/Supabase de outros documentos valem para a `main`.

## Rodar

```bash
docker compose up --build        # na raiz: API e web (banco em ./data/aurora.db)
# web em http://localhost:8080 · API direta em http://127.0.0.1:8081
```

Sem Docker, com Go 1.26+ (`DB_PATH=./aurora.db JWT_SECRET=... go run ./cmd/api`):

```bash
export DB_PATH=./data/aurora.db      # o arquivo do banco (a pasta é criada)
export JWT_SECRET=$(openssl rand -hex 32)
export APP_ENV=development COOKIE_SECURE=false   # só em dev local, sem HTTPS
go run ./cmd/api          # aplica as migrations ao iniciar
```

| Variável | Padrão | Para quê |
|---|---|---|
| `DB_PATH` | `/data/aurora.db` | arquivo do banco SQLite |
| `JWT_SECRET` | (obrigatória, 32+ caracteres) | assinatura do token de acesso |
| `REDIS_URL` | vazio | Redis externo. Vazio = Redis embutido na API (memória) para refresh tokens, rate limit e cache |
| `API_ADDR` | `:8080` | endereço do servidor |
| `ACCESS_TTL` / `REFRESH_TTL` | `15m` / `720h` | validade dos tokens |
| `APP_ENV` | `production` | `production` ou `development`; em `production` a API não inicia com `COOKIE_SECURE=false` |
| `COOKIE_SECURE` | `true` | cookie de refresh só por HTTPS (`false` só com `APP_ENV=development`) |
| `CORS_ORIGINS` | `http://localhost:5173` | origens permitidas, separadas por vírgula |
| `LOGIN_MAX_ATTEMPTS` / `LOGIN_WINDOW` | `5` / `15m` | limite de logins com falha |
| `HASH_MAX_CONCURRENCY` | automático | hashes de senha (argon2id, 64 MiB cada) ao mesmo tempo; automático = 40% do limite de memória / 64 MiB, no máximo o nº de CPUs |
| `HASH_MAX_QUEUE` / `HASH_QUEUE_TIMEOUT` | `4×` a concorrência / `3s` | fila de espera por uma vaga de hash; fila cheia ou tempo esgotado => `503` + `Retry-After` |
| `REGISTRATION_ENABLED` | `true` | `false` fecha o cadastro: `POST /auth/register` responde `403` ("O cadastro está fechado no momento…"); o login não muda. Só `true`/`false` (outro valor impede a API de iniciar) |
| `REGISTER_MAX_PER_IP` / `REGISTER_WINDOW` | `5` / `1h` | cadastros por IP na janela; passou => `429` + `Retry-After` (a chave é o IP: veja `TRUST_PROXY`) |
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
go test ./...    # unitários e testes de integração (cada teste usa um arquivo SQLite temporário)
```

- Migrations: `internal/db/migrations` (goose, embutidas no binário e aplicadas ao iniciar).
- Queries: `internal/db/queries/*.sql`. Depois de mudar queries ou migrations, regenere com `sqlc generate` (saída em `internal/store/sqlcgen`, versionada).
- `internal/domain` é a versão em Go de `apps/web/src/domain` (mesmas regras e mesmos testes de conta).

## Banco: SQLite em arquivo

`DB_PATH` aponta para o arquivo (a pasta é criada se não existir; as migrations rodam ao iniciar). O driver abre o arquivo com
`journal_mode=WAL`, `foreign_keys=ON` (o `ON DELETE CASCADE` depende disso), `busy_timeout` e `_txlock=immediate`: toda
transação começa com `BEGIN IMMEDIATE`, então só uma escreve por vez, e isso faz o papel do `SELECT ... FOR UPDATE` do Postgres.

- Os ids são UUIDs gerados no Go; as colunas JSON são `TEXT` (tipos em `internal/sqlitetypes`, ligados pelo `sqlc.yaml`).
- **Atenção ao mexer em `internal/db/queries/*.sql`:** o sqlc para SQLite calcula posições em bytes, então comentários com acentos corrompem as queries seguintes. Escreva os comentários desses arquivos sem acento.
- Backup consistente com a API no ar: `docker compose exec api api backup /data/copia.db` (`VACUUM INTO`).
- Testes de integração usam um arquivo temporário por teste: `go test ./...`, sem nada para configurar.

## Redis embutido

Sem `REDIS_URL`, a API sobe um Redis dentro do próprio processo (miniredis, só em `127.0.0.1`) para refresh tokens, limites de requisição e o cache dos resumos. Tudo isso é descartável: some ao reiniciar a API (as pessoas fazem login de novo). Com `REDIS_URL`, usa esse Redis.

## Abrir e fechar o cadastro

`REGISTRATION_ENABLED` (padrão `true`) controla se novas pessoas podem se cadastrar. Para **fechar** (ex.: ambiente ainda não pronto para clientes,
ou um incidente em andamento):

```bash
# .env
REGISTRATION_ENABLED=false
docker compose up -d            # recria a API com o valor novo
```

- `POST /api/v1/auth/register` responde `403` com `{"error":"O cadastro está fechado no momento. Quem já tem conta pode entrar normalmente."}` (o app mostra essa frase na tela de cadastro).
- A decisão vem **antes** de ler o corpo, contar o limite por IP ou gastar um hash de senha: pedidos de cadastro fechado não custam nada.
- Login, renovação de sessão, logout e todo o uso da API por quem já tem conta continuam iguais. Contas existentes e `api admin promote` não são afetados.
- Para **reabrir**: apague a variável ou ponha `true` e rode `docker compose up -d`.
- Valores que não sejam `true`/`false` (por exemplo `nao`, `off`) impedem a API de iniciar com a mensagem `REGISTRATION_ENABLED="nao" inválido: use true ou false`: um erro de digitação nunca deixa o cadastro aberto sem ninguém perceber.
- **Como comprovar:** com `false`, `curl -i -X POST http://localhost:8080/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"a@b.com","name":"x","password":"senha-forte-123"}'` → `403`; com a variável ausente → `201`.
- Observação: a tela de cadastro do app continua visível e mostra a mensagem acima ao tentar; esconder a aba é uma melhoria de interface, não feita aqui.

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
- Sem Docker: `DB_PATH=./data/aurora.db go run ./cmd/api admin promote voce@dominio.com`.
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
