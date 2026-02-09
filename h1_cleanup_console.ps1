$ErrorActionPreference = "Stop"
$startTime = Get-Date
$srcPath = "C:\Users\33667\DeepSight-Main\mobile\src"
$botToken = "8202896268:AAF_5zdUfKjoVbVaWv1zCCZIttnl8UxL4kE"
$chatId = "735497548"

function Send-TG($text) {
    $body = @{ chat_id = $chatId; text = $text } | ConvertTo-Json -Compress
    try { Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/sendMessage" -Method Post -ContentType "application/json" -Body $body | Out-Null } catch {}
}

Send-TG "[H1] Console.log Cleanup - Demarrage..."

$files = Get-ChildItem -Recurse -Path $srcPath -Include '*.ts','*.tsx' | Where-Object { $_.Name -notlike '*.test.*' }
$totalR = 0
$filesM = 0
$results = @()

foreach ($f in $files) {
    $content = [IO.File]::ReadAllText($f.FullName)
    $original = $content
    $content = $content -replace '(?m)^(\s+)(console\.(log|warn|error|info|debug)\()', '$1if (__DEV__) $2'
    $content = $content -replace 'if \(__DEV__\) if \(__DEV__\)', 'if (__DEV__)'

    if ($content -ne $original) {
        $diff = Compare-Object ($original -split "`n") ($content -split "`n")
        $count = @($diff | Where-Object { $_.SideIndicator -eq '=>' }).Count
        [IO.File]::WriteAllText($f.FullName, $content)
        $filesM++
        $totalR += $count
        $rel = $f.FullName.Replace($srcPath + "\", "")
        $results += "$count x $rel"
    }
}

$dur = [math]::Round(((Get-Date) - $startTime).TotalSeconds)
$det = ($results | Sort-Object -Descending) -join "`n"

Send-TG "[H1 DONE] $totalR replacements in $filesM files (${dur}s)`n$det"

Write-Host "=== H1 COMPLETE ===" -ForegroundColor Green
Write-Host "Replacements: $totalR | Files: $filesM | Duration: ${dur}s" -ForegroundColor Cyan
$results | Sort-Object -Descending | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
