# DeepSight Architecture 🏗️

This document describes the technical architecture of DeepSight, including system design, data flow, and key decisions.

---

## 📋 Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Mobile Architecture](#mobile-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Security Architecture](#security-architecture)
- [Deployment Architecture](#deployment-architecture)
- [AI Integration](#ai-integration)

---

## 🌐 Overview

DeepSight is a distributed SaaS application with three main components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTS                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Web App    │  │  iOS App     │  │ Android App  │               │
│  │   (React)    │  │   (Expo)     │  │   (Expo)     │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          └────────────────┬┴─────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       BACKEND (Railway)                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     FastAPI Application                         │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │ │
│  │  │   Auth   │ │  Videos  │ │   Chat   │ │ Billing  │           │ │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │ │
│  │       │            │            │            │                  │ │
│  │  ┌────┴────────────┴────────────┴────────────┴────┐             │ │
│  │  │              SQLAlchemy ORM (Async)            │             │ │
│  │  └────────────────────┬───────────────────────────┘             │ │
│  └───────────────────────┼────────────────────────────────────────┘ │
└──────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │PostgreSQL│ │ Mistral  │ │Perplexity│ │  Stripe  │ │  Resend  │  │
│  │    DB    │ │    AI    │ │    AI    │ │ Payments │ │  Email   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Backend Architecture

### Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0 |
| Database | PostgreSQL / SQLite | 15+ / 3.x |
| Python | Python | 3.11+ |
| Task Queue | Background Tasks | Built-in |
| Auth | JWT + OAuth | python-jose |

### Module Structure

```
backend/src/
├── main.py                 # Application entry point
├── core/
│   ├── config.py          # Settings, plans, API keys
│   ├── security.py        # JWT, password hashing
│   ├── credits.py         # Credit system logic
│   ├── logging.py         # Structured logging
│   ├── middleware.py      # Request/response middleware
│   └── sentry.py          # Error tracking
│
├── db/
│   ├── database.py        # SQLAlchemy setup, session
│   └── models.py          # ORM models (if separate)
│
├── auth/
│   ├── router.py          # Auth endpoints
│   ├── service.py         # Auth business logic
│   ├── schemas.py         # Pydantic models
│   ├── dependencies.py    # get_current_user, require_plan
│   └── email.py           # Verification emails
│
├── videos/
│   ├── router.py          # Video endpoints
│   ├── analysis.py        # AI analysis logic
│   ├── streaming.py       # SSE response streaming
│   └── schemas.py         # Request/response models
│
├── chat/
│   ├── router.py          # Chat endpoints
│   ├── service.py         # Chat logic
│   └── websocket.py       # WebSocket handler
│
├── transcripts/
│   ├── youtube.py         # YouTube transcript extraction
│   └── fallbacks.py       # Multi-fallback system
│
├── billing/
│   ├── router.py          # Billing endpoints
│   ├── stripe.py          # Stripe integration
│   └── webhooks.py        # Webhook handlers
│
├── study/
│   ├── router.py          # Study tools endpoints
│   ├── quiz.py            # Quiz generation
│   ├── flashcards.py      # Flashcard generation
│   └── mindmap.py         # Mind map generation
│
└── [other modules...]
```

### Request Processing Pipeline

```
Request → CORS → Logging → Auth → Router → Service → Response
           │        │        │       │         │
           ▼        ▼        ▼       ▼         ▼
        Origins  Metrics   JWT   Endpoint  Business
        Check    Track    Decode  Handler   Logic
```

### Dependency Injection

```python
# Core dependencies
async def get_session() -> AsyncSession:
    """Database session per request"""
    async with async_session_maker() as session:
        yield session

# Auth dependencies
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session)
) -> User:
    """Extract and validate user from JWT"""
    ...

def require_plan(*allowed_plans: str):
    """Factory for plan-based access control"""
    async def dependency(user: User = Depends(get_current_user)):
        if user.plan not in allowed_plans:
            raise HTTPException(403, "Plan upgrade required")
        return user
    return dependency
```

---

## 🌐 Frontend Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React 18 |
| Build | Vite 5 |
| Language | TypeScript 5.6 |
| Styling | Tailwind CSS |
| State | Zustand + TanStack Query |
| Routing | React Router 6 |

### Directory Structure

```
frontend/src/
├── main.tsx               # Entry point
├── App.tsx                # Root component + routing
│
├── pages/                 # Route components
│   ├── HomePage.tsx
│   ├── AnalyzePage.tsx
│   ├── HistoryPage.tsx
│   ├── SummaryPage.tsx
│   └── SettingsPage.tsx
│
├── components/            # Reusable UI
│   ├── common/           # Buttons, inputs, modals
│   ├── layout/           # Header, footer, sidebar
│   ├── analysis/         # Analysis-specific
│   └── chat/             # Chat interface
│
├── services/
│   └── api.ts            # API client (Axios)
│
├── store/                 # Zustand stores
│   ├── authStore.ts
│   ├── analysisStore.ts
│   └── uiStore.ts
│
├── hooks/                 # Custom hooks
│   ├── useAnalysis.ts
│   └── useAuth.ts
│
├── config/
│   ├── planPrivileges.ts # Feature matrix
│   └── constants.ts
│
└── types/                 # TypeScript interfaces
    └── index.ts
```

### State Management

```typescript
// Zustand store pattern
interface AnalysisStore {
  currentAnalysis: Analysis | null;
  isLoading: boolean;
  
  // Actions
  setAnalysis: (analysis: Analysis) => void;
  startAnalysis: (url: string) => Promise<void>;
  clearAnalysis: () => void;
}

const useAnalysisStore = create<AnalysisStore>()(
  immer((set, get) => ({
    currentAnalysis: null,
    isLoading: false,
    
    setAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    
    startAnalysis: async (url) => {
      set({ isLoading: true });
      const result = await api.analyzeVideo(url);
      set({ currentAnalysis: result, isLoading: false });
    },
    
    clearAnalysis: () => set({ currentAnalysis: null }),
  }))
);
```

---

## 📱 Mobile Architecture

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | React Native 0.81 |
| Platform | Expo SDK 54 |
| Navigation | React Navigation 6 |
| State | Zustand + TanStack Query |
| Auth | expo-auth-session |
| Storage | expo-secure-store |

### Directory Structure

```
mobile/src/
├── App.tsx                # Entry point
│
├── screens/               # Screen components
│   ├── HomeScreen.tsx
│   ├── AnalysisScreen.tsx
│   ├── HistoryScreen.tsx
│   └── SettingsScreen.tsx
│
├── components/            # Reusable components
│   ├── common/
│   ├── analysis/
│   └── chat/
│
├── navigation/
│   ├── RootNavigator.tsx
│   ├── MainTabs.tsx
│   └── AuthStack.tsx
│
├── contexts/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
│
├── services/
│   └── api.ts            # Mirrors frontend API
│
├── hooks/
│   └── useAuth.ts
│
└── constants/
    └── config.ts
```

### Navigation Structure

```
RootNavigator
├── AuthStack (unauthenticated)
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
│
└── MainTabs (authenticated)
    ├── HomeStack
    │   ├── HomeScreen
    │   └── AnalysisScreen
    ├── HistoryStack
    │   ├── HistoryScreen
    │   └── SummaryScreen
    └── SettingsStack
        └── SettingsScreen
```

---

## 🔄 Data Flow

### Video Analysis Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  1. User submits YouTube URL                                      │
└──────────────────┬───────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. Backend validates URL, checks quota, creates task            │
│     → Returns task_id immediately (202 Accepted)                 │
└──────────────────┬───────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. Background Task:                                              │
│     a. Extract video metadata (title, thumbnail, duration)       │
│     b. Extract transcript (multi-fallback system)                │
│     c. Call Mistral AI for critical analysis                     │
│     d. Extract concepts and epistemic markers                    │
│     e. Save Summary to database                                  │
│     f. Deduct credits from user                                  │
└──────────────────┬───────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. Client polls GET /status/{task_id}                           │
│     → Returns progress until completed                           │
└──────────────────┬───────────────────────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. Client fetches GET /summary/{id}                             │
│     → Full analysis results                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Chat Flow

```
User Question
     │
     ▼
┌─────────────────┐
│  Load Context   │ ← Video summary + concepts + previous messages
└────────┬────────┘
         ▼
┌─────────────────┐
│ Build Prompt    │ ← System prompt + context + user question
└────────┬────────┘
         ▼
┌─────────────────┐
│  Mistral AI     │ ← Streaming response
└────────┬────────┘
         ▼
┌─────────────────┐
│ Optional: Fact  │ ← Perplexity API (if deep enrichment)
│   Check         │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Save to History │
└────────┬────────┘
         ▼
   Response to User
```

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    plan VARCHAR(20) DEFAULT 'free',
    credits_used INTEGER DEFAULT 0,
    analyses_used INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

-- Summaries (Analyses)
CREATE TABLE summaries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    video_url TEXT NOT NULL,
    video_title TEXT,
    channel_name TEXT,
    thumbnail_url TEXT,
    duration_seconds INTEGER,
    summary TEXT,
    concepts JSONB,
    epistemic_markers JSONB,
    mode VARCHAR(20),
    language VARCHAR(10),
    credits_used INTEGER,
    is_favorite BOOLEAN DEFAULT FALSE,
    notes TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    summary_id INTEGER REFERENCES summaries(id),
    user_id INTEGER REFERENCES users(id),
    role VARCHAR(20),  -- 'user' or 'assistant'
    content TEXT,
    web_search_used BOOLEAN DEFAULT FALSE,
    fact_checked BOOLEAN DEFAULT FALSE,
    sources_json TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sessions (for single-device auth)
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    session_token VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Subscriptions
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    plan VARCHAR(20),
    status VARCHAR(20),
    current_period_end TIMESTAMP
);
```

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │  summaries   │       │chat_messages │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │──┐    │ id           │──┐    │ id           │
│ username     │  │    │ user_id      │◄─┘    │ summary_id   │◄─┐
│ email        │  │    │ video_url    │       │ user_id      │  │
│ plan         │  │    │ video_title  │       │ role         │  │
│ credits_used │  │    │ summary      │       │ content      │  │
└──────────────┘  │    │ concepts     │       └──────────────┘  │
                  │    └──────────────┘                         │
                  │           │                                 │
                  │           └─────────────────────────────────┘
                  ▼
         ┌──────────────┐       ┌──────────────┐
         │subscriptions │       │user_sessions │
         ├──────────────┤       ├──────────────┤
         │ id           │       │ id           │
         │ user_id      │◄──────│ user_id      │
         │ stripe_id    │       │ session_token│
         │ plan         │       │ expires_at   │
         └──────────────┘       └──────────────┘
```

---

## 🔒 Security Architecture

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     JWT Authentication                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Login Request                                              │
│       │                                                     │
│       ▼                                                     │
│  ┌─────────────┐                                            │
│  │ Validate    │                                            │
│  │ Credentials │                                            │
│  └──────┬──────┘                                            │
│         ▼                                                   │
│  ┌─────────────┐     ┌─────────────┐                        │
│  │ Create      │────▶│ Session     │  (DB record)           │
│  │ Session     │     │ Token       │                        │
│  └──────┬──────┘     └─────────────┘                        │
│         ▼                                                   │
│  ┌─────────────┐     ┌─────────────┐                        │
│  │ Generate    │────▶│ Access      │  (15 min TTL)          │
│  │ JWT Tokens  │     │ Token       │                        │
│  │             │────▶│ Refresh     │  (7 days TTL)          │
│  └─────────────┘     │ Token       │                        │
│                      └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Security Measures

| Layer | Protection |
|-------|------------|
| Transport | HTTPS only, HSTS |
| Authentication | JWT with short expiry, session tokens |
| Authorization | Role-based (user/admin), Plan-based features |
| Input | Pydantic validation, SQL injection prevention |
| Secrets | Environment variables, never in code |
| Monitoring | Sentry error tracking, structured logging |

---

## 🚀 Deployment Architecture

### Production Infrastructure

```
                         ┌─────────────────┐
                         │   Cloudflare    │
                         │   (DNS + CDN)   │
                         └────────┬────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Vercel      │    │    Railway      │    │   App Stores    │
│   (Frontend)    │    │   (Backend)     │    │  (iOS/Android)  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ React SPA       │    │ FastAPI         │    │ Expo/EAS Build  │
│ Static Assets   │    │ PostgreSQL      │    │                 │
│ Edge Functions  │    │ Background Jobs │    │                 │
└─────────────────┘    └────────┬────────┘    └─────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   External Services   │
                    ├───────────────────────┤
                    │ • Mistral AI          │
                    │ • Perplexity AI       │
                    │ • Stripe              │
                    │ • Resend              │
                    │ • Sentry              │
                    └───────────────────────┘
```

### Railway Configuration

```json
// railway.json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd src && uvicorn main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

---

## 🤖 AI Integration

### Mistral AI Usage

| Feature | Model | Purpose |
|---------|-------|---------|
| Analysis | mistral-large | Source-verified video summaries |
| Chat | mistral-medium | Contextual Q&A |
| Study Tools | mistral-medium | Quiz/flashcard generation |

### Prompt Engineering

```python
ANALYSIS_SYSTEM_PROMPT = """
You are an expert analyst using evidence-based epistemology.
Analyze the content and mark claims with epistemic markers:

- **SOLID** [🟢]: Established fact, scientific consensus
- **PLAUSIBLE** [🟡]: Probable, needs confirmation  
- **UNCERTAIN** [🟠]: Hypothesis, ongoing debate
- **TO_VERIFY** [🔴]: Doubtful, verify independently

Structure your analysis with:
1. Executive Summary
2. Key Concepts (with definitions)
3. Main Arguments (with epistemic markers)
4. Potential Biases
5. Further Reading Suggestions
"""
```

### YouTube Transcript Extraction

Multi-fallback system for reliability:

```python
async def get_transcript(video_id: str) -> str:
    """
    Priority fallback system:
    1. youtube-transcript-api (fast, may be rate-limited)
    2. yt-dlp (reliable, slower)
    3. Supadata API (paid backup, very reliable)
    """
    # Try each method in order
    for method in [ytapi_method, ytdlp_method, supadata_method]:
        try:
            return await method(video_id)
        except Exception:
            continue
    raise TranscriptUnavailable()
```

---

## 📈 Scalability Considerations

### Current Architecture

- **Stateless API**: Easy horizontal scaling
- **Async I/O**: Efficient handling of concurrent requests
- **Background Tasks**: Non-blocking analysis processing

### Future Improvements

1. **Redis Cache**: For transcript and analysis caching
2. **Task Queue**: Celery/RQ for distributed analysis
3. **Read Replicas**: For database scaling
4. **CDN**: For static assets and thumbnails

---

## 🔍 Monitoring & Observability

### Logging

```python
# Structured logging with context
logger.info(
    "Analysis completed",
    user_id=user.id,
    video_id=video_id,
    duration_ms=elapsed,
    credits_used=credits
)
```

### Metrics

- Request latency (P50, P95, P99)
- Error rates by endpoint
- Credit usage patterns
- Analysis queue depth

### Alerting

- Sentry for error tracking
- Railway metrics for resource usage
- Custom alerts for quota exhaustion

---

*Last updated: January 2025*
