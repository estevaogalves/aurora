# Uso pessoal local (Windows + Docker Desktop)

Sobe o Aurora sob demanda, com o Postgres em container e dados persistentes no volume `pgdata`.

## Dia a dia
- **Iniciar:** atalho "Aurora - Iniciar" (`scripts/aurora-iniciar.bat`). Abre o Docker Desktop se preciso, sobe tudo e abre `http://localhost:8080`.
- **Parar:** atalho "Aurora - Parar" (`scripts/aurora-parar.bat`). Os dados ficam preservados.
- Nada sobe sozinho com o Windows: `docker-compose.personal.yml` define `restart: "no"`. Desative também, no Docker Desktop, *Settings > General > Start Docker Desktop when you sign in*.

## DBeaver
Nova conexão PostgreSQL: host `localhost`, porta `5432`, banco `aurora`, usuário `aurora`, senha = `POSTGRES_PASSWORD` do `.env`. A porta só escuta em `127.0.0.1`. Se a 5432 estiver ocupada, defina `POSTGRES_PORT` no `.env`.

## `.env` necessário
`APP_ENV=development`, `COOKIE_SECURE=false`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` (`make env` gera). Acesse sempre por `http://localhost:8080`.

## Backup (importante)
Os dados vivem só no volume Docker deste PC. `docker compose down -v` ou resetar o Docker os apaga.
No Git Bash: `BACKUP_PASSPHRASE='frase-longa-16+' make backup` e, de vez em quando, `make backup-verify`. Guarde cópia dos arquivos de `backups/` fora do PC.
