# Backend Deploy RUNBOOK — Hetzner

> Procédure officielle pour déployer le backend DeepSight, en particulier quand la PR contient une migration de schéma. **Empêche le bug PR #152** (downtime 3min : nouveau code attendait `users.preferences` avant que la migration 009 soit jouée).

---

## TL;DR — ordre canonique

```
1. git pull (récupère le code + les migrations alembic)
2. alembic upgrade head sur l'ANCIEN container (DB migrée AVANT swap)
3. docker build + docker run (le nouveau container démarre avec un schema déjà à jour)
4. healthcheck /health, vérifier qu'il vire au vert en <60s
```

L'**entrypoint.sh** du Dockerfile fait étape (2) automatiquement si `RUN_MIGRATIONS=true` est passé. Le workflow GitHub Actions `.github/workflows/deploy-backend.yml` active cette option par défaut. **En CI, la procédure est donc transparente**. Le RUNBOOK ci-dessous reste utile pour les déploiements manuels ou les hotfixes hors-CI.

---

## 0. Pré-checks

```bash
# SSH OK ?
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 'hostname && uptime'

# Container actuel healthy ?
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 'docker ps --format "{{.Names}} {{.Status}}"'
# repo-backend-1 doit être "Up X (healthy)"

# Branche prod sur main ?
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 'cd /opt/deepsight/repo && git status -sb'
```

Si pas healthy → **ne pas déployer**, diagnostiquer d'abord (cf. section "Diagnostic" plus bas).

---

## 1. Procédure step-by-step

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214

cd /opt/deepsight/repo

# 1a — Sync code (apporte les nouveaux fichiers alembic dans le repo VPS)
git fetch origin main
git reset --hard origin/main

# 1b — Run alembic upgrade head sur l'ancien container
# L'image actuelle a alembic.ini + alembic/ depuis PR #185, et le repo VPS
# contient maintenant les nouveaux fichiers de migration grâce au git pull.
# MAIS l'image n'a pas encore les nouveaux fichiers : on monte le repo dans le container :
docker exec repo-backend-1 sh -c 'cd /app && alembic upgrade head' || {
  # Si ça échoue parce que l'image n'a pas le nouveau fichier de migration,
  # le copier dedans manuellement :
  docker cp backend/alembic/versions repo-backend-1:/app/alembic/
  docker exec repo-backend-1 sh -c 'cd /app && alembic upgrade head'
}

# 1c — Tag rollback anchor
docker tag deepsight-backend:latest deepsight-backend:previous

# 1d — Build new image
docker build \
  -t deepsight-backend:latest \
  -f deploy/hetzner/Dockerfile \
  backend

# 1e — Stop + recreate container
docker stop repo-backend-1
docker rm repo-backend-1
docker run -d \
  --name repo-backend-1 \
  --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  -e RUN_MIGRATIONS=true \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest

# 1f — Vérifier que l'entrypoint a bien tourné
sleep 5
docker logs repo-backend-1 --tail 20 | grep -i entrypoint
# Attendu : "[entrypoint] RUN_MIGRATIONS=true — running alembic upgrade head"
#           "[entrypoint] alembic upgrade head done"
# Si DB déjà à jour, alembic dira juste "Context impl PostgresqlImpl. INFO  Will assume transactional DDL."
```

---

## 2. Healthcheck post-swap

```bash
# Attendre que le start_period (30s) + premier healthcheck passe
sleep 35

docker exec repo-backend-1 curl -s http://localhost:8080/health
# Attendu : {"status":"ok","database":"connected","redis":"connected",...}

docker ps --filter name=repo-backend-1 --format '{{.Names}} {{.Status}}'
# Attendu : repo-backend-1   Up X seconds (healthy)

# Health publique via Caddy
curl -s https://api.deepsightsynthesis.com/health
```

Si le healthcheck reste rouge >2min → **rollback** (section 3).

---

## 3. Rollback manuel

Le workflow GitHub fait un rollback automatique si le smoke test post-deploy échoue. Pour un rollback manuel hors-CI :

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214

# 3a — Vérifier qu'on a bien une image previous
docker image inspect deepsight-backend:previous >/dev/null 2>&1 || echo "PAS DE PREVIOUS — rollback impossible"

# 3b — Restaurer
docker tag deepsight-backend:previous deepsight-backend:latest
docker stop repo-backend-1
docker rm repo-backend-1

# IMPORTANT : RUN_MIGRATIONS=false sur le rollback !
# La DB peut avoir été migrée vers le nouveau schema. L'ancienne image
# pourrait re-tenter la migration et échouer en boucle. Si on doit aussi
# revenir en arrière sur la DB, c'est une procédure séparée (alembic downgrade).
docker run -d \
  --name repo-backend-1 \
  --network repo_deepsight \
  --env-file /opt/deepsight/repo/.env.production \
  -e RUN_MIGRATIONS=false \
  --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  deepsight-backend:latest

sleep 15
docker exec repo-backend-1 curl -s http://localhost:8080/health
```

⚠️ **Cas critique** : si la nouvelle migration alembic a modifié le schema de manière non rétro-compatible (drop column, altération de type), l'ancien code peut crasher au runtime. Dans ce cas il faut soit :
- Faire un `alembic downgrade -1` AVANT le rollback du container (downtime accepté)
- Ou patcher l'ancien code pour qu'il tolère les deux schemas (deploy 2 fois en pré-migration)

---

## 4. Diagnostic

```bash
# Logs récents
docker logs repo-backend-1 --tail 100 2>&1 | grep -iE 'error|traceback|exception|critical|failed'

# Logs entrypoint (vérifier que la migration a tourné)
docker logs repo-backend-1 2>&1 | grep -i 'entrypoint\|alembic'

# État containers
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'

# Image actuelle
docker inspect repo-backend-1 --format '{{.Image}} {{.Config.Image}}'
docker images deepsight-backend

# Suivi live
docker logs repo-backend-1 -f --tail 50

# Healthcheck depuis Caddy
curl -i https://api.deepsightsynthesis.com/health
```

---

## 5. Annexe — Incident 2026-04-26 (PR #152)

**Timeline** :
- 14:56 — PR #152 mergée sur main, workflow démarre
- 14:57 — Image rebuilt + container swap, nouveau code attend la colonne `users.preferences`
- 14:57 → 14:59 — `repo-backend-1` `unhealthy`, retours 500 sur `/api/auth/me` et `/api/auth/preferences`
- 14:59 — Migration 009 appliquée manuellement via `docker cp` + `alembic upgrade head`, container redevient healthy

**Root cause** : workflow `docker run` direct sans `alembic upgrade head` préalable. Migration 009 (`add_user_preferences_json`) jamais jouée par le pipeline. Image PR #185 a depuis ajouté `alembic.ini` + `alembic/` dans `/app/`, mais sans entrypoint pour les jouer automatiquement.

**Fix permanent** (cette PR) : `entrypoint.sh` qui exécute `alembic upgrade head` au démarrage si `RUN_MIGRATIONS=true`. Workflow GitHub passe `-e RUN_MIGRATIONS=true` au `docker run`. Le rollback path passe `RUN_MIGRATIONS=false` pour ne pas re-tenter une migration potentiellement cassée.

---

## 6. Checklist mentale avant de push une PR avec migration

- [ ] Migration alembic présente dans `backend/alembic/versions/`
- [ ] Migration testée en local (`alembic upgrade head` puis `alembic downgrade -1`)
- [ ] Rétrocompatibilité du schema vérifiée (ancien code peut-il vivre avec le nouveau schema ?)
- [ ] Si non rétrocompatible → plan de déploiement en 2 phases documenté dans la PR
- [ ] Smoke test prévu post-deploy (route qui consomme les nouveaux champs)
