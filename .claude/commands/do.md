---
allowed-tools: Read, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(cd:*), Bash(git:*), Bash(pytest:*), Bash(python:*), Bash(ssh:*), Write, Edit
description: Exécute tout sans proposer
---

# /do — Exécution autonome

Exécute : $ARGUMENTS

## Règles
- Tu FAIS, tu ne proposes pas
- "Vous pourriez" → fais-le. "Il faudrait" → fais-le. "Voici le code" → écris-le dans le fichier
- Test échoue → corrige et relance. Build casse → debug et fixe
- Enchaîne sans validation intermédiaire
- Confirmation uniquement pour : suppression, push, config prod

## Output
```
FAIT : [actions]
Fichiers : [chemins]
```
