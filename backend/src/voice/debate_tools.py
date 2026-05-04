"""
Debate Voice Agent Server Tools (v2)
====================================
Tools appelables par l'agent vocal ElevenLabs "Modérateur de débat" via webhook.

v2 — Adaptation N perspectives (1 vidéo A + 1 à 3 vidéos B avec relation_type ∈
{opposite, complement, nuance}). Tools historiques (`get_debate_overview`,
`get_video_thesis`, `get_argument_comparison`, `search_in_debate_transcript`,
`get_debate_fact_check`) **conservés en compat**. Trois nouveaux tools v2 :

- `list_perspectives(debate_id)` — toutes les perspectives + métadonnées synthétiques.
- `compare(debate_id, perspective_a_id, perspective_b_id)` — comparaison ciblée.
- `synthesize_relation(debate_id, relation_type)` — focus sur une relation type.

Tous ces tools lisent DebateAnalysis (et `debate_perspectives` si présente).
Ownership vérifié au niveau router.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import DebateAnalysis
from voice.debate_context import (
    PerspectiveCtx,
    _build_perspective_from_v1,
    _build_perspective_from_v2,
    _format_relation_human,
    _load_perspectives_safe,
    _normalize_relation,
    _safe_json_list,
    _truncate,
)

logger = logging.getLogger(__name__)


async def _load_debate(debate_id: int, db: AsyncSession) -> Optional[DebateAnalysis]:
    result = await db.execute(select(DebateAnalysis).where(DebateAnalysis.id == debate_id))
    return result.scalar_one_or_none()


async def _load_perspectives_for_tool(
    debate: DebateAnalysis, db: AsyncSession
) -> list[PerspectiveCtx]:
    """
    Renvoie la liste des perspectives v2 OU le fallback v1 (1 perspective implicite).
    Mutualisé entre tous les nouveaux tools v2.
    """
    raw = await _load_perspectives_safe(debate.id, db)
    if raw:
        return [_build_perspective_from_v2(r) for r in raw]
    fallback = _build_perspective_from_v1(debate)
    return [fallback] if fallback is not None else []


# ═══════════════════════════════════════════════════════════════════════════════
# Tools historiques (compat ElevenLabs Studio config existante)
# ═══════════════════════════════════════════════════════════════════════════════


async def get_debate_overview(debate_id: int, db: AsyncSession) -> str:
    """
    Résumé haute-vue : sujet, thèses (vidéo A + chaque perspective), synthèse.

    v2 : si plusieurs perspectives, listes-les toutes avec leur relation_type.
    """
    logger.info("debate_tool.overview", extra={"debate_id": debate_id})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    perspectives = await _load_perspectives_for_tool(debate, db)
    n = len(perspectives)
    is_classic = (
        n == 1 and _normalize_relation(perspectives[0].relation_type) == "opposite"
    )
    lang = debate.lang or "fr"

    lines: list[str] = [f"Sujet du débat : {debate.detected_topic or '(non détecté)'}", ""]

    lines.append(
        f"Vidéo A — {debate.video_a_title or 'titre inconnu'} "
        f"({debate.video_a_channel or 'chaîne inconnue'})"
    )
    lines.append(
        f"  Thèse : {_truncate(debate.thesis_a or '(non identifiée)', 400)}"
    )
    lines.append("")

    if is_classic:
        # Format historique : compat avec test_get_debate_overview
        p = perspectives[0]
        lines.append(
            f"Vidéo B — {p.video_title or 'titre inconnu'} "
            f"({p.video_channel or 'chaîne inconnue'})"
        )
        lines.append(f"  Thèse : {_truncate(p.thesis or '(non identifiée)', 400)}")
        lines.append("")
    else:
        lines.append(f"Le débat compte {n} perspective{'s' if n > 1 else ''} ajoutée{'s' if n > 1 else ''} :")
        for p in perspectives:
            rel_human = _format_relation_human(p.relation_type, lang)
            lines.append(
                f"- Perspective {p.position + 1} ({rel_human}) — "
                f"{p.video_title or 'titre inconnu'} "
                f"({p.video_channel or 'chaîne inconnue'})"
            )
            lines.append(
                f"    Thèse : {_truncate(p.thesis or '(non identifiée)', 300)}"
            )
        lines.append("")

    lines.append(
        f"Synthèse : {_truncate(debate.debate_summary or '(aucune synthèse disponible)', 600)}"
    )
    return "\n".join(lines)


async def get_video_thesis(debate_id: int, side: str, db: AsyncSession) -> str:
    """
    Thèse + arguments détaillés de la vidéo A ou d'une perspective B.

    side accepté : 'video_a', 'a', 'video_b', 'b' (= position 0),
    'perspective_1' / 'perspective_2' / 'perspective_3' (1-based).
    """
    logger.info("debate_tool.thesis", extra={"debate_id": debate_id, "side": side})
    side_norm = (side or "").strip().lower()

    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    if side_norm in ("video_a", "a"):
        title = debate.video_a_title or "titre inconnu"
        channel = debate.video_a_channel or "chaîne inconnue"
        thesis = debate.thesis_a or "(non identifiée)"
        arguments = _safe_json_list(debate.arguments_a)
        section_label = "Vidéo A"
    elif side_norm in ("video_b", "b") or side_norm.startswith("perspective_"):
        # Calcule l'index de perspective (0-based)
        if side_norm in ("video_b", "b"):
            target_idx = 0
        else:
            try:
                # 'perspective_1' -> 0, 'perspective_2' -> 1, etc.
                target_idx = int(side_norm.split("_", 1)[1]) - 1
            except (ValueError, IndexError):
                return (
                    "Paramètre 'side' invalide. Utiliser 'video_a', 'video_b', "
                    "'perspective_1', 'perspective_2' ou 'perspective_3'."
                )

        perspectives = await _load_perspectives_for_tool(debate, db)
        if target_idx < 0 or target_idx >= len(perspectives):
            return (
                f"Perspective {target_idx + 1} introuvable "
                f"(le débat compte {len(perspectives)} perspective(s))."
            )
        p = perspectives[target_idx]
        title = p.video_title or "titre inconnu"
        channel = p.video_channel or "chaîne inconnue"
        thesis = p.thesis or "(non identifiée)"
        arguments = p.arguments
        rel_human = _format_relation_human(p.relation_type, debate.lang or "fr")
        section_label = (
            f"Perspective {target_idx + 1} ({rel_human})"
            if target_idx > 0 or _normalize_relation(p.relation_type) != "opposite"
            else "Vidéo B"
        )
    else:
        return (
            "Paramètre 'side' invalide. Utiliser 'video_a', 'video_b', "
            "'perspective_1', 'perspective_2' ou 'perspective_3'."
        )

    lines = [
        f"## {section_label} — {title}",
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


async def get_argument_comparison(debate_id: int, topic: str, db: AsyncSession) -> str:
    """Compare les positions A vs B sur un sous-thème."""
    logger.info(
        "debate_tool.compare",
        extra={"debate_id": debate_id, "topic": (topic or "")[:60]},
    )
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    divergence = _safe_json_list(debate.divergence_points)
    convergence = _safe_json_list(debate.convergence_points)
    arguments_a = _safe_json_list(debate.arguments_a)
    perspectives = await _load_perspectives_for_tool(debate, db)
    arguments_b = perspectives[0].arguments if perspectives else []

    topic_norm = (topic or "").strip().lower()

    if not topic_norm:
        lines: list[str] = []
        if divergence:
            lines.append("## Points de divergence")
            for d in divergence[:6]:
                if isinstance(d, dict):
                    lines.append(
                        f"- **{d.get('topic', '?')}** — A : {d.get('position_a', '')} / "
                        f"B : {d.get('position_b', '')}"
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
        d for d in divergence if isinstance(d, dict) and topic_norm in (d.get("topic") or "").lower()
    ]
    matching_args_a = [
        a for a in arguments_a if isinstance(a, dict) and topic_norm in (a.get("claim") or "").lower()
    ]
    matching_args_b = [
        a for a in arguments_b if isinstance(a, dict) and topic_norm in (a.get("claim") or "").lower()
    ]

    if not (matching_divergences or matching_args_a or matching_args_b):
        return (
            f"Aucun point de comparaison explicite sur '{topic}' dans ce débat. "
            "Utiliser get_argument_comparison sans argument pour voir toutes les divergences."
        )

    lines = [f"## Comparaison sur : {topic}", ""]
    for d in matching_divergences:
        lines.append(
            f"**{d.get('topic', '?')}** — A : {d.get('position_a', '')} / "
            f"B : {d.get('position_b', '')}"
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
    """Recherche BM25 dans le transcript de la vidéo A, B (1ère perspective), ou les deux."""
    logger.info(
        "debate_tool.search_transcript",
        extra={"debate_id": debate_id, "query": (query or "")[:60], "side": side},
    )
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

    perspectives = await _load_perspectives_for_tool(debate, db)
    video_b_id = perspectives[0].video_id if perspectives else ""

    sides: list[tuple[str, str]] = []
    if side_norm in ("video_a", "a", "both"):
        sides.append(("Vidéo A", debate.video_a_id or ""))
    if side_norm in ("video_b", "b", "both"):
        sides.append(("Vidéo B", video_b_id))

    parts: list[str] = []
    for label, video_id in sides:
        if not video_id:
            parts.append(f"### {label}\n(pas d'ID vidéo)")
            continue
        try:
            transcript = await _get_full_transcript_from_cache(video_id, db)
        except Exception as exc:
            logger.warning(
                "search_in_debate_transcript: %s load failed: %s", label, exc
            )
            transcript = ""
        if not transcript:
            parts.append(f"### {label}\n(transcript indisponible)")
            continue
        try:
            passages = search_relevant_passages(
                question=query,
                transcript=transcript,
                video_duration=0,
                max_passages=3,
            )
        except Exception as exc:
            logger.warning(
                "search_in_debate_transcript: %s smart_search failed: %s", label, exc
            )
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
            "confirmed": "confirmé",
            "nuanced": "nuancé",
            "disputed": "contesté",
            "unverifiable": "invérifiable",
        }.get(verdict, verdict)
        lines.append(f"{i}. **{claim}** → [{verdict_fr.upper()}]")
        if explanation:
            lines.append(f"   {explanation}")
        if source:
            lines.append(f"   Source : {source}")

    return _truncate("\n".join(lines), 3000)


# ═══════════════════════════════════════════════════════════════════════════════
# Nouveaux tools v2 — Multi-perspectives + relation_type
# ═══════════════════════════════════════════════════════════════════════════════


async def list_perspectives(debate_id: int, db: AsyncSession) -> str:
    """
    Liste les N perspectives du débat avec titres, chaînes, relation_types et thèses.
    Utile à l'agent pour annoncer la structure du débat avant d'attaquer un point.

    v2 : aware de la table debate_perspectives.
    Fallback v1 : retourne 1 perspective implicite (relation 'opposite') depuis
    debate_analyses.video_b_*.
    """
    logger.info("debate_tool.list_perspectives", extra={"debate_id": debate_id})
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    perspectives = await _load_perspectives_for_tool(debate, db)
    if not perspectives:
        return (
            "Aucune perspective trouvée pour ce débat. "
            "Le débat est peut-être encore en cours d'analyse."
        )

    lang = debate.lang or "fr"
    lines: list[str] = [
        f"## Perspectives du débat ({len(perspectives) + 1} au total)",
        "",
        f"**Vidéo A** — {debate.video_a_title or 'titre inconnu'} "
        f"({debate.video_a_channel or 'chaîne inconnue'})",
        f"  Thèse : {_truncate(debate.thesis_a or '(non identifiée)', 300)}",
        "",
    ]

    for p in perspectives:
        rel_human = _format_relation_human(p.relation_type, lang)
        idx = p.position + 1
        lines.append(
            f"**Perspective {idx}** ({rel_human}) — "
            f"{p.video_title or 'titre inconnu'} "
            f"({p.video_channel or 'chaîne inconnue'})"
        )
        lines.append(
            f"  Thèse : {_truncate(p.thesis or '(non identifiée)', 300)}"
        )
        if p.arguments:
            args_summary = "; ".join(
                a.get("claim", "?") if isinstance(a, dict) else str(a)
                for a in p.arguments[:3]
            )
            lines.append(f"  Arguments principaux : {_truncate(args_summary, 250)}")
        lines.append("")

    return _truncate("\n".join(lines), 3500)


async def compare(
    debate_id: int,
    perspective_a_id: int,
    perspective_b_id: int,
    db: AsyncSession,
) -> str:
    """
    Compare deux perspectives ciblées par leur ID (côté DB) ou leur position 1-based.

    Convention :
    - perspective_a_id == 0 (ou -10) → la vidéo A (l'ancrage du débat).
    - perspective_a_id > 0 → ID de DebatePerspective.id (v2) ou position 1-based si IDs inconnus.

    Fallback v1 : si table debate_perspectives absente, on autorise uniquement
    perspective_a_id ∈ {0, vidéo A} et perspective_b_id ∈ {1, vidéo B implicite}.
    """
    logger.info(
        "debate_tool.compare",
        extra={
            "debate_id": debate_id,
            "perspective_a_id": perspective_a_id,
            "perspective_b_id": perspective_b_id,
        },
    )
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    perspectives = await _load_perspectives_for_tool(debate, db)

    def _resolve_side(pid: int) -> Optional[tuple[str, str, str, list]]:
        """
        Résout pid en tuple (label, title, thesis, arguments).
        - pid == 0 → vidéo A.
        - pid > 0 :
          - tente match sur perspective.perspective_id (= row id en DB v2)
          - sinon match sur position 1-based (1 → perspectives[0], etc.)
        """
        if pid == 0:
            return (
                "Vidéo A",
                debate.video_a_title or "titre inconnu",
                debate.thesis_a or "(non identifiée)",
                _safe_json_list(debate.arguments_a),
            )
        # v2 : essaie de matcher sur perspective_id (DB row id)
        for p in perspectives:
            if p.perspective_id == pid and p.perspective_id != -1:
                rel_human = _format_relation_human(
                    p.relation_type, debate.lang or "fr"
                )
                label = f"Perspective {p.position + 1} ({rel_human})"
                return (label, p.video_title or "titre inconnu", p.thesis or "(non identifiée)", p.arguments)
        # Fallback : interprète pid comme position 1-based
        if 1 <= pid <= len(perspectives):
            p = perspectives[pid - 1]
            rel_human = _format_relation_human(p.relation_type, debate.lang or "fr")
            label = f"Perspective {pid} ({rel_human})"
            return (label, p.video_title or "titre inconnu", p.thesis or "(non identifiée)", p.arguments)
        return None

    side_a = _resolve_side(perspective_a_id)
    side_b = _resolve_side(perspective_b_id)

    if side_a is None:
        return (
            f"Perspective A introuvable (id={perspective_a_id}). "
            "Utiliser 0 pour la vidéo A, ou l'id/position d'une perspective."
        )
    if side_b is None:
        return (
            f"Perspective B introuvable (id={perspective_b_id}). "
            "Utiliser 0 pour la vidéo A, ou l'id/position d'une perspective."
        )
    if perspective_a_id == perspective_b_id:
        return (
            "Les deux perspectives à comparer sont identiques. "
            "Choisir 2 perspectives différentes."
        )

    label_a, title_a, thesis_a, args_a = side_a
    label_b, title_b, thesis_b, args_b = side_b

    lines = [
        f"## Comparaison : {label_a} ↔ {label_b}",
        "",
        f"### {label_a} — {title_a}",
        f"  Thèse : {_truncate(thesis_a, 400)}",
        "",
        f"### {label_b} — {title_b}",
        f"  Thèse : {_truncate(thesis_b, 400)}",
        "",
        f"### Arguments — {label_a}",
    ]
    if not args_a:
        lines.append("(aucun argument extrait)")
    else:
        for i, arg in enumerate(args_a[:5], start=1):
            if isinstance(arg, dict):
                lines.append(f"{i}. {arg.get('claim', '?')}")
            else:
                lines.append(f"{i}. {str(arg)}")
    lines.append("")
    lines.append(f"### Arguments — {label_b}")
    if not args_b:
        lines.append("(aucun argument extrait)")
    else:
        for i, arg in enumerate(args_b[:5], start=1):
            if isinstance(arg, dict):
                lines.append(f"{i}. {arg.get('claim', '?')}")
            else:
                lines.append(f"{i}. {str(arg)}")

    # Heuristique de convergence/divergence : recoupe avec la synthèse globale.
    convergence = _safe_json_list(debate.convergence_points)
    divergence = _safe_json_list(debate.divergence_points)
    if convergence:
        lines.append("")
        lines.append("### Points de convergence (synthèse globale)")
        for c in convergence[:5]:
            lines.append(f"- {c}")
    if divergence:
        lines.append("")
        lines.append("### Points de divergence (synthèse globale)")
        for d in divergence[:5]:
            if isinstance(d, dict):
                lines.append(
                    f"- **{d.get('topic', '?')}** — "
                    f"{d.get('position_a', '')} / {d.get('position_b', '')}"
                )
            else:
                lines.append(f"- {str(d)}")

    return _truncate("\n".join(lines), 3500)


async def synthesize_relation(
    debate_id: int,
    relation_type: str,
    db: AsyncSession,
) -> str:
    """
    Synthèse focalisée sur un relation_type :
    - 'opposite' : contradictions, points de désaccord (utilise les divergences globales).
    - 'complement' : enrichissements (perspectives qui élargissent l'angle de la vidéo A).
    - 'nuance' : subtilités (perspectives qui modulent ou précisent les claims).

    Pour chaque relation, on liste les perspectives concernées + leurs thèses + leurs
    arguments-clés, et on rappelle les points pertinents de l'analyse globale.
    """
    logger.info(
        "debate_tool.synthesize_relation",
        extra={"debate_id": debate_id, "relation_type": relation_type},
    )
    debate = await _load_debate(debate_id, db)
    if debate is None:
        return "Débat introuvable."

    rel_norm = _normalize_relation(relation_type)
    if not relation_type or rel_norm not in ("opposite", "complement", "nuance"):
        return (
            "Paramètre 'relation_type' invalide. Utiliser 'opposite', 'complement' "
            "ou 'nuance'."
        )

    perspectives = await _load_perspectives_for_tool(debate, db)
    matching = [p for p in perspectives if _normalize_relation(p.relation_type) == rel_norm]

    lang = debate.lang or "fr"
    rel_human = _format_relation_human(rel_norm, lang)

    lines: list[str] = [f"## Synthèse — relation : {rel_human}", ""]

    if not matching:
        lines.append(
            f"Aucune perspective de type '{rel_human}' dans ce débat. "
            f"Le débat compte {len(perspectives)} perspective(s) au total."
        )
        # On affiche tout de même les points globaux pertinents si opposite
        if rel_norm == "opposite":
            divergence = _safe_json_list(debate.divergence_points)
            if divergence:
                lines.append("")
                lines.append("Points de divergence globaux trouvés malgré tout :")
                for d in divergence[:5]:
                    if isinstance(d, dict):
                        lines.append(
                            f"- **{d.get('topic', '?')}** — "
                            f"A : {d.get('position_a', '')} / "
                            f"B : {d.get('position_b', '')}"
                        )
                    else:
                        lines.append(f"- {str(d)}")
        return _truncate("\n".join(lines), 3000)

    lines.append(
        f"{len(matching)} perspective(s) sur {len(perspectives)} sont en relation "
        f"« {rel_human} » avec la vidéo A :"
    )
    lines.append("")
    for p in matching:
        idx = p.position + 1
        lines.append(
            f"### Perspective {idx} — {p.video_title or 'titre inconnu'} "
            f"({p.video_channel or 'chaîne inconnue'})"
        )
        lines.append(f"  Thèse : {_truncate(p.thesis or '(non identifiée)', 400)}")
        if p.arguments:
            lines.append("  Arguments principaux :")
            for i, arg in enumerate(p.arguments[:4], start=1):
                if isinstance(arg, dict):
                    lines.append(f"    {i}. {arg.get('claim', '?')}")
                else:
                    lines.append(f"    {i}. {str(arg)}")
        lines.append("")

    # Synthèse globale spécifique au relation_type
    if rel_norm == "opposite":
        divergence = _safe_json_list(debate.divergence_points)
        if divergence:
            lines.append("### Contradictions principales (synthèse globale)")
            for d in divergence[:6]:
                if isinstance(d, dict):
                    lines.append(
                        f"- **{d.get('topic', '?')}** — "
                        f"A : {d.get('position_a', '')} / "
                        f"B : {d.get('position_b', '')}"
                    )
                else:
                    lines.append(f"- {str(d)}")
            lines.append("")
    elif rel_norm == "complement":
        convergence = _safe_json_list(debate.convergence_points)
        if convergence:
            lines.append("### Enrichissements partagés (convergences globales)")
            for c in convergence[:6]:
                lines.append(f"- {c}")
            lines.append("")
    elif rel_norm == "nuance":
        # Pour les nuances, on ne pré-suppose pas un signal global ; on commente la dynamique.
        lines.append(
            "### Lecture nuancée"
        )
        lines.append(
            "Ces perspectives modulent les claims principaux de la vidéo A — "
            "ni en franche opposition, ni en simple complément, mais en précisant "
            "des cas particuliers ou en contextualisant les généralisations."
        )
        lines.append("")

    if debate.debate_summary:
        lines.append("### Synthèse globale du débat")
        lines.append(_truncate(debate.debate_summary, 800))

    return _truncate("\n".join(lines), 3500)
