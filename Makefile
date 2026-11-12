# Atalhos do Aurora. `make help` lista os comandos.
.DEFAULT_GOAL := help
.PHONY: help env install dev up down logs test test-web test-api lint typecheck build generate check layout clean backup backup-verify

GO_IMAGE  ?= golang:1.26-alpine

help: ## Lista os comandos
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

env: ## Cria o .env a partir do exemplo, com JWT_SECRET aleatório (não sobrescreve)
	@test -f .env && echo ".env já existe, nada a fazer" || { sed -e "s/^JWT_SECRET=.*/JWT_SECRET=$$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')/" .env.example > .env; echo ".env criado com um JWT_SECRET novo"; }

install: ## Instala as dependências do front
	pnpm install

dev: install env ## API no Docker + front em modo dev (http://localhost:5173)
	docker compose up -d --build api
	VITE_DATA_SOURCE=api pnpm dev

up: env ## Sobe tudo no Docker (web em http://localhost:8080)
	docker compose up --build -d

down: ## Para os containers (os dados do banco ficam)
	docker compose down

logs: ## Acompanha os logs da API
	docker compose logs -f api

test: test-web test-api ## Testes do front e da API

test-web: ## Testes do front (Vitest)
	pnpm test

# Go não precisa estar instalado: roda no Docker. Os testes de integração usam um arquivo SQLite temporário.
test-api: ## Testes da API (Go no Docker)
	docker run --rm -v "$(CURDIR)/apps/api":/src -w /src $(GO_IMAGE) sh -c "go vet ./... && go test ./..."

lint: ## ESLint do front
	pnpm lint

typecheck: ## tsc -b do front
	pnpm --filter web exec tsc -b

build: ## Build de produção do front
	pnpm build

generate: ## Regenera os tipos (openapi.yaml) e o código do sqlc
	pnpm --filter @aurora/api-types generate
	docker run --rm -v "$(CURDIR)/apps/api":/src -w /src sqlc/sqlc:1.31.1 generate

check: lint typecheck test-web build ## O que o CI roda no front
	pnpm --filter @aurora/api-types check

clean: ## Para tudo e apaga o banco (./data/aurora.db). Cuidado: perde os dados
	docker compose down
	rm -f data/aurora.db data/aurora.db-wal data/aurora.db-shm

backup: ## Backup criptografado do banco (BACKUP_PASSPHRASE=... make backup)
	@sh scripts/ops/backup.sh

# Abre o backup MAIS RECENTE num SQLite descartável e confere se os dados voltaram (ensaio de restauração).
backup-verify: ## Ensaia a restauração do último backup
	@f=$$(ls -1t backups/aurora-*.db.gz.enc 2>/dev/null | head -1); test -n "$$f" || { echo "nenhum backup em ./backups"; exit 1; }; \
	d=$$(mktemp -d); \
	openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$$f" | gunzip > "$$d/aurora.db" \
	  && docker run --rm -v "$$d":/d alpine:3.21 sh -c "apk add -q --no-cache sqlite >/dev/null && sqlite3 /d/aurora.db \"select 'usuarios: '||count(*) from users\"" \
	  && echo "restauração de $$f OK"; \
	rm -rf "$$d"

layout: ## Confere no Chrome o hero/cabeçalho e a rolagem horizontal em várias larguras (rodar depois de QUALQUER mudança no front)
	node scripts/layout-check.mjs
