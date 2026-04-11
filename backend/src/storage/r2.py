"""
Cloudflare R2 storage client (S3-compatible).
Thumbnail upload with async wrapper around boto3.
"""

import asyncio
import logging
from functools import lru_cache

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from core.config import R2_CONFIG

logger = logging.getLogger(__name__)


def is_r2_available() -> bool:
    """Check if R2 credentials are configured."""
    return bool(R2_CONFIG.get("ACCESS_KEY_ID")) and bool(R2_CONFIG.get("ACCOUNT_ID"))


@lru_cache(maxsize=1)
def _get_r2_client():
    """Singleton boto3 S3 client configured for Cloudflare R2."""
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


def get_r2_public_url(key: str) -> str:
    """Build public URL for an R2 object."""
    domain = R2_CONFIG["PUBLIC_DOMAIN"]
    if not domain:
        raise RuntimeError("R2_PUBLIC_DOMAIN not configured")
    return f"https://{domain}/{key}"


async def upload_to_r2(
    image_bytes: bytes,
    key: str,
    content_type: str = "image/webp",
) -> str:
    """Upload bytes to R2 and return the public URL."""
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


async def check_exists_r2(key: str) -> bool:
    """Check whether an object already exists in R2."""
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
