---
allowed-tools: Read, Grep, Glob, Bash(npm test:*), Bash(npm run typecheck:*), Bash(npx expo:*), Write, Edit
description: Debug approfondi d'une erreur avec ultrathink
---

# Debug Protocol

Analyse et corrige l'erreur suivante : $ARGUMENTS

## Utilise ultrathink pour ce debug

### 1. Collecte d'informations
- Lis le message d'erreur COMPLET
- Identifie le fichier et la ligne exacte
- Analyse la stack trace

### 2. Contexte
- Lis les fichiers mentionnés dans l'erreur
- Comprends le flux de données
- Identifie les dépendances

### 3. Hypothèses
Liste au moins 3 causes possibles :
1. ...
2. ...
3. ...

### 4. Investigation
Pour chaque hypothèse :
- Vérifie si elle correspond aux symptômes
- Cherche des preuves dans le code
- Élimine ou confirme

### 5. Root Cause Analysis
- Identifie la cause racine
- Explique POURQUOI l'erreur se produit
- Ne traite pas juste le symptôme

### 6. Correction
- Implémente le fix
- Ajoute un test de régression si pertinent

### 7. Vérification
```bash
cd mobile && npm run typecheck
cd mobile && npm test
```

### 8. Prévention
Réponds à : "Comment éviter que ça se reproduise ?"
- Ajouter un check ?
- Améliorer les types ?
- Documenter le piège ?

## Output
```
🔍 ROOT CAUSE: <explication>
✅ FIX: <ce qui a été corrigé>
🛡️ PREVENTION: <mesure préventive ajoutée>
```
