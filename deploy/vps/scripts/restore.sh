#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — restauration de la base depuis une sauvegarde
#
# Usage : /opt/deepsight/repo/deploy/vps/scripts/restore.sh /opt/deepsight/backups/deepsight_AAAAMMJJ_HHMMSS.dump
#
# ⚠️ Remplace le contenu actuel de la base. Une sauvegarde de l'état actuel est
#    faite juste avant, pour pouvoir revenir en arrière.
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

DUMP="${1:-}"
REPO_DIR="${REPO_DIR:-/opt/deepsight/repo}"
COMPOSE=(docker compose --env-file "$REPO_DIR/.env.production" -f "$REPO_DIR/deploy/vps/docker-compose.yml")

die() { printf '\033[1;31m[x] %s\033[0m\n' "$*" >&2; exit 1; }

[[ -n "$DUMP" && -f "$DUMP" ]] || die "Usage : $0 /opt/deepsight/backups/deepsight_XXXX.dump"
docker exec -i repo-postgres-1 pg_restore --list < "$DUMP" > /dev/null || die "Fichier illisible : $DUMP"

echo "La base de production va être remplacée par : $DUMP"
read -r -p "Taper RESTAURER pour confirmer : " answer
[[ "$answer" == "RESTAURER" ]] || die "Annulé."

echo "==> Sauvegarde de l'état actuel avant restauration"
"$REPO_DIR/deploy/vps/scripts/backup.sh"

echo "==> Arrêt de l'API"
"${COMPOSE[@]}" stop backend

echo "==> Restauration"
docker exec -i repo-postgres-1 sh -c \
  'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$DUMP"

echo "==> Redémarrage de l'API"
"${COMPOSE[@]}" start backend
echo "Restauration terminée."
