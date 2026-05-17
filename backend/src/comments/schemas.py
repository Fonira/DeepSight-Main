"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 COMMENTS SCHEMAS — Pydantic v2 models (cross-platform YouTube/TikTok)         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Comment       → un commentaire normalisé (cross-platform)                         ║
║  CommentsBatch → résultat brut du scraping (sampled Top 100 + Random 50)          ║
║  TopVoice      → voix représentative pseudonymisée pour la take                   ║
║  CommunityTake → résultat de l'analyse Mistral (verdict communauté)               ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Comment(BaseModel):
    """Un commentaire normalisé (cross-platform YouTube + TikTok)."""

    comment_id: str
    author: str
    author_id: Optional[str] = None
    text: str
    like_count: int = 0
    reply_count: int = 0
    published_at: Optional[datetime] = None
    is_reply: bool = False
    parent_id: Optional[str] = None
    is_creator_reply: bool = False
    is_pinned: bool = False
    # Carry video_id pour le seed déterministe du sampler (cf sampler.py).
    video_id: Optional[str] = None


class CommentsBatch(BaseModel):
    """Résultat brut du scraping commentaires d'une vidéo (cross-user)."""

    platform: Literal["youtube", "tiktok"]
    video_id: str
    total_seen: int = 0
    sampled: list[Comment] = Field(default_factory=list)
    disabled: bool = False  # commentaires désactivés côté plateforme
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    bytes_used: int = 0  # bytes scrappés total (telemetry)


class TopVoice(BaseModel):
    """Voix représentative pseudonymisée pour le verdict communauté."""

    author: str  # Pseudonymisé côté prompt Mistral : "User-A1B2" / "Un commentateur populaire"
    excerpt: str = Field(max_length=240)
    stance: Literal["agree", "disagree", "neutral", "question"]
    like_count: int = 0


class CommunityTake(BaseModel):
    """Résultat de l'analyse Mistral des commentaires (verdict communauté)."""

    agreement_signal: Literal["agree", "disagree", "mixed", "unclear"]
    sentiment_distribution: dict[Literal["positive", "neutral", "negative"], float]
    controversies: list[str] = Field(default_factory=list, max_length=5)
    community_summary: str = Field(max_length=600)
    top_voices: list[TopVoice] = Field(default_factory=list, max_length=5)
    comments_analyzed: int = 0
    model_used: str = ""
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    is_truncated: bool = False
    disabled: bool = False  # mirror du flag CommentsBatch.disabled pour l'UI
    insufficient_data: bool = False  # < 10 commentaires sampled


__all__ = [
    "Comment",
    "CommentsBatch",
    "CommunityTake",
    "TopVoice",
]
