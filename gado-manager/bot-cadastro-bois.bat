@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "$l=[IO.File]::ReadAllLines('%~f0',[Text.Encoding]::UTF8);$i=[Array]::IndexOf($l,'#PS_START');iex (($l[($i+1)..($l.Count-1)] -join [Environment]::NewLine))"
exit /b %errorlevel%
#PS_START
# =============================================================================
#  GadoManager - Bot de Cadastro de Bois (RAPIDO - batch)
#  Arquivo: gado-manager/bot-cadastro-bois.bat
#
#  Fluxo:
#   1. Confere se o servidor (localhost:3000) esta no ar (start-server.bat)
#   2. Pede email e senha, faz login e mostra o NOME do usuario
#   3. Pede confirmacao: "Voce mesmo?" (S/N)
#   4. Pergunta quantos bois e o modo de cadastro (por numero: inicial/final)
#   5. Cadastra TODOS os bois da faixa em UM UNICO request (POST /api/animals/batch)
#
#  Os numeros sao mantidos COMO TEXTO (ex: "003" continua "003"), preservando
#  os zeros. Duplicados sao pulados pelo servidor (reportados no resumo).
# =============================================================================
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = 'GadoManager - Bot de Cadastro de Bois' } catch {}
$server = 'http://localhost:3000'

Write-Host ''
Write-Host ' ================================================='
Write-Host '   GadoManager - Bot de Cadastro de Bois'
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
    Write-Host ' Ok. Nada foi cadastrado. Encerrando por seguranca.'
    Read-Host ' Pressione ENTER para sair'
    exit 0
}
Write-Host ''

# ------------------------------------------------------------------
# PASSO 4 - Quantidade e modo de cadastro (por numero inicial/final)
# ------------------------------------------------------------------
function Ask-NumeroPositivo($msg) {
    while ($true) {
        $v = Read-Host " $msg"
        $v = $v.Trim()
        if ($v -match '^[0-9]+$' -and [int]$v -gt 0) { return [int]$v }
        Write-Host ' [ERRO] Digite apenas numeros maiores que 0.'; Write-Host ''
    }
}

$quantos = Ask-NumeroPositivo 'Quantos bois voce quer adicionar?'
Write-Host ''
Write-Host ' Modo de cadastro disponivel:'
Write-Host '   [1] Por numero - informar numero inicial e final'
Write-Host ''
while ($true) {
    $modo = Read-Host ' Escolha o modo (1)'
    $modo = $modo.Trim()
    if ($modo -eq '' -or $modo -eq '1') { break }
    Write-Host ' [ERRO] Opcao invalida. Digite 1.'
}

# Le os identificadores COMO TEXTO — preserva zeros (ex: "003")
function Ask-TextoPositivo($msg) {
    while ($true) {
        $v = (Read-Host "$msg").Trim()
        if ($v -match '^[0-9]+$') {
            if ([int]$v -gt 0) { return $v }
            Write-Host ' [ERRO] Digite apenas numeros maiores que 0.'; Write-Host ''
        } else {
            Write-Host ' [ERRO] Digite apenas numeros.'; Write-Host ''
        }
    }
}

$inicioTexto = Ask-TextoPositivo 'Numero inicial (ex: 003):'
while ($true) {
    $fimTexto = Ask-TextoPositivo 'Numero final (ex: 010):'
    if ([int]$fimTexto -ge [int]$inicioTexto) { break }
    Write-Host ' [ERRO] O numero final deve ser maior ou igual ao inicial.'; Write-Host ''
}

# Gera a faixa preservando os zeros do INICIO (ex: 003..010 => 003,004,...,010)
$total = [int]$fimTexto - [int]$inicioTexto + 1
$padLen = $inicioTexto.Length
$faixaLabels = @()
$cur = [int]$inicioTexto
$fimNum = [int]$fimTexto
while ($cur -le $fimNum) {
    $faixaLabels += $cur.ToString("D$padLen")
    $cur++
}

Write-Host ''
Write-Host ' Resumo:'
Write-Host "   Usuario....: $userName"
Write-Host "   Bois pedidos: $quantos"
Write-Host "   Faixa......: $inicioTexto ate $fimTexto ($total bois)"
Write-Host "   Labels.....: $($faixaLabels -join ', ')"
if ($total -ne $quantos) {
    Write-Host " [AVISO] A faixa informada tem $total bois (voce pediu $quantos)." -ForegroundColor Yellow
    Write-Host "         Serao cadastrados os $total bois da faixa." -ForegroundColor Yellow
}
Write-Host ''
$r = Read-Host ' Confirmar o cadastro? (S/N)'
if ($r -notmatch '^[sS]') {
    Write-Host ''
    Write-Host ' Cancelado. Nenhum boi foi cadastrado.'
    Read-Host ' Pressione ENTER para sair'
    exit 0
}

# ------------------------------------------------------------------
# PASSO 5 - Cadastrar TODOS os bois em UM request (rapido)
# ------------------------------------------------------------------
Write-Host ''
Write-Host ' ==============================================='
Write-Host "   Cadastrando $total bois (lote unico)..."
Write-Host ' ==============================================='
Write-Host ''

$headers = @{ Authorization = "Bearer $token" }
$bodyBatch = @{ numeros = $faixaLabels } | ConvertTo-Json
$resp = $null; $st = 0
try {
    $resp = Invoke-RestMethod -Method Post -Uri "$server/api/animals/batch" `
        -Headers $headers `
        -ContentType 'application/json; charset=utf-8' -Body $bodyBatch -TimeoutSec 300
} catch {
    if ($_.Exception.Response) { $st = [int]$_.Exception.Response.StatusCode }
}

if ($null -eq $resp) {
    if ($st -eq 401) {
        Write-Host ' [ERRO] SESSAO EXPIRADA! Rode o bot novamente.'
    } elseif ($st -eq 403) {
        Write-Host ' [ERRO] Seu nivel de acesso nao permite cadastrar animais.'
    } else {
        Write-Host " [ERRO] Falha no cadastro em lote (HTTP $st)."
    }
    Write-Host ''
    Read-Host ' Pressione ENTER para sair'
    exit 1
}

$criados     = @($resp.criados).Count
$duplicados  = @($resp.duplicados).Count
$erros       = @($resp.erros).Count

Write-Host ' Criados:'
foreach ($c in @($resp.criados)) { Write-Host ("   Boi #{0} [OK]" -f $c.numeroIdentificacao) }
if ($duplicados -gt 0) {
    Write-Host ' Ja existiam (pulados):'
    foreach ($d in @($resp.duplicados)) { Write-Host "   Boi #$d [JA EXISTE]" }
}
if ($erros -gt 0) {
    Write-Host ' Erros:'
    foreach ($e in @($resp.erros)) { Write-Host ("   Boi #{0}: {1}" -f $e.numeroIdentificacao, $e.erro) }
}

# ------------------------------------------------------------------
# Resumo
# ------------------------------------------------------------------
Write-Host ''
Write-Host ' ==============================================='
Write-Host '   Resumo do cadastro'
Write-Host "   Processados: $total"
Write-Host "   Criados....: $criados"
Write-Host "   Duplicados.: $duplicados"
Write-Host "   Erros......: $erros"
Write-Host ' ==============================================='
Write-Host ''
Read-Host ' Pressione ENTER para sair'
if ($erros -gt 0) { exit 1 } else { exit 0 }
