"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 Phase 5 — track_event() helper                                                 ║
║  • No-op when POSTHOG_API_KEY is empty                                             ║
║  • Never raises (best-effort)                                                      ║
║  • Schedules an async task when a running loop is available                        ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from unittest.mock import patch, AsyncMock, MagicMock

import pytest


def test_track_event_noop_without_api_key():
    """No POSTHOG_API_KEY → track_event must do nothing and not raise."""
    from core import analytics

    fake_settings = MagicMock()
    fake_settings.POSTHOG_API_KEY = ""
    fake_settings.POSTHOG_HOST = "https://eu.i.posthog.com"

    with patch("core.analytics._settings", fake_settings):
        # Calling without an event loop must not raise
        analytics.track_event("noop_event", {"x": 1})


def test_track_event_never_raises_on_internal_error():
    """If asyncio.create_task itself blows up, track_event must swallow it."""
    from core import analytics

    fake_settings = MagicMock()
    fake_settings.POSTHOG_API_KEY = "phc_fake"
    fake_settings.POSTHOG_HOST = "https://eu.i.posthog.com"

    # Force the synchronous path by making asyncio.get_event_loop raise
    with patch("core.analytics._settings", fake_settings), patch(
        "core.analytics.asyncio.get_event_loop", side_effect=RuntimeError("no loop")
    ), patch("core.analytics.httpx.Client") as client_cls:
        # Make the sync POST blow up — must not propagate
        client_cls.side_effect = Exception("network down")
        analytics.track_event("test_event", {"plan": "pro"})


@pytest.mark.asyncio
async def test_track_event_schedules_async_task_when_enabled():
    """With a running loop and an api key, track_event creates a task."""
    from core import analytics

    fake_settings = MagicMock()
    fake_settings.POSTHOG_API_KEY = "phc_fake"
    fake_settings.POSTHOG_HOST = "https://eu.i.posthog.com"

    sent = AsyncMock()
    with patch("core.analytics._settings", fake_settings), patch(
        "core.analytics._send_event_async", sent
    ):
        analytics.track_event("web_search_provider_used", {"provider": "mistral_agent"})

        # Give the event loop a tick to dispatch the created task
        import asyncio
        await asyncio.sleep(0.05)

    sent.assert_called_once()
    call = sent.call_args
    assert call.args[0] == "web_search_provider_used"
    assert call.args[1] == {"provider": "mistral_agent"}
