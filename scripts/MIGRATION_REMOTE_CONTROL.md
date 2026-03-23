# 🚀 Migration DeepSight → Hetzner VPS — Remote Control depuis ton tel

---

## ÉTAPE 1 : Préparer le MSI-PC (avant de partir)

Sur ton MSI-PC, ouvre PowerShell :

```powershell
cd C:\Users\33667\DeepSight-Main
claude
```

Une fois dans Claude Code, tape :

```
/rc
```

Un **QR code** s'affiche. Scanne-le avec **l'app Claude sur ton téléphone**.

> ⚠️ Garde le terminal ouvert ! Si tu fermes, la session Remote Control meurt.
> Conseil : utilise `tmux` ou laisse simplement le PC allumé avec le terminal visible.

---

## ÉTAPE 2 : Depuis ton téléphone, colle CE prompt

Copie-colle le bloc ci-dessous **en entier** dans la session Remote Control depuis ton tel :

---

```
Tu es le DevOps senior de DeepSight. Ta mission : exécuter la migration COMPLÈTE du backend depuis Railway vers le VPS Hetzner. Mode FULL AUTO — exécute tout sans demander confirmation sauf pour les secrets que tu ne connais pas.

## INFRA
- VPS Hetzner "clawdbot" : $HETZNER_IP (Tailscale: $TAILSCALE_IP)
- SSH : root@$TAILSCALE_IP (via Tailscale, clé SSH déjà configurée sur ce PC)
- Repo local : C:\Users\33667\DeepSight-Main
- Fichiers Docker DÉJÀ PRÊTS dans deploy/hetzner/ (Dockerfile, docker-compose.yml, caddy/Caddyfile)
- Template env : .env.production.example à la racine

## PHASE 1 — INVENTAIRE VPS (5 min)
SSH sur le VPS et montre-moi :
- docker ps -a
- systemctl list-units --type=service --state=running
- ls /opt/ /srv/ /home/
- crontab -l
- df -h && free -h
NE SUPPRIME RIEN sans me montrer d'abord. Affiche le résultat puis passe à la Phase 2 automatiquement si rien de critique.

## PHASE 2 — NETTOYAGE VPS (10 min)
- Arrêter et supprimer TOUS les containers Docker existants
- docker system prune -a --volumes -f
- Supprimer les dossiers OpenClaw (/opt/openclaw, /opt/claude-runner, ou similaire)
- Supprimer les services systemd liés à OpenClaw
- Nettoyer les crontabs (sauf Tailscale)
- NE PAS TOUCHER à Tailscale ni SSH
- apt update && apt upgrade -y
- Installer si manquant : curl git htop ufw fail2ban

## PHASE 3 — DOCKER + SÉCURITÉ (5 min)
- Installer Docker si pas présent : curl -fsSL https://get.docker.com | sh
- apt install docker-compose-plugin -y (si manquant)
- Vérifier : docker --version && docker compose version
- UFW : ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 41641/udp && ufw --force enable
- Vérifier fail2ban actif pour SSH

## PHASE 4 — STRUCTURE + CLONE (5 min)
```bash
mkdir -p /opt/deepsight/{postgres/backups,redis,caddy,logs,scripts}
cd /opt/deepsight
git clone https://github.com/Fonira/deepsight-main.git repo
cd repo
```

## PHASE 5 — COPIER LES FICHIERS DOCKER À LA RACINE
Les fichiers Docker sont dans deploy/hetzner/, il faut les copier/lier à la racine du repo pour que docker compose fonctionne :
```bash
cp deploy/hetzner/docker-compose.yml ./docker-compose.yml
cp deploy/hetzner/Dockerfile backend/Dockerfile
cp -r deploy/hetzner/caddy ./caddy
```

## PHASE 6 — CRÉER .env.production
Crée /opt/deepsight/repo/.env.production en te basant sur .env.production.example.

⚠️ SECRETS — DEMANDE-MOI CES VALEURS (ne les invente JAMAIS) :
- DB_PASSWORD → Génère un mot de passe fort de 32 caractères (celui-ci tu peux le créer)
- JWT_SECRET_KEY → Génère aussi (32+ chars)
- MISTRAL_API_KEY → DEMANDE
- PERPLEXITY_API_KEY → DEMANDE
- GROQ_API_KEY → DEMANDE
- STRIPE_SECRET_KEY → DEMANDE (sk_live_...)
- STRIPE_WEBHOOK_SECRET → On le configurera après (mettre placeholder whsec_TODO)
- STRIPE_PRICE_STARTER → DEMANDE (price_...)
- STRIPE_PRICE_ETUDIANT → DEMANDE (price_...)
- STRIPE_PRICE_PRO → DEMANDE (price_...)
- RESEND_API_KEY → DEMANDE (re_...)
- SENTRY_DSN → DEMANDE
- SUPADATA_API_KEY → DEMANDE (optionnel)
- OPENAI_API_KEY → DEMANDE (optionnel)

Les valeurs que tu PEUX remplir seul :
- FRONTEND_URL=https://www.deepsightsynthesis.com
- ALLOWED_ORIGINS=https://www.deepsightsynthesis.com,http://localhost:5173,http://localhost:8081
- FROM_EMAIL=noreply@deepsightsynthesis.com
- ENVIRONMENT=production
- ACCESS_TOKEN_EXPIRE_MINUTES=15
- REFRESH_TOKEN_EXPIRE_DAYS=7

## PHASE 7 — DÉMARRER POSTGRES + REDIS (5 min)
```bash
cd /opt/deepsight/repo
docker compose up -d postgres redis
# Attendre que les healthchecks passent
sleep 15
docker compose ps
docker compose logs postgres | tail -5
docker compose logs redis | tail -5
```

## PHASE 8 — MIGRER LA DB DEPUIS RAILWAY
⚠️ DEMANDE-MOI l'URL PostgreSQL Railway complète (format: postgresql://user:pass@host:port/db)

Quand tu l'as :
```bash
# Installer pg_dump sur le VPS
apt install -y postgresql-client

# Dump Railway
pg_dump "RAILWAY_URL_ICI?sslmode=require" --format=custom --compress=9 -f /opt/deepsight/postgres/backups/railway-migration.dump

# Vérifier taille
ls -lh /opt/deepsight/postgres/backups/railway-migration.dump

# Restore dans PostgreSQL local
docker compose exec -T postgres pg_restore -U deepsight -d deepsight --no-owner --no-privileges < /opt/deepsight/postgres/backups/railway-migration.dump

# Vérifications
docker compose exec postgres psql -U deepsight -c "\dt" | head -30
docker compose exec postgres psql -U deepsight -c "SELECT COUNT(*) FROM users;"
docker compose exec postgres psql -U deepsight -c "SELECT COUNT(*) FROM summaries;"
```

## PHASE 9 — LANCER BACKEND + CADDY (10 min)
```bash
docker compose up -d
sleep 30
docker compose ps
docker compose logs backend | tail -20
docker compose logs caddy | tail -10
```

## PHASE 10 — TESTS DE VALIDATION
```bash
# Test interne
curl -s http://localhost:8080/health | python3 -m json.tool

# Test Swagger
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/docs

# Stats
docker stats --no-stream
df -h
free -h
```

## PHASE 11 — BACKUPS AUTOMATIQUES
```bash
chmod +x /opt/deepsight/repo/scripts/backup-db.sh
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/deepsight/repo/scripts/backup-db.sh >> /opt/deepsight/logs/backup.log 2>&1") | crontab -
# Test
/opt/deepsight/repo/scripts/backup-db.sh
```

## PHASE 12 — RAPPORT FINAL
Affiche un rapport complet :
- ✅/❌ Status de chaque phase
- Docker containers running (docker compose ps)
- Espace disque et RAM utilisés
- Nombre d'users et summaries dans la DB
- URL du health check interne
- Prochaines étapes manuelles :
  1. DNS : api.deepsightsynthesis.com → A → $HETZNER_IP (chez le registrar)
  2. Vercel : changer VITE_API_URL → https://api.deepsightsynthesis.com
  3. Stripe : ajouter webhook https://api.deepsightsynthesis.com/api/billing/webhook
  4. Mobile : modifier config.ts + EAS build
  5. GitHub Secrets : HETZNER_HOST + HETZNER_SSH_KEY

## RÈGLES ABSOLUES
- Si une commande échoue → diagnostiquer avec les logs AVANT de continuer
- JAMAIS inventer de secrets → DEMANDER
- NE PAS toucher à Tailscale
- NE PAS modifier le code Python du backend
- NE PAS toucher au frontend
- Garder les fichiers Railway (Procfile, railway.json) pour rollback
- Commits atomiques si modifications de fichiers dans le repo
```

---

## ÉTAPE 3 : Actions manuelles POST-MIGRATION

Une fois le rapport final reçu, tu devras faire manuellement :

### DNS (chez ton registrar)
```
api.deepsightsynthesis.com → A → $HETZNER_IP
TTL : 300
```

### Vercel Dashboard
```
VITE_API_URL = https://api.deepsightsynthesis.com
→ Redéployer
```

### Stripe Dashboard
```
Nouveau webhook : https://api.deepsightsynthesis.com/api/billing/webhook
Events : checkout.session.completed, customer.subscription.updated,
         customer.subscription.deleted, invoice.payment_succeeded,
         invoice.payment_failed
→ Copier le whsec_... dans .env.production sur le VPS
→ Redémarrer le backend : ssh root@$TAILSCALE_IP "cd /opt/deepsight/repo && docker compose restart backend"
```

### GitHub Secrets
```
HETZNER_HOST = $HETZNER_IP
HETZNER_SSH_KEY = (contenu clé privée SSH)
```

### Mobile
```
Modifier mobile/src/constants/config.ts :
  API_BASE_URL = 'https://api.deepsightsynthesis.com'
→ Commit + Push + EAS build
```
