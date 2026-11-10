#!/usr/bin/env bash
# Sobe o Aurora (API e web, com o banco SQLite em data/aurora.db) e abre no navegador. Equivalente Linux do aurora-iniciar.bat.
# Os dados ficam no arquivo data/aurora.db, dentro do projeto, e sobrevivem ao aurora-parar.sh.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

LOG="${XDG_STATE_HOME:-$HOME/.local/state}/aurora-iniciar.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') ==="

aviso() { notify-send -a Aurora "Aurora" "$1" 2>/dev/null || true; }
falha() { aviso "Falhou: $1 (log: $LOG)"; echo "ERRO: $1"; exit 1; }

command -v docker >/dev/null || falha "Docker não encontrado"
[ -f .env ] || { make env || falha "não consegui criar o .env"; }
# a pasta do banco: a API roda como uid 10001 no container e precisa conseguir gravar nela (máquina de um usuário só)
mkdir -p data && chmod 777 data

aviso "Iniciando o Aurora..."
# O dockerd sobe sob demanda (docker.socket); espera ele responder.
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || falha "o Docker não respondeu"

docker compose -f docker-compose.yml -f docker-compose.personal.yml up -d --build --wait \
  || falha "docker compose up"

set -a; . ./.env; set +a
xdg-open "http://localhost:${WEB_PORT:-8080}" >/dev/null 2>&1 || true
aviso "Aurora no ar: http://localhost:${WEB_PORT:-8080} (banco: data/aurora.db)"
