"""
Slug utilities for aggregator pages.

Channels are stored in DB as their human-readable name (e.g. "Lex Fridman",
"HugoDécrypte"), but URLs need lowercase ASCII slugs. We compute slugs on
the fly (no DB column) and resolve them back via case-insensitive search.
"""

from __future__ import annotations

import re
import unicodedata


_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def to_slug(name: str) -> str:
    """Convert a channel name or category to a URL-safe slug.

    "Lex Fridman" → "lex-fridman"
    "HugoDécrypte" → "hugodecrypte"
    "Science & Vie" → "science-vie"
    """
    if not name:
        return ""
    nfd = unicodedata.normalize("NFD", name)
    ascii_only = nfd.encode("ascii", "ignore").decode("ascii")
    lowered = ascii_only.lower().strip()
    slug = _NON_ALNUM.sub("-", lowered).strip("-")
    return slug
