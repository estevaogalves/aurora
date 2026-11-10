@echo off
rem Para o Aurora. Mantem os dados (arquivo data\aurora.db); nao apaga nada.
cd /d "%~dp0.."
docker compose -f docker-compose.yml -f docker-compose.personal.yml down
echo Aurora parado. Os dados foram preservados em data\aurora.db.
timeout /t 3 >nul
