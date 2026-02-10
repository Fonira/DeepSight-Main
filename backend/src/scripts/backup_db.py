"""
Database Backup — PostgreSQL dump via psycopg2, gzip, upload to S3.

Usage:
    # From backend/src/
    python -m scripts.backup_db            # Run backup now
    python -m scripts.backup_db --local    # Dump locally only (no S3)
"""

from __future__ import annotations

import gzip
import io
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

# ---------------------------------------------------------------------------
# Ensure project root is on sys.path when run as __main__
# ---------------------------------------------------------------------------
_HERE = Path(__file__).resolve().parent.parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))


def _get_pg_dsn() -> str:
    """Return a psycopg2-compatible DSN from DATABASE_URL."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    # Normalise driver prefix to plain postgresql://
    for prefix in ("postgresql+asyncpg://", "postgres://"):
        if url.startswith(prefix):
            url = "postgresql://" + url[len(prefix):]
    # Strip query params (sslmode handled separately)
    if "?" in url:
        url = url.split("?", 1)[0]
    return url


def _s3_client():
    """Return a boto3 S3 client using env vars."""
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
# Core backup logic
# ---------------------------------------------------------------------------

def dump_database_sql(dsn: str) -> bytes:
    """Connect via psycopg2 and produce a full SQL dump (schema + data)."""
    import psycopg2

    conn = psycopg2.connect(dsn)
    conn.set_session(readonly=True)

    buf = io.StringIO()
    buf.write(f"-- Deep Sight database backup\n")
    buf.write(f"-- Generated: {datetime.now(timezone.utc).isoformat()}\n")
    buf.write(f"-- Source: {urlparse(dsn).hostname}\n\n")
    buf.write("BEGIN;\n\n")

    cur = conn.cursor()

    # 1. Enumerate user tables in public schema
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    tables = [row[0] for row in cur.fetchall()]

    for table in tables:
        # Schema: CREATE TABLE via pg_dump-style information_schema query
        cur.execute("""
            SELECT column_name, data_type, character_maximum_length,
                   column_default, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table,))
        columns = cur.fetchall()

        buf.write(f"-- Table: {table}\n")
        buf.write(f"DROP TABLE IF EXISTS \"{table}\" CASCADE;\n")
        buf.write(f"CREATE TABLE \"{table}\" (\n")

        col_defs = []
        col_names = []
        for col_name, dtype, max_len, default, nullable in columns:
            col_names.append(col_name)
            type_str = dtype.upper()
            if max_len:
                type_str = f"{type_str}({max_len})"
            parts = [f"  \"{col_name}\" {type_str}"]
            if default:
                parts.append(f"DEFAULT {default}")
            if nullable == "NO":
                parts.append("NOT NULL")
            col_defs.append(" ".join(parts))

        buf.write(",\n".join(col_defs))
        buf.write("\n);\n\n")

        # Data: COPY-style INSERTs
        if not col_names:
            continue

        cur.execute(f'SELECT * FROM "{table}"')
        rows = cur.fetchall()

        if rows:
            quoted_cols = ", ".join(f'"{c}"' for c in col_names)
            for row in rows:
                values = []
                for val in row:
                    if val is None:
                        values.append("NULL")
                    elif isinstance(val, bool):
                        values.append("TRUE" if val else "FALSE")
                    elif isinstance(val, (int, float)):
                        values.append(str(val))
                    elif isinstance(val, datetime):
                        values.append(f"'{val.isoformat()}'")
                    elif isinstance(val, bytes):
                        values.append(f"E'\\\\x{val.hex()}'")
                    else:
                        escaped = str(val).replace("'", "''")
                        values.append(f"'{escaped}'")
                buf.write(f"INSERT INTO \"{table}\" ({quoted_cols}) VALUES ({', '.join(values)});\n")
            buf.write("\n")

    # Sequences
    cur.execute("""
        SELECT sequence_name FROM information_schema.sequences
        WHERE sequence_schema = 'public'
    """)
    for (seq_name,) in cur.fetchall():
        cur.execute(f"SELECT last_value FROM \"{seq_name}\"")
        last_val = cur.fetchone()[0]
        buf.write(f"SELECT setval('\"{seq_name}\"', {last_val}, true);\n")

    buf.write("\nCOMMIT;\n")

    cur.close()
    conn.close()

    return buf.getvalue().encode("utf-8")


def compress(data: bytes) -> bytes:
    """gzip-compress the data."""
    return gzip.compress(data, compresslevel=6)


def upload_to_s3(compressed: bytes, key: str) -> str:
    """Upload compressed backup to S3. Returns the S3 key."""
    client = _s3_client()
    bucket = _s3_bucket()
    client.put_object(
        Bucket=bucket,
        Key=key,
        Body=compressed,
        ContentType="application/gzip",
        ServerSideEncryption="AES256",
    )
    return f"s3://{bucket}/{key}"


def cleanup_old_backups(days: int = 30) -> list[str]:
    """Delete S3 backups older than `days`. Returns list of deleted keys."""
    client = _s3_client()
    bucket = _s3_bucket()
    prefix = _s3_prefix()
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    deleted = []
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            if obj["LastModified"].replace(tzinfo=timezone.utc) < cutoff:
                client.delete_object(Bucket=bucket, Key=obj["Key"])
                deleted.append(obj["Key"])
    return deleted


def save_local(compressed: bytes, filename: str) -> str:
    """Save backup to local data directory. Returns file path."""
    from core.config import DATA_DIR

    backup_dir = Path(DATA_DIR) / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    path = backup_dir / filename
    path.write_bytes(compressed)
    return str(path)


# ---------------------------------------------------------------------------
# High-level run_backup (called by scheduler and admin endpoint)
# ---------------------------------------------------------------------------

async def run_backup(upload: bool = True) -> dict:
    """
    Execute a full backup. Returns a summary dict.

    Can be called from async context (scheduler, endpoint) or sync (__main__).
    The heavy I/O (psycopg2, S3) runs in the default executor.
    """
    import asyncio

    loop = asyncio.get_event_loop()
    result: dict = {"timestamp": datetime.now(timezone.utc).isoformat(), "status": "started"}

    try:
        dsn = _get_pg_dsn()
    except RuntimeError:
        # No PostgreSQL — try SQLite fallback
        result["status"] = "skipped"
        result["reason"] = "DATABASE_URL not set (SQLite dev mode)"
        return result

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"deepsight_backup_{timestamp}.sql.gz"

    # Dump + compress (blocking I/O in executor)
    sql_bytes = await loop.run_in_executor(None, dump_database_sql, dsn)
    compressed = await loop.run_in_executor(None, compress, sql_bytes)

    result["sql_size_bytes"] = len(sql_bytes)
    result["compressed_size_bytes"] = len(compressed)
    result["filename"] = filename

    # Always save locally
    local_path = await loop.run_in_executor(None, save_local, compressed, filename)
    result["local_path"] = local_path

    # Upload to S3
    if upload and os.environ.get("AWS_ACCESS_KEY_ID"):
        s3_key = _s3_prefix() + filename
        s3_uri = await loop.run_in_executor(None, upload_to_s3, compressed, s3_key)
        result["s3_uri"] = s3_uri

        # Cleanup old backups
        deleted = await loop.run_in_executor(None, cleanup_old_backups, 30)
        result["old_backups_deleted"] = len(deleted)
    else:
        result["s3_uri"] = None
        result["old_backups_deleted"] = 0

    result["status"] = "success"

    # Send notification email
    try:
        from services.email_service import email_service
        from core.config import ADMIN_CONFIG

        admin_email = ADMIN_CONFIG.get("ADMIN_EMAIL", "")
        if admin_email:
            size_mb = round(len(compressed) / (1024 * 1024), 2)
            await email_service.send_email(
                to=admin_email,
                subject=f"Backup OK — {filename} ({size_mb} MB)",
                html_content=(
                    f"<h3>Backup completed</h3>"
                    f"<p><strong>File:</strong> {filename}</p>"
                    f"<p><strong>SQL size:</strong> {len(sql_bytes):,} bytes</p>"
                    f"<p><strong>Compressed:</strong> {len(compressed):,} bytes ({size_mb} MB)</p>"
                    f"<p><strong>S3:</strong> {result.get('s3_uri', 'N/A')}</p>"
                    f"<p><strong>Old backups cleaned:</strong> {result['old_backups_deleted']}</p>"
                ),
            )
    except Exception as e:
        result["email_error"] = str(e)

    return result


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import asyncio

    local_only = "--local" in sys.argv
    print(f"Starting database backup (upload={'no' if local_only else 'yes'})...", flush=True)

    result = asyncio.run(run_backup(upload=not local_only))

    for k, v in result.items():
        print(f"  {k}: {v}", flush=True)

    sys.exit(0 if result["status"] == "success" else 1)
