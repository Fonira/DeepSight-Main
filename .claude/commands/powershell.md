---
allowed-tools: Read, Grep, Glob, Bash(powershell:*), Bash(cmd:*), Bash(npm:*), Bash(git:*), Write, Edit
description: Génère des commandes PowerShell avec syntaxe garantie correcte
---

# PowerShell — Syntaxe Garantie

Génère ou corrige des commandes PowerShell pour : $ARGUMENTS

## Règles de syntaxe absolues

### 1. Chaînage de commandes
```powershell
# INTERDIT — && ne fonctionne PAS en PowerShell 5.x
cd frontend && npm run build          # ERREUR

# CORRECT — utiliser ; pour chaîner
cd frontend ; npm run build           # OK (exécute les deux quoi qu'il arrive)

# CORRECT — si on veut stopper en cas d'erreur
cd frontend ; if ($?) { npm run build }

# PowerShell 7+ seulement — && fonctionne
cd frontend && npm run build          # OK uniquement PS 7+
```

### 2. Guillemets et échappement
```powershell
# Double quotes → interpolation de variables
"Le chemin est $env:USERPROFILE"       # Interpolé

# Single quotes → littéral, pas d'interpolation
'Le chemin est $env:USERPROFILE'       # Littéral

# Échapper un double quote dans un double quote
"Il a dit `"bonjour`""                 # Backtick pour échapper

# Échapper dans des arguments cmd
cmd /c "echo `"hello world`""

# Guillemets imbriqués — alterner simple/double
'Il a dit "bonjour"'
"Il a dit 'bonjour'"
```

### 3. Chemins Windows
```powershell
# TOUJOURS utiliser des guillemets pour les chemins avec espaces
Set-Location "C:\Users\33667\DeepSight-Main"

# Backslash OU forward slash fonctionnent
Get-ChildItem "C:/Users/33667/DeepSight-Main"   # OK aussi

# Variables d'environnement
$env:USERPROFILE                                  # Pas %USERPROFILE%
"$env:USERPROFILE\DeepSight-Main"                # Interpolé
```

### 4. Variables
```powershell
# Déclaration
$myVar = "valeur"

# INTERDIT — pas de $ dans le nom côté gauche avec Set-Variable
Set-Variable -Name "myVar" -Value "valeur"       # Sans $

# Tableaux
$arr = @("un", "deux", "trois")

# Hashtables
$hash = @{ Key = "Value"; Key2 = "Value2" }
```

### 5. Conditions et boucles
```powershell
# If — accolades OBLIGATOIRES même pour une ligne
if ($condition) { Do-Something }

# INTERDIT — pas de accolades sur la ligne suivante sans condition
# (ambigu en PowerShell interactif)
if ($condition) {
    Do-Something
}

# Comparateurs — PAS les symboles C-like
-eq    # égal (pas ==)
-ne    # différent (pas !=)
-gt    # supérieur (pas >)
-lt    # inférieur (pas <)
-like  # wildcard match
-match # regex match

# Opérateurs logiques
-and   # ET (pas &&)
-or    # OU (pas ||)
-not   # NON (pas !)
```

### 6. Gestion d'erreurs
```powershell
# Try/Catch — TOUJOURS avec -ErrorAction Stop pour les cmdlets
try {
    Get-Item "C:\inexistant" -ErrorAction Stop
} catch {
    Write-Host "Erreur : $_"
}

# $? vérifie le succès de la dernière commande
npm run build
if (-not $?) { Write-Host "Build a échoué" ; exit 1 }

# $LASTEXITCODE pour les programmes externes
python script.py
if ($LASTEXITCODE -ne 0) { Write-Host "Échec Python" ; exit 1 }
```

### 7. Pipelines et sorties
```powershell
# Filtrer
Get-Process | Where-Object { $_.CPU -gt 100 }

# Sélectionner des propriétés
Get-Process | Select-Object Name, CPU, Id

# Trier
Get-ChildItem | Sort-Object LastWriteTime -Descending

# Redirection — PAS la même syntaxe que bash
command 2>&1 | Out-File log.txt          # stdout + stderr
command | Out-File -Append log.txt        # Append (pas >>)
command > $null                           # Supprimer la sortie (OK)
command | Out-Null                        # Aussi valide
```

### 8. Pièges fréquents
```powershell
# PIÈGE : Remove-Item sans -Recurse pour un dossier
Remove-Item "dossier" -Recurse -Force    # Correct

# PIÈGE : Invoke-WebRequest vs curl
# En PS5, curl est un alias vers Invoke-WebRequest (pas le vrai curl)
Invoke-WebRequest -Uri "https://example.com"   # Explicite
curl.exe "https://example.com"                  # Le vrai curl

# PIÈGE : Select-String vs grep
Select-String -Path "*.txt" -Pattern "motif"   # PowerShell natif
# Ou utiliser findstr pour du simple
cmd /c "findstr /s /i motif *.txt"

# PIÈGE : Encodage — UTF-8 sans BOM
$content | Out-File -FilePath "file.txt" -Encoding utf8NoBOM   # PS 7+
[System.IO.File]::WriteAllText("file.txt", $content)           # PS 5

# PIÈGE : Start-Process ne capture pas la sortie
# Pour capturer :
$output = & program.exe arguments 2>&1
# PAS :
$output = Start-Process program.exe -Wait   # Ne capture rien
```

## Workflow de validation

Avant de fournir une commande PowerShell :
1. Vérifier la version PS cible (5.1 vs 7+) — en cas de doute, utiliser la syntaxe PS 5.1
2. Tester mentalement chaque opérateur (pas de &&, pas de ==, pas de !=)
3. Vérifier les guillemets imbriqués
4. Vérifier les chemins (guillemets si espaces)
5. Vérifier la gestion d'erreur ($? ou try/catch)

## Output
Toujours fournir la commande prête à copier-coller, avec un commentaire si la syntaxe est non-évidente.
