#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — déploiement sur le VPS de production (site + API)
#
# Usage (sur le serveur) :
#   /opt/deepsight/repo/deploy/vps/scripts/deploy.sh             # redéploie la branche actuelle
#   /opt/deepsight/repo/deploy/vps/scripts/deploy.sh ma-branche  # passe sur une autre branche
#
# Étapes :
#   1. récupère la branche depuis GitHub (le serveur ne garde aucune modif locale ;
#      les fichiers .env, non suivis par git, ne sont jamais touchés)
#   2. build du site React dans un container Node jetable
#   3. génère les en-têtes de sécurité Caddy depuis frontend/vercel.json
#   4. publie le site dans /opt/deepsight/www (anciens fichiers JS gardés 14 jours
#      pour les visiteurs qui ont encore l'ancienne version ouverte)
#   5. rebuild + redémarrage de l'API, rechargement de Caddy, vérification santé
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/deepsight/repo}"
# Sans argument : la branche déjà en place (évite de basculer sur main par mégarde).
BRANCH="${1:-$(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
[[ "$BRANCH" != "HEAD" ]] || BRANCH=main
WWW_DIR="${WWW_DIR:-/opt/deepsight/www}"
NODE_IMAGE="${NODE_IMAGE:-node:22-alpine}"
ASSET_RETENTION_DAYS=14

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$*"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

cd "$REPO_DIR"
[[ -f .env.production ]] || die ".env.production manquant (lancer bootstrap.sh d'abord)"
[[ -f .env.frontend ]] || die ".env.frontend manquant (lancer bootstrap.sh d'abord)"
docker info >/dev/null 2>&1 || die "Docker inaccessible (te reconnecter après bootstrap.sh ?)"

COMPOSE=(docker compose --env-file "$REPO_DIR/.env.production" -f "$REPO_DIR/deploy/vps/docker-compose.yml")

# ─── 1. Code ───────────────────────────────────────────────────────────────────
log "Récupération de la branche $BRANCH"
git fetch --depth 50 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
git checkout -q -B "$BRANCH" "origin/$BRANCH"
git reset -q --hard "origin/$BRANCH"
git log -1 --format='    %h %s (%ad)' --date=short

[[ -x "$REPO_DIR/deploy/vps/scripts/deploy.sh" ]] \
  || die "La branche $BRANCH ne contient pas deploy/vps : relance avec une branche qui l'a (ex. feat/infra-ovh)"

# Le script s'est peut-être mis à jour : on relance la nouvelle version une fois.
if [[ -z "${DEPLOY_REEXEC:-}" ]]; then
  DEPLOY_REEXEC=1 exec "$REPO_DIR/deploy/vps/scripts/deploy.sh" "$BRANCH"
fi

# Vérifié après la mise à jour du script : ce sont les règles de la version déployée qui comptent.
grep -q '^ADMIN_EMAIL=.\+' .env.production || die "ADMIN_EMAIL vide dans .env.production"
# L'API démarre sans ces clés ; seules les fonctions qui en dépendent échouent.
grep -q '^MISTRAL_API_KEY=.\+' .env.production \
  || warn "MISTRAL_API_KEY vide : site et connexion OK, mais analyses et chat indisponibles"
grep -q '^SUPADATA_API_KEY=.\+' .env.production \
  || warn "SUPADATA_API_KEY vide : transcriptions YouTube limitées aux méthodes de secours"

# Le Caddyfile du repo est monté dans le conteneur : on valide la nouvelle
# version avant tout build, pour ne pas recharger une config cassée.
if [[ "$(docker inspect -f '{{.State.Running}}' repo-caddy-1 2>/dev/null)" == "true" ]]; then
  log "Validation du Caddyfile"
  docker exec repo-caddy-1 caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null \
    || die "Caddyfile invalide : rien n'a été déployé (corriger deploy/vps/caddy/Caddyfile)"
fi

# ─── 2-3. Build du site + en-têtes ─────────────────────────────────────────────
log "Build du site (npm ci + vite build)"
docker run --rm \
  -u "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
  --env-file "$REPO_DIR/.env.frontend" \
  -v "$REPO_DIR:/repo" -w /repo/frontend \
  "$NODE_IMAGE" \
  sh -c 'npm ci --no-audit --no-fund && npm run build && node /repo/deploy/vps/scripts/vercel-headers-to-caddy.mjs'

# Le prebuild régénère le sitemap suivi par git : on le remet à l'état du commit.
git checkout -q -- frontend/public/sitemap.xml 2>/dev/null || true

[[ -f frontend/dist/index.html ]] || die "Build incomplet : frontend/dist/index.html absent"

# ─── 4. Publication du site ────────────────────────────────────────────────────
log "Publication du site dans $WWW_DIR"
mkdir -p "$WWW_DIR/assets"
# D'abord les nouveaux fichiers JS/CSS, puis index.html qui les référence.
rsync -a --exclude '*.map' frontend/dist/assets/ "$WWW_DIR/assets/"
rsync -a --delete --exclude '/assets/' --exclude '*.map' frontend/dist/ "$WWW_DIR/"
find "$WWW_DIR/assets" -type f -mtime +"$ASSET_RETENTION_DAYS" -delete

# ─── 5. API + Caddy ────────────────────────────────────────────────────────────
log "Build et redémarrage des services"
"${COMPOSE[@]}" up -d --build --remove-orphans

log "Rechargement de Caddy"
"${COMPOSE[@]}" exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null

log "Attente de l'API (jusqu'à 3 min)"
status="starting"
for _ in $(seq 1 36); do
  status="$(docker inspect -f '{{.State.Health.Status}}' repo-backend-1 2>/dev/null || echo absent)"
  [[ "$status" == "healthy" ]] && break
  sleep 5
done

docker image prune -f >/dev/null

if [[ "$status" != "healthy" ]]; then
  docker logs repo-backend-1 --tail 60 2>&1 || true
  die "L'API n'est pas en bonne santé (état : $status). Logs ci-dessus."
fi

"${COMPOSE[@]}" ps --format 'table {{.Name}}\t{{.Status}}'
log "Déploiement terminé : https://www.deepsightsynthesis.com et https://api.deepsightsynthesis.com/health"
