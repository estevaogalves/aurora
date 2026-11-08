# Backup e restauração

O banco guarda dados financeiros pessoais; um backup que nunca foi restaurado não é backup.

## Fazer
```sh
BACKUP_PASSPHRASE='uma frase longa e única' make backup     # ou: sh scripts/ops/backup.sh ./backups 30
```
- `pg_dump` → gzip → AES-256 (openssl, PBKDF2 600 mil iterações). O arquivo vai para `./backups` (ignorado pelo git).
- Retenção: apaga arquivos com mais de 30 dias (2º argumento). **Alinhe esse prazo com a política de privacidade:** backups também contêm dados pessoais, e uma conta excluída (`DELETE /me`) continua nos backups até eles expirarem.
- Guarde a frase em um cofre de senhas, separada do backup. Sem ela o arquivo não abre.
- Agende (cron / Agendador de Tarefas) e copie a pasta para **fora da máquina** (outro disco, bucket com versionamento).
- O Redis não precisa de backup (sessões e contadores).

## Ensaiar a restauração (faça uma vez e depois periodicamente)
```sh
BACKUP_PASSPHRASE='...' make backup-verify
```
Restaura o último backup em um Postgres descartável e imprime a contagem de usuários. Anote o tempo que levou (RTO) e a idade do último backup (RPO).

## Restaurar de verdade
```sh
BACKUP_PASSPHRASE='...' sh scripts/ops/restore.sh backups/aurora-AAAAMMDDTHHMMSSZ.sql.gz.enc
```
Pede confirmação, porque **sobrescreve** o banco do compose. Para outro destino: passe a URL do Postgres como 2º argumento.

## Retenção dos logs de auditoria
Os eventos `msg="audit"` (hora, tipo, id do usuário e IP) vão para o stdout. O Docker só gira logs por tamanho; o prazo (proposta: 180 dias) deve ser configurado onde os logs são coletados (Loki, CloudWatch, etc.). *Prazo final: decisão jurídica.*
