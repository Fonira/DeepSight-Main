"""
Cloudflare R2 storage client (S3-compatible) with local filesystem fallback.

When R2 credentials are configured → uploads to Cloudflare R2.
When not → saves to local VPS filesystem, served via FastAPI StaticFiles.
The switch is transparent to callers.
"""

import asyncio
import logging
import os
from functools import lru_cache
from pathlib import Path

from core.config import R2_CONFIG

logger = logging.getLogger(__name__)

# ── Local filesystem fallback config ──────────────────────────────────────────
LOCAL_THUMB_DIR = Path(os.environ.get("THUMBNAIL_LOCAL_DIR", "/app/data/thumbnails"))
THUMBNAIL_BASE_URL = os.environ.get("THUMBNAIL_BASE_URL", "")


# ═══════════════════════════════════════════════════════════════════════════════
# Availability checks
# ═══════════════════════════════════════════════════════════════════════════════


def _is_r2_credentials_set() -> bool:
    """Check if R2 S3-compatible credentials are configured (not CHANGEME)."""
    key = R2_CONFIG.get("ACCESS_KEY_ID", "")
    return bool(key) and key != "CHANGEME" and bool(R2_CONFIG.get("ACCOUNT_ID"))


def _is_local_available() -> bool:
    """Check if local filesystem fallback is configured."""
    return bool(THUMBNAIL_BASE_URL)


def is_r2_available() -> bool:
    """Check if any storage backend (R2 or local) is available."""
    return _is_r2_credentials_set() or _is_local_available()


# ═══════════════════════════════════════════════════════════════════════════════
# R2 client (only initialized when credentials exist)
# ═══════════════════════════════════════════════════════════════════════════════


@lru_cache(maxsize=1)
def _get_r2_client():
    """Singleton boto3 S3 client configured for Cloudflare R2."""
    import boto3
    from botocore.config import Config as BotoConfig

    account_id = R2_CONFIG["ACCOUNT_ID"]
    if not account_id:
        raise RuntimeError("R2_ACCOUNT_ID not configured")

    return boto3.client(
        service_name="s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_CONFIG["ACCESS_KEY_ID"],
        aws_secret_access_key=R2_CONFIG["SECRET_ACCESS_KEY"],
        region_name="auto",
        config=BotoConfig(retries=dict(max_attempts=3)),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Public URL builders
# ═══════════════════════════════════════════════════════════════════════════════


def get_r2_public_url(key: str) -> str:
    """Build public URL for a stored thumbnail (R2 or local)."""
    if _is_r2_credentials_set():
        domain = R2_CONFIG["PUBLIC_DOMAIN"]
        if not domain:
            raise RuntimeError("R2_PUBLIC_DOMAIN not configured")
        return f"https://{domain}/{key}"
    # Local fallback
    base = THUMBNAIL_BASE_URL.rstrip("/")
    return f"{base}/{key}"


# ═══════════════════════════════════════════════════════════════════════════════
# Upload (dual-mode: R2 or local)
# ═══════════════════════════════════════════════════════════════════════════════


async def upload_to_r2(
    image_bytes: bytes,
    key: str,
    content_type: str = "image/webp",
) -> str:
    """Upload bytes to R2 or local filesystem and return the public URL."""
    if _is_r2_credentials_set():
        return await _upload_r2(image_bytes, key, content_type)
    return await _upload_local(image_bytes, key)


async def _upload_r2(image_bytes: bytes, key: str, content_type: str) -> str:
    """Upload to Cloudflare R2 via boto3."""

    client = _get_r2_client()
    await asyncio.to_thread(
        client.put_object,
        Bucket=R2_CONFIG["BUCKET"],
        Key=key,
        Body=image_bytes,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    url = get_r2_public_url(key)
    logger.info(f"📤 R2 uploaded: {key} ({len(image_bytes)} bytes)")
    return url


async def _upload_local(image_bytes: bytes, key: str) -> str:
    """Save to local filesystem (VPS fallback)."""
    path = LOCAL_THUMB_DIR / key
    await asyncio.to_thread(_write_file, path, image_bytes)
    url = get_r2_public_url(key)
    logger.info(f"📤 Local saved: {key} ({len(image_bytes)} bytes)")
    return url


def _write_file(path: Path, data: bytes) -> None:
    """Sync helper — creates parent dirs and writes bytes."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


# ═══════════════════════════════════════════════════════════════════════════════
# Exists check (dual-mode)
# ═══════════════════════════════════════════════════════════════════════════════


async def check_exists_r2(key: str) -> bool:
    """Check whether a thumbnail already exists (R2 or local)."""
    if _is_r2_credentials_set():
        return await _check_exists_r2_remote(key)
    return await asyncio.to_thread(lambda: (LOCAL_THUMB_DIR / key).exists())


async def _check_exists_r2_remote(key: str) -> bool:
    """Check object existence in Cloudflare R2."""
    from botocore.exceptions import ClientError

    client = _get_r2_client()
    try:
        await asyncio.to_thread(
            client.head_object,
            Bucket=R2_CONFIG["BUCKET"],
            Key=key,
        )
        return True
    except ClientError:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# Bulk delete by prefix (used by GDPR account deletion)
# ═══════════════════════════════════════════════════════════════════════════════


async def delete_objects_by_prefix(prefix: str) -> int:
    """Delete every stored object whose key starts with `prefix`. Best-effort.

    Returns the number of objects successfully removed. Errors are logged but
    not raised: callers (e.g. RGPD account deletion) must keep going even if
    storage is partially unreachable.
    """
    if not prefix:
        return 0
    if _is_r2_credentials_set():
        return await asyncio.to_thread(_delete_r2_by_prefix_sync, prefix)
    return await asyncio.to_thread(_delete_local_by_prefix_sync, prefix)


def _delete_r2_by_prefix_sync(prefix: str) -> int:
    """List + batch-delete every R2 object under `prefix` (max 1000/batch)."""
    from botocore.exceptions import ClientError

    try:
        client = _get_r2_client()
    except Exception as exc:
        logger.error(f"R2 client unavailable for prefix delete {prefix}: {exc}")
        return 0

    bucket = R2_CONFIG["BUCKET"]
    deleted = 0
    paginator = client.get_paginator("list_objects_v2")

    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            contents = page.get("Contents") or []
            if not contents:
                continue
            objects = [{"Key": obj["Key"]} for obj in contents]
            try:
                response = client.delete_objects(
                    Bucket=bucket,
                    Delete={"Objects": objects, "Quiet": True},
                )
                errors = response.get("Errors", [])
                deleted += len(objects) - len(errors)
                if errors:
                    logger.error(
                        f"R2 batch delete partial failure for {prefix}: "
                        f"{len(errors)} errors (first: {errors[0]})"
                    )
            except ClientError as exc:
                logger.error(f"R2 batch delete failed for prefix {prefix}: {exc}")
    except ClientError as exc:
        logger.error(f"R2 list_objects failed for prefix {prefix}: {exc}")

    return deleted


def _delete_local_by_prefix_sync(prefix: str) -> int:
    """Delete every local file under LOCAL_THUMB_DIR/<prefix>. Best-effort."""
    target = LOCAL_THUMB_DIR / prefix
    if not target.exists():
        return 0

    deleted = 0
    if target.is_file():
        try:
            target.unlink()
            return 1
        except OSError as exc:
            logger.error(f"Local delete failed for {target}: {exc}")
            return 0

    for path in target.rglob("*"):
        if path.is_file():
            try:
                path.unlink()
                deleted += 1
            except OSError as exc:
                logger.error(f"Local delete failed for {path}: {exc}")

    try:
        target.rmdir()
    except OSError:
        pass

    return deleted
