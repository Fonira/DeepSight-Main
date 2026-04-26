"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 SCHEMAS — Pydantic v2 pour Study & Gamification                               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import IntEnum


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class FSRSRating(IntEnum):
    Again = 1
    Hard = 2
    Good = 3
    Easy = 4


class FSRSState(IntEnum):
    New = 0
    Learning = 1
    Review = 2
    Relearning = 3


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUESTS
# ═══════════════════════════════════════════════════════════════════════════════

class ReviewRequest(BaseModel):
    summary_id: int
    card_index: int
    card_front: str
    rating: FSRSRating


class SessionStartRequest(BaseModel):
    summary_id: Optional[int] = None
    session_type: str = "flashcards"


class SessionEndRequest(BaseModel):
    session_id: int
    cards_reviewed: int
    cards_correct: int
    duration_seconds: int


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RESPONSES
# ═══════════════════════════════════════════════════════════════════════════════

class ReviewResponse(BaseModel):
    success: bool
    card_index: int
    new_state: FSRSState
    next_due: datetime
    stability: float
    difficulty: float
    xp_earned: int
    streak_updated: bool
    new_badges: List[str] = []


class DueCardsResponse(BaseModel):
    success: bool
    summary_id: int
    due_cards: List[dict]  # {card_index, front, back, state, due_date, difficulty}
    new_cards: List[dict]  # Cartes jamais vues
    total_due: int
    total_new: int


class StudyStatsResponse(BaseModel):
    success: bool
    total_xp: int
    level: int
    xp_for_next_level: int
    xp_progress: int  # XP dans le niveau courant
    current_streak: int
    longest_streak: int
    total_cards_mastered: int
    total_cards_reviewed: int
    total_sessions: int
    total_time_seconds: int


class HeatMapResponse(BaseModel):
    success: bool
    activities: List[dict]  # {date, cards_reviewed, xp_earned}


class BadgeResponse(BaseModel):
    success: bool
    earned: List[dict]  # {code, name, icon, rarity, earned_at}
    locked: List[dict]  # {code, name, icon, rarity, description, progress, total}


class SessionStartResponse(BaseModel):
    success: bool
    session_id: int


class SessionEndResponse(BaseModel):
    success: bool
    xp_earned: int
    new_badges: List[str]
    streak_updated: bool
    stats: StudyStatsResponse


class VideoMasteryResponse(BaseModel):
    success: bool
    videos: List[dict]  # {summary_id, title, channel, mastery_percent, total_cards, due_cards, new_cards, last_studied}
