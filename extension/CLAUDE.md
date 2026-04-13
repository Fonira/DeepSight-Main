# Extension Chrome DeepSight — Contexte Claude

## Stack

Chrome Manifest V3 + React + TypeScript + Webpack 5 (5 entry points).
Le manifest est généré/copié dans `dist/` au build.

## Rôle stratégique

L'extension est **l'hameçon d'acquisition**. Elle doit rester légère et rapide.
Features disponibles : analyse + synthèse + chat compact + Quick Chat.
Tout le reste → CTA "Ouvrir dans l'app web". Ne pas bloquer, convertir.

## Structure src/

| Fichier/Dossier       | Rôle                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| `background.ts`       | Service worker MV3 (558 lines) — API calls, auth, message handling             |
| `content.ts`          | Content script injecté sur YouTube/TikTok (800+ lines) — injection DOM sidebar |
| `content/`            | Modules du content script                                                      |
| `popup/components/`   | UI React du popup                                                              |
| → `MainView.tsx`      | Vue principale (538 lines)                                                     |
| → `ChatDrawer.tsx`    | Interface chat                                                                 |
| → `SynthesisView.tsx` | Affichage synthèse                                                             |
| → `LoginView.tsx`     | Login/register                                                                 |
| → `PromoBanner.tsx`   | Banner promotion                                                               |
| `authSync/`           | Synchronisation auth avec l'app web                                            |
| `authSyncMain/`       | Auth sync côté main                                                            |
| `utils/config.ts`     | API URL, Google Client ID                                                      |
| `utils/storage.ts`    | Helpers chrome.storage.local                                                   |
| `utils/video.ts`      | Détection video ID (YouTube + TikTok)                                          |
| `types/`              | TypeScript interfaces (205 lines)                                              |
| `i18n/`               | FR + EN                                                                        |
| `styles/`             | CSS                                                                            |

## Conventions obligatoires

- **Manifest V3** uniquement (pas de MV2 patterns)
- **chrome.storage.local** pour le stockage (pas localStorage)
- **chrome.identity** pour Google OAuth (`launchWebAuthFlow`)
- **Message passing** : `chrome.runtime.sendMessage` / `onMessage` entre popup ↔ background ↔ content
- Le content script envoie **uniquement le video ID** au background → l'API fait le scraping server-side
- **Pas d'injection de scripts externes** (CSP MV3)
- TypeScript strict, zéro `any`

## Auth flow

1. Login via popup → background.ts appelle `/api/auth/login`
2. Tokens stockés dans `chrome.storage.local`
3. Refresh automatique via background.ts
4. Sync avec l'app web via `authSync/`

## Build & test

```bash
npm run build     # → dist/ (charger ce dossier dans chrome://extensions)
npm run dev       # Watch mode
npm run typecheck # tsc --noEmit
```

Pour tester : chrome://extensions → Mode développeur → Charger l'extension non empaquetée → sélectionner `dist/`.

## ⚠️ Pièges courants

- Le service worker MV3 peut être tué à tout moment → pas de state en mémoire, tout dans chrome.storage
- Les content scripts n'ont pas accès aux APIs chrome.\* (sauf chrome.runtime.sendMessage)
- Les permissions doivent être déclarées dans le manifest — les ajouter dans le code ne suffit pas
