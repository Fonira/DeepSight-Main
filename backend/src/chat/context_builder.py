"""
Context Builder — Assemblage unifié du contexte riche pour Chat & Voice
========================================================================

Point d'entrée unique pour construire le contexte complet d'une vidéo
analysée. Utilisé par :
  - chat/service.py     (chat textuel Mistral)
  - voice/router.py     (chat vocal ElevenLabs)

Stratégie adaptative selon la durée de la vidéo :
  - Court  (< 30 min / < 25K chars)  → transcript COMPLET
  - Moyen  (30 min – 1h30 / 25-80K)  → full_digest + segments clés
  - Long   (> 1h30 / > 80K chars)    → full_digest + résumé structuré

Toutes les données disponibles sont assemblées :
  - Métadonnées vidéo (titre, chaîne, durée, date, catégorie, tags)
  - Transcript (complet ou chunké)
  - Analyse complète (summary_content)
  - Full digest (pipeline hiérarchique)
  - Fact-check (résultats, score fiabilité)
  - Enrichissement web (sources, deep research)
  - Entités extraites
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import (
    Summary,
    TranscriptCache,
    TranscriptCacheChunk,
    AcademicPaper,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Configuration des seuils
# ═══════════════════════════════════════════════════════════════════════════════

# Seuils de taille (en caractères)
SHORT_VIDEO_TRANSCRIPT_LIMIT = 25_000   # < 30 min → transcript complet
MEDIUM_VIDEO_TRANSCRIPT_LIMIT = 80_000  # 30 min – 1h30 → digest + segments
# > 80K → digest + résumé structuré uniquement

# Limites par consumer — chat
MAX_CONTEXT_CHAT = 50_000     # Mistral (mode expert 25K tokens ≈ 50K chars)

# Limites voice adaptatives par tier — v3.0
# Plus la vidéo est longue, plus le full_digest est important et doit rentrer.
MAX_CONTEXT_VOICE = 12_000    # Fallback par défaut
MAX_CONTEXT_VOICE_BY_TIER = {
    "micro": 8_000,       # Vidéo très courte, peu de contexte nécessaire
    "short": 10_000,
    "medium": 12_000,
    "long": 16_000,       # Conférences : le digest aide beaucoup
    "extended": 20_000,   # Podcasts 1h+ : full_digest (6-10K) + metadata
    "marathon": 24_000,   # 2h+ : full_digest complet + summary key points
}

# Taille des sections
MAX_FACT_CHECK_CHARS = 3_000
MAX_ENRICHMENT_CHARS = 4_000
MAX_ENTITIES_CHARS = 1_500
MAX_ACADEMIC_PAPERS = 5


# ═══════════════════════════════════════════════════════════════════════════════
# Dataclass de sortie
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class RichContext:
    """Contexte assemblé prêt à être injecté dans un prompt."""

    # Métadonnées
    video_title: str = ""
    channel_name: str = ""
    duration_seconds: int = 0
    duration_str: str = ""
    upload_date: str = ""
    platform: str = "youtube"
    category: str = ""
    tags: str = ""
    video_url: str = ""

    # Contenu textuel
    transcript: str = ""              # Transcript (complet ou tronqué)
    transcript_strategy: str = ""     # "full" | "digest_plus_segments" | "digest_only"
    transcript_total_chars: int = 0   # Taille originale complète
    full_transcript: str = ""         # 🆕 Transcript COMPLET (non tronqué) pour recherche
    summary_content: str = ""         # Analyse markdown
    full_digest: str = ""             # Pipeline hiérarchique

    # 🆕 v4.0: Index structuré pour navigation
    structured_index: str = ""        # JSON index sérialisé
    video_tier: str = ""              # "short" | "medium" | "long"

    # Fact-check & enrichissement
    fact_check: str = ""
    reliability_score: Optional[float] = None
    enrichment_sources: str = ""
    enrichment_data: str = ""
    entities: str = ""

    # Papiers académiques
    academic_papers: list[dict] = field(default_factory=list)

    # Debug
    total_chars: int = 0

    def format_for_voice(self, language: str = "fr") -> str:
        """Formate le contexte complet pour le system prompt vocal ElevenLabs.

        v3.0 : Limite adaptative par tier. Les vidéos longues obtiennent plus
        de contexte pour inclure le full_digest complet.
        """
        voice_limit = MAX_CONTEXT_VOICE_BY_TIER.get(self.video_tier, MAX_CONTEXT_VOICE)
        return _format_context(self, max_chars=voice_limit, language=language, mode="voice")

    def format_for_chat(self, language: str = "fr", mode: str = "standard") -> str:
        """Formate le contexte complet pour le chat textuel Mistral."""
        # En mode expert, on peut envoyer plus de contexte
        max_chars = MAX_CONTEXT_CHAT if mode == "expert" else 35_000
        return _format_context(self, max_chars=max_chars, language=language, mode="chat")

    def search_relevant_passages(self, query: str, lang: str = "fr") -> str:
        """
        🆕 v4.0: Recherche les passages pertinents pour une question spécifique.

        Pour les vidéos longues, utilise l'index structuré et le transcript complet
        pour trouver les passages les plus pertinents au lieu du simple intro+outro.

        Args:
            query: Question de l'utilisateur
            lang: Langue

        Returns:
            Texte des passages pertinents, prêt pour injection dans le prompt
        """
        if not self.full_transcript or not query:
            return ""

        try:
            from videos.duration_router import (
                categorize_video, deserialize_index, prepare_transcript_for_chat,
            )

            profile = categorize_video(
                self.duration_seconds, self.full_transcript, self.full_transcript
            )

            # Désérialiser l'index
            index_entries = deserialize_index(self.structured_index) if self.structured_index else []

            # Utiliser le routeur pour préparer le contexte optimisé
            return prepare_transcript_for_chat(
                profile=profile,
                full_transcript=self.full_transcript,
                query=query,
                index_entries=index_entries,
                full_digest=self.full_digest,
                summary_content=self.summary_content,
            )
        except Exception as e:
            logger.warning(f"search_relevant_passages fallback: {e}")
            # Fallback : ancien comportement
            return self.transcript


# ═══════════════════════════════════════════════════════════════════════════════
# Fonction principale : assemblage du contexte
# ═══════════════════════════════════════════════════════════════════════════════

async def build_rich_context(
    summary: Summary,
    db: AsyncSession,
    *,
    include_transcript: bool = True,
    include_academic: bool = True,
) -> RichContext:
    """
    Assemble tout le contexte disponible pour une vidéo analysée.

    Args:
        summary: L'objet Summary (doit être déjà chargé depuis la DB)
        db: Session SQLAlchemy async
        include_transcript: Si True, charge le transcript complet depuis TranscriptCache
        include_academic: Si True, charge les papiers académiques liés

    Returns:
        RichContext prêt à être formaté pour voice ou chat
    """
    ctx = RichContext()

    # ── Métadonnées ─────────────────────────────────────────────────────
    ctx.video_title = summary.video_title or "Vidéo sans titre"
    ctx.channel_name = summary.video_channel or "Chaîne inconnue"
    ctx.duration_seconds = summary.video_duration or 0
    ctx.duration_str = _format_duration(ctx.duration_seconds)
    ctx.upload_date = summary.video_upload_date or ""
    ctx.platform = summary.platform or "youtube"
    ctx.category = summary.category or ""
    ctx.video_url = summary.video_url or ""

    # Tags
    if summary.tags:
        try:
            tags_data = json.loads(summary.tags)
            if isinstance(tags_data, list):
                ctx.tags = ", ".join(str(t) for t in tags_data[:10])
            else:
                ctx.tags = str(tags_data)[:200]
        except (json.JSONDecodeError, TypeError):
            ctx.tags = str(summary.tags)[:200]

    # ── Analyse (summary_content) ───────────────────────────────────────
    ctx.summary_content = summary.summary_content or ""

    # ── Full Digest (pipeline hiérarchique) ─────────────────────────────
    ctx.full_digest = summary.full_digest or ""

    # ── Transcript : stratégie adaptative ───────────────────────────────
    if include_transcript:
        ctx.transcript, ctx.transcript_strategy, ctx.transcript_total_chars = (
            await _load_transcript_adaptive(summary, db)
        )
        # 🆕 v4.0: Stocker le transcript complet pour recherche per-question
        if ctx.transcript_strategy != "full":
            # Charger le transcript complet non tronqué pour la recherche
            full_raw = await _get_full_transcript_from_cache(summary.video_id, db)
            if not full_raw and summary.transcript_context:
                full_raw = summary.transcript_context
            ctx.full_transcript = full_raw or ctx.transcript
        else:
            ctx.full_transcript = ctx.transcript

        # 🆕 v4.0: Charger l'index structuré et le tier
        ctx.structured_index = summary.structured_index if hasattr(summary, 'structured_index') and summary.structured_index else ""
        try:
            from videos.duration_router import categorize_video
            profile = categorize_video(ctx.duration_seconds, ctx.full_transcript, ctx.full_transcript)
            ctx.video_tier = profile.tier.value
        except Exception:
            # Fallback compatible v2.0 : estimation par durée
            dur = ctx.duration_seconds
            if dur <= 60:
                ctx.video_tier = "micro"
            elif dur <= 300:
                ctx.video_tier = "short"
            elif dur <= 900:
                ctx.video_tier = "medium"
            elif dur <= 2700:
                ctx.video_tier = "long"
            elif dur <= 7200:
                ctx.video_tier = "extended"
            else:
                ctx.video_tier = "marathon"

    # ── Fact-check ──────────────────────────────────────────────────────
    ctx.fact_check = _extract_fact_check(summary)
    ctx.reliability_score = summary.reliability_score

    # ── Enrichissement web (deep research) ──────────────────────────────
    ctx.enrichment_sources = _extract_enrichment_sources(summary)
    ctx.enrichment_data = _extract_enrichment_data(summary)

    # ── Entités extraites ───────────────────────────────────────────────
    ctx.entities = _extract_entities(summary)

    # ── Papiers académiques ─────────────────────────────────────────────
    if include_academic:
        ctx.academic_papers = await _load_academic_papers(summary.id, db)

    # ── Total chars (debug) ─────────────────────────────────────────────
    ctx.total_chars = (
        len(ctx.transcript) + len(ctx.summary_content) + len(ctx.full_digest)
        + len(ctx.fact_check) + len(ctx.enrichment_sources)
        + len(ctx.enrichment_data) + len(ctx.entities)
    )

    logger.info(
        "rich_context_built",
        extra={
            "summary_id": summary.id,
            "transcript_strategy": ctx.transcript_strategy,
            "transcript_chars": len(ctx.transcript),
            "transcript_total_chars": ctx.transcript_total_chars,
            "total_context_chars": ctx.total_chars,
            "has_digest": bool(ctx.full_digest),
            "has_fact_check": bool(ctx.fact_check),
            "has_enrichment": bool(ctx.enrichment_sources),
            "academic_papers": len(ctx.academic_papers),
        },
    )

    return ctx


# ═══════════════════════════════════════════════════════════════════════════════
# Chargement adaptatif du transcript
# ═══════════════════════════════════════════════════════════════════════════════

async def _load_transcript_adaptive(
    summary: Summary,
    db: AsyncSession,
) -> tuple[str, str, int]:
    """
    Charge le transcript avec une stratégie adaptative selon la taille.

    Returns:
        (transcript_text, strategy, total_chars_original)
    """
    # 1. Essayer de récupérer le transcript complet depuis TranscriptCache
    full_transcript = await _get_full_transcript_from_cache(summary.video_id, db)

    # 2. Fallback : utiliser transcript_context du Summary
    if not full_transcript and summary.transcript_context:
        full_transcript = summary.transcript_context

    if not full_transcript:
        return "", "none", 0

    total_chars = len(full_transcript)

    # 3. Stratégie selon la taille
    if total_chars <= SHORT_VIDEO_TRANSCRIPT_LIMIT:
        # Court → transcript complet
        return full_transcript, "full", total_chars

    elif total_chars <= MEDIUM_VIDEO_TRANSCRIPT_LIMIT:
        # Moyen → full_digest prioritaire + segments clés du transcript
        # On prend le début et la fin du transcript + quelques segments milieu
        segments = _extract_key_segments(full_transcript, target_chars=20_000)
        return segments, "digest_plus_segments", total_chars

    else:
        # Long → full_digest uniquement + intro/conclusion du transcript
        intro = full_transcript[:5_000]
        conclusion = full_transcript[-5_000:]
        combined = (
            f"[Début du transcript — {total_chars:,} caractères au total]\n"
            f"{intro}\n\n"
            f"[…]\n\n"
            f"[Fin du transcript]\n"
            f"{conclusion}"
        )
        return combined, "digest_only", total_chars


async def _get_full_transcript_from_cache(
    video_id: str,
    db: AsyncSession,
) -> str:
    """Récupère le transcript complet depuis TranscriptCache + chunks."""
    if not video_id:
        return ""

    try:
        result = await db.execute(
            select(TranscriptCache).where(TranscriptCache.video_id == video_id)
        )
        cache_entry = result.scalar_one_or_none()

        if not cache_entry:
            return ""

        # Charger tous les chunks ordonnés
        chunks_result = await db.execute(
            select(TranscriptCacheChunk)
            .where(TranscriptCacheChunk.cache_id == cache_entry.id)
            .order_by(TranscriptCacheChunk.chunk_index)
        )
        chunks = chunks_result.scalars().all()

        if not chunks:
            return ""

        # Assembler le transcript (préférer timestamped, fallback simple)
        parts = []
        for chunk in chunks:
            text = chunk.transcript_timestamped or chunk.transcript_simple or ""
            if text:
                parts.append(text)

        return "\n".join(parts)

    except Exception as e:
        logger.warning("Failed to load transcript from cache: %s", e)
        return ""


def _extract_key_segments(transcript: str, target_chars: int = 20_000) -> str:
    """
    Extrait les segments clés d'un transcript moyen.
    Prend le début, quelques segments du milieu, et la fin.
    """
    total = len(transcript)
    if total <= target_chars:
        return transcript

    # Répartition : 40% début, 30% milieu, 30% fin
    intro_size = int(target_chars * 0.4)
    middle_size = int(target_chars * 0.3)
    outro_size = int(target_chars * 0.3)

    intro = transcript[:intro_size]

    # Milieu : prendre un segment au centre
    mid_start = (total - middle_size) // 2
    middle = transcript[mid_start:mid_start + middle_size]

    outro = transcript[-outro_size:]

    return (
        f"{intro}\n\n"
        f"[… passage au milieu du transcript …]\n\n"
        f"{middle}\n\n"
        f"[… fin du transcript …]\n\n"
        f"{outro}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Extracteurs de données enrichies
# ═══════════════════════════════════════════════════════════════════════════════

def _extract_fact_check(summary: Summary) -> str:
    """Extrait les résultats de fact-check depuis le Summary."""
    # Essayer d'abord full_digest JSON
    if summary.full_digest:
        try:
            digest_data = json.loads(summary.full_digest)
            fc = digest_data.get("fact_check")
            if fc:
                if isinstance(fc, dict):
                    return json.dumps(fc, ensure_ascii=False, indent=2)[:MAX_FACT_CHECK_CHARS]
                return str(fc)[:MAX_FACT_CHECK_CHARS]
        except (json.JSONDecodeError, TypeError):
            pass

    # Fallback : champ dédié
    if summary.fact_check_result:
        try:
            fc_data = json.loads(summary.fact_check_result)
            if isinstance(fc_data, dict):
                return json.dumps(fc_data, ensure_ascii=False, indent=2)[:MAX_FACT_CHECK_CHARS]
            return str(fc_data)[:MAX_FACT_CHECK_CHARS]
        except (json.JSONDecodeError, TypeError):
            return str(summary.fact_check_result)[:MAX_FACT_CHECK_CHARS]

    return ""


def _extract_enrichment_sources(summary: Summary) -> str:
    """Extrait les sources d'enrichissement web (deep research)."""
    if not summary.enrichment_sources:
        return ""

    try:
        sources = json.loads(summary.enrichment_sources)
        if isinstance(sources, list):
            parts = []
            for src in sources[:8]:
                if isinstance(src, dict):
                    title = src.get("title", "")
                    url = src.get("url", "")
                    snippet = src.get("snippet", "")
                    parts.append(f"- {title}: {snippet}" if snippet else f"- {title} ({url})")
                else:
                    parts.append(f"- {src}")
            return "\n".join(parts)[:MAX_ENRICHMENT_CHARS]
        return str(sources)[:MAX_ENRICHMENT_CHARS]
    except (json.JSONDecodeError, TypeError):
        return str(summary.enrichment_sources)[:MAX_ENRICHMENT_CHARS]


def _extract_enrichment_data(summary: Summary) -> str:
    """Extrait les données d'enrichissement (niveau, metadata)."""
    if not summary.enrichment_data:
        return ""

    try:
        data = json.loads(summary.enrichment_data)
        if isinstance(data, dict):
            level = data.get("level", "")
            enriched_at = data.get("enriched_at", "")
            sources_count = len(data.get("sources", []))
            # Extraire le contenu enrichi s'il existe
            enriched_content = data.get("enriched_content", "")
            if enriched_content:
                return f"Niveau: {level}, Sources: {sources_count}\n{enriched_content}"[:MAX_ENRICHMENT_CHARS]
            return f"Niveau: {level}, Sources: {sources_count}, Date: {enriched_at}"
        return ""
    except (json.JSONDecodeError, TypeError):
        return ""


def _extract_entities(summary: Summary) -> str:
    """Extrait les entités extraites (personnes, organisations, concepts)."""
    if not summary.entities_extracted:
        return ""

    try:
        entities = json.loads(summary.entities_extracted)
        if isinstance(entities, dict):
            parts = []
            for entity_type, items in entities.items():
                if isinstance(items, list) and items:
                    items_str = ", ".join(str(i) for i in items[:10])
                    parts.append(f"{entity_type}: {items_str}")
            return "\n".join(parts)[:MAX_ENTITIES_CHARS]
        elif isinstance(entities, list):
            return ", ".join(str(e) for e in entities[:20])[:MAX_ENTITIES_CHARS]
        return str(entities)[:MAX_ENTITIES_CHARS]
    except (json.JSONDecodeError, TypeError):
        return str(summary.entities_extracted)[:MAX_ENTITIES_CHARS]


async def _load_academic_papers(summary_id: int, db: AsyncSession) -> list[dict]:
    """Charge les papiers académiques liés à cette analyse."""
    try:
        result = await db.execute(
            select(AcademicPaper)
            .where(AcademicPaper.summary_id == summary_id)
            .order_by(AcademicPaper.relevance_score.desc())
            .limit(MAX_ACADEMIC_PAPERS)
        )
        papers = result.scalars().all()

        return [
            {
                "title": p.title or "Sans titre",
                "source": p.source or "inconnu",
                "abstract": (p.abstract or "")[:300],
                "authors": p.authors or "",
                "year": p.year or "",
            }
            for p in papers
        ]
    except Exception as e:
        logger.warning("Failed to load academic papers: %s", e)
        return []


# ═══════════════════════════════════════════════════════════════════════════════
# Formatage du contexte pour injection dans un prompt
# ═══════════════════════════════════════════════════════════════════════════════

def _format_context(
    ctx: RichContext,
    max_chars: int,
    language: str = "fr",
    mode: str = "voice",
) -> str:
    """
    Formate le RichContext en texte structuré pour injection dans un prompt.
    Respecte la limite de caractères en élaguant les sections les moins critiques.
    """
    sections: list[str] = []
    is_fr = language == "fr"

    # ── Section 1 : Métadonnées (toujours incluses) ─────────────────────
    meta_title = "## Vidéo analysée" if is_fr else "## Analyzed video"
    meta_parts = [meta_title]
    meta_parts.append(f"Titre : {ctx.video_title}" if is_fr else f"Title: {ctx.video_title}")
    meta_parts.append(f"Chaîne : {ctx.channel_name}" if is_fr else f"Channel: {ctx.channel_name}")
    meta_parts.append(f"Plateforme : {ctx.platform}" if is_fr else f"Platform: {ctx.platform}")
    meta_parts.append(f"Durée : {ctx.duration_str}" if is_fr else f"Duration: {ctx.duration_str}")

    if ctx.upload_date:
        meta_parts.append(f"Date de publication : {ctx.upload_date}" if is_fr else f"Published: {ctx.upload_date}")
    if ctx.category:
        meta_parts.append(f"Catégorie : {ctx.category}" if is_fr else f"Category: {ctx.category}")
    if ctx.tags:
        meta_parts.append(f"Tags : {ctx.tags}" if is_fr else f"Tags: {ctx.tags}")
    if ctx.video_url:
        meta_parts.append(f"URL : {ctx.video_url}" if is_fr else f"URL: {ctx.video_url}")

    sections.append("\n".join(meta_parts))

    # ── Section 2 : Analyse complète (priorité haute) ───────────────────
    if ctx.summary_content:
        header = "## Analyse DeepSight complète" if is_fr else "## Full DeepSight Analysis"
        sections.append(f"{header}\n{ctx.summary_content}")

    # ── Section 3 : Full Digest (si disponible et différent du summary) ─
    if ctx.full_digest and ctx.full_digest != ctx.summary_content:
        # Vérifier si c'est du JSON ou du texte
        digest_text = ctx.full_digest
        try:
            digest_data = json.loads(ctx.full_digest)
            if isinstance(digest_data, dict):
                # Extraire les parties intéressantes
                parts = []
                for key in ["overview", "key_findings", "analysis", "sources", "fact_check"]:
                    if key in digest_data:
                        val = digest_data[key]
                        if isinstance(val, str):
                            parts.append(f"### {key}\n{val}")
                        elif isinstance(val, list):
                            items = "\n".join(f"- {i}" for i in val[:10])
                            parts.append(f"### {key}\n{items}")
                        elif isinstance(val, dict):
                            parts.append(f"### {key}\n{json.dumps(val, ensure_ascii=False, indent=1)}")
                if parts:
                    digest_text = "\n\n".join(parts)
        except (json.JSONDecodeError, TypeError):
            pass

        header = "## Digest approfondi" if is_fr else "## Deep Digest"
        sections.append(f"{header}\n{digest_text}")

    # ── Section 4 : Fact-check (priorité haute) ─────────────────────────
    if ctx.fact_check:
        header = "## Vérification des faits" if is_fr else "## Fact-check"
        score_str = ""
        if ctx.reliability_score is not None:
            score_str = f"\nScore de fiabilité : {ctx.reliability_score}/10" if is_fr else f"\nReliability score: {ctx.reliability_score}/10"
        sections.append(f"{header}{score_str}\n{ctx.fact_check}")
    elif ctx.reliability_score is not None:
        header = "## Fiabilité" if is_fr else "## Reliability"
        sections.append(f"{header}\nScore : {ctx.reliability_score}/10")

    # ── Section 5 : Sources d'enrichissement web ────────────────────────
    if ctx.enrichment_sources:
        header = "## Recherches complémentaires" if is_fr else "## Web Research"
        sections.append(f"{header}\n{ctx.enrichment_sources}")

    # ── Section 6 : Papiers académiques ─────────────────────────────────
    if ctx.academic_papers:
        header = "## Références académiques" if is_fr else "## Academic References"
        paper_lines = []
        for p in ctx.academic_papers:
            line = f"- {p['title']}"
            if p.get("authors"):
                line += f" ({p['authors']})"
            if p.get("year"):
                line += f" [{p['year']}]"
            if p.get("abstract"):
                line += f" — {p['abstract']}"
            paper_lines.append(line)
        sections.append(f"{header}\n" + "\n".join(paper_lines))

    # ── Section 7 : Entités extraites ───────────────────────────────────
    if ctx.entities:
        header = "## Entités mentionnées" if is_fr else "## Mentioned entities"
        sections.append(f"{header}\n{ctx.entities}")

    # ── Section 8 : Transcript (priorité variable selon stratégie) ──────
    if ctx.transcript:
        if ctx.transcript_strategy == "full":
            header_label = (
                f"## Transcript complet ({ctx.transcript_total_chars:,} caractères)"
                if is_fr else
                f"## Full transcript ({ctx.transcript_total_chars:,} characters)"
            )
        elif ctx.transcript_strategy == "digest_plus_segments":
            header_label = (
                f"## Segments clés du transcript ({ctx.transcript_total_chars:,} caractères au total)"
                if is_fr else
                f"## Key transcript segments ({ctx.transcript_total_chars:,} total characters)"
            )
        else:
            header_label = (
                f"## Extraits du transcript ({ctx.transcript_total_chars:,} caractères au total)"
                if is_fr else
                f"## Transcript excerpts ({ctx.transcript_total_chars:,} total characters)"
            )

        sections.append(f"{header_label}\n{ctx.transcript}")

    # ── Assemblage final avec respect de la limite ──────────────────────
    return _assemble_with_limit(sections, max_chars)


def _assemble_with_limit(sections: list[str], max_chars: int) -> str:
    """
    Assemble les sections en respectant la limite de caractères.
    Élague les sections les moins prioritaires si nécessaire.

    Priorité (de la plus haute à la plus basse) :
    1. Métadonnées (section 0)
    2. Analyse (section 1)
    3. Transcript (dernière section)
    4. Fact-check (section ~3)
    5. Full Digest (section ~2)
    6. Sources web (section ~4)
    7. Papiers académiques (section ~5)
    8. Entités (section ~6)
    """
    full = "\n\n".join(sections)
    if len(full) <= max_chars:
        return full

    # Trop long → élaguer les sections de faible priorité
    # On essaie de garder : métadonnées + analyse + transcript + fact-check
    result_parts: list[str] = []
    remaining = max_chars

    for i, section in enumerate(sections):
        if len(section) <= remaining:
            result_parts.append(section)
            remaining -= len(section) + 2  # +2 pour "\n\n"
        else:
            # Tronquer cette section si c'est important (les premières et la dernière)
            if i <= 1 or i == len(sections) - 1:
                truncated = section[:remaining - 50]
                # Couper proprement à la dernière fin de ligne
                last_nl = truncated.rfind("\n")
                if last_nl > len(truncated) // 2:
                    truncated = truncated[:last_nl]
                truncated += "\n\n[… tronqué pour respecter la limite de contexte]"
                result_parts.append(truncated)
                remaining = 0
            # Sinon, on skip la section entièrement
            continue

        if remaining <= 0:
            break

    return "\n\n".join(result_parts)


# ═══════════════════════════════════════════════════════════════════════════════
# Utilitaires
# ═══════════════════════════════════════════════════════════════════════════════

def _format_duration(seconds: int) -> str:
    """Formate une durée en secondes en string lisible."""
    if not seconds:
        return "inconnue"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}h{minutes:02d}min{secs:02d}s"
    return f"{minutes}min{secs:02d}s"
