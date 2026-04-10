"""
Demo Service — Business logic for landing page demo.
Generates ultra-short summaries and handles demo chat sessions via Redis.
"""

import json
import logging
import uuid
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# REDIS DEMO SESSION MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

# Fallback in-memory store if Redis unavailable
_demo_sessions: Dict[str, dict] = {}

DEMO_SESSION_TTL = 1800  # 30 minutes
MAX_DEMO_CHAT_MESSAGES = 3


async def _get_redis():
    """Get Redis connection if available."""
    try:
        from core.config import settings
        import redis.asyncio as aioredis
        redis_url = getattr(settings, "REDIS_URL", None)
        if redis_url:
            return aioredis.from_url(redis_url, decode_responses=True)
    except Exception:
        pass
    return None


async def store_demo_session(
    session_id: str,
    transcript: str,
    video_title: str,
    video_channel: str,
    key_points: List[str],
    conclusion: str,
) -> None:
    """Store demo session data (transcript + summary) for chat."""
    session_data = {
        "transcript": transcript[:8000],  # Limit stored transcript
        "video_title": video_title,
        "video_channel": video_channel,
        "key_points": json.dumps(key_points, ensure_ascii=False),
        "conclusion": conclusion,
        "chat_count": 0,
        "chat_history": "[]",
    }

    redis = await _get_redis()
    if redis:
        try:
            key = f"demo:session:{session_id}"
            await redis.hset(key, mapping=session_data)
            await redis.expire(key, DEMO_SESSION_TTL)
            await redis.aclose()
            logger.info(f"[DEMO] Session {session_id[:8]} stored in Redis")
            return
        except Exception as e:
            logger.warning(f"[DEMO] Redis store failed, using memory: {e}")
            if redis:
                await redis.aclose()

    # Fallback: in-memory
    _demo_sessions[session_id] = session_data
    logger.info(f"[DEMO] Session {session_id[:8]} stored in memory")


async def get_demo_session(session_id: str) -> Optional[dict]:
    """Retrieve demo session data."""
    redis = await _get_redis()
    if redis:
        try:
            key = f"demo:session:{session_id}"
            data = await redis.hgetall(key)
            await redis.aclose()
            if data:
                return data
        except Exception as e:
            logger.warning(f"[DEMO] Redis get failed: {e}")
            if redis:
                await redis.aclose()

    # Fallback: in-memory
    return _demo_sessions.get(session_id)


async def increment_demo_chat(session_id: str) -> int:
    """Increment chat count and return new count."""
    redis = await _get_redis()
    if redis:
        try:
            key = f"demo:session:{session_id}"
            new_count = await redis.hincrby(key, "chat_count", 1)
            await redis.aclose()
            return new_count
        except Exception as e:
            logger.warning(f"[DEMO] Redis increment failed: {e}")
            if redis:
                await redis.aclose()

    # Fallback: in-memory
    if session_id in _demo_sessions:
        _demo_sessions[session_id]["chat_count"] = int(_demo_sessions[session_id].get("chat_count", 0)) + 1
        return int(_demo_sessions[session_id]["chat_count"])
    return 0


async def append_demo_chat_history(session_id: str, role: str, content: str) -> None:
    """Append a message to demo chat history."""
    redis = await _get_redis()
    if redis:
        try:
            key = f"demo:session:{session_id}"
            history_raw = await redis.hget(key, "chat_history") or "[]"
            history = json.loads(history_raw)
            history.append({"role": role, "content": content})
            await redis.hset(key, "chat_history", json.dumps(history, ensure_ascii=False))
            await redis.aclose()
            return
        except Exception as e:
            logger.warning(f"[DEMO] Redis append failed: {e}")
            if redis:
                await redis.aclose()

    # Fallback: in-memory
    if session_id in _demo_sessions:
        history = json.loads(_demo_sessions[session_id].get("chat_history", "[]"))
        history.append({"role": role, "content": content})
        _demo_sessions[session_id]["chat_history"] = json.dumps(history, ensure_ascii=False)


# ═══════════════════════════════════════════════════════════════════════════════
# DEMO ANALYSIS — Ultra-short summary generation
# ═══════════════════════════════════════════════════════════════════════════════

DEMO_SUMMARY_SYSTEM_PROMPT = """Tu es DeepSight, un assistant specialise dans l'analyse de contenu video.
Tu produis des resumes ultra-courts et percutants pour donner un apercu rapide d'une video.

Regles absolues :
- Baser chaque point UNIQUEMENT sur le transcript fourni
- Ne jamais inventer ou extrapoler
- Repondre en francais
- Format JSON strict, aucun texte autour"""

DEMO_SUMMARY_USER_PROMPT = """Analyse ce transcript et produis un resume ultra-court.

VIDEO : "{title}" par {channel}
TRANSCRIPT :
{transcript}

Reponds en JSON strict (aucun texte avant/apres) :
{{
  "key_points": ["point 1", "point 2", "point 3"],
  "conclusion": "Conclusion en 1-2 phrases maximum",
  "keywords": ["mot1", "mot2", "mot3"]
}}

Contraintes :
- Exactement 3 a 5 points cles (phrases courtes, percutantes, < 20 mots chacune)
- Conclusion : 1-2 phrases max
- 3 a 6 mots-cles pertinents
- Langage accessible, pas de jargon"""


async def generate_demo_summary(
    title: str,
    channel: str,
    transcript: str,
) -> Tuple[List[str], str, List[str]]:
    """
    Generate ultra-short demo summary using Mistral.
    Returns (key_points, conclusion, keywords).
    """
    from core.config import get_mistral_key

    # Truncate transcript for speed (max ~3000 chars for demo)
    truncated_transcript = transcript[:3000]

    user_prompt = DEMO_SUMMARY_USER_PROMPT.format(
        title=title,
        channel=channel,
        transcript=truncated_transcript,
    )

    try:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral

        client = Mistral(api_key=get_mistral_key())
        response = await client.chat.complete_async(
            model="mistral-small-2603",
            messages=[
                {"role": "system", "content": DEMO_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content
        data = json.loads(content)

        key_points = data.get("key_points", [])[:5]
        conclusion = data.get("conclusion", "")
        keywords = data.get("keywords", [])[:6]

        if not key_points:
            raise ValueError("No key_points in response")

        logger.info(f"[DEMO] Summary generated: {len(key_points)} points, {len(keywords)} keywords")
        return key_points, conclusion, keywords

    except Exception as e:
        logger.error(f"[DEMO] Summary generation failed: {e}")
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# DEMO CHAT — Contextual Q&A on demo video
# ═══════════════════════════════════════════════════════════════════════════════

DEMO_CHAT_SYSTEM_PROMPT = """Tu es DeepSight, un assistant IA specialise dans l'analyse de videos YouTube.
L'utilisateur teste la demo sur la page d'accueil. Reponds de maniere concise et utile.

Regles :
- Base tes reponses UNIQUEMENT sur le transcript et le resume fournis
- Reponses courtes (3-5 phrases max)
- Ton engageant — c'est une demo, montre la valeur du produit
- Si la question sort du sujet de la video, redirige poliment
- Reponds en francais"""

DEMO_CHAT_USER_PROMPT = """CONTEXTE VIDEO : "{video_title}" par {video_channel}

RESUME :
{summary_context}

TRANSCRIPT (extrait) :
{transcript}

HISTORIQUE CHAT :
{chat_history}

QUESTION DE L'UTILISATEUR :
{question}

Reponds de maniere concise et informative (3-5 phrases max)."""


async def generate_demo_chat_response(
    session_data: dict,
    question: str,
) -> str:
    """Generate a chat response for the demo, using session context."""
    from core.config import get_mistral_key

    # Build summary context
    key_points = json.loads(session_data.get("key_points", "[]"))
    conclusion = session_data.get("conclusion", "")
    summary_context = "\n".join([f"- {p}" for p in key_points])
    if conclusion:
        summary_context += f"\nConclusion : {conclusion}"

    # Build chat history
    chat_history_raw = json.loads(session_data.get("chat_history", "[]"))
    if chat_history_raw:
        chat_history = "\n".join(
            [f"{'Utilisateur' if m['role'] == 'user' else 'Assistant'}: {m['content']}" for m in chat_history_raw[-4:]]
        )
    else:
        chat_history = "(premiere question)"

    user_prompt = DEMO_CHAT_USER_PROMPT.format(
        video_title=session_data.get("video_title", ""),
        video_channel=session_data.get("video_channel", ""),
        summary_context=summary_context,
        transcript=session_data.get("transcript", "")[:2000],
        chat_history=chat_history,
        question=question,
    )

    try:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral

        client = Mistral(api_key=get_mistral_key())
        response = await client.chat.complete_async(
            model="mistral-small-2603",
            messages=[
                {"role": "system", "content": DEMO_CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.4,
            max_tokens=300,
        )

        answer = response.choices[0].message.content
        logger.info(f"[DEMO] Chat response generated ({len(answer)} chars)")
        return answer

    except Exception as e:
        logger.error(f"[DEMO] Chat response failed: {e}")
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# DEMO SUGGESTIONS — Pre-filled question chips
# ═══════════════════════════════════════════════════════════════════════════════

DEMO_SUGGESTIONS_PROMPT = """A partir de ce resume de video, genere exactement 3 questions courtes et pertinentes
qu'un utilisateur curieux poserait pour tester un chat IA sur cette video.

RESUME :
{summary_context}

Reponds en JSON strict :
{{
  "suggestions": ["question 1 ?", "question 2 ?", "question 3 ?"]
}}

Contraintes :
- Questions courtes (< 15 mots)
- Variees : 1 factuelle, 1 d'approfondissement, 1 pratique/actionnable
- En francais"""


async def generate_demo_suggestions(key_points: List[str], conclusion: str) -> List[str]:
    """Generate 3 question suggestions for the demo chat."""
    from core.config import get_mistral_key

    summary_context = "\n".join([f"- {p}" for p in key_points])
    if conclusion:
        summary_context += f"\nConclusion : {conclusion}"

    try:
        try:
            from mistralai import Mistral
        except ImportError:
            from mistralai.client import Mistral

        client = Mistral(api_key=get_mistral_key())
        response = await client.chat.complete_async(
            model="mistral-small-2603",
            messages=[
                {"role": "user", "content": DEMO_SUGGESTIONS_PROMPT.format(summary_context=summary_context)},
            ],
            temperature=0.5,
            max_tokens=200,
            response_format={"type": "json_object"},
        )

        data = json.loads(response.choices[0].message.content)
        suggestions = data.get("suggestions", [])[:3]
        logger.info(f"[DEMO] Generated {len(suggestions)} suggestions")
        return suggestions

    except Exception as e:
        logger.warning(f"[DEMO] Suggestions generation failed: {e}")
        # Fallback static suggestions
        return [
            "Quel est le point principal de cette video ?",
            "Quels arguments sont avances ?",
            "Comment appliquer ces idees concretement ?",
        ]
