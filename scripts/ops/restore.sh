#!/bin/sh
# Restaura um backup feito por backup.sh, no banco ./data/aurora.db.
#   BACKUP_PASSPHRASE=... sh scripts/ops/restore.sh <arquivo.db.gz.enc>
# SOBRESCREVE os dados atuais (pede confirmação). A API é parada durante a troca e religada no fim.
# Para ensaiar a restauração sem risco, use `make backup-verify`.
set -eu
FILE="${1:?informe o arquivo de backup}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE}"

printf 'Isto SOBRESCREVE ./data/aurora.db. Digite "restaurar" para continuar: '
read -r ans
[ "$ans" = "restaurar" ] || { echo "cancelado"; exit 1; }

mkdir -p ./data
TMP="./data/aurora-restore.tmp"
trap 'rm -f "$TMP"' EXIT
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in "$FILE" | gunzip > "$TMP"
[ "$(head -c 15 "$TMP")" = "SQLite format 3" ] || { echo "o arquivo não é um banco SQLite (senha errada?)" >&2; exit 1; }

docker compose stop api
# um banco novo no lugar do antigo; os arquivos -wal e -shm do antigo não valem para o novo
mv -f "$TMP" ./data/aurora.db
rm -f ./data/aurora.db-wal ./data/aurora.db-shm
docker compose start api
echo "restauração concluída"
