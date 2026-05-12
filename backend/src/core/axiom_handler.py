"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📡 AXIOM HANDLER v1.0 — Centralized log drain to Axiom.co                         ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  • Async, non-blocking, drop-on-error (never breaks the request path)              ║
║  • Buffered batch flush (size + time-based) over httpx                             ║
║  • No-op when AXIOM_TOKEN is unset                                                 ║
║  • Adds DeepSight metadata (service, environment, version, request_id, user_id)   ║
║  • SAFE-BY-DESIGN: any handler exception is swallowed, app keeps running           ║
╚════════════════════════════════════════════════════════════════════════════════════╝

Design rationale
----------------
We do **not** use the official Axiom Python SDK on purpose:
  1. The handler must NEVER block a request, so flushes happen on a background
     thread driven by a queue (logging.Handler runs synchronously inside the
     caller's stack, even from async code via `asyncio.to_thread` or direct calls).
  2. We want zero new heavy dependency. `httpx` is already pulled in for HTTP/2
     and is the canonical HTTP client used everywhere in the backend.
  3. Direct POST to the ingest API gives us deterministic batching, hand-tuned
     retries, and full control over what fields are dropped (PII redaction).

The Axiom ingest endpoint accepts a JSON array of arbitrary objects. We send
the existing JSON log dict produced by `JSONFormatter` plus the Axiom convention
field `_time` (ISO 8601 timestamp) so the dataset timeline lights up correctly.

Reference: https://axiom.co/docs/send-data/ingest

Usage
-----
The handler is wired automatically by `core.logging` when `AXIOM_TOKEN` env var
is set. No code change is required at call site — every existing
`logger.info(...)`, `logger.error(...)` etc. is forked through this handler.

To activate in production, set on Hetzner `.env.production`:

    AXIOM_TOKEN=xaat-xxxx
    AXIOM_DATASET_NAME=deepsight-prod

Then `docker restart repo-backend-1`. Without these vars the handler is a no-op
(import succeeds, no thread spawned, no HTTP call) — there's zero overhead and
zero risk of breaking the prod backend if the Axiom API is unreachable.
"""

from __future__ import annotations

import atexit
import json
import logging
import os
import queue
import threading
import time
import traceback
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


# ═══════════════════════════════════════════════════════════════════════════════
# 🎛️ TUNING CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════════

# Flush whenever the buffer reaches this many records OR every FLUSH_INTERVAL_S
# seconds, whichever comes first.
DEFAULT_BATCH_SIZE = 100
DEFAULT_FLUSH_INTERVAL_S = 5.0

# Internal in-memory queue size. If the worker can't keep up (e.g. Axiom is
# down), records are dropped silently — we MUST never apply backpressure to the
# request path.
DEFAULT_QUEUE_MAXSIZE = 10_000

# HTTP timeouts (seconds). Axiom is normally <100ms p99, so 10s is plenty.
DEFAULT_HTTP_TIMEOUT_S = 10.0

# Max retries on transient HTTP errors (5xx, network). We don't retry forever
# because the worker has many more records to flush — a single batch is not
# worth blocking on.
DEFAULT_MAX_RETRIES = 2

# How long the worker waits at shutdown for the queue to drain before giving up.
SHUTDOWN_DRAIN_TIMEOUT_S = 3.0


# ═══════════════════════════════════════════════════════════════════════════════
# 🌐 CONFIG (read at module import — NOT cached aggressively, env always wins)
# ═══════════════════════════════════════════════════════════════════════════════


def _env(name: str, default: str = "") -> str:
    val = os.getenv(name, default)
    return val.strip() if val else default


def is_axiom_configured() -> bool:
    """Return True if AXIOM_TOKEN and AXIOM_DATASET_NAME are both set."""
    return bool(_env("AXIOM_TOKEN")) and bool(_env("AXIOM_DATASET_NAME"))


# ═══════════════════════════════════════════════════════════════════════════════
# 📡 AXIOM HANDLER
# ═══════════════════════════════════════════════════════════════════════════════


class AxiomHandler(logging.Handler):
    """
    Async, non-blocking logging handler that ships records to Axiom.co.

    Architecture
    ------------
        emit() ── put(nowait) ──> queue.Queue ──> _worker_loop() ──> httpx.post()
            (caller thread)        (bounded)       (daemon thread)     (Axiom)

    Failure modes (all handled silently — handler must NEVER raise):
      - Queue full        → record dropped (counter incremented).
      - HTTP 4xx/5xx      → batch dropped after retries.
      - Network error     → batch dropped after retries.
      - JSON encode error → record dropped.

    No exception ever propagates back to the caller. Use the `stats` property
    if you ever need to verify the drain is healthy.
    """

    # Class-level singleton: we want exactly ONE worker thread regardless of
    # how many DeepSightLogger instances attach the handler.
    _instance: "Optional[AxiomHandler]" = None
    _instance_lock = threading.Lock()

    @classmethod
    def get_or_create(
        cls,
        *,
        token: Optional[str] = None,
        dataset: Optional[str] = None,
        ingest_url: Optional[str] = None,
        batch_size: int = DEFAULT_BATCH_SIZE,
        flush_interval_s: float = DEFAULT_FLUSH_INTERVAL_S,
        queue_maxsize: int = DEFAULT_QUEUE_MAXSIZE,
        http_timeout_s: float = DEFAULT_HTTP_TIMEOUT_S,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> "Optional[AxiomHandler]":
        """
        Return the process-wide AxiomHandler singleton.

        Returns None if Axiom is not configured (token + dataset missing) so the
        caller can skip the .addHandler() step entirely.
        """
        token = token or _env("AXIOM_TOKEN")
        dataset = dataset or _env("AXIOM_DATASET_NAME")
        if not token or not dataset:
            return None

        with cls._instance_lock:
            if cls._instance is None:
                cls._instance = cls(
                    token=token,
                    dataset=dataset,
                    ingest_url=ingest_url or _env("AXIOM_INGEST_URL", "https://api.axiom.co"),
                    batch_size=batch_size,
                    flush_interval_s=flush_interval_s,
                    queue_maxsize=queue_maxsize,
                    http_timeout_s=http_timeout_s,
                    max_retries=max_retries,
                )
            return cls._instance

    def __init__(
        self,
        *,
        token: str,
        dataset: str,
        ingest_url: str = "https://api.axiom.co",
        batch_size: int = DEFAULT_BATCH_SIZE,
        flush_interval_s: float = DEFAULT_FLUSH_INTERVAL_S,
        queue_maxsize: int = DEFAULT_QUEUE_MAXSIZE,
        http_timeout_s: float = DEFAULT_HTTP_TIMEOUT_S,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        super().__init__()
        self._token = token
        self._dataset = dataset
        self._endpoint = f"{ingest_url.rstrip('/')}/v1/datasets/{dataset}/ingest"
        self._batch_size = batch_size
        self._flush_interval_s = flush_interval_s
        self._http_timeout_s = http_timeout_s
        self._max_retries = max_retries

        self._queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=queue_maxsize)
        self._stop_event = threading.Event()

        # Stats (best-effort, NOT thread-safe but counters drift is fine for
        # observability — we only read them via /admin/health if needed).
        self._sent = 0
        self._dropped_queue_full = 0
        self._dropped_http_error = 0
        self._dropped_encode_error = 0
        self._batches_failed = 0
        self._batches_sent = 0

        # Lazy httpx client (instantiated in worker thread to avoid touching
        # asyncio loops at import time).
        self._client: Any = None

        # Spin up the worker
        self._worker = threading.Thread(
            target=self._worker_loop,
            name="axiom-log-drain",
            daemon=True,
        )
        self._worker.start()

        # Best-effort flush at shutdown
        atexit.register(self._shutdown)

    # ── logging.Handler API ──────────────────────────────────────────────────

    def emit(self, record: logging.LogRecord) -> None:  # noqa: D401
        """Format the record and enqueue it (non-blocking)."""
        try:
            payload = self._record_to_payload(record)
        except Exception:
            # Encoding failed — drop and never raise.
            self._dropped_encode_error += 1
            return

        try:
            self._queue.put_nowait(payload)
        except queue.Full:
            self._dropped_queue_full += 1
            # No log here — would recurse into ourselves.

    # ── Internal: record → payload ───────────────────────────────────────────

    def _record_to_payload(self, record: logging.LogRecord) -> Dict[str, Any]:
        """
        Convert a LogRecord into the JSON body Axiom expects.

        We reuse whatever the upstream JSONFormatter produced when possible
        (the formatter is set on the StreamHandler, not on us). To stay
        self-sufficient and avoid ordering coupling, we re-derive the payload
        from raw record attributes here.
        """
        # Best-effort: pull request context if the contextvars are populated
        # by core.middleware.LoggingMiddleware. We import lazily to avoid
        # circular imports at module load (axiom_handler ← logging ← config).
        request_id = ""
        user_id: Optional[int] = None
        user_email: Optional[str] = None
        try:
            from core.logging import request_id_var, user_id_var, user_email_var  # type: ignore

            request_id = request_id_var.get()
            user_id = user_id_var.get()
            user_email = user_email_var.get()
        except Exception:  # noqa: BLE001
            pass

        payload: Dict[str, Any] = {
            "_time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": os.getenv("SERVICE_NAME", "deepsight-api"),
            "environment": os.getenv("ENVIRONMENT", os.getenv("ENV", "development")),
            "version": os.getenv("VERSION", "1.0.0"),
            "location": {
                "file": record.pathname,
                "line": record.lineno,
                "function": record.funcName,
            },
        }

        if request_id:
            payload["request_id"] = request_id
        if user_id:
            payload["user_id"] = user_id
        if user_email:
            payload["user_email"] = user_email

        # Structured extras attached by DeepSightLogger via record.extra_data
        extra = getattr(record, "extra_data", None)
        if extra:
            payload["extra"] = extra

        # Exception info — flatten into the payload for easy querying
        if record.exc_info:
            exc_type, exc_value, _tb = record.exc_info
            payload["exception"] = {
                "type": exc_type.__name__ if exc_type else None,
                "message": str(exc_value) if exc_value else None,
                "traceback": "".join(traceback.format_exception(*record.exc_info)),
            }

        return payload

    # ── Internal: worker loop ────────────────────────────────────────────────

    def _worker_loop(self) -> None:
        """
        Drain the queue in batches and POST to Axiom.

        We use a polling loop (not condition variables) because we need to
        flush on a time deadline even when the queue is below batch size.
        """
        # Lazy httpx import — keeps cold-start fast and respects fallback if
        # httpx ever vanishes (it shouldn't, but the handler must self-isolate).
        try:
            import httpx  # noqa: F401  (used inside _flush)

            self._httpx = httpx  # type: ignore[attr-defined]
            self._client = httpx.Client(
                timeout=self._http_timeout_s,
                http2=False,  # ingest is HTTP/1.1-friendly; avoid extra deps
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Content-Type": "application/json",
                    "User-Agent": "deepsight-axiom-handler/1.0",
                },
            )
        except Exception:  # noqa: BLE001
            # httpx unavailable — handler becomes a permanent no-op.
            return

        buffer: List[Dict[str, Any]] = []
        last_flush = time.monotonic()

        while not self._stop_event.is_set():
            timeout = max(0.0, self._flush_interval_s - (time.monotonic() - last_flush))
            try:
                item = self._queue.get(timeout=timeout)
                buffer.append(item)
            except queue.Empty:
                pass  # time-based flush below

            should_flush = len(buffer) >= self._batch_size or (
                buffer and (time.monotonic() - last_flush) >= self._flush_interval_s
            )
            if should_flush:
                self._flush(buffer)
                buffer = []
                last_flush = time.monotonic()

        # Drain on shutdown
        try:
            while True:
                buffer.append(self._queue.get_nowait())
                if len(buffer) >= self._batch_size:
                    self._flush(buffer)
                    buffer = []
        except queue.Empty:
            pass
        if buffer:
            self._flush(buffer)

        try:
            if self._client is not None:
                self._client.close()
        except Exception:  # noqa: BLE001
            pass

    def _flush(self, batch: List[Dict[str, Any]]) -> None:
        """Send a batch to Axiom with bounded retries. Drops on persistent failure."""
        if not batch or self._client is None:
            return

        try:
            body = json.dumps(batch, default=str, ensure_ascii=False)
        except Exception:  # noqa: BLE001
            # Whole batch unencodable — extremely unlikely, drop it.
            self._dropped_encode_error += len(batch)
            return

        attempt = 0
        while attempt <= self._max_retries:
            try:
                resp = self._client.post(self._endpoint, content=body)
                if 200 <= resp.status_code < 300:
                    self._sent += len(batch)
                    self._batches_sent += 1
                    return
                # 4xx → bad request, no point retrying. 5xx → retry.
                if 400 <= resp.status_code < 500:
                    self._dropped_http_error += len(batch)
                    self._batches_failed += 1
                    return
            except Exception:  # noqa: BLE001
                # Network / timeout. Retry.
                pass

            attempt += 1
            if attempt <= self._max_retries:
                # Linear backoff. Keep it short — log freshness matters.
                time.sleep(0.5 * attempt)

        # Out of retries
        self._dropped_http_error += len(batch)
        self._batches_failed += 1

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def _shutdown(self) -> None:
        """atexit hook: stop the worker and best-effort drain the queue."""
        if self._stop_event.is_set():
            return
        self._stop_event.set()
        self._worker.join(timeout=SHUTDOWN_DRAIN_TIMEOUT_S)

    # ── Observability ────────────────────────────────────────────────────────

    @property
    def stats(self) -> Dict[str, int]:
        """Return drain counters. Safe to call from anywhere."""
        return {
            "sent": self._sent,
            "batches_sent": self._batches_sent,
            "batches_failed": self._batches_failed,
            "dropped_queue_full": self._dropped_queue_full,
            "dropped_http_error": self._dropped_http_error,
            "dropped_encode_error": self._dropped_encode_error,
            "queue_size": self._queue.qsize(),
        }


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 PUBLIC HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


def install_axiom_handler(
    target_logger: logging.Logger,
    *,
    level: int = logging.INFO,
) -> Optional[AxiomHandler]:
    """
    Attach the Axiom handler to ``target_logger`` if env vars are set.

    Returns the singleton handler on success, None when Axiom is unconfigured.
    Idempotent: calling it twice on the same logger is safe (the handler tracks
    itself and won't be added a second time).
    """
    handler = AxiomHandler.get_or_create()
    if handler is None:
        return None

    handler.setLevel(level)
    if handler not in target_logger.handlers:
        target_logger.addHandler(handler)
    return handler


def get_axiom_stats() -> Optional[Dict[str, int]]:
    """Return current drain counters, or None if Axiom is not configured."""
    if AxiomHandler._instance is None:
        return None
    return AxiomHandler._instance.stats
