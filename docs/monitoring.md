# Monitoring System

## Overview

DeepSight includes a built-in monitoring system with three components:

1. **Health endpoints** — backend API routes reporting service status
2. **Status page** — public frontend page at `/status`
3. **Background alerts** — scheduled job that emails the admin on outages

## Backend Endpoints

### `GET /api/health/ping`

Lightweight liveness probe. Always returns:

```json
{"status": "ok"}
```

### `GET /api/health/status`

Full system status with per-service health, latency, version, and uptime.

```json
{
  "status": "operational",
  "version": "4.0.0",
  "uptime_seconds": 86400.5,
  "services": [
    {"name": "database", "status": "operational", "latency_ms": 2.3, "message": null, "last_checked": "..."},
    {"name": "stripe", "status": "operational", "latency_ms": 150.2, "message": null, "last_checked": "..."},
    {"name": "mistral", "status": "operational", "latency_ms": 85.7, "message": null, "last_checked": "..."},
    {"name": "perplexity", "status": "degraded", "latency_ms": null, "message": "API key not configured", "last_checked": "..."}
  ],
  "checked_at": "2026-02-10T12:00:00+00:00"
}
```

Both endpoints are **public** (no auth), **excluded from rate limiting**, and **skip auth** on the frontend.

## Health Checks

| Service | Method | Cost |
|---------|--------|------|
| Database | `SELECT 1` via async session | Free |
| Stripe | `stripe.Account.retrieve()` | Free |
| Mistral | `GET /v1/models` with API key | Free |
| Perplexity | `POST /chat/completions` with `max_tokens=1` | ~$0.001/day |

All checks run concurrently via `asyncio.gather()`. Each has its own try/except and never propagates failures.

### Status values

- **operational** — service is healthy
- **degraded** — key not configured or non-200 response
- **down** — exception during check

## Background Scheduler

A job runs every **5 minutes** via APScheduler (same instance as backups).

- Logs: `Monitoring: X/4 services operational`
- Sends alert email to `ADMIN_CONFIG["ADMIN_EMAIL"]` when a service goes down
- Sends recovery email when a service comes back up
- **30-minute cooldown** per service to avoid alert fatigue
- Uses `EmailService.send_email()` with inline HTML (dark theme)

## Frontend Status Page

Route: `/status` (public, no auth required)

Features:
- Polls `/api/health/status` every 30 seconds
- Overall status banner (green/orange/red)
- 2x2 grid of service cards with icons, status dot, latency
- Uptime display (Xd Xh Xm)
- Countdown to next check
- Error state with manual retry button
- Framer Motion entrance animations
- Uses CSS variables from `index.css`

## Files

| File | Purpose |
|------|---------|
| `backend/src/monitoring/__init__.py` | Module init |
| `backend/src/monitoring/checks.py` | Health check functions |
| `backend/src/monitoring/router.py` | FastAPI router (`/ping`, `/status`) |
| `backend/src/monitoring/scheduler.py` | Background job + alert emails |
| `backend/src/main.py` | Wires router, scheduler, rate limiter exclusions |
| `frontend/src/services/api.ts` | `statusApi` with `getStatus()` and `ping()` |
| `frontend/src/pages/StatusPage.tsx` | Public status page |
| `frontend/src/App.tsx` | `/status` route |

## Verification

```bash
# Ping
curl localhost:8000/api/health/ping
# → {"status":"ok"}

# Full status
curl localhost:8000/api/health/status
# → {status, version, uptime_seconds, services[], checked_at}

# Frontend
open http://localhost:5173/status
```
