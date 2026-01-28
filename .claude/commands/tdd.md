---
allowed-tools: Read, Grep, Glob, Bash(npm test:*), Bash(npm run typecheck:*), Write, Edit
description: Workflow TDD complet pour implémenter une feature
---

# Workflow TDD Strict

Implémente la feature suivante en utilisant TDD : $ARGUMENTS

## Étapes obligatoires

### 1. Analyse (RED)
- Comprends les exigences de la feature
- Identifie les fichiers à créer/modifier
- Écris les tests AVANT le code

### 2. Tests (RED)
```bash
# Crée les fichiers de test dans __tests__/
# Exécute-les pour confirmer qu'ils ÉCHOUENT
cd mobile && npm test -- --testPathPattern="<nom_du_test>"
```

### 3. Implémentation (GREEN)
- Écris le code MINIMAL pour faire passer les tests
- Pas d'optimisation prématurée
- Pas de features non demandées

### 4. Vérification (GREEN)
```bash
cd mobile && npm run typecheck
cd mobile && npm test
```

### 5. Refactoring (REFACTOR)
- Améliore le code sans casser les tests
- Supprime les duplications
- Améliore la lisibilité

## Règles absolues
- Ne JAMAIS modifier un test pour le faire passer
- Chaque test doit avoir un nom descriptif
- Utiliser le pattern AAA (Arrange, Act, Assert)
- Couverture minimum : 80%

## Output attendu
Quand tous les tests passent, affiche :
```
✅ TDD COMPLETE
- Tests créés : X
- Tests passés : X/X
- Couverture : XX%
```
