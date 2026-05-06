"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📚 SUMMARY ENRICHMENT SERVICE — spike post-processing pour synthèses détaillées  ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  2026-05-06 : applique la technique du Hub Canvas (Mistral json_mode + validation ║
║  stricte + retry + champs optionnels) au Summary classique sans toucher à         ║
║  `summary_content` (la prose continue qui plaît aux utilisateurs reste intacte).   ║
║                                                                                    ║
║  Génère 3 sections d'enrichissement dérivées de l'analyse existante :              ║
║    - key_quotes : 3-5 citations littérales du contenu avec mini-contexte          ║
║    - key_takeaways : 4-7 takeaways courts en bullets                              ║
║    - chapter_themes : 3-6 thèmes structurés type table des matières enrichie      ║
║                                                                                    ║
║  Mistral via core.llm_provider.llm_complete (json_mode=True). Modèle :             ║
║  mistral-medium-2508 (131K context, économique pour spike). Best-effort : si      ║
║  Mistral fail ou JSON invalide → retourne None et l'endpoint API 502.             ║
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

ENRICHMENT_MODEL = "mistral-medium-2508"
MAX_CHARS_INPUT = 12_000  # full_digest moyen ~6-10K chars, on garde une marge
MAX_RESPONSE_TOKENS = 4096
MAX_RETRIES = 2

# Caps pour éviter UI surcharge.
MAX_QUOTES = 5
MAX_TAKEAWAYS = 7
MAX_THEMES = 6


# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _build_input_text(summary: Summary) -> str:
    """Construit le texte source pour l'enrichissement.

    Priorité : full_digest (assembled hierarchical, ~6-10K) > summary_content > transcript.
    Tronque à MAX_CHARS_INPUT.
    """
    text = (
        summary.full_digest
        or summary.summary_content
        or summary.transcript_context
        or ""
    ).strip()
    if not text:
        return ""
    if len(text) > MAX_CHARS_INPUT:
        return text[:MAX_CHARS_INPUT] + "…"
    return text


def _build_messages(summary: Summary) -> list[dict[str, str]]:
    """Construit les messages system+user pour Mistral."""
    input_text = _build_input_text(summary)

    system_prompt = (
        "Tu es un assistant éditorial pour DeepSight. À partir d'une analyse "
        "détaillée d'une vidéo (synthèse + transcription), tu produis 3 "
        "sections d'enrichissement qui complètent la lecture sans la "
        "remplacer.\n\n"
        "Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, avec "
        "EXACTEMENT cette structure :\n"
        "{\n"
        '  "key_quotes": [\n'
        "    {\n"
        '      "quote": "Citation littérale tirée du contenu (1-3 phrases max).",\n'
        '      "context": "1 phrase qui explique en quoi cette citation est marquante (optionnel)."\n'
        "    },\n"
        "    ...\n"
        "  ],\n"
        '  "key_takeaways": [\n'
        '    "Takeaway 1 — phrase courte et actionnable.",\n'
        "    ...\n"
        "  ],\n"
        '  "chapter_themes": [\n'
        "    {\n"
        '      "theme": "Titre court d\'un chapitre / thème (3-7 mots).",\n'
        '      "summary": "Synthèse du thème en 1-2 phrases (optionnel)."\n'
        "    },\n"
        "    ...\n"
        "  ]\n"
        "}\n\n"
        "Règles strictes :\n"
        f"- key_quotes : 3 à {MAX_QUOTES} citations LITTÉRALES tirées du contenu (pas reformulées). "
        "Si aucune citation forte ne ressort, OMETTRE des entrées plutôt qu'en fabriquer.\n"
        f"- key_takeaways : 4 à {MAX_TAKEAWAYS} takeaways courts (1 phrase chacun, pas de markdown). "
        "Vise des insights actionnables ou des conclusions saillantes.\n"
        f"- chapter_themes : 3 à {MAX_THEMES} thèmes structurés. summary optionnel mais recommandé.\n"
        "- Tout en français.\n"
        "- Ne JAMAIS inventer du contenu hors de l'analyse fournie."
    )

    user_content = (
        f"VIDÉO : {summary.video_title or 'Sans titre'}\n"
        f"CHAÎNE : {summary.video_channel or 'Inconnue'}\n\n"
        f"CONTENU DE L'ANALYSE :\n{input_text}"
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]


def _validate_extras_shape(data: Any) -> Optional[dict[str, Any]]:
    """Valide la forme du JSON Mistral. Retourne dict normalisé ou None."""
    if not isinstance(data, dict):
        return None

    # ─── key_quotes ───
    quotes_raw = data.get("key_quotes")
    quotes: list[dict[str, Any]] = []
    if isinstance(quotes_raw, list):
        for q in quotes_raw:
            if not isinstance(q, dict):
                continue
            quote_str = q.get("quote")
            if not isinstance(quote_str, str) or not quote_str.strip():
                continue
            entry: dict[str, Any] = {"quote": quote_str.strip()}
            ctx = q.get("context")
            if isinstance(ctx, str) and ctx.strip():
                entry["context"] = ctx.strip()
            quotes.append(entry)
            if len(quotes) >= MAX_QUOTES:
                break

    # ─── key_takeaways ───
    takeaways_raw = data.get("key_takeaways")
    takeaways: list[str] = []
    if isinstance(takeaways_raw, list):
        seen_lower: set[str] = set()
        for t in takeaways_raw:
            if not isinstance(t, str):
                continue
            cleaned = t.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen_lower:
                continue
            seen_lower.add(key)
            takeaways.append(cleaned)
            if len(takeaways) >= MAX_TAKEAWAYS:
                break

    # ─── chapter_themes ───
    themes_raw = data.get("chapter_themes")
    themes: list[dict[str, Any]] = []
    if isinstance(themes_raw, list):
        for th in themes_raw:
            if not isinstance(th, dict):
                continue
            theme_title = th.get("theme")
            if not isinstance(theme_title, str) or not theme_title.strip():
                continue
            entry: dict[str, Any] = {"theme": theme_title.strip()}
            summary_str = th.get("summary")
            if isinstance(summary_str, str) and summary_str.strip():
                entry["summary"] = summary_str.strip()
            themes.append(entry)
            if len(themes) >= MAX_THEMES:
                break

    if not quotes and not takeaways and not themes:
        return None

    return {
        "key_quotes": quotes,
        "key_takeaways": takeaways,
        "chapter_themes": themes,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Public API
# ═══════════════════════════════════════════════════════════════════════════════


async def generate_summary_extras(summary: Summary) -> Optional[dict[str, Any]]:
    """Génère l'enrichissement (quotes + takeaways + themes) d'un Summary.

    Best-effort : retourne None sur échec Mistral / JSON invalide après
    `MAX_RETRIES` tentatives.

    Args:
        summary: instance Summary (lit full_digest > summary_content > transcript_context).

    Returns:
        dict avec keys "key_quotes", "key_takeaways", "chapter_themes" ou None.
    """
    if not _build_input_text(summary):
        logger.warning(
            "[SUMMARY-ENRICH] generate_summary_extras: empty input for summary %s",
            summary.id,
        )
        return None

    messages = _build_messages(summary)

    extras: Optional[dict[str, Any]] = None
    for attempt in range(1, MAX_RETRIES + 1):
        result = await llm_complete(
            messages=messages,
            model=ENRICHMENT_MODEL,
            max_tokens=MAX_RESPONSE_TOKENS,
            temperature=0.3,
            json_mode=True,
        )
        if result is None or not result.content:
            logger.warning(
                "[SUMMARY-ENRICH] llm_complete empty (attempt %d/%d) summary=%s",
                attempt,
                MAX_RETRIES,
                summary.id,
            )
            continue

        try:
            parsed = json.loads(result.content)
        except json.JSONDecodeError as exc:
            logger.warning(
                "[SUMMARY-ENRICH] JSON decode error (attempt %d/%d) summary=%s: %s",
                attempt,
                MAX_RETRIES,
                summary.id,
                exc,
            )
            continue

        validated = _validate_extras_shape(parsed)
        if validated is None:
            logger.warning(
                "[SUMMARY-ENRICH] Shape validation failed (attempt %d/%d) summary=%s",
                attempt,
                MAX_RETRIES,
                summary.id,
            )
            continue

        extras = validated
        logger.info(
            "[SUMMARY-ENRICH] Extras generated OK summary=%s (quotes=%d, takeaways=%d, themes=%d)",
            summary.id,
            len(validated["key_quotes"]),
            len(validated["key_takeaways"]),
            len(validated["chapter_themes"]),
        )
        break

    return extras
