#!/usr/bin/env bash
# Para o Aurora. Os dados ficam em data/aurora.db. Equivalente Linux do aurora-parar.bat.
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."
docker compose -f docker-compose.yml -f docker-compose.personal.yml down
notify-send -a Aurora "Aurora" "Aurora parado. Os dados foram mantidos." 2>/dev/null || true
