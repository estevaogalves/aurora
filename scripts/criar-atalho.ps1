# Põe na Área de Trabalho os atalhos "Aurora" (liga tudo e abre o navegador) e "Parar Aurora".
# Duplo clique em scripts\criar-atalho.bat para rodar (só precisa fazer uma vez por computador).
$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell

function Novo-Atalho($nome, $alvo, $descricao) {
    $lnk = $shell.CreateShortcut((Join-Path $desktop "$nome.lnk"))
    $lnk.TargetPath = Join-Path $raiz "scripts\$alvo"
    $lnk.WorkingDirectory = $raiz
    $lnk.WindowStyle = 7 # janela minimizada: o terminal não fica na sua frente
    $lnk.Description = $descricao
    $lnk.IconLocation = "$env:SystemRoot\System32\shell32.dll,13"
    $lnk.Save()
    Write-Host "Atalho criado: $nome"
}

Novo-Atalho 'Aurora' 'aurora-iniciar.bat' 'Liga o Aurora e abre no navegador'
Novo-Atalho 'Parar Aurora' 'aurora-parar.bat' 'Desliga o Aurora (os dados ficam em data\aurora.db)'
