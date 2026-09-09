@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title GadoManager Tunnel
echo ============================================
echo   GadoManager - Cloudflare Tunnel
echo ============================================
echo.

set "TEMPLOG=%TEMP%\cloudflared_output.log"
set "SCRIPT_DIR=%~dp0"
if exist "%TEMPLOG%" del "%TEMPLOG%"

echo Iniciando tunnel para http://localhost:3000 ...
echo.

:: Start cloudflared in background, capturing output
start "cloudflared" /min cmd /c "cloudflared tunnel --url http://localhost:3000 > "%TEMPLOG%" 2>&1"

:: Wait for URL to appear
echo Aguardando URL do tunnel (10s)...
timeout /t 10 /nobreak >nul

:: Extract URL using dedicated script (gets LAST URL, not first)
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%scripts\extract-tunnel-url.ps1" -LogFile "%TEMPLOG%"

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
endlocal
