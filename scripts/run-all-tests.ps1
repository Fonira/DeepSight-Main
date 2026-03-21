# DeepSight - Run All Tests (PowerShell)
# Compatible PowerShell 5.1+ (pas de && operator)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot

Write-Host "=== DeepSight Test Suite ===" -ForegroundColor Cyan

Write-Host "`n[1/4] Backend tests..." -ForegroundColor Yellow
Set-Location "$RootDir\backend"
python -m pytest tests/ -x --timeout=30 -q
if ($LASTEXITCODE -ne 0) { Write-Host "Backend tests FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n[2/4] Frontend tests..." -ForegroundColor Yellow
Set-Location "$RootDir\frontend"
npm run test
if ($LASTEXITCODE -ne 0) { Write-Host "Frontend tests FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n[3/4] Mobile tests..." -ForegroundColor Yellow
Set-Location "$RootDir\mobile"
npm test -- --ci
if ($LASTEXITCODE -ne 0) { Write-Host "Mobile tests FAILED" -ForegroundColor Red; exit 1 }

Write-Host "`n[4/4] Extension tests..." -ForegroundColor Yellow
Set-Location "$RootDir\extension"
npm test -- --ci --passWithNoTests
if ($LASTEXITCODE -ne 0) { Write-Host "Extension tests FAILED" -ForegroundColor Red; exit 1 }

Set-Location $RootDir
Write-Host "`nAll tests passed!" -ForegroundColor Green
