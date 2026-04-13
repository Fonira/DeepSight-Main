---
description: "Règles OBLIGATOIRES pour toute commande terminal destinée à l'utilisateur. L'utilisateur travaille sur Windows 10/11 avec PowerShell. Ne JAMAIS utiliser && pour enchaîner des commandes. Utiliser ; à la place."
---

# Règles Terminal Windows — OBLIGATOIRES

## RÈGLE CRITIQUE N°1 : JAMAIS de &&

Le terminal Windows (PowerShell 5.1) ne supporte PAS `&&`.

```
# ❌ INTERDIT — provoque une erreur à chaque fois
cd frontend && npm install
mkdir src && cd src
npm install && npm run build

# ✅ CORRECT — utiliser ; (point-virgule)
cd frontend ; npm install
mkdir src ; cd src
npm install ; npm run build
```

Si l'exécution conditionnelle est nécessaire (arrêter si la première commande échoue), séparer en commandes distinctes sur des lignes séparées :

```powershell
cd frontend
npm install
npm run build
```

## RÈGLE N°2 : Chemins Windows

```
# ❌ INTERDIT
cd ~/DeepSight-Main
export VAR=value

# ✅ CORRECT
cd C:\Users\33667\DeepSight-Main
$env:VAR = "value"
```

## RÈGLE N°3 : Variables d'environnement

```powershell
# ❌ INTERDIT (syntaxe bash)
export NODE_ENV=production
VAR=value command

# ✅ CORRECT (PowerShell)
$env:NODE_ENV = "production"
# Ou pour une seule commande, utiliser cross-env dans package.json
```

## RÈGLE N°4 : Commandes spécifiques

| Bash/Linux            | PowerShell Windows                                                     |
| --------------------- | ---------------------------------------------------------------------- |
| `rm -rf node_modules` | `Remove-Item -Recurse -Force node_modules` ou `rm -r -fo node_modules` |
| `cat file.txt`        | `Get-Content file.txt` ou `cat file.txt` (alias OK)                    |
| `touch file.txt`      | `New-Item file.txt`                                                    |
| `which command`       | `Get-Command command`                                                  |
| `ls -la`              | `Get-ChildItem` ou `ls` (alias OK)                                     |
| `grep "text" file`    | `Select-String -Pattern "text" file`                                   |
| `cp -r src dest`      | `Copy-Item -Recurse src dest`                                          |

## RÈGLE N°5 : Commandes longues

Pour les commandes très longues, utiliser le backtick `` ` `` comme caractère de continuation (PAS `\`) :

```powershell
# ❌ INTERDIT
npx expo install expo-router \
  expo-constants \
  expo-linking

# ✅ CORRECT
npx expo install expo-router `
  expo-constants `
  expo-linking
```

## RÈGLE N°6 : Contexte SSH (VPS Hetzner)

Quand l'utilisateur travaille en SSH sur le VPS `clawdbot` (89.167.23.214), la syntaxe bash/Linux est OK car c'est Ubuntu.
Identifier le contexte : si la commande est pour le VPS, utiliser bash. Si c'est pour la machine locale, utiliser PowerShell.

## RAPPEL FINAL

Avant CHAQUE réponse contenant une commande terminal :

1. Vérifier : est-ce pour Windows local ou VPS Linux ?
2. Si Windows : remplacer TOUS les `&&` par `;`
3. Si Windows : vérifier les chemins (backslash, pas de ~)
4. Si Windows : vérifier les variables d'env ($env: pas export)
