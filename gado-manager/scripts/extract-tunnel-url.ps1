# extract-tunnel-url.ps1
# One-shot extraction of tunnel URL from cloudflared log.
# Usage (modo silencioso, para .bat): powershell -ExecutionPolicy Bypass -File extract-tunnel-url.ps1 -LogFile "log" -Quiet
# No modo -Quiet, imprime SOMENTE a URL (ou nada) no stdout, para o .bat capturar com for /f.
param(
    [string]$LogFile = "$env:TEMP\cloudflared_output.log",
    [switch]$Quiet
)

$ErrorActionPreference = "SilentlyContinue"

function Write-Msg {
    param([string]$m)
    if (-not $Quiet) { Write-Host $m }
}

if (-not (Test-Path $LogFile)) {
    Write-Msg "[ERRO] Log nao encontrado: $LogFile"
    exit 1
}

$log = Get-Content -Path $LogFile -Raw -ErrorAction SilentlyContinue
$m = [regex]::Matches($log, 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com')

if ($m.Count -eq 0) {
    Write-Msg "[AVISO] URL do tunnel nao foi detectada nos logs."
    Write-Msg "        Verifique se o cloudflared esta instalado corretamente."
    exit 1
}

# Pegar a ULTIMA URL (cloudflared pode reiniciar e gerar nova)
$url = $m[$m.Count - 1].Value

if (-not $Quiet) {
    Write-Host ""
    Write-Host "============================================"
    Write-Host "  URL do Tunnel: $url"
    Write-Host "============================================"
    Write-Host ""
}

# Salva a URL direto no arquivo lido pelo servidor (.runtime-config/server-url.json).
# Nao existe mais POST na API para isso: so quem tem acesso ao disco do PC troca a URL.
# Obs.: usa -Encoding ascii para nao gerar BOM, que quebraria o JSON.parse do Next.js
try {
    $configDir = Join-Path (Split-Path -Parent $PSScriptRoot) '.runtime-config'
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    $configFile = Join-Path $configDir 'server-url.json'
    @{ url = $url; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content $configFile -Encoding ascii
    Write-Msg "[OK] URL salva em $configFile"
} catch {
    Write-Msg "[AVISO] Nao foi possivel salvar a URL ($url)."
}

if ($Quiet) {
    # Saida limpa (apenas a URL) para o for /f do .bat
    [Console]::WriteLine($url)
}
exit 0
