@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul 2>&1
title GadoManager - Servidor

cd /d "%~dp0"

echo.
echo  ================================================
echo    GadoManager - Iniciar Servidor + Tunnel
echo  ================================================
echo.

REM ##################################################
REM  PASSO 1 - Node.js / npm
REM ##################################################

where node >nul 2>&1
if errorlevel 1 call :find_node_dir

where npm >nul 2>&1
if errorlevel 1 call :find_npm_dir

where node >nul 2>&1
if errorlevel 1 goto ERR_NODE
where npm >nul 2>&1
if errorlevel 1 goto ERR_NPM

for /f "tokens=1 delims=v." %%m in ('node -v') do set "NODE_MAJOR=%%m"
if defined NODE_MAJOR if !NODE_MAJOR! lss 20 (
    echo [AVISO] Node !NODE_MAJOR! detectado. Recomendado Node.js 20 ou superior.
)
echo [OK] Node.js e npm disponiveis.

REM ##################################################
REM  PASSO 2 - Dependencias (npm install so no 1o uso)
REM ##################################################

if exist "node_modules" goto DEPS_OK
echo.
echo Primeira execucao detectada - instalando dependencias...
echo Isso pode demorar alguns minutos. Nao feche esta janela.
echo.
call npm install --no-fund --no-audit
if errorlevel 1 goto ERR_NPM_INSTALL
echo.
echo [OK] Dependencias instaladas.

:DEPS_OK
echo.

REM ##################################################
REM  PASSO 3 - Libera a porta 3000 (server antigo)
REM ##################################################

echo Verificando a porta 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /c:":3000 " ^| findstr /c:"LISTENING" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
%SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul

REM ##################################################
REM  PASSO 4 - Inicia o servidor Next.js
REM ##################################################

echo.
echo [1/3] Iniciando servidor Next.js...
set "SERVER_LOG=!TEMP!\gado-server.log"
if exist "!SERVER_LOG!" del /q "!SERVER_LOG!" >nul 2>&1
start "GadoManager-Server" /min cmd /c "npm run dev > "!SERVER_LOG!" 2>&1"
echo   Log do servidor: !SERVER_LOG!

echo [2/3] Aguardando o servidor responder...
set "RETRY=0"

:WAIT_SERVER
%SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul
set "HTTP_CODE="
for /f "delims=" %%i in ('curl -s -o nul -w "%%{http_code}" http://localhost:3000/') do set "HTTP_CODE=%%i"
if not "!HTTP_CODE!"=="000" goto SERVER_READY
set /a RETRY+=1
if !RETRY! GEQ 30 (
    echo [ERRO] Servidor nao respondeu apos ~60s.
    echo.
    echo   Log do servidor: !SERVER_LOG!
    if exist "!SERVER_LOG!" (
        echo.
        type "!SERVER_LOG!"
    )
    echo.
    pause
    exit /b 1
)
echo   Aguardando... (!RETRY!/30^)
goto WAIT_SERVER

:SERVER_READY
echo [OK] Servidor pronto (HTTP !HTTP_CODE!).

REM ##################################################
REM  PASSO 5 - Detecta o cloudflared
REM ##################################################

set "USE_TUNNEL=0"
set "CLOUDFLARED_PATH="
call :find_cloudflared

if not "!USE_TUNNEL!"=="1" (
    echo.
    echo [3/3] cloudflared nao encontrado - sem link publico.
    echo        Instale com:  winget install Cloudflare.cloudflared
    echo        Abrindo o site local...
    start "" "http://localhost:3000"
    goto DONE
)

echo [OK] cloudflared: !CLOUDFLARED_PATH!

REM ##################################################
REM  PASSO 6 - Cloudflare Tunnel + link publico
REM ##################################################

echo.
echo [3/3] Iniciando Cloudflare Tunnel...

taskkill /F /FI "WINDOWTITLE eq GadoManager-Tunnel*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq GadoManager-Monitor*" >nul 2>&1
taskkill /F /IM cloudflared.exe >nul 2>&1
%SystemRoot%\System32\ping.exe -n 2 127.0.0.1 >nul

set "TUNNEL_LOG=%TEMP%\gado-tunnel.log"
if exist "!TUNNEL_LOG!" del /q "!TUNNEL_LOG!" >nul 2>&1

start "GadoManager-Tunnel" /min cmd /c ""!CLOUDFLARED_PATH!" tunnel --url http://localhost:3000 > "!TUNNEL_LOG!" 2>&1"

set "TUNNEL_URL="
set "RETRY=0"
echo   Aguardando URL publica (trycloudflare.com)...

:WAIT_TUNNEL
%SystemRoot%\System32\ping.exe -n 3 127.0.0.1 >nul
rem So casa com linhas que ja contem a URL real (https://...trycloudflare.com),
rem nao com a linha "Requesting new quick Tunnel" que sai antes da URL existir
findstr /i /r /c:"https://[a-zA-Z0-9-]*.trycloudflare.com" "!TUNNEL_LOG!" >nul 2>&1
if not errorlevel 1 goto TUNNEL_FOUND
set /a RETRY+=1
if !RETRY! GEQ 25 (
    echo   [AVISO] URL do tunnel nao detectada apos ~50s.
    goto TUNNEL_FAILED
)
goto WAIT_TUNNEL

:TUNNEL_FOUND
:: Extrai e salva a URL (o proprio script ja grava no servidor/arquivo)
for /f "delims=" %%u in ('powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\extract-tunnel-url.ps1" -LogFile "!TUNNEL_LOG!" -Quiet') do set "TUNNEL_URL=%%u"
if defined TUNNEL_URL goto TUNNEL_OK
rem URL ainda nao gravada no log; aguarda mais um ciclo
set /a RETRY+=1
if !RETRY! GEQ 25 (
    echo   [AVISO] Nao foi possivel obter a URL do tunnel apos ~50s.
    goto TUNNEL_FAILED
)
goto WAIT_TUNNEL

:TUNNEL_OK

:: Monitor: mantem a URL atualizada caso o tunnel gere um novo link
if exist "%~dp0scripts\capture-tunnel-url.ps1" (
    start "GadoManager-Monitor" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\capture-tunnel-url.ps1" -LogFile "!TUNNEL_LOG!"
    echo   [OK] Monitor de URL iniciado.
)

echo.
echo  ================================================
echo   Link publico do site (tunnel):
echo.
echo     !TUNNEL_URL!
echo.
echo  ================================================
echo.
echo   Abrindo o navegador no link publico...
start "" "!TUNNEL_URL!"
goto DONE

:TUNNEL_FAILED
echo.
echo   [AVISO] Tunnel indisponivel. Abrindo o site local...
start "" "http://localhost:3000"
goto DONE

:DONE
echo.
echo  ================================================
echo   Tudo pronto!
echo.
echo   Local:    http://localhost:3000
echo   Log:      !SERVER_LOG!
if defined TUNNEL_URL echo   Publico:  !TUNNEL_URL!
echo.
echo   O servidor e o tunnel rodam em janelas separadas.
echo   Para encerrar, feche as janelas "GadoManager-Server"
echo   e "GadoManager-Tunnel".
echo.
echo   No app Flutter, toque em "Reconectar ao servidor"
echo   para usar o link mais recente automaticamente.
echo  ================================================
echo.
pause
exit /b 0

REM ##################################################
REM  Sub-rotinas / erros
REM ##################################################

:ERR_NODE
echo.
echo [ERRO] Node.js nao foi encontrado no PATH.
echo.
echo Instale o Node.js LTS em:  https://nodejs.org
echo ou pelo comando:           winget install OpenJS.NodeJS.LTS
echo.
echo Depois de instalar, feche e reabra este arquivo.
pause
exit /b 1

:ERR_NPM
echo.
echo [ERRO] npm nao foi encontrado, mesmo com o Node.js instalado.
echo.
echo Reinstale o Node.js em https://nodejs.org ou verifique se a
echo pasta do Node esta no PATH do sistema.
pause
exit /b 1

:ERR_NPM_INSTALL
echo.
echo [ERRO] Falha ao instalar as dependencias (npm install).
echo.
echo - Verifique sua conexao com a internet.
echo - Confirme que esta usando Node.js 20 ou superior.
echo - Se o erro persistir, apague a pasta node_modules e rode:
echo     npm install
echo.
pause
exit /b 1

:find_node_dir
if defined NODE_DIR exit /b 0
for %%p in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs" "%LocalAppData%\Programs\nodejs" "%APPDATA%\nvm\current") do (
    if exist "%%~p\node.exe" if not defined NODE_DIR set "NODE_DIR=%%~p"
)
if defined NODE_DIR set "PATH=!NODE_DIR!;!PATH!"
exit /b 0

:find_npm_dir
if defined NPM_DIR exit /b 0
for %%p in ("%ProgramFiles%\nodejs" "%ProgramFiles(x86)%\nodejs" "%LocalAppData%\Programs\nodejs" "%APPDATA%\nvm\current") do (
    if exist "%%~p\npm.cmd" if not defined NPM_DIR set "NPM_DIR=%%~p"
)
if defined NPM_DIR set "PATH=!NPM_DIR!;!PATH!"
exit /b 0

:find_cloudflared
where cloudflared >nul 2>&1
if not errorlevel 1 (
    for /f "delims=" %%i in ('where cloudflared') do (
        if not defined CLOUDFLARED_PATH set "CLOUDFLARED_PATH=%%i"
    )
    set "USE_TUNNEL=1"
    exit /b 0
)
for %%p in ("%USERPROFILE%\Desktop\cloudflared.exe" "%LOCALAPPDATA%\cloudflared\cloudflared.exe" "%ProgramFiles%\cloudflared\cloudflared.exe") do (
    if exist "%%~p" if not defined CLOUDFLARED_PATH set "CLOUDFLARED_PATH=%%~p"
)
if defined CLOUDFLARED_PATH set "USE_TUNNEL=1"
exit /b 0
