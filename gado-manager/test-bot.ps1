try {
    $l = [IO.File]::ReadAllLines('%~f0', [Text.Encoding]::UTF8)
    $i = [Array]::IndexOf($l, '#PS_START')
    iex (($l[($i+1)..($l.Count-1)] -join [Environment]::NewLine))
} catch {
    Write-Host "ERRO: $_"
    exit 1
}
