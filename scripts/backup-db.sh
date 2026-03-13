#!/bin/bash
# DeepSight — Daily PostgreSQL Backup
# Called by crontab at 3:00 UTC

set -euo pipefail

BACKUP_DIR="/opt/deepsight/postgres/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/deepsight_${TIMESTAMP}.dump"
RETAIN_DAYS=7

echo "[$(date -Iseconds)] Starting backup..."

# Dump via docker
docker compose -f /opt/deepsight/repo/docker-compose.yml exec -T postgres \
    pg_dump -U deepsight -d deepsight --format=custom --compress=9 \
    > "${DUMP_FILE}"

FILESIZE=$(du -h "${DUMP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup created: ${DUMP_FILE} (${FILESIZE})"

# Cleanup old backups (keep last 7 days, never delete migration dump)
find "${BACKUP_DIR}" -name "deepsight_*.dump" -mtime +${RETAIN_DAYS} -delete
echo "[$(date -Iseconds)] Old backups cleaned (>${RETAIN_DAYS} days)"

echo "[$(date -Iseconds)] Backup complete."
