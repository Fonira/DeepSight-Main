"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧪 TESTS — Scholar HTML parser (PR1 / spec §11.1)                                ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Couvre :                                                                          ║
║  • Parsing SERP normale (20 résultats)                                            ║
║  • Parsing SERP livres / chapitres (prefix [BOOK] / [B])                          ║
║  • Parsing SERP vide                                                              ║
║  • Parsing HTML malformé (résilience)                                             ║
║  • Extraction année (regex)                                                       ║
║  • Extraction citation count (EN "Cited by 42" + FR "Cité 13 fois")               ║
║  • Détection pdf_url presence / absence                                           ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import os
import sys

import pytest

# Add backend/src to path so we can import the package without installation.
_HERE = os.path.dirname(os.path.abspath(__file__))
_SRC = os.path.abspath(os.path.join(_HERE, "..", "src"))
if _SRC not in sys.path:
    sys.path.insert(0, _SRC)

from academic.scholar import parse_scholar_html, ScholarPaper  # noqa: E402


FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "scholar")


def _read_fixture(name: str) -> str:
    path = os.path.join(FIXTURES_DIR, name)
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# ─────────────────────────────────────────────────────────────────────────────
# Parser tests on SERP fixtures
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_normal_serp():
    """SERP normale → 20 résultats avec champs essentiels."""
    html = _read_fixture("serp_normal.html")
    papers = parse_scholar_html(html)

    assert len(papers) == 20
    assert all(isinstance(p, ScholarPaper) for p in papers)

    # First paper sanity-check.
    first = papers[0]
    assert first.scholar_id == "0000000000000001"
    assert first.title == "Quantum Computing: Foundations and Algorithms"
    assert first.year == 2023
    assert first.venue == "Nature Physics"
    assert first.citation_count == 1247
    assert first.url == "https://example.com/quantum1.pdf"
    assert first.pdf_url == "https://example.com/quantum1.pdf"
    assert first.authors and "Smith" in first.authors[0]

    # Verify all 20 have a non-empty title.
    assert all(p.title for p in papers)
    # Verify all 20 have a scholar_id from data-cid.
    assert all(p.scholar_id for p in papers)


def test_parse_books_serp():
    """SERP livres → titres correctement strippés des prefixes [BOOK] / [B] / [CITATION]."""
    html = _read_fixture("serp_books.html")
    papers = parse_scholar_html(html)

    assert len(papers) == 15
    titles = [p.title for p in papers]

    # The [BOOK] prefix must be stripped from the title.
    assert "Histoire de la folie à l'âge classique" in titles
    # The [B] prefix must be stripped too.
    assert "Histoire de la psychiatrie en France" in titles
    # The [CITATION] prefix must be stripped.
    assert "Réflexions sur l'hôpital général" in titles

    # No remaining literal bracket prefix in any title.
    for t in titles:
        assert not t.startswith("[BOOK]"), f"title still has [BOOK] prefix: {t!r}"
        assert not t.startswith("[B]"), f"title still has [B] prefix: {t!r}"
        assert not t.startswith("[CITATION]"), f"title still has [CITATION] prefix: {t!r}"

    # Specific Foucault entry: year 1972, venue Gallimard, FR citation 8421.
    foucault = next(p for p in papers if p.title == "Histoire de la folie à l'âge classique")
    assert foucault.year == 1972
    assert foucault.venue == "Gallimard"
    assert foucault.citation_count == 8421


def test_parse_empty_serp():
    """SERP vide → 0 résultat, pas d'exception."""
    html = _read_fixture("serp_empty.html")
    papers = parse_scholar_html(html)
    assert papers == []


def test_parse_malformed_html():
    """HTML cassé / non-Scholar → 0 résultat, pas de crash."""
    cases = [
        "",
        "not html at all",
        "<html><body>random content</body></html>",
        "<div class='gs_r'>incomplete div without h3",
        "<div class='gs_r' data-cid='abc'><h3 class='gs_rt'></h3></div>",  # h3 sans <a>
        "<div class='gs_r' data-cid='abc'><h3 class='gs_rt'><a href='#'></a></h3></div>",  # <a> vide
    ]
    for html in cases:
        papers = parse_scholar_html(html)
        assert papers == [], f"expected empty list for {html!r}, got {papers!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Year extraction (5 cas)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "gs_a_text, expected_year",
    [
        # Simple modern year.
        ("AB Smith - Nature, 2023 - nature.com", 2023),
        # Historical 1972.
        ("M Foucault - 1972 - Gallimard", 1972),
        # 19xx range.
        ("J Lacan - 1955 - Séminaire III", 1955),
        # Multiple years in text — must pick the LAST one (publication year).
        ("Author - First paper 2010 cited heavily, republished 2020 - Journal", 2020),
        # No year at all.
        ("Author Name - Journal Name - publisher.com", None),
    ],
)
def test_parse_year_extraction(gs_a_text: str, expected_year):
    """Year extraction via regex \\b(19\\d{2}|20\\d{2})\\b — last match wins."""
    html = (
        f'<div class="gs_r" data-cid="x">'
        f'  <h3 class="gs_rt"><a href="/x">Title</a></h3>'
        f'  <div class="gs_a">{gs_a_text}</div>'
        f"</div>"
    )
    papers = parse_scholar_html(html)
    assert len(papers) == 1
    assert papers[0].year == expected_year, f"text={gs_a_text!r}"


# ─────────────────────────────────────────────────────────────────────────────
# Citation count extraction (EN + FR)
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_citation_count_english():
    """EN format: 'Cited by 42'."""
    html = (
        '<div class="gs_r" data-cid="x">'
        '  <h3 class="gs_rt"><a href="/x">Title</a></h3>'
        '  <div class="gs_fl">'
        '    <a href="/scholar?cluster=x">Cited by 42</a>'
        '    <a href="/related">Related articles</a>'
        '  </div>'
        '</div>'
    )
    papers = parse_scholar_html(html)
    assert len(papers) == 1
    assert papers[0].citation_count == 42


def test_parse_citation_count_french():
    """FR format: 'Cité 13 fois' (accepts e and é, with or without accent)."""
    cases = [
        ("Cité 13 fois", 13),
        ("Cite 7 fois", 7),  # without accent
        ("Cité 8421 fois", 8421),
    ]
    for fr_text, expected in cases:
        html = (
            '<div class="gs_r" data-cid="x">'
            '  <h3 class="gs_rt"><a href="/x">Title</a></h3>'
            '  <div class="gs_fl">'
            f'    <a href="/scholar?cluster=x">{fr_text}</a>'
            '  </div>'
            '</div>'
        )
        papers = parse_scholar_html(html)
        assert len(papers) == 1
        assert papers[0].citation_count == expected, f"FR text={fr_text!r}"


# ─────────────────────────────────────────────────────────────────────────────
# pdf_url extraction
# ─────────────────────────────────────────────────────────────────────────────


def test_parse_pdf_url_present():
    """PDF link via div.gs_or_ggsm > a with [PDF] tag present."""
    html = (
        '<div class="gs_r" data-cid="x">'
        '  <h3 class="gs_rt"><a href="/landing">Some Paper</a></h3>'
        '  <div class="gs_or_ggsm">'
        '    <a href="https://example.com/paper.pdf"><span class="gs_ctg2">[PDF]</span> example.com</a>'
        '  </div>'
        '</div>'
    )
    papers = parse_scholar_html(html)
    assert len(papers) == 1
    assert papers[0].pdf_url == "https://example.com/paper.pdf"


def test_parse_pdf_url_absent():
    """No gs_or_ggsm → pdf_url None."""
    html = (
        '<div class="gs_r" data-cid="x">'
        '  <h3 class="gs_rt"><a href="/landing">Paper without PDF link</a></h3>'
        '  <div class="gs_a">Author - Journal, 2020</div>'
        '</div>'
    )
    papers = parse_scholar_html(html)
    assert len(papers) == 1
    assert papers[0].pdf_url is None
