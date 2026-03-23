---
allowed-tools: Read, Grep, Glob, Bash(npx tsc:*), Bash(npm run typecheck:*)
description: Diagnostic et correction des erreurs TypeScript dans le monorepo DeepSight
---

# TypeScript LSP — Diagnostic

Corriger les erreurs TypeScript pour : $ARGUMENTS

## Workflow

### 1. Identifier le scope
- Frontend : `cd frontend ; npx tsc --noEmit`
- Mobile : `cd mobile ; npx tsc --noEmit` ou `npm run typecheck`
- Extension : `cd extension ; npx tsc --noEmit`

### 2. Classifier l'erreur
| Code | Type | Fix courant |
|------|------|------------|
| ts(2304) | Cannot find name | Import manquant ou type non déclaré |
| ts(2322) | Type not assignable | Cast explicite ou fix du type source |
| ts(2345) | Argument not assignable | Vérifier la signature de la fonction |
| ts(2532) | Object possibly undefined | Optional chaining `?.` ou guard `if` |
| ts(2339) | Property does not exist | Vérifier l'interface/type, ajouter la propriété |
| ts(7006) | Implicit any | Ajouter le type explicite |
| ts(18047) | Possibly null | Non-null assertion `!` ou guard clause |

### 3. Patterns de fix DeepSight
- API response : `as AnalysisResponse` après validation
- Navigation params : typer avec `NativeStackNavigationProp<RootStackParamList>`
- Event handlers : `(e: React.ChangeEvent<HTMLInputElement>)` (web) vs `(text: string)` (mobile)
- Optional props : `interface Props { title?: string }` + default dans destructuring
- Async : `Promise<ReturnType>` explicite sur les fonctions async

### 4. Règles strictes DeepSight
- ZERO `any` — toujours un type explicite
- `strict: true` dans tsconfig.json
- Pas de `@ts-ignore` sans commentaire justificatif
- Types partagés dans `types/` ou à côté du composant

### 5. Vérifier
```powershell
cd C:\Users\33667\DeepSight-Main\frontend ; npx tsc --noEmit
cd C:\Users\33667\DeepSight-Main\mobile ; npm run typecheck
```

## Output
```
🔍 ERREURS: X trouvées
✅ CORRIGÉES: Y/X
📝 DÉTAILS: [liste des fixes appliqués]
```