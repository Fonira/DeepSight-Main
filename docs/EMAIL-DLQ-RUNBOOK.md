# Email DLQ et replay — Runbook

> Sprint scalabilité (2026-05-05) — chantier B : fix Resend rate-limit (429 errors, ~56/24h prod).
>
> Si un fichier `docs/RUNBOOK.md` global existe, intégrer cette section comme §19 dedans.

## Contexte

DeepSight envoie ses emails transactionnels (verification, reset password, payment, onboarding J+1 → J+14) via [Resend](https://resend.com) :
- Resend account cap = **10 req/s** global
- Backend FastAPI = 4 workers uvicorn → throughput agrégé peut dépasser le cap lors de pics
- Avant le sprint scalabilité (chantier B), pas de cap global ni de back-off ni de DLQ → ~56 erreurs 429 par 24h en prod, emails perdus silencieusement

## Architecture après chantier B

```
auth/router → email_service.send_*  ──►  email_queue.enqueue
                                              │
                                              ▼
                                   ┌────────────────────────┐
                                   │ EmailQueue worker (1/worker)
                                   │  - Throttling local 0.5s
                                   │  - send_with_rate_limit:
                                   │     ┌─────────────────────────┐
                                   │     │ RESEND_LIMITER (global)
                                   │     │  Token bucket Redis
                                   │     │  - cap 10/s shared
                                   │     │  - burst 10 (configurable)
                                   │     │  - fallback in-memory si Redis KO
                                   │     └─────────────────────────┘
                                   │  - Retry 1s/2s/4s/8s sur 429
                                   │  - Retry sur 5xx (transient)
                                   └────────────┬────────────┘
                                                │
                            ┌───────────────────┼───────────────────┐
                            ▼                   ▼                   ▼
                       Resend OK           Re-queue             email_dlq table
                                       (5xx transient)        (4xx ou 429 exhausted)
                                                                    │
                                                                    ▼
                                                        Admin replay manuel
                                                  (POST /api/admin/email-dlq/{id}/replay)
```

## Queries DLQ

### Compter les emails en DLQ (HTTP, admin only)

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.deepsightsynthesis.com/api/admin/email-dlq/stats
```

Retour :
```json
{
  "total": 56,
  "pending": 12,
  "replayed": 40,
  "failed_again": 2,
  "abandoned": 2,
  "last_24h": 8
}
```

### Lister les emails pending

```bash
curl -H "Authorization: Bearer $ADMIN_JWT" \
  "https://api.deepsightsynthesis.com/api/admin/email-dlq?status=pending&limit=50"
```

### Query SQL directe (Hetzner)

```bash
ssh root@89.167.23.214 docker exec repo-postgres-1 \
  psql -U deepsight -d deepsight -c "
    SELECT id, email_to, subject, error_status_code, attempts, replay_status, failed_at
    FROM email_dlq
    WHERE replay_status = 'pending'
    ORDER BY failed_at DESC
    LIMIT 20;
  "
```

## Replay manuel

### 1. Replay une seule entrée

```bash
curl -X POST \
  -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.deepsightsynthesis.com/api/admin/email-dlq/123/replay
```

Response success :
```json
{
  "success": true,
  "dlq_id": 123,
  "new_status": "replayed",
  "message": "Email re-enqueued successfully. If it fails again, a NEW DLQ entry will be created."
}
```

### 2. Replay batch (pending uniquement)

```bash
# Boucle bash pour replay tout le pending
DLQ_IDS=$(curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "https://api.deepsightsynthesis.com/api/admin/email-dlq?status=pending&limit=500" \
  | jq -r '.items[].id')

for id in $DLQ_IDS; do
  curl -s -X POST -H "Authorization: Bearer $ADMIN_JWT" \
    "https://api.deepsightsynthesis.com/api/admin/email-dlq/$id/replay"
  sleep 0.5  # respect rate limit côté client aussi
done
```

### 3. Marquer comme abandonné (template foireux, user supprimé, etc.)

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_JWT" \
  https://api.deepsightsynthesis.com/api/admin/email-dlq/123/abandon
```

## Tuning rate limit

Variables d'environnement (Hetzner `/opt/deepsight/repo/.env.production`) :

| Variable                          | Default | Rôle                                                       |
| --------------------------------- | ------- | ---------------------------------------------------------- |
| `RESEND_RATE_LIMIT_PER_SEC`       | 2       | Per-worker fallback rate (mode in-memory, no Redis)        |
| `RESEND_GLOBAL_RATE_PER_SEC`      | 10      | Global cap shared via Redis (token bucket leak rate)       |
| `RESEND_RATE_LIMIT_BURST`         | =global | Token bucket capacity (max instantaneous burst)            |
| `RESEND_MAX_429_RETRIES`          | 4       | Retry attempts on 429 before DLQ (1s/2s/4s/8s backoff)     |
| `RESEND_BACKOFF_BASE_SECONDS`     | 1.0     | Exponential backoff base                                   |
| `ONBOARDING_BURST_THRESHOLD`      | 30      | Si > N onboarding emails dus → étalement                   |
| `ONBOARDING_SPREAD_WINDOW_SECONDS`| 300     | Fenêtre d'étalement (5 min)                                |
| `ONBOARDING_BURST_INTERVAL_SECONDS`| 10.0   | Intervalle entre 2 onboarding emails en mode burst-spread |

Après modification :
```bash
ssh root@89.167.23.214
cd /opt/deepsight/repo
# Edit .env.production
docker restart repo-backend-1   # ou docker compose up -d
```

## Métriques / observabilité

Logger structuré côté backend (consommable par Axiom / Sentry / PostHog) :

| Métrique               | Niveau   | Trigger                                          |
| ---------------------- | -------- | ------------------------------------------------ |
| `email.enqueued`       | INFO     | Email ajouté à la queue                          |
| `email.sent`           | INFO     | Resend HTTP 200/201                              |
| `email.queue_retry`    | WARNING  | Retry au niveau queue (5xx transient)            |
| `email.5xx_exhausted`  | WARNING  | 5xx retries Resend épuisés                      |
| `email.client_error`   | ERROR    | 4xx Resend non-recoverable → DLQ                |
| `email.rate_limited`   | WARNING  | 429 retries Resend épuisés → DLQ                |
| `email.failed`         | ERROR    | Toute défaillance définitive                    |
| `email.dlq`            | ERROR    | Row insérée dans `email_dlq`                    |
| `email.dlq.replay`     | INFO     | Admin a déclenché un replay                     |
| `email.dlq.abandon`    | INFO     | Admin a marqué une row comme abandoned          |
| `onboarding.burst_spread` | WARNING | Cron onboarding a activé l'étalement burst   |

Dashboard ops conseillé : compter `email.dlq` par 24h. Si > 10/jour → alerte Sentry.

## Procédure d'incident

### Symptôme : pic de 429

1. Vérifier l'état de la queue + DLQ
   ```bash
   curl https://api.deepsightsynthesis.com/api/admin/email-dlq/stats
   ```
2. Identifier la cause via `kubectl logs` ou `docker logs repo-backend-1 | grep email.rate_limited`
3. Si pic onboarding → vérifier que l'étalement burst s'active (`onboarding.burst_spread` log)
4. Si pic transactionnel (massif signup) → augmenter temporairement `RESEND_GLOBAL_RATE_PER_SEC` à 15-20 (Resend acceptera des bursts courts) puis baisser après le pic
5. Replay batch tout le pending une fois le pic absorbé (cf. section "Replay manuel")

### Symptôme : DLQ qui grossit sans replays

→ Job cron auto-replay (TODO ops) ou alerte Sentry pour solliciter un admin

### Symptôme : Redis down

Le rate limiter fallback en mode in-memory (per-worker, ~8 req/s agrégé). C'est dégradé mais OK temporairement. Restaurer Redis dès que possible pour récupérer le cap global.

## Test local

```bash
cd backend
python -m pytest tests/test_email_rate_limiter.py tests/test_email_dlq.py -v
```

Tests d'intégration (Redis live) :
```bash
RESEND_RATE_LIMITER_INTEGRATION=1 REDIS_URL=redis://localhost:6379/0 \
  python -m pytest tests/test_email_rate_limiter.py::test_real_redis_cap_enforced -v
```

## Migration Alembic

Migration `019_add_email_dlq.py` (idempotente, `if not exists` partout). Appliquée en prod via :
```bash
ssh root@89.167.23.214 docker exec repo-backend-1 \
  alembic -c /app/backend/alembic.ini upgrade head
```

(Si `entrypoint.sh` n'existe pas sur Hetzner — cf. memory `reference_deepsight-hetzner-auto-deploy`, applicable manuellement à chaque rebuild.)
