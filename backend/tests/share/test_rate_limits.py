import pytest
from middleware.rate_limiter import DEFAULT_LIMITS, ENDPOINT_CATEGORIES


def test_share_categories_are_defined():
    assert "share_read" in DEFAULT_LIMITS
    assert "share_create" in DEFAULT_LIMITS


def test_share_read_limit_is_60_per_minute():
    assert DEFAULT_LIMITS["share_read"] == (60, 60)


def test_share_create_limit_is_10_per_minute():
    assert DEFAULT_LIMITS["share_create"] == (10, 60)


def test_share_endpoints_are_mapped():
    assert ENDPOINT_CATEGORIES.get("/api/share") == "share_create"
