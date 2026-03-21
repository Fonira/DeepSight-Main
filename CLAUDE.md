# DeepSight — AI Assistant Development Guide
*Version 3.0 — Mars 2026*

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
- **Extension Chrome** : hameçon d'acquisition. Analyse + synthèse + chat compact + Quick Chat. Tout le reste → CTA "Ouvrir dans l'app". Ne pas bloquer, convertir.
- **App Mobile** : rétention par révision. Flashcards, relire synthèses, chat rapide, Quick Chat. Features complexes (cartes mentales, export, recherche web) → absentes de l'UI, redirection discrète vers Web.
- **App Web** : plateforme complète. Playlists, recherche web, exports, gestion compte, Stripe, académique, mind maps. C'est là que se monétise.

---

## Project Identity

**DeepSight** est un SaaS d'analyse IA de vidéos YouTube & TikTok avec analyse sourcée et nuancée. Synthèses intelligentes, fact-checking, outils d'étude, chat contextuel, recherche académique.

| Composant | Technologie | Déploiement | URL |
|-----------|-------------|-------------|-----|
| **Backend** | FastAPI + Python 3.11 | Hetzner VPS (Docker) | `https://api.deepsightsynthesis.com` |
| **Frontend** | React 18 + TypeScript + Vite (v7.0.1) | Vercel | `https://www.deepsightsynthesis.com` |
| **Mobile** | Expo SDK 54 + React Native 0.81 + React 19 | EAS Build | App Store / Play Store |
| **Extension** | React + TypeScript + Webpack (MV3 v2.0) | dist/ | Chrome Web Store (à soumettre) |

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
│   │   ├── main.py            # Entry point + 14 routers (1081 lines)
│   │   ├── core/              # Config, security, credits, logging
│   │   ├── db/                # SQLAlchemy models (23 tables)
│   │   ├── auth/              # JWT + Google OAuth + sessions
│   │   ├── videos/            # Analysis v6, streaming, export, discovery
│   │   ├── chat/              # Mistral contextual chat v4.0 + Perplexity
│   │   ├── billing/           # Stripe integration (checkout, webhooks, portal, API keys)
│   │   ├── playlists/         # Playlist analysis v4.1 + corpus
│   │   ├── transcripts/       # YouTube extraction 7-method multi-fallback
│   │   ├── study/             # Flashcards, quiz, mind maps, spaced repetition
│   │   ├── academic/          # Papers search (arXiv, Crossref, Semantic Scholar, OpenAlex)
│   │   ├── tournesol/         # Proxy API Tournesol (CORS contournement)
│   │   ├── history/           # Paginated history + semantic search
│   │   ├── admin/             # Stats, users, backup, logs
│   │   ├── analytics/         # Events tracking
│   │   ├── batch/             # Batch analyses
│   │   ├── notifications/     # SSE + Push tokens
│   │   └── search/            # Semantic search (embeddings)
│   └── requirements.txt
├── frontend/                   # React web application (v7.0.1)
│   ├── src/
│   │   ├── pages/             # 22 pages (public + protégées)
│   │   ├── components/        # 85+ composants réutilisables
│   │   ├── services/api.ts    # API client (2051 lines)
│   │   ├── store/             # Zustand state management (Immer + persist)
│   │   ├── config/            # Plans, privileges, feature flags
│   │   ├── contexts/          # Auth, Theme, Language, LoadingWord, BackgroundAnalysis
│   │   ├── hooks/             # 10+ custom hooks
│   │   ├── types/             # TypeScript definitions (analysis v4, study, api)
│   │   └── i18n/              # FR + EN translations
│   ├── e2e/                   # Playwright E2E tests (6 specs)
│   └── package.json
├── mobile/                     # React Native (Expo SDK 54)
│   ├── app/                   # Expo Router v2 (file-based routing)
│   │   ├── (auth)/            # Login, register, verify, forgot-password
│   │   ├── (tabs)/            # Home, library, study, profile, subscription
│   │   └── _layout.tsx        # Root layout + providers
│   ├── src/
│   │   ├── components/        # 110+ composants (analysis, chat, study, ui, tournesol)
│   │   ├── services/api.ts    # API client (1722 lines, mirrors frontend)
│   │   ├── contexts/          # 8 contexts (Auth, Theme, Plan, Error, Offline, etc.)
│   │   ├── hooks/             # 9 custom hooks
│   │   ├── stores/            # Zustand (auth, analysis, study)
│   │   ├── theme/             # Colors, spacing, typography, shadows
│   │   ├── types/             # TypeScript definitions
│   │   └── constants/         # Config, API URL, Google Client IDs
│   └── package.json
├── extension/                  # Chrome Extension v2.0 (Manifest V3)
│   ├── src/
│   │   ├── background.ts      # Service worker (558 lines)
│   │   ├── content.ts         # YouTube/TikTok DOM injection (800+ lines)
│   │   ├── popup/components/  # 6 React components
│   │   ├── utils/             # Config, storage, video detection, sanitize
│   │   ├── types/             # TypeScript interfaces (205 lines)
│   │   └── i18n/              # FR + EN
│   └── dist/                  # ← Charger CE dossier dans Chrome (buildé)
├── deploy/
│   └── hetzner/
│       ├── Dockerfile         # Python 3.11 + ffmpeg + weasyprint deps
│       ├── docker-compose.yml # PostgreSQL + Redis + Backend + Caddy
│       └── caddy/Caddyfile    # Reverse proxy + auto-SSL
├── docs/                      # Architecture, API, deploy, monitoring docs
├── scripts/                   # Git-push, test, backup helpers
├── .github/workflows/         # 11 CI/CD workflows
├── .secrets/                  # SSH keys (gitignored)
└── Makefile                   # test-all, test-backend, etc.
```

---

## Technology Stack

### Backend (Python)
| Catégorie | Technologie |
|-----------|-------------|
| Framework | FastAPI (async, 4 workers) |
| ORM | SQLAlchemy 2.0 (async) + Alembic migrations |
| DB | PostgreSQL 17 (prod Hetzner) / SQLite (dev) |
| Cache | Redis 7 + cachetools LRU |
| Auth | JWT + Google OAuth (authlib) + session management |
| IA Analyse | Mistral AI (4 tiers: ministral-8b → mistral-large-2512) |
| IA Chat | Mistral AI + Perplexity enrichment (v4.0) |
| Fact-check | Perplexity AI + Brave Search |
| Paiements | Stripe (checkout, webhooks, portal, API keys) |
| Email | Resend |
| Monitoring | Sentry |
| Exports | ReportLab (PDF) + python-docx + WeasyPrint + openpyxl |
| Backup | S3/R2 (Cloudflare) + APScheduler cron |
| HTTP | httpx[http2] + aiohttp |
| YouTube | Supadata (prioritaire) → youtube-transcript-api → Invidious → Piped → yt-dlp → STT |

### Frontend (TypeScript — React 18)
| Catégorie | Technologie |
|-----------|-------------|
| Build | Vite 5, ES2020 target, code splitting |
| Routing | React Router 6 (lazy loading) |
| State | Zustand (Immer + persist) + TanStack Query 5 |
| Styling | Tailwind CSS 3 |
| Animations | Framer Motion 12 |
| Charts | Recharts 3 |
| Graphs | @xyflow/react + Cytoscape (mind maps) |
| Analytics | PostHog (RGPD) |
| Tests | Vitest + Testing Library + Playwright E2E |

### Mobile (TypeScript — Expo SDK 54)
| Catégorie | Technologie |
|-----------|-------------|
| Framework | React Native 0.81 + React 19 |
| Routing | Expo Router v2 (file-based) |
| State | Zustand + TanStack Query 5 |
| Auth | @react-native-google-signin + expo-auth-session |
| Storage | AsyncStorage + expo-secure-store |
| Animations | react-native-reanimated 4.1 |
| Lists | @shopify/flash-list |
| UI | @gorhom/bottom-sheet, expo-blur, expo-linear-gradient |
| Tests | Jest + Testing Library RN |

### Extension Chrome (TypeScript — Manifest V3)
| Catégorie | Technologie |
|-----------|-------------|
| Build | Webpack 5 (5 entry points) |
| UI | React + custom components |
| Auth | chrome.identity (Google OAuth) + JWT |
| Storage | chrome.storage.local |
| Tests | Jest + jsdom |

---

## API Endpoints (14 routers, 100+ endpoints)

### Auth (`/api/auth`)
```
POST   /register, /login, /refresh, /logout
DELETE /account
POST   /verify-email, /resend-verification
POST   /forgot-password, /reset-password, /change-password
GET    /me, /quota, /limits
PUT    /preferences
GET    /google/login, /google/callback
POST   /google/callback, /google/token   ⚠️ Mobile OAuth
```

### Videos (`/api/videos`)
```
POST   /analyze                    # Analyse principale
GET    /status/{task_id}           # Poll status
GET    /{summary_id}               # Get analyse
PUT    /{summary_id}               # Update
DELETE /{summary_id}               # Delete
GET    /history                    # Paginated
GET    /history/favorites          # Favorites
DELETE /history/all                # Clear all
GET    /check-cache/{video_id}     # Cache check
POST   /quick-chat                 # Quick Chat (0 crédits)
GET    /guest-demo                 # Guest mode (3/jour)
POST   /extension-summary          # Extension-optimized
GET    /info/{video_id}            # Video metadata
GET    /stats                      # User stats
GET    /models/available           # Models par plan
```

### Chat (`/api/chat`)
```
POST   /ask                        # Chat v4.0 (Perplexity enrichissement)
POST   /ask/stream                 # Streaming SSE
GET    /history/{summary_id}       # Chat history
DELETE /history/{summary_id}       # Clear history
GET    /quota, /{summary_id}/quota # Quotas
```

### Billing (`/api/billing`)
```
GET    /plans, /my-plan, /info, /subscription-status
POST   /create-checkout, /confirm-checkout
GET    /portal                     # Stripe portal
POST   /change-plan, /cancel, /reactivate
POST   /webhook                    # Stripe webhook
GET    /trial-eligibility
POST   /start-pro-trial
GET    /transactions
POST   /api-key/generate, /api-key/regenerate
DELETE /api-key
```

### Playlists (`/api/playlists`)
```
POST   /analyze, /corpus/analyze, /chat
GET    /status/{task_id}
GET    /{playlist_id}/videos, /{playlist_id}/summary
DELETE /{playlist_id}
```

### Study (`/api/study`)
```
GET/POST /{summary_id}/flashcards
GET      /{summary_id}/quiz
POST     /{summary_id}/quiz/answer
GET      /{summary_id}/mindmap
GET      /spaced-repetition/{user_id}
```

### Academic (`/api/academic`)
```
POST   /search, /enrich/{summary_id}, /export
GET    /papers/{summary_id}, /formats
```

### Exports (`/api/exports`)
```
POST   /                          # Export (PDF/DOCX/MD/XLSX)
GET    /{summary_id}/{format}     # Direct download
GET    /formats, /pdf-options
```

### History (`/api/history`)
```
GET    /videos, /videos/{id}, /playlists, /playlists/{id}
GET    /search, /search/semantic, /stats
```

### Admin (`/api/admin`)
```
GET    /stats, /users, /users/{id}, /logs
PUT    /users/{id}
POST   /users/{id}/credits, /backup/trigger, /reset-monthly-credits
DELETE /users/{id}
```

### Tournesol (`/api/tournesol`)
```
GET    /video/{video_id}           # Score Tournesol
POST   /search                     # Recherche Tournesol
GET    /recommendations            # Top recommandations
GET    /recommendations/raw        # Proxy passthrough (CORS)
GET    /batch                      # Batch scores (max 20)
```

### Autres
```
POST   /api/analytics/events       # Tracking
POST   /api/batch/analyze           # Batch analyses
GET    /api/notifications/sse/{id}  # SSE stream
POST   /api/search/semantic         # Semantic search
```

---

## Database Models (23 tables)

### Core
| Table | Rôle |
|-------|------|
| **User** | Utilisateurs (email, google_id, plan, credits, stripe_customer_id) |
| **Summary** | Analyses vidéo (video_id, content, platform, full_digest, deep_research) |
| **RefreshToken** | Sessions JWT (token_hash, expires_at) |

### Content & Study
| Table | Rôle |
|-------|------|
| **ChatMessage** | Messages chat (role, content, web_search_used) |
| **ChatQuota** | Quota chat par vidéo |
| **PlaylistAnalysis** | Analyses playlist (results_json) |
| **PlaylistChatMessage** | Chat playlist |
| **VideoChunk** | Segments vidéo long |
| **VideoComparison** | Comparaisons 2 vidéos |
| **AcademicPaper** | Papiers académiques (arxiv_id, metadata) |
| **SharedAnalysis** | Analyses partagées (share_token) |

### Transcripts & Search
| Table | Rôle |
|-------|------|
| **TranscriptCache** | Cache L2 persistent (video_id, platform, char_count) |
| **TranscriptCacheChunk** | Chunks cache |
| **TranscriptEmbedding** | Embeddings sémantiques |

### Billing & Usage
| Table | Rôle |
|-------|------|
| **DailyQuota** | Quotas journaliers |
| **CreditTransaction** | Historique crédits |
| **WebSearchUsage** | Usage recherche web |

### System
| Table | Rôle |
|-------|------|
| **TaskStatus** | Tâches asynchrones |
| **ApiUsage** | Tracking API calls |
| **AnalyticsEvent** | Events tracking |
| **PushToken** | Tokens FCM mobile |
| **AdminLog** | Logs admin |
| **ApiStatus** | Status services |

---

## Pricing Plans (4 tiers actifs)

| Plan | ID interne | Prix | Analyses/mois | Crédits | Max durée | Chat/vidéo | Features clés |
|------|-----------|------|---------------|---------|-----------|------------|---------------|
| Gratuit | free | 0€ | 5 | 250 | 15min | 5 | Historique 60j |
| Étudiant | etudiant | 2.99€ | 20 | 2000 | 45min | 15 | Flashcards, mind maps |
| Starter | starter | 5.99€ | 50 | 3000 | 2h | 25 | Recherche web IA |
| Pro | pro | 12.99€ | 200 | 15000 | 4h | illimité | Playlists, export PDF, web search illimité |

### Modèles Mistral par plan
- **Free/Étudiant** : mistral-small-2603
- **Pro** : mistral-medium-2508
- **Expert (legacy)** : mistral-large-2512 (262K context)

---

## YouTube Transcript Extraction (7 méthodes, 3 phases)

**Phase 0** : Supadata API (PRIORITAIRE, payant, fiable)

**Phase 1** (parallèle) : youtube-transcript-api + Invidious (10 instances) + Piped (8 instances)

**Phase 2** (séquentiel) : yt-dlp manual subtitles + yt-dlp auto-captions

**Phase 3** (audio STT fallback) : Groq Whisper → OpenAI Whisper → Deepgram Nova-2 → AssemblyAI

**Features** : Circuit Breaker, Exponential Backoff, Health Check Instance Manager, User-Agent rotation, DB Cache L2 persistent, 12+ langues supportées.

---

## Authentication Flow
```
1. POST /api/auth/register → Create user + send verification email (Resend)
2. POST /api/auth/login    → Returns access_token (15min) + refresh_token (7d)
3. All requests            → Header: Authorization: Bearer {access_token}
4. POST /api/auth/refresh  → New access_token (rotation)
5. Google OAuth Web        → /api/auth/google/login → callback
6. Google OAuth Mobile     → /api/auth/google/token  ⚠️ Backend endpoint existe mais incomplet
7. Extension               → chrome.identity.launchWebAuthFlow() + sync tokens
```

---

## Chat v4.0 (Perplexity Enrichissement)

| Plan | Daily | Per-video | Web Search | Model |
|------|-------|-----------|-----------|-------|
| Free | 10 | 5 | ✗ | small |
| Étudiant | 40 | 15 | ✗ | small |
| Pro | 100 | illimité | ✓ | large |

- Auto-enrichissement selon plan (none/light/full/deep)
- Détection intelligente quand web search est pertinent
- Sources web dans réponses
- Streaming SSE support

---

## Critical Files Reference

### Backend
| Fichier | Rôle | Taille |
|---------|------|--------|
| `backend/src/main.py` | Entry point + 14 routers | 1081 lines |
| `backend/src/core/config.py` | Settings, plans, quotas, API keys, models Mistral | — |
| `backend/src/db/database.py` | SQLAlchemy models (23 tables) | — |
| `backend/src/videos/router.py` | Analysis v6, streaming, discovery | 3959 lines |
| `backend/src/videos/intelligent_discovery.py` | Scoring multi-critères + Tournesol | — |
| `backend/src/chat/router.py` | Chat v4.0 + Perplexity | — |
| `backend/src/billing/router.py` | Stripe workflows | 1636 lines |
| `backend/src/transcripts/youtube.py` | 7-method extraction chain | 2339 lines |
| `backend/src/auth/dependencies.py` | get_current_user, require_plan | — |
| `backend/src/tournesol/router.py` | Proxy API Tournesol | — |

### Frontend
| Fichier | Rôle |
|---------|------|
| `frontend/src/services/api.ts` | All API calls (2051 lines) |
| `frontend/src/store/analysisStore.ts` | Zustand state (Immer, 436 lines) |
| `frontend/src/config/planPrivileges.ts` | Plan features matrix (400 lines) |
| `frontend/src/pages/DashboardPage.tsx` | Hub principal (60 KB) |
| `frontend/src/pages/History.tsx` | Virtual scrolling (131 KB) |
| `frontend/src/components/TournesolTrendingSection.tsx` | Recommandations Tournesol |
| `frontend/src/types/analysis.ts` | Customization v4 (322 lines) |

### Mobile
| Fichier | Rôle |
|---------|------|
| `mobile/src/services/api.ts` | API client (1722 lines, mirrors frontend) |
| `mobile/src/contexts/AuthContext.tsx` | Auth + Google OAuth |
| `mobile/src/contexts/PlanContext.tsx` | Plan-based feature gating |
| `mobile/app/(tabs)/index.tsx` | Home (pull-to-refresh + Tournesol) |
| `mobile/app/(tabs)/analysis/[id].tsx` | Analysis detail (4 tabs) |
| `mobile/src/constants/config.ts` | API URL, Google Client IDs, timeouts |
| `mobile/src/stores/analysisStore.ts` | Analysis state (Zustand) |

### Extension
| Fichier | Rôle |
|---------|------|
| `extension/src/background.ts` | Service worker (558 lines) |
| `extension/src/content.ts` | YouTube/TikTok DOM injection (800+ lines) |
| `extension/src/popup/components/MainView.tsx` | Core UI (538 lines) |
| `extension/src/popup/components/ChatDrawer.tsx` | Chat interface |
| `extension/src/utils/config.ts` | API URL, Google Client ID |

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
npm run build        # Production build
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest
```

### Mobile
```bash
cd mobile
npm install
npx expo start               # Dev server
npm run android / npm run ios # Platform specific
npm run typecheck             # tsc --noEmit
npm run test                  # Jest
```

### Extension
```bash
cd extension
npm install
npm run build        # → dist/
npm run dev          # Watch mode
npm run typecheck    # tsc --noEmit
```

### EAS (Mobile Production)
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

---

## Infrastructure & DevOps

| Service | Détail |
|---------|--------|
| **VPS Hetzner** | clawdbot — 89.167.23.214 (Tailscale: 100.127.186.126) |
| **MSI-PC (local)** | Claude Runner — 100.111.253.5:18790 |
| **OpenClaw Gateway** | VPS port 18789, token: MarcellinTyronJean22 |
| **API publique** | https://api.deepsightsynthesis.com (Caddy reverse proxy + auto-SSL) |
| **Frontend** | Vercel — auto-deploy on `main` push |
| **Mobile** | EAS Build — App Store (ascAppId: 6740487498) + Play Store |

### Docker Stack Hetzner (Production)
| Container | Image | Rôle |
|-----------|-------|------|
| `repo-backend-1` | `deepsight-backend:latest` | FastAPI 4 workers (port 8080) |
| `repo-caddy-1` | `caddy:2-alpine` | Reverse proxy + auto-SSL (80/443) |
| `repo-postgres-1` | `postgres:17-alpine` | PostgreSQL 17 |
| `repo-redis-1` | `redis:7-alpine` | Redis 7 cache |

- **Réseau Docker** : `repo_deepsight`
- **Env production** : `/opt/deepsight/repo/.env.production`
- **Repo VPS** : `/opt/deepsight/repo`
- **Dockerfile** : `deploy/hetzner/Dockerfile` (Python 3.11 + ffmpeg + WeasyPrint)
- **Caddyfile** : `deploy/hetzner/caddy/Caddyfile` (300s timeouts SSE, HSTS, security headers)

### Déploiement
- **Frontend** : `git push origin main` → Vercel auto-deploy
- **Backend** : Push → SSH VPS → `cd /opt/deepsight/repo && git pull` → `docker build` → recreate container
- **Mobile** : `eas update` (OTA) ou `eas build` (natif)
- **Extension** : `npm run build` → ZIP dist/ → Chrome Web Store Developer Dashboard

---

## Environment Variables

### Backend (.env.production)
```env
# Core
DATABASE_URL=postgresql+asyncpg://deepsight:PASS@repo-postgres-1:5432/deepsight
REDIS_URL=redis://repo-redis-1:6379/0
JWT_SECRET_KEY=minimum-32-characters
ENV=production
PORT=8080

# IA
MISTRAL_API_KEY=required
PERPLEXITY_API_KEY=optional
BRAVE_SEARCH_API_KEY=optional
OPENAI_API_KEY=optional (TTS + Whisper fallback)
GROQ_API_KEY=optional (Whisper fallback)
DEEPGRAM_API_KEY=optional (STT fallback)
ASSEMBLYAI_API_KEY=optional (STT fallback)

# YouTube
SUPADATA_API_KEY=required (transcripts prioritaire)
YOUTUBE_PROXY=optional (Webshare)
YTDLP_COOKIES_PATH=optional

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Auth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx

# Email
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@deepsightsynthesis.com

# CORS
FRONTEND_URL=https://www.deepsightsynthesis.com
ALLOWED_ORIGINS=https://www.deepsightsynthesis.com,http://localhost:5173,http://localhost:8081

# Backup (S3/R2)
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, BACKUP_S3_BUCKET

# Monitoring
SENTRY_DSN=optional
```

### Frontend (.env)
```env
VITE_API_URL=https://api.deepsightsynthesis.com
VITE_SENTRY_DSN=optional
```

### Mobile (constants/config.ts)
```typescript
export const API_BASE_URL = 'https://api.deepsightsynthesis.com';
export const GOOGLE_CLIENT_ID = 'web-client-id.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = 'android-client-id';
export const GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
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

### TypeScript (Frontend + Mobile + Extension)
- **Strict mode** activé dans tsconfig
- **Interfaces** plutôt que types pour les objets
- **Functional components** uniquement
- **Custom hooks** pour la logique réutilisable
- **API sync** : garder `services/api.ts` cohérent entre frontend, mobile et extension

---

## Design System (Web + Mobile + Extension)

- **Dark mode first** : fond `#0a0a0f`, surfaces `#12121a`, borders `white/5%`
- **Accents** : Indigo `#6366f1`, Violet `#8b5cf6`, Cyan `#06b6d4`, Bleu `#3b82f6`
- **Typo** : Inter (body), JetBrains Mono (code)
- **Radius** : 6px (sm), 10px (md), 16px (lg)
- **Spacing** : système 4px (4, 8, 12, 16, 24, 32, 48, 64)
- **Animations** : Framer Motion (web), Reanimated 4 (mobile), transitions `200ms cubic-bezier(0.4,0,0.2,1)`
- **Glassmorphism** : `backdrop-blur-xl bg-white/5 border border-white/10`
- **Responsive** : 375px / 768px / 1280px / 1536px
- **Accessibilité** : AA minimum, aria-labels, focus management

---

## Test Coverage (Mars 2026)

| Composant | Tests | Status |
|-----------|-------|--------|
| Backend | 526/526 | ✅ All passing |
| Frontend | 400/400 | ✅ All passing |
| Mobile | 178/178 | ✅ All passing |
| Extension | Partiel | ⚠️ passWithNoTests |
| E2E (Playwright) | 6 specs | ✅ Auth, Analysis, Navigation, Upgrade |

---

## Known Issues & TODOs

### 🔴 Critique
- **Google OAuth Mobile** : `/api/auth/google/token` endpoint existe mais incomplet
- **YouTube IP ban Hetzner** : VPS IP bloquée par YouTube. Supadata = méthode principale. Proxy Webshare en cours
- **Deploy backend workflow** : `.github/workflows/deploy-backend.yml` référence encore Railway → à migrer vers SSH Hetzner
- **Resend rate limiting** : 429 errors (56/24h) → email batch scheduler dépasse 5 req/s

### 🟡 Moyen
- Redis cache pour transcripts (optimisation)
- Rate limiting IP pour requêtes non authentifiées
- Optimiser requêtes N+1 dans /videos/history
- UI Playlists à finaliser
- TTS audio player (design exists)
- docker-compose.yml fonctionnel (actuellement containers manuels `docker run`)

### 🟢 Bas
- Chrome Web Store submission (extension prête, pas soumise)
- Cross-domain auth sync testing en production
- Spaced repetition UI fine-tuning

### ✅ Résolu récemment (Mars 2026)
- Migration Railway → Hetzner VPS complète
- Clé Supadata renouvelée
- Section Tournesol remplace Tendances DeepSight (privacy)
- Support proxy YouTube ajouté (YOUTUBE_PROXY env var)
- Migration Mistral AI modèles 2026 (75% cost reduction)
- Quick Chat mode (0 crédits, frontend + mobile + extension)
- Chat UI v4 (sidebar + watermark)
- TikTok support (thumbnails réels)
- Tournesol recommendations avec refresh aléatoire (offset + shuffle)
- Tests green: backend 526, frontend 400, mobile 178

---

## Features par plateforme

| Feature | Web | Mobile | Extension |
|---------|-----|--------|-----------|
| Analyse vidéo | ✅ | ✅ | ✅ |
| Quick Chat | ✅ | ✅ | ✅ |
| Chat contextuel | ✅ | ✅ | ✅ |
| Flashcards | ✅ | ✅ | ❌ CTA |
| Quiz | ✅ | ✅ | ❌ CTA |
| Mind Maps | ✅ | ❌ CTA | ❌ CTA |
| Playlists | ✅ | ❌ CTA | ❌ CTA |
| Export PDF | ✅ Pro | ❌ CTA | ❌ CTA |
| Web Search | ✅ Pro+ | ❌ CTA | ❌ CTA |
| Academic Search | ✅ | ✅ | ❌ |
| Tournesol | ✅ | ✅ | ❌ |
| History | ✅ | ✅ | ✅ (local) |
| Billing/Upgrade | ✅ Stripe | ✅ | Link to web |
| Guest mode | ❌ | ❌ | ✅ (1 analyse) |

---

## Additional Documentation

- `docs/ARCHITECTURE.md` — System design & data flow
- `docs/API.md` — REST API endpoint reference
- `docs/CLAUDE-BACKEND.md` — Détails backend
- `mobile/CLAUDE.md` — Guide mobile
- `backend/README.md` — README backend

---

*Last updated: March 20, 2026 — Version 3.0*
