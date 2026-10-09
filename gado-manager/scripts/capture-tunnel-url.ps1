# capture-tunnel-url.ps1
# Watches cloudflared output log and saves tunnel URL to .runtime-config/server-url.json.
# Called by start-server.bat / start-gadomanager.bat
#
# IMPORTANT: cloudflared can restart and append a NEW URL to the log.
# We must always use the LAST URL found, not the first.

param(
    [string]$LogFile = "$env:TEMP\cloudflared_output.log",
    [int]$MaxRetries = 30,
    [int]$PollSeconds = 2
)

$ErrorActionPreference = "SilentlyContinue"

function Get-LastTunnelUrl {
    param([string]$Content)
    # Find ALL matches and return the LAST one (most recent URL)
    $matches = [regex]::Matches($Content, 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com')
    if ($matches.Count -gt 0) {
        return $matches[$matches.Count - 1].Value
    }
    return $null
}

# Grava a URL direto no arquivo lido pelo servidor (.runtime-config/server-url.json).
# Nao existe mais POST na API para isso: so quem tem acesso ao disco do PC troca a URL.
function Save-Url {
    param([string]$Url)
    try {
        $configDir = Join-Path (Split-Path -Parent $PSScriptRoot) ".runtime-config"
        if (-not (Test-Path $configDir)) {
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
        }
        $configFile = Join-Path $configDir "server-url.json"
        # Encoding ascii para nao gerar BOM (BOM quebraria o JSON.parse do Next.js)
        @{ url = $Url; updatedAt = (Get-Date -Format o) } | ConvertTo-Json | Set-Content $configFile -Encoding ascii
        Write-Host "[OK] URL salva no arquivo: $Url"
        return $true
    } catch {
        Write-Host "[ERRO] Nao foi possivel salvar a URL."
        return $false
    }
}

# Wait for log file to exist
$retries = 0
while (-not (Test-Path $LogFile) -and $retries -lt $MaxRetries) {
    Start-Sleep -Seconds $PollSeconds
    $retries++
}

if (-not (Test-Path $LogFile)) {
    Write-Host "[ERRO] Log do tunnel nao encontrado: $LogFile"
    exit 1
}

# Poll the log file for the tunnel URL
$lastUrl = ""
$retries = 0
$found = $false

while ($retries -lt $MaxRetries) {
    Start-Sleep -Seconds $PollSeconds
    $retries++

    try {
        $logContent = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
        $url = Get-LastTunnelUrl -Content $logContent
        
        if ($url -and $url -ne $lastUrl) {
            $lastUrl = $url
            $found = $true

            Write-Host ""
            Write-Host "============================================"
            Write-Host "  URL do Tunnel: $url"
            Write-Host "============================================"
            Write-Host ""

            Save-Url -Url $url | Out-Null
        }
    } catch {
        # Log might be locked, retry
    }
}

if (-not $found) {
    Write-Host "[AVISO] URL do tunnel nao foi detectada em $MaxRetries tentativas."
    Write-Host "        Verifique se o cloudflared esta instalado e rodando."
    exit 1
}

# After initial capture, keep monitoring for URL changes
Write-Host ""
Write-Host "Monitorando mudancas de URL do tunnel..."
Write-Host ""

while ($true) {
    Start-Sleep -Seconds 15
    try {
        $logContent = Get-Content $LogFile -Raw -ErrorAction SilentlyContinue
        $newUrl = Get-LastTunnelUrl -Content $logContent
        
        if ($newUrl -and $newUrl -ne $lastUrl) {
            $lastUrl = $newUrl
            Write-Host ""
            Write-Host "[INFO] Tunnel mudou! Nova URL: $newUrl"
            Save-Url -Url $newUrl | Out-Null
        }
    } catch {
        # Log might be temporarily locked
    }
}
