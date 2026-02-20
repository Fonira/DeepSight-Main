"""
DeepSight Database Restore Script.

Restores a PostgreSQL backup from a .sql.gz file.

Usage:
    python -m scripts.restore_db path/to/backup.sql.gz
    python -m scripts.restore_db --from-s3 deepsight_20260212_030000.sql.gz
    python -m scripts.restore_db --latest  # Restore most recent S3 backup

Safety:
- Requires explicit --confirm flag for production databases
- Shows database info before restoring
- Creates a pre-restore backup by default
"""

import gzip
import os
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))


def _get_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        print("ERROR: DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)
    url = url.replace("postgresql+asyncpg://", "postgresql://")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def _parse_db_url(url: str) -> dict:
    parsed = urlparse(url)
    return {
        "host": parsed.hostname or "localhost",
        "port": str(parsed.port or 5432),
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "dbname": (parsed.path or "/postgres").lstrip("/"),
    }


def _is_production(db: dict) -> bool:
    """Detect if this is a production database."""
    host = db["host"]
    return ".railway.app" in host or ".proxy.rlwy.net" in host


def download_from_s3(filename: str) -> str:
    """Download a backup file from S3."""
    try:
        from core.config import BACKUP_CONFIG as config
    except ImportError:
        config = {
            "AWS_ACCESS_KEY_ID": os.environ.get("AWS_ACCESS_KEY_ID", ""),
            "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
            "AWS_REGION": os.environ.get("AWS_REGION", "eu-west-3"),
            "S3_BUCKET": os.environ.get("BACKUP_S3_BUCKET", "deepsight-backups"),
            "S3_PREFIX": os.environ.get("BACKUP_S3_PREFIX", "db-backups/"),
        }

    import boto3

    s3 = boto3.client(
        "s3",
        aws_access_key_id=config["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=config["AWS_SECRET_ACCESS_KEY"],
        region_name=config["AWS_REGION"],
    )

    s3_key = f"{config['S3_PREFIX']}{filename}"
    local_path = os.path.join(tempfile.gettempdir(), filename)

    print(f"Downloading s3://{config['S3_BUCKET']}/{s3_key}...")
    s3.download_file(config["S3_BUCKET"], s3_key, local_path)
    print(f"Downloaded to {local_path}")

    return local_path


def get_latest_s3_backup() -> str:
    """Find the most recent backup in S3."""
    try:
        from core.config import BACKUP_CONFIG as config
    except ImportError:
        config = {
            "AWS_ACCESS_KEY_ID": os.environ.get("AWS_ACCESS_KEY_ID", ""),
            "AWS_SECRET_ACCESS_KEY": os.environ.get("AWS_SECRET_ACCESS_KEY", ""),
            "AWS_REGION": os.environ.get("AWS_REGION", "eu-west-3"),
            "S3_BUCKET": os.environ.get("BACKUP_S3_BUCKET", "deepsight-backups"),
            "S3_PREFIX": os.environ.get("BACKUP_S3_PREFIX", "db-backups/"),
        }

    import boto3

    s3 = boto3.client(
        "s3",
        aws_access_key_id=config["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=config["AWS_SECRET_ACCESS_KEY"],
        region_name=config["AWS_REGION"],
    )

    response = s3.list_objects_v2(
        Bucket=config["S3_BUCKET"],
        Prefix=config["S3_PREFIX"],
    )

    objects = response.get("Contents", [])
    if not objects:
        print("ERROR: No backups found in S3", file=sys.stderr)
        sys.exit(1)

    latest = max(objects, key=lambda o: o["LastModified"])
    filename = latest["Key"].split("/")[-1]
    print(f"Latest backup: {filename} ({latest['LastModified']})")

    return download_from_s3(filename)


def restore_backup(filepath: str, skip_backup: bool = False):
    """Restore a .sql.gz backup into the database."""
    if not filepath.endswith(".sql.gz"):
        print("ERROR: Expected a .sql.gz file", file=sys.stderr)
        sys.exit(1)

    if not os.path.exists(filepath):
        print(f"ERROR: File not found: {filepath}", file=sys.stderr)
        sys.exit(1)

    db_url = _get_database_url()
    db = _parse_db_url(db_url)

    print(f"\n{'='*60}")
    print(f"  RESTORE TARGET")
    print(f"  Host:     {db['host']}:{db['port']}")
    print(f"  Database: {db['dbname']}")
    print(f"  User:     {db['user']}")
    print(f"  File:     {filepath}")
    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"  Size:     {size_mb:.2f} MB")
    print(f"{'='*60}\n")

    if _is_production(db):
        if "--confirm" not in sys.argv:
            print("WARNING: This is a PRODUCTION database!")
            print("Add --confirm to proceed.")
            sys.exit(1)

    # Pre-restore backup
    if not skip_backup:
        print("Creating pre-restore backup...")
        try:
            from scripts.backup_db import create_backup
            pre_backup = create_backup()
            print(f"Pre-restore backup: {pre_backup}")
        except Exception as e:
            print(f"WARNING: Pre-restore backup failed: {e}")
            if "--force" not in sys.argv:
                print("Add --force to skip pre-restore backup.")
                sys.exit(1)

    # Decompress
    print("Decompressing backup...")
    sql_path = filepath.replace(".sql.gz", ".sql")
    with gzip.open(filepath, "rb") as f_in:
        with open(sql_path, "wb") as f_out:
            f_out.write(f_in.read())

    # Restore
    env = os.environ.copy()
    env["PGPASSWORD"] = db["password"]

    ssl_env = {}
    if ".proxy.rlwy.net" in db["host"]:
        ssl_env["PGSSLMODE"] = "require"

    cmd = [
        "psql",
        "-h", db["host"],
        "-p", db["port"],
        "-U", db["user"],
        "-d", db["dbname"],
        "-f", sql_path,
        "--quiet",
    ]

    print(f"Restoring to {db['dbname']}...")
    result = subprocess.run(
        cmd,
        capture_output=True,
        env={**env, **ssl_env},
        timeout=600,  # 10 min max
    )

    # Cleanup temp SQL
    try:
        os.unlink(sql_path)
    except OSError:
        pass

    if result.returncode != 0:
        stderr = result.stderr.decode("utf-8", errors="replace")
        # psql may return warnings that are not fatal
        if "ERROR" in stderr:
            print(f"Restore completed with errors:\n{stderr[:1000]}", file=sys.stderr)
        else:
            print(f"Restore completed with warnings:\n{stderr[:500]}")
    else:
        print("Restore completed successfully!")

    return result.returncode


def main():
    if len(sys.argv) < 2 or "--help" in sys.argv:
        print("Usage:")
        print("  python -m scripts.restore_db <backup.sql.gz>      # Restore from local file")
        print("  python -m scripts.restore_db --from-s3 <filename>  # Download from S3 and restore")
        print("  python -m scripts.restore_db --latest              # Restore most recent S3 backup")
        print()
        print("Options:")
        print("  --confirm       Required for production databases")
        print("  --force         Skip pre-restore backup")
        print("  --skip-backup   Skip pre-restore backup")
        sys.exit(0)

    skip_backup = "--skip-backup" in sys.argv or "--force" in sys.argv

    if "--latest" in sys.argv:
        filepath = get_latest_s3_backup()
    elif "--from-s3" in sys.argv:
        idx = sys.argv.index("--from-s3")
        if idx + 1 >= len(sys.argv):
            print("ERROR: --from-s3 requires a filename", file=sys.stderr)
            sys.exit(1)
        filepath = download_from_s3(sys.argv[idx + 1])
    else:
        filepath = sys.argv[1]

    exit_code = restore_backup(filepath, skip_backup=skip_backup)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
