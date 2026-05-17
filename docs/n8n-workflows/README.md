# n8n workflows — DeepSight

Workflows n8n versionnés dans le repo. Source canonique pour import dans `deepsightstudio.app.n8n.cloud`.

## Liste

| Workflow | Fichier | Trigger | Notif |
|----------|---------|---------|-------|
| `proxy-mtd-alert` | [`proxy-mtd-alert.json`](./proxy-mtd-alert.json) | Schedule cron `0 */6 * * *` (toutes les 6h) | Telegram `@Deepsightalertsbot` (chat_id `735497548`) |

---

## `proxy-mtd-alert`

Surveille la consommation MTD du proxy Decodo Residential (~$4/GB) et alerte sur Telegram avant le hard-stop automatique à 950 MB.

### Comportement par sévérité (basé sur `mtd_mb`)

| Seuil | Severity | Action |
|-------|----------|--------|
| `< 300 MB` | `ok` | STOP silencieux, aucune notif |
| `300-499 MB` | `warning` 🟡 | Telegram info |
| `500-799 MB` | `critical` 🟠 | Telegram urgent, recommande throttling |
| `≥ 800 MB` | `hard_stop` 🔴 | Telegram + commandes SSH pour `PROXY_DISABLED=true` |

### Nodes (8 utiles + 1 sticky doc, **9 au total**)

1. **Documentation** (sticky note)
2. **Every 6h** (`scheduleTrigger`)
3. **Fetch proxy usage** (`httpRequest`, GET `/api/admin/proxy/usage?days=30`, `continueOnFail`, retry 2x avec backoff 2s, timeout 15s)
4. **Compute severity** (`code`, JS — extrait `mtd_mb`, `hard_stop_threshold_mb`, calcule `headroom_mb` / `pct_used` / `severity` / `top_providers`)
5. **Route by severity** (`switch` 3 sorties — `warning` / `critical` / `hard_stop`, fallback `none` pour `ok`)
6. **Telegram — warning** (🟡)
7. **Telegram — critical** (🟠)
8. **Telegram — hard_stop** (🔴, inclut bloc SSH `PROXY_DISABLED=true`)
9. **Telegram — workflow error** (branche `error` du HTTP node — alerte si l'endpoint plante)

### Variables d'environnement n8n requises

À configurer dans **Settings → Variables** (ou via les env de la self-host instance), AVANT d'activer le workflow :

| Variable | Valeur | Notes |
|----------|--------|-------|
| `API_BASE_URL` | `https://api.deepsightsynthesis.com` | Domaine backend DeepSight (sans trailing slash). Si l'endpoint admin s'avère être `/admin/proxy/usage` (sans le préfixe `/api`), éditer le node `Fetch proxy usage` directement. |
| `ADMIN_API_KEY` | `<clé admin DeepSight>` | Header `X-API-Key`. Doit avoir le rôle admin (Pro/Expert ne suffit pas). |

### Credentials utilisées (déjà existante dans n8n cloud)

| Type | ID | Nom | Notes |
|------|-----|-----|-------|
| `telegramApi` | `zFfqu5fS7A0O4o2i` | DeepsightAlerts | Bot `@Deepsightalertsbot`, chat_id `735497548`. **Déjà liée** — vérifier après import. |

### Error handling

- **HTTP node** : `continueOnFail: true` + `onError: continueErrorOutput` → branche dédiée vers `Telegram — workflow error` (qui inclut un récap : message, status code, endpoint, timestamp, causes fréquentes).
- **Workflow global** : `settings.errorWorkflow: HYRyfu6V17LBk4rc` (error handler n8n existant — capte tout ce qui dépasse la branche error explicite).
- **Timeout** : 60s par exécution (`executionTimeout: 60`).

### Tags

`monitoring`, `decodo`

### `active: true` par défaut

À l'import, le workflow s'active automatiquement. Le premier run se produira au prochain créneau cron (00:00 / 06:00 / 12:00 / 18:00 UTC).

---

## Procédure d'import

### Via UI (n8n cloud)

1. Ouvrir [`deepsightstudio.app.n8n.cloud`](https://deepsightstudio.app.n8n.cloud).
2. **Workflows → Add workflow → Import from File** (en haut à droite, menu `...`).
3. Sélectionner [`proxy-mtd-alert.json`](./proxy-mtd-alert.json).
4. Le workflow s'ouvre. **Avant d'activer** :
   - Vérifier que le node `Fetch proxy usage` a bien `{{$env.API_BASE_URL}}` dans l'URL et `{{$env.ADMIN_API_KEY}}` dans le header `X-API-Key`. Si n8n affiche un warning "credential missing" sur les nodes Telegram, ré-attacher manuellement la credential `DeepsightAlerts` (`zFfqu5fS7A0O4o2i`).
   - **Settings → Variables** : ajouter `API_BASE_URL` et `ADMIN_API_KEY` (cf. tableau ci-dessus).
5. Cliquer **Execute Workflow** une fois manuellement pour valider :
   - HTTP fetch retourne 200
   - Le node `Compute severity` produit un objet `{ severity, mtd_mb, headroom_mb, pct_used, top_providers, ... }`
   - Le switch route correctement (en prod actuellement on devrait tomber dans `ok` → STOP, ou `warning`)
6. **Activate** (toggle en haut à droite).

### Via API n8n (alternative)

```bash
curl -X POST https://deepsightstudio.app.n8n.cloud/api/v1/workflows/import \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d @docs/n8n-workflows/proxy-mtd-alert.json
```

(`$N8N_API_KEY` est défini dans l'env Windows + `~/.config/n8n.env`, cf. memory `n8n-cloud-integration`.)

---

## Test manuel post-import (sans attendre 6h)

1. Dans n8n UI, ouvrir le workflow → clic droit sur `Every 6h` → **Execute node** (pour partir comme une exec planifiée).
2. Sinon, **Execute Workflow** (bouton en bas) — déclenche tous les nodes.
3. Si `mtd_mb` actuel < 300 → aucune notif Telegram (comportement attendu, severity `ok`). Pour forcer une notif de test : éditer temporairement le node `Compute severity` et hardcoder `severity = 'warning'` dans le `return`, exécuter, puis remettre la logique normale.
4. Vérifier dans `@Deepsightalertsbot` la réception du message Markdown.

---

## Maintenance

- **Modification du JSON** : éditer ce fichier, puis ré-importer dans n8n (UI : **Workflows → ... → Import from File → Replace existing**). Le `versionId` interne (`proxy-mtd-alert-v1`) peut être bumpé à `-v2`, `-v3` à chaque revision.
- **Désactivation temporaire** : toggle `active` en haut à droite dans l'UI n8n, ou `PUT /api/v1/workflows/{id}` avec `{"active": false}`.
- **Changement de chat_id Telegram** : remplacer les 4 occurrences de `735497548` dans le JSON (ou éditer dans l'UI puis re-export).
- **Changement des seuils** : éditer le node `Compute severity` (constantes `mtd_mb >= 800`, `>= 500`, `>= 300`).
