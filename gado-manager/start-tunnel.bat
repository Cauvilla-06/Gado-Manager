@echo off
title GadoManager Tunnel
color 0B
echo ============================================
echo   GadoManager - Cloudflare Tunnel
echo ============================================
echo.

set "TEMPLOG=%TEMP%\cloudflared_output.log"
if exist "%TEMPLOG%" del "%TEMPLOG%"

echo Iniciando tunnel para http://localhost:3000 ...
echo.

:: Start cloudflared in background, capturing output
start "cloudflared" /b cloudflared tunnel --url http://localhost:3000 >"%TEMPLOG%" 2>&1

:: Wait for URL to appear
echo Aguardando URL do tunnel (8s)...
timeout /t 8 /nobreak >nul

:: Extract URL and POST to server using PowerShell
powershell -NoProfile -Command ^
 "$log = Get-Content '%TEMPLOG%' -ErrorAction SilentlyContinue;" ^
 "$match = $log | Select-String -Pattern 'https://[a-zA-Z0-9\-]+\.trycloudflare\.com' | Select-Object -First 1;" ^
 "if ($match) {" ^
 "  $url = $match.Matches.Value;" ^
 "  Write-Host '';" ^
 "  Write-Host '============================================';" ^
 "  Write-Host ('  URL do Tunnel: ' + $url);" ^
 "  Write-Host '============================================';" ^
 "  Write-Host '';" ^
 "  try {" ^
 "    $body = '{\"url\": \"' + $url + '\"}';" ^
 "    Invoke-RestMethod -Uri 'http://localhost:3000/api/config/server-url' -Method Post -ContentType 'application/json' -Body $body;" ^
 "    Write-Host '[OK] URL salva no servidor! O app pode descobrir via lupa.';" ^
 "  } catch {" ^
 "    Write-Host '[AVISO] Nao foi possivel salvar no servidor.';" ^
 "    Write-Host '        Certifique-se que o Next.js esta rodando em http://localhost:3000';" ^
 "  }" ^
 "} else {" ^
 "  Write-Host '[AVISO] URL do tunnel nao foi detectada nos logs.';" ^
 "  Write-Host '        Verifique se o cloudflared esta instalado corretamente.';" ^
 "}" ^
 "Write-Host '';"

echo.
echo ============================================
echo   Tunnel ativo. Mantenha esta janela aberta.
echo   Pressione Ctrl+C para encerrar.
echo ============================================
echo.

:: Keep alive — monitor cloudflared process
:loop
timeout /t 30 /nobreak >nul
tasklist /fi "imagename eq cloudflared.exe" 2>nul | find /i "cloudflared.exe" >nul 2>&1
if %errorlevel% equ 0 goto loop

echo.
echo [INFO] Tunnel encerrado.
if exist "%TEMPLOG%" del "%TEMPLOG%"
pause
