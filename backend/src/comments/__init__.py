"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  💬 COMMENTS MODULE — Scraping commentaires YouTube/TikTok + Verdict communauté    ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md               ║
║                                                                                    ║
║  Architecture (5e tâche parallèle du pipeline v6/v2.1) :                          ║
║    fetch_comments(platform, video_id) → CommentsBatch (Top 100 + Random 50)       ║
║    generate_community_analysis(...) → CommunityTake (Mistral JSON-mode)           ║
║                                                                                    ║
║  Tout est non-bloquant : timeout 30s strict, exceptions catchées, retour None.    ║
║  Cache Redis L1 cross-user (24h). Persistance via Summary.community_analysis      ║
║  JSONB (alembic 029).                                                              ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from .schemas import Comment, CommentsBatch, CommunityTake, TopVoice
from .service import (
    COMMUNITY_TAKE_TIMEOUT_S,
    fetch_comments,
    generate_community_analysis,
    generate_community_analysis_with_timeout,
)

__all__ = [
    "COMMUNITY_TAKE_TIMEOUT_S",
    "Comment",
    "CommentsBatch",
    "CommunityTake",
    "TopVoice",
    "fetch_comments",
    "generate_community_analysis",
    "generate_community_analysis_with_timeout",
]
