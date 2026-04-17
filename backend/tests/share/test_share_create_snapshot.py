"""Unit tests for the share snapshot builder used by POST /api/share.

The snapshot shape stored in `SharedAnalysis.analysis_snapshot` must contain
every field the HTML renderer (`render_analysis_page`) and OG image generator
expect, so they can display a rich shared page without re-querying Summary.

These tests use a lightweight `_MockSummary` stand-in to keep them fast and
independent of the DB layer. The helper `_build_share_snapshot` must degrade
gracefully when optional columns are missing (returns None / [] / sane
defaults) so real Summary rows — which may have different column shapes over
time — don't break the share endpoint.
"""
import pytest

from share.router import _build_share_snapshot


class _MockSummary:
    """Stand-in for a Summary ORM row with the fields `_build_share_snapshot` reads."""

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_snapshot_contains_all_render_fields():
    s = _MockSummary(
        video_id="abc123",
        video_title="Test Title",
        video_thumbnail="https://ytimg/abc.jpg",
        platform="youtube",
        duration_seconds=754,
        channel="Test Channel",
        tags_json='["IA","Tech"]',
        verdict="Solide et bien sourcé",
        verdict_tone="positive",
        content="## Résumé\n\nBla",
        summary_short="Résumé court",
        sources_json='[{"url":"https://example.com","title":"Src 1","site":"example"}]',
    )
    snap = _build_share_snapshot(s)
    assert snap["video_id"] == "abc123"
    assert snap["video_title"] == "Test Title"
    assert snap["video_thumbnail"] == "https://ytimg/abc.jpg"
    assert snap["platform"] == "youtube"
    assert snap["duration_seconds"] == 754
    assert snap["channel"] == "Test Channel"
    assert snap["tags"] == ["IA", "Tech"]
    assert snap["verdict"]["text"] == "Solide et bien sourcé"
    assert snap["verdict"]["tone"] == "positive"
    assert snap["verdict"]["icon"] == "\u2705"
    assert snap["synthesis_markdown"] == "## Résumé\n\nBla"
    assert snap["summary_short"] == "Résumé court"
    assert snap["sources"] == [{"url": "https://example.com", "title": "Src 1", "site": "example"}]


def test_snapshot_handles_missing_optional_fields():
    s = _MockSummary(
        video_id="x",
        video_title="Only title",
        video_thumbnail=None,
        platform="youtube",
        duration_seconds=None,
        channel=None,
        tags_json=None,
        verdict=None,
        verdict_tone=None,
        content="",
        summary_short=None,
        sources_json=None,
    )
    snap = _build_share_snapshot(s)
    assert snap["video_id"] == "x"
    assert snap["tags"] == []
    assert snap["verdict"] is None
    assert snap["sources"] == []


def test_snapshot_verdict_icon_for_cautious_tone():
    s = _MockSummary(
        video_id="y", video_title="t", video_thumbnail=None, platform="youtube",
        duration_seconds=None, channel=None, tags_json=None,
        verdict="Prudent", verdict_tone="cautious",
        content="", summary_short=None, sources_json=None,
    )
    snap = _build_share_snapshot(s)
    assert snap["verdict"]["icon"] == "\u26a0\ufe0f"
    assert snap["verdict"]["tone"] == "cautious"


def test_snapshot_verdict_icon_for_critical_tone():
    s = _MockSummary(
        video_id="z", video_title="t", video_thumbnail=None, platform="youtube",
        duration_seconds=None, channel=None, tags_json=None,
        verdict="Problème", verdict_tone="critical",
        content="", summary_short=None, sources_json=None,
    )
    snap = _build_share_snapshot(s)
    assert snap["verdict"]["icon"] == "\u274c"
    assert snap["verdict"]["tone"] == "critical"
