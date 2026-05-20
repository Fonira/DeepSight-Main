"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🧠 summarizer — Résumé Mistral d'une page externe (avec cache Redis 7j)           ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Étape 5 du pipeline external_pages (spec 2026-05-17 §5) :                         ║
║                                                                                    ║
║    ScrapedPage(status="ok")                                                        ║
║         │                                                                          ║
║         ▼                                                                          ║
║    summarize_page(scraped, ...) ──► PageSummary(url, final_url, title, summary,    ║
║                                                  key_claims, status, ...)          ║
║                                                                                    ║
║  - JSON mode Mistral (response_format=json_object)                                 ║
║  - max_tokens=300 (Pro) / 500 (Expert)                                             ║
║  - temperature=0.2                                                                 ║
║  - Cache Redis 7 jours, clé `vcache:external_page:{sha256(final_url)[:16]}`        ║
║  - Cache cross-user (invariant : même page → même résumé)                          ║
║  - Skip si scraped.status != "ok"                                                  ║
║  - Skip Mistral si scraped.text vide                                               ║
║  - Prompt système : TOUJOURS répondre en français même si page anglaise            ║
║                                                                                    ║
║  Status retournés :                                                                ║
║    "ok"      : Mistral a retourné un JSON parsable                                 ║
║    "paywall" / "non_html" / "empty" / "http_error" / "timeout" :                   ║
║              pass-through depuis le scraped (pas d'appel Mistral)                  ║
║    "error"   : Mistral a échoué ou le JSON est invalide → degraded                 ║
║                                                                                    ║
║  Module NE LÈVE JAMAIS — toute exception cache/LLM est avalée à debug-level.       ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from typing import List, Optional

from core.cache import cache_service
from core.llm_provider import llm_complete

from .scraper import ScrapedPage


logger = logging.getLogger("deepsight.external_pages.summarizer")


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 Constantes
# ═══════════════════════════════════════════════════════════════════════════════

CACHE_TTL_SECONDS: int = 7 * 24 * 3600  # 7 jours (spec §5)
CACHE_PREFIX: str = "vcache:external_page:"
MAX_TEXT_FOR_PROMPT: int = 6000  # chars envoyés à Mistral (spec §5)
MAX_KEY_CLAIMS: int = 4
MAX_SUMMARY_CHARS: int = 600  # garde-fou si Mistral dérape

# Mapping plan → modèle Mistral (cohérent avec billing/plan_config)
PLAN_TO_MODEL = {
    "free": "mistral-small-2603",
    "pro": "mistral-medium-2508",
    "expert": "mistral-large-2512",
}

# max_tokens par plan (spec §8)
PLAN_TO_MAX_TOKENS = {
    "free": 300,
    "pro": 300,
    "expert": 500,
}


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 Dataclass — PageSummary
# ═══════════════════════════════════════════════════════════════════════════════


@dataclass
class PageSummary:
    """Résumé d'une page externe.

    Attributs :
        url               : URL d'origine (avant resolve)
        final_url         : URL finale post-resolve
        title             : Titre extrait (peut être None)
        summary           : 2-3 phrases en français (None si scrape failed)
        key_claims        : 1-4 affirmations clés (liste vide si scrape failed)
        status            : "ok" / pass-through du scraped status / "error"
        fetched_via_proxy : True si scrape via Decodo
        bytes_fetched     : Octets téléchargés au scrape
        cached            : True si le résumé vient du cache Redis
    """

    url: str
    final_url: str
    title: Optional[str]
    summary: Optional[str]
    key_claims: List[str]
    status: str
    fetched_via_proxy: bool = False
    bytes_fetched: int = 0
    cached: bool = False


# ═══════════════════════════════════════════════════════════════════════════════
# 🔑 Cache key helper
# ═══════════════════════════════════════════════════════════════════════════════


def _cache_key(final_url: str) -> str:
    """Clé Redis cross-user — sha256(final_url) tronqué à 16 chars hex.

    On hash pour éviter d'exposer des URLs longues comme clés Redis et garder
    la longueur bornée. Préfixe `vcache:external_page:` (cohérent avec le reste
    du namespace cache DeepSight).
    """
    h = hashlib.sha256(final_url.encode("utf-8")).hexdigest()[:16]
    return f"{CACHE_PREFIX}{h}"


# ═══════════════════════════════════════════════════════════════════════════════
# ✉️ Prompt builder
# ═══════════════════════════════════════════════════════════════════════════════


def _build_prompt(
    page_text: str,
    page_title: Optional[str],
    *,
    creator_channel: str,
    video_title: str,
    lang: str = "fr",
) -> List[dict]:
    """Construit le prompt JSON-mode (spec §5).

    Le system enforce :
    - factuel, neutre, jamais promotionnel
    - sortie en `lang` (default "fr")
    - JSON strict { summary, key_claims }
    """
    target_lang = "français" if lang == "fr" else "anglais"

    system = (
        "Tu es un assistant qui résume des pages web citées par des créateurs vidéo. "
        "Sois factuel, neutre, jamais promotionnel. "
        f"Résume TOUJOURS en {target_lang} même si la page est dans une autre langue. "
        "Réponds en JSON strict avec les clés 'summary' (2-3 phrases claires) et "
        "'key_claims' (liste de 1 à 3 affirmations clés ou faits, chacune ≤ 15 mots)."
    )

    context_line = ""
    if creator_channel and video_title:
        context_line = (
            f"Contexte : cette page est citée dans la description de la vidéo "
            f"« {video_title} » par le créateur « {creator_channel} ».\n\n"
        )
    elif video_title:
        context_line = f"Contexte : cette page est citée dans la vidéo « {video_title} ».\n\n"

    user = (
        f"{context_line}"
        f"Titre de la page : {page_title or 'inconnu'}\n\n"
        f"Contenu de la page (extrait) :\n{page_text[:MAX_TEXT_FOR_PROMPT]}\n\n"
        f"Résume cette page en 2-3 phrases claires en {target_lang}. "
        f"Liste 1-3 affirmations clés. Réponds en JSON "
        f'{{"summary": "...", "key_claims": ["...", "..."]}}'
    )

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


# ═══════════════════════════════════════════════════════════════════════════════
# 🧠 summarize_page — Entry point
# ═══════════════════════════════════════════════════════════════════════════════


def _normalize_plan(plan: Optional[str]) -> str:
    """Normalise le plan vers free/pro/expert (best-effort, sans import circulaire)."""
    if not plan:
        return "free"
    p = plan.strip().lower()
    # Aliases legacy (cohérent avec billing/plan_config.normalize_plan_id)
    aliases = {"plus": "pro", "starter": "pro", "trial": "pro"}
    p = aliases.get(p, p)
    if p not in PLAN_TO_MODEL:
        return "free"
    return p


def _passthrough(
    scraped: ScrapedPage,
    *,
    summary: Optional[str] = None,
    key_claims: Optional[List[str]] = None,
    status: Optional[str] = None,
    cached: bool = False,
) -> PageSummary:
    """Helper : crée un PageSummary avec metadata du scraped."""
    return PageSummary(
        url=scraped.url,
        final_url=scraped.final_url,
        title=scraped.title,
        summary=summary,
        key_claims=key_claims if key_claims is not None else [],
        status=status if status is not None else scraped.status,
        fetched_via_proxy=scraped.fetched_via_proxy,
        bytes_fetched=scraped.bytes_fetched,
        cached=cached,
    )


async def summarize_page(
    scraped: ScrapedPage,
    *,
    plan: str = "pro",
    creator_channel: str = "",
    video_title: str = "",
    lang: str = "fr",
) -> PageSummary:
    """Résume une page scraped via Mistral + cache Redis (cross-user).

    Args:
        scraped         : ScrapedPage du module scraper.
        plan            : Plan user — détermine le modèle Mistral et max_tokens.
        creator_channel : Nom du créateur (contextualise le prompt).
        video_title     : Titre de la vidéo (contextualise le prompt).
        lang            : "fr" (default) ou "en" — langue du résumé Mistral.

    Returns:
        PageSummary — jamais None, jamais lève.

    Comportement :
      1. Si scraped.status != "ok" OU scraped.text vide → passthrough.
      2. Cache HIT → retourne PageSummary(cached=True), pas d'appel Mistral.
      3. Cache MISS → appel llm_complete json_mode, parse, set cache, return.
      4. Sur exception Mistral → status="error", pas de cache set.
      5. Sur JSON invalide → degraded summary (premier 500 chars du raw), pas de cache.
    """
    # ── Skip si scrape failed
    if scraped.status != "ok" or not scraped.text:
        return _passthrough(scraped)

    # ── Cache lookup (cross-user)
    ckey = _cache_key(scraped.final_url)
    cached_raw = None
    try:
        cached_raw = await cache_service.get(ckey)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[EXTERNAL_PAGES] cache get failed for %s: %s", ckey, exc)

    if cached_raw is not None:
        try:
            cached_data = json.loads(cached_raw) if isinstance(cached_raw, (str, bytes, bytearray)) else cached_raw
            if isinstance(cached_data, dict):
                summary = cached_data.get("summary")
                key_claims = cached_data.get("key_claims") or []
                if not isinstance(key_claims, list):
                    key_claims = []
                return PageSummary(
                    url=scraped.url,
                    final_url=scraped.final_url,
                    title=cached_data.get("title") or scraped.title,
                    summary=summary,
                    key_claims=[str(c).strip() for c in key_claims if c][:MAX_KEY_CLAIMS],
                    status="ok",
                    fetched_via_proxy=scraped.fetched_via_proxy,
                    bytes_fetched=scraped.bytes_fetched,
                    cached=True,
                )
        except Exception as exc:  # noqa: BLE001
            logger.debug("[EXTERNAL_PAGES] cache parse failed for %s: %s", ckey, exc)

    # ── Cache MISS → appel Mistral
    normalized_plan = _normalize_plan(plan)
    model = PLAN_TO_MODEL[normalized_plan]
    max_tokens = PLAN_TO_MAX_TOKENS[normalized_plan]

    messages = _build_prompt(
        scraped.text,
        scraped.title,
        creator_channel=creator_channel,
        video_title=video_title,
        lang=lang,
    )

    llm_result = None
    try:
        llm_result = await llm_complete(
            messages=messages,
            model=model,
            max_tokens=max_tokens,
            temperature=0.2,
            timeout=20.0,
            json_mode=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "[EXTERNAL_PAGES] Mistral call failed for %s: %s",
            scraped.final_url,
            exc,
        )

    # ── Mistral KO → status="error", pas de cache
    if not llm_result or not getattr(llm_result, "content", None):
        return _passthrough(scraped, status="error")

    raw = llm_result.content.strip()

    # ── Parse JSON
    summary: Optional[str] = None
    key_claims: List[str] = []
    parse_ok = False

    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            summary = (data.get("summary") or "").strip() or None
            kc_raw = data.get("key_claims") or []
            if isinstance(kc_raw, list):
                key_claims = [str(c).strip() for c in kc_raw if c][:MAX_KEY_CLAIMS]
            parse_ok = True
    except (json.JSONDecodeError, AttributeError, TypeError) as exc:
        logger.debug(
            "[EXTERNAL_PAGES] JSON parse failed for %s: %s",
            scraped.final_url,
            exc,
        )

    if not parse_ok or not summary:
        # Degraded — on conserve le raw tronqué comme summary, pas de cache set
        degraded_summary = raw[:MAX_SUMMARY_CHARS] if raw else None
        return PageSummary(
            url=scraped.url,
            final_url=scraped.final_url,
            title=scraped.title,
            summary=degraded_summary,
            key_claims=[],
            status="ok" if degraded_summary else "error",
            fetched_via_proxy=scraped.fetched_via_proxy,
            bytes_fetched=scraped.bytes_fetched,
            cached=False,
        )

    # Garde-fou sur la longueur du summary (Mistral peut déborder)
    if summary and len(summary) > MAX_SUMMARY_CHARS:
        summary = summary[:MAX_SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"

    # ── Cache set (best-effort)
    try:
        payload = json.dumps(
            {
                "title": scraped.title,
                "summary": summary,
                "key_claims": key_claims,
            },
            ensure_ascii=False,
        )
        await cache_service.set(ckey, payload, ttl=CACHE_TTL_SECONDS)
    except Exception as exc:  # noqa: BLE001
        logger.debug("[EXTERNAL_PAGES] cache set failed for %s: %s", ckey, exc)

    return PageSummary(
        url=scraped.url,
        final_url=scraped.final_url,
        title=scraped.title,
        summary=summary,
        key_claims=key_claims,
        status="ok",
        fetched_via_proxy=scraped.fetched_via_proxy,
        bytes_fetched=scraped.bytes_fetched,
        cached=False,
    )
