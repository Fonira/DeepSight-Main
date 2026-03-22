"""
DeepSight Smoke Tests — conftest.py
Shared fixtures: headless browser + sync API client.
"""

import os

import httpx
import pytest
from playwright.sync_api import sync_playwright

# ─── URLs ────────────────────────────────────────────────────────────────────

BASE_URL = os.environ.get(
    "SMOKE_TEST_BASE_URL",
    "https://deepsightsynthesis.com",
)
API_URL = os.environ.get(
    "SMOKE_TEST_API_URL",
    "https://api.deepsightsynthesis.com",
)

# ─── Test account ────────────────────────────────────────────────────────────

SMOKE_EMAIL = os.environ.get("SMOKE_TEST_EMAIL", "smoke-test@deepsightsynthesis.com")
SMOKE_PASSWORD = os.environ.get("SMOKE_TEST_PASSWORD", "")
HEALTH_SECRET = os.environ.get("HEALTH_CHECK_SECRET", "")


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def browser_context():
    """Headless Chromium browser shared across the session."""
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            locale="fr-FR",
            timezone_id="Europe/Paris",
            user_agent="DeepSight-SmokeTest/1.0",
        )
        yield context
        context.close()
        browser.close()


@pytest.fixture()
def page(browser_context):
    """Fresh page for each test."""
    p = browser_context.new_page()
    yield p
    p.close()


@pytest.fixture(scope="session")
def api_client():
    """Synchronous httpx client pointed at the backend API."""
    with httpx.Client(
        base_url=API_URL,
        timeout=30.0,
        headers={"User-Agent": "DeepSight-SmokeTest/1.0"},
    ) as client:
        yield client
