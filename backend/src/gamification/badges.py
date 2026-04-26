"""
Gamification badges — definitions & award logic.
"""

import logging
from typing import List, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Badge, UserBadge, UserStudyStats

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# BADGE DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════════════

BADGES_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "code": "first_flip",
        "name": "Premier Flip",
        "description": "Retourner sa première flashcard",
        "icon": "\U0001f0cf",
        "rarity": "common",
        "category": "general",
        "condition_type": "threshold",
        "condition_value": 1,
    },
    {
        "code": "quiz_perfect",
        "name": "Sans Faute",
        "description": "100% à un quiz",
        "icon": "\U0001f4af",
        "rarity": "rare",
        "category": "quiz",
        "condition_type": "event",
        "condition_value": 1,
    },
    {
        "code": "streak_3",
        "name": "Trio de Feu",
        "description": "3 jours consécutifs",
        "icon": "\U0001f525",
        "rarity": "common",
        "category": "streak",
        "condition_type": "threshold",
        "condition_value": 3,
    },
    {
        "code": "streak_7",
        "name": "Semaine de Feu",
        "description": "7 jours consécutifs",
        "icon": "\U0001f525",
        "rarity": "rare",
        "category": "streak",
        "condition_type": "threshold",
        "condition_value": 7,
    },
    {
        "code": "streak_30",
        "name": "Mois de Flammes",
        "description": "30 jours consécutifs",
        "icon": "\U0001f30b",
        "rarity": "legendary",
        "category": "streak",
        "condition_type": "threshold",
        "condition_value": 30,
    },
    {
        "code": "cards_25",
        "name": "Apprenti",
        "description": "25 cartes maîtrisées",
        "icon": "\U0001f4d8",
        "rarity": "common",
        "category": "mastery",
        "condition_type": "threshold",
        "condition_value": 25,
    },
    {
        "code": "cards_50",
        "name": "Demi-Centurion",
        "description": "50 cartes maîtrisées",
        "icon": "\U0001f3af",
        "rarity": "epic",
        "category": "mastery",
        "condition_type": "threshold",
        "condition_value": 50,
    },
    {
        "code": "cards_100",
        "name": "Centurion",
        "description": "100 cartes maîtrisées",
        "icon": "\U0001f451",
        "rarity": "legendary",
        "category": "mastery",
        "condition_type": "threshold",
        "condition_value": 100,
    },
    {
        "code": "speed_demon",
        "name": "Éclair",
        "description": "20 cartes en moins de 5 minutes",
        "icon": "\u26a1",
        "rarity": "epic",
        "category": "speed",
        "condition_type": "event",
        "condition_value": 1,
    },
    {
        "code": "night_owl",
        "name": "Noctambule",
        "description": "Réviser après minuit",
        "icon": "\U0001f989",
        "rarity": "common",
        "category": "general",
        "condition_type": "event",
        "condition_value": 1,
    },
    {
        "code": "multi_video",
        "name": "Polymathe",
        "description": "Étudier 5 vidéos différentes",
        "icon": "\U0001f4da",
        "rarity": "rare",
        "category": "general",
        "condition_type": "threshold",
        "condition_value": 5,
    },
    {
        "code": "all_mastered",
        "name": "Maître Absolu",
        "description": "100% de maîtrise sur une vidéo",
        "icon": "\U0001f3c6",
        "rarity": "legendary",
        "category": "mastery",
        "condition_type": "event",
        "condition_value": 1,
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# BADGE CHECKING
# ═══════════════════════════════════════════════════════════════════════════════


async def check_and_award_badges(
    session: AsyncSession,
    user_id: int,
    stats: UserStudyStats,
    context: Dict[str, Any],
) -> List[str]:
    """
    Check all badges the user hasn't earned yet and award any that are now met.

    Args:
        session: DB session
        user_id: user id
        stats: current UserStudyStats row (already up-to-date)
        context: dict with keys:
            session_cards (int), session_duration (int, seconds),
            session_accuracy (float 0-1), hour (int 0-23),
            distinct_videos (int)

    Returns:
        List of badge codes newly earned.
    """
    # Load all badge definitions from DB
    result = await session.execute(select(Badge))
    all_badges = {b.code: b for b in result.scalars().all()}

    # Load already-earned badge ids for this user
    result = await session.execute(select(UserBadge.badge_id).where(UserBadge.user_id == user_id))
    earned_badge_ids = set(result.scalars().all())

    new_badges: List[str] = []

    for code, badge in all_badges.items():
        if badge.id in earned_badge_ids:
            continue

        if _check_badge_condition(badge, stats, context):
            user_badge = UserBadge(user_id=user_id, badge_id=badge.id)
            session.add(user_badge)
            new_badges.append(code)
            logger.info(
                "Badge awarded",
                extra={"user_id": user_id, "badge": code},
            )

    if new_badges:
        await session.flush()

    return new_badges


def _check_badge_condition(
    badge: Badge,
    stats: UserStudyStats,
    context: Dict[str, Any],
) -> bool:
    """Evaluate whether a single badge condition is met."""
    code = badge.code

    # --- Threshold badges (stat >= value) ---
    if code == "first_flip":
        return stats.total_cards_reviewed >= badge.condition_value

    if code == "streak_3":
        return stats.current_streak >= 3

    if code == "streak_7":
        return stats.current_streak >= 7

    if code == "streak_30":
        return stats.current_streak >= 30

    if code == "cards_25":
        return stats.total_cards_mastered >= 25

    if code == "cards_50":
        return stats.total_cards_mastered >= 50

    if code == "cards_100":
        return stats.total_cards_mastered >= 100

    if code == "multi_video":
        return context.get("distinct_videos", 0) >= 5

    # --- Event badges (contextual) ---
    if code == "quiz_perfect":
        return context.get("session_accuracy", 0) >= 1.0 and context.get("session_cards", 0) > 0

    if code == "speed_demon":
        cards = context.get("session_cards", 0)
        duration = context.get("session_duration", 999999)
        return cards >= 20 and duration <= 300  # 5 minutes

    if code == "night_owl":
        hour = context.get("hour", 12)
        return 0 <= hour < 5  # midnight to 5am

    if code == "all_mastered":
        return context.get("all_mastered_video", False)

    return False


# ═══════════════════════════════════════════════════════════════════════════════
# SEED BADGES IN DB
# ═══════════════════════════════════════════════════════════════════════════════


async def seed_badges(session: AsyncSession) -> None:
    """Insert badge definitions into DB if not already present."""
    result = await session.execute(select(Badge.code))
    existing_codes = set(result.scalars().all())

    added = 0
    for defn in BADGES_DEFINITIONS:
        if defn["code"] not in existing_codes:
            badge = Badge(
                code=defn["code"],
                name=defn["name"],
                description=defn["description"],
                icon=defn["icon"],
                rarity=defn["rarity"],
                category=defn["category"],
                condition_type=defn["condition_type"],
                condition_value=defn["condition_value"],
            )
            session.add(badge)
            added += 1

    if added:
        await session.commit()
        logger.info(f"Seeded {added} new badges")
    else:
        logger.info("All badges already seeded")
