@echo off
rem Sobe o Aurora (API e web, com o banco SQLite em data\aurora.db) e abre no navegador.
rem Os dados ficam no arquivo data\aurora.db, dentro do projeto, e sobrevivem ao aurora-parar.bat.
cd /d "%~dp0.."

where docker >nul 2>&1
if errorlevel 1 (
  echo O Docker Desktop nao esta instalado. Instale em https://www.docker.com/products/docker-desktop e tente de novo.
  pause
  exit /b 1
)

rem primeira vez: pasta do banco e .env com segredo proprio (sem precisar de terminal, make ou openssl)
if not exist data mkdir data
if not exist .env (
  echo Primeira vez: criando a configuracao...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0criar-env.ps1"
  if errorlevel 1 (
    echo Falha ao criar o .env.
    pause
    exit /b 1
  )
)

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
echo Aurora no ar em http://localhost:8080 ^(banco: data\aurora.db^).
timeout /t 4 >nul
