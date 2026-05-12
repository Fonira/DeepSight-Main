"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎨 HUB CANVAS SERVICE v2 — extraction Mistral riche pour rendu natif Workspace   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Pivot 2026-05-06 (canvas v1) → enrichissement 2026-05-06 (v2) suite feedback     ║
║  utilisateur "il manque clairement de contenu, il faut plus d'informations".       ║
║                                                                                    ║
║  Génère, pour un workspace de N analyses (2 ≤ N ≤ 20) :                            ║
║    - synthesis : paragraphe d'overview transversal (3-5 phrases)                  ║
║    - shared_concepts : 5 à 10 concepts partagés par 2+ analyses                   ║
║    - themes : 4 à 7 thématiques avec :                                             ║
║        - theme : titre court                                                       ║
║        - description : 1-2 phrases de contexte                                     ║
║        - perspectives : N cards par analyse pertinente, chacune avec :             ║
║            - summary_id : id de l'analyse                                          ║
║            - excerpt : 3-5 phrases factuelles (vs 1-2 en v1)                       ║
║            - key_quote : citation directe optionnelle si extraite du contenu       ║
║                                                                                    ║
║  Mistral via core.llm_provider.llm_complete (json_mode=True). Modèle :             ║
║  mistral-large-2512 (262K context, capacité d'extraction nuancée). Best-effort :  ║
║  si Mistral fail ou JSON invalide → retourne None et le frontend bascule sur       ║
║  MiroBoardEmbed (rétro-compat workspaces pré-pivot).                              ║
║                                                                                    ║
║  Backward-compat frontend : tous les champs nouveaux (synthesis, description,      ║
║  key_quote) sont OPTIONNELS dans la shape retournée. Un workspace v1 (canvas      ║
║  généré avant ce changement) restera valide et continuera de s'afficher.          ║
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

# Modèle Mistral pour l'extraction.
# - `mistral-large-2512` : Expert tier, 262K context, plus capable d'extraction
#   nuancée et de raisonnement transversal sur N analyses. Confirmé fonctionnel
#   prod 2026-05-06 avec la clé du workspace `laborat` (org Deep Sight).
CANVAS_MODEL = "mistral-large-2512"

# Tronque chaque extrait de summary à cette longueur. mistral-large-2512 a 262K
# context, on peut viser ~120K input (10K × 12 analyses moyennes) sans saturer.
MAX_CHARS_PER_SUMMARY = 10_000

# Max tokens réponse JSON Mistral. Avec 4-7 thèmes × 2-N perspectives × excerpts
# de 3-5 phrases + synthesis + shared_concepts, viser ~8K tokens output.
MAX_RESPONSE_TOKENS = 8192

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


def _build_messages(summaries: list[Summary], workspace_name: str) -> list[dict[str, str]]:
    """Construit les messages system+user pour Mistral (prompt v2 enrichi).

    Le prompt demande explicitement la nouvelle shape avec synthesis, theme
    descriptions et excerpts longs.
    """
    summaries_block_lines: list[str] = []
    for s in summaries:
        excerpt = _build_summary_excerpt(s)
        if not excerpt:
            continue
        summaries_block_lines.append(
            f"=== ANALYSE #{s.id} — {s.video_title or 'Sans titre'} ===\n"
            f"Chaîne : {s.video_channel or 'Inconnue'}\n"
            f"Contenu :\n{excerpt}\n"
        )
    summaries_block = "\n".join(summaries_block_lines)

    summary_ids = [s.id for s in summaries]

    system_prompt = (
        "Tu es un analyste expert en synthèse transversale de contenus vidéo "
        "pour un workspace DeepSight. On te fournit N analyses de vidéos "
        "sélectionnées par l'utilisateur ; ton rôle est de produire un canvas "
        "riche, dense et lisible qui fait émerger ce que les analyses ont en "
        "commun ET les perspectives complémentaires qu'elles apportent.\n\n"
        "Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, avec "
        "EXACTEMENT cette structure :\n"
        "{\n"
        '  "synthesis": "Paragraphe d\'overview transversal en 3 à 5 phrases. '
        "Présente la convergence générale, les angles distincts, et la valeur "
        'ajoutée de la mise en relation des analyses.",\n'
        '  "shared_concepts": ["Concept partagé 1 (2-6 mots)", ..., "Concept '
        '10 (max)"],\n'
        '  "themes": [\n'
        "    {\n"
        '      "theme": "Titre court de la thématique (3-7 mots)",\n'
        '      "description": "1 à 2 phrases de contexte qui posent l\'enjeu '
        'de ce thème transversal aux analyses.",\n'
        '      "perspectives": [\n'
        "        {\n"
        '          "summary_id": <int>,\n'
        '          "excerpt": "3 à 5 phrases factuelles décrivant ce que '
        "cette analyse apporte SPÉCIFIQUEMENT sur ce thème : argument central, "
        'preuves/exemples cités, mécanismes décrits, nuances importantes.",\n'
        '          "key_quote": "Citation directe extraite du contenu si elle '
        'illustre puissamment le propos (sinon omettre ce champ)."\n'
        "        },\n"
        "        ...\n"
        "      ]\n"
        "    },\n"
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Règles strictes :\n"
        f"- summary_id ∈ {summary_ids} (uniquement les IDs fournis, en int).\n"
        "- synthesis : 3 à 5 phrases en français, riches en contenu, qui "
        "donnent envie de scroller plus bas. Pas de méta-commentaire générique.\n"
        "- shared_concepts : 5 à 10 concepts (vise le haut de la fourchette si "
        "le contenu le permet), 2-6 mots chacun, distincts entre eux.\n"
        "- themes : 4 à 7 thématiques (vise 5-6 si le contenu est riche), "
        "distinctes des shared_concepts, structurées pour faire émerger des "
        "axes de comparaison ou de complémentarité.\n"
        "- description (par thème) : 1-2 phrases qui posent l'enjeu, pas un "
        "résumé des perspectives qui suivent.\n"
        "- perspectives : INCLURE TOUTES LES ANALYSES qui traitent réellement "
        "du thème (au moins 2). Si une analyse ne traite pas du thème, "
        "l'omettre proprement de cette thématique.\n"
        "- excerpt : 3 à 5 phrases factuelles, denses en contenu, ancrées dans "
        "le matériel de l'analyse (pas de paraphrase vague). Cite arguments, "
        "exemples, données, mécanismes, nuances. Français, pas de markdown.\n"
        "- key_quote : OMETTRE le champ si aucune citation directe ne ressort "
        "naturellement du contenu (mieux vaut pas de quote qu'une quote "
        "fabriquée). Quand présent, c'est une citation littérale.\n"
        "- Ne JAMAIS inventer du contenu hors des analyses fournies."
    )

    user_content = f"WORKSPACE : {workspace_name}\nNOMBRE D'ANALYSES : {len(summaries)}\n\n{summaries_block}"

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def _validate_canvas_shape(data: Any, valid_summary_ids: set[int]) -> Optional[dict[str, Any]]:
    """Valide la forme du JSON retourné par Mistral (shape v2).

    Retourne le dict normalisé si OK, None si la shape est inutilisable.
    Champs optionnels (synthesis, theme.description, perspective.key_quote)
    omis silencieusement quand absents/invalides.
    """
    if not isinstance(data, dict):
        return None

    # synthesis (optionnel — backward compat avec v1 où il n'existe pas)
    synthesis_raw = data.get("synthesis")
    synthesis: Optional[str] = None
    if isinstance(synthesis_raw, str) and synthesis_raw.strip():
        synthesis = synthesis_raw.strip()

    shared_concepts_raw = data.get("shared_concepts")
    themes_raw = data.get("themes")

    if not isinstance(shared_concepts_raw, list) or not isinstance(themes_raw, list):
        return None

    # Normalise shared_concepts : str only, dédup case-insensitive, cap 10.
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
        if len(shared_concepts) >= 10:
            break

    # Normalise themes (cap 7 maintenant vs 6 en v1).
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

        # description (optionnel)
        description_raw = theme_raw.get("description")
        description: Optional[str] = None
        if isinstance(description_raw, str) and description_raw.strip():
            description = description_raw.strip()

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

            perspective_entry: dict[str, Any] = {
                "summary_id": sid,
                "excerpt": excerpt.strip(),
            }
            # key_quote (optionnel)
            key_quote_raw = p.get("key_quote")
            if isinstance(key_quote_raw, str) and key_quote_raw.strip():
                perspective_entry["key_quote"] = key_quote_raw.strip()

            perspectives.append(perspective_entry)

        if len(perspectives) < 2:
            # Garder règle "≥ 2 perspectives par thème" pour avoir un vrai
            # contraste à l'écran.
            continue

        theme_entry: dict[str, Any] = {
            "theme": theme_title.strip(),
            "perspectives": perspectives,
        }
        if description is not None:
            theme_entry["description"] = description
        themes.append(theme_entry)

        if len(themes) >= 7:
            break

    # Empty canvas = no value for the user.
    if not shared_concepts and not themes:
        return None

    result: dict[str, Any] = {
        "shared_concepts": shared_concepts,
        "themes": themes,
    }
    if synthesis is not None:
        result["synthesis"] = synthesis
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def generate_workspace_canvas(summaries: list[Summary], workspace_name: str) -> Optional[dict[str, Any]]:
    """Extrait le canvas natif riche (v2) d'un workspace.

    Best-effort : retourne None sur échec Mistral / JSON invalide après
    `MAX_RETRIES` tentatives. Le caller sauvera None en DB → frontend
    fallback sur MiroBoardEmbed (rétro-compat workspaces pré-pivot).

    Args:
        summaries: liste de Summary (2 à 20 items, ordre préservé).
        workspace_name: nom du workspace (sert de contexte au prompt).

    Returns:
        dict avec keys :
          - "shared_concepts": list[str] (5-10 items)
          - "themes": list[{theme, description?, perspectives:[{summary_id, excerpt, key_quote?}]}]
          - "synthesis": str (optionnel — overview)
        Ou None si échec.
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
            "[HUB-CANVAS] Canvas v2 generated OK on attempt %d "
            "(synthesis=%s, shared=%d, themes=%d, perspectives_total=%d)",
            attempt,
            "yes" if validated.get("synthesis") else "no",
            len(validated["shared_concepts"]),
            len(validated["themes"]),
            sum(len(t["perspectives"]) for t in validated["themes"]),
        )
        break

    return canvas_data
