#!/usr/bin/env bash
# Sobe o Aurora (Postgres, Redis, API e web) e abre no navegador. Equivalente Linux do aurora-iniciar.bat.
# Uso: aurora-iniciar.sh [--dbeaver]   (--dbeaver abre também o DBeaver já conectado ao banco do Aurora)
# Os dados ficam no volume Docker "pgdata" e sobrevivem ao aurora-parar.sh.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

LOG="${XDG_STATE_HOME:-$HOME/.local/state}/aurora-iniciar.log"
mkdir -p "$(dirname "$LOG")"
exec >>"$LOG" 2>&1
echo "=== $(date '+%F %T') ==="

aviso() { notify-send -a Aurora "Aurora" "$1" 2>/dev/null || true; }
falha() { aviso "Falhou: $1 (log: $LOG)"; echo "ERRO: $1"; exit 1; }

command -v docker >/dev/null || falha "Docker não encontrado"
[ -f .env ] || { make env || falha "não consegui criar o .env"; echo "POSTGRES_PORT=5433" >> .env; }

aviso "Iniciando o Aurora..."
# O dockerd sobe sob demanda (docker.socket); espera ele responder.
for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 2; done
docker info >/dev/null 2>&1 || falha "o Docker não respondeu"

docker compose -f docker-compose.yml -f docker-compose.personal.yml up -d --build --wait \
  || falha "docker compose up"

set -a; . ./.env; set +a
if [ "${1:-}" = "--dbeaver" ]; then
  nohup dbeaver-ce -con "name=Aurora|driver=postgresql|host=localhost|port=${POSTGRES_PORT:-5432}|database=${POSTGRES_DB:-aurora}|user=${POSTGRES_USER:-aurora}|password=${POSTGRES_PASSWORD}|savePassword=false|connect=true|folder=Aurora" >/dev/null 2>&1 &
fi
xdg-open "http://localhost:${WEB_PORT:-8080}" >/dev/null 2>&1 || true
aviso "Aurora no ar: http://localhost:${WEB_PORT:-8080} (Postgres: localhost:${POSTGRES_PORT:-5432})"
