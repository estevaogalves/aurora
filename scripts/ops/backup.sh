#!/bin/sh
# Backup do banco SQLite do compose: cópia consistente (feita pela própria API, sem parar nada), comprimida e
# CRIPTOGRAFADA (AES-256), com retenção.
#   BACKUP_PASSPHRASE=<frase longa> sh scripts/ops/backup.sh [pasta-destino] [dias-de-retenção]
# Padrões: pasta ./backups, 30 dias. Copie a pasta para FORA da máquina (pendrive, nuvem).
# Backup que nunca foi restaurado não vale: veja `make backup-verify` e docs/backup-e-restauracao.md.
# (Além deste, o app tem Exportar/Importar backup no menu da conta.)
set -eu
DEST="${1:-./backups}"
DAYS="${2:-30}"
: "${BACKUP_PASSPHRASE:?defina BACKUP_PASSPHRASE (guarde-a em um cofre: sem ela o backup não abre)}"
[ "${#BACKUP_PASSPHRASE}" -ge 16 ] || { echo "BACKUP_PASSPHRASE precisa ter ao menos 16 caracteres" >&2; exit 1; }

mkdir -p "$DEST" ./data
umask 077
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/aurora-$STAMP.db.gz.enc"
TMP="aurora-tmp-$STAMP.db" # criado dentro de ./data (a API só escreve lá) e apagado em seguida

docker compose exec -T api api backup "/data/$TMP" >/dev/null
trap 'rm -f "./data/$TMP"' EXIT
gzip -9 < "./data/$TMP" | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT"

[ -s "$OUT" ] || { echo "backup vazio, abortando" >&2; rm -f "$OUT"; exit 1; }
echo "backup criado: $OUT"

# retenção: apaga o que passou do prazo (alinhe com a política de privacidade: backups também são dados pessoais)
find "$DEST" -name 'aurora-*.db.gz.enc' -type f -mtime "+$DAYS" -print -delete
