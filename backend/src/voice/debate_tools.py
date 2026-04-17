"""
Debate Voice Agent Server Tools
================================
5 tools appelables par l'agent vocal ElevenLabs "Modérateur de débat" via webhook.
Chaque fonction retourne un string formaté pour lecture vocale (max ~1500 mots).

Tous ces tools lisent DebateAnalysis (pas Summary). Ownership vérifié au niveau router.
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import DebateAnalysis
from voice.debate_context import _safe_json_list, _truncate

logger = logging.getLogger(__name__)


async def _load_debate(debate_id: int, db: AsyncSession) -> Optional[DebateAnalysis]:
    result = await db.execute(
        select(DebateAnalysis).where(DebateAnalysis.id == debate_id)
    )
    return result.scalar_one_or_none()


async def get_debate_overview(debate_id: int, db: AsyncSession) -> str:
    """Résumé haute-vue : sujet, 2 thèses, synthèse."""
    logger.info("debate_tool.overview", extra={"debate_id": debate_id})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    lines = [
        f"Sujet du débat : {debate.detected_topic or '(non détecté)'}",
        "",
        f"Vidéo A — {debate.video_a_title or 'titre inconnu'} ({debate.video_a_channel or 'chaîne inconnue'})",
        f"  Thèse : {_truncate(debate.thesis_a or '(non identifiée)', 400)}",
        "",
        f"Vidéo B — {debate.video_b_title or 'titre inconnu'} ({debate.video_b_channel or 'chaîne inconnue'})",
        f"  Thèse : {_truncate(debate.thesis_b or '(non identifiée)', 400)}",
        "",
        f"Synthèse : {_truncate(debate.debate_summary or '(aucune synthèse disponible)', 600)}",
    ]
    return "\n".join(lines)


async def get_video_thesis(debate_id: int, side: str, db: AsyncSession) -> str:
    """Thèse + arguments détaillés de la vidéo A ou B."""
    logger.info("debate_tool.thesis", extra={"debate_id": debate_id, "side": side})
    side_norm = (side or "").strip().lower()
    if side_norm not in ("video_a", "video_b", "a", "b"):
        return "Paramètre 'side' invalide. Utiliser 'video_a' ou 'video_b'."
    is_a = side_norm in ("video_a", "a")

    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    title = (debate.video_a_title if is_a else debate.video_b_title) or "titre inconnu"
    channel = (debate.video_a_channel if is_a else debate.video_b_channel) or "chaîne inconnue"
    thesis = (debate.thesis_a if is_a else debate.thesis_b) or "(non identifiée)"
    arguments = _safe_json_list(
        debate.arguments_a if is_a else debate.arguments_b
    )

    lines = [
        f"## {'Vidéo A' if is_a else 'Vidéo B'} — {title}",
        f"Chaîne : {channel}",
        "",
        f"**Thèse défendue** : {thesis}",
        "",
        "**Arguments principaux** :",
    ]
    if not arguments:
        lines.append("(aucun argument extrait)")
    else:
        for i, arg in enumerate(arguments[:8], start=1):
            if not isinstance(arg, dict):
                lines.append(f"{i}. {str(arg)}")
                continue
            claim = arg.get("claim", "?")
            evidence = arg.get("evidence", "")
            strength = arg.get("strength", "")
            suffix = f" [{strength}]" if strength else ""
            lines.append(f"{i}. {claim}{suffix}")
            if evidence:
                lines.append(f"   → {evidence}")

    return _truncate("\n".join(lines), 3000)


async def get_argument_comparison(
    debate_id: int, topic: str, db: AsyncSession
) -> str:
    """Compare les positions A vs B sur un sous-thème."""
    logger.info("debate_tool.compare", extra={"debate_id": debate_id, "topic": (topic or "")[:60]})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    divergence = _safe_json_list(debate.divergence_points)
    convergence = _safe_json_list(debate.convergence_points)
    arguments_a = _safe_json_list(debate.arguments_a)
    arguments_b = _safe_json_list(debate.arguments_b)

    topic_norm = (topic or "").strip().lower()

    if not topic_norm:
        lines: list[str] = []
        if divergence:
            lines.append("## Points de divergence")
            for d in divergence[:6]:
                if isinstance(d, dict):
                    lines.append(
                        f"- **{d.get('topic', '?')}** — A : {d.get('position_a', '')}"
                        f" / B : {d.get('position_b', '')}"
                    )
                else:
                    lines.append(f"- {d}")
            lines.append("")
        if convergence:
            lines.append("## Points de convergence")
            for c in convergence[:5]:
                lines.append(f"- {c}")
        return _truncate("\n".join(lines), 2500) or "Aucun point comparatif disponible."

    matching_divergences = [
        d for d in divergence
        if isinstance(d, dict) and topic_norm in (d.get("topic") or "").lower()
    ]
    matching_args_a = [
        a for a in arguments_a
        if isinstance(a, dict) and topic_norm in (a.get("claim") or "").lower()
    ]
    matching_args_b = [
        a for a in arguments_b
        if isinstance(a, dict) and topic_norm in (a.get("claim") or "").lower()
    ]

    if not (matching_divergences or matching_args_a or matching_args_b):
        return (
            f"Aucun point de comparaison explicite sur '{topic}' dans ce débat. "
            "Utiliser get_argument_comparison sans argument pour voir toutes les divergences."
        )

    lines = [f"## Comparaison sur : {topic}", ""]
    for d in matching_divergences:
        lines.append(
            f"**{d.get('topic', '?')}** — A : {d.get('position_a', '')}"
            f" / B : {d.get('position_b', '')}"
        )
    if matching_args_a:
        lines.append("\n**Arguments vidéo A** :")
        for a in matching_args_a[:3]:
            lines.append(f"- {a.get('claim', '?')}")
    if matching_args_b:
        lines.append("\n**Arguments vidéo B** :")
        for a in matching_args_b[:3]:
            lines.append(f"- {a.get('claim', '?')}")

    return _truncate("\n".join(lines), 2500)


async def search_in_debate_transcript(
    debate_id: int,
    query: str,
    side: str,
    db: AsyncSession,
) -> str:
    """Recherche BM25 dans le transcript de la vidéo A, B, ou les deux."""
    logger.info("debate_tool.search_transcript", extra={"debate_id": debate_id, "query": (query or "")[:60], "side": side})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."
    if not query or not query.strip():
        return "La requête de recherche est vide."

    side_norm = (side or "both").strip().lower()
    if side_norm not in ("video_a", "video_b", "both", "a", "b"):
        return "Paramètre 'side' invalide. Utiliser 'video_a', 'video_b' ou 'both'."

    from chat.context_builder import _get_full_transcript_from_cache
    from videos.smart_search import search_relevant_passages, format_passages_for_chat

    sides: list[tuple[str, str]] = []
    if side_norm in ("video_a", "a", "both"):
        sides.append(("Vidéo A", debate.video_a_id or ""))
    if side_norm in ("video_b", "b", "both"):
        sides.append(("Vidéo B", debate.video_b_id or ""))

    parts: list[str] = []
    for label, video_id in sides:
        if not video_id:
            parts.append(f"### {label}\n(pas d'ID vidéo)")
            continue
        try:
            transcript = await _get_full_transcript_from_cache(video_id, db)
        except Exception as exc:
            logger.warning("search_in_debate_transcript: %s load failed: %s", label, exc)
            transcript = ""
        if not transcript:
            parts.append(f"### {label}\n(transcript indisponible)")
            continue
        try:
            passages = search_relevant_passages(
                question=query, transcript=transcript,
                video_duration=0, max_passages=3,
            )
        except Exception as exc:
            logger.warning("search_in_debate_transcript: %s smart_search failed: %s", label, exc)
            passages = []
        if not passages:
            parts.append(f"### {label}\n(aucun passage pertinent trouvé)")
            continue
        formatted = format_passages_for_chat(passages, max_total_words=600)
        parts.append(f"### {label}\n{formatted}")

    return _truncate("\n\n".join(parts), 3500) or "Aucun résultat."


async def get_debate_fact_check(debate_id: int, db: AsyncSession) -> str:
    """Retourne la liste des affirmations fact-checkées avec verdict + explication."""
    logger.info("debate_tool.fact_check", extra={"debate_id": debate_id})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    items = _safe_json_list(debate.fact_check_results)
    if not items:
        return "Aucun fact-check disponible pour ce débat."

    lines = ["## Fact-check du débat", ""]
    for i, item in enumerate(items[:10], start=1):
        if not isinstance(item, dict):
            lines.append(f"{i}. {str(item)}")
            continue
        claim = item.get("claim", "?")
        verdict = (item.get("verdict") or "unverifiable").lower()
        source = item.get("source", "")
        explanation = item.get("explanation", "")
        verdict_fr = {
            "confirmed": "confirmé", "nuanced": "nuancé",
            "disputed": "contesté", "unverifiable": "invérifiable",
        }.get(verdict, verdict)
        lines.append(f"{i}. **{claim}** → [{verdict_fr.upper()}]")
        if explanation:
            lines.append(f"   {explanation}")
        if source:
            lines.append(f"   Source : {source}")

    return _truncate("\n".join(lines), 3000)
