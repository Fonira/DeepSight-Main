"""Tests for `academic.aggregator` Phase 4 — Google Scholar deep crawl gating.

Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 3.3, § 6.2.

The aggregator is exercised end-to-end with the real `search()` method but
external sources (OpenAlex, CrossRef, arXiv, Scholar) are mocked. We assert
Phase 4 activation conditions, NOT the internal Scholar parsing logic
(covered by `test_scholar_search.py` / `test_scholar_parser.py` in PR 1).
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest


def _paper(title: str, source: str = "openalex"):
    """Build a minimal AcademicPaper for aggregator dedup/scoring."""
    from academic.schemas import AcademicPaper, AcademicSource

    return AcademicPaper(
        id=f"{source}_{abs(hash(title))}",
        title=title,
        source=AcademicSource(source),
        relevance_score=0.5,
    )


def _request(deep_search: bool):
    from academic.schemas import AcademicSearchRequest

    return AcademicSearchRequest(keywords=["test"], deep_search=deep_search)


def _setup_aggregator(monkeypatch, *, phase1_papers, scholar_papers):
    """Patch the aggregator's source clients + Scholar search.

    `phase1_papers` is yielded by OpenAlex (others return []), so we control
    how many papers Phase 1-3 produce. `scholar_papers` is what `search_scholar`
    returns (a `ScholarBatch`-shaped object with `.papers`).
    """
    from academic import aggregator as agg_mod
    from academic.aggregator import AcademicAggregator

    aggregator = AcademicAggregator()

    async def _phase1_oa(query, request):
        return phase1_papers

    async def _empty(query, request):
        return []

    monkeypatch.setattr(aggregator, "_search_openalex", _phase1_oa)
    monkeypatch.setattr(aggregator, "_search_crossref", _empty)
    monkeypatch.setattr(aggregator, "_search_semantic_scholar", _empty)
    monkeypatch.setattr(aggregator, "_search_arxiv", _empty)

    # Mock the scholar module's `search_scholar` (imported inside _search_scholar).
    class FakeBatch:
        def __init__(self, papers):
            self.papers = papers

    async def fake_search_scholar(query, limit=20):
        return FakeBatch(scholar_papers)

    def fake_to_academic(sp):
        return sp  # already an AcademicPaper for these tests

    import academic.scholar as scholar_mod

    monkeypatch.setattr(scholar_mod, "search_scholar", fake_search_scholar)
    monkeypatch.setattr(scholar_mod, "scholar_paper_to_academic", fake_to_academic)

    return aggregator


@pytest.mark.asyncio
async def test_phase4_triggered_when_pro_and_deep_search_and_few_papers(monkeypatch):
    """deep_search=True + Pro + <10 papers → Scholar called, "scholar" in sources_queried."""
    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper("p1"), _paper("p2")],
        scholar_papers=[_paper("scholar-1", source="scholar")],
    )

    response = await aggregator.search(_request(deep_search=True), user_plan="pro")

    assert "scholar" in response.sources_queried
    assert any(p.title == "scholar-1" for p in response.papers)


@pytest.mark.asyncio
async def test_phase4_skipped_when_deep_search_false(monkeypatch):
    """deep_search=False (default) → Phase 4 never runs."""
    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper("p1"), _paper("p2")],
        scholar_papers=[_paper("scholar-1", source="scholar")],
    )

    response = await aggregator.search(_request(deep_search=False), user_plan="pro")

    assert "scholar" not in response.sources_queried
    assert not any(p.title == "scholar-1" for p in response.papers)


@pytest.mark.asyncio
async def test_phase4_skipped_for_free_plan(monkeypatch):
    """Free plan even with deep_search=True → Phase 4 skipped (defense in depth;
    router 403s first, but aggregator must also guard)."""
    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper("p1")],
        scholar_papers=[_paper("scholar-1", source="scholar")],
    )

    response = await aggregator.search(_request(deep_search=True), user_plan="free")

    assert "scholar" not in response.sources_queried


@pytest.mark.asyncio
async def test_phase4_skipped_when_threshold_exceeded(monkeypatch):
    """≥10 papers from Phase 1-3 → Phase 4 skipped (Decodo savings)."""
    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper(f"p{i}") for i in range(12)],
        scholar_papers=[_paper("scholar-1", source="scholar")],
    )

    response = await aggregator.search(_request(deep_search=True), user_plan="pro")

    assert "scholar" not in response.sources_queried


@pytest.mark.asyncio
async def test_phase4_kill_switch_via_env(monkeypatch):
    """SCHOLAR_ENABLED=False → Phase 4 globally disabled even on Pro+."""
    monkeypatch.setattr("core.config.SCHOLAR_ENABLED", False)

    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper("p1")],
        scholar_papers=[_paper("scholar-1", source="scholar")],
    )

    response = await aggregator.search(_request(deep_search=True), user_plan="expert")

    assert "scholar" not in response.sources_queried


@pytest.mark.asyncio
async def test_phase4_graceful_on_scholar_exception(monkeypatch):
    """If `search_scholar` raises, aggregator returns the 4-source results
    without `scholar` in `sources_queried`."""
    aggregator = _setup_aggregator(
        monkeypatch,
        phase1_papers=[_paper("p1")],
        scholar_papers=[],  # default override below
    )

    async def boom(query, limit=20):
        raise RuntimeError("scholar exploded")

    import academic.scholar as scholar_mod

    monkeypatch.setattr(scholar_mod, "search_scholar", boom)

    response = await aggregator.search(_request(deep_search=True), user_plan="pro")

    assert response.total_found >= 1
    assert "scholar" not in response.sources_queried
