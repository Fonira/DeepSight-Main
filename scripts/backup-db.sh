#!/bin/bash
# DeepSight — Daily PostgreSQL Backup (postgres + pgcache)
# Called by /etc/cron.d/deepsight-backup at 03:00 UTC
# Dumps via `docker exec` to avoid coupling with compose path.

set -Eeuo pipefail

LOG_FILE="/var/log/deepsight-backup.log"
BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
RETAIN=14
MIN_SIZE=1024  # 1 KB

log() { echo "[$(date -Iseconds)] $*" >&2; }

on_error() {
    local exit_code=$?
    log "ERROR: backup-db.sh failed (exit=$exit_code) at line ${BASH_LINENO[0]}" >&2
    logger -t deepsight-backup "FAILED exit=$exit_code line=${BASH_LINENO[0]}"
    exit "$exit_code"
}
trap on_error ERR

mkdir -p "$BACKUP_DIR"

dump_db() {
    local container="$1" db="$2" user="$3" tag="$4"
    local out="${BACKUP_DIR}/${tag}_${TIMESTAMP}.dump"

    log "Dumping ${tag} (${container}/${db}) -> ${out}"
    docker exec -i "$container" pg_dump -U "$user" -d "$db" -Fc --compress=9 > "$out"

    local size
    size=$(stat -c%s "$out")
    if [ "$size" -lt "$MIN_SIZE" ]; then
        log "BACKUP FAILED size=${size} for ${out}" >&2
        rm -f "$out"
        exit 1
    fi
    echo "$out|$size"
}

log "Starting backup..."
RES_MAIN=$(dump_db "repo-postgres-1" "deepsight"       "deepsight" "deepsight")
RES_CACHE=$(dump_db "repo-pgcache-1"  "deepsight_cache" "deepsight" "deepsight_cache")

# Rotation: keep last $RETAIN per DB
for prefix in deepsight deepsight_cache; do
    ls -1t "${BACKUP_DIR}/${prefix}_"*.dump 2>/dev/null | tail -n +$((RETAIN + 1)) | xargs -r rm -f
done

# Recap (5 lines max)
echo "===== DeepSight backup recap ($(date -Iseconds)) ====="
printf "main : %s (%s bytes)\n"  "${RES_MAIN%|*}"  "${RES_MAIN##*|}"
printf "cache: %s (%s bytes)\n"  "${RES_CACHE%|*}" "${RES_CACHE##*|}"
echo "rotation: keep last ${RETAIN} per DB"
echo "===================================================="
