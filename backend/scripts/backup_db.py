"""
DeepSight Database Backup Script.

Features:
- pg_dump to gzip compressed file
- Upload to S3/R2 (optional)
- Local rotation (configurable retention)
- Can be called from APScheduler or CLI

Usage:
    # CLI — local backup only
    python -m scripts.backup_db

    # CLI — backup + upload to S3
    python -m scripts.backup_db --upload

    # From code (APScheduler)
    from scripts.backup_db import run_backup
    result = await run_backup(upload=True)
"""

import asyncio
import gzip
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

# Add src/ to path for config imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


def _get_config():
    """Load backup config from environment or settings."""
    try:
        from core.config import BACKUP_CONFIG
        return BACKUP_CONFIG
    except ImportError:
        # Fallback for standalone execution
        return {
            "AWS_ACCESS_KEY_ID": os.environ.get("AWS_ACCESS_KEY_ID", ""),
            "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
            "AWS_REGION": os.environ.get("AWS_REGION", "eu-west-3"),
            "S3_BUCKET": os.environ.get("BACKUP_S3_BUCKET", "deepsight-backups"),
            "S3_PREFIX": os.environ.get("BACKUP_S3_PREFIX", "db-backups/"),
            "RETENTION_DAYS": int(os.environ.get("BACKUP_RETENTION_DAYS", "30")),
        }


def _get_database_url() -> str:
    """Get the raw DATABASE_URL for pg_dump (sync driver)."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)

    # Normalize to plain postgresql://
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    return url


def _parse_db_url(url: str) -> dict:
    """Parse a PostgreSQL URL into connection components."""
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": (parsed.path or "/postgres").lstrip("/"),
    }


def create_backup(backup_dir: str | None = None) -> str:
    """
    Run pg_dump and compress the output.

    Returns the path to the .sql.gz file.
    """
    db_url = _get_database_url()
    db = _parse_db_url(db_url)

    if backup_dir is None:
        backup_dir = os.path.join(tempfile.gettempdir(), "deepsight-backups")
    os.makedirs(backup_dir, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"deepsight_{timestamp}.sql.gz"
    filepath = os.path.join(backup_dir, filename)

    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    ssl_args = []
    if ".proxy.rlwy.net" in db["host"]:
        ssl_args = ["--no-password"]
        env["PGSSLMODE"] = "require"

    cmd = [
        "pg_dump",
        "-h", db["host"],
        "-p", db["port"],
        "-U", db["user"],
        "-d", db["dbname"],
        "--no-owner",
        "--no-acl",
        "--format=plain",
        *ssl_args,
    ]

    print(f"Running pg_dump for {db['dbname']}@{db['host']}:{db['port']}...")

    result = subprocess.run(
        cmd,
        capture_output=True,
        env=env,
        timeout=300,  # 5 min max
    )

    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        raise RuntimeError(f"pg_dump failed (exit {result.returncode}): {stderr[:500]}")

    # Compress
    with gzip.open(filepath, "wb", compresslevel=6) as f:
        f.write(result.stdout)

    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"Backup created: {filepath} ({size_mb:.2f} MB)")

    return filepath


def upload_to_s3(filepath: str) -> str:
    """Upload a backup file to S3/R2. Returns the S3 key."""
    config = _get_config()

    if not config["AWS_ACCESS_KEY_ID"] or not config["AWS_SECRET_ACCESS_KEY"]:
        print("S3 credentials not configured — skipping upload")
        return ""

    import boto3

    s3 = boto3.client(
        "s3",
        aws_access_key_id=config["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=config["AWS_SECRET_ACCESS_KEY"],
        region_name=config["AWS_REGION"],
    )

    filename = os.path.basename(filepath)
    s3_key = f"{config['S3_PREFIX']}{filename}"

    print(f"Uploading to s3://{config['S3_BUCKET']}/{s3_key}...")
    s3.upload_file(filepath, config["S3_BUCKET"], s3_key)
    print(f"Upload complete: {s3_key}")

    return s3_key


def cleanup_old_backups(backup_dir: str | None = None, retention_days: int | None = None):
    """Delete local backup files older than retention_days."""
    config = _get_config()
    if retention_days is None:
        retention_days = config["RETENTION_DAYS"]
    if backup_dir is None:
        backup_dir = os.path.join(tempfile.gettempdir(), "deepsight-backups")

    if not os.path.exists(backup_dir):
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    removed = 0

    for f in Path(backup_dir).glob("deepsight_*.sql.gz"):
        if datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc) < cutoff:
            f.unlink()
            removed += 1
            print(f"Removed old backup: {f.name}")

    return removed


def cleanup_s3_backups(retention_days: int | None = None):
    """Delete S3 backup files older than retention_days."""
    config = _get_config()
    if retention_days is None:
        retention_days = config["RETENTION_DAYS"]

    if not config["AWS_ACCESS_KEY_ID"] or not config["AWS_SECRET_ACCESS_KEY"]:
        return 0

    import boto3

    s3 = boto3.client(
        "s3",
        aws_access_key_id=config["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=config["AWS_SECRET_ACCESS_KEY"],
        region_name=config["AWS_REGION"],
    )

    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    removed = 0

    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=config["S3_BUCKET"], Prefix=config["S3_PREFIX"]):
        for obj in page.get("Contents", []):
            if obj["LastModified"].replace(tzinfo=timezone.utc) < cutoff:
                s3.delete_object(Bucket=config["S3_BUCKET"], Key=obj["Key"])
                removed += 1
                print(f"Removed old S3 backup: {obj['Key']}")

    return removed


async def run_backup(upload: bool = False) -> dict:
    """
    Full backup workflow (callable from APScheduler).

    1. pg_dump → gzip
    2. Upload to S3 (if upload=True and credentials set)
    3. Cleanup old local backups
    4. Cleanup old S3 backups
    """
    result = {"status": "ok", "file": "", "s3_key": "", "cleaned_local": 0, "cleaned_s3": 0}

    try:
        filepath = create_backup()
        result["file"] = filepath

        if upload:
            s3_key = upload_to_s3(filepath)
            result["s3_key"] = s3_key

        result["cleaned_local"] = cleanup_old_backups()

        if upload:
            result["cleaned_s3"] = cleanup_s3_backups()

    except Exception as e:
        result["status"] = "error"
        result["error"] = str(e)
        print(f"Backup error: {e}", file=sys.stderr)

    return result


if __name__ == "__main__":
    upload = "--upload" in sys.argv
    result = asyncio.run(run_backup(upload=upload))
    print(f"\nBackup result: {result}")
    sys.exit(0 if result["status"] == "ok" else 1)
