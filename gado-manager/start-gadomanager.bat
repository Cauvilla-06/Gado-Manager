@echo off
title GadoManager - Servidor + App + Tunel
color 0A

echo ============================================
echo      GadoManager - Inicializador Completo
echo ============================================
echo.

REM --- Ferramentas ---
set ANDROID_HOME=C:\Users\User\dev-tools\android-sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
set PROJECT=%~dp0
set APK=%PROJECT%flutter_app\build\app\outputs\flutter-apk\app-release.apk
set CLOUDFLARED=C:\Users\User\Desktop\cloudflared.exe

REM --- Verifica se o servidor ja esta rodando na porta 3000 ---
netstat -ano | findstr /c:"0.0.0.0:3000" | findstr LISTENING >nul
if %errorlevel%==0 (
    echo [SERVIDOR] Ja esta rodando na porta 3000. OK!
) else (
    echo [SERVIDOR] Iniciando Next.js em nova janela...
    start "GadoManager Servidor" cmd /c "cd /d "%PROJECT%" && npm run dev"
    echo Aguardando o servidor subir (10s)...
    timeout /t 10 /nobreak >nul
)
echo.

REM --- Encerra tuneis antigos ---
echo [TUNEL] Encerrando tuneis antigos...
taskkill /F /FI "WINDOWTITLE eq GadoManager Tunel*" >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq npx*" >nul 2>&1
timeout /t 2 /nobreak >nul

REM --- Verifica cloudflared ---
if not exist "%CLOUDFLARED%" (
    where cloudflared >nul 2>&1
    if %errorlevel%==0 (
        set CLOUDFLARED=cloudflared
    ) else (
        echo [TUNEL] cloudflared nao encontrado!
        echo         Instale com: winget install Cloudflare.cloudflared
        echo         Ou baixe de: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
        goto :skip_tunnel
    )
)

REM --- Inicia o tunnel ---
echo [TUNEL] Iniciando Cloudflare Tunnel para http://localhost:3000...
echo [TUNEL] A URL sera exibida nesta janela. Aguarde ~15 segundos.
echo.

REM --- Limpa log anterior do tunnel ---
set TUNNEL_LOG=%TEMP%\gadomanager-tunnel.log
del "%TUNNEL_LOG%" >nul 2>&1

REM --- Inicia tunnel com log para captura automatica da URL ---
REM     Redireciona stdout E stderr para o log
start "GadoManager Tunel" cmd /c "%CLOUDFLARED% tunnel --url http://localhost:3000 > "%TUNNEL_LOG%" 2>&1"
echo [TUNEL] Aguardando tunnel conectar (15s)...
timeout /t 15 /nobreak >nul

REM --- Captura URL do tunnel e envia ao servidor ---
if exist "%PROJECT%scripts\capture-tunnel-url.ps1" (
    echo [TUNEL] Capturando URL do tunnel automaticamente...
    start /B powershell -ExecutionPolicy Bypass -File "%PROJECT%scripts\capture-tunnel-url.ps1" >nul 2>&1
    echo [TUNEL] URL capturada sera enviada ao servidor em alguns segundos.
)

:skip_tunnel
echo.

REM --- Instrucoes para o Android ---
echo ============================================
echo   CONFIGURACAO DO APP ANDROID/FLUTTER
echo ============================================
echo.
echo   O app Flutter detecta a URL do servidor automaticamente!
echo   Basta fazer login com email e senha.
echo.
echo   Se a deteccao falhar, insira manualmente:
echo   - Emulador: http://10.0.2.2:3000
echo   - Celular na mesma rede: http://IP-DO-PC:3000
echo   - Tunnel: URL exibida acima
echo.
echo   Para app Kotlin (Android Studio):
echo   - Edite android/app/build.gradle.kts
echo   - Altere SERVER_URL para a URL do tunnel
echo ============================================
echo.

REM --- Instala/abre o app se houver celular via USB ---
adb devices 2>nul | findstr /i "device$" >nul
if %errorlevel%==0 (
    echo [CELULAR] Aparelho detectado via USB!
    if exist "%APK%" (
        echo Instalando APK...
        adb install -r "%APK%"
        adb shell monkey -p com.gadomanager.gado_manager -c android.intent.category.LAUNCHER 1 >nul 2>&1
        echo App instalado e aberto.
    ) else (
        echo AVISO: APK nao encontrado. Compile com: cd flutter_app && flutter build apk --release
    )
) else (
    echo [CELULAR] Nenhum aparelho USB detectado.
)
echo.
color 0A
echo ============================================
echo  Tudo pronto! Mantenha esta janela aberta.
echo  Para parar: feche as janelas do Servidor e Tunel.
echo ============================================
pause
