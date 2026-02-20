# Deep Sight — Environment Variables Audit

> Generated: 2026-02-10 | Scan scope: `backend/src/`, `frontend/src/`, `mobile/`

---

## Executive Summary

| Metric | Count |
|--------|-------|
| Total env vars discovered | **65+** |
| Critical hardcoded secrets | **4** |
| Hardcoded Stripe price IDs | **3** |
| Hardcoded production URLs | **6** |
| Hardcoded personal emails | **5** |
| Missing `.env.example` files | **3** (backend, frontend, mobile) |
| Files scanned (backend) | 99 Python files |
| Files scanned (frontend) | 50+ TypeScript files |
| Files scanned (mobile) | 50+ TypeScript files |

---

## CRITICAL — Hardcoded Secrets

### 1. Admin Password (backend)
- **File**: `backend/src/core/config.py:40`
- **Code**: `os.environ.get("ADMIN_PASSWORD", "DeepSight2024!")`
- **Risk**: Default password in source code. Anyone with repo access can log in as admin.
- **Fix**: Remove default value, require env var.

### 2. JWT / Admin Secret Key (backend)
- **File**: `backend/src/core/config.py:41,121`
- **Code**: `os.environ.get("ADMIN_SECRET_KEY", "deepsight_secret_key_2024")`
- **Risk**: JWT signing key exposed. Attackers can forge valid tokens.
- **Fix**: Remove default value, require env var with minimum 32 characters.

### 3. Database Credentials (backend)
- **File**: `backend/src/db/optimizations.py:37-39`
- **Code**: `os.environ.get("DATABASE_URL", "postgresql+asyncpg://deepsight:password@localhost:5432/deepsight")`
- **Risk**: Database username/password hardcoded as fallback.
- **Fix**: Remove default, fail if DATABASE_URL not set in production.

### 4. Stripe Live Price IDs (backend)
- **File**: `backend/src/core/config.py:89,94,99`
- **Code**: Hardcoded `price_1SiJDd...`, `price_1SiJDx...`, `price_1SiJEc...`
- **Risk**: Live Stripe price identifiers in source code.
- **Fix**: Move to env vars only.

---

## Backend Environment Variables

### Core (`backend/src/core/config.py`)

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `ENV` | string | `"development"` | No | Low |
| `RAILWAY_ENVIRONMENT` | string | — | No (auto) | Low |
| `DATABASE_PATH` | path | `/app/data` or `./data` | No | Low |
| `APP_URL` | URL | `http://localhost:8000` | Prod: Yes | Medium |
| `FRONTEND_URL` | URL | `http://localhost:5173` | Prod: Yes | Medium |
| `CUSTOM_DOMAIN` | string | `""` | No | Low |

### Admin & Auth

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `ADMIN_USERNAME` | string | `"admin"` | Prod: Yes | High |
| `ADMIN_EMAIL` | email | `"admin@example.com"` | Prod: Yes | High |
| `ADMIN_PASSWORD` | secret | ~~`"DeepSight2024!"`~~ | **Yes** | **CRITICAL** |
| `ADMIN_SECRET_KEY` | secret | ~~`"deepsight_secret_key_2024"`~~ | **Yes** | **CRITICAL** |
| `JWT_SECRET_KEY` | secret | falls back to ADMIN_SECRET_KEY | **Yes** | **CRITICAL** |

### API Keys

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `MISTRAL_API_KEY` | secret | `""` | Yes (core) | High |
| `SUPADATA_API_KEY` | secret | `""` | No | High |
| `PERPLEXITY_API_KEY` | secret | `""` | No | High |
| `BRAVE_SEARCH_API_KEY` | secret | `""` | No | High |
| `OPENAI_API_KEY` | secret | `""` | No | High |
| `GROQ_API_KEY` | secret | — | No | High |
| `DEEPGRAM_API_KEY` | secret | — | No | High |
| `ASSEMBLYAI_API_KEY` | secret | — | No | High |
| `SEMANTIC_SCHOLAR_API_KEY` | secret | — | No | High |

### Email (Resend)

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `EMAIL_ENABLED` | bool | `"true"` | No | Medium |
| `RESEND_API_KEY` | secret | `""` | If email enabled | High |
| `FROM_EMAIL` | email | `"noreply@deepsight.fr"` | No | Low |
| `FROM_NAME` | string | `"Deep Sight"` | No | Low |

### Stripe Billing

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `STRIPE_ENABLED` | bool | `"true"` | No | Medium |
| `STRIPE_TEST_MODE` | bool | `"false"` | No | Medium |
| `STRIPE_SECRET_KEY_TEST` | secret | `""` | If test mode | **CRITICAL** |
| `STRIPE_SECRET_KEY_LIVE` | secret | `""` | If live mode | **CRITICAL** |
| `STRIPE_PUBLISHABLE_KEY_TEST` | string | `""` | If test mode | High |
| `STRIPE_PUBLISHABLE_KEY_LIVE` | string | `""` | If live mode | High |
| `STRIPE_WEBHOOK_SECRET` | secret | `""` | Yes | **CRITICAL** |
| `STRIPE_PRICE_STARTER_TEST` | string | `""` | If test mode | Medium |
| `STRIPE_PRICE_STARTER_LIVE` | string | `""` | If live mode | Medium |
| `STRIPE_PRICE_PRO_TEST` | string | `""` | If test mode | Medium |
| `STRIPE_PRICE_PRO_LIVE` | string | `""` | If live mode | Medium |
| `STRIPE_PRICE_EXPERT_TEST` | string | `""` | If test mode | Medium |
| `STRIPE_PRICE_EXPERT_LIVE` | string | `""` | If live mode | Medium |

### Google OAuth

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `GOOGLE_OAUTH_ENABLED` | bool | `"false"` | No | Medium |
| `GOOGLE_CLIENT_ID` | string | `""` | If OAuth enabled | High |
| `GOOGLE_CLIENT_SECRET` | secret | `""` | If OAuth enabled | **CRITICAL** |
| `GOOGLE_REDIRECT_URI` | URL | auto-computed | No | Medium |

### Database (`backend/src/db/database.py`)

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `DATABASE_URL` | URL | `""` (SQLite fallback) | Prod: Yes | **CRITICAL** |
| `SQL_ECHO` | bool | `"false"` | No | Low |
| `DB_POOL_SIZE` | int | `"20"` | No | Low |
| `DB_MAX_OVERFLOW` | int | `"10"` | No | Low |

### Monitoring & Logging

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `SENTRY_DSN` | URL | `""` | No | Medium |
| `ENVIRONMENT` | string | `"development"` | No | Low |
| `VERSION` | string | `"1.0.0"` | No | Low |
| `LOG_LEVEL` | string | `"INFO"` | No | Low |
| `LOG_FORMAT` | string | `"json"` | No | Low |
| `VERBOSE_LOGGING` | bool | `"false"` | No | Low |

### Cache & Queues

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `REDIS_URL` | URL | — | No | High |
| `CELERY_BROKER_URL` | URL | `redis://localhost:6379/0` | No | Medium |
| `CELERY_RESULT_BACKEND` | URL | derived from broker | No | Medium |
| `CACHE_MAX_SIZE` | int | `"10000"` | No | Low |

### TTS

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `TTS_PROVIDER` | string | `"openai"` | No | Low |
| `ELEVENLABS_API_KEY` | secret | `""` | If elevenlabs | High |
| `TTS_CACHE_DIR` | path | `"/tmp/tts_cache"` | No | Low |
| `TTS_CACHE_MAX_AGE` | int | `86400` | No | Low |
| `TTS_CACHE_MAX_SIZE` | int | `524288000` | No | Low |

### Misc

| Variable | Type | Default | Required | Severity |
|----------|------|---------|----------|----------|
| `ALLOWED_ORIGINS` | CSV | auto | No | Medium |
| `PORT` | int | `8000` | No | Low |
| `YTDLP_COOKIES_PATH` | path | `""` | No | Low |
| `LEGAL_OWNER_NAME` | string | default | No | Low |
| `LEGAL_SIRET` | string | default | No | Low |
| `LEGAL_RCS` | string | default | No | Low |
| `LEGAL_CITY` | string | default | No | Low |
| `LEGAL_ADDRESS` | string | default | No | Low |
| `LEGAL_EMAIL` | email | default | No | Low |

---

## Frontend Environment Variables

### Source: `frontend/src/`

| Variable | File(s) | Access | Default | Status |
|----------|---------|--------|---------|--------|
| `VITE_API_URL` | `api.ts`, `useNotifications.ts`, `LoadingWordContext.tsx`, `History.tsx`, `ConceptsGlossary.tsx` | `import.meta.env` | Hardcoded prod URL | **USED** |
| `VITE_SENTRY_DSN` | `sentry.ts` | `import.meta.env` | `""` | Optional |
| `VITE_ENVIRONMENT` | `sentry.ts` | `import.meta.env` | `"development"` | Optional |
| `VITE_GOOGLE_CLIENT_ID` | `vite-env.d.ts` | — | — | Declared, unused |
| `VITE_STRIPE_PUBLIC_KEY` | `vite-env.d.ts` | — | — | Declared, unused |
| `VITE_SUPABASE_URL` | `vite-env.d.ts` | — | — | Declared, unused |
| `VITE_SUPABASE_ANON_KEY` | `vite-env.d.ts` | — | — | Declared, unused |

### Hardcoded Values (frontend)

| Value | Files | Risk |
|-------|-------|------|
| `https://deep-sight-backend-v3-production.up.railway.app` | 5 files as fallback URL | Medium — prod URL in source |
| `maximeleparc3@gmail.com` | `AdminPage.tsx`, `LegalPage.tsx`, `Sidebar.tsx` | Medium — personal email |

### Exposed Token

| File | Variable | Risk |
|------|----------|------|
| `frontend/.env.local` | `VERCEL_OIDC_TOKEN` | High — JWT token committed |

---

## Mobile Environment Variables

### Source: `mobile/src/`

The mobile app has **NO `.env` system**. All config is in `src/constants/config.ts`.

| Value | Type | Risk |
|-------|------|------|
| `https://deep-sight-backend-v3-production.up.railway.app` | API URL | Medium |
| `763654536492-8hkdd3...` (web) | Google OAuth Client ID | Medium |
| `763654536492-v1tod4...` (Android) | Google OAuth Client ID | Medium |
| `763654536492-riumsq...` (iOS) | Google OAuth Client ID | Medium |

### Build Config (`eas.json`)

| Value | Risk |
|-------|------|
| `maxime.fonira@hotmail.fr` (Apple ID) | Medium — personal email |
| `XGPXQ9KQ2G` (Apple Team ID) | Medium |
| `6740487498` (ASC App ID) | Medium |

---

## Test vs Live Key Analysis

### Stripe Keys
- No `sk_test_*` or `sk_live_*` prefixed keys found hardcoded in any file.
- Keys are properly loaded from env vars (`STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`).
- `STRIPE_TEST_MODE` controls which key is used.
- **Issue**: `get_stripe_key()` falls back from test to live key silently. This should be blocked in production.

### Stripe Price IDs
- Live price IDs (`price_1SiJDd...`, `price_1SiJDx...`, `price_1SiJEc...`) are hardcoded as defaults in `config.py:89,94,99`.
- Test price IDs default to empty string.
- **Fix**: Move all price IDs to env vars only.

### Production Safety
- **No guard** prevents the app from starting with test Stripe keys in production.
- **No validation** ensures critical secrets are set before serving requests.
- `ADMIN_PASSWORD` and `ADMIN_SECRET_KEY` fall back to insecure defaults silently.

---

## Recommendations

### P0 — Immediate (Security)

1. Remove all hardcoded secret defaults from `config.py` (admin password, secret key)
2. Remove hardcoded DB URL from `optimizations.py`
3. Add Pydantic Settings validation that fails on missing critical vars in production
4. Add production guard: reject `STRIPE_TEST_MODE=true` when `ENV=production`
5. Add production guard: reject weak `JWT_SECRET_KEY` / `ADMIN_SECRET_KEY`
6. Rotate the Vercel OIDC token in `frontend/.env.local` (add to `.gitignore`)

### P1 — Short Term

7. Create `.env.example` files for backend, frontend, and mobile
8. Move Stripe live price IDs to env vars (no hardcoded defaults)
9. Move hardcoded production API URLs to env vars in frontend/mobile
10. Extract `maximeleparc3@gmail.com` to env var (`VITE_ADMIN_EMAIL`)

### P2 — Medium Term

11. Add `git-secrets` or similar pre-commit hook
12. Implement secret rotation policy for JWT keys
13. Create `app.config.js` for mobile to support env-var-based config
14. Remove unused Supabase env var declarations from `vite-env.d.ts`

---

## Files Modified by This Audit

| File | Change |
|------|--------|
| `backend/src/core/config.py` | Pydantic Settings + production guards + removed hardcoded secrets |
| `backend/src/db/optimizations.py` | Removed hardcoded DB URL default |
| `backend/.env.example` | Created with all variables grouped |
| `frontend/.env.example` | Created with all variables |
| `docs/env-audit.md` | This report |
