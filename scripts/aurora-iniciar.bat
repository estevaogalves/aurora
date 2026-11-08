@echo off
rem Sobe o Aurora (Postgres, Redis, API e web) e abre no navegador.
rem Os dados ficam no volume Docker "pgdata" e sobrevivem ao aurora-parar.bat.
cd /d "%~dp0.."

docker info >nul 2>&1
if errorlevel 1 (
  echo Iniciando o Docker Desktop...
  start "" "%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
  :esperar_docker
  timeout /t 3 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto esperar_docker
)

echo Subindo o Aurora...
docker compose -f docker-compose.yml -f docker-compose.personal.yml up -d --build --wait
if errorlevel 1 (
  echo.
  echo Falha ao subir. Veja a mensagem acima.
  pause
  exit /b 1
)

start "" http://localhost:8080
echo Aurora no ar em http://localhost:8080 ^(DBeaver: localhost:5432^).
timeout /t 4 >nul
