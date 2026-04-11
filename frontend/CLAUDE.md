# Frontend DeepSight — Contexte Claude

## Stack
React 18 + TypeScript strict + Vite 5 + Tailwind CSS 3.
Déployé sur Vercel (auto-deploy on `git push origin main`).

## Structure src/
| Dossier | Rôle | Fichiers clés |
|---------|------|---------------|
| `pages/` | 25 pages (React Router 6, lazy loading) | `DashboardPage.tsx` (hub principal, 60KB), `History.tsx` (virtual scroll, 131KB), `LandingPage.tsx` |
| `components/` | 85+ composants réutilisables, sous-dossiers thématiques | `AnalysisHub/`, `ChatPanel.tsx`, `ChatPopup.tsx`, `TournesolTrendingSection.tsx` |
| `services/` | Client API centralisé | `api.ts` (2051 lines — TOUTES les calls API) |
| `store/` | State management Zustand (Immer + persist) | `analysisStore.ts` (436 lines), `studyStore.ts` |
| `contexts/` | React Contexts | `AuthContext.tsx`, `ThemeContext.tsx`, `LanguageContext.tsx`, `BackgroundAnalysisContext.tsx`, `TTSContext.tsx`, `DayNightContext.tsx`, `LoadingWordContext.tsx` |
| `config/` | Plans & feature flags | `planPrivileges.ts` (400 lines — matrice features/plans) |
| `hooks/` | Custom hooks réutilisables | — |
| `types/` | TypeScript definitions | `analysis.ts` (customization v4, 322 lines) |
| `i18n/` | Traductions FR + EN | — |
| `lib/` | Utilitaires bas niveau | — |
| `styles/` | Styles globaux | — |

## Conventions obligatoires
- **TypeScript strict** : zéro `any`, interfaces pour les objets
- **Functional components** uniquement (pas de class components)
- **Tailwind CSS** pour tout le styling — pas de CSS modules/styled-components
- **Dark mode first** : fond `#0a0a0f`, surfaces `#12121a`, borders `white/5%`
- **Glassmorphism** : `backdrop-blur-xl bg-white/5 border border-white/10`
- **Framer Motion** pour les animations
- **React Router 6** avec lazy loading pour les pages

## State management
- **Zustand** (Immer middleware) pour le state global (analysis, study)
- **TanStack Query 5** pour le data fetching/cache serveur
- **React Context** pour l'auth, le thème, la langue

## API calls
Toujours passer par `services/api.ts`. Pattern :
```typescript
import { api } from '../services/api';
// api.analyzeVideo(), api.getChatHistory(), etc.
```
Ne jamais faire de `fetch()` direct — tout est centralisé dans api.ts.

## Feature gating (frontend)
```typescript
import { canAccess } from '../config/planPrivileges';
// Vérifier avant d'afficher une feature
if (!canAccess(user.plan, 'web_search', 'web')) {
  // Afficher CTA upgrade
}
```

## Design tokens
- **Accents** : Indigo `#6366f1`, Violet `#8b5cf6`, Cyan `#06b6d4`, Bleu `#3b82f6`
- **Typo** : Inter (body), JetBrains Mono (code)
- **Radius** : 6px (sm), 10px (md), 16px (lg)
- **Spacing** : système 4px (4, 8, 12, 16, 24, 32, 48, 64)
- **Responsive** : 375px / 768px / 1280px / 1536px

## Tests
- **Unit** : Vitest + Testing Library → `npm run test`
- **E2E** : Playwright (6 specs dans `e2e/`) → `npx playwright test`
- **Typecheck** : `npm run typecheck` (tsc --noEmit)
- **Lint** : `npm run lint` (ESLint)

## Build
```bash
npm run dev       # Dev server localhost:5173
npm run build     # Production build
npm run preview   # Preview production build
```

## ⚠️ Fichiers à ne pas toucher sans raison
- `services/api.ts` : doit rester synchronisé avec mobile/src/services/api.ts et extension
- `config/planPrivileges.ts` : SSOT frontend des features — backend est la source de vérité
