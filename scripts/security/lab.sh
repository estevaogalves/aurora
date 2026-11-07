#!/usr/bin/env sh
# Laboratório DESCARTÁVEL para os testes de segurança (SEC-02, SEC-04).
#
# *** USO SOMENTE LOCAL ***  Sobe Postgres, Redis, API e nginx numa rede Docker própria
# (aurora-lab), com banco vazio e segredo aleatório, e publica só em 127.0.0.1:18080.
# Não toca na stack do `docker compose` nem nos seus dados. `lab.sh down` apaga tudo.
#
# Uso:
#   scripts/security/lab.sh up [VAR=valor ...]   # VAR=valor vão para o ambiente da API
#   scripts/security/lab.sh down
#
# Variáveis do próprio laboratório: LAB_API_MEM (padrão 512m), LAB_PORT (padrão 18080).
# Exemplo: scripts/security/lab.sh up REGISTER_MAX_PER_IP=100000 TRUST_PROXY=true
set -eu
cd "$(dirname "$0")/../.."
export MSYS_NO_PATHCONV=1   # Git Bash no Windows: não reescrever caminhos dos containers

NET=aurora-lab
MEM=${LAB_API_MEM:-512m}
PORT=${LAB_PORT:-18080}

down() {
  for c in lab-web lab-api lab-redis lab-pg; do docker rm -f "$c" >/dev/null 2>&1 || true; done
  docker network rm "$NET" >/dev/null 2>&1 || true
}

case "${1:-}" in
  down)
    down
    echo "laboratório removido"
    ;;
  up)
    shift
    down
    docker build -q -t aurora-lab-api apps/api >/dev/null
    docker build -q -t aurora-lab-web -f apps/web/Dockerfile . >/dev/null
    docker network create "$NET" >/dev/null
    docker run -d --name lab-pg --network "$NET" -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab postgres:17 >/dev/null
    docker run -d --name lab-redis --network "$NET" redis:7-alpine redis-server --save "" >/dev/null
    sleep 6
    SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')
    EXTRA=""
    for kv in "$@"; do EXTRA="$EXTRA -e $kv"; done
    # TRUST_PROXY=true por padrão, como no compose (o nginx do laboratório é a única entrada)
    # shellcheck disable=SC2086
    docker run -d --name lab-api --network "$NET" --network-alias api --memory "$MEM" --memory-swap "$MEM" \
      -e DATABASE_URL="postgres://postgres:lab@lab-pg:5432/lab?sslmode=disable" -e REDIS_URL=redis://lab-redis:6379/0 \
      -e JWT_SECRET="$SECRET" -e APP_ENV=development -e COOKIE_SECURE=false -e TRUST_PROXY=true $EXTRA aurora-lab-api >/dev/null
    docker run -d --name lab-web --network "$NET" -p "127.0.0.1:$PORT:80" aurora-lab-web >/dev/null
    # 401 em /api/v1/me = nginx e API no ar
    for _ in $(seq 1 40); do
      [ "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/v1/me" || true)" = "401" ] && break
      sleep 1
    done
    echo "laboratório no ar: http://localhost:$PORT (API com $MEM de memória)"
    docker logs lab-api 2>&1 | grep -E "limite de hashing" | tail -1 || true
    ;;
  *)
    echo "uso: $0 up [VAR=valor ...] | down" >&2
    exit 2
    ;;
esac
