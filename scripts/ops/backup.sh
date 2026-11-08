#!/bin/sh
# Backup do Postgres do compose: pg_dump comprimido e CRIPTOGRAFADO (AES-256), com retenção.
#   BACKUP_PASSPHRASE=<frase longa> sh scripts/ops/backup.sh [pasta-destino] [dias-de-retenção]
# Padrões: pasta ./backups, 30 dias. Rode por cron/agendador e copie a pasta para FORA da máquina.
# Backup que nunca foi restaurado não vale: veja `make backup-verify` e docs/backup-e-restauracao.md.
set -eu
DEST="${1:-./backups}"
DAYS="${2:-30}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE (guarde-a em um cofre: sem ela o backup não abre)}"
[ "${#BACKUP_PASSPHRASE}" -ge 16 ] || { echo "BACKUP_PASSPHRASE precisa ter ao menos 16 caracteres" >&2; exit 1; }

mkdir -p "$DEST"
umask 077
OUT="$DEST/aurora-$(date -u +%Y%m%dT%H%M%SZ).sql.gz.enc"

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --clean --if-exists' \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"

[ -s "$OUT" ] || { echo "backup vazio, abortando" >&2; rm -f "$OUT"; exit 1; }
echo "backup criado: $OUT"

# retenção: apaga o que passou do prazo (alinhe com a política de privacidade: backups também são dados pessoais)
find "$DEST" -name 'aurora-*.sql.gz.enc' -type f -mtime "+$DAYS" -print -delete
