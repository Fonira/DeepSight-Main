"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar circuit breaker (PR1 / spec §4.6)                             ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • Open après 3 failures consécutives                                              ║
║  • Auto-close après expiration du TTL                                              ║
║  • Reset compteur sur success                                                      ║
║  • Détection HTML CAPTCHA (text patterns)                                          ║
║  • Détection HTML trop court (<5000 bytes)                                         ║
║  • Pass-through si Redis down                                                      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys
import time

import pytest

_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic import scholar  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_scholar_state():
    scholar._reset_state_for_tests()
    yield
    scholar._reset_state_for_tests()


# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cb_opens_after_3_failures(redis_client_fixture):
    """After SCHOLAR_CB_THRESHOLD=3 consecutive failures, breaker opens."""
    await scholar.init_scholar_redis(redis_client_fixture)

    assert await scholar.is_circuit_open() is False

    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is False

    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is False

    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is True


@pytest.mark.asyncio
async def test_cb_closes_after_duration(redis_client_fixture, monkeypatch):
    """When CB_OPEN key TTL expires (we emulate by deleting), CB closes."""
    await scholar.init_scholar_redis(redis_client_fixture)

    # Force open the breaker by direct key set in the past.
    in_the_past = time.time() - 10  # already expired
    await redis_client_fixture.set(scholar.SCHOLAR_CB_OPEN_KEY, str(in_the_past), ex=60)
    assert await scholar.is_circuit_open() is False

    # And confirm a fresh future open works.
    future = time.time() + 3600
    await redis_client_fixture.set(scholar.SCHOLAR_CB_OPEN_KEY, str(future), ex=3600)
    assert await scholar.is_circuit_open() is True


@pytest.mark.asyncio
async def test_cb_resets_on_success(redis_client_fixture):
    """Recording success after 2 failures resets the counter (no premature open)."""
    await scholar.init_scholar_redis(redis_client_fixture)

    await scholar._record_failure("http_429")
    await scholar._record_failure("http_429")
    await scholar._record_success()

    # The next failure should not trigger open since counter was reset.
    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is False

    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is False

    # Now 3rd failure since reset → open.
    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is True


def test_cb_detects_captcha_html():
    """HTML containing CAPTCHA markers → is_bad_html returns a reason."""
    cases = [
        # Each one is padded to > 5000 bytes so we test ONLY the captcha pattern.
        ("garbage " * 1000 + "/sorry/index?continue=blah", "captcha_pattern:/sorry/index"),
        ("garbage " * 1000 + "<title>Sorry...</title>", "captcha_pattern:<title>sorry..."),
        ("garbage " * 1000 + "unusual traffic from your computer network detected", "captcha_pattern:unusual traffic from your computer network"),
        ("garbage " * 1000 + "please complete this CAPTCHA to continue", "captcha_pattern:captcha"),
    ]
    for html, expected_substr in cases:
        reason = scholar._is_bad_html(html)
        assert reason is not None, f"expected bad reason for html with {expected_substr!r}"
        assert reason == expected_substr, (
            f"expected reason {expected_substr!r}, got {reason!r}"
        )


def test_cb_detects_short_html():
    """HTML below SCHOLAR_MIN_HTML_BYTES (5000) → bad reason 'html_too_short_*'."""
    short_html = "<html><body>tiny</body></html>"
    assert len(short_html) < scholar.SCHOLAR_MIN_HTML_BYTES
    reason = scholar._is_bad_html(short_html)
    assert reason is not None
    assert reason.startswith("html_too_short_")
    # Long enough HTML without captcha markers → None.
    long_html = "<html>" + ("a" * 10000) + "</html>"
    assert scholar._is_bad_html(long_html) is None


@pytest.mark.asyncio
async def test_cb_passes_through_if_redis_down():
    """No Redis client configured → CB no-ops gracefully, never raises."""
    # We explicitly DO NOT call init_scholar_redis here (state reset by autouse fixture).
    assert scholar._redis_client is None

    # is_circuit_open returns False (fail-open).
    assert await scholar.is_circuit_open() is False

    # record_failure / record_success are silent no-ops.
    await scholar._record_failure("http_429")
    await scholar._record_failure("http_429")
    await scholar._record_failure("http_429")
    await scholar._record_failure("http_429")
    assert await scholar.is_circuit_open() is False  # still closed (no Redis to track)

    await scholar._record_success()  # no exception
