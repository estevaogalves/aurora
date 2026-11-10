# Cria o .env na raiz do projeto a partir do .env.example, com um JWT_SECRET aleatório. Não sobrescreve um .env existente.
# Chamado por aurora-iniciar.bat na primeira vez; não precisa de make, node nem openssl.
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$env_ = Join-Path $raiz '.env'
if (Test-Path $env_) { return }

$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$segredo = ([BitConverter]::ToString($bytes) -replace '-', '').ToLower()

$exemplo = [IO.File]::ReadAllText((Join-Path $raiz '.env.example'), [Text.Encoding]::UTF8)
$conteudo = $exemplo -replace '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$segredo"
# UTF-8 sem BOM: o docker compose lê o .env e um BOM estragaria o nome da primeira variável
[IO.File]::WriteAllText($env_, $conteudo, (New-Object Text.UTF8Encoding($false)))
Write-Host '.env criado com um JWT_SECRET novo.'
