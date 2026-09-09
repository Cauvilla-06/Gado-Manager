@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
title GadoManager - Servidor + App + Tunel
color 0A

echo ============================================
echo      GadoManager - Inicializador Completo
echo ============================================
echo.

REM --- Ferramentas ---
set "ANDROID_HOME=C:\Users\User\dev-tools\android-sdk"
set PATH=%PATH%;%ANDROID_HOME%\platform-tools
set "PROJECT=%~dp0"
set "APK=%PROJECT%flutter_app\build\app\outputs\flutter-apk\app-release.apk"

REM --- Verifica cloudflared ---
set "CLOUDFLARED_PATH="
set "USE_TUNNEL=0"

if exist "C:\Users\User\Desktop\cloudflared.exe" (
    set "CLOUDFLARED_PATH=C:\Users\User\Desktop\cloudflared.exe"
    set "USE_TUNNEL=1"
) else if exist "%LOCALAPPDATA%\cloudflared\cloudflared.exe" (
    set "CLOUDFLARED_PATH=%LOCALAPPDATA%\cloudflared\cloudflared.exe"
    set "USE_TUNNEL=1"
) else (
    where cloudflared >nul 2>&1
    if !errorlevel! equ 0 (
        set "USE_TUNNEL=1"
        for /f "delims=" %%i in ('where cloudflared') do set "CLOUDFLARED_PATH=%%i"
    ) else (
        echo [TUNEL] cloudflared nao encontrado!
        echo         Instale: winget install Cloudflare.cloudflared
        echo.
    )
)

REM --- Node.js / npm / dependencias ---
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERRO] npm nao encontrado. Reinstale o Node.js em https://nodejs.org
    pause
    exit /b 1
)
if not exist "!PROJECT!node_modules" (
    echo [SERVIDOR] Primeira execucao - instalando dependencias...
    cd /d "!PROJECT!"
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        echo [ERRO] Falha no npm install. Verifique a internet e tente novamente.
        pause
        exit /b 1
    )
    echo [SERVIDOR] Dependencias instaladas.
)

REM --- Verifica se o servidor ja esta rodando na porta 3000 ---
echo [SERVIDOR] Verificando porta 3000...
netstat -ano | findstr /c:"0.0.0.0:3000" | findstr LISTENING >nul 2>&1
if !errorlevel! equ 0 (
    echo [SERVIDOR] Ja esta rodando na porta 3000. OK!
) else (
    echo [SERVIDOR] Iniciando Next.js em nova janela...
    cd /d "!PROJECT!"
    set "SERVER_LOG=!TEMP!\gado-server.log"
    if exist "!SERVER_LOG!" del /q "!SERVER_LOG!" >nul 2>&1
    start "GadoManager-Server" /min cmd /c "npm run dev > "!SERVER_LOG!" 2>&1"
    echo   Log do servidor: !SERVER_LOG!
    echo Aguardando o servidor subir...

    set "RETRY=0"
    :WAIT_GM_SERVER
    %SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul
    set "HTTP_CODE="
    for /f %%i in ('curl -s -o nul -w "%%{http_code}" http://localhost:3000/') do set "HTTP_CODE=%%i"
    if "!HTTP_CODE!"=="000" (
        set /a RETRY+=1
        if !RETRY! GEQ 15 (
            echo [ERRO] Servidor nao respondeu em 30 segundos.
            echo   Log do servidor: !SERVER_LOG!
            if exist "!SERVER_LOG!" (
                echo.
                type "!SERVER_LOG!"
            )
            pause
            exit /b 1
        )
        echo   Aguardando... (!RETRY!/15^)
        goto WAIT_GM_SERVER
    )
    echo   Servidor pronto!
)
echo.

REM --- Encerra tuneis antigos ---
echo [TUNEL] Encerrando tuneis antigos...
taskkill /F /FI "WINDOWTITLE eq GadoManager-Tunnel*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq GadoManager-Monitor*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq cloudflared*" >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
%SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul

REM --- Inicia o tunnel ---
if "!USE_TUNNEL!"=="1" (
    echo [TUNEL] Iniciando Cloudflare Tunnel...

    :: Limpa log anterior
    set "TUNNEL_LOG=%TEMP%\gadomanager-tunnel.log"
    if exist "!TUNNEL_LOG!" del "!TUNNEL_LOG!"

    :: Inicia tunnel com log
    start "GadoManager-Tunnel" /min cmd /c ""!CLOUDFLARED_PATH!" tunnel --url http://localhost:3000 > "!TUNNEL_LOG!" 2>&1"
    echo [TUNEL] Aguardando tunnel conectar...

    set "RETRY=0"
    set "TUNNEL_URL="

    :WAIT_GM_TUNNEL
    %SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul

    if exist "!TUNNEL_LOG!" (
        rem So casa quando a URL real ja saiu no log (nao na linha do pedido)
        findstr /i /r /c:"https://[a-zA-Z0-9-]*.trycloudflare.com" "!TUNNEL_LOG!" >nul 2>&1
        if !errorlevel! equ 0 (
            goto GM_TUNNEL_FOUND
        )
    )

    set /a RETRY+=1
    if !RETRY! GEQ 15 (
        echo [TUNEL] [AVISO] URL nao detectada em 30 segundos.
        goto GM_SKIP_TUNNEL
    )
    goto WAIT_GM_TUNNEL

    :GM_TUNNEL_FOUND
    :: Captura URL via script PowerShell dedicado
    for /f "delims=" %%u in ('powershell -NoProfile -ExecutionPolicy Bypass -File "!PROJECT!scripts\extract-tunnel-url.ps1" -LogFile "!TUNNEL_LOG!" -Quiet') do (
        set "TUNNEL_URL=%%u"
    )

    if defined TUNNEL_URL (
        echo.
        echo   ========================================
        echo   URL do Tunnel: !TUNNEL_URL!
        echo   ========================================
        echo.

        :: Salva via API
        set "BODY_FILE=%TEMP%\gado-body.json"
        >"!BODY_FILE!" echo {"url":"!TUNNEL_URL!"}
        curl -s -X POST http://localhost:3000/api/config/server-url -H "Content-Type: application/json" -d @"!BODY_FILE!" >nul 2>&1

        if !errorlevel! equ 0 (
            echo [TUNEL] [OK] URL salva no servidor!
        ) else (
            echo [TUNEL] Salvando direto no arquivo...
            if not exist "!PROJECT!.runtime-config" mkdir "!PROJECT!.runtime-config"
            >"!PROJECT!.runtime-config\server-url.json" echo {"url":"!TUNNEL_URL!","updatedAt":"%date%T%time%"}
            echo [TUNEL] [OK] URL salva no arquivo.
        )

        if exist "!BODY_FILE!" del "!BODY_FILE!"

        :: Inicia monitor
        if exist "!PROJECT!scripts\capture-tunnel-url.ps1" (
            start "GadoManager-Monitor" /min powershell -ExecutionPolicy Bypass -File "!PROJECT!scripts\capture-tunnel-url.ps1" -LogFile "!TUNNEL_LOG!"
            echo [TUNEL] [OK] Monitor de mudanca de URL iniciado.
        )
    ) else (
        echo [TUNEL] [AVISO] Nao foi possivel extrair a URL.
    )
) else (
    echo [TUNEL] cloudflared nao encontrado. Tunnel indisponivel.
)

:GM_SKIP_TUNNEL
echo.

REM --- Instrucoes ---
echo ============================================
echo   CONFIGURACAO DO APP ANDROID/FLUTTER
echo ============================================
echo.
echo   O app Flutter detecta a URL do servidor automaticamente!
echo   Basta fazer login com email e senha.
echo.
if defined TUNNEL_URL (
echo   URL do Tunnel: !TUNNEL_URL!
echo.
)
echo   Se a deteccao falhar, insira manualmente:
echo   - Emulador: http://10.0.2.2:3000
echo   - Celular na mesma rede: http://IP-DO-PC:3000
echo   - Tunnel: URL exibida acima
echo ============================================
echo.

REM --- Instala/abre o app se houver celular via USB ---
adb devices 2>nul | findstr /i "device$" >nul 2>&1
if !errorlevel! equ 0 (
    echo [CELULAR] Aparelho detectado via USB!
    if exist "!APK!" (
        echo Instalando APK...
        adb install -r "!APK!"
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
endlocal
