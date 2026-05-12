"""
Debate Voice Context — Assembleur de contexte pour l'agent vocal Modérateur de débat (v2).

v2 — N perspectives (1 vidéo A + 1 à N vidéos B avec relation_type ∈ {opposite, complement, nuance}).
Backward-compat : pour les debates pré-v2 (table `debate_perspectives` absente ou vide), on
synthétise une perspective implicite position=0 relation='opposite' depuis les colonnes
`debate_analyses.video_b_*` historiques. Cf. spec §8.

Agrège les données d'une DebateAnalysis (1 vidéo A + N perspectives, thèses, arguments,
convergences, divergences, fact-check, synthèse) et optionnellement les transcripts,
puis formate le tout pour injection dans le system prompt ElevenLabs.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import DebateAnalysis

logger = logging.getLogger(__name__)


# Budgets (en caractères) pour le format vocal. L'agent débat reçoit plus
# que l'agent "explorer" car il doit jongler avec plusieurs vidéos.
MAX_CONTEXT_DEBATE_VOICE = 16_000

# Sous-budgets — partagés entre la vidéo A et l'ensemble des perspectives B.
BUDGET_HEADER = 400
BUDGET_THESES = 1_600
BUDGET_ARGUMENTS_VIDEO_A = 2_500
BUDGET_ARGUMENTS_PERSPECTIVES_TOTAL = 2_500  # Splitté entre les N perspectives
BUDGET_CONVERGENCE = 1_000
BUDGET_DIVERGENCE = 2_000
BUDGET_FACT_CHECK = 2_000
BUDGET_SUMMARY = 2_000
BUDGET_TRANSCRIPT_VIDEO_A = 1_500
BUDGET_TRANSCRIPT_PERSPECTIVES_TOTAL = 1_500  # Splitté entre les N perspectives


# Relation type ↔ libellés FR/EN
RELATION_LABELS = {
    "fr": {
        "opposite": "opposition",
        "complement": "complément",
        "nuance": "nuance",
    },
    "en": {
        "opposite": "opposition",
        "complement": "complement",
        "nuance": "nuance",
    },
}


def _safe_json_list(value) -> list:
    """Parse un champ JSON (texte ou déjà list/dict), retourne [] si invalide."""
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        for key in ("claims", "items", "list"):
            if key in value and isinstance(value[key], list):
                return value[key]
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict):
            for key in ("claims", "items", "list"):
                if key in parsed and isinstance(parsed[key], list):
                    return parsed[key]
        return []
    except (json.JSONDecodeError, TypeError):
        return []


def _truncate(text_value: str, max_chars: int, suffix: str = " [...]") -> str:
    """Tronque proprement un texte à max_chars, avec suffixe de troncature."""
    if not text_value:
        return ""
    if len(text_value) <= max_chars:
        return text_value
    cut = max_chars - len(suffix)
    if cut < 1:
        return text_value[:max_chars]
    return text_value[:cut].rstrip() + suffix


def _normalize_relation(value: Optional[str]) -> str:
    """Normalise relation_type vers une des 3 valeurs canoniques."""
    if not value:
        return "opposite"
    v = str(value).strip().lower()
    if v in ("opposite", "opposition", "oppose"):
        return "opposite"
    if v in ("complement", "complementary", "complément", "complementaire"):
        return "complement"
    if v in ("nuance", "nuanced", "nuancé"):
        return "nuance"
    return "opposite"


def _compute_dominant_relation(perspectives: list["PerspectiveCtx"]) -> str:
    """
    Détermine la relation_type dominante. Priorité en cas d'égalité :
    opposite > complement > nuance (cf. spec §2.1).
    """
    if not perspectives:
        return "opposite"
    counts: dict[str, int] = {"opposite": 0, "complement": 0, "nuance": 0}
    for p in perspectives:
        rel = _normalize_relation(p.relation_type)
        counts[rel] = counts.get(rel, 0) + 1
    # Tri par count décroissant + ordre de priorité comme tie-breaker
    priority_order = ["opposite", "complement", "nuance"]
    sorted_relations = sorted(
        priority_order,
        key=lambda r: (-counts[r], priority_order.index(r)),
    )
    return sorted_relations[0]


@dataclass
class _Labels:
    """Labels localisés FR/EN pour le format vocal."""

    fr: bool = True

    @property
    def topic(self) -> str:
        return "SUJET DU DÉBAT" if self.fr else "DEBATE TOPIC"

    @property
    def topic_perspectives(self) -> str:
        return "SUJET" if self.fr else "TOPIC"

    @property
    def video_a(self) -> str:
        return "VIDÉO A" if self.fr else "VIDEO A"

    @property
    def perspectives_section(self) -> str:
        return "PERSPECTIVES" if self.fr else "PERSPECTIVES"

    @property
    def perspective_singular(self) -> str:
        return "Perspective" if self.fr else "Perspective"

    @property
    def title(self) -> str:
        return "Titre" if self.fr else "Title"

    @property
    def channel(self) -> str:
        return "Chaîne" if self.fr else "Channel"

    @property
    def relation(self) -> str:
        return "Relation" if self.fr else "Relation"

    @property
    def theses(self) -> str:
        return "THÈSES" if self.fr else "THESES"

    @property
    def thesis(self) -> str:
        return "Thèse" if self.fr else "Thesis"

    @property
    def arguments(self) -> str:
        return "ARGUMENTS" if self.fr else "ARGUMENTS"

    @property
    def convergence(self) -> str:
        return "POINTS DE CONVERGENCE" if self.fr else "POINTS OF CONVERGENCE"

    @property
    def divergence(self) -> str:
        return "POINTS DE DIVERGENCE" if self.fr else "POINTS OF DIVERGENCE"

    @property
    def fact_check(self) -> str:
        return "FACT-CHECK" if self.fr else "FACT-CHECK"

    @property
    def summary(self) -> str:
        return "SYNTHÈSE DU DÉBAT" if self.fr else "DEBATE SUMMARY"

    @property
    def summary_perspectives(self) -> str:
        return "SYNTHÈSE GLOBALE" if self.fr else "GLOBAL SUMMARY"

    @property
    def transcript_a(self) -> str:
        return "TRANSCRIPT VIDÉO A" if self.fr else "VIDEO A TRANSCRIPT"

    @property
    def transcript_perspective(self) -> str:
        return "TRANSCRIPT" if self.fr else "TRANSCRIPT"

    @property
    def strong(self) -> str:
        return "fort" if self.fr else "strong"

    @property
    def moderate(self) -> str:
        return "modéré" if self.fr else "moderate"

    @property
    def weak(self) -> str:
        return "faible" if self.fr else "weak"

    @property
    def dominant_label(self) -> str:
        return "Relation dominante" if self.fr else "Dominant relation"


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
            "strong": L.strong,
            "moderate": L.moderate,
            "weak": L.weak,
            "fort": L.strong,
            "modéré": L.moderate,
            "faible": L.weak,
        }.get(strength_raw, strength_raw)
        suffix = f" — [{strength_label}]" if strength_label else ""
        body = f"{i}. **{claim}**{suffix}"
        if evidence:
            body += f"\n   {evidence}"
        parts.append(body)
    return _truncate("\n".join(parts), max_chars)


def _format_relation_human(relation_type: str, lang: str) -> str:
    """Renvoie le label humain de la relation pour vocalisation."""
    fr = lang != "en"
    labels = RELATION_LABELS["fr" if fr else "en"]
    return labels.get(_normalize_relation(relation_type), relation_type or "?")


@dataclass
class PerspectiveCtx:
    """Une perspective (vidéo B-i) dans un débat v2."""

    position: int = 0
    relation_type: str = "opposite"
    perspective_id: int = -1  # -1 = perspective virtuelle (fallback v1)
    video_id: str = ""
    video_title: str = ""
    video_channel: str = ""
    platform: str = "youtube"
    thesis: str = ""
    arguments: list[dict] = field(default_factory=list)
    transcript: str = ""
    audience_level: str = "unknown"
    channel_quality_score: float = 0.0


@dataclass
class DebateRichContext:
    """Contexte débat assemblé v2, prêt à être formaté pour ElevenLabs."""

    debate_id: int
    topic: str = ""
    lang: str = "fr"

    # Vidéo A (l'ancrage)
    video_a_id: str = ""
    video_a_title: str = ""
    video_a_channel: str = ""
    platform_a: str = "youtube"
    thesis_a: str = ""
    arguments_a: list[dict] = field(default_factory=list)
    transcript_a: str = ""

    # Vidéo B(s) en v2 — N perspectives (≥1, max 3)
    perspectives: list[PerspectiveCtx] = field(default_factory=list)

    # Relation dominante (calculée à la construction)
    relation_type_dominant: str = "opposite"

    # Analyse comparative (globale)
    convergence_points: list = field(default_factory=list)
    divergence_points: list[dict] = field(default_factory=list)
    fact_check: list[dict] = field(default_factory=list)
    debate_summary: str = ""

    # ─────────────────────────────────────────────────────────────────────
    # Backward-compat properties — exposent video_b_* à partir de la 1ère
    # perspective. Les anciens tests qui lisaient ctx.video_b_title continuent
    # de marcher tant qu'il y a au moins 1 perspective.
    # ─────────────────────────────────────────────────────────────────────
    @property
    def video_b_id(self) -> str:
        return self.perspectives[0].video_id if self.perspectives else ""

    @property
    def video_b_title(self) -> str:
        return self.perspectives[0].video_title if self.perspectives else ""

    @property
    def video_b_channel(self) -> str:
        return self.perspectives[0].video_channel if self.perspectives else ""

    @property
    def platform_b(self) -> str:
        return self.perspectives[0].platform if self.perspectives else "youtube"

    @property
    def thesis_b(self) -> str:
        return self.perspectives[0].thesis if self.perspectives else ""

    @property
    def arguments_b(self) -> list[dict]:
        return self.perspectives[0].arguments if self.perspectives else []

    @property
    def transcript_b(self) -> str:
        return self.perspectives[0].transcript if self.perspectives else ""

    def format_for_voice(self, language: str = "fr", max_chars: int = MAX_CONTEXT_DEBATE_VOICE) -> str:
        """
        Formate le contexte complet pour le system prompt vocal ElevenLabs (v2).

        Header dynamique :
        - Si 1 perspective ('opposite') : « Débat IA » classique (vidéo A vs vidéo B).
        - Si plusieurs OU dominant != opposite : « N perspectives sur le sujet... »
          avec mention explicite des relation_types présents.
        """
        fr = language != "en"
        L = _Labels(fr)
        n = len(self.perspectives)

        lines: list[str] = []

        # ── Header — sujet + dominante ──────────────────────────────────
        is_classic_debate = n == 1 and _normalize_relation(self.perspectives[0].relation_type) == "opposite"

        if is_classic_debate:
            # Format historique : Débat IA classique (compat lecture)
            lines.append(f"## {L.topic} : {self.topic}")
            lines.append("")
            lines.append(f"### {L.video_a}")
            lines.append(f"{L.title} : {self.video_a_title}")
            lines.append(f"{L.channel} : {self.video_a_channel}")
            lines.append("")
            persp = self.perspectives[0]
            lines.append("### VIDÉO B" if fr else "### VIDEO B")
            lines.append(f"{L.title} : {persp.video_title}")
            lines.append(f"{L.channel} : {persp.video_channel}")
            lines.append("")
        else:
            # Format v2 multi-perspectives
            if fr:
                lines.append(f"## {L.topic_perspectives} : {self.topic}")
                lines.append("")
                lines.append(
                    f"Le débat compte {n + 1} perspectives au total : "
                    f"1 vidéo principale (vidéo A) + {n} perspective"
                    f"{'s ajoutées' if n > 1 else ' ajoutée'}."
                )
                lines.append(f"{L.dominant_label} : {_format_relation_human(self.relation_type_dominant, language)}.")
            else:
                lines.append(f"## {L.topic_perspectives} : {self.topic}")
                lines.append("")
                lines.append(
                    f"This debate has {n + 1} perspectives total: 1 main video "
                    f"(video A) + {n} added perspective{'s' if n > 1 else ''}."
                )
                lines.append(f"{L.dominant_label}: {_format_relation_human(self.relation_type_dominant, language)}.")
            lines.append("")
            lines.append(f"### {L.video_a}")
            lines.append(f"{L.title} : {self.video_a_title}")
            lines.append(f"{L.channel} : {self.video_a_channel}")
            lines.append("")
            lines.append(f"### {L.perspectives_section}")
            for p in self.perspectives:
                rel_human = _format_relation_human(p.relation_type, language)
                # Position 0-based en DB, on l'expose 1-based à l'agent.
                idx = p.position + 1
                lines.append(
                    f"- **{L.perspective_singular} {idx}** "
                    f"({L.relation} : {rel_human}) — "
                    f"{L.title} : {p.video_title} · "
                    f"{L.channel} : {p.video_channel}"
                )
            lines.append("")

        # ── Thèses ──────────────────────────────────────────────────────
        lines.append(f"## {L.theses}")
        thesis_a_truncated = _truncate(self.thesis_a, BUDGET_THESES // (n + 1) if n > 0 else BUDGET_THESES // 2)
        lines.append(f"**{L.video_a} — {L.thesis}** : {thesis_a_truncated}")
        for p in self.perspectives:
            rel_human = _format_relation_human(p.relation_type, language)
            label = (
                f"{L.perspective_singular} {p.position + 1} ({rel_human})"
                if not is_classic_debate
                else ("Vidéo B" if fr else "Video B")
            )
            thesis_p = _truncate(p.thesis, BUDGET_THESES // (n + 1) if n > 0 else BUDGET_THESES // 2)
            lines.append(f"**{label} — {L.thesis}** : {thesis_p}")
        lines.append("")

        # ── Arguments vidéo A ───────────────────────────────────────────
        lines.append(f"## {L.arguments} — {L.video_a}")
        lines.append(_format_arguments(self.arguments_a, BUDGET_ARGUMENTS_VIDEO_A, L))
        lines.append("")

        # ── Arguments par perspective ──────────────────────────────────
        per_persp_budget = max(500, BUDGET_ARGUMENTS_PERSPECTIVES_TOTAL // max(1, n))
        for p in self.perspectives:
            if is_classic_debate:
                title = "Vidéo B" if fr else "Video B"
            else:
                rel_human = _format_relation_human(p.relation_type, language)
                title = f"{L.perspective_singular} {p.position + 1} ({rel_human})"
            lines.append(f"## {L.arguments} — {title}")
            lines.append(_format_arguments(p.arguments, per_persp_budget, L))
            lines.append("")

        # ── Convergences ────────────────────────────────────────────────
        if self.convergence_points:
            lines.append(f"## {L.convergence}")
            conv_text = "\n".join(f"- {str(p)}" for p in self.convergence_points[:10])
            lines.append(_truncate(conv_text, BUDGET_CONVERGENCE))
            lines.append("")

        # ── Divergences ─────────────────────────────────────────────────
        if self.divergence_points:
            lines.append(f"## {L.divergence}")
            div_parts: list[str] = []
            for d in self.divergence_points[:8]:
                if isinstance(d, dict):
                    topic_d = d.get("topic", "?")
                    pos_a = d.get("position_a", "")
                    pos_b = d.get("position_b", "")
                    side_b_label = (
                        ("Vidéo B" if fr else "Video B") if is_classic_debate else (L.perspective_singular + " B")
                    )
                    div_parts.append(f"- **{topic_d}** — {L.video_a} : {pos_a} / {side_b_label} : {pos_b}")
                else:
                    div_parts.append(f"- {str(d)}")
            lines.append(_truncate("\n".join(div_parts), BUDGET_DIVERGENCE))
            lines.append("")

        # ── Fact-check ──────────────────────────────────────────────────
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

        # ── Synthèse globale ────────────────────────────────────────────
        if self.debate_summary:
            heading = L.summary if is_classic_debate else L.summary_perspectives
            lines.append(f"## {heading}")
            lines.append(_truncate(self.debate_summary, BUDGET_SUMMARY))
            lines.append("")

        # ── Transcripts (optionnels, budget restant) ────────────────────
        if self.transcript_a or any(p.transcript for p in self.perspectives):
            used = sum(len(line) for line in lines)
            remaining = max(0, max_chars - used - BUDGET_HEADER)
            video_a_budget = max(0, min(BUDGET_TRANSCRIPT_VIDEO_A, remaining // 2))
            persp_total_budget = max(0, min(BUDGET_TRANSCRIPT_PERSPECTIVES_TOTAL, remaining - video_a_budget))
            per_persp_transcript_budget = persp_total_budget // max(1, n) if n > 0 else 0

            if video_a_budget > 200 and self.transcript_a:
                lines.append(f"## {L.transcript_a}")
                lines.append(_truncate(self.transcript_a, video_a_budget))
                lines.append("")

            if per_persp_transcript_budget > 200:
                for p in self.perspectives:
                    if not p.transcript:
                        continue
                    if is_classic_debate:
                        title = "TRANSCRIPT VIDÉO B" if fr else "VIDEO B TRANSCRIPT"
                    else:
                        rel_human = _format_relation_human(p.relation_type, language)
                        title = f"{L.transcript_perspective} — {L.perspective_singular} {p.position + 1} ({rel_human})"
                    lines.append(f"## {title}")
                    lines.append(_truncate(p.transcript, per_persp_transcript_budget))
                    lines.append("")

        text_out = "\n".join(lines)
        return _truncate(text_out, max_chars)


# ═══════════════════════════════════════════════════════════════════════════════
# Loaders — perspectives v2 (raw SQL pour résilience à l'absence du model)
# ═══════════════════════════════════════════════════════════════════════════════


async def _load_perspectives_safe(debate_id: int, db: AsyncSession) -> list[dict]:
    """
    Charge les perspectives v2 si la table `debate_perspectives` existe,
    sinon retourne []. Le caller construit le fallback v1 depuis
    `debate_analyses.video_b_*`.

    Utilise du raw SQL (`text()`) pour ne PAS dépendre du modèle SQLAlchemy
    `DebatePerspective` (créé par Sub-agent B). Ainsi cette PR mergeable
    indépendamment.
    """
    try:
        result = await db.execute(
            text(
                "SELECT id, position, video_id, platform, video_title, "
                "video_channel, thesis, arguments, relation_type, "
                "audience_level, channel_quality_score "
                "FROM debate_perspectives "
                "WHERE debate_id = :id "
                "ORDER BY position ASC"
            ),
            {"id": debate_id},
        )
        rows = result.fetchall()
        if not rows:
            return []
        perspectives: list[dict] = []
        for row in rows:
            try:
                mapping = dict(row._mapping)
            except AttributeError:
                # Fallback pour les drivers qui retournent un tuple simple
                mapping = {
                    "id": row[0],
                    "position": row[1],
                    "video_id": row[2],
                    "platform": row[3],
                    "video_title": row[4],
                    "video_channel": row[5],
                    "thesis": row[6],
                    "arguments": row[7],
                    "relation_type": row[8],
                    "audience_level": row[9] if len(row) > 9 else "unknown",
                    "channel_quality_score": row[10] if len(row) > 10 else 0.0,
                }
            perspectives.append(mapping)
        return perspectives
    except Exception as exc:
        # Table absente, ou colonnes manquantes, ou autre erreur SQL — fallback v1.
        # Rollback obligatoire pour libérer la transaction Postgres : sans ça,
        # toute query DB ultérieure dans la même session lèverait
        # `InFailedSQLTransactionError` (cf. incident voice/session 500 mai 2026).
        try:
            await db.rollback()
        except Exception:  # noqa: BLE001 — best-effort
            pass
        logger.info(
            "debate_context: perspectives table unavailable, fallback v1 (debate_id=%s, exc=%s)",
            debate_id,
            type(exc).__name__,
        )
        return []


def _build_perspective_from_v1(debate: DebateAnalysis) -> Optional[PerspectiveCtx]:
    """
    Construit une perspective implicite position=0 relation='opposite' depuis
    les colonnes historiques `debate_analyses.video_b_*`.
    Retourne None si pas de vidéo B (debate orphelin).
    """
    if not debate.video_b_id and not debate.video_b_title:
        return None
    return PerspectiveCtx(
        position=0,
        relation_type="opposite",
        perspective_id=-1,
        video_id=debate.video_b_id or "",
        video_title=debate.video_b_title or "",
        video_channel=debate.video_b_channel or "",
        platform=debate.platform_b or "youtube",
        thesis=debate.thesis_b or "",
        arguments=_safe_json_list(debate.arguments_b),
        transcript="",  # Sera rempli plus bas si include_transcripts
        audience_level="unknown",
        channel_quality_score=0.0,
    )


def _build_perspective_from_v2(row: dict) -> PerspectiveCtx:
    """Construit une PerspectiveCtx depuis une row de debate_perspectives."""
    return PerspectiveCtx(
        position=int(row.get("position") or 0),
        relation_type=_normalize_relation(row.get("relation_type")),
        perspective_id=int(row.get("id") or -1),
        video_id=row.get("video_id") or "",
        video_title=row.get("video_title") or "",
        video_channel=row.get("video_channel") or "",
        platform=row.get("platform") or "youtube",
        thesis=row.get("thesis") or "",
        arguments=_safe_json_list(row.get("arguments")),
        transcript="",
        audience_level=row.get("audience_level") or "unknown",
        channel_quality_score=float(row.get("channel_quality_score") or 0.0),
    )


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
    Assemble le contexte vocal complet (v2) à partir d'une DebateAnalysis.

    Logique :
    1. Tente de charger les `DebatePerspective` rows (raw SQL).
    2. Si vide → fallback v1 : synthétise une perspective implicite depuis
       `debate.video_b_*`.
    3. Charge les transcripts (vidéo A + chaque perspective) en parallèle si
       include_transcripts=True.
    4. Calcule la `relation_type_dominant` (cf. spec §2.1).

    Args:
        debate: Ligne debate_analyses (statut completed attendu).
        db: Session DB async pour charger les transcripts depuis TranscriptCache.
        include_transcripts: Si True, tente de charger les transcripts.
    """
    # ── 1. Chargement perspectives (v2 ou fallback v1) ─────────────────
    raw_perspectives = await _load_perspectives_safe(debate.id, db)

    if raw_perspectives:
        perspectives = [_build_perspective_from_v2(row) for row in raw_perspectives]
        version_used = "v2"
    else:
        fallback = _build_perspective_from_v1(debate)
        perspectives = [fallback] if fallback is not None else []
        version_used = "v1_fallback"

    # ── 2. Calcul de la relation dominante ──────────────────────────────
    relation_dominant = _compute_dominant_relation(perspectives)

    # ── 3. Construction du contexte ─────────────────────────────────────
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
        perspectives=perspectives,
        relation_type_dominant=relation_dominant,
        convergence_points=_safe_json_list(debate.convergence_points),
        divergence_points=_safe_json_list(debate.divergence_points),
        fact_check=_safe_json_list(debate.fact_check_results),
        debate_summary=debate.debate_summary or "",
    )

    # ── 4. Chargement des transcripts ───────────────────────────────────
    if include_transcripts:
        import asyncio

        # Liste des coroutines à exécuter en parallèle :
        # video A + chaque perspective avec un video_id
        tasks: list = [_load_transcript_safely(ctx.video_a_id, db)]
        for p in perspectives:
            tasks.append(_load_transcript_safely(p.video_id, db))

        results = await asyncio.gather(*tasks, return_exceptions=False)
        ctx.transcript_a = results[0] if results else ""
        for i, p in enumerate(perspectives, start=1):
            if i < len(results):
                p.transcript = results[i] or ""

    logger.info(
        "debate_context.built",
        extra={
            "debate_id": debate.id,
            "topic": (ctx.topic or "")[:50],
            "version_used": version_used,
            "n_perspectives": len(ctx.perspectives),
            "relation_dominant": ctx.relation_type_dominant,
            "arguments_a_count": len(ctx.arguments_a),
            "convergence_count": len(ctx.convergence_points),
            "divergence_count": len(ctx.divergence_points),
            "fact_check_count": len(ctx.fact_check),
            "transcript_a_chars": len(ctx.transcript_a),
        },
    )

    return ctx
