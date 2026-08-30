# capture-tunnel-url.ps1
# Monitors cloudflare tunnel log and posts the URL to the server API.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/capture-tunnel-url.ps1

$logFile = "$env:TEMP\gadomanager-tunnel.log"
$serverUrl = "http://localhost:3000"
$maxWaitSeconds = 180
$checkIntervalSeconds = 3

Write-Host "[URL Capturer] Starting..." -ForegroundColor Cyan
Write-Host "[URL Capturer] Log file: $logFile" -ForegroundColor Cyan

$elapsed = 0
while ($elapsed -lt $maxWaitSeconds) {
    if (Test-Path $logFile) {
        $content = ""
        try {
            $content = Get-Content $logFile -Raw -ErrorAction Stop
        } catch {
            # File might be locked by cloudflared, skip this iteration
            Start-Sleep -Seconds $checkIntervalSeconds
            $elapsed += $checkIntervalSeconds
            continue
        }

        if ($content -and $content.Length -gt 10) {
            # Strategy 1: Look for trycloudflare.com URL
            $match = [regex]::Match($content, 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com[^\s]*')
            if (-not $match.Success) {
                # Strategy 2: Look for any https URL with tunnel-like pattern
                $match = [regex]::Match($content, 'https://[a-zA-Z0-9\-\.]+\.(trycloudflare|cloudflareaccess)\.com[^\s]*')
            }
            if (-not $match.Success) {
                # Strategy 3: Look for any https URL after "visit" or "created"
                $match = [regex]::Match($content, '(?i)(?:visit|created|available)[^a-zA-Z]*(https://[^\s]+)')
                if ($match.Success -and $match.Groups.Count -gt 1) {
                    $match = $match.Groups[1]
                }
            }

            if ($match.Success) {
                $tunnelUrl = $match.Value.TrimEnd('/', ' ', '"', "'")
                Write-Host "[URL Capturer] Found tunnel URL: $tunnelUrl" -ForegroundColor Green

                # Try to POST to the server (retry up to 3 times)
                $posted = $false
                for ($retry = 1; $retry -le 3; $retry++) {
                    try {
                        $body = @{ url = $tunnelUrl } | ConvertTo-Json
                        Invoke-RestMethod -Uri "$serverUrl/api/config/server-url" `
                            -Method POST -Body $body -ContentType "application/json" `
                            -TimeoutSec 5 -UseBasicParsing
                        Write-Host "[URL Capturer] Server updated successfully!" -ForegroundColor Green
                        $posted = $true
                        break
                    }
                    catch {
                        Write-Host "[URL Capturer] POST attempt $retry failed: $($_.Exception.Message)" -ForegroundColor Yellow
                        Start-Sleep -Seconds 2
                    }
                }

                if ($posted) {
                    exit 0
                } else {
                    Write-Host "[URL Capturer] Could not POST to server after 3 attempts." -ForegroundColor Red
                    Write-Host "[URL Capturer] URL is: $tunnelUrl" -ForegroundColor Yellow
                    Write-Host "[URL Capturer] Paste this URL in the Flutter app manually." -ForegroundColor Yellow
                    exit 1
                }
            }
        }
    }

    Start-Sleep -Seconds $checkIntervalSeconds
    $elapsed += $checkIntervalSeconds
}

Write-Host "[URL Capturer] Timed out after $maxWaitSeconds seconds." -ForegroundColor Red
Write-Host "[URL Capturer] Copy the URL from the tunnel window and paste in the app." -ForegroundColor Yellow
exit 1
