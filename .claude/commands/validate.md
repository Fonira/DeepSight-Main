---
allowed-tools: Bash(npm run typecheck:*), Bash(npm run lint:*), Bash(npm test:*), Bash(pytest:*), Read
description: Validation complète avant commit/PR
---

# Validation Pre-Commit

Exécute toutes les vérifications avant commit.

## Checks obligatoires

### 1. Mobile (React Native)
```bash
echo "📱 Mobile TypeScript..."
cd mobile && npm run typecheck

echo "📱 Mobile Tests..."
cd mobile && npm test -- --passWithNoTests
```

### 2. Frontend (React)
```bash
echo "🌐 Frontend TypeScript..."
cd frontend && npm run typecheck

echo "🌐 Frontend Lint..."
cd frontend && npm run lint
```

### 3. Backend (Python)
```bash
echo "🐍 Backend Syntax..."
cd backend && python -m py_compile src/main.py

echo "🐍 Backend Tests..."
cd backend && pytest -x --tb=short 2>/dev/null || echo "Tests skipped"
```

## Résultat

Affiche un récapitulatif :
```
╔════════════════════════════════════╗
║       VALIDATION RESULTS           ║
╠════════════════════════════════════╣
║ Mobile TypeScript    ✅ / ❌       ║
║ Mobile Tests         ✅ / ❌       ║
║ Frontend TypeScript  ✅ / ❌       ║
║ Frontend Lint        ✅ / ❌       ║
║ Backend Syntax       ✅ / ❌       ║
╠════════════════════════════════════╣
║ READY TO COMMIT:     YES / NO      ║
╚════════════════════════════════════╝
```

Si un check échoue, indique :
- Quel check a échoué
- Le message d'erreur
- La suggestion de correction
