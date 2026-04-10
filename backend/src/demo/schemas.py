"""
Demo Schemas — Pydantic models for landing page demo endpoints.
"""

from pydantic import BaseModel, Field
from typing import List, Optional


# ═══════════════════════════════════════════════════════════════════════════════
# REQUEST MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class DemoAnalyzeRequest(BaseModel):
    """Requete d'analyse demo landing page."""
    url: str = Field(..., description="URL YouTube ou TikTok (videos < 5 min)")


class DemoChatRequest(BaseModel):
    """Requete de chat demo (3 messages max)."""
    demo_session_id: str = Field(..., description="Session ID retourne par /demo/analyze")
    question: str = Field(..., min_length=1, max_length=500, description="Question sur la video")


# ═══════════════════════════════════════════════════════════════════════════════
# RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class DemoAnalyzeResponse(BaseModel):
    """Reponse d'analyse demo — resume ultra-court structure."""
    status: str = "success"
    demo_session_id: str = Field(..., description="Session ID pour le chat demo")
    video_title: str
    video_channel: str
    video_duration: int
    thumbnail_url: str
    platform: str = "youtube"
    category: str = "general"
    # Resume ultra-court structure
    key_points: List[str] = Field(..., description="3-5 points cles de la video")
    conclusion: str = Field(..., description="Conclusion en 1-2 phrases")
    keywords: List[str] = Field(..., description="3-6 mots-cles")
    # Quota info
    remaining_analyses: int = Field(..., description="Analyses restantes pour cette IP")


class DemoChatResponse(BaseModel):
    """Reponse de chat demo."""
    status: str = "success"
    response: str = Field(..., description="Reponse de l'IA")
    messages_remaining: int = Field(..., description="Messages restants (0-2)")


class DemoSuggestionsResponse(BaseModel):
    """Suggestions de questions pour le chat demo."""
    suggestions: List[str] = Field(..., description="3 questions suggerees")
