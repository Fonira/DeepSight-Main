"""
Study review router — FSRS spaced-repetition endpoints.
/api/study/review/*
"""

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    get_session,
    User,
    Summary,
    FlashcardReview,
    StudySession,
)
from auth.dependencies import get_current_user
from study.fsrs import FSRSCard, schedule_card, Rating, State, calculate_xp
from study.schemas import (
    ReviewRequest,
    ReviewResponse,
    DueCardsResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionEndRequest,
    SessionEndResponse,
    StudyStatsResponse,
)
from gamification.service import (
    get_or_create_stats,
    update_streak,
    add_xp,
    record_daily_activity,
    xp_for_next_level,
)
from gamification.badges import check_and_award_badges

logger = logging.getLogger(__name__)

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# POST /submit — Submit a single card review
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/submit", response_model=ReviewResponse)
async def submit_review(
    body: ReviewRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Submit a flashcard review rating and get the next scheduling.
    Creates or updates the FlashcardReview row, runs FSRS,
    awards XP and checks badges.
    """
    try:
        user_id = current_user.id

        # Load or create FlashcardReview
        result = await session.execute(
            select(FlashcardReview).where(
                and_(
                    FlashcardReview.user_id == user_id,
                    FlashcardReview.summary_id == body.summary_id,
                    FlashcardReview.card_index == body.card_index,
                )
            )
        )
        review = result.scalar_one_or_none()

        if review is None:
            review = FlashcardReview(
                user_id=user_id,
                summary_id=body.summary_id,
                card_index=body.card_index,
                card_front=body.card_front,
            )
            session.add(review)
            await session.flush()

        # Build FSRSCard from current DB state
        card = FSRSCard(
            stability=review.stability or 0.0,
            difficulty=review.difficulty or 0.0,
            elapsed_days=review.elapsed_days or 0,
            scheduled_days=review.scheduled_days or 0,
            reps=review.reps or 0,
            lapses=review.lapses or 0,
            state=State(review.state) if review.state is not None else State.New,
            last_review=review.last_review,
        )

        # Run FSRS scheduling
        scheduled = schedule_card(card, Rating(body.rating))

        # Update FlashcardReview with new FSRS params
        review.stability = scheduled.stability
        review.difficulty = scheduled.difficulty
        review.elapsed_days = scheduled.elapsed_days
        review.scheduled_days = scheduled.scheduled_days
        review.reps = scheduled.reps
        review.lapses = scheduled.lapses
        review.state = scheduled.state
        review.last_rating = body.rating
        review.due_date = scheduled.due
        review.last_review = datetime.utcnow()

        # Calculate XP earned for this review
        xp_earned = calculate_xp(Rating(body.rating))

        # Update stats
        stats = await get_or_create_stats(session, user_id)
        stats.total_cards_reviewed = (stats.total_cards_reviewed or 0) + 1
        if scheduled.state >= State.Review:
            stats.total_cards_mastered = (stats.total_cards_mastered or 0) + 1

        # Add XP
        total_xp, level, leveled_up = await add_xp(session, user_id, xp_earned)

        # Update streak
        current_streak, streak_updated = await update_streak(session, user_id)

        # Record daily activity
        await record_daily_activity(session, user_id, cards=1, xp=xp_earned, time_s=0)

        # Count distinct videos for badge context
        result = await session.execute(
            select(FlashcardReview.summary_id)
            .where(FlashcardReview.user_id == user_id)
            .distinct()
        )
        distinct_videos = len(result.scalars().all())

        # Check badges
        now = datetime.utcnow()
        context = {
            "session_cards": 1,
            "session_duration": 0,
            "session_accuracy": 1.0 if body.rating >= Rating.Good else 0.0,
            "hour": now.hour,
            "distinct_videos": distinct_videos,
        }
        new_badges = await check_and_award_badges(session, user_id, stats, context)

        await session.commit()

        return ReviewResponse(
            success=True,
            card_index=body.card_index,
            new_state=scheduled.state,
            next_due=scheduled.due or datetime.utcnow(),
            stability=scheduled.stability,
            difficulty=scheduled.difficulty,
            xp_earned=xp_earned,
            streak_updated=streak_updated,
            new_badges=new_badges,
        )

    except Exception as e:
        await session.rollback()
        logger.exception("Failed to submit review")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# GET /due/{summary_id} — Get due flashcards for a video
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/due/{summary_id}", response_model=DueCardsResponse)
async def get_due_cards(
    summary_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    Get flashcards due for review for a given summary.
    Returns cards that are due (due_date <= now) plus new cards never reviewed.
    If no flashcards exist yet for this summary, triggers generation.
    """
    try:
        user_id = current_user.id
        now = datetime.utcnow()

        # Verify summary exists and belongs to user
        result = await session.execute(
            select(Summary).where(
                and_(Summary.id == summary_id, Summary.user_id == user_id)
            )
        )
        summary = result.scalar_one_or_none()
        if not summary:
            raise HTTPException(status_code=404, detail="Summary not found")

        # Get all reviews for this user+summary
        result = await session.execute(
            select(FlashcardReview).where(
                and_(
                    FlashcardReview.user_id == user_id,
                    FlashcardReview.summary_id == summary_id,
                )
            )
        )
        existing_reviews = {r.card_index: r for r in result.scalars().all()}

        # Try to get flashcards from the existing study endpoint / cache
        flashcards = await _get_flashcards_for_summary(session, summary, current_user)

        due_cards = []
        new_cards = []

        for idx, fc in enumerate(flashcards):
            front = fc.get("front", "")
            back = fc.get("back", "")
            category = fc.get("category", "")

            review = existing_reviews.get(idx)

            if review is None:
                # Never reviewed — new card
                new_cards.append({
                    "card_index": idx,
                    "front": front,
                    "back": back,
                    "category": category,
                    "state": State.New,
                    "due_date": None,
                    "difficulty": 0.0,
                })
            elif review.due_date is None or review.due_date <= now:
                # Due for review
                due_cards.append({
                    "card_index": idx,
                    "front": front,
                    "back": back,
                    "category": category,
                    "state": review.state or State.New,
                    "due_date": review.due_date.isoformat() if review.due_date else None,
                    "difficulty": review.difficulty or 0.0,
                })

        return DueCardsResponse(
            success=True,
            summary_id=summary_id,
            due_cards=due_cards,
            new_cards=new_cards,
            total_due=len(due_cards),
            total_new=len(new_cards),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to get due cards")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# POST /session/start — Start a study session
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/session/start", response_model=SessionStartResponse)
async def start_session(
    body: SessionStartRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Start a new study session and return its ID."""
    try:
        study_session = StudySession(
            user_id=current_user.id,
            summary_id=body.summary_id,
            session_type=body.session_type or "flashcards",
        )
        session.add(study_session)
        await session.commit()

        return SessionStartResponse(
            success=True,
            session_id=study_session.id,
        )

    except Exception as e:
        await session.rollback()
        logger.exception("Failed to start session")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# POST /session/end — End a study session
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/session/end", response_model=SessionEndResponse)
async def end_session(
    body: SessionEndRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """
    End a study session. Updates stats, checks speed/accuracy badges.
    """
    try:
        user_id = current_user.id

        # Load session
        result = await session.execute(
            select(StudySession).where(
                and_(
                    StudySession.id == body.session_id,
                    StudySession.user_id == user_id,
                )
            )
        )
        study_session = result.scalar_one_or_none()
        if not study_session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Calculate XP for the session
        # Approximate: 10 XP per card reviewed + bonus for accuracy
        accuracy = (
            body.cards_correct / body.cards_reviewed
            if body.cards_reviewed > 0 else 0.0
        )
        session_xp = body.cards_reviewed * 10
        if accuracy >= 0.9:
            session_xp = int(session_xp * 1.5)  # 50% bonus for 90%+ accuracy

        # Update session record
        study_session.cards_reviewed = body.cards_reviewed
        study_session.cards_correct = body.cards_correct
        study_session.xp_earned = session_xp
        study_session.duration_seconds = body.duration_seconds
        study_session.completed_at = datetime.utcnow()

        # Update user stats
        stats = await get_or_create_stats(session, user_id)
        stats.total_sessions = (stats.total_sessions or 0) + 1
        stats.total_time_seconds = (stats.total_time_seconds or 0) + body.duration_seconds

        # Add XP
        total_xp, level, leveled_up = await add_xp(session, user_id, session_xp)

        # Update streak
        current_streak, streak_updated = await update_streak(session, user_id)

        # Record daily activity for the session
        await record_daily_activity(
            session, user_id,
            cards=body.cards_reviewed,
            xp=session_xp,
            time_s=body.duration_seconds,
        )

        # Count distinct videos
        result = await session.execute(
            select(FlashcardReview.summary_id)
            .where(FlashcardReview.user_id == user_id)
            .distinct()
        )
        distinct_videos = len(result.scalars().all())

        # Check badges (session-level context)
        now = datetime.utcnow()

        # Check if all cards mastered for this video
        all_mastered_video = False
        if study_session.summary_id:
            all_mastered_video = await _check_video_all_mastered(
                session, user_id, study_session.summary_id
            )

        context = {
            "session_cards": body.cards_reviewed,
            "session_duration": body.duration_seconds,
            "session_accuracy": accuracy,
            "hour": now.hour,
            "distinct_videos": distinct_videos,
            "all_mastered_video": all_mastered_video,
        }
        new_badges = await check_and_award_badges(session, user_id, stats, context)

        await session.commit()

        # Build stats sub-response
        stats_response = StudyStatsResponse(
            success=True,
            total_xp=stats.total_xp or 0,
            level=stats.level or 1,
            xp_for_next_level=xp_for_next_level(stats.total_xp or 0, stats.level or 1),
            xp_progress=((stats.total_xp or 0) % 500),
            current_streak=stats.current_streak or 0,
            longest_streak=stats.longest_streak or 0,
            total_cards_mastered=stats.total_cards_mastered or 0,
            total_cards_reviewed=stats.total_cards_reviewed or 0,
            total_sessions=stats.total_sessions or 0,
            total_time_seconds=stats.total_time_seconds or 0,
        )

        return SessionEndResponse(
            success=True,
            xp_earned=session_xp,
            new_badges=new_badges,
            streak_updated=streak_updated,
            stats=stats_response,
        )

    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.exception("Failed to end session")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

async def _get_flashcards_for_summary(
    session: AsyncSession,
    summary: Summary,
    current_user: User,
) -> List[dict]:
    """
    Try to retrieve flashcards for a summary:
    1. Video content cache
    2. Generate via study_tools
    Returns list of dicts with keys: front, back, category
    """
    platform = getattr(summary, "platform", "youtube") or "youtube"
    video_id = getattr(summary, "video_id", None)
    lang = summary.lang or "fr"

    # Try cache first
    try:
        from main import get_video_cache
        vcache = get_video_cache()
        if vcache is not None and video_id:
            cached = await vcache.get_studio_content(platform, video_id, "flashcards", lang)
            if cached and cached.get("flashcards"):
                return cached["flashcards"]
    except Exception:
        pass

    # Generate flashcards
    try:
        from videos.study_tools import generate_study_card

        study_card = await generate_study_card(
            title=summary.video_title or "Video",
            channel=summary.video_channel or "",
            summary=summary.summary_content or "",
            transcript=summary.transcript_context or "",
            lang=lang,
            model="mistral-small-2603",
        )

        if not study_card:
            return []

        flashcards = []

        # Direct flashcards
        for fc in study_card.get("flashcards", []):
            if isinstance(fc, dict) and fc.get("front"):
                flashcards.append({
                    "front": fc.get("front", ""),
                    "back": fc.get("back", ""),
                    "category": fc.get("category", "General"),
                })

        # Fallback: Q&A
        if not flashcards:
            for qa in study_card.get("questions_answers", study_card.get("qa", [])):
                if isinstance(qa, dict):
                    flashcards.append({
                        "front": qa.get("question", qa.get("q", "")),
                        "back": qa.get("answer", qa.get("a", "")),
                        "category": "Questions",
                    })

        # Cache result
        if flashcards and video_id:
            try:
                from main import get_video_cache
                vcache = get_video_cache()
                if vcache:
                    await vcache.set_studio_content(platform, video_id, "flashcards", lang, {
                        "flashcards": flashcards,
                        "title": summary.video_title or "Flashcards",
                    })
            except Exception:
                pass

        return flashcards

    except Exception as e:
        logger.warning(f"Failed to generate flashcards: {e}")
        return []


async def _check_video_all_mastered(
    session: AsyncSession,
    user_id: int,
    summary_id: int,
) -> bool:
    """Check if ALL reviewed cards for a video are in Review state or above."""
    result = await session.execute(
        select(FlashcardReview).where(
            and_(
                FlashcardReview.user_id == user_id,
                FlashcardReview.summary_id == summary_id,
            )
        )
    )
    reviews = result.scalars().all()
    if not reviews:
        return False
    return all(r.state >= State.Review for r in reviews)
