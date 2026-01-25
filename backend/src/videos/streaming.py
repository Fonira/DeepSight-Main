"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📡 STREAMING SERVICE v2.0 — Server-Sent Events pour Analyse Temps Réel           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  FONCTIONNALITÉS:                                                                  ║
║  • 🔄 SSE streaming avec heartbeat                                                ║
║  • 📊 Progression détaillée par étape                                             ║
║  • ✍️ Tokens Mistral streamés un par un                                           ║
║  • 🛡️ Gestion des sessions et timeouts                                            ║
║  • ❌ Support d'annulation côté client                                            ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import json
import asyncio
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

# ═══════════════════════════════════════════════════════════════════════════════
# 📦 IMPORTS LOCAUX
# ═══════════════════════════════════════════════════════════════════════════════

from db.database import get_session, Summary, User
from auth.dependencies import get_current_user_optional
from core.config import get_mistral_key, get_perplexity_key
from core.cache import cache, get_cache
from transcripts.youtube import get_transcript_with_timestamps

# Import conditionnel de httpx pour le streaming
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False
    print("⚠️ [STREAMING] httpx not available", flush=True)

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TYPES & ENUMS
# ═══════════════════════════════════════════════════════════════════════════════

class StreamEventType(str, Enum):
    CONNECTED = "connected"
    METADATA = "metadata"
    TRANSCRIPT = "transcript"
    TRANSCRIPT_COMPLETE = "transcript_complete"
    ANALYSIS_START = "analysis_start"
    TOKEN = "token"
    ANALYSIS_COMPLETE = "analysis_complete"
    COMPLETE = "complete"
    ERROR = "error"
    HEARTBEAT = "heartbeat"


@dataclass
class StreamSession:
    """Session de streaming pour tracking"""
    session_id: str
    user_id: int
    video_id: str
    status: str = "active"
    started_at: datetime = field(default_factory=datetime.utcnow)
    progress: int = 0
    cancelled: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# 🗂️ SESSION MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class SessionManager:
    """Gestionnaire des sessions de streaming actives"""
    
    def __init__(self):
        self.sessions: Dict[str, StreamSession] = {}
        self._cleanup_task: Optional[asyncio.Task] = None
    
    def create(self, user_id: int, video_id: str) -> StreamSession:
        session = StreamSession(
            session_id=str(uuid.uuid4()),
            user_id=user_id,
            video_id=video_id,
        )
        self.sessions[session.session_id] = session
        return session
    
    def get(self, session_id: str) -> Optional[StreamSession]:
        return self.sessions.get(session_id)
    
    def cancel(self, session_id: str) -> bool:
        session = self.sessions.get(session_id)
        if session:
            session.cancelled = True
            session.status = "cancelled"
            return True
        return False
    
    def remove(self, session_id: str) -> None:
        self.sessions.pop(session_id, None)
    
    def get_active_count(self) -> int:
        return sum(1 for s in self.sessions.values() if s.status == "active")
    
    async def cleanup_old_sessions(self, max_age_minutes: int = 30):
        """Nettoie les sessions anciennes"""
        now = datetime.utcnow()
        to_remove = []
        
        for session_id, session in self.sessions.items():
            age = (now - session.started_at).total_seconds() / 60
            if age > max_age_minutes:
                to_remove.append(session_id)
        
        for session_id in to_remove:
            self.remove(session_id)


# Singleton
session_manager = SessionManager()

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def format_sse_event(event_type: StreamEventType, data: Dict[str, Any]) -> str:
    """Formate un événement SSE"""
    json_data = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event_type.value}\ndata: {json_data}\n\n"


async def get_video_metadata(video_id: str) -> Dict[str, Any]:
    """Récupère les métadonnées YouTube d'une vidéo"""
    # Essayer le cache d'abord
    cached = await cache.get(f"metadata:{video_id}")
    if cached:
        return cached
    
    try:
        # Utiliser l'API YouTube oEmbed (pas besoin de clé)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://www.youtube.com/oembed",
                params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                metadata = {
                    "title": data.get("title", ""),
                    "channel": data.get("author_name", ""),
                    "thumbnail": data.get("thumbnail_url", ""),
                }
                
                # Cache pour 1 jour
                await cache.set(f"metadata:{video_id}", metadata, ttl=86400)
                return metadata
    except Exception as e:
        print(f"⚠️ [STREAMING] Metadata fetch error: {e}", flush=True)
    
    return {"title": "", "channel": "", "thumbnail": ""}


async def stream_mistral_analysis(
    transcript: str,
    title: str,
    channel: str,
    mode: str = "standard",
    lang: str = "fr",
    model: str = "mistral-small-latest",
) -> AsyncGenerator[str, None]:
    """
    Stream les tokens d'analyse depuis Mistral AI.
    
    Yields:
        Tokens individuels de la réponse
    """
    api_key = get_mistral_key()
    if not api_key:
        raise ValueError("Mistral API key not configured")
    
    # Construire le prompt selon le mode
    mode_instructions = {
        "accessible": "Utilise un langage simple et accessible au grand public. Évite le jargon technique.",
        "standard": "Utilise un niveau de langage équilibré, accessible mais précis.",
        "expert": "Utilise un vocabulaire technique approprié et entre dans les détails.",
    }
    
    system_prompt = f"""Tu es un analyste expert qui synthétise des vidéos YouTube.
{mode_instructions.get(mode, mode_instructions["standard"])}

Règles:
- Structure ta réponse avec des sections claires (## titres)
- Utilise des listes à puces pour les points clés
- Cite les moments importants avec des timestamps si disponibles
- Reste factuel et nuancé
- Signale les opinions vs les faits"""

    user_prompt = f"""Analyse cette vidéo YouTube:

**Titre:** {title}
**Chaîne:** {channel}

**Transcription:**
{transcript[:40000]}

Génère une analyse complète en {lang}."""

    try:
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                "https://api.mistral.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "max_tokens": 4000,
                    "temperature": 0.3,
                    "stream": True,
                },
                timeout=180,
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise ValueError(f"Mistral API error: {response.status_code} - {error_text}")
                
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data == "[DONE]":
                            break
                        
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except json.JSONDecodeError:
                            continue
                            
    except Exception as e:
        print(f"❌ [STREAMING] Mistral error: {e}", flush=True)
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# 📡 MAIN STREAMING GENERATOR
# ═══════════════════════════════════════════════════════════════════════════════

async def analysis_stream_generator(
    session: StreamSession,
    mode: str,
    lang: str,
    model: str,
    web_enrich: bool,
    db: AsyncSession,
    user: Optional[User],
) -> AsyncGenerator[str, None]:
    """
    Générateur principal pour le streaming d'analyse.
    """
    video_id = session.video_id
    full_text = ""
    
    try:
        # ═══════════════════════════════════════════════════════════════════════
        # 📡 CONNECTED
        # ═══════════════════════════════════════════════════════════════════════
        yield format_sse_event(StreamEventType.CONNECTED, {
            "session_id": session.session_id,
            "status": "starting",
        })
        
        # Check cancellation
        if session.cancelled:
            yield format_sse_event(StreamEventType.ERROR, {
                "code": "CANCELLED",
                "message": "Analyse annulée",
                "retryable": False,
            })
            return
        
        # ═══════════════════════════════════════════════════════════════════════
        # 📊 METADATA
        # ═══════════════════════════════════════════════════════════════════════
        metadata = await get_video_metadata(video_id)
        
        yield format_sse_event(StreamEventType.METADATA, {
            "title": metadata.get("title", ""),
            "channel": metadata.get("channel", ""),
            "thumbnail": metadata.get("thumbnail", ""),
            "duration": 0,  # TODO: Get actual duration
        })
        
        session.progress = 10
        
        # ═══════════════════════════════════════════════════════════════════════
        # 📝 TRANSCRIPT
        # ═══════════════════════════════════════════════════════════════════════
        yield format_sse_event(StreamEventType.TRANSCRIPT, {"progress": 0})
        
        # Check cache first
        cached_transcript = await cache.get_transcript(video_id)
        
        if cached_transcript:
            transcript = cached_transcript
        else:
            # Fetch transcript
            transcript_result = await get_transcript_with_timestamps(video_id, lang)
            transcript = transcript_result.get("text", "") if transcript_result else ""
            
            if transcript:
                await cache.cache_transcript(video_id, transcript)
        
        if not transcript:
            yield format_sse_event(StreamEventType.ERROR, {
                "code": "NO_TRANSCRIPT",
                "message": "Impossible de récupérer la transcription",
                "retryable": True,
            })
            return
        
        yield format_sse_event(StreamEventType.TRANSCRIPT, {"progress": 100})
        yield format_sse_event(StreamEventType.TRANSCRIPT_COMPLETE, {
            "word_count": len(transcript.split()),
        })
        
        session.progress = 30
        
        if session.cancelled:
            yield format_sse_event(StreamEventType.ERROR, {
                "code": "CANCELLED",
                "message": "Analyse annulée",
                "retryable": False,
            })
            return
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🧠 ANALYSIS
        # ═══════════════════════════════════════════════════════════════════════
        yield format_sse_event(StreamEventType.ANALYSIS_START, {
            "model": model,
            "mode": mode,
        })
        
        token_count = 0
        
        async for token in stream_mistral_analysis(
            transcript=transcript,
            title=metadata.get("title", ""),
            channel=metadata.get("channel", ""),
            mode=mode,
            lang=lang,
            model=model,
        ):
            if session.cancelled:
                yield format_sse_event(StreamEventType.ERROR, {
                    "code": "CANCELLED",
                    "message": "Analyse annulée",
                    "retryable": False,
                })
                return
            
            full_text += token
            token_count += 1
            
            # Calculate progress (30-90%)
            progress = min(90, 30 + (token_count / 50))  # Rough estimate
            session.progress = int(progress)
            
            yield format_sse_event(StreamEventType.TOKEN, {
                "token": token,
                "progress": int(progress),
            })
            
            # Small delay for smoother UI (optional)
            await asyncio.sleep(0.01)
        
        yield format_sse_event(StreamEventType.ANALYSIS_COMPLETE, {
            "word_count": len(full_text.split()),
        })
        
        session.progress = 95
        
        # ═══════════════════════════════════════════════════════════════════════
        # 💾 SAVE & COMPLETE
        # ═══════════════════════════════════════════════════════════════════════
        
        # Save to database if user is authenticated
        summary_id = None
        
        if user:
            summary = Summary(
                user_id=user.id,
                video_id=video_id,
                video_title=metadata.get("title", ""),
                video_channel=metadata.get("channel", ""),
                thumbnail_url=metadata.get("thumbnail", ""),
                summary_content=full_text,
                transcript_context=transcript[:40000],  # 🆕 v3.1: Augmenté pour chat et vidéos longues
                lang=lang,
                mode=mode,
                model_used=model,
                word_count=len(full_text.split()),
            )
            
            db.add(summary)
            await db.commit()
            await db.refresh(summary)
            
            summary_id = summary.id
            
            # Update user stats
            user.total_videos += 1
            user.total_words += len(full_text.split())
            await db.commit()
            
            # Cache the analysis
            await cache.cache_analysis(video_id, user.id, {
                "summary_id": summary_id,
                "content": full_text,
                "metadata": metadata,
            })
        
        session.progress = 100
        session.status = "complete"
        
        yield format_sse_event(StreamEventType.COMPLETE, {
            "summary_id": summary_id,
            "word_count": len(full_text.split()),
            "duration_seconds": (datetime.utcnow() - session.started_at).total_seconds(),
        })
        
    except Exception as e:
        print(f"❌ [STREAMING] Error: {e}", flush=True)
        session.status = "error"
        
        yield format_sse_event(StreamEventType.ERROR, {
            "code": "INTERNAL_ERROR",
            "message": str(e),
            "retryable": True,
        })
    
    finally:
        # Cleanup session after a delay
        await asyncio.sleep(5)
        session_manager.remove(session.session_id)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 ROUTER
# ═══════════════════════════════════════════════════════════════════════════════

router = APIRouter()


@router.get("/stream/{video_id}")
async def stream_analysis(
    video_id: str,
    request: Request,
    mode: str = Query("standard", regex="^(accessible|standard|expert)$"),
    lang: str = Query("fr", regex="^(fr|en)$"),
    model: str = Query("mistral-small-latest"),
    web_enrich: bool = Query(False),
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_session),
    user: Optional[User] = Depends(get_current_user_optional),
):
    """
    Stream l'analyse d'une vidéo YouTube via Server-Sent Events.
    
    Events émis:
    - connected: Connexion établie
    - metadata: Métadonnées de la vidéo
    - transcript: Progression de la transcription
    - transcript_complete: Transcription terminée
    - analysis_start: Début de l'analyse
    - token: Token individuel de l'analyse
    - analysis_complete: Analyse terminée
    - complete: Tout terminé avec summary_id
    - error: Erreur avec code et message
    - heartbeat: Keep-alive
    """
    
    # Validate video ID format
    if not video_id or len(video_id) < 8:
        raise HTTPException(status_code=400, detail="Invalid video ID")
    
    # Rate limiting
    rate_key = f"stream:{user.id if user else request.client.host}"
    allowed, remaining = await cache.check_rate_limit(rate_key, max_requests=10, window_seconds=60)
    
    if not allowed:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    
    # Create session
    session = session_manager.create(
        user_id=user.id if user else 0,
        video_id=video_id,
    )
    
    # Create streaming response
    async def event_stream():
        try:
            async for event in analysis_stream_generator(
                session=session,
                mode=mode,
                lang=lang,
                model=model,
                web_enrich=web_enrich,
                db=db,
                user=user,
            ):
                # Check if client disconnected
                if await request.is_disconnected():
                    session.cancelled = True
                    break
                
                yield event
                
                # Heartbeat every 15 seconds
                if session.progress % 20 == 0:
                    yield format_sse_event(StreamEventType.HEARTBEAT, {
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                    
        except asyncio.CancelledError:
            session.cancelled = True
            session.status = "cancelled"
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user_optional),
):
    """Liste les sessions de streaming actives (admin only)"""
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return {
        "active_count": session_manager.get_active_count(),
        "sessions": [
            {
                "session_id": s.session_id,
                "video_id": s.video_id,
                "status": s.status,
                "progress": s.progress,
                "started_at": s.started_at.isoformat(),
            }
            for s in session_manager.sessions.values()
        ]
    }


@router.delete("/sessions/{session_id}")
async def cancel_session(
    session_id: str,
    user: User = Depends(get_current_user_optional),
):
    """Annule une session de streaming"""
    session = session_manager.get(session_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Only the owner or admin can cancel
    if session.user_id != (user.id if user else 0) and not (user and user.is_admin):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if session_manager.cancel(session_id):
        return {"status": "cancelled"}
    
    raise HTTPException(status_code=400, detail="Could not cancel session")
