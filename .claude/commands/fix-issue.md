---
allowed-tools: Read, Grep, Glob, Bash(gh:*), Bash(npm test:*), Bash(npm run typecheck:*), Bash(git:*), Write, Edit
description: Analyse et corrige une issue GitHub automatiquement
---

# Fix GitHub Issue

Analyse et corrige l'issue GitHub : $ARGUMENTS

## Workflow

### 1. Récupération de l'issue
```bash
gh issue view $ARGUMENTS --json title,body,labels,comments
```

### 2. Analyse
- Comprends le problème décrit
- Identifie les fichiers concernés
- Formule une hypothèse sur la cause

### 3. Recherche dans le codebase
- Utilise Grep/Glob pour trouver les fichiers pertinents
- Lis le code source concerné
- Identifie la root cause

### 4. Implémentation du fix
- Écris un test qui reproduit le bug (doit ÉCHOUER)
- Implémente la correction
- Vérifie que le test passe maintenant

### 5. Vérification
```bash
cd mobile && npm run typecheck
cd mobile && npm test
```

### 6. Commit et PR
```bash
git checkout -b fix/issue-$ARGUMENTS
git add <fichiers modifiés>
git commit -m "fix: <description du fix>

Fixes #$ARGUMENTS"
git push -u origin fix/issue-$ARGUMENTS
gh pr create --title "Fix #$ARGUMENTS: <titre>" --body "## Problème
<description>

## Solution
<explication>

## Tests
- [ ] Test ajouté pour le cas
- [ ] Tous les tests passent

Fixes #$ARGUMENTS"
```

## Output
Affiche le lien de la PR créée.
