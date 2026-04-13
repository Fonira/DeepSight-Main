# Deploy Hetzner — Contexte Claude

## Infrastructure

VPS "clawdbot" : 89.167.23.214 (16GB RAM).
SSH : `ssh -i ~/.ssh/id_hetzner root@89.167.23.214`
Repo VPS : `/opt/deepsight/repo`
Env : `/opt/deepsight/repo/.env.production`

## Stack Docker (4 containers)

| Container         | Image                      | Rôle                     | Port           |
| ----------------- | -------------------------- | ------------------------ | -------------- |
| `repo-backend-1`  | `deepsight-backend:latest` | FastAPI 4 workers        | 8080 (interne) |
| `repo-caddy-1`    | `caddy:2-alpine`           | Reverse proxy + auto-SSL | 80, 443        |
| `repo-postgres-1` | `postgres:17-alpine`       | PostgreSQL 17            | 5432 (interne) |
| `repo-redis-1`    | `redis:7-alpine`           | Cache + sessions         | 6379 (interne) |

Réseau Docker : `repo_deepsight` (créé manuellement, déclaré `external: true` dans compose).

## Fichiers ici

- `Dockerfile` : Python 3.11 + ffmpeg + WeasyPrint deps. Build context = `../../backend`
- `docker-compose.yml` : Stack complète. Usage : `docker compose -f deploy/hetzner/docker-compose.yml up -d`
- `caddy/Caddyfile` : Reverse proxy api.deepsightsynthesis.com → backend:8080. Timeouts SSE 300s, HSTS, security headers.

## Déploiement backend (procédure standard)

```bash
# Depuis le VPS
cd /opt/deepsight/repo
git pull
docker compose -f deploy/hetzner/docker-compose.yml up -d --build backend
# Ou rebuild complet :
docker compose -f deploy/hetzner/docker-compose.yml up -d --no-deps --build backend
```

## ⚠️ Points critiques

- Le réseau `repo_deepsight` est `external: true` → il doit exister AVANT le compose (`docker network create repo_deepsight`)
- Les containers se réfèrent entre eux par leur `container_name` (pas le nom du service compose)
- `env_file: ../../.env.production` + variables `environment:` dans le compose (ces dernières overrident)
- Le Dockerfile copie `backend/src/` → le code tourne depuis `/app/src/`
- HealthCheck backend = `curl -f http://localhost:8080/health`

## Diagnostic rapide

```bash
# Logs erreurs
docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception'
# Health
docker exec repo-backend-1 curl -s http://localhost:8080/health
# État containers
docker ps --format '{{.Names}} {{.Status}}'
# Logs live
docker logs repo-backend-1 -f --tail 50
```

## Backup

PostgreSQL backup vers S3/R2 (Cloudflare) via APScheduler dans le backend.
Backup dir local : `/opt/deepsight/backups` (monté dans le container postgres).
