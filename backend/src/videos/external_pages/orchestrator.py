"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎼 orchestrator — Pipeline complet external_pages                                 ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Orchestrateur PR2 (spec 2026-05-17 §7) — wire-up :                                ║
║                                                                                    ║
║    video_info (description, channel, title, ...) + user_plan                       ║
║         │                                                                          ║
║         ▼                                                                          ║
║    1) extract_urls_from_text(description)                                          ║
║    2) clean_and_filter_urls(..., self_channel=channel_url)                         ║
║    3) resolve_urls(..., use_proxy=False)  # bare HEAD est suffisant                ║
║    4) cap par plan (PLAN_CAPS: free=0/pro=5/expert=10)                             ║
║    5) scrape_page x N en parallèle (Semaphore=5)                                   ║
║    6) summarize_page x N en parallèle (Semaphore=5)                                ║
║    7) build dict final {extracted_at, schema_version, stats, pages}                ║
║                                                                                    ║
║  Contrat strict :                                                                  ║
║  - NE LÈVE JAMAIS — toute exception est avalée à logger.warning et retourne None.  ║
║  - Free plan → retourne None (skip total).                                         ║
║  - Description vide / aucune URL → retourne None.                                  ║
║  - PR3 wire-up dans videos/router.py — pas dans cette PR.                          ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .constants import PLAN_CAPS
from .scraper import ScrapedPage, scrape_page
from .summarizer import PageSummary, summarize_page
from .url_extractor import clean_and_filter_urls, extract_urls_from_text
from .url_resolver import ResolvedURL, resolve_urls


logger = logging.getLogger("deepsight.external_pages.orchestrator")


# ═══════════════════════════════════════════════════════════════════════════════
# 🚦 Constantes
# ═══════════════════════════════════════════════════════════════════════════════

SCHEMA_VERSION: int = 1
MAX_CANDIDATES_BEFORE_RESOLVE: int = 20  # hard cap pré-resolve (spec R9)
SCRAPE_CONCURRENCY: int = 5
SUMMARIZE_CONCURRENCY: int = 5


# ═══════════════════════════════════════════════════════════════════════════════
# 🛠️ Helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _normalize_plan(plan: Optional[str]) -> str:
    """Normalise le plan (free/pro/expert) — best-effort sans import circulaire."""
    if not plan:
        return "free"
    p = plan.strip().lower()
    aliases = {"plus": "pro", "starter": "pro", "trial": "pro"}
    p = aliases.get(p, p)
    if p not in PLAN_CAPS:
        return "free"
    return p


def _extract_video_field(video_info: Dict[str, Any], *keys: str, default: str = "") -> str:
    """Récupère le premier champ non-vide de video_info parmi `keys`."""
    if not isinstance(video_info, dict):
        return default
    for key in keys:
        value = video_info.get(key)
        if value:
            return str(value)
    return default


async def _scrape_with_semaphore(
    sem: asyncio.Semaphore,
    resolved: ResolvedURL,
) -> Optional[ScrapedPage]:
    """Wrap scrape_page dans la sémaphore + try/except (jamais lève)."""
    async with sem:
        try:
            return await scrape_page(resolved.input_url, resolved.final_url)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[EXTERNAL_PAGES] scrape failed for %s: %s",
                resolved.final_url,
                exc,
            )
            return None


async def _summarize_with_semaphore(
    sem: asyncio.Semaphore,
    scraped: ScrapedPage,
    *,
    plan: str,
    creator_channel: str,
    video_title: str,
    lang: str,
) -> Optional[PageSummary]:
    """Wrap summarize_page dans la sémaphore + try/except (jamais lève)."""
    async with sem:
        try:
            return await summarize_page(
                scraped,
                plan=plan,
                creator_channel=creator_channel,
                video_title=video_title,
                lang=lang,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "[EXTERNAL_PAGES] summarize failed for %s: %s",
                scraped.final_url,
                exc,
            )
            return None


def _build_pages_payload(summaries: List[PageSummary]) -> List[Dict[str, Any]]:
    """Sérialise la liste PageSummary → JSON canonique (spec §6)."""
    return [
        {
            "url": p.url,
            "final_url": p.final_url,
            "title": p.title,
            "summary": p.summary,
            "key_claims": list(p.key_claims or []),
            "status": p.status,
            "fetched_via_proxy": bool(p.fetched_via_proxy),
            "bytes_fetched": int(p.bytes_fetched or 0),
        }
        for p in summaries
    ]


def _compute_stats(
    *,
    candidates_found: int,
    after_cleanup: int,
    after_cap: int,
    summaries: List[PageSummary],
) -> Dict[str, int]:
    """Calcule les stats du pipeline (spec §6)."""
    successful = sum(1 for p in summaries if p.status == "ok")
    paywalled = sum(1 for p in summaries if p.status == "paywall")
    errored = sum(
        1
        for p in summaries
        if p.status in ("error", "non_html", "http_error", "timeout", "empty")
    )
    return {
        "candidates_found": candidates_found,
        "after_dedup": after_cleanup,
        "after_blacklist": after_cleanup,
        "after_cap": after_cap,
        "successful": successful,
        "paywalled": paywalled,
        "errored": errored,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 extract_external_pages — Entry point
# ═══════════════════════════════════════════════════════════════════════════════


async def extract_external_pages(
    video_info: Dict[str, Any],
    user_plan: str,
    lang: str = "fr",
) -> Optional[Dict[str, Any]]:
    """Pipeline complet external_pages.

    Args:
        video_info : dict (au moins) `description`, `title`/`video_title`,
                     `channel`/`channel_name`, `channel_url`. Champs manquants
                     sont tolérés (string vide).
        user_plan  : "free" / "pro" / "expert" (legacy aliases résolus).
        lang       : "fr" (default) ou "en" — langue du résumé Mistral.

    Returns:
        - None si free plan ou aucune URL exploitable.
        - dict canonique {extracted_at, schema_version, stats, pages} sinon.

    Le pipeline NE LÈVE JAMAIS. Toute exception est avalée à logger.warning et
    retourne None proprement. Il appartient au caller (videos/router.py PR3)
    de décider quoi faire du None (skip persistence) ou du dict (persist sur
    Summary.external_pages).
    """
    try:
        # ── Plan gating
        plan = _normalize_plan(user_plan)
        cap = PLAN_CAPS.get(plan, 0)
        if cap <= 0:
            logger.debug("[EXTERNAL_PAGES] plan=%s cap=0 — skip", plan)
            return None

        # ── Inputs
        description = _extract_video_field(video_info, "description", "video_description")
        video_title = _extract_video_field(video_info, "title", "video_title")
        creator_channel = _extract_video_field(
            video_info, "channel", "channel_name", "video_channel"
        )
        channel_url = _extract_video_field(video_info, "channel_url")

        if not description:
            logger.debug("[EXTERNAL_PAGES] empty description — skip")
            return None

        started_at = datetime.now(timezone.utc)

        # ── 1) Extract URLs
        raw_urls = extract_urls_from_text(description)
        if not raw_urls:
            logger.debug("[EXTERNAL_PAGES] no URLs in description — skip")
            return None

        # ── 2) Clean + filter (blacklist + dedup + self-channel)
        cleaned = clean_and_filter_urls(
            raw_urls,
            self_channel_host=channel_url or None,
            max_count=MAX_CANDIDATES_BEFORE_RESOLVE,
        )
        if not cleaned:
            logger.debug("[EXTERNAL_PAGES] no URLs left after cleanup — skip")
            return None

        # ── 3) Resolve (HEAD, follow redirects, dedup par final_url)
        try:
            resolved = await resolve_urls(cleaned, use_proxy=False)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[EXTERNAL_PAGES] resolve_urls failed: %s", exc)
            resolved = []

        if not resolved:
            logger.info("[EXTERNAL_PAGES] no URL resolved — skip")
            return None

        # ── 4) Cap par plan
        capped: List[ResolvedURL] = resolved[:cap]

        # ── 5) Scrape concurrent (Semaphore=5)
        scrape_sem = asyncio.Semaphore(SCRAPE_CONCURRENCY)
        scrape_tasks = [_scrape_with_semaphore(scrape_sem, r) for r in capped]
        scraped_raw = await asyncio.gather(*scrape_tasks, return_exceptions=False)
        scraped: List[ScrapedPage] = [s for s in scraped_raw if s is not None]

        if not scraped:
            logger.info("[EXTERNAL_PAGES] all scrapes failed — skip")
            return None

        # ── 6) Summarize concurrent (Semaphore=5)
        summary_sem = asyncio.Semaphore(SUMMARIZE_CONCURRENCY)
        summary_tasks = [
            _summarize_with_semaphore(
                summary_sem,
                s,
                plan=plan,
                creator_channel=creator_channel,
                video_title=video_title,
                lang=lang,
            )
            for s in scraped
        ]
        summaries_raw = await asyncio.gather(*summary_tasks, return_exceptions=False)
        summaries: List[PageSummary] = [p for p in summaries_raw if p is not None]

        # ── 7) Build payload
        stats = _compute_stats(
            candidates_found=len(raw_urls),
            after_cleanup=len(cleaned),
            after_cap=len(capped),
            summaries=summaries,
        )
        pages = _build_pages_payload(summaries)

        elapsed = (datetime.now(timezone.utc) - started_at).total_seconds()
        logger.info(
            "[EXTERNAL_PAGES] done in %.1fs — plan=%s stats=%s",
            elapsed,
            plan,
            stats,
        )

        return {
            "extracted_at": started_at.isoformat(),
            "schema_version": SCHEMA_VERSION,
            "stats": stats,
            "pages": pages,
        }

    except Exception as exc:  # noqa: BLE001 — last-resort safety net
        logger.warning("[EXTERNAL_PAGES] pipeline crashed unexpectedly: %s", exc)
        return None
