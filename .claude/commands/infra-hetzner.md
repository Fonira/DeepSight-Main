---
allowed-tools: Read, Bash, Grep, Glob
description: Infrastructure Hetzner VPS DeepSight — Docker, PostgreSQL, Redis, Caddy, diagnostics
---

# Infrastructure Hetzner VPS

Action demandée : $ARGUMENTS

## VPS clawdbot : 89.167.23.214
SSH : `ssh -i C:\Users\33667\.ssh\id_hetzner root@89.167.23.214`
URL : https://api.deepsightsynthesis.com

## Docker Stack
| Container | Image | Port |
|-----------|-------|------|
| repo-caddy-1 | caddy:2-alpine | 80, 443 |
| repo-backend-1 | deepsight-backend:latest | 8080 |
| repo-postgres-1 | postgres:17-alpine | 5432 |
| repo-redis-1 | redis:7-alpine | 6379 |

Réseau : `repo_deepsight` | Env : `/opt/deepsight/repo/.env.production`

## Diagnostics
```bash
docker logs repo-backend-1 --tail 100 2>&1 | grep -i -E 'error|traceback|exception'
docker logs repo-backend-1 --since 30m 2>&1
docker exec repo-backend-1 curl -s http://localhost:8080/health
docker ps --format '{{.Names}} {{.Status}}'
docker exec repo-redis-1 redis-cli info memory | grep used_memory_human
```

## PostgreSQL
```bash
docker exec repo-postgres-1 pg_dump -U deepsight deepsight > /opt/deepsight/backups/backup_$(date +%Y%m%d).sql
docker exec repo-backend-1 alembic upgrade head
```

## Recréer backend
```bash
docker stop repo-backend-1 ; docker rm repo-backend-1
docker run -d --name repo-backend-1 --network repo_deepsight --env-file /opt/deepsight/repo/.env.production -e PORT=8080 -e ENV=production -e DB_POOL_SIZE=20 -e DB_MAX_OVERFLOW=10 --restart unless-stopped --health-cmd 'curl -f http://localhost:8080/health || exit 1' --health-interval 30s --health-timeout 10s --health-retries 3 deepsight-backend:latest
```