"""Tests for voice.transcript_fetcher — adapter that fetches transcripts and chunks for the StreamingOrchestrator."""
import pytest
from voice.transcript_fetcher import fetch_for_video_url


@pytest.mark.asyncio
async def test_youtube_url_chunks_at_3000_chars(monkeypatch):
    """YouTube transcripts are split into chunks ~3000 chars at word boundaries."""
    from voice import transcript_fetcher

    fake_transcript = " ".join(["mot"] * 5000)  # ~20000 chars

    async def fake_youtube_fetch(video_id: str) -> str:
        assert video_id == "dQw4w9WgXcQ"
        return fake_transcript

    monkeypatch.setattr(
        transcript_fetcher,
        "_fetch_youtube",
        fake_youtube_fetch,
    )

    chunks = []
    async for chunk in fetch_for_video_url("https://youtu.be/dQw4w9WgXcQ"):
        chunks.append(chunk)

    assert 5 <= len(chunks) <= 10  # 20000 / 3000 ≈ 7
    assert chunks[0]["index"] == 0
    assert chunks[-1]["index"] == len(chunks) - 1
    assert all(c["total"] == len(chunks) for c in chunks)
    assert all(len(c["text"]) <= 3500 for c in chunks)


@pytest.mark.asyncio
async def test_tiktok_url_dispatches_to_tiktok_fetcher(monkeypatch):
    from voice import transcript_fetcher

    captured_video_id = []

    async def fake_tiktok_fetch(video_id: str) -> str:
        captured_video_id.append(video_id)
        return "Court transcript TikTok"

    monkeypatch.setattr(
        transcript_fetcher,
        "_fetch_tiktok",
        fake_tiktok_fetch,
    )

    chunks = []
    async for chunk in fetch_for_video_url(
        "https://www.tiktok.com/@user/video/7123456789012345678"
    ):
        chunks.append(chunk)

    assert captured_video_id == ["7123456789012345678"]
    assert len(chunks) == 1
    assert chunks[0]["text"] == "Court transcript TikTok"


@pytest.mark.asyncio
async def test_invalid_url_raises_value_error():
    with pytest.raises(ValueError, match="non supportée"):
        async for _ in fetch_for_video_url("https://vimeo.com/123"):
            pass


@pytest.mark.asyncio
async def test_empty_transcript_yields_nothing(monkeypatch):
    from voice import transcript_fetcher

    async def fake_empty(video_id: str) -> str:
        return ""

    monkeypatch.setattr(transcript_fetcher, "_fetch_youtube", fake_empty)

    chunks = []
    async for c in fetch_for_video_url("https://youtu.be/dQw4w9WgXcQ"):
        chunks.append(c)
    assert chunks == []
