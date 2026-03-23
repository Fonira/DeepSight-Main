---
allowed-tools: Read, Glob, Grep
description: Architecture complète du monorepo DeepSight (4 plateformes) — où mettre ce code ?
---

# Architecture DeepSight

Contexte / question : $ARGUMENTS

## Structure du monorepo
```
DeepSight-Main/
├── frontend/    # React 18 + TS + Vite → Vercel
├── mobile/      # Expo SDK 54 / React Native → EAS
├── backend/     # Python FastAPI → Hetzner VPS Docker
├── extension/   # Chrome MV3 → Chrome Web Store
├── deploy/hetzner/
└── .claude/
```

## Règles de séparation stricte
| Plateforme | Langage | UI |
|------------|---------|-----|
| `/frontend` | TypeScript | HTML5 + Tailwind |
| `/mobile` | TypeScript | `<View>`, `<Text>`, `<TouchableOpacity>` |
| `/backend` | Python 3.11+ | N/A (API JSON) |
| `/extension` | TypeScript/JS | HTML + CSS (popup/content) |

**Interdit :** `<div>` dans mobile, `<View>` dans frontend, `fs/path` côté client, lib npm dans backend.

## Communication inter-plateformes
- Base URL : `https://api.deepsightsynthesis.com`
- Auth : JWT Bearer token
- Format : `snake_case` Python ↔ `camelCase` TS

## Souscription (SSOT)
5 plans via `is_feature_available(plan, feature, platform)` côté backend.

## Déploiement
- Frontend → Vercel auto-deploy `git push main`
- Backend → SSH → git pull → rebuild Docker
- Mobile → `eas update` (OTA) ou `eas build`
- Extension → Upload ZIP Chrome Web Store

## Services externes
Mistral AI, Perplexity, Brave Search, Stripe, Resend, Cloudflare, Supadata