---
allowed-tools: Read
description: Règles OBLIGATOIRES pour toute commande terminal Windows/PowerShell — JAMAIS de &&
---

# Règles Terminal Windows

Convertir / vérifier la commande : $ARGUMENTS

## RÈGLE CRITIQUE : JAMAIS de &&
PowerShell 5.1 ne supporte PAS `&&`. Utiliser `;` (point-virgule).
❌ `cd frontend && npm install` → ✅ `cd frontend ; npm install`

## Chemins : ❌ `~/` → ✅ `C:\Users\33667\DeepSight-Main`

## Variables d'env : ❌ `export VAR=val` → ✅ `$env:VAR = "val"`

## Commandes spécifiques
| Bash | PowerShell |
|------|-----------|
| rm -rf | Remove-Item -Recurse -Force |
| touch | New-Item |
| which | Get-Command |
| grep | Select-String |
| cp -r | Copy-Item -Recurse |

## Continuation ligne : backtick `` ` `` (PAS `\`)

## Contexte SSH (VPS Hetzner) : syntaxe bash OK car Ubuntu

## Avant CHAQUE commande : Windows local (PowerShell) ou VPS Linux (bash) ?