# DeepSight Production Runbook

_Live operations playbook — Hetzner VPS `clawdbot` (89.167.23.214)._
_Last reviewed: 2026-05-05 — owner: @maximeleparc3._

---

## Table of contents

1. [Quick diagnostic](#1-quick-diagnostic)
2. [Backend container — logs, health, restart](#2-backend-container)
3. [Rollback](#3-rollback)
4. [Database — backups, restore, slow queries](#4-database)
5. [Smoke tests](#5-smoke-tests)
6. [pg_stat_statements activation](#6-pg_stat_statements-activation)
7. [Sentry sourcemaps — Vercel env check](#7-sentry-sourcemaps-vercel-env-check)
8. [UptimeRobot setup](#8-uptimerobot-setup)
9. [Stripe Tax activation](#9-stripe-tax-activation)
10. [Chrome Web Store submission checklist](#10-chrome-web-store-submission-checklist)
11. [Branch protection — main](#11-branch-protection-main)
12. [Helpdesk (Crisp)](#12-helpdesk-crisp)
13. [On-call routine](#13-on-call-routine)
14. [Incident postmortem template](#14-incident-postmortem-template)
15. [Contacts & escalation](#15-contacts--escalation)

---

## 1. Quick diagnostic

When prod is misbehaving, run these in order. Each one is non-destructive.

```bash
# SSH into the VPS
ssh -i ~/.ssh/id_hetzner root@89.167.23.214

# 1. Container state — anything not "Up" is a smoking gun
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'

# 2. Backend errors in last 100 lines
docker logs repo-backend-1 --tail 100 2>&1 | grep -iE 'error|traceback|exception|critical|failed'

# 3. Health from inside the container (bypasses Caddy)
docker exec repo-backend-1 curl -s http://localhost:8080/health

# 4. Health from the public endpoint (through Caddy)
curl -fsS https://api.deepsightsynthesis.com/health

# 5. Disk + memory
df -h /
free -h
```

If `docker ps` shows missing containers, jump to [§3 Rollback](#3-rollback).
If logs show `OperationalError` / `ConnectionRefusedError` Postgres → [§4 Database](#4-database).
If health returns 502/504 from Caddy but localhost works → Caddy bind-mount inode bug (cf. memory `reference_caddy-bind-mount-inode-bug.md`).

---

## 2. Backend container

### Tail live logs

```bash
docker logs repo-backend-1 -f --tail 50
```

### Restart without rebuild

```bash
docker restart repo-backend-1
# Wait ~30s for health check to pass
docker exec repo-backend-1 curl -s http://localhost:8080/health
```

### Force rebuild (e.g. after dependency change)

The CI deploy workflow does this automatically on push to `main`. To trigger
manually:

```bash
gh workflow run deploy-backend.yml
# Or from VPS directly (skip CI):
cd /opt/deepsight/repo
git pull
docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile backend
docker stop repo-backend-1 && docker rm repo-backend-1
docker run -d --name repo-backend-1 \
  --network repo_deepsight --network-alias backend \
  --env-file /opt/deepsight/repo/.env.production \
  --restart unless-stopped -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest
```

The container's `entrypoint.sh` runs `alembic upgrade head` automatically
before uvicorn starts. If alembic fails, the container still starts (so the
API stays up) — investigate via `docker logs repo-backend-1 | head -50`.

---

## 3. Rollback

The deploy workflow tags the previous image as `deepsight-backend:previous`
on every successful build. If the smoke test fails post-deploy, the workflow
auto-rollbacks. Manual rollback:

```bash
# On the VPS
docker tag deepsight-backend:previous deepsight-backend:latest
docker stop repo-backend-1 && docker rm repo-backend-1
docker run -d --name repo-backend-1 \
  --network repo_deepsight --network-alias backend \
  --env-file /opt/deepsight/repo/.env.production \
  --restart unless-stopped -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest

# Verify
curl -fsS https://api.deepsightsynthesis.com/health
```

If `:previous` is also broken, pull a known-good SHA from the registry or
rebuild from a clean commit (`git checkout <good-sha> && docker build ...`).

---

## 4. Database

### Daily backups

`db-backup.yml` runs every day at 03:00 UTC and uploads to AWS S3 (30-day
retention) + Cloudflare R2 (redundancy). Artifact also kept 7 days in
GitHub Actions runs. Script: `backend/scripts/backup_db.py`.

Verify last backup:

```bash
# List recent S3 backups
aws s3 ls s3://${BACKUP_S3_BUCKET}/ --recursive | tail -5
# Or check GitHub Actions
gh run list --workflow=db-backup.yml --limit 5
```

### Restore from backup

```bash
# 1. Download the backup
aws s3 cp s3://${BACKUP_S3_BUCKET}/backup_YYYYMMDD.sql.gz /tmp/

# 2. Stop backend (so no writes during restore)
docker stop repo-backend-1

# 3. Restore (DESTRUCTIVE — this drops + recreates the DB)
gunzip -c /tmp/backup_YYYYMMDD.sql.gz | \
  docker exec -i repo-postgres-1 psql -U deepsight -d deepsight

# 4. Restart backend
docker start repo-backend-1

# 5. Verify
docker exec repo-backend-1 curl -s http://localhost:8080/health
docker exec repo-postgres-1 psql -U deepsight -d deepsight \
  -c "SELECT COUNT(*) FROM users;"
```

See `docs/backup-restore.md` for the full procedure including pre-flight
checks and dry-run on a staging DB.

### Slow queries (after pg_stat_statements is enabled — §6)

```sql
-- Top 20 slowest queries by total time
SELECT
  ROUND((total_exec_time / 1000)::numeric, 2) AS total_seconds,
  calls,
  ROUND((mean_exec_time)::numeric, 2) AS mean_ms,
  LEFT(query, 100) AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## 5. Smoke tests

Post-deploy smoke runs automatically in `smoke-on-deploy.yml`. To run on
demand:

```bash
# Locally
gh workflow run smoke-tests.yml

# Or curl manually
curl -fsS https://api.deepsightsynthesis.com/health
curl -fsS https://www.deepsightsynthesis.com
curl -fsS https://api.deepsightsynthesis.com/api/health/db
```

E2E Playwright suite (15 specs) — locally:

```bash
cd frontend
npx playwright test e2e/auth-complete.spec.ts
npx playwright test e2e/voice-call.spec.ts
```

---

## 6. pg_stat_statements activation

Status: **scaffolded but not yet enabled on prod** (existing volume).

The compose now mounts `deploy/hetzner/postgres-init/` to
`/docker-entrypoint-initdb.d/` and sets
`shared_preload_libraries=pg_stat_statements`. New init = ext is created
automatically. **Existing prod = manual one-time activation:**

```bash
# 1. SSH VPS
ssh root@89.167.23.214

# 2. Apply the new compose (will recreate postgres with the new command).
#    DOWNTIME ~5-10s. Pick a low-traffic moment.
cd /opt/deepsight/repo
docker compose -f deploy/hetzner/docker-compose.yml up -d postgres

# 3. Create the extension (one-time, on the existing DB)
docker exec -it repo-postgres-1 psql -U deepsight -d deepsight \
  -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# 4. Verify
docker exec repo-postgres-1 psql -U deepsight -d deepsight \
  -c "SELECT count(*) FROM pg_stat_statements;"
```

---

## 7. Sentry sourcemaps — Vercel env check

The Vite plugin in `frontend/vite.config.ts` uploads sourcemaps on prod
builds **only if** these env vars are set in Vercel:

- `SENTRY_AUTH_TOKEN` (required)
- `SENTRY_ORG` (required)
- `SENTRY_PROJECT` (required)

Check from local CLI:

```bash
cd frontend
vercel env ls production | grep SENTRY
```

If missing, add them via Vercel Dashboard → Project Settings → Environment
Variables, or:

```bash
vercel env add SENTRY_AUTH_TOKEN production
vercel env add SENTRY_ORG production
vercel env add SENTRY_PROJECT production
# Trigger a redeploy to apply
vercel --prod
```

Verify uploads landed: Sentry → Project → Source Maps tab → most recent
release should match the latest commit SHA.

---

## 8. UptimeRobot setup

Free tier covers 50 monitors @ 5-min interval. Setup:

1. Sign up at <https://uptimerobot.com> (use ops@deepsightsynthesis.com).
2. Create monitors:
   - `DeepSight API health` — `https://api.deepsightsynthesis.com/health`
   - `DeepSight web` — `https://www.deepsightsynthesis.com`
   - `DeepSight Caddy SSL` — keyword monitor on `https://www.deepsightsynthesis.com` keyword `DeepSight`
3. Alert contacts: email maxime@deepsightsynthesis.com + Telegram via Bot
   (use the same `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` already in
   GitHub secrets).
4. Public status page: enable in UptimeRobot settings, custom domain
   `status.deepsightsynthesis.com` (CNAME → stats.uptimerobot.com).

---

## 9. Stripe Tax activation

Status: **code wired (`STRIPE_AUTOMATIC_TAX_ENABLED=False` default)**, awaiting
Stripe Dashboard activation.

1. Stripe Dashboard → **Tax** → Activate.
2. Set tax registration for France (origin) + EU OSS (destination).
3. Verify Stripe Tax computes correctly using a TEST checkout in Test mode.
4. Set the env var in Hetzner `.env.production`:
   ```
   STRIPE_AUTOMATIC_TAX_ENABLED=true
   ```
5. Restart backend: `docker restart repo-backend-1`.
6. Trigger a real checkout from `/upgrade`, verify the invoice shows the
   correct VAT line.
7. Extend `automatic_tax` to the remaining 5 Stripe Checkout calls in
   `backend/src/billing/router.py` and 1 call in `voice_packs_router.py`
   (currently only the main `/create-checkout` is wired).

---

## 10. Chrome Web Store submission checklist

Extension ZIP is ready (`~/Documents/deepsight-extension-v14-doodles.zip`).

Submission steps:

1. <https://chrome.google.com/webstore/devconsole>
2. Pay one-time $5 dev fee if not already done.
3. Upload ZIP. Required listing assets:
   - **Icon 128×128** (public/icon-128.png — already in dist).
   - **Screenshots** — 3-5 × 1280×800 (or 640×400). Capture analyzing a
     YouTube video, the Quick Voice Call, the side panel.
   - **Promo tile** 440×280 (small) and optionally 920×680 (large).
   - **Description** — 132 chars short summary + 16k chars detailed.
   - **Single purpose** — "Analyse and chat about YouTube/TikTok videos
     with AI."
   - **Privacy practices**: justify each permission individually
     (host_permissions, storage, identity, etc.).
   - **Privacy Policy URL**: `https://www.deepsightsynthesis.com/legal/privacy`.
4. Choose visibility: **Public** — region: worldwide.
5. Submit for review (typical wait: 1-3 business days).

---

## 11. Branch protection — main

Configure in GitHub UI: <https://github.com/Fonira/DeepSight-Main/settings/branches>

Required settings:

- ✅ Require a pull request before merging
  - Required approvals: **1**
- ✅ Require status checks to pass before merging
  - Required: `Backend CI / test`, `Frontend CI / test`,
    `Mobile CI / test`, `Extension CI / test`, `gitleaks / scan`
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings (admins included)
- ❌ Allow force pushes — **off**
- ❌ Allow deletions — **off**

---

## 12. Helpdesk (Crisp)

Crisp is wired in `frontend/src/components/CrispChat.tsx` (loaded from
`App.tsx`). To configure:

1. Sign in at <https://app.crisp.chat/>.
2. Settings → Website Settings → Identification → copy the website ID.
3. Set `VITE_CRISP_WEBSITE_ID` in Vercel env (production + preview).
4. Redeploy. Verify the bubble appears bottom-right on landing.
5. Enable triggers (e.g. proactive message after 30s on /upgrade).

---

## 13. On-call routine

**Daily (5 min):**
- Check UptimeRobot dashboard.
- Check Sentry → Issues → New since yesterday.
- Check Stripe → Payments failed.

**Weekly (15 min):**
- Review GitHub Actions deploy success rate.
- Check S3 backups exist for the last 7 days.
- Check disk + RAM usage on Hetzner: `ssh root@89.167.23.214 'df -h && free -h'`.

**Monthly (30 min):**
- Review and merge Dependabot PRs.
- Run a restore drill on staging DB (cf. §4).
- Audit recent admin actions: `docker exec repo-postgres-1 psql -U deepsight \
  -c "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT 20;"`.

---

## 14. Incident postmortem template

After any P0 incident, fill out this template and store as
`docs/postmortems/YYYY-MM-DD-<slug>.md`.

```markdown
# Postmortem: <short title>

- **Date:** YYYY-MM-DD HH:MM UTC
- **Duration:** XX minutes
- **Severity:** P0 / P1 / P2
- **Author:** <name>

## Summary
1-2 sentences. What happened, who was affected, how it ended.

## Timeline (UTC)
- HH:MM — alert fired (UptimeRobot / Sentry / user report)
- HH:MM — engineer paged
- HH:MM — root cause identified
- HH:MM — fix deployed
- HH:MM — verified healthy

## Root cause
What actually broke and why.

## Impact
- Users affected: ~N
- Revenue lost: ~€X (Stripe failed payments)
- Data lost: yes/no — what

## What went well
- ...

## What went wrong
- ...

## Action items
- [ ] Owner — fix the immediate bug
- [ ] Owner — add monitoring/alerting to catch sooner next time
- [ ] Owner — update runbook
```

---

## 15. Contacts & escalation

- **Owner**: Maxime — maxime@deepsightsynthesis.com
- **Hetzner**: support@hetzner.com (response ~1h business)
- **Vercel**: support via dashboard, paid plan = 4h SLA
- **Stripe**: dashboard chat (24/7 for live mode)
- **Mistral**: support@mistral.ai
- **Resend**: support@resend.com
- **Cloudflare** (R2 backup): dashboard ticket
- **DNS** (Cloudflare): same dashboard
- **Apple Developer**: 6740487498 → developer.apple.com support
- **Google Play**: console support
- **GitHub** (repo + Actions): support@github.com

---

## §16 Centralized logs (Axiom)

### Why

Without a log drain, the only way to investigate a prod issue is `ssh root@89.167.23.214 && docker logs repo-backend-1`. That gives ephemeral output, no full-text query, no retention beyond Docker's rotation, and no cross-container correlation. Axiom.co solves all three with a free tier (500 GB/month) that easily covers our current volume.

### What is shipped

The backend logger (`core.logging.DeepSightLogger`) attaches an extra handler — `AxiomHandler` (`backend/src/core/axiom_handler.py`) — whenever `AXIOM_TOKEN` and `AXIOM_DATASET_NAME` are both set. Every existing `logger.info(...) / logger.error(...) / logger.exception(...)` call across the backend is then duplicated to Axiom (stdout still emits the same line — Axiom is **additive**, not a replacement).

Each event is a JSON object with:

| Field         | Type    | Source                                                                                |
| ------------- | ------- | ------------------------------------------------------------------------------------- |
| `_time`       | string  | ISO 8601 UTC, set at emit time (Axiom convention).                                    |
| `level`       | string  | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL`.                                  |
| `logger`      | string  | Logger name (`deepsight`, `deepsight.video`, `deepsight.billing`, …).                 |
| `message`     | string  | Human-readable message.                                                               |
| `service`     | string  | `deepsight-api` (overridable via `SERVICE_NAME`).                                     |
| `environment` | string  | Value of `ENVIRONMENT` (or `ENV`), e.g. `production`.                                 |
| `version`     | string  | Value of `VERSION` env var.                                                           |
| `location`    | object  | `{ file, line, function }` of the log call site.                                      |
| `request_id`  | string  | Set by `core.middleware.LoggingMiddleware` (correlates lines of the same HTTP req).   |
| `user_id`     | int     | Set by middleware after auth.                                                         |
| `user_email`  | string  | Same.                                                                                 |
| `extra`       | object  | All `**kwargs` passed to `logger.info(...)` (e.g. `video_id`, `duration_ms`).         |
| `exception`   | object  | `{ type, message, traceback }` when called with `exc_info=True` or `logger.exception()`. |

The handler is **async, non-blocking, drop-on-error**:

- Records go through a bounded in-memory `queue.Queue` (10 000 max).
- A daemon thread (`axiom-log-drain`) batches up to 100 records and flushes every 5 s, whichever comes first.
- HTTP failures retry up to 2 times with linear backoff, then drop the batch (we never block the request path).
- If `httpx` is unavailable, if the queue is full, or if the Axiom API errors persistently, the handler silently increments a counter and moves on — the FastAPI request never sees it.

Per-log overhead at the call site is **< 0.5 ms** (a single `queue.put_nowait`). The actual HTTP cost is paid on the worker thread.

### Activation (Hetzner production)

1. Sign up at https://axiom.co (free tier, EU region available).
2. Create a dataset named `deepsight-prod` (or any name — we just need the slug).
3. Create an **API token** in `Settings → API Tokens` with `Ingest` permission scoped to that dataset. Tokens look like `xaat-xxxx`.
4. SSH the VPS and edit `/opt/deepsight/repo/.env.production`:

   ```env
   AXIOM_TOKEN=xaat-xxxxxxxxxxxxxxxxxxxxx
   AXIOM_DATASET_NAME=deepsight-prod
   # AXIOM_INGEST_URL=https://api.axiom.co  # default; set https://api.eu.axiom.co for EU region
   ```

5. Recreate the backend container so it picks up the new env:

   ```bash
   ssh root@89.167.23.214 'docker restart repo-backend-1'
   ```

6. Generate a test event:

   ```bash
   ssh root@89.167.23.214 'docker exec repo-backend-1 curl -s http://localhost:8080/api/health/status'
   ```

7. Open the Axiom dashboard, navigate to the dataset, you should see the events within ~5 s.

To **disable** the drain at any time, comment out (or delete) `AXIOM_TOKEN` and `docker restart repo-backend-1`. The handler becomes a no-op on the next start.

### Querying

Axiom uses APL (Axiom Processing Language), SQL-like:

```apl
['deepsight-prod']
| where level == "ERROR"
| where _time > ago(1h)
| project _time, message, location.file, request_id, user_id
```

Common queries:

```apl
// All errors for one user in the last 24h
['deepsight-prod'] | where user_id == 42 and level == "ERROR" | order by _time desc

// Slow requests (custom field set by core.middleware.PerformanceMiddleware)
['deepsight-prod'] | where extra.duration_ms > 5000 | summarize count() by extra.path

// Trace a single request across the stack
['deepsight-prod'] | where request_id == "abc123-…" | order by _time asc
```

### Verifying the integration locally (without prod token)

You don't need a real token to assert the wiring. Use the `is_axiom_configured()` and `install_axiom_handler()` helpers:

```bash
# Negative path — no token, handler should be a no-op
cd backend
python -c "
from core.axiom_handler import is_axiom_configured, install_axiom_handler
import logging
print('configured?', is_axiom_configured())  # → False
log = logging.getLogger('demo')
print('handler:', install_axiom_handler(log))  # → None
"

# Positive path — set fake env vars, handler should attach
AXIOM_TOKEN=xaat-fake AXIOM_DATASET_NAME=test python -c "
from core.axiom_handler import is_axiom_configured, install_axiom_handler
import logging
print('configured?', is_axiom_configured())  # → True
log = logging.getLogger('demo')
log.setLevel(logging.INFO)
h = install_axiom_handler(log)
print('handler attached:', h is not None)  # → True
log.info('hello axiom')
import time; time.sleep(0.5)
print('stats:', h.stats)  # queue should drain (will fail HTTP — that's fine)
"
```

The second command will queue 1 record, attempt the POST against the fake token, get a 401 from Axiom, and increment `dropped_http_error`. **No exception is raised** — that is the contract.

You can also smoke-test against a real Axiom dataset with curl directly:

```bash
curl -X POST "https://api.axiom.co/v1/datasets/deepsight-prod/ingest" \
  -H "Authorization: Bearer $AXIOM_TOKEN" \
  -H "Content-Type: application/json" \
  -d '[{"_time":"'"$(date -u +%FT%TZ)"'","level":"INFO","message":"manual test","service":"manual"}]'
```

A `200 OK` confirms the token + dataset combo works.

### Operational tips

- **Log volume sanity check**: in the Axiom dashboard under `Settings → Usage`, watch monthly ingest. Free tier = 500 GB/month. Our current peak (~150 req/s) emits roughly 10–30 KB/s of structured logs → ~30 GB/month, well under quota.
- **PII**: `user_email` is included to ease support workflows. Axiom signs a DPA on request — confirm before keeping the field on long-retention datasets. To redact, edit `_record_to_payload()` in `axiom_handler.py`.
- **Sentry coexistence**: Sentry stays the source of truth for **exceptions** (with stack traces, breadcrumbs, releases, source maps). Axiom is the source of truth for **flow logs** (every INFO line, every middleware checkpoint). Don't migrate Sentry — they solve different problems.
- **Caddy access logs**: this section covers the backend Python logger only. Caddy still writes its access log to `/data/logs/access.log` inside `repo-caddy-1` (bind-mounted to the host). A second drain for Caddy → Axiom is intentionally **out of scope** for this iteration because of the known Caddyfile bind-mount inode desync bug (see §8) — the backend Python logs cover ~95% of the diagnostic value.

### Troubleshooting

| Symptom                                                       | Likely cause                                                                                       | Fix                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| No events appear in Axiom after `docker restart`              | `AXIOM_TOKEN` or `AXIOM_DATASET_NAME` empty in `.env.production`.                                  | Re-edit `.env.production`, ensure both are set, restart container.                           |
| Events appear briefly then stop                               | Quota exceeded or token revoked.                                                                   | Check Axiom usage page; rotate token.                                                        |
| `dropped_queue_full` keeps climbing                           | Worker thread can't keep up (rare — would require ~2 000 req/s sustained).                         | Increase `DEFAULT_QUEUE_MAXSIZE` in `axiom_handler.py` or shorten `DEFAULT_FLUSH_INTERVAL_S`. |
| `dropped_http_error` keeps climbing                           | Network egress blocked or Axiom 5xx.                                                               | Check `https://status.axiom.co`. Verify `curl -v https://api.axiom.co` from the container.   |
| Backend boots but no logs reach Axiom (and Sentry works)      | `httpx` import failed inside the worker (extremely unlikely — Sentry uses `httpx` too).            | `docker exec repo-backend-1 pip show httpx`.                                                 |
| Log lines show in stdout but `request_id` is empty in Axiom   | Log emitted outside an HTTP request (e.g. APScheduler job, startup banner). Expected. Filter accordingly. | n/a                                                                                          |

### Files involved

| Path                                          | Role                                                |
| --------------------------------------------- | --------------------------------------------------- |
| `backend/src/core/axiom_handler.py`           | Async HTTP handler implementation.                  |
| `backend/src/core/logging.py`                 | Calls `install_axiom_handler()` from `__init__`.    |
| `backend/src/core/config.py`                  | Declares `AXIOM_TOKEN`, `AXIOM_DATASET_NAME`, etc.  |
| `deploy/hetzner/caddy/Caddyfile`              | Untouched in this iteration (see §8 reasoning).     |
| `.env.production` (on VPS, **not** in repo)   | Where you put the actual token.                     |

### Future work

- Drain Caddy access logs via the `caddy-axiom` plugin or a sidecar `vector` container. Skipped here to avoid touching the Caddyfile bind-mount.
- Add a `/api/admin/axiom-stats` endpoint that surfaces `get_axiom_stats()` so we can graph drop rates without SSH.
- Pipe APScheduler job heartbeats with a stable `job_id` field for easier alerting on missed backups.

---

## 17. Sentry alert rules

Sentry alerts for the 4 platforms (backend / frontend / mobile / extension)
are provisioned **programmatically** by
`backend/scripts/setup_sentry_alerts.py`. Rule definitions live in
`backend/scripts/sentry_alerts_config.py` (single source of truth).

The script is idempotent: it matches existing rules by `(name, project)`
and updates them in place, so it can be re-run safely after a threshold
change.

### 17.1 Setting up the auth token (one-time per machine)

1. Go to <https://sentry.io/settings/account/api/auth-tokens/>.
2. Click **Create New Token**.
3. Required scopes:
   - `project:read`
   - `project:write`
   - `alerts:read`
   - `alerts:write`
4. Copy the token and export it locally:

   ```bash
   export SENTRY_AUTH_TOKEN=sntrys_…
   ```

   For permanent CI use, store it as a GitHub repository secret named
   `SENTRY_AUTH_TOKEN`.

5. Find the org and project slugs in the Sentry URL bar
   (`https://sentry.io/organizations/<ORG_SLUG>/projects/<PROJECT_SLUG>/`).

   ```bash
   export SENTRY_ORG_SLUG=deepsight
   export SENTRY_PROJECT_SLUG_BACKEND=deepsight-backend
   export SENTRY_PROJECT_SLUG_FRONTEND=deepsight-frontend
   export SENTRY_PROJECT_SLUG_MOBILE=deepsight-mobile
   ```

### 17.2 Activating the Telegram integration (one-time)

The Telegram integration must be installed manually on the Sentry org
before the script can route alerts to Telegram.

1. Open <https://sentry.io/settings/integrations/telegram/>.
2. Click **Add Installation**. Sentry asks for a Telegram bot token; reuse
   the existing DeepSight bot (`TELEGRAM_BOT_TOKEN` already used by the
   deploy workflow) or create a dedicated one with **@BotFather**.
3. After install, open the integration page and copy the **Installation
   ID** displayed in the URL or in the integration's settings panel
   (numeric string, e.g. `123456`).
4. Export it before running the script:

   ```bash
   export TELEGRAM_INTEGRATION_INSTALLATION_ID=123456
   ```

5. Add the bot to the destination chat (`TELEGRAM_CHAT_ID`) so it can
   post messages. Use **@deepsight_alerts_bot** with **/start** in the
   target chat or group.

If `TELEGRAM_INTEGRATION_INSTALLATION_ID` is unset the script falls back
to the default Sentry **email** action — alerts still fire, they just
don't reach Telegram.

### 17.3 Running the script

```bash
cd backend

# Preview the changes without writing.
python scripts/setup_sentry_alerts.py --dry-run --project all

# Apply to all projects (default scope).
python scripts/setup_sentry_alerts.py --project all

# Or scope to a single Sentry project.
python scripts/setup_sentry_alerts.py --project backend
python scripts/setup_sentry_alerts.py --project frontend
python scripts/setup_sentry_alerts.py --project mobile

# Inspect the resolved rule definitions as JSON (no API calls).
python scripts/setup_sentry_alerts.py --show-config | jq .
```

The script prints a table summarising each rule's project, kind (issue
vs metric), criticality, action (`created` / `updated` / `FAILED`), and
the resulting Sentry rule ID. Failures of one rule do not abort the
others.

### 17.4 Provisioned alert rules

The 6 rules below are defined in `sentry_alerts_config.py`. Adjust the
numeric thresholds in that file and re-run the script to roll changes
out.

| #   | Project   | Name                                 | Threshold                                        | Window | Criticality |
| --- | --------- | ------------------------------------ | ------------------------------------------------ | ------ | ----------- |
| 1   | backend   | HTTP 500 spike (>10/h)               | `>10` ERROR-level events                         | 1h     | high        |
| 2   | backend   | Latency p95 > 5s                     | `p95(transaction.duration) > 5000 ms`            | 5min   | high        |
| 3   | backend   | Sentry quota approaching (80%)       | `>800` events in 24h (≈80% of daily allotment)   | 24h    | low         |
| 4   | frontend  | Issue affecting >5 users (1h)        | `>5` unique users on a single issue              | 1h     | high        |
| 5   | frontend  | Browser error rate (>100/h)          | `>100` events with `exception` payload           | 1h     | medium      |
| 6   | mobile    | Crash rate > 1% (24h)                | `percentage(sessions_crashed, sessions) > 1.0`   | 24h    | high        |

### 17.5 Adjusting thresholds

1. Edit `backend/scripts/sentry_alerts_config.py`. Each rule is a
   frozen dataclass — change the value, save the file.
2. Re-run with `--dry-run` to verify the diff is what you expect.
3. Re-run without `--dry-run` to apply. The script matches by `name`
   so the existing Sentry rule is updated in place.
4. Commit the config change so the next operator picks up the same
   threshold.

### 17.6 Adding a new rule

1. Append a new `IssueAlertRule(...)` or `MetricAlertRule(...)` to
   `build_rules()` in `sentry_alerts_config.py`.
2. Pick a unique `name` (used as the idempotence key).
3. Run the script with `--dry-run`, then for real.

### 17.7 Removing a rule

The script never deletes rules (by design — operator can disable any
alert in the Sentry UI without losing automation history). To purge
a rule definitively:

1. Remove the entry from `sentry_alerts_config.py`.
2. Delete the rule manually in the Sentry UI (Project → Alerts → ⋯ → Delete).
3. Commit the config change.

### 17.8 Required GitHub Actions secrets (future CI integration)

If the script is later wired into a workflow:

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG_SLUG`
- `SENTRY_PROJECT_SLUG_BACKEND`
- `SENTRY_PROJECT_SLUG_FRONTEND`
- `SENTRY_PROJECT_SLUG_MOBILE`
- `TELEGRAM_INTEGRATION_INSTALLATION_ID` (optional)

Use `gh secret set <NAME>` to set them.

---

## 18. Cloudflare WAF + DNS proxy on `api.deepsightsynthesis.com`

> **Sprint Scalability — Chantier A (audit P0).** Mitigates DDoS, brute-force,
> and OWASP-class threats by putting Cloudflare's edge in front of the Hetzner
> single-VPS backend.

### 18.1 — Why

The Hetzner VPS (`89.167.23.214`, 16 GB RAM) is currently the only hop between
the public internet and the FastAPI backend. Issues this section addresses:

- **Unfiltered DDoS** — a script kiddie can saturate the VPS via SSL handshake
  flood, slow-loris, GET spam.
- **No global rate limiting that survives backend down-time** — the FastAPI
  Redis-backed limiter only protects when the backend is up.
- **No WAF in front** — SQL injection / OWASP top 10 reach the application.

The mitigation is to move `api.*` from DNS-only to Cloudflare-proxied (orange
cloud) and apply WAF custom rules + rate-limit rules + edge cache rules. Stripe
webhooks and Caddy auto-SSL must continue to function.

### 18.2 — Architecture after rollout

```
Internet
    |
    v
Cloudflare edge (WAF + rate limit + cache)
    |  (only on api.deepsightsynthesis.com)
    v
Hetzner VPS 89.167.23.214
    |  port 80/443
    v
Caddy (auto-SSL Let's Encrypt, reverse proxy)
    |
    v
FastAPI 4 workers (port 8080)
```

`www.deepsightsynthesis.com` keeps Vercel's edge in front (unchanged).

### 18.3 — Pre-requisites

- The zone `deepsightsynthesis.com` is already managed by Cloudflare
  (confirmed by sub-processors note: "Cloudflare R2 — backups").
- Cloudflare plan : Free is enough for custom rules and 1 cache rule, but
  rate-limiting requires **at least Pro tier** for advanced thresholds.
  → If on Free plan, the rate-limit upserts will fail gracefully; the script
  reports `failed` and continues with WAF + cache.
- An SSH-reachable Caddy that already serves a valid Let's Encrypt cert on
  `api.deepsightsynthesis.com` (current state in production).

### 18.4 — Manual steps in Cloudflare dashboard (one-time)

These can NOT be done via the script — they are zone-level toggles.

1. **Bascule DNS proxy on `api`**
   - Dashboard > zone `deepsightsynthesis.com` > **DNS** > Records
   - Find the `A` record `api -> 89.167.23.214`
   - Toggle the proxy status from **DNS only (grey cloud)** to **Proxied (orange cloud)**
   - Save

2. **SSL/TLS mode = Full (strict)**
   - Dashboard > zone > **SSL/TLS** > Overview
   - Set encryption mode to **Full (strict)** (not Flexible, not Full)
   - Reason : Caddy already serves a valid Let's Encrypt cert on origin.
     Cloudflare will validate it. Flexible mode would downgrade origin to
     plain HTTP and break HSTS guarantees.

3. **Verify Caddy auto-SSL still works after the proxy flip**
   - Wait ~3 min for Cloudflare to reload DNS.
   - From your laptop : `curl -sI https://api.deepsightsynthesis.com/health`
   - Expected : `HTTP/2 200` and a `cf-ray` header (proves traffic goes through Cloudflare).
   - If 502/521 from Cloudflare : Caddy origin not reachable on 443 from Cloudflare's IPs.
     Check Hetzner firewall rules — ensure 443/tcp is open to `0.0.0.0/0` (Cloudflare uses many IPs).

4. **Configure the Stripe webhook page rule (legacy Page Rules, manual only)**
   - Dashboard > zone > **Rules** > Page Rules > Create Page Rule
   - URL : `api.deepsightsynthesis.com/api/billing/webhook`
   - Settings :
     - Browser Integrity Check : `Off`
     - Security Level : `Essentially Off`
     - Cache Level : `Bypass`
   - Save & Deploy.
   - Reason : Stripe sends signed webhooks (HMAC); any Cloudflare interception
     can break the signature. The custom WAF rule "Challenge non-Stripe IPs on
     billing webhook" already filters imposters; this Page Rule is belt-and-suspenders.

### 18.5 — Generate the Cloudflare API token

Dashboard > **My Profile** > **API Tokens** > **Create Token** > **Custom token**

Required permissions:

| Resource          | Permission |
| ----------------- | ---------- |
| Zone              | Read       |
| Zone WAF          | Edit       |
| Zone Rate Limit   | Edit       |
| Zone Cache Rules  | Edit       |

Zone Resources: `Include > Specific zone > deepsightsynthesis.com`

Save the token (shown only once). It's referenced as `CLOUDFLARE_API_TOKEN`
below.

### 18.6 — Find the Zone ID

Dashboard > zone `deepsightsynthesis.com` > **Overview** (right sidebar) >
**API** section > copy `Zone ID` (32-char hex string). It's referenced as
`CLOUDFLARE_ZONE_ID` below.

### 18.7 — Run the setup script

The script `backend/scripts/setup_cloudflare_waf.py` is idempotent: matches
existing rules by description (suffixed `[managed]`) and upserts.

```bash
cd C:/Users/33667/DeepSight-Main

# 1) Inspect what will be applied (no API call)
python backend/scripts/setup_cloudflare_waf.py --show-config

# 2) Diff against current Cloudflare state (read-only)
export CLOUDFLARE_API_TOKEN="<your token>"
export CLOUDFLARE_ZONE_ID="<your zone id>"
python backend/scripts/setup_cloudflare_waf.py --dry-run

# 3) Apply (create/update) rules
python backend/scripts/setup_cloudflare_waf.py --apply
```

The script outputs a final table:

```
STATUS         KIND         DESCRIPTION
[+] created    custom       Block empty UA or known scrapers [managed]
[~] updated    rate_limit   Rate limit /api/auth/login 5/min [managed]
[=] skipped    cache        Edge cache /api/health 30s [managed]
[!] failed     rate_limit   ...                       (only on plan-restricted features)
```

Re-running with `--apply` is safe: rules already in sync are reported as
`skipped`.

### 18.8 — Rules that will be created

| Type       | Description                                                | Action                  |
| ---------- | ---------------------------------------------------------- | ----------------------- |
| WAF        | Block empty UA or known scrapers                           | block                   |
| WAF        | Challenge non-Stripe IPs on billing webhook                | managed_challenge       |
| WAF        | Block oversize body except on exports (>10 MB)             | block                   |
| WAF        | Challenge non-JSON POST on auth endpoints                  | managed_challenge       |
| Rate limit | `/api/auth/login` 5/min                                    | block 1h                |
| Rate limit | `/api/auth/register` 3/min                                 | block 1h                |
| Rate limit | `/api/videos/analyze` 10/min                               | challenge 10min         |
| Rate limit | `/api/*` wildcard 100/min                                  | managed_challenge 5min  |
| Cache      | `/api/health` edge TTL 30s                                 | cache                   |
| Cache      | `/api/tournesol/*` GET edge TTL 5min                       | cache                   |

Source of truth : `backend/scripts/cloudflare_rules_config.py`.

### 18.9 — Critical rules and risk levels

| Rule                                                  | Why critical                                                                                         | Risk if removed                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Page Rule on `/api/billing/webhook`                   | Stripe HMAC-signed webhooks rely on byte-exact body. Any Cloudflare manipulation breaks the signature. | Stripe webhooks 4xx, billing breaks silently. |
| `Challenge non-Stripe IPs on billing webhook`         | Reverses the page rule scope: legit Stripe IPs are NEVER challenged.                                 | Stripe IPs hit captcha; payments fail.        |
| `Rate limit /api/auth/login`                          | Brute-force credential stuffing today's #1 SaaS attack vector.                                        | Account takeovers via leaked passwords.       |
| `Block empty UA or known scrapers`                    | Cuts 90% of script-based volumetric attacks.                                                         | VPS CPU saturation under bot load.            |

### 18.10 — Rollback

If anything goes wrong (Stripe down, Caddy SSL renewal fails, latency spike), the
fastest rollback is to put the API back on DNS-only mode:

1. Dashboard > zone > DNS > Records
2. Find `api` A record > toggle proxy status to **DNS only (grey cloud)** > Save
3. Wait ~30s for global DNS propagation.

Cloudflare WAF rules stay in place but are no longer evaluated. Re-enable later
by flipping the cloud back to orange.

To roll back individual rules, edit them in the dashboard
(`Security > WAF > Custom rules` / `Security > Bots & DDoS > Rate limiting`).
The script never deletes rules, only upserts; manual deletion is fine.

### 18.11 — Troubleshooting

#### Stripe webhooks suddenly fail with 400

- Check that the Page Rule on `/api/billing/webhook` is active and on top of any other matching rules (Page Rule order matters).
- Check that `Challenge non-Stripe IPs on billing webhook` custom rule did NOT challenge a legit Stripe IP. Cloudflare changes Stripe IPs ~1×/year; if so, update `STRIPE_WEBHOOK_IPS` in `backend/scripts/cloudflare_rules_config.py` from https://stripe.com/files/ips/ips_webhooks.txt and re-run `--apply`.
- In Cloudflare dashboard > **Security** > Events, filter by URI = `/api/billing/webhook` and last 24h to see what triggered.

#### Caddy auto-SSL renewal fails after orange-cloud flip

Caddy uses HTTP-01 challenge by default on port 80. Cloudflare proxies port 80,
which usually works, but if the auto-SSL fails:

- Switch Caddy to **DNS-01 challenge** (using Cloudflare API token with `Zone:DNS:Edit`):
  - Edit `deploy/hetzner/caddy/Caddyfile`. ⚠️ Bind-mount inode bug in production
    means you can NOT just rewrite the host file. See `reference_caddy-bind-mount-inode-bug` memory.
  - Workaround: extract the version inside the container, edit, copy back via
    `docker cp`, then `docker exec repo-caddy-1 caddy reload`.
- Or temporarily flip back to grey-cloud for 1 renewal cycle (90 days).

#### `--apply` fails on rate limit rules with HTTP 403

Most common cause: the zone is on Free plan. Rate limiting rules need at least
**Pro plan** ($20/mo). Either upgrade or accept that only WAF custom rules + cache rules apply (the script reports `failed` but completes).

#### Wildcard `/api/*` rate limit triggers on legitimate users

Threshold is 100 req/min per IP. Heavy-usage Expert-plan users may hit it
during long sessions. To raise:

- Edit `backend/scripts/cloudflare_rules_config.py` >
  `Rate limit /api/* wildcard 100/min` > bump `requests_per_period`
- Re-run `python backend/scripts/setup_cloudflare_waf.py --apply` (idempotent;
  the existing rule is updated in place).

#### YouTube IP ban on Hetzner stays active

Cloudflare proxy does NOT change the egress IP DeepSight uses to call YouTube.
The Hetzner VPS still talks to YouTube directly. If YouTube blocks the Hetzner
IP, only Webshare proxy (`YOUTUBE_PROXY` env var) or Supadata fallback help.
This RUNBOOK section is unrelated to that issue.

### 18.12 — Verification post-rollout

```bash
# 1) DNS proxy active
dig api.deepsightsynthesis.com +short
# Expected: a Cloudflare anycast IP (104.x or 172.x), NOT 89.167.23.214

# 2) HTTP path through Cloudflare
curl -sI https://api.deepsightsynthesis.com/health | grep -i 'cf-ray\|server'
# Expected: cf-ray header present, server: cloudflare

# 3) Origin still reachable on 443 from Cloudflare's IPs
curl -sI -k --resolve api.deepsightsynthesis.com:443:89.167.23.214 \
  https://api.deepsightsynthesis.com/health
# Expected: HTTP/2 200 (proves origin works for Cloudflare)

# 4) Stripe test webhook (Stripe CLI)
stripe trigger checkout.session.completed --api-key sk_test_xxx
# Expected: 200 in Stripe Dashboard > Developers > Webhooks > attempt log

# 5) Rate limit triggers as expected
for i in $(seq 1 10); do
  curl -sI -X POST https://api.deepsightsynthesis.com/api/auth/login \
    -d '{"email":"x@x","password":"x"}' \
    -H 'Content-Type: application/json'
done
# Expected: requests 1-5 = 401 (bad creds, normal), 6-10 = 429 from Cloudflare
```

### 18.13 — Updating the configuration

To add/edit/disable a rule:

1. Edit `backend/scripts/cloudflare_rules_config.py`. Keep the `description`
   field stable (it's the idempotency key); change only `expression`/`action`/`enabled`.
2. Run `--dry-run` first, sanity-check the diff.
3. Run `--apply`.

To **remove** a rule, delete it manually in the Cloudflare dashboard. The script does not delete (safety). Future enhancement: `--prune` flag.

### 18.14 — Open follow-ups

- Move the Stripe webhook IP list to `core/config.py` so backend and Cloudflare
  setup share one source of truth.
- Consider a 2nd Hetzner VPS in another region with a Cloudflare Load Balancer
  for active-active HA (out of scope for this sprint, but enabled by having
  Cloudflare in front).
- Add a Cloudflare Worker on `/api/auth/*` to issue short-lived bot challenge
  tokens, removing the need for `managed_challenge` UX hits on legit mobile users.
