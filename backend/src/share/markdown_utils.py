"""Markdown → sanitized HTML rendering for shared analysis pages.

Uses the existing `markdown` library (>=3.5 from requirements.txt). All
user-generated markdown is stripped of raw HTML (script, iframe, style) to
prevent XSS on public share pages. External links are decorated with
`target="_blank" rel="noopener noreferrer"` for safe navigation.
"""

from __future__ import annotations

import re
from typing import Optional

import markdown as md_lib


_EXTENSIONS = [
    "extra",       # tables, fenced code, footnotes
    "sane_lists",  # correct <ul>/<ol> semantics
    "smarty",      # smart quotes
    "nl2br",       # preserve line breaks
]

_UNSAFE_TAG_PATTERN = re.compile(
    r"<(script|iframe|object|embed|style|link|meta|form)[^>]*>.*?</\1>",
    re.IGNORECASE | re.DOTALL,
)
_UNSAFE_SELFCLOSE_PATTERN = re.compile(
    r"<(script|iframe|object|embed|style|link|meta|form)[^>]*/?\s*>",
    re.IGNORECASE,
)
_ON_ATTR_PATTERN = re.compile(r'\son[a-z]+\s*=\s*"[^"]*"', re.IGNORECASE)


def render_markdown_safe(content: Optional[str]) -> str:
    """Render markdown to sanitized HTML.

    - Strips <script>, <iframe>, <object>, <embed>, <style>, <link>, <meta>, <form>.
    - Strips onclick/onerror/onload/... attributes.
    - Decorates external links with target=_blank + rel=noopener.
    - Returns "" for None or empty input.
    """
    if not content:
        return ""

    html = md_lib.markdown(content, extensions=_EXTENSIONS, output_format="html5")

    html = _UNSAFE_TAG_PATTERN.sub("", html)
    html = _UNSAFE_SELFCLOSE_PATTERN.sub("", html)
    html = _ON_ATTR_PATTERN.sub("", html)

    html = re.sub(
        r'<a href="(https?://[^"]+)"([^>]*)>',
        r'<a href="\1"\2 target="_blank" rel="noopener noreferrer">',
        html,
    )

    return html
