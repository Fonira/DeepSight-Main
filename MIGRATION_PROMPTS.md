# Migration DeepSight → Hetzner VPS — Prompts Parallèles

> Ouvrir 3 terminaux Claude Code et coller chaque prompt dans un terminal différent.
> **Terminal A et B** se lancent EN MÊME TEMPS.
> **Terminal C** se lance APRÈS que A et B aient terminé.

---

## TERMINAL A — VPS : Nettoyage + Docker + Sécurité

```
Tu es le DevOps de DeepSight. Ta mission : préparer le VPS Hetzner "clawdbot" ($HETZNER_IP, Tailscale: $TAILSCALE_IP) pour héberger le backend DeepSight.

CONTEXTE :
- VPS Hetzner CX43 : 8 vCPU, 16GB RAM, 40GB disk, Ubuntu, Helsinki
- On va y déployer : FastAPI backend + PostgreSQL 16 + Redis 7 + Caddy (reverse proxy SSL)
- Le frontend RESTE sur Vercel (ne pas toucher)

ÉTAPES À SUIVRE DANS L'ORDRE :

1. SSH sur le VPS via Tailscale ($TAILSCALE_IP) ou IP publique ($HETZNER_IP)

2. INVENTAIRE - Avant de supprimer quoi que ce soit, lister ce qui tourne :
   - docker ps -a
   - systemctl list-units --type=service --state=running
   - pm2 list (si installé)
   - ls /opt/ /srv/ /home/
   - crontab -l
   Montre-moi le résultat COMPLET avant de supprimer

3. MISE À JOUR SYSTÈME :
   - apt update && apt upgrade -y
   - Installer si manquant : curl, git, htop, ufw, fail2ban

5. DOCKER (si pas déjà installé ou si version obsolète) :
   - curl -fsSL https://get.docker.com | sh
   - apt install docker-compose-plugin -y
   - docker --version && docker compose version

6. SÉCURITÉ :
   - UFW : autoriser uniquement 22/tcp, 80/tcp, 443/tcp, 41641/udp (Tailscale)
   - Vérifier que fail2ban est actif pour SSH
   - Vérifier que l'auth SSH est par clé (pas mot de passe)

7. STRUCTURE DE DÉPLOIEMENT :
   Créer l'arborescence :
   /opt/deepsight/
   ├── postgres/
   │   ├── data/      (sera un volume Docker mais bon d'avoir le dossier)
   │   └── backups/
   ├── redis/
   ├── caddy/
   ├── backend/
   ├── logs/
   └── scripts/

8. VÉRIFICATION FINALE :
   - docker compose version
   - ufw status verbose
   - df -h (espace disque)
   - free -h (RAM)
   - Confirmer que tout est prêt

RÈGLES :
- NE TOUCHE PAS à Tailscale
- Utilise ; au lieu de && pour chaîner les commandes (PowerShell sur le PC, mais SSH c'est bash donc && OK dans le SSH)
- Affiche chaque résultat de commande
```

---

## TERMINAL B — CODE : Fichiers Docker + Deploy + CI/CD

```
Tu es le Tech Lead de DeepSight. Ta mission : créer TOUS les fichiers de configuration nécessaires pour déployer le backend sur un VPS Hetzner avec Docker.

CONTEXTE :
- Repo : C:\Users\33667\DeepSight-Main
- Backend actuel : Railway (FastAPI Python 3.11, voir backend/nixpacks.toml et backend/requirements.txt)
- Migration vers : Hetzner VPS Docker (PostgreSQL 16 + Redis 7 + Caddy reverse proxy)
- Le frontend RESTE sur Vercel
- Nouveau domaine API : api.deepsightsynthesis.com → $HETZNER_IP

FICHIERS À CRÉER (dans le repo, PAS sur le VPS) :

### 1. backend/Dockerfile
```dockerfile
FROM python:3.11-slim

# Dépendances système (FFmpeg pour yt-dlp, gcc pour compilations)
RUN apt-get update && apt-get install -y \
    ffmpeg gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

WORKDIR /app/src

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 4 workers car 8 vCPU disponibles (2 workers par 4 vCPU est optimal pour I/O bound)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", \
     "--timeout-keep-alive", "300", "--limit-concurrency", "200", \
     "--workers", "4"]
```

### 2. docker-compose.yml (à la RACINE du repo DeepSight-Main/)
```yaml
# DeepSight Production Stack — Hetzner VPS
# Usage: docker compose -f docker-compose.yml up -d

services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - deepsight

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file: .env.production
    environment:
      - PORT=8080
      - ENV=production
      - DATABASE_URL=postgresql+asyncpg://deepsight:${DB_PASSWORD}@postgres:5432/deepsight
      - REDIS_URL=redis://redis:6379/0
      - DB_POOL_SIZE=20
      - DB_MAX_OVERFLOW=10
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - deepsight

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: deepsight
      POSTGRES_USER: deepsight
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/backups:/backups
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U deepsight"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - deepsight

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    networks:
      - deepsight

networks:
  deepsight:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
```

### 3. caddy/Caddyfile (créer le dossier caddy/ à la racine)
```
api.deepsightsynthesis.com {
    reverse_proxy backend:8080

    header {
        Access-Control-Allow-Origin https://www.deepsightsynthesis.com
        Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS, PATCH"
        Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With"
        Access-Control-Allow-Credentials true
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
    }

    @options method OPTIONS
    handle @options {
        respond 204
    }

    log {
        output file /var/log/caddy/deepsight.log {
            roll_size 50mb
            roll_keep 10
        }
        format json
    }
}
```

### 4. scripts/deploy.sh (script de déploiement appelé par CI/CD)
```bash
#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/deepsight"
REPO_DIR="/opt/deepsight/repo"
BACKUP_DIR="/opt/deepsight/postgres/backups"

echo "═══ DeepSight Deploy $(date) ═══"

# 1. Pull latest code
cd "$REPO_DIR"
git fetch origin main
git reset --hard origin/main

# 2. Pre-deploy DB backup
echo "📦 Pre-deploy backup..."
docker compose exec -T postgres pg_dump -U deepsight deepsight \
    | gzip > "$BACKUP_DIR/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz"

# 3. Build & restart backend only (zero-downtime avec health check)
echo "🔨 Building backend..."
docker compose build backend --no-cache

echo "🚀 Deploying..."
docker compose up -d backend

# 4. Wait for health check
echo "🏥 Health check..."
for i in {1..10}; do
    if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ Backend healthy after attempt $i"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Health check failed after 10 attempts"
        docker compose logs --tail=50 backend
        exit 1
    fi
    sleep 5
done

# 5. Cleanup old Docker images
docker image prune -f

echo "═══ Deploy complete ═══"
```

### 5. scripts/backup-db.sh
```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/opt/deepsight/postgres/backups"
RETENTION_DAYS=30
S3_BUCKET="${BACKUP_S3_BUCKET:-deepsight-backups}"
S3_PREFIX="${BACKUP_S3_PREFIX:-db-backups/}"

DATE=$(date +%Y%m%d-%H%M%S)
FILENAME="deepsight-${DATE}.sql.gz"

echo "📦 Starting backup: $FILENAME"

# Dump PostgreSQL
docker compose -f /opt/deepsight/repo/docker-compose.yml \
    exec -T postgres pg_dump -U deepsight deepsight \
    | gzip > "$BACKUP_DIR/$FILENAME"

SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
echo "✅ Backup created: $FILENAME ($SIZE)"

# Upload to S3 if AWS credentials available
if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
    echo "☁️ Uploading to S3..."
    aws s3 cp "$BACKUP_DIR/$FILENAME" "s3://$S3_BUCKET/$S3_PREFIX$FILENAME"
    echo "✅ S3 upload complete"
fi

# Cleanup old local backups
echo "🧹 Cleaning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "deepsight-*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "📦 Backup complete"
```

### 6. .env.production.example (à la racine, template des variables)
Créer ce fichier avec TOUTES les variables de backend/src/core/config.py, valeurs vides sauf les défauts. Ajouter DB_PASSWORD en haut.

### 7. Modifier .github/workflows/deploy-backend.yml :
Remplacer le contenu par un déploiement SSH vers Hetzner :
```yaml
name: Deploy Backend to Hetzner

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'docker-compose.yml'
      - 'caddy/**'

concurrency:
  group: deploy-backend
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy to Hetzner VPS
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: root
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script_stop: true
          timeout: 300s
          script: |
            cd /opt/deepsight/repo
            git fetch origin main
            git reset --hard origin/main

            # Pre-deploy backup
            docker compose exec -T postgres pg_dump -U deepsight deepsight \
              | gzip > /opt/deepsight/postgres/backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz

            # Build and restart
            docker compose build backend --no-cache
            docker compose up -d backend

            # Health check
            sleep 10
            for i in 1 2 3 4 5 6 7 8 9 10; do
              if curl -sf http://localhost:8080/health > /dev/null 2>&1; then
                echo "Health OK at attempt $i"
                exit 0
              fi
              sleep 5
            done
            echo "Health check failed"
            docker compose logs --tail=50 backend
            exit 1

      - name: External health check
        run: |
          sleep 5
          for i in 1 2 3 4 5; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              "https://api.deepsightsynthesis.com/health" --max-time 10)
            if [ "$STATUS" = "200" ]; then
              echo "External health check passed"
              exit 0
            fi
            echo "Attempt $i: status $STATUS"
            sleep 15
          done
          exit 1

      - name: Notify failure
        if: failure()
        run: |
          if [ -n "${{ secrets.TELEGRAM_BOT_TOKEN }}" ]; then
            curl -s -X POST \
              "https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage" \
              -d chat_id="${{ secrets.TELEGRAM_CHAT_ID }}" \
              -d parse_mode="HTML" \
              -d text="<b>🔴 DeepSight Backend Deploy FAILED</b>%0A%0ACommit: <code>${{ github.sha }}</code>%0ABy: ${{ github.actor }}%0A<a href='${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}'>View logs</a>"
          fi
```

### 8. Modifier .github/workflows/db-backup.yml :
Adapter pour utiliser le PostgreSQL Hetzner via SSH au lieu de Railway.

### 9. Ajouter au .gitignore :
```
.env.production
postgres/data/
redis/data/
```

### 10. NE PAS MODIFIER :
- backend/src/core/config.py → Le pool_size est déjà configurable via env var DB_POOL_SIZE (ligne 70 de database.py)
- backend/src/db/database.py → Supporte déjà PostgreSQL + SSL toggle
- frontend/ → Rien à toucher dans le code
- Le Procfile, railway.json, nixpacks.toml → les garder pour rollback possible

COMMIT MESSAGE : "feat(infra): add Docker deployment config for Hetzner VPS migration"

RÈGLES :
- Code COMPLET, pas d'extraits partiels
- Crée les fichiers avec le contenu exact ci-dessus comme base, adapte si nécessaire
- N'oublie pas chmod +x sur les scripts .sh
- NE modifie PAS le code backend Python existant
- NE touche PAS au frontend
```

---

## TERMINAL C — DÉPLOIEMENT : DB Migration + Lancement + Tests
> ⚠️ Lancer APRÈS que Terminal A (VPS prêt) et Terminal B (fichiers créés + pushés) soient terminés.

```
Tu es le DevOps de DeepSight. Les terminaux A et B ont terminé :
- Le VPS Hetzner ($HETZNER_IP / Tailscale $TAILSCALE_IP) est propre avec Docker installé
- Les fichiers Docker (Dockerfile, docker-compose.yml, Caddyfile, scripts) sont dans le repo sur GitHub

Ta mission : déployer le backend DeepSight sur le VPS et migrer la base de données.

ÉTAPES :

### Phase 1 — Cloner le repo sur le VPS
SSH sur le VPS puis :
```bash
cd /opt/deepsight
git clone https://github.com/Fonira/deepsight-main.git repo
cd repo
```

### Phase 2 — Créer le .env.production
Créer /opt/deepsight/repo/.env.production avec les variables.
IMPORTANT : Récupérer les valeurs EXACTES depuis Railway Dashboard.
Variables critiques à ne PAS oublier :
- DB_PASSWORD (nouveau mot de passe fort pour PostgreSQL local)
- JWT_SECRET_KEY
- ADMIN_PASSWORD, ADMIN_SECRET_KEY
- MISTRAL_API_KEY
- STRIPE_SECRET_KEY_LIVE, STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_STARTER_LIVE, STRIPE_PRICE_PRO_LIVE, STRIPE_PRICE_EXPERT_LIVE
- RESEND_API_KEY
- FRONTEND_URL=https://www.deepsightsynthesis.com
- ALLOWED_ORIGINS=https://www.deepsightsynthesis.com,http://localhost:5173,http://localhost:8081
- SENTRY_DSN
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (pour backups S3)
- Toutes les autres clés API (OPENAI, GROQ, etc.)

ME DEMANDER les valeurs que tu ne connais pas. Ne JAMAIS inventer de secrets.

### Phase 3 — Démarrer PostgreSQL + Redis d'abord
```bash
cd /opt/deepsight/repo
docker compose up -d postgres redis
docker compose logs -f postgres  # Attendre "database system is ready"
docker compose logs -f redis     # Attendre "Ready to accept connections"
```

### Phase 4 — Migrer la base de données depuis Railway
IMPORTANT : Demander à l'utilisateur l'URL PostgreSQL Railway complète (format: postgresql://user:pass@host:port/db)

```bash
# Depuis le VPS, dump la DB Railway
pg_dump "postgresql://USER:PASS@HOST:PORT/DB?sslmode=require" \
    --format=custom --compress=9 -f /opt/deepsight/postgres/backups/railway-migration.dump

# Vérifier la taille du dump
ls -lh /opt/deepsight/postgres/backups/railway-migration.dump

# Restore dans le PostgreSQL local
docker compose exec -T postgres pg_restore \
    -U deepsight -d deepsight --no-owner --no-privileges \
    < /opt/deepsight/postgres/backups/railway-migration.dump

# Vérification
docker compose exec postgres psql -U deepsight -c "\dt" | head -30
docker compose exec postgres psql -U deepsight -c "SELECT COUNT(*) FROM users;"
docker compose exec postgres psql -U deepsight -c "SELECT COUNT(*) FROM summaries;"
```

### Phase 5 — Lancer le backend + Caddy
```bash
docker compose up -d
docker compose logs -f backend   # Vérifier le démarrage (pas d'erreurs)
docker compose logs -f caddy     # Vérifier le certificat SSL
```

### Phase 6 — Tests de validation
```bash
# Test interne
curl http://localhost:8080/health
curl http://localhost:8080/docs  # Swagger UI

# Test externe (après DNS propagé)
curl https://api.deepsightsynthesis.com/health

# Test auth
curl -X POST https://api.deepsightsynthesis.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}'
# Doit retourner une erreur 401 (utilisateur inexistant) → c'est normal et ça prouve que l'API répond

# Test charge
docker stats  # Vérifier consommation RAM/CPU
```

### Phase 7 — Configurer les backups automatiques
```bash
chmod +x /opt/deepsight/repo/scripts/backup-db.sh

# Crontab pour backup quotidien à 3h du matin
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/deepsight/repo/scripts/backup-db.sh >> /opt/deepsight/logs/backup.log 2>&1") | crontab -

# Test du backup
/opt/deepsight/repo/scripts/backup-db.sh
```

### Phase 8 — Monitoring
- Vérifier que Sentry reçoit les events : déclencher un /health puis check Sentry dashboard
- Créer un check UptimeRobot (gratuit) sur https://api.deepsightsynthesis.com/health

RÈGLES :
- JAMAIS inventer de secrets → me demander
- Vérifier CHAQUE étape avant de passer à la suivante
- Si une erreur survient → docker compose logs + diagnostiquer AVANT de continuer
- Le DNS de api.deepsightsynthesis.com doit être configuré MANUELLEMENT par l'utilisateur chez son registrar
```

---

## APRÈS LES 3 TERMINAUX — Actions manuelles

### DNS (à faire toi-même dans l'interface du registrar)
```
api.deepsightsynthesis.com → A → $HETZNER_IP
TTL : 300 (5 min pour test rapide)
```

### Vercel (à faire dans le dashboard Vercel)
```
Modifier la variable d'environnement :
VITE_API_URL = https://api.deepsightsynthesis.com
→ Redéployer le frontend
```

### Stripe Dashboard
```
1. Ajouter un nouveau webhook endpoint :
   URL : https://api.deepsightsynthesis.com/api/billing/webhook
   Events : checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
2. Copier le nouveau whsec_... dans le .env.production du VPS
3. Garder l'ancien webhook Railway actif pendant 1 semaine
```

### GitHub Secrets (Settings → Secrets → Actions)
```
Ajouter :
- HETZNER_HOST = $HETZNER_IP
- HETZNER_SSH_KEY = (contenu de la clé privée SSH)
```

### Mobile (build EAS nécessaire)
```
Modifier mobile/src/constants/config.ts :
export const API_BASE_URL = 'https://api.deepsightsynthesis.com';
→ Commit + Push → EAS build
```
