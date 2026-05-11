# Proxy Telemetry — Monitoring & Operations

**Audience** : ops / admin DeepSight.
**Scope** : Decodo proxy résidentiel (env var `YOUTUBE_PROXY`), Pay As You Go $4/GB, wallet $12 ≈ 3 mois si on tient sous 1 GB/mois.

---

## 1. Vue d'ensemble

Pipeline :

```
yt-dlp / youtube-transcript-api / httpx
    │
    │  --proxy $YOUTUBE_PROXY
    ▼
Decodo residential proxy ($4/GB)
    │
    ▼
YouTube / TikTok / external
```

Instrumentation :

```
record_proxy_usage(provider, bytes_in, bytes_out)
    │
    ├── UPSERT proxy_usage_daily (date PK, bytes_in, bytes_out, requests_total, requests_by_provider JSONB)
    │
    ├── Cumul interne → flush PostHog event `proxy_bandwidth_used` chaque 100 MB
    │
    └── Cache MTD invalidé → prochain should_bypass_proxy() refresh
```

Hard-stop : `should_bypass_proxy()` retourne True si `PROXY_DISABLED=true` ou MTD > 950 MB. Au call site (`_yt_dlp_extra_args`), on skip `--proxy` → fallback bare (requête directe, peut échouer YouTube IP-ban mais ne bloque jamais la requête côté backend).

---

## 2. Lire la consommation

### Endpoint admin

```bash
# Auth : Bearer token admin DeepSight
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.deepsightsynthesis.com/api/admin/proxy/usage?days=31 | jq
```

Sortie type :

```json
{
  "total_bytes_mtd": 312345678,
  "total_requests_mtd": 1842,
  "mtd_mb": 297.88,
  "hard_stop_threshold_mb": 950.0,
  "proxy_disabled_env": false,
  "daily": [
    {
      "date": "2026-05-01",
      "bytes_in": 12345678,
      "bytes_out": 4096,
      "mb_total": 11.78,
      "requests_total": 67,
      "requests_by_provider": { "ytdlp_audio": 42, "ytdlp_frames": 18, "ytdlp_tiktok": 7 }
    },
    ...
  ],
  "by_provider": {
    "ytdlp_audio": { "requests": 1450, "share_pct": 78.72 },
    "ytdlp_frames": { "requests": 312, "share_pct": 16.94 },
    "ytdlp_tiktok": { "requests": 80, "share_pct": 4.34 }
  }
}
```

Paramètre `days` (1-365, défaut 30) contrôle la fenêtre `daily`. Le bloc MTD agrège uniquement les rows ≥ 1er du mois en cours, indépendamment de `days`.

### PostHog dashboard

Dashboard 663159 (project 145473 "Default project" / org "Deep SIght" EU). Card "Proxy bandwidth (last 30d)" :

- Event : `proxy_bandwidth_used`
- Property breakdown : `provider`
- Metric : sum(`flushed_bytes`)
- Range : last 30 days
- Visualisation : ligne empilée

**À créer manuellement** (PostHog MCP `exec` du sprint a été tenté mais l'API insight côté MCP fait plus de bien comme outil d'exploration que de provisionnement déclaratif) :

1. Dashboard 663159 → "Add insight" → "Trends"
2. Event : `proxy_bandwidth_used`
3. Math : Sum → property `flushed_bytes`
4. Breakdown : `provider`
5. Date range : Last 30 days
6. Type : Line chart, stacked
7. Save as "Proxy bandwidth (last 30d)"

---

## 3. Alerte Telegram (n8n cloud)

Workflow : `docs/n8n/proxy-bandwidth-alert-workflow.json`

**Import** :
1. `deepsightstudio.app.n8n.cloud` → Workflows → "+ Add" → "Import from File"
2. Sélectionner `docs/n8n/proxy-bandwidth-alert-workflow.json`
3. Configurer la credential `deepsightAdminToken` (Bearer admin DeepSight) sur le node HTTP Request
4. Vérifier la credential Telegram `zFfqu5fS7A0O4o2i` (DeepsightAlerts) — si renommée, sélectionner manuellement la nouvelle
5. Activer le workflow (toggle "Active")
6. Vérifier que `errorWorkflow` pointe sur `HYRyfu6V17LBk4rc` (n8n global error notify)

**Trigger** : cron `0 9 * * *` (daily 09:00 UTC = 10h ou 11h Paris selon DST).

**Seuil alerte** : MTD > 800 MB. Choisi conservateur (150 MB de marge avant hard-stop auto à 950 MB) pour permettre une recharge wallet manuelle avant coupure auto.

**Notification** : Telegram `@Deepsightalertsbot`, chat_id `735497548`, message Markdown avec MTD MB / 1000 MB + breakdown par provider + état env `PROXY_DISABLED`.

---

## 4. Hard-stop budget (kill-switch)

Deux mécanismes :

### A. Automatique (runtime)

Si MTD > 950 MB (constante `HARD_STOP_THRESHOLD_BYTES` dans `middleware/proxy_telemetry.py`), `should_bypass_proxy()` retourne True. Le call site `_yt_dlp_extra_args()` skip `--proxy` → fallback bare.

Refresh du cache MTD : TTL 60 s, invalidé après chaque `record_proxy_usage` réussi.

### B. Manuel (kill-switch immédiat)

Quand on veut couper avant même que la télémétrie n'atteigne 950 MB (suspicion de fuite, surge inattendue, wallet vide imminent) :

```bash
# 1. Activer la variable d'environnement côté Hetzner
ssh -i ~/.ssh/id_hetzner root@89.167.23.214
cd /opt/deepsight/repo
# Ajouter (ou modifier) la ligne dans .env.production
nano .env.production
# → PROXY_DISABLED=true

# 2. Restart le container backend pour recharger l'env
docker restart repo-backend-1

# 3. Vérifier dans les logs
docker logs repo-backend-1 --tail 50 | grep -i proxy_telemetry
# Doit afficher : [PROXY_TELEMETRY] boot — proxy configured=true PROXY_DISABLED=true ...
```

### Réactiver le proxy

```bash
# 1. Retirer PROXY_DISABLED=true du .env.production (ou mettre =false)
ssh -i ~/.ssh/id_hetzner root@89.167.23.214
cd /opt/deepsight/repo
nano .env.production
# → supprimer la ligne OU PROXY_DISABLED=false

# 2. Restart
docker restart repo-backend-1
```

Note : tant que le wallet Decodo a du crédit, le proxy fonctionnera dès `PROXY_DISABLED=false`. Si MTD reste > 950 MB sur le mois en cours, le hard-stop automatique se redéclenchera. Pour passer outre temporairement (rare cas opérationnel), il faut soit attendre le 1er du mois suivant, soit purger manuellement `proxy_usage_daily` (déconseillé : on perd la traçabilité).

---

## 5. Recharger le wallet Decodo

1. Connexion dashboard Decodo (compte ops DeepSight)
2. Onglet "Billing" → Top up wallet
3. Ajouter le montant souhaité ($12 = 1 mois supplémentaire si on tient sous 1 GB/mois)
4. Vérifier la balance restante affichée

Aucune action côté backend nécessaire — le proxy reste identique (`YOUTUBE_PROXY` env var inchangée). La balance Decodo n'est pas visible depuis l'API admin DeepSight (TODO post-merge envisageable si besoin).

---

## 6. Migration Alembic 027

```bash
# Sur Hetzner après git pull du PR mergé :
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  'cd /opt/deepsight/repo && docker exec repo-backend-1 alembic upgrade heads'
```

`heads` (pluriel) — convention DeepSight depuis le fix Visual Analysis Phase 2 (cf. memory entry "Alembic DeepSight").

**Vérifier** :

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  'docker exec repo-backend-1 alembic current'
# Doit afficher : 027_proxy_usage_daily (head)
```

**Rollback** (en cas de problème) :

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  'cd /opt/deepsight/repo && docker exec repo-backend-1 alembic downgrade -1'
# → ramène à 026_chatmsg_summary_null, drop proxy_usage_daily
```

---

## 7. Troubleshooting

### Les events PostHog n'apparaissent pas

- Vérifier `POSTHOG_API_KEY` côté `.env.production` Hetzner
- Vérifier les logs : `docker logs repo-backend-1 | grep PROXY_TELEMETRY`
- Le flush n'a lieu QUE quand 100 MB cumulés sont atteints — premier event peut prendre plusieurs heures de trafic léger

### Les rows ne s'incrémentent pas dans `proxy_usage_daily`

- Vérifier que `YOUTUBE_PROXY` est non-vide côté env Hetzner (sinon `is_proxy_configured()` retourne False et tout est skip)
- Vérifier qu'aucune exception n'est silenciée : `docker logs repo-backend-1 | grep -i "PROXY_TELEMETRY"` à DEBUG level

### Le hard-stop ne se déclenche pas alors que MTD > 950 MB

- Le cache MTD a un TTL 60 s — attendre 1 min après une explosion soudaine
- En cas d'urgence absolue, activer `PROXY_DISABLED=true` manuellement (cf. §4.B)

### L'alerte Telegram ne part pas

- Tester manuellement le workflow n8n (bouton "Execute Workflow")
- Vérifier la credential `deepsightAdminToken` (token expirable côté backend)
- Vérifier que le bot `@Deepsightalertsbot` n'est pas bloqué côté Telegram

---

## 8. Tests manuels post-deploy

Une fois le PR mergé et la migration appliquée :

```bash
# 1. Hard-stop manuel (test fallback gracieux)
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  'cd /opt/deepsight/repo && echo "PROXY_DISABLED=true" >> .env.production && docker restart repo-backend-1'
# Attendre 30s pour boot, puis lancer une analyse YouTube depuis l'app
# → Doit échouer (IP-ban) mais sans crash, dégradation gracieuse

# 2. Réactiver
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 \
  'cd /opt/deepsight/repo && sed -i "/PROXY_DISABLED/d" .env.production && docker restart repo-backend-1'

# 3. Vérifier l'endpoint admin
curl -sS -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.deepsightsynthesis.com/api/admin/proxy/usage?days=1 | jq

# 4. Lancer une analyse vidéo réelle, attendre 30s, re-query l'endpoint
# → bytes_in/requests_total doivent avoir incrémenté
```

---

## 9. Références

- Code : `backend/src/middleware/proxy_telemetry.py`
- Endpoint : `backend/src/admin/router.py` (`GET /api/admin/proxy/usage`)
- Migration : `backend/alembic/versions/027_proxy_usage_daily.py`
- Tests : `backend/tests/test_proxy_telemetry.py` (20 verts, 1 skipped doc-only)
- Workflow n8n : `docs/n8n/proxy-bandwidth-alert-workflow.json`
- PostHog org "Deep SIght" project 145473 EU, dashboard 663159
- Memory entry "DeepSight backend auto-deploy Hetzner" (rebuild → migrations manuelles)
