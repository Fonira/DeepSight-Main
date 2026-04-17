import pytest
from share.html_renderer import render_analysis_page


def _base_snapshot():
    return {
        "video_id": "JBaBAg4ny6U",
        "video_title": "Test Video",
        "video_thumbnail": "https://i.ytimg.com/vi/JBaBAg4ny6U/maxresdefault.jpg",
        "channel": "Test Channel",
        "platform": "youtube",
        "duration_seconds": 754,
        "tags": ["IA", "Test"],
        "verdict": {
            "tone": "positive",
            "label": "Verdict",
            "icon": "[OK]",
            "text": "Solide et bien source.",
        },
        "synthesis_markdown": "## Resume\n\nContenu **markdown** ici.",
        "sources": [{"url": "https://example.com", "title": "Source 1"}],
    }


def test_renders_complete_analysis_page():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="abc123token",
        view_count=42,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "<!DOCTYPE html>" in html
    assert "Test Video" in html
    assert "Test Channel" in html
    assert 'href="https://www.youtube.com/watch?v=JBaBAg4ny6U"' in html
    assert "<strong>markdown</strong>" in html
    assert "Solide et bien source." in html


def test_renders_og_image_url_dynamic():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="tok999",
        view_count=1,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "/api/share/tok999/og-image.png" in html


def test_renders_canonical_url():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="canon1",
        view_count=0,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert 'rel="canonical"' in html
    assert "/s/canon1" in html


def test_cta_url_includes_video_id_and_utm():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="utmtok",
        view_count=0,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "/analyze?video_id=JBaBAg4ny6U" in html
    assert "utm_source=share" in html


def test_strips_script_tag_from_title():
    snap = _base_snapshot()
    snap["video_title"] = "Hack <script>alert(1)</script> Video"
    html = render_analysis_page(
        snapshot=snap,
        share_token="xss1",
        view_count=0,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    # Jinja auto-escapes HTML in title context
    assert "<script>alert(1)</script>" not in html


def test_missing_verdict_omits_verdict_block():
    snap = _base_snapshot()
    snap.pop("verdict")
    html = render_analysis_page(
        snapshot=snap,
        share_token="noverd",
        view_count=0,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "ds-verdict" not in html


def test_view_count_plural():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="pl1",
        view_count=42,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "42 vues" in html


def test_view_count_singular():
    html = render_analysis_page(
        snapshot=_base_snapshot(),
        share_token="sg1",
        view_count=1,
        created_at_iso="2026-04-17T18:00:00Z",
    )
    assert "1 vue" in html
