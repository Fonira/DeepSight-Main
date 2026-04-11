# Mobile DeepSight — Contexte Claude

## Stack
Expo SDK 54 + React Native 0.81 + React 19 + TypeScript strict.
Déployé via EAS Build (App Store ascAppId: 6740487498 + Play Store).

## Rôle stratégique
L'app mobile est le **compagnon de rétention**. Révision en déplacement.
Features : analyse vidéo, flashcards, quiz, chat rapide, Quick Chat, Tournesol, historique.
Features complexes (mind maps, export, playlists, web search, debate) → absentes de l'UI ou CTA vers web.

## Structure
| Dossier | Rôle | Fichiers clés |
|---------|------|---------------|
| `app/` | Expo Router v2 (file-based routing) | `(auth)/`, `(tabs)/`, `_layout.tsx` |
| `app/(tabs)/` | Onglets principaux | `index.tsx` (Home), `library.tsx`, `study.tsx`, `profile.tsx`, `subscription.tsx` |
| `app/(tabs)/analysis/` | Détail analyse | `[id].tsx` (4 tabs) |
| `src/components/` | 110+ composants | Sous-dossiers : `analysis/`, `chat/`, `study/`, `ui/`, `tournesol/`, `backgrounds/` |
| `src/services/api.ts` | Client API (1722 lines — mirror du frontend) | Modules : authApi, videoApi, chatApi, billingApi, studyApi, etc. |
| `src/contexts/` | 8 React Contexts | `AuthContext.tsx`, `PlanContext.tsx`, `ThemeContext.tsx`, `ErrorContext.tsx`, `OfflineContext.tsx` |
| `src/stores/` | Zustand stores | `analysisStore.ts`, `studyStore.ts`, `authStore.ts` |
| `src/hooks/` | 9 custom hooks | — |
| `src/theme/` | Design system | Colors, spacing, typography, shadows |
| `src/constants/config.ts` | Config | API URL, Google Client IDs (web, Android, iOS), timeouts |
| `src/types/` | TypeScript definitions | — |
| `src/i18n/` | FR + EN | — |

## Conventions obligatoires
- **Expo Router v2** (file-based routing dans `app/`)
- **StyleSheet.create** pour tous les styles (pas de Tailwind en RN)
- **react-native-reanimated 4.1** pour les animations
- **@shopify/flash-list** pour les listes longues (pas FlatList)
- **expo-secure-store** pour les tokens, **AsyncStorage** pour le reste
- **@gorhom/bottom-sheet** pour les bottom sheets
- TypeScript strict, zéro `any`
- Tester la compatibilité iOS ET Android

## Auth
```typescript
// Contexte : src/contexts/AuthContext.tsx
// Google OAuth : @react-native-google-signin + expo-auth-session
// Flow : Google token → POST /api/auth/google/token → JWT session
// Tokens stockés dans expo-secure-store
```

## Feature gating
```typescript
// src/contexts/PlanContext.tsx
// Vérifie plan + platform=mobile via l'API
// Les features non disponibles affichent un CTA vers l'app web
```

## API sync ⚠️
`src/services/api.ts` doit rester **synchronisé** avec `frontend/src/services/api.ts`.
Mêmes endpoints, mêmes types de retour. Si on ajoute un endpoint au frontend, l'ajouter aussi ici.

## Build & test
```bash
npx expo start              # Dev server (Expo Go)
npx expo start --clear      # Avec cache clear
npm run typecheck            # tsc --noEmit
npm run test                 # Jest + Testing Library RN
eas build --platform ios --profile production    # Build prod iOS
eas build --platform android --profile production # Build prod Android
eas update                   # OTA update (sans rebuild)
```

## ⚠️ Pièges courants
- `expo-secure-store` a des limites de taille (2048 bytes par clé) — ne pas stocker de gros objets
- Expo Go ne supporte pas tous les modules natifs — tester sur un dev build si besoin
- Les images SVG nécessitent `react-native-svg` + `react-native-svg-transformer`
- Le hot reload peut casser l'état des contexts → redémarrer le serveur si comportement bizarre

*Mis à jour : avril 2026*
