$srcPath = "C:\Users\33667\DeepSight-Main\mobile\src"
$files = Get-ChildItem -Recurse -Path $srcPath -Include '*.ts','*.tsx'
$found = 0

Write-Host "=== H2: REAL empty catch blocks ===" -ForegroundColor Cyan

foreach ($f in $files) {
    $lines = [IO.File]::ReadAllLines($f.FullName)
    $rel = $f.FullName.Replace($srcPath + "\", "")
    
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        $trimmed = $line.Trim()
        
        # Pattern A: inline .catch(() => {}) or .catch(() => { })
        if ($trimmed -match '\.catch\(\s*\(\s*\w*\s*\)\s*=>\s*\{\s*\}\s*\)') {
            $found++
            Write-Host "$found. [INLINE] $rel`:$($i+1) -> $trimmed" -ForegroundColor Yellow
            continue
        }
        
        # Pattern B: try/catch where the catch body is empty
        # Match: } catch (xxx) {
        if ($trimmed -match '^\}\s*catch\s*\([^)]*\)\s*\{') {
            # Check if same line closes: } catch(e) {}
            if ($trimmed -match '^\}\s*catch\s*\([^)]*\)\s*\{\s*\}\s*$') {
                $found++
                Write-Host "$found. [SAME-LINE] $rel`:$($i+1) -> $trimmed" -ForegroundColor Yellow
                continue
            }
            
            # Check next lines for empty body
            if (($i + 1) -lt $lines.Count) {
                $nextTrimmed = $lines[$i + 1].Trim()
                # Next line is just }
                if ($nextTrimmed -eq '}' -or $nextTrimmed -eq '} finally {') {
                    $found++
                    Write-Host "$found. [EMPTY-BODY] $rel`:$($i+1) -> $trimmed" -ForegroundColor Yellow
                    continue
                }
                # Next line is just a comment, then }
                if ($nextTrimmed -match '^//' -and ($i + 2) -lt $lines.Count) {
                    $nextNext = $lines[$i + 2].Trim()
                    if ($nextNext -eq '}' -or $nextNext -eq '} finally {') {
                        $found++
                        Write-Host "$found. [COMMENT-ONLY] $rel`:$($i+1) -> $trimmed // $nextTrimmed" -ForegroundColor Yellow
                        continue
                    }
                }
            }
        }
    }
}

Write-Host "`nTotal REAL empty catch blocks: $found" -ForegroundColor Green

$botToken = "8202896268:AAF_5zdUfKjoVbVaWv1zCCZIttnl8UxL4kE"
$chatId = "735497548"
$body = @{ chat_id = $chatId; text = "[H2] Real empty catch scan: $found blocks found" } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/sendMessage" -Method Post -ContentType "application/json" -Body $body | Out-Null
