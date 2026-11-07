# Atalhos do Aurora. `make help` lista os comandos.
.DEFAULT_GOAL := help
.PHONY: help env install dev up down logs test test-web test-api lint typecheck build generate check clean

GO_IMAGE  ?= golang:1.26-alpine
PG_IMAGE  ?= postgres:17

help: ## Lista os comandos
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'

env: ## Cria o .env a partir do exemplo, com JWT_SECRET, POSTGRES_PASSWORD e REDIS_PASSWORD aleatórios (não sobrescreve)
	@test -f .env && echo ".env já existe, nada a fazer" || { sed -e "s/^JWT_SECRET=.*/JWT_SECRET=$$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')/" -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')/" -e "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))')/" .env.example > .env; echo ".env criado com JWT_SECRET, POSTGRES_PASSWORD e REDIS_PASSWORD novos"; }

install: ## Instala as dependências do front
	pnpm install

dev: install env ## Postgres, Redis e API no Docker + front em modo dev (http://localhost:5173)
	docker compose up -d --build postgres redis api
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

# Go não precisa estar instalado: roda no Docker, com um Postgres descartável para os testes de integração.
test-api: ## Testes da API (Go + Postgres no Docker)
	@docker rm -f aurora-test-pg >/dev/null 2>&1 || true
	@docker run -d --rm --name aurora-test-pg -e POSTGRES_PASSWORD=t -e POSTGRES_DB=t $(PG_IMAGE) >/dev/null
	@until docker exec aurora-test-pg pg_isready -U postgres -d t >/dev/null 2>&1; do sleep 1; done
	@IP=$$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' aurora-test-pg); \
	docker run --rm -v "$(CURDIR)/apps/api":/src -w /src \
	  -e TEST_DATABASE_URL="postgres://postgres:t@$$IP:5432/t?sslmode=disable" $(GO_IMAGE) \
	  sh -c "go vet ./... && go test ./..."; \
	status=$$?; docker rm -f aurora-test-pg >/dev/null 2>&1; exit $$status

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

clean: ## Para tudo e apaga o banco do Docker (cuidado: perde os dados)
	docker compose down -v
