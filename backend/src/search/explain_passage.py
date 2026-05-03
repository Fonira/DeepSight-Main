"""Service tooltip IA — explique pourquoi un passage matche une query.

Cache PG 7 jours sur sha256(query+passage_text+summary_id).
Modèle : mistral-small-latest (économie 6× vs large, 2 phrases suffisent).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import delete as sa_delete

from core.config import MISTRAL_API_KEY

logger = logging.getLogger(__name__)

MISTRAL_CHAT_URL = "https://api.mistral.ai/v1/chat/completions"
EXPLAIN_MODEL = "mistral-small-latest"
EXPLAIN_TIMEOUT = 30.0
CACHE_TTL_DAYS = 7

SYSTEM_PROMPT = """Tu es un assistant qui explique pourquoi un passage de texte matche une recherche.
Donne une explication courte (2 phrases max) qui :
1. Identifie le concept central commun entre la query et le passage
2. Mentionne précisément ce que le passage apporte par rapport à la query

Sois factuel. Si le match est faible ou ambigu, dis-le clairement.
Réponds UNIQUEMENT avec l'explication, pas de préambule."""


def _make_cache_key(query: str, passage_text: str, summary_id: int) -> str:
    return hashlib.sha256(f"{query}|{passage_text}|{summary_id}".encode()).hexdigest()


async def explain_passage(
    summary_id: int, passage_text: str, query: str, source_type: str
) -> dict:
    """Retourne {explanation, cached, model_used}."""
    from db.database import async_session_maker, ExplainPassageCache

    cache_key = _make_cache_key(query, passage_text, summary_id)

    async with async_session_maker() as session:
        # Cache check
        cached = await session.get(ExplainPassageCache, cache_key)
        now = datetime.now(timezone.utc)
        if cached:
            # SQLite (et certains drivers) renvoient des datetimes naïfs.
            # On les considère comme UTC pour la comparaison.
            expires_at = cached.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > now:
                logger.info(f"[EXPLAIN] cache hit {cache_key[:8]}")
                return {
                    "explanation": cached.explanation,
                    "cached": True,
                    "model_used": cached.model_used,
                }

        # Cache miss → Mistral
        user_prompt = (
            f"Query : {query}\n\n"
            f"Passage ({source_type}) : {passage_text}\n\n"
            f"Pourquoi ce passage matche la query ?"
        )
        explanation = await _call_mistral_chat(user_prompt)
        if not explanation:
            return {
                "explanation": "Explication indisponible pour le moment.",
                "cached": False,
                "model_used": EXPLAIN_MODEL,
            }

        # Upsert cache (delete-then-insert pour idempotence)
        await session.execute(
            sa_delete(ExplainPassageCache).where(ExplainPassageCache.cache_key == cache_key)
        )
        session.add(
            ExplainPassageCache(
                cache_key=cache_key,
                explanation=explanation,
                model_used=EXPLAIN_MODEL,
                expires_at=now + timedelta(days=CACHE_TTL_DAYS),
            )
        )
        await session.commit()

        return {
            "explanation": explanation,
            "cached": False,
            "model_used": EXPLAIN_MODEL,
        }


async def _call_mistral_chat(user_prompt: str) -> str | None:
    """Appelle Mistral chat completion. Retourne None si erreur."""
    if not MISTRAL_API_KEY:
        logger.error("[EXPLAIN] MISTRAL_API_KEY missing")
        return None

    headers = {
        "Authorization": f"Bearer {MISTRAL_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": EXPLAIN_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": 200,
    }

    try:
        async with httpx.AsyncClient(timeout=EXPLAIN_TIMEOUT) as client:
            resp = await client.post(MISTRAL_CHAT_URL, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            return content
    except (httpx.HTTPError, KeyError, IndexError) as e:
        logger.error(f"[EXPLAIN] Mistral call failed: {e}")
        return None
