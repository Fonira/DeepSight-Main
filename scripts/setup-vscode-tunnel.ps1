# ============================================================================
# DeepSight — VS Code Tunnel Setup (Windows)
# ============================================================================
# Installe VS Code CLI et configure un tunnel persistant pour acceder
# a VS Code depuis un navigateur mobile via vscode.dev.
#
# Usage :
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup-vscode-tunnel.ps1
#
# Apres execution :
#   1. Ouvrir vscode.dev sur le telephone
#   2. Icone Remote (bas gauche) -> "Connect to Tunnel"
#   3. Selectionner "deepsight-msi"
# ============================================================================

$ErrorActionPreference = "Stop"

$TunnelName = "deepsight-msi"
$TaskName = "VSCodeTunnel-DeepSight"
$CliDir = "$env:USERPROFILE\.vscode-cli"
$CliZip = "$env:TEMP\vscode-cli.zip"
$CliExe = "$CliDir\code.exe"

Write-Host "=== DeepSight — VS Code Tunnel Setup ===" -ForegroundColor Cyan

# ---------------------------------------------------------------
# 1. Detecter ou installer VS Code CLI
# ---------------------------------------------------------------
$codeCmd = $null

# Option A : VS Code Desktop installe (code.cmd dans le PATH)
$existingCode = Get-Command "code" -ErrorAction SilentlyContinue
if ($existingCode) {
    # Verifier que la version supporte les tunnels
    $version = & code --version 2>$null | Select-Object -First 1
    if ($version) {
        Write-Host "[1/4] VS Code Desktop detecte (v$version)" -ForegroundColor Green
        $codeCmd = "code"
    }
}

# Option B : CLI standalone deja installe
if (-not $codeCmd -and (Test-Path $CliExe)) {
    Write-Host "[1/4] VS Code CLI standalone detecte dans $CliDir" -ForegroundColor Green
    $codeCmd = $CliExe
}

# Option C : Telecharger le CLI standalone
if (-not $codeCmd) {
    Write-Host "[1/4] Telechargement de VS Code CLI..." -ForegroundColor Yellow

    if (-not (Test-Path $CliDir)) {
        New-Item -ItemType Directory -Path $CliDir -Force | Out-Null
    }

    $downloadUrl = "https://code.visualstudio.com/sha/download?build=stable&os=cli-win32-x64"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $CliZip -UseBasicParsing

    Expand-Archive -Path $CliZip -DestinationPath $CliDir -Force
    Remove-Item $CliZip -Force

    if (-not (Test-Path $CliExe)) {
        Write-Host "ERREUR : code.exe introuvable apres extraction dans $CliDir" -ForegroundColor Red
        Write-Host "Contenu du dossier :" -ForegroundColor Yellow
        Get-ChildItem $CliDir -Recurse | Select-Object FullName
        exit 1
    }

    Write-Host "[1/4] VS Code CLI installe dans $CliDir" -ForegroundColor Green
    $codeCmd = $CliExe
}

# ---------------------------------------------------------------
# 2. Authentification (interactive, une seule fois)
# ---------------------------------------------------------------
Write-Host "`n[2/4] Authentification du tunnel..." -ForegroundColor Yellow
Write-Host "  Un lien va s'afficher — ouvrez-le dans votre navigateur pour autoriser." -ForegroundColor Gray

& $codeCmd tunnel user login --provider github
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR : Authentification echouee. Reessayez." -ForegroundColor Red
    exit 1
}
Write-Host "[2/4] Authentification reussie" -ForegroundColor Green

# ---------------------------------------------------------------
# 3. Test du tunnel (lancement rapide pour valider)
# ---------------------------------------------------------------
Write-Host "`n[3/4] Test du tunnel '$TunnelName'..." -ForegroundColor Yellow
Write-Host "  Le tunnel va demarrer. Appuyez sur Ctrl+C apres avoir vu 'Ready to accept connections'." -ForegroundColor Gray
Write-Host "  Ou attendez 10 secondes pour continuer automatiquement.`n" -ForegroundColor Gray

$tunnelProcess = Start-Process -FilePath $codeCmd `
    -ArgumentList "tunnel --name $TunnelName --accept-server-license-terms" `
    -PassThru -NoNewWindow

Start-Sleep -Seconds 10

if (-not $tunnelProcess.HasExited) {
    Stop-Process -Id $tunnelProcess.Id -Force -ErrorAction SilentlyContinue
    Write-Host "[3/4] Tunnel fonctionne correctement" -ForegroundColor Green
} else {
    Write-Host "ATTENTION : Le tunnel s'est arrete prematurement (code: $($tunnelProcess.ExitCode))" -ForegroundColor Yellow
    Write-Host "  Le service sera quand meme configure. Verifiez manuellement." -ForegroundColor Yellow
}

# ---------------------------------------------------------------
# 4. Creer la tache planifiee Windows
# ---------------------------------------------------------------
Write-Host "`n[4/4] Configuration du demarrage automatique..." -ForegroundColor Yellow

# Supprimer la tache existante si elle existe
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "  Tache existante '$TaskName' supprimee." -ForegroundColor Gray
}

# Creer l'action
$action = New-ScheduledTaskAction `
    -Execute $codeCmd `
    -Argument "tunnel --name $TunnelName --accept-server-license-terms"

# Declencheur : a l'ouverture de session
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Parametres : en arriere-plan, redemarrage sur echec
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0)

# Enregistrer la tache
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "VS Code Tunnel pour acces mobile DeepSight" `
    -RunLevel Limited | Out-Null

# Demarrer immediatement
Start-ScheduledTask -TaskName $TaskName

Write-Host "[4/4] Tache planifiee '$TaskName' creee et demarree" -ForegroundColor Green

# ---------------------------------------------------------------
# Resume
# ---------------------------------------------------------------
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  VS Code Tunnel configure avec succes !" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Nom du tunnel : $TunnelName" -ForegroundColor White
Write-Host "  Demarrage auto : Oui (a chaque ouverture de session)" -ForegroundColor White
Write-Host ""
Write-Host "  --- Connexion depuis le telephone ---" -ForegroundColor Yellow
Write-Host "  1. Ouvrir Chrome/Safari sur le telephone" -ForegroundColor White
Write-Host "  2. Aller sur : https://vscode.dev" -ForegroundColor White
Write-Host "  3. Cliquer l'icone Remote (en bas a gauche)" -ForegroundColor White
Write-Host "  4. 'Connect to Tunnel' -> selectionner '$TunnelName'" -ForegroundColor White
Write-Host ""
Write-Host "  --- Commandes utiles (PowerShell) ---" -ForegroundColor Yellow
Write-Host "  Statut  : $codeCmd tunnel status" -ForegroundColor Gray
Write-Host "  Stop    : Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Start   : Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Suppr.  : Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host ""
