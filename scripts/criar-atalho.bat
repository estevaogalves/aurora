@echo off
rem Cria os atalhos "Aurora" e "Parar Aurora" na Area de Trabalho. Rode uma vez por computador.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0criar-atalho.ps1"
if errorlevel 1 (
  echo.
  echo Nao foi possivel criar os atalhos. Veja a mensagem acima.
  pause
  exit /b 1
)
echo.
echo Pronto. Use o atalho "Aurora" na Area de Trabalho para ligar o projeto.
timeout /t 5 >nul
