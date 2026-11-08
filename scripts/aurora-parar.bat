@echo off
rem Para o Aurora. Mantem os dados (volume pgdata); NAO usa -v.
cd /d "%~dp0.."
docker compose -f docker-compose.yml -f docker-compose.personal.yml down
echo Aurora parado. Os dados foram preservados.
timeout /t 3 >nul
