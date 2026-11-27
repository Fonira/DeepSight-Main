#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# DeepSight — sauvegarde de la base PostgreSQL
#
# Lancé chaque nuit à 03h17 par /etc/cron.d/deepsight-backup (installé par
# bootstrap.sh). Peut aussi être lancé à la main avant une opération risquée.
#
# - dump compressé (format custom pg_dump) dans /opt/deepsight/backups
# - vérifie que le dump est lisible avant de le garder
# - supprime les dumps de plus de KEEP_DAYS jours (14 par défaut)
# - copie hors du serveur si /opt/deepsight/backup.env définit RCLONE_REMOTE
#   (écrit par setup-offsite-backup.sh : copie chiffrée vers Cloudflare R2 UE,
#   conservée REMOTE_KEEP_DAYS jours, 30 par défaut)
#
# Les mots de passe sont lus dans le container : rien n'est passé en argument.
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/deepsight/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
CONTAINER="${CONTAINER:-repo-postgres-1}"
OPTIONAL_ENV="/opt/deepsight/backup.env"

if [[ -f "$OPTIONAL_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$OPTIONAL_ENV"
fi

stamp="$(date +%Y%m%d_%H%M%S)"
target="$BACKUP_DIR/deepsight_$stamp.dump"
tmp="$target.partial"
trap 'rm -f "$tmp"' EXIT

mkdir -p "$BACKUP_DIR"
echo "[$(date -Is)] Sauvegarde vers $target"

docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --compress=6' > "$tmp"

# Un dump illisible ne remplace jamais les bons : on vérifie avant de le garder.
docker exec -i "$CONTAINER" pg_restore --list < "$tmp" > /dev/null
mv "$tmp" "$target"
chmod 600 "$target"
echo "[$(date -Is)] OK ($(du -h "$target" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -name 'deepsight_*.dump' -mtime +"$KEEP_DAYS" -delete

if [[ -n "${RCLONE_REMOTE:-}" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    rclone copy "$target" "$RCLONE_REMOTE" --quiet
    echo "[$(date -Is)] Copie hors serveur : $RCLONE_REMOTE"
    # Rétention distante, seulement après une copie réussie (set -e).
    rclone delete "$RCLONE_REMOTE" --include 'deepsight_*.dump' --min-age "${REMOTE_KEEP_DAYS:-30}d" --quiet
  else
    echo "[$(date -Is)] ATTENTION : RCLONE_REMOTE défini mais rclone n'est pas installé" >&2
    exit 1
  fi
fi
