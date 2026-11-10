# Uso pessoal local (Windows + Docker Desktop)

Sobe o Aurora sob demanda. O banco é um arquivo SQLite, `data/aurora.db`, dentro da pasta do projeto; não há Postgres nem Redis
para instalar, e só `api` e `web` rodam no Docker.

## Primeira vez neste computador
1. Instale o [Docker Desktop](https://www.docker.com/products/docker-desktop).
2. Clone só esta versão: `git clone --branch local-sqlite --single-branch <url-do-repositorio>`.
3. Dê duplo clique em `scripts\criar-atalho.bat`. Ele põe na Área de Trabalho os atalhos **Aurora** e **Parar Aurora**.

## Dia a dia
- **Iniciar:** atalho **Aurora** (`scripts/aurora-iniciar.bat`). Abre o Docker Desktop se preciso, cria o `.env` e a pasta `data/` na primeira vez, sobe tudo e abre `http://localhost:8080`. A janela do terminal fica minimizada.
- **Parar:** atalho **Parar Aurora** (`scripts/aurora-parar.bat`). Os dados ficam em `data/aurora.db`.
- Nada sobe sozinho com o Windows: `docker-compose.personal.yml` define `restart: "no"`. Desative também, no Docker Desktop, *Settings > General > Start Docker Desktop when you sign in*.
- O que fica na memória e some ao parar: sessões (você faz login de novo) e o cache dos resumos. Os dados financeiros não.

## `.env`
Criado sozinho na primeira vez, com um `JWT_SECRET` aleatório (`APP_ENV=development`, `COOKIE_SECURE=false`). Acesse sempre por `http://localhost:8080`.

## Ver o banco
Qualquer cliente SQLite abre `data/aurora.db` (DBeaver, DB Browser for SQLite). Feche-o antes de ligar o Aurora, ou abra só para leitura.

## Backup (importante)
Os dados vivem só no arquivo `data/aurora.db` deste PC. Apagar a pasta do projeto ou `make clean` os apaga.
- **Fácil:** menu da conta > **Exportar** (e **Importar** em outro computador).
- **Criptografado:** no Git Bash, `BACKUP_PASSPHRASE='frase-longa-16+' make backup` e, de vez em quando, `make backup-verify`. Guarde cópia de `backups/` fora do PC. Detalhes em [`backup-e-restauracao.md`](backup-e-restauracao.md).
