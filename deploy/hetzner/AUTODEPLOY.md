# Auto-Deploy Backend — Mécanisme réel

> **TL;DR** : push to `main` → GitHub Actions (`.github/workflows/deploy-backend.yml`) → SSH au VPS Hetzner → `docker build` + `docker run` direct (PAS `docker compose`). Container backend recréé en ~30s.

---

## Vue d'ensemble

```
Push to main          GitHub Actions          Hetzner VPS
─────────────         ──────────────          ────────────
git push          ──► Workflow trigger    ──► SSH appleboy/ssh-action@v1.2.0
                      (paths filter)            │
                                                ├─► tag :latest → :previous
                                                ├─► git fetch + reset --hard origin/main
                                                ├─► docker build deepsight-backend:latest
                                                ├─► docker stop + rm repo-backend-1
                                                └─► docker run repo-backend-1
                                                    │
                          curl /health         ◄───┘
                          (rollback si KO)
```

## Pourquoi `docker run` direct et pas `docker compose` ?

Historiquement les 4 containers prod (`repo-backend-1`, `repo-postgres-1`, `repo-redis-1`, `repo-caddy-1`) ont été créés à la main via `docker run` au moment de la migration Railway → Hetzner. Aucun n'a les labels `com.docker.compose.project` ni `com.docker.compose.service`.

Migrer vers `docker compose up -d` aujourd'hui implique :
- Renommer les containers (collision sur `container_name` existant)
- Réassocier les volumes nommés (`repo_postgres_data`, `repo_redis_data`, `repo_caddy_data`, `repo_caddy_config`)
- Reprendre la main sur le réseau `repo_deepsight` (créé manuellement, marqué `external: true` dans le compose)
- Risque d'un "container name already in use" pendant la bascule (cf. memo `reference_deepsight-hetzner-auto-deploy.md`)

Le workflow `docker run` est éprouvé (~30s par déploiement, plusieurs centaines de cycles) → **on garde, on documente, on n'orchestre pas une migration risquée pour un gain cosmétique**.

`deploy/hetzner/docker-compose.yml` est conservé comme **référence** (valeurs canoniques des services + healthchecks) et **fallback** pour une éventuelle migration future ou une stack de staging — mais **n'est pas utilisé en prod**.

## Commande exacte exécutée par le workflow

Extrait fidèle de `.github/workflows/deploy-backend.yml` (étape `Build and deploy on Hetzner VPS`) :

```bash
cd /opt/deepsight/repo

# Tag rollback anchor
docker tag deepsight-backend:latest deepsight-backend:previous

# Sync code
git fetch origin main
git reset --hard origin/main

# Build (context = backend/)
docker build \
  -t deepsight-backend:latest \
  -f deploy/hetzner/Dockerfile \
  backend

# Recreate container
docker stop repo-backend-1 || true
docker rm repo-backend-1 || true
docker run -d \
  --name repo-backend-1 \
  --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest
```

Suivi par un smoke test `curl https://api.deepsightsynthesis.com/health` (5 retries, 30s timeout). En cas d'échec, rollback automatique vers `deepsight-backend:previous`.

## Trigger

Le workflow se déclenche sur :
- `push` sur `main` qui touche `backend/**`, `deploy/hetzner/**`, ou le workflow lui-même
- `workflow_dispatch` (déclenchement manuel via l'onglet Actions de GitHub)

Concurrence : `concurrency: { group: deploy-backend, cancel-in-progress: false }` → 2 deploys consécutifs sont sérialisés.

## Migrations alembic

Voir [`RUNBOOK.md`](./RUNBOOK.md). En résumé :
- Une migration alembic doit toujours tourner **avant** le swap de container, sur l'ancien container (qui a déjà les fichiers de migration grâce au `git pull`) — sinon downtime tant que le nouveau code attend un schema absent.
- L'image embarque depuis PR #185 `alembic.ini` + `alembic/` à `/app/`. Le container peut donc se migrer lui-même via `docker exec ... alembic upgrade head`.
- Depuis cette PR, l'`entrypoint.sh` du Dockerfile peut faire `alembic upgrade head` au démarrage si `RUN_MIGRATIONS=true` est passé. Le workflow active cette option.

## Procédure de remédiation manuelle

Si le workflow GitHub est cassé ou si on veut déployer hors-CI :

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214

cd /opt/deepsight/repo
git fetch origin main && git reset --hard origin/main

# Si la PR contient une migration alembic, la jouer AVANT le swap :
docker exec repo-backend-1 alembic --config /app/alembic.ini upgrade head

docker tag deepsight-backend:latest deepsight-backend:previous 2>/dev/null || true
docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile backend
docker stop repo-backend-1 || true
docker rm repo-backend-1 || true
docker run -d \
  --name repo-backend-1 \
  --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  -e RUN_MIGRATIONS=true \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest

sleep 15 && docker exec repo-backend-1 curl -s http://localhost:8080/health
```

## Rollback manuel

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214
docker tag deepsight-backend:previous deepsight-backend:latest
docker stop repo-backend-1 && docker rm repo-backend-1
# Note : RUN_MIGRATIONS=false en rollback — on revient à l'ancien schema, pas besoin de re-migrer
docker run -d \
  --name repo-backend-1 \
  --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  -e RUN_MIGRATIONS=false \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest
```

## Diagnostic

```bash
docker ps --format '{{.Names}} {{.Status}}'
docker logs repo-backend-1 --tail 100 2>&1 | grep -iE 'error|traceback|exception'
docker exec repo-backend-1 curl -s http://localhost:8080/health
docker inspect repo-backend-1 --format '{{.State.StartedAt}}'

# Vérifier que l'entrypoint a bien tourné
docker logs repo-backend-1 2>&1 | grep -i 'entrypoint\|alembic'
```

## TODO / améliorations futures

- Versionner le webhook listener (`/opt/junglefarmz/deploy-api.py` sur le VPS) — actuellement non versionné
- Healthcheck pre-swap (rouler l'image en standby et tester `/health` avant de swap, cf. blue-green)
- Migration vers `docker compose` lors d'une fenêtre de maintenance dédiée
