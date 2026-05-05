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
