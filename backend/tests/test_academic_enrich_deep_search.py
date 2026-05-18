"""Tests for `/api/academic/enrich/{summary_id}` Scholar deep_search gating (PR3a).

Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 6.3, § 13.1.

Mirror de `test_academic_router_with_scholar.py` mais sur le endpoint /enrich
qui était jusqu'ici limité à AcademicEnrichRequest sans deep_search. PR3a
étend le request body + applique la même règle plan/quota qu'à /search.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException


def _user(plan: str, user_id: int = 1):
    return SimpleNamespace(id=user_id, plan=plan, is_verified=True)


def _enrich_request(deep_search: bool = False, max_papers: int = None):
    from academic.schemas import AcademicEnrichRequest

    return AcademicEnrichRequest(
        summary_id="42",
        max_papers=max_papers,
        deep_search=deep_search,
    )


@pytest.fixture
def patched_enrich(monkeypatch):
    """Mock summary fetch + keyword extraction + aggregator + scholar_quota.

    Pattern: monkeypatch via dotted-paths dans le MÊME ORDRE que le sister test
    `test_academic_router_with_scholar.py` (core.scholar_quota d'abord, puis
    academic.router.*) pour éviter le circular auth ↔ billing exposé en
    isolation.
    """
    state = {
        "quota_call_count": 0,
        "aggregator_calls": [],
        "quota_allowed": True,
        "quota_payload": None,
    }

    # 1) Mock quota check (chargé en premier — pattern sister test)
    async def fake_check_and_increment(session, user):
        state["quota_call_count"] += 1
        return state["quota_allowed"], state["quota_payload"]

    monkeypatch.setattr(
        "core.scholar_quota.check_and_increment_scholar_quota",
        fake_check_and_increment,
    )

    # 2) Mock aggregator (idem)
    async def fake_search(request, user_plan, video_title=None):
        from academic.schemas import AcademicSearchResponse

        state["aggregator_calls"].append((user_plan, request.deep_search))
        return AcademicSearchResponse(
            papers=[],
            total_found=0,
            query_keywords=request.keywords,
            sources_queried=["openalex"],
        )

    monkeypatch.setattr("academic.router.academic_aggregator.search", fake_search)

    # 3) Mock summary fetch + keyword extraction + cache (helpers enrich-only)
    fake_summary = SimpleNamespace(
        id=42, user_id=1, video_title="Test video", concepts=None
    )

    class FakeResult:
        def scalar_one_or_none(self):
            return fake_summary

    fake_session = AsyncMock()
    fake_session.execute = AsyncMock(return_value=FakeResult())

    async def fake_extract_keywords(summary):
        return ["epistemology", "test"]

    async def fake_translate(keywords):
        return keywords  # passthrough

    async def fake_cache_papers(session, summary_id, papers):
        return None

    monkeypatch.setattr(
        "academic.router._extract_keywords_from_summary", fake_extract_keywords
    )
    monkeypatch.setattr(
        "academic.router._translate_keywords_to_english", fake_translate
    )
    monkeypatch.setattr("academic.router._cache_papers", fake_cache_papers)

    state["session"] = fake_session
    return state


@pytest.mark.asyncio
async def test_enrich_free_plan_with_deep_search_returns_403(patched_enrich):
    """/enrich + deep_search=True + free user → 403 plan_required."""
    from academic.router import enrich_summary_with_academic_sources

    with pytest.raises(HTTPException) as exc:
        await enrich_summary_with_academic_sources(
            summary_id=42,
            request=_enrich_request(deep_search=True),
            current_user=_user("free"),
            session=patched_enrich["session"],
        )

    assert exc.value.status_code == 403
    detail = exc.value.detail
    assert detail["code"] == "plan_required"
    assert detail["required_plan"] == "pro"
    assert detail["feature"] == "scholar_deep_search"
    assert patched_enrich["quota_call_count"] == 0
    assert patched_enrich["aggregator_calls"] == []


@pytest.mark.asyncio
async def test_enrich_pro_no_deep_search_skips_quota(patched_enrich):
    """/enrich + deep_search omitted (default False) → no quota call, aggregator OK."""
    from academic.router import enrich_summary_with_academic_sources

    response = await enrich_summary_with_academic_sources(
        summary_id=42,
        request=_enrich_request(deep_search=False),
        current_user=_user("pro"),
        session=patched_enrich["session"],
    )

    assert response.total_found == 0
    assert patched_enrich["quota_call_count"] == 0
    assert patched_enrich["aggregator_calls"] == [("pro", False)]


@pytest.mark.asyncio
async def test_enrich_pro_deep_search_increments_quota_and_passes_flag(patched_enrich):
    """/enrich + deep_search=True + pro under quota → quota OK + aggregator(deep_search=True)."""
    from academic.router import enrich_summary_with_academic_sources

    patched_enrich["quota_allowed"] = True

    response = await enrich_summary_with_academic_sources(
        summary_id=42,
        request=_enrich_request(deep_search=True),
        current_user=_user("pro"),
        session=patched_enrich["session"],
    )

    assert response.total_found == 0
    assert patched_enrich["quota_call_count"] == 1
    assert patched_enrich["aggregator_calls"] == [("pro", True)]


@pytest.mark.asyncio
async def test_enrich_pro_deep_search_at_quota_returns_429(patched_enrich):
    """/enrich + deep_search=True + quota reached → 429 scholar_daily_limit_reached."""
    from academic.router import enrich_summary_with_academic_sources

    patched_enrich["quota_allowed"] = False
    patched_enrich["quota_payload"] = {
        "code": "scholar_daily_limit_reached",
        "message": "Scholar daily quota reached (5/5).",
        "current_usage": 5,
        "daily_limit": 5,
    }

    with pytest.raises(HTTPException) as exc:
        await enrich_summary_with_academic_sources(
            summary_id=42,
            request=_enrich_request(deep_search=True),
            current_user=_user("pro"),
            session=patched_enrich["session"],
        )

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "scholar_daily_limit_reached"


@pytest.mark.asyncio
async def test_enrich_expert_deep_search_allowed(patched_enrich):
    """/enrich + deep_search=True + expert → aggregator(expert, deep_search=True)."""
    from academic.router import enrich_summary_with_academic_sources

    response = await enrich_summary_with_academic_sources(
        summary_id=42,
        request=_enrich_request(deep_search=True),
        current_user=_user("expert"),
        session=patched_enrich["session"],
    )

    assert response.total_found == 0
    assert patched_enrich["aggregator_calls"] == [("expert", True)]


@pytest.mark.asyncio
async def test_enrich_request_default_deep_search_false():
    """Default `AcademicEnrichRequest(summary_id=...)` has deep_search=False (backward compat)."""
    from academic.schemas import AcademicEnrichRequest

    req = AcademicEnrichRequest(summary_id="42")
    assert req.deep_search is False
