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
import httpx
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
from core.http_client import shared_http_client
from transcripts.youtube import get_transcript_with_timestamps, get_video_info

# 🌐 Web enrichment pré-analyse (Perplexity)
try:
    from videos.web_enrichment import get_pre_analysis_context
    WEB_ENRICHMENT_AVAILABLE = True
except ImportError as e:
    WEB_ENRICHMENT_AVAILABLE = False
    print(f"⚠️ [STREAMING] Web enrichment unavailable: {e}", flush=True)
    
    async def get_pre_analysis_context(*args, **kwargs):
        return None, [], None

# 🦁 Brave Search fact-checking complémentaire
try:
    from videos.brave_search import get_brave_factcheck_context
    BRAVE_SEARCH_AVAILABLE = True
except ImportError as e:
    BRAVE_SEARCH_AVAILABLE = False
    print(f"⚠️ [STREAMING] Brave Search unavailable: {e}", flush=True)
    
    async def get_brave_factcheck_context(*args, **kwargs):
        return None, []

# 🔬 Deep Research imports
try:
    from videos.brave_search import get_brave_deep_research_context
    BRAVE_DEEP_RESEARCH_AVAILABLE = True
except ImportError:
    BRAVE_DEEP_RESEARCH_AVAILABLE = False
    async def get_brave_deep_research_context(*args, **kwargs):
        return None, []

try:
    from videos.web_enrichment import get_deep_research_context
    DEEP_RESEARCH_AVAILABLE = True
except ImportError:
    DEEP_RESEARCH_AVAILABLE = False
    async def get_deep_research_context(*args, **kwargs):
        return None, []

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
    PROGRESS = "progress"
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
        async with shared_http_client() as client:
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
    model: str = "mistral-small-2603",
    web_context: str = None,
    video_duration: int = 0,
    transcript_timestamped: str = None,
    video_description: str = "",
    video_tags: list = None,
) -> AsyncGenerator[str, None]:
    """
    Stream les tokens d'analyse depuis Mistral AI.
    🆕 v3.0: Supporte le contexte web pré-analyse (Perplexity)
    🆕 v4.0: Utilise le duration_router pour adapter le transcript selon la durée
    🆕 v4.1: Enrichissement avec description et tags vidéo pour contexte chaîne

    Yields:
        Tokens individuels de la réponse
    """
    api_key = get_mistral_key()
    if not api_key:
        raise ValueError("Mistral API key not configured")
    
    # Construire le prompt selon le mode
    mode_instructions = {
        "accessible": "Utilise un langage simple et accessible au grand public. Évite le jargon technique." if lang == "fr" else "Use simple, accessible language. Avoid technical jargon.",
        "standard": "Utilise un niveau de langage équilibré, accessible mais précis." if lang == "fr" else "Use balanced language, accessible but precise.",
        "expert": "Utilise un vocabulaire technique approprié et entre dans les détails." if lang == "fr" else "Use appropriate technical vocabulary and go into details.",
    }
    
    # ═══════════════════════════════════════════════════════════════════════════
    # 🧠 PROMPT ENRICHI avec règles épistémiques
    # ═══════════════════════════════════════════════════════════════════════════
    
    epistemic_rules = """
⚠️ IMPÉRATIF ÉPISTÉMIQUE — RÈGLES ABSOLUES:
• FAIT VÉRIFIÉ (✅): Information factuelle vérifiable — à présenter comme tel
• OPINION (⚖️): Point de vue de l'auteur — toujours signaler "Selon l'auteur..."
• HYPOTHÈSE (❓): Proposition non prouvée — utiliser le conditionnel
• À VÉRIFIER (⚠️): Affirmation extraordinaire sans source

RÈGLES D'OR:
1. Ne JAMAIS présenter une opinion comme un fait
2. Toujours attribuer les affirmations à leur source ("L'auteur affirme que...")
3. Si le contexte web contredit la vidéo, le signaler explicitement
4. NE PAS inventer ou deviner des informations que tu ne connais pas — signale plutôt "information non vérifiée"
""" if lang == "fr" else """
⚠️ EPISTEMIC IMPERATIVE — ABSOLUTE RULES:
• VERIFIED FACT (✅): Verifiable factual information
• OPINION (⚖️): Author's viewpoint — always signal "According to the author..."
• HYPOTHESIS (❓): Unproven proposition — use conditional
• TO VERIFY (⚠️): Extraordinary claim without source

GOLDEN RULES:
1. NEVER present an opinion as a fact
2. Always attribute claims to their source
3. If web context contradicts the video, signal it explicitly
4. Do NOT invent or guess information you don't know — flag as "unverified" instead
"""
    
    system_prompt = f"""Tu es un analyste expert qui synthétise des vidéos YouTube avec rigueur factuelle.
{mode_instructions.get(mode, mode_instructions["standard"])}

{epistemic_rules}

Structure ta réponse avec:
- 🚀 Synthèse Express (30 secondes) — résumé ultra-concis
- 📖 Analyse Détaillée — avec sous-sections thématiques
- 🎯 Points Clés — les enseignements principaux
- ⚖️ Analyse Critique — forces, faiblesses, biais éventuels
""" if lang == "fr" else f"""You are an expert analyst who synthesizes YouTube videos with factual rigor.
{mode_instructions.get(mode, mode_instructions["standard"])}

{epistemic_rules}

Structure your response with:
- 🚀 Express Summary (30 seconds) — ultra-concise summary
- 📖 Detailed Analysis — with thematic sub-sections
- 🎯 Key Points — main takeaways
- ⚖️ Critical Analysis — strengths, weaknesses, potential biases
"""

    # ═══════════════════════════════════════════════════════════════════════════
    # 📝 USER PROMPT avec contexte web optionnel
    # ═══════════════════════════════════════════════════════════════════════════
    
    web_section = ""
    if web_context:
        web_section = f"""

═══════════════════════════════════════════════════════════════════════════════
📡 CONTEXTE WEB ACTUEL (Perplexity + Brave Search — données vérifiées)
═══════════════════════════════════════════════════════════════════════════════

{web_context}

═══════════════════════════════════════════════════════════════════════════════
⚠️ INSTRUCTIONS DE FACT-CHECKING:
- CROISE systématiquement les affirmations de la vidéo avec les sources web ci-dessus
- Si un fait de la vidéo est CONTREDIT par les sources web, SIGNALE-LE clairement avec ⚠️
- Si des informations sont OBSOLÈTES ou INCORRECTES, corrige-les
- Ajoute une section "📡 Mise à jour factuelle" si des infos ont changé depuis la vidéo
- Cite les sources quand tu corriges une affirmation ("Selon [source], ...")
- Privilégie TOUJOURS les données web vérifiées sur les affirmations non sourcées de la vidéo
═══════════════════════════════════════════════════════════════════════════════
"""

    # ═══════════════════════════════════════════════════════════════════════════
    # 🎬 v4.0: ROUTAGE PAR DURÉE — transcript adaptatif
    # ═══════════════════════════════════════════════════════════════════════════
    try:
        from videos.duration_router import categorize_video, build_structured_index, format_index_for_prompt, prepare_transcript_for_analysis
        profile = categorize_video(video_duration, transcript, transcript_timestamped)

        # Construire l'index structuré pour les vidéos MEDIUM+
        index_entries = []
        index_section = ""
        if transcript_timestamped and profile.tier.value != "short":
            index_entries = build_structured_index(
                transcript_timestamped, video_duration, profile.tier
            )
            if index_entries:
                index_section = format_index_for_prompt(index_entries, lang) + "\n\n"

        # Préparer le transcript adapté au tier
        adapted_transcript = prepare_transcript_for_analysis(
            profile, transcript, transcript_timestamped, index_entries
        )

        print(f"🎬 [STREAMING] Duration router: tier={profile.tier.value}, "
              f"duration={video_duration}s, transcript={len(adapted_transcript)} chars "
              f"(original: {len(transcript)} chars), index_entries={len(index_entries)}", flush=True)
    except Exception as e:
        print(f"⚠️ [STREAMING] Duration router fallback: {e}", flush=True)
        # Fallback : limitation intelligente basée sur la durée
        if video_duration > 1800:  # >30min
            adapted_transcript = transcript[:80000]
        else:
            adapted_transcript = transcript[:50000]
        index_section = ""

    # Section métadonnées enrichies (description + tags pour comprendre le contexte)
    meta_section = ""
    if video_description and len(video_description.strip()) > 20:
        desc_clean = video_description.strip()[:1500]
        meta_section += f"\n**Description de la vidéo:** {desc_clean}"
    if video_tags:
        tags_str = ", ".join(str(t) for t in video_tags[:15])
        if tags_str:
            meta_section += f"\n**Tags:** {tags_str}"

    # Instruction de couverture temporelle
    duration_instruction = ""
    if video_duration > 2700:  # >45min
        duration_instruction = (
            f"\n\nIMPORTANT : La vidéo dure {video_duration // 60} minutes. "
            "Assure-toi de couvrir le contenu de TOUTE la vidéo, pas seulement le début. "
            "Répartis tes timecodes de manière homogène sur l'ensemble de la durée. "
            "Chaque tiers de la vidéo (début/milieu/fin) doit être représenté dans ton analyse."
        )
    elif video_duration > 900:  # >15min
        duration_instruction = (
            f"\n\nNote : La vidéo dure {video_duration // 60} minutes. "
            "Couvre le contenu sur toute sa durée, avec des timecodes répartis."
        )

    user_prompt = f"""Analyse cette vidéo YouTube:

**Titre:** {title}
**Chaîne:** {channel}
**Durée:** {video_duration // 60} minutes{meta_section}
{web_section}
{index_section}**Transcription:**
{adapted_transcript}

Génère une analyse complète et rigoureuse en {"français" if lang == "fr" else "anglais"}.{duration_instruction}"""

    # Tokens dynamiques selon mode
    max_tokens_map = {
        "accessible": 2500,
        "standard": 5000,
        "expert": 10000,
    }
    max_tokens = max_tokens_map.get(mode, 5000)
    
    # +20% si contexte web (plus de contenu à analyser)
    if web_context:
        max_tokens = int(max_tokens * 1.2)

    try:
        async with shared_http_client() as client:
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
                    "max_tokens": max_tokens,
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
    deep_research: bool = False,
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
        # Récupérer la vraie durée via get_video_info (Supadata/Invidious)
        video_duration = 0
        try:
            full_info = await get_video_info(video_id)
            if full_info:
                video_duration = full_info.get("duration", 0) or 0
        except Exception:
            pass  # Fallback: durée 0 si impossible à récupérer

        yield format_sse_event(StreamEventType.METADATA, {
            "title": metadata.get("title", ""),
            "channel": metadata.get("channel", ""),
            "thumbnail": metadata.get("thumbnail", ""),
            "duration": video_duration,
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
            # Fetch transcript (returns tuple: simple_text, timestamped_text, detected_lang)
            transcript_result = await get_transcript_with_timestamps(video_id)
            if transcript_result and isinstance(transcript_result, tuple):
                transcript = transcript_result[0] or ""
            elif transcript_result:
                transcript = str(transcript_result)
            else:
                transcript = ""
            
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
        # 🌐 WEB ENRICHMENT PRÉ-ANALYSE
        # ═══════════════════════════════════════════════════════════════════════
        web_context = None
        should_enrich = False
        enrichment_sources_list = []
        
        # Déterminer le plan utilisateur
        user_plan = "free"
        if user:
            user_plan = getattr(user, 'plan', 'free') or 'free'
        
        # ─────────────────────────────────────────────────────────────────
        # 🔬 PATH A: DEEP RESEARCH (Brave massif + Perplexity sonar-pro)
        # ─────────────────────────────────────────────────────────────────
        if deep_research and user_plan in ('pro', 'admin'):
            print(f"🔬 [DEEP RESEARCH] Pipeline activé pour plan={user_plan}", flush=True)
            try:
                # Étape 1: Brave Search massif (5 queries × 8 résultats)
                yield format_sse_event(StreamEventType.PROGRESS, {
                    "step": "deep_research_start",
                    "message": "🔬 Recherche approfondie en cours...",
                    "progress": 33,
                })
                
                brave_text, brave_sources = None, []
                if BRAVE_DEEP_RESEARCH_AVAILABLE:
                    brave_text, brave_sources = await get_brave_deep_research_context(
                        video_title=metadata.get("title", ""),
                        video_channel=metadata.get("channel", ""),
                        transcript=transcript,
                        lang=lang,
                    )
                
                if brave_text and brave_sources:
                    yield format_sse_event(StreamEventType.PROGRESS, {
                        "step": "deep_research_brave_done",
                        "message": f"✅ {len(brave_sources)} sources collectées, synthèse en cours...",
                        "progress": 38,
                    })
                    
                    # Étape 2: Perplexity sonar-pro croise les résultats
                    if DEEP_RESEARCH_AVAILABLE:
                        dr_context, dr_sources = await get_deep_research_context(
                            video_title=metadata.get("title", ""),
                            video_channel=metadata.get("channel", ""),
                            transcript_excerpt=transcript[:5000],
                            brave_results_text=brave_text,
                            brave_sources=brave_sources,
                            lang=lang,
                        )
                        
                        if dr_context:
                            web_context = dr_context
                            enrichment_sources_list = dr_sources
                            yield format_sse_event(StreamEventType.PROGRESS, {
                                "step": "deep_research_complete",
                                "message": f"✅ Analyse croisée terminée — {len(dr_sources)} sources",
                                "progress": 45,
                            })
                        else:
                            # Fallback: utiliser le contexte Brave brut
                            web_context = brave_text
                            enrichment_sources_list = brave_sources
                    else:
                        web_context = brave_text
                        enrichment_sources_list = brave_sources
                else:
                    print("⚠️ [DEEP RESEARCH] Brave returned nothing, fallback to standard", flush=True)
                    
            except Exception as e:
                print(f"⚠️ [DEEP RESEARCH] Error (non-blocking): {e}", flush=True)
        
        # ─────────────────────────────────────────────────────────────────
        # 🌐 PATH B: STANDARD (Perplexity sonar + Brave fact-check)
        # ─────────────────────────────────────────────────────────────────
        if web_context is None and web_enrich and WEB_ENRICHMENT_AVAILABLE:
            try:
                should_enrich = user_plan in ('pro', 'admin')
                
                if not should_enrich:
                    fast_changing_keywords = [
                        'ai', 'gpt', 'claude', 'llm', 'model', 'opus', 'sonnet',
                        'gemini', 'mistral', 'openai', 'anthropic', 'google',
                        'crypto', 'bitcoin', 'election', 'guerre', 'war',
                        'version', 'release', 'update', 'nouveau', 'new',
                    ]
                    title_lower = metadata.get("title", "").lower()
                    transcript_start = transcript[:500].lower()
                    for kw in fast_changing_keywords:
                        if kw in title_lower or kw in transcript_start:
                            should_enrich = True
                            print(f"🌐 [AUTO-ENRICH] Keyword '{kw}' detected", flush=True)
                            break
                
                if should_enrich:
                    yield format_sse_event(StreamEventType.PROGRESS, {
                        "step": "web_enrichment",
                        "message": "🌐 Recherche web pour vérification des faits...",
                        "progress": 35,
                    })
                    
                    web_text, sources, level = await get_pre_analysis_context(
                        video_title=metadata.get("title", ""),
                        video_channel=metadata.get("channel", ""),
                        category="technology",
                        transcript=transcript,
                        plan=user_plan if user_plan in ('pro', 'admin') else 'pro',
                        lang=lang,
                    )
                    
                    if web_text:
                        web_context = web_text
                        enrichment_sources_list = sources
                        yield format_sse_event(StreamEventType.PROGRESS, {
                            "step": "web_enrichment_complete",
                            "message": f"✅ {len(sources)} sources web trouvées",
                            "progress": 40,
                            "sources_count": len(sources),
                        })
                        
            except Exception as e:
                print(f"⚠️ [WEB-ENRICH] Error (non-blocking): {e}", flush=True)
        
        # 🦁 Brave fact-check standard (si pas de deep research)
        brave_context = None
        if not deep_research and BRAVE_SEARCH_AVAILABLE:
            brave_should_run = should_enrich
            if not brave_should_run:
                fast_kw = ['ai', 'gpt', 'claude', 'llm', 'opus', 'sonnet', 'gemini', 'mistral',
                            'crypto', 'bitcoin', 'election', 'version', 'release', 'update']
                title_lower = metadata.get("title", "").lower()
                transcript_start = transcript[:500].lower()
                brave_should_run = any(kw in title_lower or kw in transcript_start for kw in fast_kw)
            
            if brave_should_run:
                try:
                    yield format_sse_event(StreamEventType.PROGRESS, {
                        "step": "brave_factcheck",
                        "message": "🦁 Vérification croisée Brave Search...",
                        "progress": 42,
                    })
                    
                    brave_text, brave_sources = await get_brave_factcheck_context(
                        video_title=metadata.get("title", ""),
                        video_channel=metadata.get("channel", ""),
                        transcript=transcript,
                        lang=lang,
                    )
                    
                    if brave_text:
                        brave_context = brave_text
                        yield format_sse_event(StreamEventType.PROGRESS, {
                            "step": "brave_factcheck_complete",
                            "message": f"✅ {len(brave_sources)} sources Brave vérifiées",
                            "progress": 45,
                        })
                        
                except Exception as e:
                    print(f"⚠️ [BRAVE] Error (non-blocking): {e}", flush=True)
            
            # Fusionner Perplexity + Brave
            if brave_context and web_context:
                web_context = web_context + "\n\n" + brave_context
            elif brave_context:
                web_context = brave_context
        
        session.progress = 40
        
        # ═══════════════════════════════════════════════════════════════════════
        # 🧠 ANALYSIS
        # ═══════════════════════════════════════════════════════════════════════
        yield format_sse_event(StreamEventType.ANALYSIS_START, {
            "model": model,
            "mode": mode,
            "web_enriched": web_context is not None,
        })
        
        token_count = 0
        
        async for token in stream_mistral_analysis(
            transcript=transcript,
            title=metadata.get("title", ""),
            channel=metadata.get("channel", ""),
            mode=mode,
            lang=lang,
            model=model,
            web_context=web_context,
            video_duration=video_duration,
            transcript_timestamped=transcript if "[" in transcript[:200] else None,
            video_description=metadata.get("description", ""),
            video_tags=metadata.get("tags", []),
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
            import json as _json
            summary = Summary(
                user_id=user.id,
                video_id=video_id,
                video_title=metadata.get("title", ""),
                video_channel=metadata.get("channel", ""),
                thumbnail_url=metadata.get("thumbnail", ""),
                summary_content=full_text,
                transcript_context=transcript[:40000],
                lang=lang,
                mode=mode,
                model_used=model,
                word_count=len(full_text.split()),
            )
            # 🔬 Deep Research: stocker les données enrichies
            if hasattr(summary, 'deep_research'):
                summary.deep_research = deep_research
            if hasattr(summary, 'enrichment_sources') and enrichment_sources_list:
                summary.enrichment_sources = _json.dumps(enrichment_sources_list[:50], ensure_ascii=False)
            if hasattr(summary, 'enrichment_data'):
                summary.enrichment_data = _json.dumps({
                    "deep_research": deep_research,
                    "sources_count": len(enrichment_sources_list),
                    "web_enriched": web_context is not None,
                })
            
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
    model: str = Query("mistral-small-2603"),
    web_enrich: bool = Query(False),
    deep_research: bool = Query(False),
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
                deep_research=deep_research,
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
