import pytest
from share.markdown_utils import render_markdown_safe


def test_renders_basic_paragraph():
    html = render_markdown_safe("Hello **world**")
    assert "<p>" in html
    assert "<strong>world</strong>" in html


def test_renders_bullet_list():
    md = "- First\n- Second\n- Third"
    html = render_markdown_safe(md)
    assert "<ul>" in html
    assert html.count("<li>") == 3


def test_renders_headings():
    html = render_markdown_safe("## Verdict\n\nContent")
    assert "<h2>" in html
    assert "Verdict" in html


def test_strips_raw_html_script_tags():
    html = render_markdown_safe("<script>alert('xss')</script>Legit")
    assert "<script>" not in html
    assert "Legit" in html


def test_strips_iframe_tags():
    html = render_markdown_safe("<iframe src='evil.com'></iframe>Safe")
    assert "<iframe" not in html
    assert "Safe" in html


def test_preserves_safe_inline_code():
    html = render_markdown_safe("Use `variable_name` in code")
    assert "<code>variable_name</code>" in html


def test_empty_input_returns_empty_string():
    assert render_markdown_safe("") == ""
    assert render_markdown_safe(None) == ""


def test_external_links_get_target_blank():
    html = render_markdown_safe("[Source](https://example.com)")
    assert 'target="_blank"' in html
    assert 'rel="noopener noreferrer"' in html
