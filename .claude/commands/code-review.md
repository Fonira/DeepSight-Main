---
allowed-tools: Read, Grep, Glob, Bash(git:*)
description: Review de code DeepSight — sécurité, performance, correctness, compatibilité cross-platform
---

# Code Review

Review le code suivant : $ARGUMENTS

(Si PR URL fournie, récupérer le diff avec `gh pr diff`. Sinon reviewer les fichiers modifiés via `git diff`.)

## Checklist de review

### 1. Sécurité

- Pas de secrets hardcodés (clés API, tokens, mots de passe)
- Validation des entrées utilisateur (Pydantic côté backend)
- `is_feature_available()` appelé côté backend (pas seulement client)
- Webhook Stripe vérifie la signature
- Pas de `eval()`, pas d'injection SQL, pas de XSS

### 2. Performance

- Pas de N+1 queries (vérifier les boucles avec requêtes DB)
- Cache Redis utilisé quand pertinent (transcripts, résultats)
- Pas de `await` bloquant dans une boucle (utiliser `asyncio.gather`)
- Taille des payloads raisonnable (pagination si liste)

### 3. Correctness

- Types stricts (pas de `any` en TS, type hints en Python)
- Edge cases gérés (null, undefined, listes vides, textes longs)
- Gestion d'erreurs (try/catch, HTTPException avec codes appropriés)
- Tests présents pour la feature/le fix

### 4. Compatibilité cross-platform

- Si endpoint modifié → vérifier Web + Mobile + Extension
- Si composant React → pas de `<div>` dans mobile
- snake_case backend ↔ camelCase frontend
- Vérifier que les imports correspondent à la plateforme

### 5. Conventions DeepSight

- Commit message format : `type(scope): description`
- Fichier dans le bon dossier (frontend/mobile/backend/extension)
- Pas de `console.log` / `print()` debug restant
- PowerShell : `;` pas `&&`

## Output

```
📋 REVIEW SUMMARY
✅ Approuvé / ⚠️ Changements suggérés / ❌ Bloquant

FINDINGS:
1. [SÉCURITÉ|PERF|BUG|STYLE] Description + suggestion
```
