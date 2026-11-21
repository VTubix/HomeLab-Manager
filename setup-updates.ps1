param(
  [Parameter(Mandatory=$true)] [string]$Repository
)
$ErrorActionPreference = 'Stop'
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') {
  throw 'Repository bitte als GITHUBNAME/REPOSITORY angeben, z.B. meinname/homelab-manager.'
}
Set-Location $PSScriptRoot
$privateDir = Join-Path $HOME '.tauri'
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$keyPath = Join-Path $privateDir 'homelab-manager.key'
$pubPath = "$keyPath.pub"
if (!(Test-Path $pubPath)) {
  if (Test-Path $keyPath) { throw "Privater Schluessel existiert, aber $pubPath fehlt. Bitte pruefen statt Schluessel zu ersetzen." }
  Write-Host 'Erzeuge privaten Signierschluessel nur auf diesem PC. Das Programm kann nach einer Passphrase fragen.' -ForegroundColor Cyan
  & npm.cmd run tauri signer generate -- -w $keyPath
  if ($LASTEXITCODE -ne 0) { throw 'Signierschluessel konnte nicht erzeugt werden.' }
}
if (!(Test-Path $pubPath)) { throw "Oeffentlicher Schluessel nicht gefunden: $pubPath" }
$pub = (Get-Content -Raw -Encoding UTF8 $pubPath).Trim()
if ($pub.Length -lt 30) { throw 'Oeffentlicher Schluessel sieht ungueltig aus.' }
$configPath = Join-Path $PSScriptRoot 'src-tauri/tauri.conf.json'
$config = Get-Content -Raw -Encoding UTF8 $configPath | ConvertFrom-Json
$config.plugins.updater.pubkey = $pub
$config.plugins.updater.endpoints = @("https://github.com/$Repository/releases/latest/download/latest.json")
[System.IO.File]::WriteAllText($configPath, ($config | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
Write-Host ''
Write-Host 'GitHub Releases konfiguriert!' -ForegroundColor Green
Write-Host "Repository: $Repository"
Write-Host "Privater Schluessel (NICHT teilen / hochladen): $keyPath"
Write-Host "Oeffentlicher Schluessel ist in src-tauri/tauri.conf.json gespeichert."
Write-Host 'Fuer GitHub Actions: Private-Key-Inhalt als GitHub Secret TAURI_SIGNING_PRIVATE_KEY hinterlegen.'
Write-Host 'Falls eine Passphrase gesetzt wurde: GitHub Secret TAURI_SIGNING_PRIVATE_KEY_PASSWORD hinterlegen.'
Write-Host 'Wichtig: Vor dem ersten Installer musst du das Repository erstellen, Projekt hochladen und Release erstellen.'
