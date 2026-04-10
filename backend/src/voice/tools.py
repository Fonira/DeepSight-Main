"""
Voice Agent Server Tools
========================
4 tools appelables par l'agent vocal ElevenLabs via webhook.
Chaque fonction retourne un string formaté pour lecture vocale.
"""

import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import Summary, AcademicPaper

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────
# Helper : découpage en segments
# ─────────────────────────────────────────────────────────────────────

def split_into_segments(text: str, max_words: int = 200) -> list[str]:
    """Découpe un texte en segments de *max_words* mots.

    Essaie de couper aux fins de phrases (point suivi d'espace ou retour
    à la ligne) pour ne jamais couper au milieu d'un mot.
    """
    if not text or not text.strip():
        return []

    words = text.split()
    if len(words) <= max_words:
        return [text.strip()]

    segments: list[str] = []
    current_words: list[str] = []

    for word in words:
        current_words.append(word)

        if len(current_words) >= max_words:
            chunk = " ".join(current_words)
            # Cherche le dernier point suivi d'un espace ou fin de chaîne
            cut = -1
            for sep in [". ", ".\n", ".\r"]:
                pos = chunk.rfind(sep)
                if pos > len(chunk) // 3:  # pas trop tôt dans le chunk
                    cut = pos + 1
                    break

            if cut > 0:
                segments.append(chunk[:cut].strip())
                remaining = chunk[cut:].strip()
                current_words = remaining.split() if remaining else []
            else:
                segments.append(chunk.strip())
                current_words = []

    if current_words:
        segments.append(" ".join(current_words).strip())

    return [s for s in segments if s]


# ─────────────────────────────────────────────────────────────────────
# Tool 1 : Recherche dans le transcript
# ─────────────────────────────────────────────────────────────────────

async def search_in_transcript(
    summary_id: int,
    query: str,
    db: AsyncSession,
) -> str:
    """Recherche des passages pertinents dans le transcript de la vidéo.

    Stratégie de chargement :
    1. TranscriptCache (transcript complet depuis le cache persistant)
    2. Fallback : summary.transcript_context (peut être tronqué)
    """
    logger.info(
        "search_in_transcript called",
        extra={"summary_id": summary_id, "query": query},
    )

    try:
        result = await db.execute(
            select(Summary).where(Summary.id == summary_id)
        )
        summary = result.scalar_one_or_none()

        if summary is None:
            return "Analyse introuvable pour cet identifiant."

        # ── Charger le transcript complet (priorité au cache) ───────────
        transcript = ""

        # 1. Essayer TranscriptCache (transcript complet cross-user)
        if summary.video_id:
            try:
                from chat.context_builder import _get_full_transcript_from_cache
                transcript = await _get_full_transcript_from_cache(summary.video_id, db)
                if transcript:
                    logger.info(
                        "search_in_transcript: using TranscriptCache (%d chars)",
                        len(transcript),
                    )
            except Exception as e:
                logger.warning("search_in_transcript: TranscriptCache fallback: %s", e)

        # 2. Fallback : transcript_context du Summary
        if not transcript or not transcript.strip():
            transcript = summary.transcript_context or ""

        if not transcript or not transcript.strip():
            return "Aucun transcript disponible pour cette vidéo."

        query_words = set(query.lower().split())
        if not query_words:
            return "La requête de recherche est vide."

        # ── v3.0 : Utiliser smart_search BM25 (même scoring que le chat) ───────
        try:
            from videos.smart_search import (
                search_relevant_passages,
                format_passages_for_chat,
            )

            video_duration = summary.video_duration or 0
            passages = search_relevant_passages(
                question=query,
                transcript=transcript,
                video_duration=video_duration,
                max_passages=5,
            )
            if passages:
                # Formater pour la lecture vocale (max 1500 mots)
                result = format_passages_for_chat(passages, max_total_words=1500)
                if result:
                    logger.info(
                        "search_in_transcript: smart_search found %d passages",
                        len(passages),
                        extra={"summary_id": summary_id, "result_chars": len(result)},
                    )
                    return result
        except Exception as e:
            logger.warning("search_in_transcript: smart_search fallback: %s", e)

        # ── Fallback : scoring par intersection (legacy) ───────
        segments = split_into_segments(transcript, max_words=200)
        if not segments:
            return "Le transcript est vide."

        query_lower = query.lower()
        scored: list[tuple[float, int, str]] = []
        for idx, segment in enumerate(segments):
            segment_lower = segment.lower()
            segment_words = set(segment_lower.split())
            intersection = query_words & segment_words
            base_score = len(intersection) / len(query_words)

            if query_lower in segment_lower:
                base_score += 0.5
            elif len(query_lower) > 10:
                query_parts = query_lower.split()
                for i in range(len(query_parts) - 2):
                    sub = " ".join(query_parts[i:i+3])
                    if sub in segment_lower:
                        base_score += 0.2
                        break

            if base_score > 0.25:
                scored.append((base_score, idx, segment))

        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:5]

        if not top:
            return (
                f"Aucun passage trouvé dans le transcript pour la requête "
                f"\"{query}\". Essayez avec d'autres mots-clés."
            )

        parts: list[str] = []
        for score, idx, segment in top:
            display = segment[:600] + "..." if len(segment) > 600 else segment
            parts.append(f"[Segment {idx + 1}] {display}")

        return "\n\n".join(parts)

    except Exception as e:
        logger.error("search_in_transcript error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la recherche dans le transcript."


# ─────────────────────────────────────────────────────────────────────
# Tool 2 : Section de l'analyse
# ─────────────────────────────────────────────────────────────────────

_SECTION_KEYWORDS: dict[str, list[str]] = {
    "resume": ["résumé", "summary", "vue d'ensemble", "overview"],
    "points_cles": [
        "points clés",
        "key points",
        "points essentiels",
        "idées principales",
    ],
    "analyse_critique": [
        "analyse critique",
        "critical analysis",
        "évaluation",
        "limites",
    ],
    "contexte": ["contexte", "context", "background"],
    "conclusion": ["conclusion", "en résumé", "takeaways"],
}

_VALID_SECTIONS = set(_SECTION_KEYWORDS.keys())


async def get_analysis_section(
    summary_id: int,
    section: str,
    db: AsyncSession,
) -> str:
    """Retourne une section spécifique de l'analyse markdown."""
    logger.info(
        "get_analysis_section called",
        extra={"summary_id": summary_id, "section": section},
    )

    if section not in _VALID_SECTIONS:
        return (
            f"Section \"{section}\" inconnue. "
            f"Sections disponibles : {', '.join(sorted(_VALID_SECTIONS))}."
        )

    try:
        result = await db.execute(
            select(Summary).where(Summary.id == summary_id)
        )
        summary = result.scalar_one_or_none()

        if summary is None:
            return "Analyse introuvable pour cet identifiant."

        content = summary.summary_content
        if not content or not content.strip():
            return "Le contenu de l'analyse est vide."

        # Parse markdown par headers ##
        keywords = _SECTION_KEYWORDS[section]
        lines = content.split("\n")
        capturing = False
        captured: list[str] = []

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("##"):
                if capturing:
                    # On a atteint le header suivant → stop
                    break
                header_text = stripped.lstrip("#").strip().lower()
                if any(kw in header_text for kw in keywords):
                    capturing = True
                    continue  # ne pas inclure la ligne de header
            elif capturing:
                captured.append(line)

        if not captured:
            return (
                f"Section \"{section}\" non trouvée dans l'analyse. "
                "Le format de l'analyse ne contient peut-être pas cette section."
            )

        text = "\n".join(captured).strip()
        return text if text else f"La section \"{section}\" est vide."

    except Exception as e:
        logger.error("get_analysis_section error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la lecture de la section."


# ─────────────────────────────────────────────────────────────────────
# Tool 3 : Sources et fact-check
# ─────────────────────────────────────────────────────────────────────

async def get_sources(summary_id: int, db: AsyncSession) -> str:
    """Récupère les sources, le fact-check et les papiers académiques."""
    logger.info("get_sources called", extra={"summary_id": summary_id})

    try:
        result = await db.execute(
            select(Summary).where(Summary.id == summary_id)
        )
        summary = result.scalar_one_or_none()

        if summary is None:
            return "Analyse introuvable pour cet identifiant."

        parts: list[str] = []

        # --- full_digest (JSON ou texte brut) ---
        digest_data: dict = {}
        if summary.full_digest:
            try:
                digest_data = json.loads(summary.full_digest)
            except (json.JSONDecodeError, TypeError):
                # full_digest est du texte brut
                pass

        # Sources depuis full_digest
        sources_list = digest_data.get("sources", [])
        if sources_list:
            items = []
            for src in sources_list:
                if isinstance(src, dict):
                    items.append(
                        src.get("title") or src.get("url") or str(src)
                    )
                else:
                    items.append(str(src))
            parts.append("## Sources citées\n" + "\n".join(f"- {s}" for s in items))

        # Fact-check depuis full_digest ou champ dédié
        fact_check = digest_data.get("fact_check")
        if not fact_check and summary.fact_check_result:
            try:
                fact_check = json.loads(summary.fact_check_result)
            except (json.JSONDecodeError, TypeError):
                fact_check = summary.fact_check_result

        if fact_check:
            if isinstance(fact_check, dict):
                fc_text = json.dumps(fact_check, ensure_ascii=False, indent=2)
            else:
                fc_text = str(fact_check)
            parts.append(f"## Fact-check\n{fc_text}")

        # Score de fiabilité
        rel_score = digest_data.get("reliability_score") or summary.reliability_score
        if rel_score is not None:
            parts.append(f"## Score fiabilité : {rel_score}/10")

        # --- Papiers académiques ---
        try:
            papers_result = await db.execute(
                select(AcademicPaper)
                .where(AcademicPaper.summary_id == summary_id)
                .order_by(AcademicPaper.relevance_score.desc())
                .limit(5)
            )
            papers = papers_result.scalars().all()

            if papers:
                paper_lines = []
                for p in papers:
                    label = p.title or "Sans titre"
                    source = p.source or "inconnu"
                    paper_lines.append(f"- {label} ({source})")
                parts.append(
                    "## Papiers académiques\n" + "\n".join(paper_lines)
                )
        except Exception as e:
            logger.warning("get_sources: academic papers query failed: %s", e)

        if not parts:
            return "Aucune source disponible pour cette vidéo."

        return "\n\n".join(parts)

    except Exception as e:
        logger.error("get_sources error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la récupération des sources."


# ─────────────────────────────────────────────────────────────────────
# Tool 4 : Flashcards
# ─────────────────────────────────────────────────────────────────────

async def get_flashcards(
    summary_id: int,
    count: int = 5,
    db: AsyncSession = None,
) -> str:
    """Retourne les flashcards en cache pour une vidéo analysée.

    Les flashcards sont générées par le study router et mises en cache
    dans Redis (video_cache). On tente de les récupérer depuis le cache.
    Si aucun cache n'est disponible, on indique à l'utilisateur de les
    générer d'abord via l'interface.
    """
    logger.info(
        "get_flashcards called",
        extra={"summary_id": summary_id, "count": count},
    )
    count = min(count, 10)

    try:
        # On a besoin du summary pour récupérer video_id et platform
        if db is None:
            return "Aucune flashcard disponible (session DB manquante)."

        result = await db.execute(
            select(Summary).where(Summary.id == summary_id)
        )
        summary = result.scalar_one_or_none()

        if summary is None:
            return "Analyse introuvable pour cet identifiant."

        video_id = summary.video_id
        platform = summary.platform or "youtube"
        lang = summary.lang or "fr"

        # Tenter le cache Redis
        flashcards_data: list[dict] | None = None
        try:
            from main import get_video_cache

            vcache = get_video_cache()
            if vcache is not None and video_id:
                cached = await vcache.get_studio_content(
                    platform, video_id, "flashcards", lang
                )
                if cached and cached.get("flashcards"):
                    flashcards_data = cached["flashcards"]
        except Exception as e:
            logger.warning("get_flashcards: cache lookup failed: %s", e)

        if not flashcards_data:
            return (
                "Aucune flashcard générée pour cette vidéo. "
                "Génère-les d'abord depuis l'onglet Étude de l'application."
            )

        # Limiter au count demandé
        cards = flashcards_data[:count]

        parts: list[str] = []
        for i, card in enumerate(cards, start=1):
            question = card.get("question") or card.get("front", "")
            answer = card.get("answer") or card.get("back", "")
            if question and answer:
                parts.append(
                    f"**Question {i}** : {question}\n**Réponse** : {answer}"
                )

        if not parts:
            return "Aucune flashcard exploitable trouvée pour cette vidéo."

        return "\n\n".join(parts)

    except Exception as e:
        logger.error("get_flashcards error: %s", e, exc_info=True)
        return "Une erreur est survenue lors de la récupération des flashcards."
