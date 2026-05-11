"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📡 PROXY TELEMETRY — Bandwidth tracking + budget alerts pour proxy Decodo        ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  RÔLE                                                                              ║
║  • Compter les bytes_in/bytes_out passés à travers le proxy Decodo (Pay As You   ║
║    Go, $4/GB). Wallet = $12 ≈ 3 mois si on tient sous 1 GB/mois.                  ║
║  • Persister dans `proxy_usage_daily` (DATE PK, BIGINT bytes_in/out + JSONB        ║
║    breakdown par provider).                                                        ║
║  • Émettre un event PostHog `proxy_bandwidth_used` à chaque palier de 100 MB      ║
║    cumulés (par requête) pour alimenter le dashboard 663159.                       ║
║  • Hard-stop budget : si `PROXY_DISABLED=true` (env var) OU MTD > 950 MB,         ║
║    `should_bypass_proxy()` retourne True → fallback bare (requête directe). Le    ║
║    middleware NE BLOQUE JAMAIS la requête. Toujours dégradation gracieuse.        ║
║                                                                                    ║
║  USAGE                                                                             ║
║      from middleware.proxy_telemetry import (                                     ║
║          record_proxy_usage,                                                       ║
║          should_bypass_proxy,                                                      ║
║          ProxyByteCounter,                                                         ║
║      )                                                                             ║
║                                                                                    ║
║      # Option 1 — Manual tracking après un appel proxifié:                        ║
║      await record_proxy_usage(                                                     ║
║          provider="ytdlp",                                                         ║
║          bytes_in=len(response_body),                                              ║
║          bytes_out=len(request_body),                                              ║
║      )                                                                             ║
║                                                                                    ║
║      # Option 2 — Streaming counter pour httpx async response:                    ║
║      counter = ProxyByteCounter(provider="httpx")                                  ║
║      async with httpx.AsyncClient(proxy=proxy_url) as client:                     ║
║          async with client.stream("GET", url) as resp:                            ║
║              async for chunk in resp.aiter_bytes():                               ║
║                  counter.add(len(chunk))                                           ║
║                  ...                                                                ║
║      await counter.flush()                                                         ║
║                                                                                    ║
║      # Option 3 — Hard-stop check au call site:                                   ║
║      if not should_bypass_proxy():                                                 ║
║          cmd.extend(["--proxy", proxy_url])                                       ║
║                                                                                    ║
║  THREAD-SAFETY                                                                     ║
║  • PostHog flush state est protégé par `asyncio.Lock` (per-event-loop).           ║
║  • DB writes utilisent UPSERT atomique (ON CONFLICT DO UPDATE) côté PostgreSQL    ║
║    et la branche SQLite équivalente (INSERT OR REPLACE + SUM via SELECT).         ║
║                                                                                    ║
║  TECH-DEBT                                                                         ║
║  • Pas de batching pour les DB writes : chaque appel = 1 UPSERT. Volume estimé    ║
║    < 100 req/min → acceptable. Si charge augmente, batcher via un buffer in-memory ║
║    avec flush périodique (5 s).                                                    ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import date
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import get_youtube_proxy
from core.logging import logger

# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Flush PostHog event every N bytes cumulés (par compteur). 100 MB = bon
# compromis entre granularité dashboard et nombre d'events PostHog.
_POSTHOG_FLUSH_THRESHOLD_BYTES = 100 * 1024 * 1024  # 100 MB

# Hard-stop budget : MTD > ce seuil → fallback bare. 950 MB sur budget mensuel
# 1 GB (4 USD/GB × wallet 12 USD = 3 GB total dispo, vise 1 GB/mois pour 3 mois).
# Choisi inférieur au seuil n8n (800 MB warn) pour laisser ~150 MB de marge entre
# alerte humaine et coupure auto.
HARD_STOP_THRESHOLD_BYTES = 950 * 1024 * 1024  # 950 MB

# Cache MTD pour éviter de query DB à chaque should_bypass_proxy(). TTL court (60s)
# pour ne pas wisper trop sur les transitions de seuil.
_MTD_CACHE_TTL_SECONDS = 60.0


# ═══════════════════════════════════════════════════════════════════════════════
# 🔁 STATE MANAGEMENT — Per-event-loop locks + MTD cache
# ═══════════════════════════════════════════════════════════════════════════════


class _State:
    """Per-process state pour PostHog flush counter + cache MTD."""

    def __init__(self) -> None:
        # Bytes cumulés depuis le dernier flush PostHog (in + out).
        # Reset à chaque flush. Per-process (worker FastAPI), pas global cross-worker.
        self.pending_bytes_since_last_flush: int = 0
        # Lock async pour serialize flush_event + cumul.
        self._lock: Optional[asyncio.Lock] = None
        # Cache MTD bytes — (mtd_bytes, ts_monotonic)
        self._mtd_cache: Optional[tuple[int, float]] = None

    def _get_lock(self) -> asyncio.Lock:
        # Lazy init pour éviter "Event loop not running" à l'import.
        if self._lock is None:
            self._lock = asyncio.Lock()
        return self._lock


_state = _State()


def _reset_state_for_tests() -> None:
    """Reset le state in-memory (helper test-only)."""
    global _state
    _state = _State()


# ═══════════════════════════════════════════════════════════════════════════════
# 🛡️ HARD-STOP — Budget enforcement
# ═══════════════════════════════════════════════════════════════════════════════


def _proxy_disabled_env() -> bool:
    """Lecture env var `PROXY_DISABLED` — fail-open (default false)."""
    raw = os.environ.get("PROXY_DISABLED", "").strip().lower()
    return raw in ("true", "1", "yes", "on")


async def get_mtd_bytes(session: Optional[AsyncSession] = None) -> int:
    """Retourne le total bytes (in+out) cumulés month-to-date.

    Utilise un cache TTL 60 s pour ne pas hitter la DB à chaque appel runtime
    de `should_bypass_proxy()`. Si `session` est fourni, refresh le cache.

    Si la DB n'est pas joignable, retourne 0 (fail-open : on ne bloque pas le
    proxy si on ne peut pas lire le compteur).
    """
    loop = asyncio.get_event_loop()
    now = loop.time()

    if _state._mtd_cache is not None:
        cached_bytes, cached_at = _state._mtd_cache
        if (now - cached_at) < _MTD_CACHE_TTL_SECONDS:
            return cached_bytes

    if session is None:
        # Pas de session fournie → ouvre une session ad-hoc
        try:
            from db.database import async_session_maker

            async with async_session_maker() as ad_hoc:
                total = await _fetch_mtd_total(ad_hoc)
        except Exception as e:
            logger.debug(f"[PROXY_TELEMETRY] get_mtd_bytes failed (ad-hoc session): {e}")
            return 0
    else:
        try:
            total = await _fetch_mtd_total(session)
        except Exception as e:
            logger.debug(f"[PROXY_TELEMETRY] get_mtd_bytes failed: {e}")
            return 0

    _state._mtd_cache = (total, now)
    return total


async def _fetch_mtd_total(session: AsyncSession) -> int:
    """Query proxy_usage_daily pour le mois en cours et somme bytes_in+bytes_out."""
    today = date.today()
    first_of_month = today.replace(day=1)

    result = await session.execute(
        text(
            "SELECT COALESCE(SUM(bytes_in), 0) + COALESCE(SUM(bytes_out), 0) "
            "FROM proxy_usage_daily WHERE date >= :first_of_month"
        ),
        {"first_of_month": first_of_month},
    )
    return int(result.scalar() or 0)


def should_bypass_proxy(mtd_bytes: Optional[int] = None) -> bool:
    """Retourne True si le proxy doit être bypass (fallback bare).

    Conditions :
      • `PROXY_DISABLED=true` (env var, kill-switch immédiat sans restart)
      • MTD > HARD_STOP_THRESHOLD_BYTES (950 MB)

    Si `mtd_bytes` n'est pas fourni, lit le cache (ou retourne False si pas de
    cache encore peuplé — fail-open).
    """
    if _proxy_disabled_env():
        logger.warning("[PROXY_TELEMETRY] PROXY_DISABLED=true — bypass proxy, fallback bare")
        return True

    if mtd_bytes is None:
        # Lit cache sans hit DB (sync context, on ne peut pas await ici).
        if _state._mtd_cache is not None:
            mtd_bytes, _ = _state._mtd_cache
        else:
            return False

    if mtd_bytes > HARD_STOP_THRESHOLD_BYTES:
        logger.warning(
            f"[PROXY_TELEMETRY] MTD {mtd_bytes / (1024 * 1024):.1f} MB > "
            f"hard-stop {HARD_STOP_THRESHOLD_BYTES / (1024 * 1024):.0f} MB — bypass proxy"
        )
        return True

    return False


async def should_bypass_proxy_async(session: Optional[AsyncSession] = None) -> bool:
    """Version async qui refresh le cache MTD via DB avant le check."""
    if _proxy_disabled_env():
        logger.warning("[PROXY_TELEMETRY] PROXY_DISABLED=true — bypass proxy, fallback bare")
        return True

    mtd = await get_mtd_bytes(session)
    return should_bypass_proxy(mtd_bytes=mtd)


def is_proxy_configured() -> bool:
    """Retourne True si le proxy est configuré côté env. Utile pour skip le
    tracking quand on tourne sans proxy (dev local sans Decodo)."""
    return bool(get_youtube_proxy())


# ═══════════════════════════════════════════════════════════════════════════════
# 💾 PERSISTENCE — UPSERT proxy_usage_daily
# ═══════════════════════════════════════════════════════════════════════════════


async def _upsert_usage(
    session: AsyncSession,
    *,
    provider: str,
    bytes_in: int,
    bytes_out: int,
) -> None:
    """Atomic UPSERT sur proxy_usage_daily pour aujourd'hui.

    Compatible PostgreSQL (ON CONFLICT) ET SQLite (INSERT OR REPLACE + SUM via
    sous-query). On dispatch via le dialecte du bind.
    """
    today = date.today()
    bind = session.get_bind()
    dialect = bind.dialect.name  # 'postgresql' | 'sqlite' | ...

    # JSONB delta pour requests_by_provider — on stocke un compteur par provider.
    # PostgreSQL : utilise jsonb_set + COALESCE pour incrémenter de manière atomique.
    # SQLite : load → merge → save (pas atomique mais SQLite single-writer suffit).
    if dialect == "postgresql":
        # ON CONFLICT (date) DO UPDATE — incrémente les compteurs.
        # `requests_by_provider || jsonb_build_object(...)` ne fait que merger,
        # il faut +1 sur la valeur existante : on lit + incrémente avec COALESCE.
        await session.execute(
            text(
                """
                INSERT INTO proxy_usage_daily (date, bytes_in, bytes_out, requests_total, requests_by_provider)
                VALUES (
                    :date,
                    :bytes_in,
                    :bytes_out,
                    1,
                    jsonb_build_object(:provider, 1)
                )
                ON CONFLICT (date) DO UPDATE SET
                    bytes_in = proxy_usage_daily.bytes_in + EXCLUDED.bytes_in,
                    bytes_out = proxy_usage_daily.bytes_out + EXCLUDED.bytes_out,
                    requests_total = proxy_usage_daily.requests_total + 1,
                    requests_by_provider = jsonb_set(
                        COALESCE(proxy_usage_daily.requests_by_provider, '{}'::jsonb),
                        ARRAY[:provider],
                        to_jsonb(
                            COALESCE(
                                (proxy_usage_daily.requests_by_provider->>:provider)::int,
                                0
                            ) + 1
                        ),
                        true
                    )
                """
            ),
            {
                "date": today,
                "bytes_in": bytes_in,
                "bytes_out": bytes_out,
                "provider": provider,
            },
        )
    else:
        # SQLite branche fallback : SELECT + INSERT/UPDATE manuel.
        existing = await session.execute(
            text(
                "SELECT bytes_in, bytes_out, requests_total, requests_by_provider "
                "FROM proxy_usage_daily WHERE date = :date"
            ),
            {"date": today.isoformat()},
        )
        row = existing.first()
        if row is None:
            await session.execute(
                text(
                    "INSERT INTO proxy_usage_daily "
                    "(date, bytes_in, bytes_out, requests_total, requests_by_provider) "
                    "VALUES (:date, :bytes_in, :bytes_out, 1, :rbp)"
                ),
                {
                    "date": today.isoformat(),
                    "bytes_in": bytes_in,
                    "bytes_out": bytes_out,
                    "rbp": json.dumps({provider: 1}),
                },
            )
        else:
            existing_bytes_in = row[0] or 0
            existing_bytes_out = row[1] or 0
            existing_total = row[2] or 0
            existing_rbp_raw = row[3]
            if isinstance(existing_rbp_raw, str):
                existing_rbp = json.loads(existing_rbp_raw) if existing_rbp_raw else {}
            elif isinstance(existing_rbp_raw, dict):
                existing_rbp = existing_rbp_raw
            else:
                existing_rbp = {}
            existing_rbp[provider] = int(existing_rbp.get(provider, 0)) + 1

            await session.execute(
                text(
                    "UPDATE proxy_usage_daily SET "
                    "bytes_in = :bytes_in, bytes_out = :bytes_out, "
                    "requests_total = :total, requests_by_provider = :rbp "
                    "WHERE date = :date"
                ),
                {
                    "date": today.isoformat(),
                    "bytes_in": existing_bytes_in + bytes_in,
                    "bytes_out": existing_bytes_out + bytes_out,
                    "total": existing_total + 1,
                    "rbp": json.dumps(existing_rbp),
                },
            )

    await session.commit()
    # Invalide le cache MTD pour que le prochain `should_bypass_proxy_async`
    # rafraîchisse correctement.
    _state._mtd_cache = None


# ═══════════════════════════════════════════════════════════════════════════════
# 📤 POSTHOG FLUSH — Event toutes les 100 MB cumulées
# ═══════════════════════════════════════════════════════════════════════════════


async def _maybe_flush_posthog(
    *,
    provider: str,
    bytes_in: int,
    bytes_out: int,
    mtd_total_bytes: int,
) -> None:
    """Cumule bytes_in+bytes_out dans le compteur de flush. Si on dépasse 100 MB
    depuis le dernier flush, on émet un event PostHog `proxy_bandwidth_used` et
    on reset le compteur."""
    lock = _state._get_lock()
    async with lock:
        _state.pending_bytes_since_last_flush += bytes_in + bytes_out
        if _state.pending_bytes_since_last_flush < _POSTHOG_FLUSH_THRESHOLD_BYTES:
            return
        flushed = _state.pending_bytes_since_last_flush
        _state.pending_bytes_since_last_flush = 0

    # Émission hors lock — best-effort, ne doit pas bloquer les call sites.
    try:
        from services.posthog_service import capture_event

        await capture_event(
            distinct_id="server",
            event="proxy_bandwidth_used",
            properties={
                "bytes_in": bytes_in,
                "bytes_out": bytes_out,
                "provider": provider,
                "flushed_bytes": flushed,
                "mtd_total_bytes": mtd_total_bytes,
                "mtd_total_mb": round(mtd_total_bytes / (1024 * 1024), 2),
            },
        )
        logger.info(
            f"[PROXY_TELEMETRY] flushed PostHog event "
            f"({flushed / (1024 * 1024):.1f} MB cumulés, "
            f"MTD={mtd_total_bytes / (1024 * 1024):.1f} MB)"
        )
    except Exception as e:
        logger.debug(f"[PROXY_TELEMETRY] PostHog flush failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 🔄 PUBLIC API — record_proxy_usage + ProxyByteCounter
# ═══════════════════════════════════════════════════════════════════════════════


async def record_proxy_usage(
    *,
    provider: str,
    bytes_in: int,
    bytes_out: int = 0,
    session: Optional[AsyncSession] = None,
) -> None:
    """Enregistre une utilisation du proxy (bytes_in + bytes_out).

    Args:
        provider: identifiant logique du call site (`ytdlp`, `youtube_transcript_api`,
            `httpx`, etc.) — alimente le breakdown `requests_by_provider`.
        bytes_in: octets téléchargés via le proxy (response body).
        bytes_out: octets uploadés via le proxy (request body, généralement faible).
        session: optionnel — si fourni, réutilise la session DB en cours. Sinon
            ouvre une session ad-hoc via `async_session_maker`.

    Best-effort : toute exception est avalée à debug-level, jamais bloquant.
    Skip si le proxy n'est pas configuré (dev local) OU si bytes total = 0.
    """
    if not is_proxy_configured():
        return
    if bytes_in <= 0 and bytes_out <= 0:
        return

    try:
        if session is None:
            from db.database import async_session_maker

            async with async_session_maker() as ad_hoc:
                await _upsert_usage(
                    ad_hoc,
                    provider=provider,
                    bytes_in=bytes_in,
                    bytes_out=bytes_out,
                )
                mtd = await _fetch_mtd_total(ad_hoc)
        else:
            await _upsert_usage(
                session,
                provider=provider,
                bytes_in=bytes_in,
                bytes_out=bytes_out,
            )
            mtd = await _fetch_mtd_total(session)
    except Exception as e:
        logger.debug(f"[PROXY_TELEMETRY] record_proxy_usage DB upsert failed: {e}")
        return

    await _maybe_flush_posthog(
        provider=provider,
        bytes_in=bytes_in,
        bytes_out=bytes_out,
        mtd_total_bytes=mtd,
    )


class ProxyByteCounter:
    """Compteur incrémental pour les streams httpx/aiohttp.

    Usage :
        counter = ProxyByteCounter(provider="visual_integration")
        async with client.stream("GET", url) as resp:
            content_length = resp.headers.get("content-length")
            if content_length:
                counter.set_content_length(int(content_length))
            async for chunk in resp.aiter_bytes():
                counter.add(len(chunk))
                ...
        await counter.flush()

    `set_content_length` est fourni à titre informatif : on tracke les bytes
    EFFECTIVEMENT lus (`add()`) pour ne pas surestimer en cas de download
    abandonné (timeout, ctrl-c). Le content-length sert juste de borne sup
    pour la cohérence des logs debug.
    """

    def __init__(self, provider: str, bytes_out: int = 0) -> None:
        self.provider = provider
        self.bytes_in: int = 0
        self.bytes_out: int = bytes_out
        self.content_length: Optional[int] = None
        self._flushed: bool = False

    def set_content_length(self, length: int) -> None:
        """Hint informatif sur la taille attendue (Content-Length)."""
        self.content_length = length

    def add(self, n: int) -> None:
        """Ajoute `n` bytes au compteur bytes_in (chunk lu en streaming)."""
        if n > 0:
            self.bytes_in += n

    def add_out(self, n: int) -> None:
        """Ajoute `n` bytes au compteur bytes_out (request body envoyé)."""
        if n > 0:
            self.bytes_out += n

    async def flush(self, session: Optional[AsyncSession] = None) -> None:
        """Persiste les bytes accumulés dans la DB + check PostHog flush."""
        if self._flushed:
            return
        self._flushed = True
        await record_proxy_usage(
            provider=self.provider,
            bytes_in=self.bytes_in,
            bytes_out=self.bytes_out,
            session=session,
        )


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 BOOT CHECK — Log état au démarrage
# ═══════════════════════════════════════════════════════════════════════════════


def log_boot_state() -> None:
    """Logger lisible à appeler depuis main.py au boot."""
    disabled = _proxy_disabled_env()
    configured = is_proxy_configured()
    logger.info(
        f"[PROXY_TELEMETRY] boot — proxy configured={configured} "
        f"PROXY_DISABLED={disabled} "
        f"hard_stop_threshold_mb={HARD_STOP_THRESHOLD_BYTES / (1024 * 1024):.0f}"
    )


__all__ = [
    "HARD_STOP_THRESHOLD_BYTES",
    "ProxyByteCounter",
    "_reset_state_for_tests",
    "get_mtd_bytes",
    "is_proxy_configured",
    "log_boot_state",
    "record_proxy_usage",
    "should_bypass_proxy",
    "should_bypass_proxy_async",
]
