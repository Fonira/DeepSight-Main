"""Tests for voice.analysis_runner — DB-backed analysis sections + final digest."""
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from voice.analysis_runner import run_for_video, final_digest_for_video


@pytest.mark.asyncio
async def test_run_for_video_returns_sections_when_full_digest_ready(monkeypatch):
    """When the Summary has full_digest populated, return a flat dict of sections."""
    fake_summary = MagicMock(
        id=42,
        full_digest={
            "summary": "Section résumé du contenu",
            "keypoints": ["pt1", "pt2", "pt3"],
            "sources": [{"title": "src1"}, {"title": "src2"}],
        },
    )

    from voice import analysis_runner

    async def fake_load(video_id, user_id):
        return fake_summary

    monkeypatch.setattr(analysis_runner, "_load_summary_with_full_digest", fake_load)

    result = await run_for_video("dQw4w9WgXcQ", 1)

    assert isinstance(result, dict)
    assert "summary" in result
    # keypoints serialized to a multi-line string
    assert "pt1" in result["keypoints"]
    assert "pt2" in result["keypoints"]
    # sources serialized too
    assert "src1" in result["sources"]


@pytest.mark.asyncio
async def test_run_for_video_returns_empty_when_no_summary(monkeypatch):
    """If polling times out (no Summary or no full_digest), return empty dict."""
    from voice import analysis_runner

    async def fake_load(video_id, user_id):
        return None

    monkeypatch.setattr(analysis_runner, "_load_summary_with_full_digest", fake_load)

    result = await run_for_video("missing", 1)
    assert result == {}


@pytest.mark.asyncio
async def test_final_digest_for_video_returns_string(monkeypatch):
    fake_summary = MagicMock(
        id=42,
        full_digest={"summary": "résumé final 200 caractères max..."},
    )

    from voice import analysis_runner

    async def fake_load(video_id, user_id):
        return fake_summary

    monkeypatch.setattr(analysis_runner, "_load_summary_with_full_digest", fake_load)

    result = await final_digest_for_video("dQw4w9WgXcQ", 1)
    assert isinstance(result, str)
    assert len(result) > 0
    assert "résumé final" in result


@pytest.mark.asyncio
async def test_final_digest_returns_fallback_when_no_summary(monkeypatch):
    from voice import analysis_runner

    async def fake_load(video_id, user_id):
        return None

    monkeypatch.setattr(analysis_runner, "_load_summary_with_full_digest", fake_load)

    result = await final_digest_for_video("missing", 1)
    assert isinstance(result, str)
    # graceful fallback (test that it doesn't crash, exact wording flexible)


@pytest.mark.asyncio
async def test_load_summary_polling_returns_when_full_digest_ready(monkeypatch):
    """The internal polling helper waits up to 60s, polling every 2s.

    Verify it returns as soon as full_digest is populated (use short timeout for test)."""
    from voice import analysis_runner

    summary_pending = MagicMock(id=42, full_digest=None)
    summary_ready = MagicMock(id=42, full_digest={"summary": "ok"})

    call_count = [0]

    async def fake_query_summary(video_id, user_id, db):
        call_count[0] += 1
        if call_count[0] >= 3:
            return summary_ready
        return summary_pending

    # If your implementation uses a different internal helper name, adapt accordingly.
    # The test verifies the polling behavior at whatever level exposes it.
    monkeypatch.setattr(analysis_runner, "_query_summary", fake_query_summary)
    monkeypatch.setattr(analysis_runner, "_POLL_INTERVAL_SECS", 0.01)
    monkeypatch.setattr(analysis_runner, "_POLL_TIMEOUT_SECS", 1.0)

    # Use the public load helper, not run_for_video, to test polling directly
    result = await analysis_runner._load_summary_with_full_digest("vid", 1)
    assert result is summary_ready
    assert call_count[0] == 3
