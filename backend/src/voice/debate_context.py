"""
Debate Voice Context — Assembleur de contexte pour l'agent vocal Modérateur de débat.

Agrège les données d'une DebateAnalysis (2 vidéos, thèses, arguments, convergences,
divergences, fact-check, synthèse) et optionnellement les transcripts des 2 vidéos,
puis formate le tout pour injection dans le system prompt ElevenLabs.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from db.database import DebateAnalysis

logger = logging.getLogger(__name__)


# Budgets (en caractères) pour le format vocal. L'agent débat reçoit plus
# que l'agent "explorer" car il doit jongler avec 2 vidéos.
MAX_CONTEXT_DEBATE_VOICE = 16_000

# Sous-budgets (somme ≈ MAX_CONTEXT_DEBATE_VOICE)
BUDGET_HEADER = 400
BUDGET_THESES = 1_600
BUDGET_ARGUMENTS_PER_VIDEO = 2_500
BUDGET_CONVERGENCE = 1_000
BUDGET_DIVERGENCE = 2_000
BUDGET_FACT_CHECK = 2_000
BUDGET_SUMMARY = 2_000
BUDGET_TRANSCRIPT_PER_VIDEO = 1_500  # Dégradé — on préfère digest + thèses


def _safe_json_list(value: Optional[str]) -> list:
    """Parse un champ JSON texte, retourne [] si invalide."""
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            # Certains debates encapsulent dans {"claims": [...]}
            for key in ("claims", "items", "list"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
        return []
    except (json.JSONDecodeError, TypeError):
        return []


def _truncate(text: str, max_chars: int, suffix: str = " [...]") -> str:
    """Tronque proprement un texte à max_chars, avec suffixe de troncature."""
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    cut = max_chars - len(suffix)
    if cut < 1:
        return text[:max_chars]
    return text[:cut].rstrip() + suffix


@dataclass
class _Labels:
    """Labels localisés FR/EN pour le format vocal."""
    fr: bool = True

    @property
    def topic(self) -> str: return "SUJET DU DÉBAT" if self.fr else "DEBATE TOPIC"
    @property
    def video_a(self) -> str: return "VIDÉO A" if self.fr else "VIDEO A"
    @property
    def video_b(self) -> str: return "VIDÉO B" if self.fr else "VIDEO B"
    @property
    def title(self) -> str: return "Titre" if self.fr else "Title"
    @property
    def channel(self) -> str: return "Chaîne" if self.fr else "Channel"
    @property
    def theses(self) -> str: return "THÈSES" if self.fr else "THESES"
    @property
    def thesis(self) -> str: return "Thèse" if self.fr else "Thesis"
    @property
    def arguments(self) -> str: return "ARGUMENTS" if self.fr else "ARGUMENTS"
    @property
    def convergence(self) -> str: return "POINTS DE CONVERGENCE" if self.fr else "POINTS OF CONVERGENCE"
    @property
    def divergence(self) -> str: return "POINTS DE DIVERGENCE" if self.fr else "POINTS OF DIVERGENCE"
    @property
    def fact_check(self) -> str: return "FACT-CHECK" if self.fr else "FACT-CHECK"
    @property
    def summary(self) -> str: return "SYNTHÈSE DU DÉBAT" if self.fr else "DEBATE SUMMARY"
    @property
    def transcript_a(self) -> str: return "TRANSCRIPT VIDÉO A" if self.fr else "VIDEO A TRANSCRIPT"
    @property
    def transcript_b(self) -> str: return "TRANSCRIPT VIDÉO B" if self.fr else "VIDEO B TRANSCRIPT"
    @property
    def strong(self) -> str: return "fort" if self.fr else "strong"
    @property
    def moderate(self) -> str: return "modéré" if self.fr else "moderate"
    @property
    def weak(self) -> str: return "faible" if self.fr else "weak"


def _format_arguments(args: list[dict], max_chars: int, L: _Labels) -> str:
    """Formate une liste d'arguments en markdown vocalisable."""
    if not args:
        return "(aucun argument extrait)" if L.fr else "(no argument extracted)"
    parts: list[str] = []
    for i, arg in enumerate(args[:8], start=1):
        if not isinstance(arg, dict):
            parts.append(f"{i}. {str(arg)}")
            continue
        claim = arg.get("claim", "?")
        evidence = arg.get("evidence", "")
        strength_raw = (arg.get("strength") or "").lower()
        strength_label = {
            "strong": L.strong, "moderate": L.moderate, "weak": L.weak,
            "fort": L.strong, "modéré": L.moderate, "faible": L.weak,
        }.get(strength_raw, strength_raw)
        suffix = f" — [{strength_label}]" if strength_label else ""
        body = f"{i}. **{claim}**{suffix}"
        if evidence:
            body += f"\n   {evidence}"
        parts.append(body)
    return _truncate("\n".join(parts), max_chars)


@dataclass
class DebateRichContext:
    """Contexte débat assemblé, prêt à être formaté pour ElevenLabs."""

    debate_id: int
    topic: str = ""
    lang: str = "fr"

    # Vidéo A
    video_a_id: str = ""
    video_a_title: str = ""
    video_a_channel: str = ""
    platform_a: str = "youtube"
    thesis_a: str = ""
    arguments_a: list[dict] = field(default_factory=list)
    transcript_a: str = ""

    # Vidéo B
    video_b_id: str = ""
    video_b_title: str = ""
    video_b_channel: str = ""
    platform_b: str = "youtube"
    thesis_b: str = ""
    arguments_b: list[dict] = field(default_factory=list)
    transcript_b: str = ""

    # Analyse comparative
    convergence_points: list = field(default_factory=list)
    divergence_points: list[dict] = field(default_factory=list)
    fact_check: list[dict] = field(default_factory=list)
    debate_summary: str = ""

    def format_for_voice(
        self, language: str = "fr", max_chars: int = MAX_CONTEXT_DEBATE_VOICE
    ) -> str:
        """Formate le contexte complet pour le system prompt vocal ElevenLabs."""
        fr = language != "en"
        L = _Labels(fr)

        lines: list[str] = []

        # Header — sujet + métadonnées des 2 vidéos
        lines.append(f"## {L.topic} : {self.topic}")
        lines.append("")
        lines.append(f"### {L.video_a}")
        lines.append(f"{L.title} : {self.video_a_title}")
        lines.append(f"{L.channel} : {self.video_a_channel}")
        lines.append("")
        lines.append(f"### {L.video_b}")
        lines.append(f"{L.title} : {self.video_b_title}")
        lines.append(f"{L.channel} : {self.video_b_channel}")
        lines.append("")

        # Thèses
        lines.append(f"## {L.theses}")
        lines.append(
            f"**{L.video_a} — {L.thesis}** : {_truncate(self.thesis_a, BUDGET_THESES // 2)}"
        )
        lines.append(
            f"**{L.video_b} — {L.thesis}** : {_truncate(self.thesis_b, BUDGET_THESES // 2)}"
        )
        lines.append("")

        # Arguments A
        lines.append(f"## {L.arguments} — {L.video_a}")
        lines.append(_format_arguments(self.arguments_a, BUDGET_ARGUMENTS_PER_VIDEO, L))
        lines.append("")

        # Arguments B
        lines.append(f"## {L.arguments} — {L.video_b}")
        lines.append(_format_arguments(self.arguments_b, BUDGET_ARGUMENTS_PER_VIDEO, L))
        lines.append("")

        # Convergences
        if self.convergence_points:
            lines.append(f"## {L.convergence}")
            conv_text = "\n".join(
                f"- {str(p)}" for p in self.convergence_points[:10]
            )
            lines.append(_truncate(conv_text, BUDGET_CONVERGENCE))
            lines.append("")

        # Divergences
        if self.divergence_points:
            lines.append(f"## {L.divergence}")
            div_parts: list[str] = []
            for d in self.divergence_points[:8]:
                if isinstance(d, dict):
                    topic_d = d.get("topic", "?")
                    pos_a = d.get("position_a", "")
                    pos_b = d.get("position_b", "")
                    div_parts.append(
                        f"- **{topic_d}** — {L.video_a} : {pos_a} / {L.video_b} : {pos_b}"
                    )
                else:
                    div_parts.append(f"- {str(d)}")
            lines.append(_truncate("\n".join(div_parts), BUDGET_DIVERGENCE))
            lines.append("")

        # Fact-check
        if self.fact_check:
            lines.append(f"## {L.fact_check}")
            fc_parts: list[str] = []
            for item in self.fact_check[:8]:
                if isinstance(item, dict):
                    claim = item.get("claim", "?")
                    verdict = item.get("verdict", "?")
                    explanation = item.get("explanation", "")
                    fc_parts.append(f"- [{verdict.upper()}] {claim} — {explanation}")
            lines.append(_truncate("\n".join(fc_parts), BUDGET_FACT_CHECK))
            lines.append("")

        # Synthèse
        if self.debate_summary:
            lines.append(f"## {L.summary}")
            lines.append(_truncate(self.debate_summary, BUDGET_SUMMARY))
            lines.append("")

        # Transcripts (optionnels, injectés seulement si présents et budget restant)
        if self.transcript_a or self.transcript_b:
            used = sum(len(l) for l in lines)
            remaining = max(0, max_chars - used - BUDGET_HEADER)
            per_video_budget = max(0, min(BUDGET_TRANSCRIPT_PER_VIDEO, remaining // 2))
            if per_video_budget > 200:
                if self.transcript_a:
                    lines.append(f"## {L.transcript_a}")
                    lines.append(_truncate(self.transcript_a, per_video_budget))
                    lines.append("")
                if self.transcript_b:
                    lines.append(f"## {L.transcript_b}")
                    lines.append(_truncate(self.transcript_b, per_video_budget))
                    lines.append("")

        text = "\n".join(lines)
        return _truncate(text, max_chars)


async def _load_transcript_safely(video_id: str, db: AsyncSession) -> str:
    """Charge le transcript depuis TranscriptCache, retourne '' si indisponible."""
    if not video_id:
        return ""
    try:
        from chat.context_builder import _get_full_transcript_from_cache
        transcript = await _get_full_transcript_from_cache(video_id, db)
        return transcript or ""
    except Exception as exc:
        logger.warning("debate_context: transcript load failed for %s: %s", video_id, exc)
        return ""


async def build_debate_rich_context(
    debate: DebateAnalysis,
    db: AsyncSession,
    include_transcripts: bool = True,
) -> DebateRichContext:
    """
    Assemble le contexte vocal complet à partir d'une DebateAnalysis.

    Args:
        debate: Ligne debate_analyses (statut completed attendu).
        db: Session DB async pour charger les transcripts depuis TranscriptCache.
        include_transcripts: Si True, tente de charger les transcripts des 2 vidéos.
    """
    ctx = DebateRichContext(
        debate_id=debate.id,
        topic=debate.detected_topic or "",
        lang=debate.lang or "fr",
        video_a_id=debate.video_a_id or "",
        video_a_title=debate.video_a_title or "",
        video_a_channel=debate.video_a_channel or "",
        platform_a=debate.platform_a or "youtube",
        thesis_a=debate.thesis_a or "",
        arguments_a=_safe_json_list(debate.arguments_a),
        video_b_id=debate.video_b_id or "",
        video_b_title=debate.video_b_title or "",
        video_b_channel=debate.video_b_channel or "",
        platform_b=debate.platform_b or "youtube",
        thesis_b=debate.thesis_b or "",
        arguments_b=_safe_json_list(debate.arguments_b),
        convergence_points=_safe_json_list(debate.convergence_points),
        divergence_points=_safe_json_list(debate.divergence_points),
        fact_check=_safe_json_list(debate.fact_check_results),
        debate_summary=debate.debate_summary or "",
    )

    if include_transcripts:
        # Chargement parallèle des 2 transcripts
        import asyncio
        transcript_a, transcript_b = await asyncio.gather(
            _load_transcript_safely(ctx.video_a_id, db),
            _load_transcript_safely(ctx.video_b_id, db),
            return_exceptions=False,
        )
        ctx.transcript_a = transcript_a
        ctx.transcript_b = transcript_b

    logger.info(
        "debate_context.built",
        extra={
            "debate_id": debate.id,
            "topic": ctx.topic[:50],
            "arguments_a_count": len(ctx.arguments_a),
            "arguments_b_count": len(ctx.arguments_b),
            "convergence_count": len(ctx.convergence_points),
            "divergence_count": len(ctx.divergence_points),
            "fact_check_count": len(ctx.fact_check),
            "transcript_a_chars": len(ctx.transcript_a),
            "transcript_b_chars": len(ctx.transcript_b),
        },
    )

    return ctx
