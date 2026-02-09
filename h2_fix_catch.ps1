$srcPath = "C:\Users\33667\DeepSight-Main\mobile\src"
$modified = 0
$details = @()

Write-Host "=== H2 FIX: Adding __DEV__ logging to empty catch blocks ===" -ForegroundColor Cyan

# --- 1 & 2: AuthContext.tsx inline .catch(() => {}) ---
$file = "$srcPath\contexts\AuthContext.tsx"
$content = [IO.File]::ReadAllText($file)

$old1 = "await tokenStorage.clearTokens().catch(() => {});"
$new1 = "await tokenStorage.clearTokens().catch((e) => { if (__DEV__) console.warn('[Auth] clearTokens cleanup error:', e); });"

$old2 = "await userStorage.clearUser().catch(() => {});"
$new2 = "await userStorage.clearUser().catch((e) => { if (__DEV__) console.warn('[Auth] clearUser cleanup error:', e); });"

if ($content.Contains($old1)) {
    $content = $content.Replace($old1, $new1)
    $modified++
    $details += "AuthContext.tsx: clearTokens inline catch"
}
if ($content.Contains($old2)) {
    $content = $content.Replace($old2, $new2)
    $modified++
    $details += "AuthContext.tsx: clearUser inline catch"
}
[IO.File]::WriteAllText($file, $content)

# --- 3: LoginScreen.tsx ---
$file = "$srcPath\screens\LoginScreen.tsx"
$content = [IO.File]::ReadAllText($file)

$old3 = "    } catch (err) {`n      // Error is handled by AuthContext`n    }"
$new3 = "    } catch (err) {`n      // Error is handled by AuthContext`n      if (__DEV__) console.warn('[Login] Error (handled by AuthContext):', err);`n    }"

# Try multiple whitespace patterns
$patterns = @(
    @("} catch (err) {`r`n      // Error is handled by AuthContext`r`n    }", "} catch (err) {`r`n      // Error is handled by AuthContext`r`n      if (__DEV__) console.warn('[Login] Error (handled by AuthContext):', err);`r`n    }"),
    @("} catch (err) {`n      // Error is handled by AuthContext`n    }", "} catch (err) {`n      // Error is handled by AuthContext`n      if (__DEV__) console.warn('[Login] Error (handled by AuthContext):', err);`n    }")
)

# Use regex for robustness
$regex3 = '(\} catch \(err\) \{\s*\n\s*// Error is handled by AuthContext\s*\n)(\s*\})'
if ($content -match $regex3) {
    $content = [regex]::Replace($content, $regex3, '$1      if (__DEV__) console.warn(''[Login] Error (handled by AuthContext):'', err);' + "`n" + '$2', [System.Text.RegularExpressions.RegexOptions]::None)
    $modified++
    $details += "LoginScreen.tsx: login catch"
    [IO.File]::WriteAllText($file, $content)
}

# --- 4: RegisterScreen.tsx ---
$file = "$srcPath\screens\RegisterScreen.tsx"
$content = [IO.File]::ReadAllText($file)
$regex4 = '(\} catch \(err\) \{\s*\n\s*// Error is handled by AuthContext\s*\n)(\s*\})'
if ($content -match $regex4) {
    $content = [regex]::Replace($content, $regex4, '$1      if (__DEV__) console.warn(''[Register] Error (handled by AuthContext):'', err);' + "`n" + '$2', [System.Text.RegularExpressions.RegexOptions]::None)
    $modified++
    $details += "RegisterScreen.tsx: register catch"
    [IO.File]::WriteAllText($file, $content)
}

# --- 5: VerifyEmailScreen.tsx ---
$file = "$srcPath\screens\VerifyEmailScreen.tsx"
$content = [IO.File]::ReadAllText($file)
$regex5 = '(\} catch \(err\) \{\s*\n\s*// Error handled by AuthContext\s*\n)(\s*\})'
if ($content -match $regex5) {
    $content = [regex]::Replace($content, $regex5, '$1      if (__DEV__) console.warn(''[VerifyEmail] Error (handled by AuthContext):'', err);' + "`n" + '$2', [System.Text.RegularExpressions.RegexOptions]::None)
    $modified++
    $details += "VerifyEmailScreen.tsx: verify catch"
    [IO.File]::WriteAllText($file, $content)
}

# --- 6 & 7: storage.ts removeItem ---
$file = "$srcPath\utils\storage.ts"
$content = [IO.File]::ReadAllText($file)

# Pattern: } catch (error) {\n      // Ignore errors - item might not exist\n    }
$regex6 = '(\} catch \(error\) \{\s*\n\s*// Ignore errors - item might not exist\s*\n)(\s*\})'
$matchCount = ([regex]::Matches($content, $regex6)).Count
if ($matchCount -gt 0) {
    $content = [regex]::Replace($content, $regex6, '$1      if (__DEV__) console.warn(''[Storage] removeItem cleanup error:'', error);' + "`n" + '$2')
    $modified += $matchCount
    $details += "storage.ts: $matchCount removeItem catch blocks"
    [IO.File]::WriteAllText($file, $content)
}

Write-Host "`n=== RESULTS ===" -ForegroundColor Green
Write-Host "Modified: $modified catch blocks" -ForegroundColor Green
foreach ($d in $details) {
    Write-Host "  - $d" -ForegroundColor Gray
}

# Telegram notification
$botToken = "8202896268:AAF_5zdUfKjoVbVaWv1zCCZIttnl8UxL4kE"
$chatId = "735497548"
$msg = "[H2 DONE] $modified empty catch blocks fixed with __DEV__ logging"
$body = @{ chat_id = $chatId; text = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/sendMessage" -Method Post -ContentType "application/json" -Body $body | Out-Null
Write-Host "`nTelegram notification sent." -ForegroundColor Cyan
