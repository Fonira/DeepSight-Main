"""Tests for `/api/academic/search` Scholar deep_search gating (PR2 wiring).

Spec : docs/superpowers/specs/2026-05-17-google-scholar-deep-crawl.md § 6.3.

Direct-invocation tests : we call the route handler `search_academic_papers`
as a plain async function, with FastAPI Depends() resolved manually via
SimpleNamespace stand-ins. This sidesteps full TestClient bootstrap and lets
us assert HTTPException codes precisely.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException


def _user(plan: str, user_id: int = 1):
    return SimpleNamespace(id=user_id, plan=plan, is_verified=True)


def _request(deep_search: bool = False):
    from academic.schemas import AcademicSearchRequest

    return AcademicSearchRequest(keywords=["test query"], deep_search=deep_search)


@pytest.fixture
def patched_router(monkeypatch):
    """Mock the aggregator + scholar_quota module that the router imports lazily."""
    state = {
        "quota_call_count": 0,
        "aggregator_calls": [],
        "quota_allowed": True,
        "quota_payload": None,
    }

    async def fake_check_and_increment(session, user):
        state["quota_call_count"] += 1
        return state["quota_allowed"], state["quota_payload"]

    monkeypatch.setattr(
        "core.scholar_quota.check_and_increment_scholar_quota",
        fake_check_and_increment,
    )

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
    return state


@pytest.mark.asyncio
async def test_free_plan_deep_search_returns_403(patched_router):
    """Free plan + deep_search=True → 403 plan_required."""
    from academic.router import search_academic_papers

    with pytest.raises(HTTPException) as exc:
        await search_academic_papers(
            request=_request(deep_search=True),
            current_user=_user("free"),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 403
    detail = exc.value.detail
    assert detail["code"] == "plan_required"
    assert detail["required_plan"] == "pro"
    assert patched_router["quota_call_count"] == 0  # quota never consulted


@pytest.mark.asyncio
async def test_pro_no_deep_search_skips_quota(patched_router):
    """Pro + deep_search=False (default) → no quota call, no 403/429."""
    from academic.router import search_academic_papers

    response = await search_academic_papers(
        request=_request(deep_search=False),
        current_user=_user("pro"),
        session=AsyncMock(),
    )

    assert response.total_found == 0
    assert patched_router["quota_call_count"] == 0
    assert patched_router["aggregator_calls"] == [("pro", False)]


@pytest.mark.asyncio
async def test_pro_deep_search_allowed_calls_aggregator(patched_router):
    """Pro + deep_search=True + under quota → quota incremented, aggregator called with deep_search."""
    from academic.router import search_academic_papers

    patched_router["quota_allowed"] = True

    response = await search_academic_papers(
        request=_request(deep_search=True),
        current_user=_user("pro"),
        session=AsyncMock(),
    )

    assert response.total_found == 0
    assert patched_router["quota_call_count"] == 1
    assert patched_router["aggregator_calls"] == [("pro", True)]


@pytest.mark.asyncio
async def test_pro_deep_search_at_quota_returns_429(patched_router):
    """Pro + deep_search=True + quota reached → 429 scholar_daily_limit_reached."""
    from academic.router import search_academic_papers

    patched_router["quota_allowed"] = False
    patched_router["quota_payload"] = {
        "code": "scholar_daily_limit_reached",
        "message": "Scholar daily quota reached (5/5).",
        "current_usage": 5,
        "daily_limit": 5,
    }

    with pytest.raises(HTTPException) as exc:
        await search_academic_papers(
            request=_request(deep_search=True),
            current_user=_user("pro"),
            session=AsyncMock(),
        )

    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "scholar_daily_limit_reached"
    assert exc.value.detail["daily_limit"] == 5


@pytest.mark.asyncio
async def test_expert_deep_search_allowed(patched_router):
    """Expert + deep_search=True under 30/day → allowed."""
    from academic.router import search_academic_papers

    response = await search_academic_papers(
        request=_request(deep_search=True),
        current_user=_user("expert"),
        session=AsyncMock(),
    )

    assert response.total_found == 0
    assert patched_router["aggregator_calls"] == [("expert", True)]


@pytest.mark.asyncio
async def test_deep_search_default_is_false_backwards_compat():
    """Default `AcademicSearchRequest()` has deep_search=False (no API breakage)."""
    from academic.schemas import AcademicSearchRequest

    req = AcademicSearchRequest(keywords=["x"])
    assert req.deep_search is False
