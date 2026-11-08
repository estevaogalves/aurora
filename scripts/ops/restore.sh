#!/bin/sh
# Restaura um backup feito por backup.sh.
#   BACKUP_PASSPHRASE=... sh scripts/ops/restore.sh <arquivo.sql.gz.enc> [url-do-postgres-de-destino]
# Sem o 2º argumento restaura no Postgres do compose (SOBRESCREVE os dados atuais: pede confirmação).
# Para ensaiar a restauração sem risco, use um Postgres descartável: `make backup-verify`.
set -eu
FILE="${1:?informe o arquivo de backup}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"
decrypt() { openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | gunzip; }

if [ -n "${2:-}" ]; then
  decrypt | psql "$2" -v ON_ERROR_STOP=1 -q
else
  printf 'Isto SOBRESCREVE o banco do compose. Digite "restaurar" para continuar: '
  read -r ans
  [ "$ans" = "restaurar" ] || { echo "cancelado"; exit 1; }
  decrypt | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q'
fi
echo "restauração concluída"
