---
description: "Architecture complète du monorepo DeepSight (4 plateformes). TOUJOURS consulter cette skill avant de proposer du code, créer un fichier, ou modifier l'architecture."
---

# Architecture DeepSight — Monorepo

## Structure du projet

Racine : `C:\Users\33667\DeepSight-Main`

```
DeepSight-Main/
├── frontend/          # Web App — React 18 + TS + Vite → Vercel
├── mobile/            # App Mobile — Expo SDK 54 / React Native → EAS
├── backend/           # API — Python FastAPI → Hetzner VPS Docker
├── extension/         # Extension Chrome — Manifest V3 → Chrome Web Store
├── deploy/
│   └── hetzner/       # Dockerfile + Caddyfile + docker-compose.yml
├── docs/
├── scripts/
├── tests/
└── .claude/           # Config Claude Code
```

## Infrastructure Production

```
┌────────────────┐    ┌──────────────────────────────┐    ┌──────────────┐
│    Vercel      │    │   Hetzner VPS (clawdbot)     │    │   EAS/Expo   │
│  Frontend Web  │───>│   api.deepsightsynthesis.com  │<───│   Mobile     │
│  React 18 + TS │    │                               │    │   SDK 54     │
└────────────────┘    │  Caddy (SSL) → FastAPI :8080  │    └──────────────┘
                      │  PostgreSQL 17 + Redis 7      │
┌────────────────┐    │                               │
│ Chrome Web     │───>│  4 containers Docker          │
│ Store Extension│    │  Réseau: repo_deepsight       │
└────────────────┘    └──────────────────────────────┘
```

**Toutes les plateformes appellent : `https://api.deepsightsynthesis.com`**

## Règles impératives

### 1. Identifier le contexte AVANT de coder
- Utiliser `<div>` dans `/mobile` → crash
- Utiliser `<View>` dans `/frontend` → crash
- Importer `fs/path` dans du code client → crash
- Utiliser une lib npm dans `/backend` (Python) → crash

### 2. Séparation stricte des plateformes

| Plateforme | Langage | Runtime | UI |
|------------|---------|---------|-----|
| `/frontend` | TypeScript | Node/Browser | HTML5 + Tailwind |
| `/mobile` | TypeScript | React Native | `<View>`, `<Text>`, `<TouchableOpacity>` |
| `/backend` | Python 3.11+ | FastAPI/Uvicorn | N/A (API JSON) |
| `/extension` | TypeScript/JS | Chrome APIs | HTML + CSS (popup/content scripts) |

### 3. Communication inter-plateformes
- **Base URL prod** : `https://api.deepsightsynthesis.com`
- **Auth** : JWT Bearer token dans header Authorization
- **Format** : JSON partout, `snake_case` côté Python, `camelCase` côté TS

### 4. Système de souscription (SSOT)
5 plans gérés par `is_feature_available(plan, feature, platform)` côté backend :

| Plan | Prix | Cible |
|------|------|-------|
| Découverte | Gratuit | Acquisition |
| Étudiant | 2.99/mois | Étudiants |
| Starter | 5.99/mois | Usage régulier |
| Pro | 12.99/mois | Professionnels |
| Équipe | 29.99/mois | Teams |

Stripe en live mode. Vérification des features TOUJOURS côté backend.

### 5. Stratégie de déploiement

| Plateforme | Service | Méthode |
|-----------|---------|---------|
| Frontend | Vercel | Auto-deploy sur `git push main` |
| Backend | Hetzner VPS Docker | Manuel : SSH → git pull → rebuild Docker |
| Mobile | EAS Build + Submit | `eas update` (OTA) ou `eas build` (natif) |
| Extension | Chrome Web Store | Upload manuel du ZIP |

### 6. Services externes
- **Mistral AI** : Synthèse et analyse de vidéos
- **Perplexity** : Fact-checking enrichi
- **Brave Search** : Recherche complémentaire
- **Stripe** : Paiements (live mode)
- **Resend** : Emails transactionnels
- **Cloudflare** : DNS (deepsightsynthesis.com → Hetzner)
- **Supadata** : Extraction transcripts YouTube (prioritaire)