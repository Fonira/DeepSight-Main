"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎨 HUB CANVAS SERVICE — extraction Mistral pour rendu natif Workspace            ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pivot 2026-05-06 : remplace l'embed Miro iframe (limitation plan Personal         ║
║  Starter $8/mo) par un rendu HTML/React natif inspiré du composant                 ║
║  DebateConvergenceDivergence.                                                      ║
║                                                                                    ║
║  Génère, pour un workspace de N analyses (2 ≤ N ≤ 20) :                            ║
║    - shared_concepts : liste de concepts partagés par 2+ analyses                  ║
║    - themes : sections thématiques, chacune avec 1 extrait par analyse pertinente  ║
║                                                                                    ║
║  Mistral via core.llm_provider.llm_complete (json_mode=True). Modèle :             ║
║  mistral-large-2512 (plan Expert only, 262K context). Best-effort : si Mistral     ║
║  fail ou JSON invalide → retourne None et le frontend bascule sur MiroBoardEmbed   ║
║  (rétro-compat).                                                                   ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

from core.llm_provider import llm_complete
from db.database import Summary


logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════════════════

# Modèle Mistral utilisé pour l'extraction.
# Note 2026-05-06 : `mistral-large-2512` retourne 401 sur la clé prod
# (modèle non encore libéré côté Mistral SaaS, ou non couvert par notre licence).
# `llm_complete` ne fallback PAS sur 401 (uniquement sur 429/5xx) → on utilise
# directement `mistral-medium-2508` (131K context, confirmé fonctionnel prod).
CANVAS_MODEL = "mistral-medium-2508"

# Tronque chaque extrait de summary à cette longueur pour rester sous la limite
# de tokens (mistral-medium-2508 = 131K context, on vise <= 60K input).
MAX_CHARS_PER_SUMMARY = 6000

# Max tokens pour la réponse JSON Mistral.
MAX_RESPONSE_TOKENS = 4096

# Retry max si parsing JSON échoue.
MAX_RETRIES = 2


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _build_summary_excerpt(summary: Summary) -> str:
    """Retourne un extrait textuel exploitable pour l'analyse Mistral.

    Priorité : full_digest (assembled hierarchical digest, ~6-10K chars) >
    summary_content (analysis raw).
    """
    text = (summary.full_digest or summary.summary_content or "").strip()
    if not text:
        return ""
    if len(text) > MAX_CHARS_PER_SUMMARY:
        return text[:MAX_CHARS_PER_SUMMARY] + "…"
    return text


def _build_messages(
    summaries: list[Summary], workspace_name: str
) -> list[dict[str, str]]:
    """Construit les messages system+user pour Mistral.

    Le prompt demande explicitement le format JSON cible (shared_concepts +
    themes avec perspectives par summary_id).
    """
    summaries_block_lines: list[str] = []
    for s in summaries:
        excerpt = _build_summary_excerpt(s)
        if not excerpt:
            continue
        summaries_block_lines.append(
            f"=== ANALYSE #{s.id} — {s.video_title or 'Sans titre'} ===\n"
            f"Chaîne : {s.video_channel or 'Inconnue'}\n"
            f"Extrait :\n{excerpt}\n"
        )
    summaries_block = "\n".join(summaries_block_lines)

    summary_ids = [s.id for s in summaries]

    system_prompt = (
        "Tu es un analyste expert en synthèse transversale de contenus vidéo. "
        "On te fournit N analyses de vidéos sélectionnées par l'utilisateur "
        "pour un workspace transversal. Ton rôle : extraire (1) les concepts "
        "partagés par au moins 2 analyses, et (2) regrouper les perspectives "
        "complémentaires en thématiques avec un extrait spécifique par "
        "analyse pertinente.\n\n"
        "Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, "
        "avec EXACTEMENT ce format :\n"
        "{\n"
        '  "shared_concepts": ["concept partagé 1", "concept partagé 2", ...],\n'
        '  "themes": [\n'
        '    {\n'
        '      "theme": "Titre court de la thématique",\n'
        '      "perspectives": [\n'
        '        {"summary_id": <int>, "excerpt": "Ce que cette analyse apporte sur ce thème (1-2 phrases)"},\n'
        '        ...\n'
        '      ]\n'
        '    },\n'
        '    ...\n'
        '  ]\n'
        "}\n\n"
        "Règles strictes :\n"
        f"- summary_id ∈ {summary_ids} (uniquement les IDs fournis, en int).\n"
        "- shared_concepts : 3 à 8 concepts max, chacun en 2-6 mots.\n"
        "- themes : 2 à 6 thématiques max, distinctes des shared_concepts.\n"
        "- Chaque thème doit contenir 2 à N perspectives (au moins 2 analyses pertinentes).\n"
        "- excerpt : 1 à 2 phrases factuelles, en français, fidèles au contenu de l'analyse.\n"
        "- Si une analyse ne traite pas du thème, NE PAS l'inclure dans perspectives.\n"
        "- Pas de markdown, pas de listes à puces dans excerpt — juste du texte brut."
    )

    user_content = (
        f"WORKSPACE : {workspace_name}\n"
        f"NOMBRE D'ANALYSES : {len(summaries)}\n\n"
        f"{summaries_block}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def _validate_canvas_shape(
    data: Any, valid_summary_ids: set[int]
) -> Optional[dict[str, Any]]:
    """Valide la forme du JSON retourné par Mistral.

    Retourne le dict normalisé si OK, None sinon.
    """
    if not isinstance(data, dict):
        return None

    shared_concepts_raw = data.get("shared_concepts")
    themes_raw = data.get("themes")

    if not isinstance(shared_concepts_raw, list) or not isinstance(themes_raw, list):
        return None

    # Normalise shared_concepts : str only, dédup case-insensitive,
    # cap at 8 items.
    shared_concepts: list[str] = []
    seen_lower: set[str] = set()
    for item in shared_concepts_raw:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen_lower:
            continue
        seen_lower.add(key)
        shared_concepts.append(cleaned)
        if len(shared_concepts) >= 8:
            break

    # Normalise themes.
    themes: list[dict[str, Any]] = []
    for theme_raw in themes_raw:
        if not isinstance(theme_raw, dict):
            continue
        theme_title = theme_raw.get("theme")
        perspectives_raw = theme_raw.get("perspectives")
        if not isinstance(theme_title, str) or not theme_title.strip():
            continue
        if not isinstance(perspectives_raw, list):
            continue
        perspectives: list[dict[str, Any]] = []
        seen_summary_ids_in_theme: set[int] = set()
        for p in perspectives_raw:
            if not isinstance(p, dict):
                continue
            sid = p.get("summary_id")
            excerpt = p.get("excerpt")
            if not isinstance(sid, int) or sid not in valid_summary_ids:
                continue
            if sid in seen_summary_ids_in_theme:
                continue
            if not isinstance(excerpt, str) or not excerpt.strip():
                continue
            seen_summary_ids_in_theme.add(sid)
            perspectives.append({"summary_id": sid, "excerpt": excerpt.strip()})
        if len(perspectives) < 2:
            # On garde la règle "≥ 2 perspectives par thème" pour avoir un
            # vrai contraste à l'écran. Si Mistral en propose <2, on saute.
            continue
        themes.append(
            {"theme": theme_title.strip(), "perspectives": perspectives}
        )
        if len(themes) >= 6:
            break

    # Empty canvas = no value for the user.
    if not shared_concepts and not themes:
        return None

    return {"shared_concepts": shared_concepts, "themes": themes}


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def generate_workspace_canvas(
    summaries: list[Summary], workspace_name: str
) -> Optional[dict[str, Any]]:
    """Extrait le canvas natif (shared_concepts + themes) d'un workspace.

    Best-effort : retourne None sur échec Mistral / JSON invalide après
    `MAX_RETRIES` tentatives. Le caller sauvera None en DB → frontend
    fallback sur MiroBoardEmbed (rétro-compat workspaces pré-pivot).

    Args:
        summaries: liste de Summary (2 à 20 items, ordre préservé).
        workspace_name: nom du workspace (sert de contexte au prompt).

    Returns:
        dict {"shared_concepts": [...], "themes": [...]} ou None.
    """
    if not summaries:
        logger.warning("[HUB-CANVAS] generate_workspace_canvas called with no summaries")
        return None

    valid_summary_ids = {s.id for s in summaries}
    messages = _build_messages(summaries, workspace_name)

    canvas_data: Optional[dict[str, Any]] = None
    for attempt in range(1, MAX_RETRIES + 1):
        result = await llm_complete(
            messages=messages,
            model=CANVAS_MODEL,
            max_tokens=MAX_RESPONSE_TOKENS,
            temperature=0.3,
            json_mode=True,
        )
        if result is None or not result.content:
            logger.warning(
                "[HUB-CANVAS] llm_complete returned empty (attempt %d/%d)",
                attempt,
                MAX_RETRIES,
            )
            continue

        try:
            parsed = json.loads(result.content)
        except json.JSONDecodeError as exc:
            logger.warning(
                "[HUB-CANVAS] JSON decode error attempt %d/%d: %s — first 400 chars: %s",
                attempt,
                MAX_RETRIES,
                exc,
                (result.content or "")[:400],
            )
            continue

        validated = _validate_canvas_shape(parsed, valid_summary_ids)
        if validated is None:
            logger.warning(
                "[HUB-CANVAS] Canvas shape validation failed (attempt %d/%d)",
                attempt,
                MAX_RETRIES,
            )
            continue

        canvas_data = validated
        logger.info(
            "[HUB-CANVAS] Canvas generated OK on attempt %d "
            "(shared=%d, themes=%d)",
            attempt,
            len(validated["shared_concepts"]),
            len(validated["themes"]),
        )
        break

    return canvas_data
