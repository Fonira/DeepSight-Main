---
allowed-tools: Read, Edit, Write, Bash(npm test:*), Bash(npx vitest:*), Bash(npx playwright:*), Bash(pytest:*), Grep, Glob
description: Écrire et exécuter des tests DeepSight — Pytest, Vitest, Playwright, Jest, Maestro
---

# Tests DeepSight

Écrire des tests pour : $ARGUMENTS

## Pyramide : unitaire (fonctions pures) → intégration (endpoints, hooks) → E2E (flux critiques)

## 1. Backend — Pytest
```powershell
cd C:\Users\33667\DeepSight-Main\backend
python -m pytest tests/ -v
python -m pytest tests/ --cov=app --cov-report=html -v
```
Pattern : conftest.py (fixtures client/db/auth), mocker.patch services externes, assert status_code + JSON.

## 2. Frontend — Vitest
```powershell
cd C:\Users\33667\DeepSight-Main\frontend
npx vitest run
npx vitest run --coverage
```
Pattern : @testing-library/react, MSW pour mock API, vi.fn() pour handlers.

## 3. E2E Web — Playwright
```powershell
cd C:\Users\33667\DeepSight-Main\frontend
npx playwright test
npx playwright test --ui
```
Flux P0 : auth, analysis, subscription. Attributs `data-testid` obligatoires.

## 4. Mobile — Jest + Maestro
```powershell
cd C:\Users\33667\DeepSight-Main\mobile
npx jest
maestro test maestro/flows/
```
Composants RN uniquement. jest.mock() pour services.

## Règles : jamais DB prod, toujours mocker Mistral/Perplexity/Stripe, data-testid sur éléments interactifs, 80% coverage sur subscriptions.py