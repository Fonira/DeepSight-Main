# Deep Sight — Database Backup & Restore

> Generated: 2026-02-10

---

## Overview

Automated PostgreSQL backup system with:
- Full SQL dump via `psycopg2` (schema + data)
- gzip compression
- Local storage + S3 upload
- Automatic cleanup of backups older than 30 days
- Email notification on completion
- APScheduler cron (daily at 03:00 UTC)
- Admin API endpoints for manual trigger and listing

---

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────┐
│  APScheduler │────>│  backup_db   │────>│ PostgreSQL│
│  (3h UTC)    │     │  .run_backup │     │  (dump)   │
└─────────────┘     └──────┬───────┘     └──────────┘
                           │
                    ┌──────┴──────┐
                    │             │
               ┌────▼────┐  ┌────▼────┐
               │  Local   │  │   S3    │
               │  /data/  │  │  bucket │
               │ backups/ │  │         │
               └─────────┘  └─────────┘
                    │
               ┌────▼────────┐
               │ EmailService │
               │ notification │
               └──────────────┘
```

---

## Files

| File | Purpose |
|------|---------|
| `scripts/backup_db.py` | SQL dump, compress, upload, cleanup, email |
| `scripts/restore_db.py` | List backups, download from S3, restore SQL |
| `admin/router.py` | `POST /api/admin/backup/trigger`, `GET /api/admin/backup/list` |
| `main.py` | APScheduler cron integration in lifespan |
| `core/config.py` | `BACKUP_CONFIG` with S3/cron settings |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | — | Required for S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | — | Required for S3 uploads |
| `AWS_REGION` | `eu-west-3` | AWS region |
| `BACKUP_S3_BUCKET` | `deepsight-backups` | S3 bucket name |
| `BACKUP_S3_PREFIX` | `db-backups/` | Key prefix in bucket |
| `BACKUP_CRON_HOUR` | `3` | Hour (UTC) for daily backup |
| `BACKUP_CRON_MINUTE` | `0` | Minute for daily backup |
| `BACKUP_RETENTION_DAYS` | `30` | Delete S3 backups older than N days |

If `AWS_ACCESS_KEY_ID` is not set, backups are saved locally only (no S3 upload).

---

## CLI Usage

### Backup

```bash
cd backend/src

# Full backup (local + S3)
python -m scripts.backup_db

# Local only (no S3 upload)
python -m scripts.backup_db --local
```

### Restore

```bash
cd backend/src

# List available backups
python -m scripts.restore_db --list

# Restore from local file
python -m scripts.restore_db --file /path/to/deepsight_backup_20260210_030000.sql.gz

# Restore from S3 key
python -m scripts.restore_db --s3 db-backups/deepsight_backup_20260210_030000.sql.gz

# Restore most recent S3 backup
python -m scripts.restore_db --latest
```

---

## Admin API Endpoints

### POST /api/admin/backup/trigger

Triggers a manual backup. Requires admin authentication.

**Response:**
```json
{
  "timestamp": "2026-02-10T03:00:00+00:00",
  "status": "success",
  "sql_size_bytes": 1234567,
  "compressed_size_bytes": 234567,
  "filename": "deepsight_backup_20260210_030000.sql.gz",
  "local_path": "/app/data/backups/deepsight_backup_20260210_030000.sql.gz",
  "s3_uri": "s3://deepsight-backups/db-backups/deepsight_backup_20260210_030000.sql.gz",
  "old_backups_deleted": 2
}
```

### GET /api/admin/backup/list

Lists all available backups (local + S3), sorted newest first.

**Response:**
```json
{
  "backups": [
    {
      "source": "s3",
      "filename": "deepsight_backup_20260210_030000.sql.gz",
      "key": "db-backups/deepsight_backup_20260210_030000.sql.gz",
      "size_bytes": 234567,
      "modified": "2026-02-10T03:00:05+00:00"
    },
    {
      "source": "local",
      "filename": "deepsight_backup_20260209_030000.sql.gz",
      "path": "/app/data/backups/deepsight_backup_20260209_030000.sql.gz",
      "size_bytes": 230000,
      "modified": "2026-02-09T03:00:04+00:00"
    }
  ],
  "total": 2
}
```

---

## Backup Process

1. **Dump**: Connect to PostgreSQL via `psycopg2`, enumerate all tables in `public` schema
2. **Schema**: Generate `CREATE TABLE` statements from `information_schema.columns`
3. **Data**: Generate `INSERT INTO` statements for every row
4. **Sequences**: `SELECT setval()` statements to restore sequence counters
5. **Wrap**: Entire dump wrapped in `BEGIN; ... COMMIT;`
6. **Compress**: gzip level 6
7. **Save locally**: `DATA_DIR/backups/deepsight_backup_YYYYMMDD_HHMMSS.sql.gz`
8. **Upload to S3**: With `ServerSideEncryption=AES256`
9. **Cleanup**: Delete S3 objects older than `BACKUP_RETENTION_DAYS`
10. **Email**: Notification to `ADMIN_EMAIL` with file name and sizes

---

## Restore Process

1. Read `.sql.gz` file (local or download from S3)
2. Decompress gzip
3. Connect to PostgreSQL via `psycopg2`
4. Execute full SQL dump in a transaction
5. On error: rollback; on success: commit

**Warning**: Restore drops existing tables (`DROP TABLE IF EXISTS ... CASCADE`). Always verify you're targeting the correct database.

---

## Scheduler

APScheduler `AsyncIOScheduler` is started in the FastAPI `lifespan` context manager:
- Job ID: `daily_backup`
- Trigger: `CronTrigger(hour=BACKUP_CRON_HOUR, minute=BACKUP_CRON_MINUTE)`
- Gracefully shuts down on app stop

If `apscheduler` is not installed, the app starts normally with a warning log.

---

## Dependencies

Added to `requirements.txt`:
- `boto3>=1.34.0` — S3 client
- `apscheduler>=3.10.0` — Cron scheduling
- `psycopg2-binary>=2.9.0` — Sync PostgreSQL driver for SQL dumps

---

## S3 Bucket Setup

```bash
# Create bucket (if not exists)
aws s3 mb s3://deepsight-backups --region eu-west-3

# Recommended: enable versioning
aws s3api put-bucket-versioning \
  --bucket deepsight-backups \
  --versioning-configuration Status=Enabled

# Recommended: lifecycle rule to transition to IA after 90 days
aws s3api put-bucket-lifecycle-configuration \
  --bucket deepsight-backups \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "archive-old-backups",
      "Status": "Enabled",
      "Filter": {"Prefix": "db-backups/"},
      "Transitions": [{"Days": 90, "StorageClass": "STANDARD_IA"}]
    }]
  }'
```
