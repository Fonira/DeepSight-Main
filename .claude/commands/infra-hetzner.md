---
description: "Infrastructure Hetzner VPS DeepSight (clawdbot) : Backend principal FastAPI, PostgreSQL, Redis, Caddy reverse proxy."
---

# Infrastructure Hetzner VPS — Backend Principal DeepSight

## Carte d'identité du VPS

```
Hostname    : clawdbot
IP publique : 89.167.23.214
OS          : Ubuntu (Hetzner Cloud)
URL publique: https://api.deepsightsynthesis.com
```

## Docker Stack (4 containers)

| Container | Image | Rôle | Port |
|-----------|-------|------|------|
| `repo-caddy-1` | `caddy:2-alpine` | Reverse proxy + auto-SSL | 80, 443 |
| `repo-backend-1` | `deepsight-backend:latest` | FastAPI 4 workers | 8080 (interne) |
| `repo-postgres-1` | `postgres:17-alpine` | Base de données | 5432 (interne) |
| `repo-redis-1` | `redis:7-alpine` | Cache L1 transcripts (TTL 24h) | 6379 (interne) |

- **Réseau Docker** : `repo_deepsight`
- **Env production** : `/opt/deepsight/repo/.env.production`
- **Repo VPS** : `/opt/deepsight/repo`

## Accès SSH

```powershell
ssh -i C:\Users\33667\.ssh\id_hetzner root@89.167.23.214
```

## Cache Transcripts — Architecture L1/L2

L1: Redis (TTL 24h) → L2: PostgreSQL (persistent) → Extraction live (Supadata → youtube-transcript-api → fallbacks)

## Variables d'environnement prod

Fichier : `/opt/deepsight/repo/.env.production`
DATABASE_URL, REDIS_URL, SECRET_KEY, MISTRAL_API_KEY, PERPLEXITY_API_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CORS_ORIGINS, RESEND_API_KEY, YOUTUBE_API_KEY

## Déploiement Backend

```powershell
ssh -i C:\Users\33667\.ssh\id_hetzner root@89.167.23.214 "cd /opt/deepsight/repo ; git pull ; docker build -t deepsight-backend:latest -f deploy/hetzner/Dockerfile ./backend ; docker stop repo-backend-1 ; docker rm repo-backend-1 ; docker run -d --name repo-backend-1 --network repo_deepsight --env-file /opt/deepsight/repo/.env.production -e PORT=8080 -e ENV=production --restart unless-stopped --health-cmd 'curl -f http://localhost:8080/health || exit 1' --health-interval 30s --health-timeout 10s --health-retries 3 deepsight-backend:latest"
```

## Diagnostics courants

```bash
# Logs erreurs backend
docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception|critical|failed'
# Logs complets dernières 30 min
docker logs repo-backend-1 --since 30m 2>&1
# Health check
docker exec repo-backend-1 curl -s http://localhost:8080/health
# État containers
docker ps --format '{{.Names}} {{.Status}}'
# Redis mémoire
docker exec repo-redis-1 redis-cli info memory | grep used_memory_human
```

## PostgreSQL — Migrations et backup

```bash
# Backup
docker exec repo-postgres-1 pg_dump -U deepsight deepsight > /opt/deepsight/backups/backup_$(date +%Y%m%d).sql
# Migration Alembic
docker exec repo-backend-1 alembic upgrade head
# Taille BDD
docker exec repo-postgres-1 psql -U deepsight -c "SELECT pg_size_pretty(pg_database_size('deepsight'));"
```

## Recréer le backend après changement d'env

```bash
docker stop repo-backend-1 ; docker rm repo-backend-1
docker run -d --name repo-backend-1 --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  -e PORT=8080 -e ENV=production \
  -e DB_POOL_SIZE=20 -e DB_MAX_OVERFLOW=10 \
  --restart unless-stopped \
  --health-cmd 'curl -f http://localhost:8080/health || exit 1' \
  --health-interval 30s --health-timeout 10s --health-retries 3 --health-start-period 30s \
  deepsight-backend:latest
```

## Checklist redémarrage VPS

1. `docker ps` → les 4 containers doivent être `Up`
2. `docker exec repo-backend-1 curl -s http://localhost:8080/health` → `{"status":"ok","db":"ready"}`
3. `docker exec repo-redis-1 redis-cli ping` → `PONG`
4. `curl -s https://api.deepsightsynthesis.com/health`