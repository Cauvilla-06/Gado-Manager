@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l=[IO.File]::ReadAllLines('%~f0',[Text.Encoding]::UTF8);$i=[Array]::IndexOf($l,'#PS_START');iex (($l[($i+1)..($l.Count-1)] -join [Environment]::NewLine))"
exit /b %errorlevel%
#PS_START
# =============================================================================
#  GadoManager - Bot de Exclusao de Bois (RAPIDO - batch)
#  Arquivo: gado-manager/bot-exclusao-bois.bat
#
#  Fluxo:
#   1. Confere se o servidor (localhost:3000) esta no ar (start-server.bat)
#   2. Pede email e senha, faz login e mostra o NOME do usuario
#   3. Pede confirmacao: "Voce mesmo?" (S/N)
#   4. Pergunta: excluir 1 ou + bois (por numero/identificador, com zeros)
#   5. Busca os IDs uma vez e exclui TODOS em UM UNICO request
#      (DELETE /api/animals com { ids: [...] })
#
#  Os numeros sao mantidos COMO TEXTO (ex: "003" continua "003").
# =============================================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = 'GadoManager - Bot de Exclusao de Bois' } catch {}
$server = 'http://localhost:3000'

Write-Host ''
Write-Host ' ================================================='
Write-Host '   GadoManager - Bot de Exclusao de Bois'
Write-Host "   Servidor: $server"
Write-Host ' ================================================='
Write-Host ''

# ------------------------------------------------------------------
# PASSO 1 - Verificar servidor
# ------------------------------------------------------------------
while ($true) {
    try {
        $h = Invoke-WebRequest -UseBasicParsing -Uri "$server/api/health" -TimeoutSec 5
        if ($h.StatusCode -eq 200) { Write-Host ' [OK] Servidor acessivel.'; break }
    } catch { }
    Write-Host " [ERRO] Nao foi possivel conectar ao servidor em $server"
    Write-Host '        Rode antes o "start-server.bat" nesta pasta'
    Write-Host '        e aguarde a mensagem "Tudo pronto!".'
    Write-Host ''
    $r = Read-Host ' Tentar conectar de novo? (S/N)'
    if ($r -notmatch '^[sS]') { Write-Host ' Encerrando o bot.'; Read-Host ' Pressione ENTER para sair'; exit 1 }
}
Write-Host ''

# ------------------------------------------------------------------
# PASSO 2 - Login (email + senha)
# ------------------------------------------------------------------
$token = $null; $userName = $null
while ($true) {
    Write-Host ' ---------------- Login ----------------'
    $email = (Read-Host ' Digite seu email').Trim()
    $sec   = Read-Host ' Digite sua senha' -AsSecureString
    $pass  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
    Write-Host ''
    if (-not $email -or -not $pass) { Write-Host ' [ERRO] Preencha email e senha.'; Write-Host ''; continue }

    $body = @{ email = $email; password = $pass } | ConvertTo-Json
    $resp = $null; $code = 0
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Method Post `
            -Uri "$server/api/auth/login" `
            -ContentType 'application/json; charset=utf-8' -Body $body
    } catch {
        if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    }
    if ($resp) {
        $j = $resp.Content | ConvertFrom-Json
        if ($j.token -and $j.user.name) {
            $token = $j.token; $userName = $j.user.name
            Write-Host ''
            Write-Host ' ==============================================='
            Write-Host '   Login realizado com sucesso!'
            Write-Host "   Usuario: $userName"
            Write-Host ' ==============================================='
            Write-Host ''
            break
        }
    }
    Write-Host " [ERRO] Login falhou (HTTP $code). Verifique email e senha."
    Write-Host ''
    $r = Read-Host ' Tentar login novamente? (S/N)'
    if ($r -notmatch '^[sS]') { Write-Host ' Encerrando o bot.'; Read-Host ' Pressione ENTER para sair'; exit 1 }
    Write-Host ''
}

# ------------------------------------------------------------------
# PASSO 3 - Confirmar usuario
# ------------------------------------------------------------------
$r = Read-Host ' Voce e mesmo este usuario? Posso operar nesta conta? (S/N)'
if ($r -notmatch '^[sS]') {
    Write-Host ''
    Write-Host ' Ok. Nada foi excluido. Encerrando por seguranca.'
    Read-Host ' Pressione ENTER para sair'
    exit 0
}
Write-Host ''

# ------------------------------------------------------------------
# PASSO 4 - Quantidade: 1 ou + bois
# ------------------------------------------------------------------
function Ask-SimNao($msg) {
    while ($true) {
        $v = Read-Host "$msg (S / N)"
        $v = $v.Trim().ToUpper()
        if ($v -eq 'S') { return $true }
        if ($v -eq 'N') { return $false }
        Write-Host ' [ERRO] Digite S ou N.'; Write-Host ''
    }
}

function Read-IdentificadorTexto($msg) {
    # Aceita: 1, 01, 003, ABC123, etc. Mantem o texto exato (zeros preservados).
    while ($true) {
        $v = (Read-Host "$msg").Trim()
        if ($v -eq '') { Write-Host ' [ERRO] O identificador nao pode ser vazio.'; Write-Host ''; continue }
        if ($v -notmatch '^[0-9A-Za-z]+$') {
            Write-Host ' [ERRO] Digite apenas letras e/ou numeros (sem espacos).'; Write-Host ''
            continue
        }
        return $v
    }
}

Write-Host ' Quantos bois voce quer excluir?'
Write-Host ''
Write-Host '  [1] Excluir 1 boi (informar o numero/identificador)'
Write-Host '  [2] Excluir mais de 1 boi (informar numero inicial e final)'
Write-Host ''
while ($true) {
    $q = (Read-Host ' Escolha (1 ou 2)').Trim()
    if ($q -eq '1' -or $q -eq '2') { break }
    Write-Host ' [ERRO] Digite 1 ou 2.'; Write-Host ''
}

$oneByOne = ($q -eq '1')
$excluirNumeros = @()  # lista de identificadores a excluir

if ($oneByOne) {
    Write-Host ''
    $excluirNumeros += Read-IdentificadorTexto ' Numero/identificador do boi a excluir:'
} else {
    Write-Host ''
    Write-Host ' Informe a faixa pelo numero/identificador TEXTUAL.'
    Write-Host '   Ex: se os bois sao 003, 004, 005, digite 003 e 005.'
    Write-Host '   Os zeros iniciais sao mantidos (003 nao vira 3).'
    Write-Host ''

    $inicioTexto = Read-IdentificadorTexto ' Numero inicial:'
    while ($true) {
        $fimTexto = Read-IdentificadorTexto ' Numero final:'
        $iniNum = $null; $fimNum = $null
        if ($inicioTexto -match '^[0-9]+$' -and $fimTexto -match '^[0-9]+$') {
            $iniNum = [int]$inicioTexto
            $fimNum = [int]$fimTexto
            if ($fimNum -ge $iniNum) { break }
            Write-Host " [ERRO] O numero final deve ser maior ou igual ao inicial ($fimNum < $iniNum)." -ForegroundColor Yellow
            Write-Host ''
        } else {
            if ([string]::Compare($inicioTexto, $fimTexto, $false) -le 0) { break }
            Write-Host " [ERRO] A string final deve ser >= a inicial." -ForegroundColor Yellow
            Write-Host ''
        }
    }

    # Gera a faixa preservando o padding do inicio.
    $padLen = $inicioTexto.Length
    $total = 0

    if ($inicioTexto -match '^[0-9]+$' -and $fimTexto -match '^[0-9]+$') {
        $total = [int]$fimTexto - [int]$inicioTexto + 1
        Write-Host ''
        Write-Host ' Faixa (com zeros preservados):'
        $current = [int]$inicioTexto
        $fim = [int]$fimTexto
        while ($current -le $fim) {
            $excluirNumeros += $current.ToString("D$padLen")
            $current++
        }
    } else {
        # Faixa textual: gera incrementando a parte numerica do sufixo (ex: A001..A005)
        if ($inicioTexto -match '^([A-Za-z]+)([0-9]+)$') {
            $prefixo = $Matches[1]
            $padNum  = $Matches[2].Length
            $cur  = [int]$Matches[2]
            $fimM = $null
            if ($fimTexto -match '^([A-Za-z]+)([0-9]+)$') { $fimM = $Matches[2] }
            if ($fimM -ne $null -and $prefixo -eq ($fimTexto -replace '[0-9]+$','')) {
                $fimNum2 = [int]$fimM
                while ($cur -le $fimNum2) {
                    $excluirNumeros += "{0}{1}" -f $prefixo, $cur.ToString("D$padNum")
                    $cur++
                }
            } else {
                $excluirNumeros += $inicioTexto
                if ($inicioTexto -ne $fimTexto) { $excluirNumeros += $fimTexto }
            }
        } else {
            $excluirNumeros += $inicioTexto
            if ($inicioTexto -ne $fimTexto) { $excluirNumeros += $fimTexto }
        }
        $total = $excluirNumeros.Count
    }

    Write-Host ''
    Write-Host ' Resumo:'
    Write-Host "   Usuario............: $userName"
    Write-Host "   Modo...............: faixa textual ($inicioTexto ate $fimTexto)"
    Write-Host "   Bois a excluir.....: $($excluirNumeros.Count)"
    Write-Host "   Identificadores...: $($excluirNumeros -join ', ')"
    Write-Host ''
}

# ------------------------------------------------------------------
# PASSO 5 - Confirma a exclusao
# ------------------------------------------------------------------
$r = Ask-SimNao ' Confirmar a exclusao?'
if (-not $r) {
    Write-Host ''
    Write-Host ' Cancelado. Nenhum boi foi excluido.'
    Read-Host ' Pressione ENTER para sair'
    exit 0
}

# ------------------------------------------------------------------
# PASSO 6 - Busca os IDs (1 request com todos os numeros) e exclui em lote
# ------------------------------------------------------------------
Write-Host ''
Write-Host ' ================================================='
Write-Host "   Excluindo bois..."
Write-Host "   Total a excluir: $($excluirNumeros.Count)"
Write-Host ' ================================================='
Write-Host ''

$headers = @{ Authorization = "Bearer $token" }

# PASSO 6a - Um unico request para listar animais e mapear numero -> id
$todos = $null
try {
    $todos = Invoke-RestMethod -Uri "$server/api/animals?status=ATIVO" `
        -Headers $headers -TimeoutSec 120 -ErrorAction Stop
} catch {
    $st = 0
    if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode }
    if ($st -eq 401) { Write-Host ' [ERRO] SESSAO EXPIRADA! Rode o bot novamente.' }
    else { Write-Host " [ERRO] Nao foi possivel listar os animais (HTTP $st)." }
    Write-Host ''
    Read-Host ' Pressione ENTER para sair'
    exit 1
}

# Mapeia os numeros pedidos para IDs internos
$idsParaExcluir = @()
$naoEncontrados = @()
$mapaNumeros = @{}
foreach ($a in @($todos)) {
    if (-not $mapaNumeros.ContainsKey($a.numeroIdentificacao)) {
        $mapaNumeros[$a.numeroIdentificacao] = $a.id
    }
}
foreach ($num in $excluirNumeros) {
    if ($mapaNumeros.ContainsKey($num)) { $idsParaExcluir += $mapaNumeros[$num] }
    else { $naoEncontrados += $num }
}

if ($naoEncontrados.Count -gt 0) {
    Write-Host ' Nao encontrados (pulados):'
    foreach ($n in $naoEncontrados) { Write-Host "   Boi #$n [NAO ENCONTRADO]" }
    Write-Host ''
}
if ($idsParaExcluir.Count -eq 0) {
    Write-Host ' Nenhum boi para excluir. Encerrando.'
    Write-Host ''
    Read-Host ' Pressione ENTER para sair'
    exit 0
}

# PASSO 6b - Exclui TODOS em UM request (DELETE /api/animals com { ids })
$bodyBatch = @{ ids = $idsParaExcluir } | ConvertTo-Json
$resp = $null; $st = 0
try {
    $resp = Invoke-RestMethod -Method Delete -Uri "$server/api/animals" `
        -Headers $headers `
        -ContentType 'application/json; charset=utf-8' -Body $bodyBatch -TimeoutSec 300 `
        -ErrorAction Stop
} catch {
    if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode }
}

$excluidos = 0
if ($null -ne $resp) {
    $excluidos = @($resp.excluidos).Count
    Write-Host " Excluidos: $excluidos bois."
} else {
    if ($st -eq 401) { Write-Host ' [ERRO] SESSAO EXPIRADA! Rode o bot novamente.' }
    elseif ($st -eq 403) { Write-Host ' [ERRO] Seu nivel de acesso nao permite excluir animais.' }
    else { Write-Host " [ERRO] Falha na exclusao em lote (HTTP $st)." }
}

# ------------------------------------------------------------------
# Resumo
# ------------------------------------------------------------------
Write-Host ''
Write-Host ' ================================================='
Write-Host '   Resumo da exclusao'
Write-Host "   Solicitados.......: $($excluirNumeros.Count)"
Write-Host "   Excluidos.........: $excluidos"
Write-Host "   Nao encontrados...: $($naoEncontrados.Count)"
Write-Host ' ================================================='
Write-Host ''
Read-Host ' Pressione ENTER para sair'
if ($null -eq $resp) { exit 1 } else { exit 0 }
