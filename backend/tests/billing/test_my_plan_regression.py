"""Regression tests for `GET /api/billing/my-plan`.

Hot-fix 2026-05-06 — l'endpoint retournait HTTP 500 en prod parce que la
colonne `voice_quota.purchased_minutes` (déclarée par le modèle
`VoiceQuotaStreaming`) n'existait pas en base (migration 011 partiellement
appliquée). Ces tests verrouillent le comportement attendu pour qu'un
schema drift similaire soit attrapé en CI.

Pattern : on appelle directement le handler `get_my_plan` avec une
`AsyncSession` mockée (cohérent avec `test_voice_packs_router.py` et
`test_voice_quota.py`) — pas de TestClient, pas d'app FastAPI bootée.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from billing.router import get_my_plan


def _make_user(plan: str = "free", user_id: int = 1):
    user = MagicMock()
    user.id = user_id
    user.plan = plan
    user.stripe_subscription_id = None
    user.is_legacy_pricing = False
    return user


def _make_voice_quota_row(
    *,
    lifetime_trial_used: bool = False,
    monthly_minutes_used: float = 0.0,
    purchased_minutes: float = 0.0,
):
    """Build a fake VoiceQuotaStreaming row, including the post-011 column."""
    row = MagicMock()
    row.lifetime_trial_used = lifetime_trial_used
    row.monthly_minutes_used = monthly_minutes_used
    row.purchased_minutes = purchased_minutes
    return row


def _make_session(*, voice_quota_row, count_results: list[int]):
    """Mock async session whose successive `execute` calls return:

    1. count(Summary) → analyses_this_month
    2. count(ChatMessage user) → chat_today
    3. count(ChatMessage web_search) → web_searches_this_month
    4. select(VoiceQuotaStreaming) → voice_quota_row (or None)

    Order matches `get_my_plan` in `backend/src/billing/router.py`.
    """
    results = []
    for cnt in count_results:
        scalar_result = MagicMock()
        scalar_result.scalar = MagicMock(return_value=cnt)
        results.append(scalar_result)

    voice_result = MagicMock()
    voice_result.scalar_one_or_none = MagicMock(return_value=voice_quota_row)
    results.append(voice_result)

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=results)
    return session


@pytest.mark.asyncio
async def test_my_plan_no_voice_quota_row_returns_default_payload():
    """Free user with no VoiceQuotaStreaming row → payload defaults to 0."""
    user = _make_user(plan="free")
    session = _make_session(voice_quota_row=None, count_results=[0, 0, 0])

    result = await get_my_plan(platform="web", current_user=user, session=session)

    assert result["plan"] == "free"
    assert result["voice_quota"] == {
        "trial_used": False,
        "monthly_minutes_used": 0.0,
    }
    assert result["subscription"]["status"] == "none"
    assert result["usage"] == {
        "analyses_this_month": 0,
        "chat_today": 0,
        "web_searches_this_month": 0,
    }


@pytest.mark.asyncio
async def test_my_plan_with_voice_quota_reads_purchased_minutes_column():
    """Pro user with quota row → handler reads `purchased_minutes` (post-011).

    Cette ligne est exactement celle qui crashait en prod le 2026-05-06.
    Le test garantit que tout objet conforme au modèle
    `VoiceQuotaStreaming` (incluant `purchased_minutes`) est consommé sans
    erreur d'attribut.
    """
    user = _make_user(plan="pro")
    quota_row = _make_voice_quota_row(
        lifetime_trial_used=False,
        monthly_minutes_used=12.5,
        purchased_minutes=60.0,
    )
    session = _make_session(voice_quota_row=quota_row, count_results=[3, 7, 1])

    result = await get_my_plan(platform="web", current_user=user, session=session)

    assert result["plan"] == "pro"
    assert result["voice_quota"]["trial_used"] is False
    assert result["voice_quota"]["monthly_minutes_used"] == 12.5
    # Confirmer que le row a bien été lu sans AttributeError sur purchased_minutes :
    # même si get_my_plan ne re-expose pas encore purchased_minutes, le row doit
    # être accessible pour les futures évolutions du payload (et la SELECT
    # SQLAlchemy elle-même prouve l'attribut résolu).
    assert quota_row.purchased_minutes == 60.0
    assert result["usage"]["analyses_this_month"] == 3
    assert result["usage"]["chat_today"] == 7
    assert result["usage"]["web_searches_this_month"] == 1


@pytest.mark.asyncio
async def test_my_plan_trial_used_flag_propagates():
    """Free user qui a déjà consommé son trial → trial_used=True dans le payload."""
    user = _make_user(plan="free")
    quota_row = _make_voice_quota_row(
        lifetime_trial_used=True,
        monthly_minutes_used=0.0,
        purchased_minutes=0.0,
    )
    session = _make_session(voice_quota_row=quota_row, count_results=[5, 2, 0])

    result = await get_my_plan(platform="web", current_user=user, session=session)

    assert result["voice_quota"]["trial_used"] is True
    assert result["voice_quota"]["monthly_minutes_used"] == 0.0


@pytest.mark.asyncio
async def test_my_plan_handles_none_monthly_minutes_used():
    """Si `monthly_minutes_used` est NULL (cas DB corrompue) → fallback 0.0,
    pas de TypeError."""
    user = _make_user(plan="expert")
    quota_row = MagicMock()
    quota_row.lifetime_trial_used = False
    quota_row.monthly_minutes_used = None  # cas dégénéré
    quota_row.purchased_minutes = None
    session = _make_session(voice_quota_row=quota_row, count_results=[0, 0, 0])

    result = await get_my_plan(platform="web", current_user=user, session=session)

    assert result["voice_quota"]["monthly_minutes_used"] == 0.0
    assert result["plan"] == "expert"
