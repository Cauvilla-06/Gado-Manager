@echo off
title GadoManager Tunnel
color 0B
echo ============================================
echo   GadoManager - Cloudflare Tunnel
echo ============================================
echo.
echo URL: Sera exibida abaixo apos conectar...
echo Copie a URL e use no app Flutter/Kotlin.
echo.
"C:\Users\User\Desktop\cloudflared.exe" tunnel --url http://localhost:3000
pause
