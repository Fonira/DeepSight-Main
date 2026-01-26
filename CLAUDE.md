# DeepSight - AI Assistant Development Guide

## Project Identity

**DeepSight** is a SaaS platform for AI-powered YouTube video analysis using Bayesian epistemology. It provides intelligent summaries, fact-checking, study tools, and contextual chat.

| Component | Technology | Deployment | URL |
|-----------|------------|------------|-----|
| **Backend** | FastAPI + Python 3.11 | Railway | `https://deep-sight-backend-v3-production.up.railway.app` |
| **Frontend** | React 18 + TypeScript + Vite | Vercel | `https://www.deepsightsynthesis.com` |
| **Mobile** | Expo SDK 54 + React Native | EAS Build | App Store / Play Store |

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
│   │   ├── pages/             # Route components
│   │   ├── components/        # UI components
│   │   ├── services/api.ts    # API client
│   │   ├── store/             # Zustand state management
│   │   └── config/            # Plans, privileges
│   └── package.json
├── mobile/                     # React Native mobile app
│   ├── src/
│   │   ├── screens/           # 13+ screens
│   │   ├── components/        # UI components
│   │   ├── services/api.ts    # API client (mirrors frontend)
│   │   ├── contexts/          # Auth, Theme contexts
│   │   └── navigation/        # React Navigation
│   └── package.json
├── docs/                       # Documentation
│   └── CLAUDE-BACKEND.md      # Detailed backend guide
└── scripts/                    # Development utilities
```

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
npm run dev          # Vite dev server at localhost:5173
npm run build        # Production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

### Mobile
```bash
cd mobile
npm install
npx expo start       # Expo dev server
npm run android      # Android emulator
npm run ios          # iOS simulator
npm run typecheck    # TypeScript check
```

---

## Technology Stack

### Backend (Python)
| Category | Technology |
|----------|------------|
| Framework | FastAPI (async) |
| ORM | SQLAlchemy 2.0 (async) |
| Database | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT + Google OAuth (authlib) |
| AI | Mistral AI |
| Fact-check | Perplexity AI |
| Payments | Stripe |
| Email | Resend |
| Monitoring | Sentry |

### Frontend (TypeScript)
| Category | Technology |
|----------|------------|
| Framework | React 18 |
| Build | Vite 5 |
| Routing | React Router 6 |
| State | Zustand + TanStack Query |
| Styling | Tailwind CSS |
| Markdown | react-markdown + remark-gfm |

### Mobile (TypeScript)
| Category | Technology |
|----------|------------|
| Framework | React Native 0.81 |
| Platform | Expo SDK 54 |
| Navigation | React Navigation 6 |
| State | Zustand + TanStack Query |
| Auth | expo-auth-session |
| Storage | expo-secure-store |

---

## Critical Files Reference

### Backend
| File | Purpose |
|------|---------|
| `backend/src/core/config.py` | All settings, plans, quotas, API keys |
| `backend/src/db/database.py` | SQLAlchemy models (15 tables) |
| `backend/src/auth/dependencies.py` | `get_current_user`, `require_plan` |
| `backend/src/videos/analysis.py` | Bayesian analysis prompts |
| `backend/src/transcripts/youtube.py` | Multi-fallback YouTube extraction |
| `backend/src/billing/router.py` | Stripe checkout + webhooks |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/src/services/api.ts` | All API calls |
| `frontend/src/store/analysisStore.ts` | Zustand state (Immer) |
| `frontend/src/config/planPrivileges.ts` | Plan features matrix |
| `frontend/vite.config.ts` | Build configuration |

### Mobile
| File | Purpose |
|------|---------|
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
5. Google OAuth            → /api/auth/google/login (web) or /api/auth/google/token (mobile)
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

| Plan | Price | Analyses/mo | Credits | Key Features |
|------|-------|-------------|---------|--------------|
| Free | 0 | 3 | 150 | 10min max, 3 days history |
| Student | 2.99 | 40 | 2000 | Flashcards, concept maps |
| Starter | 5.99 | 60 | 3000 | 2h max, exports, 60d history |
| Pro | 12.99 | 300 | 15000 | Playlists, unlimited chat, TTS |
| Team | 29.99 | 1000 | 50000 | API access, 5 users |

---

## API Endpoints Summary

### Videos
```
POST /api/videos/analyze          # Start analysis → task_id
GET  /api/videos/status/{task_id} # Poll status
GET  /api/videos/history          # Paginated history
GET  /api/videos/summary/{id}     # Summary details
POST /api/videos/export           # PDF/DOCX/MD export
```

### Chat
```
POST /api/chat/ask                # Question → response
POST /api/chat/ask/stream         # Question → SSE stream
GET  /api/chat/history/{summary}  # Conversation history
```

### Billing
```
POST /api/billing/checkout        # Create Stripe session
POST /api/billing/webhook         # Stripe webhook
GET  /api/billing/portal          # Customer portal
```

---

## Code Conventions

### Python (Backend)
- **Always async**: Use `async/await` for all I/O operations
- **Type hints**: Type all function parameters and returns
- **Pydantic v2**: Validate all request/response schemas
- **No sync HTTP**: Use `httpx` (not `requests`)
- **No print()**: Use structured `logger` from `core/logging`
- **No hardcoded secrets**: All via `core/config.py`

```python
# Good pattern
async def get_summary(db: AsyncSession, user_id: int, summary_id: int) -> Summary:
    result = await db.execute(
        select(Summary).where(Summary.id == summary_id, Summary.user_id == user_id)
    )
    return result.scalar_one_or_none()
```

### TypeScript (Frontend + Mobile)
- **Strict mode**: Enabled in tsconfig
- **Interfaces over types**: Prefer `interface` for object shapes
- **Functional components**: No class components
- **Custom hooks**: Extract reusable logic into hooks
- **API sync**: Keep `services/api.ts` identical between frontend and mobile

```typescript
// Good pattern
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
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db

# JWT
JWT_SECRET_KEY=minimum-32-characters
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# AI APIs
MISTRAL_API_KEY=required
PERPLEXITY_API_KEY=optional

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Frontend
FRONTEND_URL=https://www.deepsightsynthesis.com
ALLOWED_ORIGINS=https://www.deepsightsynthesis.com,http://localhost:5173,http://localhost:8081

# Email
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

## Known Issues & TODOs

### Critical (Mobile)
- **Google OAuth**: Endpoint `/api/auth/google/token` needs implementation on backend for mobile token exchange

### Backend
- [ ] Implement Redis cache for transcripts
- [ ] Add rate limiting by IP for unauthenticated requests
- [ ] Optimize N+1 queries in /history endpoint

### Frontend/Mobile
- [ ] Complete Playlists UI implementation
- [ ] Add Mind Map visualization component
- [ ] Implement TTS audio player

---

## Deployment

### Backend (Railway)
- Root directory: `/backend`
- Start command: `cd src && uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `GET /health`

### Frontend (Vercel)
- Root directory: `/frontend`
- Build command: `npm run build`
- Output: `dist/`

### Mobile (EAS Build)
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

---

## CORS Configuration

The backend allows these origins:
- Production: `https://www.deepsightsynthesis.com`
- Frontend dev: `http://localhost:5173`
- Expo web: `http://localhost:8081`

---

## Bayesian Analysis Features

### Epistemic Markers
The AI analysis uses these markers to indicate certainty levels:
- **SOLIDE** - Established fact, scientific consensus
- **PLAUSIBLE** - Probable but needs confirmation
- **INCERTAIN** - Hypothesis, ongoing debate
- **A VERIFIER** - Doubtful claim, verify independently

### Analysis Modes
```python
ANALYSIS_MODES = {
    "accessible": "General public, simplified",
    "standard": "Balanced, detailed",
    "expert": "Technical, academic"
}
```

---

## YouTube Transcript Extraction

Multi-fallback system for reliability:
1. `youtube-transcript-api` - Fast, rate-limited
2. `yt-dlp` - Reliable, slower
3. Supadata API - Paid backup, very reliable

---

## Database Models (Summary)

```
Users & Auth          Content              Billing
─────────────────     ─────────────────    ─────────────────
User                  Summary              Transaction
RefreshToken          ChatMessage          Subscription
VerificationCode      Playlist

System
─────────────────
AdminLog
Notification
ApiUsage
```

---

## Additional Documentation

- **Backend Details**: `docs/CLAUDE-BACKEND.md`
- **Mobile Guide**: `mobile/CLAUDE.md`
- **Backend README**: `backend/README.md`

---

*Last updated: January 2026*
