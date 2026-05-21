"""Tests for tiktok_engagement_score helper.

Verifies that the scoring function gives sensible relative ordering:
- High views + high engagement → higher score than high views alone
- Recent content gets a small freshness bonus
- Empty/zero-view candidates score 0
"""

from datetime import datetime, timedelta

from videos.intelligent_discovery import VideoCandidate, tiktok_engagement_score


def _make(
    *,
    views: int = 0,
    likes: int = 0,
    comments: int = 0,
    shares: int = 0,
    age_days: int = 30,
    now: datetime | None = None,
) -> VideoCandidate:
    now = now or datetime(2026, 5, 21, 12, 0, 0)
    return VideoCandidate(
        video_id="x",
        title="x",
        channel="x",
        description="x",
        thumbnail_url="x",
        duration=30,
        view_count=views,
        like_count=likes,
        comment_count=comments,
        share_count=shares,
        published_at=now - timedelta(days=age_days),
    )


def test_zero_views_returns_zero():
    assert tiktok_engagement_score(_make()) == 0.0


def test_engagement_beats_pure_views():
    now = datetime(2026, 5, 21, 12, 0, 0)
    # Vidéo très virale, peu d'interaction (clickbait)
    viral_dull = _make(views=10_000_000, likes=100, comments=10, shares=5, age_days=60, now=now)
    # Vidéo moins virale mais engagement profond
    moderate_engaged = _make(
        views=500_000, likes=80_000, comments=4_000, shares=2_000, age_days=10, now=now
    )
    assert tiktok_engagement_score(moderate_engaged, now=now) > tiktok_engagement_score(
        viral_dull, now=now
    )


def test_freshness_breaks_tie():
    now = datetime(2026, 5, 21, 12, 0, 0)
    stats = dict(views=100_000, likes=10_000, comments=500, shares=200)
    fresh = _make(**stats, age_days=3, now=now)
    stale = _make(**stats, age_days=120, now=now)
    assert tiktok_engagement_score(fresh, now=now) > tiktok_engagement_score(stale, now=now)


def test_score_bounded_zero_one():
    now = datetime(2026, 5, 21, 12, 0, 0)
    extreme = _make(
        views=1_000_000_000,
        likes=500_000_000,
        comments=100_000_000,
        shares=50_000_000,
        age_days=0,
        now=now,
    )
    score = tiktok_engagement_score(extreme, now=now)
    assert 0.0 <= score <= 1.0


def test_views_only_still_scores():
    """Une vidéo avec uniquement des vues (engagement non capturé) doit quand même scorer > 0."""
    now = datetime(2026, 5, 21, 12, 0, 0)
    c = _make(views=10_000, age_days=2, now=now)
    assert tiktok_engagement_score(c, now=now) > 0.0
