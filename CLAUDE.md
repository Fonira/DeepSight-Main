# DeepSight — AI Assistant Development Guide
*Version FINALE v2 — Février 2026*

---

## 🎯 VISION STRATÉGIQUE TRI-PLATEFORME
```
┌─────────────────────────────────────────────────────────────────────┐
│  🧩 EXTENSION CHROME      📱 APP MOBILE          🖥️ APP WEB         │
│  "L'hameçon"              "Le compagnon"          "Le QG"           │
│                                                                     │
│  ► Zéro friction          ► Révision mobile       ► Travail sérieux │
│  ► Sur YouTube direct     ► Flashcards métro       ► Toutes features │
│  ► 1 clic = résumé        ► Chat rapide            ► Playlists       │
│  ► Convertit en user      ► Relire synthèses       ► Exports         │
│                                                    ► Billing/upgrade │
│  ACQUISITION ──────────► RÉTENTION ─────────────► MONÉTISATION      │
└─────────────────────────────────────────────────────────────────────┘
```

**Principe fondamental** : Un seul compte, un seul abonnement, trois interfaces.
Le backend vérifie `plan + platform` via `is_feature_available(plan, feature, platform)`.
Chaque requête API porte le header : `?platform=web|mobile|extension`

### Rôle de chaque plateforme
- **Extension Chrome** : hameçon d'acquisition. Analyse + synthèse + chat compact. Tout le reste → CTA "Ouvrir dans l'app". Ne pas bloquer, convertir.
- **App Mobile** : rétention par révision. Flashcards, relire synthèses, chat rapide. Features complexes (cartes mentales, export, recherche web) → absentes de l'UI, redirection discrète vers Web.
- **App Web** : plateforme complète. Playlists, recherche web, exports, gestion compte, Stripe. C'est là que se monétise.

---

## Project Identity

**DeepSight** est un SaaS d'analyse IA de vidéos YouTube avec épistémologie bayésienne. Synthèses intelligentes, fact-checking, outils d'étude, chat contextuel.

| Composant | Technologie | Déploiement | URL |
|-----------|-------------|-------------|-----|
| **Backend** | FastAPI + Python 3.11 | Railway | `https://deep-sight-backend-v3-production.up.railway.app` |
| **Frontend** | React 18 + TypeScript + Vite | Vercel | `https://www.deepsightsynthesis.com` |
| **Mobile** | Expo SDK 54 + React Native | EAS Build | App Store / Play Store |
| **Extension** | React + TypeScript + Webpack | dist/ MV3 | Chrome Web Store (à soumettre) |

### Communication & Positionnement
- **Tagline** : "Ne regardez plus vos vidéos. Analysez-les."
- **Différenciateur** : IA 100% Française & Européenne — propulsé par Mistral AI
- **Badge** : 🇫🇷🇪🇺 "Vos données restent en Europe"

---

## ⚠️ RÈGLES COMPORTEMENTALES (OBLIGATOIRES)

### Contrôle du scope
- **TOUJOURS demander la tâche exacte** avant de commencer
- **JAMAIS lancer typecheck/lint/build sur des parties non concernées**
- **JAMAIS corriger des problèmes hors scope** — signaler seulement
- **Rester laser-focalisé** sur la tâche demandée — pas de "tant que j'y suis"
- Si `git diff` montre beaucoup de changements non commités → **ne pas supposer qu'ils nécessitent un fix**

### Avant de commencer
1. Confirmer la tâche exacte
2. Identifier le(s) composant(s) impliqués (backend / frontend / mobile / extension)
3. Toucher uniquement les fichiers directement liés
4. Si ambigu → **demander une clarification plutôt que deviner**

### Gestion des erreurs
- Erreurs dans des fichiers non liés → **signaler, ne pas corriger**
- Ne jamais lancer d'agents parallèles pour des corrections en masse sauf demande explicite
- Préférer `eslint --fix` ciblé plutôt que corrections manuelles fichier par fichier

### Discipline de commit
- Commits atomiques après chaque changement logique
- Ne jamais laisser le codebase dans un état pire qu'à l'arrivée

---

## Repository Structure
```
DeepSight-Main/
├── backend/                    # FastAPI Python backend
│   ├── src/
│   │   ├── main.py            # Entry point + routers
│   │   ├── core/              # Config, security, credits, logging
│   │   ├── db/                # SQLAlchemy models (15+ tables)
│   │   ├── auth/              # JWT + Google OAuth
│   │   ├── videos/            # Analysis, streaming, export
│   │   ├── chat/              # Mistral contextual chat
│   │   ├── billing/           # Stripe integration
│   │   ├── playlists/         # Playlist analysis (Pro)
│   │   └── transcripts/       # YouTube extraction multi-fallback
│   └── requirements.txt
├── frontend/                   # React web application
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── services/api.ts    # API client
│   │   ├── store/             # Zustand state management
│   │   └── config/            # Plans, privileges
│   └── package.json
├── mobile/                     # React Native
│   ├── src/
│   │   ├── screens/           # 13+ screens
│   │   ├── components/
│   │   ├── services/api.ts    # Mirrors frontend
│   │   ├── contexts/          # Auth, Theme
│   │   └── navigation/        # React Navigation
│   └── package.json
├── extension/                  # Chrome Extension v2.0
│   ├── src/
│   └── dist/                  # ← Charger CE dossier dans Chrome (buildé)
├── docs/
│   └── CLAUDE-BACKEND.md
└── scripts/
```

---

## Technology Stack

### Backend (Python)
| Catégorie | Technologie |
|-----------|-------------|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (async) |
| DB | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT + Google OAuth (authlib) |
| IA | Mistral AI |
| Fact-check | Perplexity AI |
| Paiements | Stripe |
| Email | Resend |
| Monitoring | Sentry |

### Frontend + Mobile (TypeScript)
| Catégorie | Web | Mobile |
|-----------|-----|--------|
| Framework | React 18 | React Native 0.81 |
| Build | Vite 5 | Expo SDK 54 |
| Routing | React Router 6 | React Navigation 6 |
| State | Zustand + TanStack Query | Zustand + TanStack Query |
| Styling | Tailwind CSS | StyleSheet |
| Auth | - | expo-auth-session |
| Storage | - | expo-secure-store |

---

## Development Commands

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cd src && uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # localhost:5173
npm run build
npm run typecheck
npm run lint
```

### Mobile
```bash
cd mobile
npm install
npx expo start
npm run android
npm run ios
npm run typecheck
```

### Extension
```bash
cd extension
npm install
npm run build        # → dist/
npm run typecheck    # npx tsc --noEmit
# Charger dist/ dans Chrome → Extensions → Mode développeur
```

### EAS (Mobile Production)
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

---

## Critical Files Reference

### Backend
| Fichier | Rôle |
|---------|------|
| `backend/src/core/config.py` | Settings, plans, quotas, API keys |
| `backend/src/db/database.py` | SQLAlchemy models (15 tables) |
| `backend/src/auth/dependencies.py` | `get_current_user`, `require_plan` |
| `backend/src/videos/analysis.py` | Bayesian analysis prompts |
| `backend/src/transcripts/youtube.py` | Multi-fallback YouTube extraction |
| `backend/src/billing/router.py` | Stripe checkout + webhooks |

### Frontend
| Fichier | Rôle |
|---------|------|
| `frontend/src/services/api.ts` | All API calls |
| `frontend/src/store/analysisStore.ts` | Zustand state (Immer) |
| `frontend/src/config/planPrivileges.ts` | Plan features matrix |

### Mobile
| Fichier | Rôle |
|---------|------|
| `mobile/src/services/api.ts` | API client (mirrors frontend) |
| `mobile/src/contexts/AuthContext.tsx` | Auth logic + Google OAuth |
| `mobile/src/screens/AnalysisScreen.tsx` | Most complex (4 tabs) |
| `mobile/src/constants/config.ts` | API URL, Google Client ID |

---

## Authentication Flow
```
1. POST /api/auth/register → Create user + send verification email
2. POST /api/auth/login    → Returns access_token (15min) + refresh_token (7d)
3. All requests            → Header: Authorization: Bearer {access_token}
4. POST /api/auth/refresh  → New access_token
5. Google OAuth Web        → /api/auth/google/login
6. Google OAuth Mobile     → /api/auth/google/token  ⚠️ À IMPLÉMENTER
```

### FastAPI Dependencies
```python
from auth.dependencies import get_current_user, require_plan

@router.get("/protected")
async def route(user: User = Depends(get_current_user)): ...

@router.get("/pro-only")
async def route(user: User = Depends(require_plan("pro"))): ...
```

---

## Pricing Plans

| Plan | Prix | Analyses/mois | Crédits | Features clés |
|------|------|---------------|---------|---------------|
| Free | 0 | 3 | 150 | 10min max, 3j historique |
| Student | 2.99€ | 40 | 2000 | Flashcards, concept maps |
| Starter | 5.99€ | 60 | 3000 | 2h max, exports, 60j historique |
| Pro | 12.99€ | 300 | 15000 | Playlists, chat illimité, TTS |
| Team | 29.99€ | 1000 | 50000 | API access, 5 users |

---

## API Endpoints Summary
```
# Videos
POST /api/videos/analyze          # Start → task_id
GET  /api/videos/status/{task_id} # Poll status
GET  /api/videos/history          # Paginated
GET  /api/videos/summary/{id}
POST /api/videos/export           # PDF/DOCX/MD

# Chat
POST /api/chat/ask
POST /api/chat/ask/stream         # SSE
GET  /api/chat/history/{summary}

# Billing
POST /api/billing/checkout
POST /api/billing/webhook
GET  /api/billing/portal
```

---

## Code Conventions

### Python (Backend)
- **Toujours async** : `async/await` pour tout I/O
- **Type hints** : tous paramètres et retours typés
- **Pydantic v2** : valider tous les schémas requête/réponse
- **Pas de sync HTTP** : utiliser `httpx` (pas `requests`)
- **Pas de print()** : utiliser le `logger` structuré de `core/logging`
- **Pas de secrets hardcodés** : tout via `core/config.py`
```python
async def get_summary(db: AsyncSession, user_id: int, summary_id: int) -> Summary:
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
    )
    return result.scalar_one_or_none()
```

### TypeScript (Frontend + Mobile)
- **Strict mode** activé dans tsconfig
- **Interfaces** plutôt que types pour les objets
- **Functional components** uniquement
- **Custom hooks** pour la logique réutilisable
- **API sync** : garder `services/api.ts` identique entre frontend et mobile
```typescript
interface AnalysisResult {
  id: string;
  summary: string;
  concepts: Concept[];
}

const useAnalysis = (videoId: string) => {
  return useQuery({
    queryKey: ['analysis', videoId],
    queryFn: () => videoApi.getSummary(videoId),
  });
};
```

---

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
JWT_SECRET_KEY=minimum-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7
MISTRAL_API_KEY=required
PERPLEXITY_API_KEY=optional
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
FRONTEND_URL=https://www.deepsightsynthesis.com
ALLOWED_ORIGINS=https://www.deepsightsynthesis.com,http://localhost:5173,http://localhost:8081
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@deepsightsynthesis.com
```

### Frontend (.env)
```env
VITE_API_URL=https://deep-sight-backend-v3-production.up.railway.app
VITE_SENTRY_DSN=optional
```

### Mobile (constants/config.ts)
```typescript
export const API_BASE_URL = 'https://deep-sight-backend-v3-production.up.railway.app';
export const GOOGLE_CLIENT_ID = 'your-client-id.apps.googleusercontent.com';
```

---

## Infrastructure & DevOps

| Service | Détail |
|---------|--------|
| VPS Hetzner | clawdbot — 89.167.23.214 (Tailscale: 100.127.186.126) |
| MSI-PC (local) | Claude Runner — 100.111.253.5:18790 |
| OpenClaw Gateway | VPS port 18789, token: MarcellinTyronJean22 |
| Backend deploy | Railway — root: `/backend`, start: `cd src && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Frontend deploy | Vercel — root: `/frontend`, build: `npm run build`, output: `dist/` |

**OpenClaw workflow** : Telegram → Bot(VPS) → Notion → Claude Runner(MSI-PC) → Claude Code → GitHub

**OpenClaw skills** : notion-api, github, git, ssh-exec, gmail, railway, vercel, postgres, sysadmin, pr-reviewer, filesystem, telegram, whisper

**MCP connecteurs (claude.ai)** : Slack, Vercel, Notion

**Note** : NordVPN OFF quand Tailscale actif. La console web Hetzner convertit tout en majuscules → utiliser SSH.

---

## Setup Développeur

- **Abonnement** : Claude Max (plan maximal)
- **Instances** : Plusieurs fenêtres Claude Code Opus 4.6 simultanées sur MSI-PC
- **Rythme** : solo developer, 13h/jour
- **Localisation** : France (Tassin-la-Demi-Lune, Lyon)

---

## Known Issues & TODOs

### 🔴 Critique (Mobile)
- **Google OAuth** : `/api/auth/google/token` à implémenter côté backend pour échange de token mobile

### 🟡 Backend
- [ ] Redis cache pour transcripts
- [ ] Rate limiting IP pour requêtes non authentifiées
- [ ] Optimiser requêtes N+1 dans /history

### 🟡 Frontend/Mobile
- [ ] Finaliser UI Playlists
- [ ] Composant Mind Map
- [ ] TTS audio player

### 🟢 Extension
- [ ] Soumettre sur Chrome Web Store
- [ ] Tester auth sync cross-domaine en production

---

## Bayesian Analysis Features

### Marqueurs épistémiques
- **SOLIDE** — Fait établi, consensus scientifique
- **PLAUSIBLE** — Probable, nécessite confirmation
- **INCERTAIN** — Hypothèse, débat en cours
- **A VERIFIER** — Affirmation douteuse

### Modes d'analyse
```python
ANALYSIS_MODES = {
    "accessible": "Grand public, simplifié",
    "standard": "Équilibré, détaillé",
    "expert": "Technique, académique"
}
```

---

## YouTube Transcript Extraction

Système multi-fallback :
1. `youtube-transcript-api` — Rapide, rate-limited
2. `yt-dlp` — Fiable, plus lent
3. Supadata API — Backup payant, très fiable

---

## Database Models
```
Users & Auth          Content              Billing
─────────────────     ─────────────────    ─────────────────
User                  Summary              Transaction
RefreshToken          ChatMessage          Subscription
VerificationCode      Playlist

System
─────────────────
AdminLog · Notification · ApiUsage
```

---

## CORS Configuration

Origins autorisées :
- `https://www.deepsightsynthesis.com`
- `http://localhost:5173` (dev frontend)
- `http://localhost:8081` (dev Expo)

---

## Design System (Web + Mobile + Extension)

- **Dark mode first** : fond `#0a0a0f`, surfaces `#12121a`, borders `white/5%`
- **Accents** : Bleu `#3b82f6`, Violet `#8b5cf6`, Cyan `#06b6d4`
- **Typo** : Inter (body), JetBrains Mono (code)
- **Radius** : 6px (sm), 10px (md), 16px (lg)
- **Spacing** : système 4px (4, 8, 12, 16, 24, 32, 48, 64)
- **Animations** : Framer Motion (web), Reanimated 3 (mobile), transitions `200ms cubic-bezier(0.4,0,0.2,1)`
- **Glassmorphism** : `backdrop-blur-xl bg-white/5 border border-white/10`
- **Responsive** : 375px / 768px / 1280px / 1536px
- **Accessibilité** : AA minimum, aria-labels, focus management

---

## Additional Documentation

- `docs/CLAUDE-BACKEND.md` — Détails backend
- `mobile/CLAUDE.md` — Guide mobile
- `backend/README.md` — README backend

---

*Last updated: February 2026 — Version FINALE v2*
