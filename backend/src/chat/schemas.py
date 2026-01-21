"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📋 CHAT SCHEMAS — Modèles Pydantic pour le chat IA                                ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# 📥 REQUÊTES
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessageRequest(BaseModel):
    """Requête pour envoyer un message au chat vidéo"""
    question: str = Field(..., min_length=1, max_length=2000)
    summary_id: int
    mode: str = Field(default="standard", description="accessible, standard, expert")
    model: Optional[str] = Field(default=None, description="Modèle à utiliser")
    use_web_search: bool = Field(default=False, description="Activer la recherche web")


class PlaylistChatRequest(BaseModel):
    """Requête pour le chat sur playlist/corpus"""
    question: str = Field(..., min_length=1, max_length=2000)
    playlist_id: str
    mode: str = Field(default="standard")
    model: Optional[str] = Field(default=None)
    use_web_search: bool = Field(default=False)


class ClearChatRequest(BaseModel):
    """Requête pour effacer l'historique de chat"""
    summary_id: Optional[int] = None
    playlist_id: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 RÉPONSES
# ═══════════════════════════════════════════════════════════════════════════════

class ChatMessageResponse(BaseModel):
    """Message de chat"""
    id: int
    role: str  # user, assistant
    content: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    """Réponse du chat IA"""
    success: bool
    answer: str
    model_used: str
    tokens_used: Optional[int] = None
    web_search_used: bool = False
    volatile_topic_detected: bool = False
    disclaimer: Optional[str] = None


class ChatHistoryResponse(BaseModel):
    """Historique de chat"""
    messages: List[ChatMessageResponse]
    video_title: Optional[str] = None
    playlist_title: Optional[str] = None
    remaining_questions: int
    daily_limit: int


class ChatQuotaResponse(BaseModel):
    """Quota de chat"""
    daily_used: int
    daily_limit: int
    video_used: int
    video_limit: int
    can_ask: bool
    reason: Optional[str] = None
