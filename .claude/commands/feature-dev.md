---
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(npm:*), Bash(npx:*), Bash(git:*), Bash(pytest:*)
description: Workflow complet pour développer une feature DeepSight — plan, code, test, commit
---

# Feature Development

Développer la feature : $ARGUMENTS

## Workflow obligatoire

### 1. Analyse & Plan
- Identifier les plateformes impactées (Web? Mobile? Backend? Extension?)
- Lister les fichiers à créer/modifier
- Vérifier si la feature est gated (quel plan minimum ?)
- Proposer le plan et ATTENDRE validation

### 2. Backend d'abord (si API nécessaire)
- Créer le endpoint FastAPI (`/api/v1/...`)
- Modèle Pydantic Request/Response
- `is_feature_available()` si feature gated
- Test Pytest pour le endpoint

### 3. Frontend / Mobile
- Appel API via service/hook existant
- Composant UI adapté à la plateforme
- `<FeatureGate>` si feature payante
- Gestion erreurs (401, 403, 500)

### 4. Extension Chrome (si concernée)
- Communication via `chrome.runtime.sendMessage`
- Fetch depuis service worker uniquement

### 5. Analytics
- `posthog.capture()` pour les events clés
- Nomenclature `objet_action` snake_case

### 6. Validation
```powershell
cd C:\Users\33667\DeepSight-Main\backend ; python -m pytest tests/ -v
cd C:\Users\33667\DeepSight-Main\frontend ; npx vitest run
cd C:\Users\33667\DeepSight-Main\mobile ; npx jest
```

### 7. Commit
```powershell
git checkout -b feat/nom-feature
git add . ; git commit -m "feat(scope): description"
git push origin feat/nom-feature
```

## Règles : code production-ready, types stricts, edge cases gérés, compatibilité cross-platform vérifiée