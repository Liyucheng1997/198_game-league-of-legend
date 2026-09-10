$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
Write-Host 'Open http://127.0.0.1:8196 in your browser. Press Ctrl+C to stop.'
python -m http.server 8196 --bind 127.0.0.1
