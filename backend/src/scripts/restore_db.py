"""
Database Restore — Download backup from S3 or local, decompress, execute SQL.

Usage:
    python -m scripts.restore_db --list                          # List available backups
    python -m scripts.restore_db --file deepsight_backup_*.gz    # Restore from local file
    python -m scripts.restore_db --s3 db-backups/file.sql.gz     # Restore from S3 key
    python -m scripts.restore_db --latest                        # Restore most recent S3 backup
"""

from __future__ import annotations

import gzip
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

_HERE = Path(__file__).resolve().parent.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))


def _get_pg_dsn() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    for prefix in ("postgresql+asyncpg://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
    if "?" in url:
        url = url.split("?", 1)[0]
    return url


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        region_name=os.environ.get("AWS_REGION", "eu-west-3"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
    )


def _s3_bucket() -> str:
    return os.environ.get("BACKUP_S3_BUCKET", "deepsight-backups")


def _s3_prefix() -> str:
    return os.environ.get("BACKUP_S3_PREFIX", "db-backups/")


# ---------------------------------------------------------------------------
# List backups
# ---------------------------------------------------------------------------

def list_local_backups() -> list[dict]:
    """List backups in DATA_DIR/backups/."""
    from core.config import DATA_DIR

    backup_dir = Path(DATA_DIR) / "backups"
    if not backup_dir.exists():
        return []

    results = []
    for f in sorted(backup_dir.glob("*.sql.gz"), reverse=True):
        stat = f.stat()
        results.append({
            "source": "local",
            "filename": f.name,
            "path": str(f),
            "size_bytes": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return results


def list_s3_backups() -> list[dict]:
    """List backups in S3 bucket."""
    try:
        client = _s3_client()
        bucket = _s3_bucket()
        prefix = _s3_prefix()
    except Exception:
        return []

    results = []
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                if not key.endswith(".sql.gz"):
                    continue
                results.append({
                    "source": "s3",
                    "filename": key.split("/")[-1],
                    "key": key,
                    "size_bytes": obj["Size"],
                    "modified": obj["LastModified"].isoformat(),
                })
    except Exception as e:
        print(f"S3 list error: {e}", flush=True)

    return sorted(results, key=lambda x: x["modified"], reverse=True)


async def list_all_backups() -> list[dict]:
    """Combined local + S3 backup list, sorted newest-first."""
    import asyncio

    loop = asyncio.get_event_loop()
    local = await loop.run_in_executor(None, list_local_backups)
    s3 = await loop.run_in_executor(None, list_s3_backups)
    combined = local + s3
    combined.sort(key=lambda x: x["modified"], reverse=True)
    return combined


# ---------------------------------------------------------------------------
# Download from S3
# ---------------------------------------------------------------------------

def download_from_s3(key: str) -> bytes:
    """Download a backup file from S3. Returns raw (compressed) bytes."""
    client = _s3_client()
    bucket = _s3_bucket()
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


# ---------------------------------------------------------------------------
# Restore logic
# ---------------------------------------------------------------------------

def restore_sql(dsn: str, sql: str) -> int:
    """Execute SQL dump against the database. Returns number of statements."""
    import psycopg2

    conn = psycopg2.connect(dsn)
    conn.set_session(autocommit=False)
    cur = conn.cursor()

    try:
        cur.execute(sql)
        conn.commit()
        stmt_count = sql.count(";")
        print(f"Restore complete (~{stmt_count} statements)", flush=True)
        return stmt_count
    except Exception as e:
        conn.rollback()
        raise RuntimeError(f"Restore failed: {e}") from e
    finally:
        cur.close()
        conn.close()


async def restore_from_local(filepath: str) -> dict:
    """Restore from a local .sql.gz file."""
    import asyncio

    loop = asyncio.get_event_loop()
    dsn = _get_pg_dsn()

    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Backup file not found: {filepath}")

    compressed = path.read_bytes()
    sql = gzip.decompress(compressed).decode("utf-8")

    stmt_count = await loop.run_in_executor(None, restore_sql, dsn, sql)

    return {
        "status": "success",
        "source": "local",
        "file": str(path),
        "sql_size": len(sql),
        "statements": stmt_count,
    }


async def restore_from_s3(key: str) -> dict:
    """Restore from an S3 backup key."""
    import asyncio

    loop = asyncio.get_event_loop()
    dsn = _get_pg_dsn()

    compressed = await loop.run_in_executor(None, download_from_s3, key)
    sql = gzip.decompress(compressed).decode("utf-8")

    stmt_count = await loop.run_in_executor(None, restore_sql, dsn, sql)

    return {
        "status": "success",
        "source": "s3",
        "key": key,
        "sql_size": len(sql),
        "statements": stmt_count,
    }


async def restore_latest() -> dict:
    """Restore the most recent S3 backup."""
    backups = list_s3_backups()
    if not backups:
        raise RuntimeError("No S3 backups found")
    return await restore_from_s3(backups[0]["key"])


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio

    if "--list" in sys.argv:
        local = list_local_backups()
        s3 = list_s3_backups()
        print(f"\n--- Local backups ({len(local)}) ---")
        for b in local:
            size_mb = round(b["size_bytes"] / (1024 * 1024), 2)
            print(f"  {b['filename']}  {size_mb} MB  {b['modified']}")
        print(f"\n--- S3 backups ({len(s3)}) ---")
        for b in s3:
            size_mb = round(b["size_bytes"] / (1024 * 1024), 2)
            print(f"  {b['filename']}  {size_mb} MB  {b['modified']}")

    elif "--file" in sys.argv:
        idx = sys.argv.index("--file")
        filepath = sys.argv[idx + 1]
        print(f"Restoring from local file: {filepath}")
        result = asyncio.run(restore_from_local(filepath))
        for k, v in result.items():
            print(f"  {k}: {v}")

    elif "--s3" in sys.argv:
        idx = sys.argv.index("--s3")
        key = sys.argv[idx + 1]
        print(f"Restoring from S3: {key}")
        result = asyncio.run(restore_from_s3(key))
        for k, v in result.items():
            print(f"  {k}: {v}")

    elif "--latest" in sys.argv:
        print("Restoring most recent S3 backup...")
        result = asyncio.run(restore_latest())
        for k, v in result.items():
            print(f"  {k}: {v}")

    else:
        print(__doc__)
        sys.exit(1)
