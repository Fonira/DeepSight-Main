"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📧 EMAIL QUEUE — Async email queue avec throttling pour Resend                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Résout le problème de rate limiting Resend (429 errors).                          ║
║  Resend Free: 100 emails/jour, 1 req/s | Pro: 50k/mois, 10 req/s                 ║
║                                                                                    ║
║  Usage:                                                                            ║
║    from services.email_queue import email_queue                                    ║
║    await email_queue.enqueue(to="user@mail.com", subject="...", html="...")         ║
║                                                                                    ║
║  Le worker tourne en background et envoie les emails en respectant le rate limit.  ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
import time
import logging
from dataclasses import dataclass, field
from typing import Optional
from collections import deque

import httpx

from core.config import EMAIL_CONFIG, APP_NAME
from core.email_rate_limiter import (
    ResendRateLimitError,
    send_with_rate_limit,
)

logger = logging.getLogger("deepsight.email_queue")

RESEND_API_URL = "https://api.resend.com/emails"

# ═══════════════════════════════════════════════════════════════════════════════
# 📊 CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Resend rate limits (conservative — compatible plan Free & Pro)
MAX_EMAILS_PER_SECOND = 2       # Resend Free = 1/s, Pro = 10/s → on prend 2 par sécurité
MIN_INTERVAL_SECONDS = 1.0 / MAX_EMAILS_PER_SECOND  # 0.5s entre chaque email
MAX_RETRIES = 3                 # Nombre de retry sur 429/5xx
RETRY_BACKOFF_BASE = 5.0        # Backoff exponentiel : 5s, 10s, 20s
MAX_QUEUE_SIZE = 500            # Protection mémoire
WORKER_CHECK_INTERVAL = 0.5     # Fréquence de vérification de la queue


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 EMAIL ITEM
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class EmailItem:
    """Un email en attente d'envoi."""
    to: str
    subject: str
    html: str
    text: str = ""
    retries: int = 0
    created_at: float = field(default_factory=time.time)
    priority: int = 0  # 0 = normal, 1 = high (verification, reset password)


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 EMAIL QUEUE SERVICE
# ═══════════════════════════════════════════════════════════════════════════════

class EmailQueue:
    """
    Queue async avec throttling pour les emails Resend.

    - Respecte le rate limit Resend (token bucket)
    - Retry automatique sur 429/5xx avec backoff exponentiel
    - Priorité pour les emails critiques (vérification, reset)
    - Protection mémoire (max queue size)
    - Metrics pour monitoring
    """

    def __init__(self):
        self._queue: deque[EmailItem] = deque(maxlen=MAX_QUEUE_SIZE)
        self._priority_queue: deque[EmailItem] = deque(maxlen=100)
        self._worker_task: Optional[asyncio.Task] = None
        self._last_send_time: float = 0.0
        self._running = False

        # Metrics
        self.total_sent = 0
        self.total_failed = 0
        self.total_retried = 0
        self.total_dropped = 0  # Queue full

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def enqueue(
        self,
        to: str,
        subject: str,
        html: str,
        text: str = "",
        priority: bool = False,
    ) -> bool:
        """
        Ajoute un email à la queue.

        Args:
            to: Destinataire
            subject: Sujet
            html: Contenu HTML
            text: Contenu texte (fallback)
            priority: True pour les emails critiques (vérification, reset)

        Returns:
            True si l'email a été ajouté à la queue
        """
        if not EMAIL_CONFIG.get("ENABLED"):
            logger.debug("Email disabled — skipping queue")
            return False

        item = EmailItem(
            to=to,
            subject=subject,
            html=html,
            text=text,
            priority=1 if priority else 0,
        )

        target_queue = self._priority_queue if priority else self._queue

        if len(target_queue) >= target_queue.maxlen:
            logger.warning(f"Email queue full — dropping email to {to}: {subject}")
            self.total_dropped += 1
            return False

        target_queue.append(item)
        logger.info(f"📧 Queued email to {to} [{'priority' if priority else 'normal'}] — queue size: {len(self._queue) + len(self._priority_queue)}")

        # Auto-start worker si pas déjà running
        self._ensure_worker()
        return True

    def start(self):
        """Démarre le worker de queue."""
        self._running = True
        self._ensure_worker()
        logger.info("📧 Email queue worker started")

    def stop(self):
        """Arrête le worker de queue."""
        self._running = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
        logger.info(f"📧 Email queue stopped — sent: {self.total_sent}, failed: {self.total_failed}, retried: {self.total_retried}")

    def get_stats(self) -> dict:
        """Retourne les statistiques de la queue."""
        return {
            "queue_size": len(self._queue),
            "priority_queue_size": len(self._priority_queue),
            "total_sent": self.total_sent,
            "total_failed": self.total_failed,
            "total_retried": self.total_retried,
            "total_dropped": self.total_dropped,
            "worker_running": self._running and self._worker_task is not None and not self._worker_task.done(),
        }

    # ------------------------------------------------------------------
    # Worker
    # ------------------------------------------------------------------

    def _ensure_worker(self):
        """Assure que le worker tourne."""
        if self._worker_task is None or self._worker_task.done():
            try:
                loop = asyncio.get_running_loop()
                self._worker_task = loop.create_task(self._worker_loop())
            except RuntimeError:
                pass  # No event loop running yet

    async def _worker_loop(self):
        """Boucle principale du worker — traite les emails avec throttling."""
        self._running = True
        logger.info("📧 Email queue worker loop started")

        while self._running:
            try:
                # Priorité aux emails critiques
                item = None
                if self._priority_queue:
                    item = self._priority_queue.popleft()
                elif self._queue:
                    item = self._queue.popleft()

                if item is None:
                    await asyncio.sleep(WORKER_CHECK_INTERVAL)
                    continue

                # Throttling — respecter le rate limit
                elapsed = time.time() - self._last_send_time
                if elapsed < MIN_INTERVAL_SECONDS:
                    await asyncio.sleep(MIN_INTERVAL_SECONDS - elapsed)

                # Envoyer l'email
                success = await self._send_email(item)

                if success:
                    self.total_sent += 1
                elif item.retries < MAX_RETRIES:
                    # Re-queue avec retry
                    item.retries += 1
                    self.total_retried += 1
                    # Backoff exponentiel avant retry
                    backoff = RETRY_BACKOFF_BASE * (2 ** (item.retries - 1))
                    logger.warning(f"📧 Retry {item.retries}/{MAX_RETRIES} for {item.to} in {backoff}s")
                    await asyncio.sleep(backoff)
                    # Remettre dans la queue (priorité haute pour retry)
                    self._priority_queue.append(item)
                else:
                    self.total_failed += 1
                    logger.error(f"📧 Email permanently failed after {MAX_RETRIES} retries: {item.to} — {item.subject}")

            except asyncio.CancelledError:
                logger.info("📧 Email queue worker cancelled")
                break
            except Exception as e:
                logger.error(f"📧 Email queue worker error: {e}")
                await asyncio.sleep(2)

        logger.info("📧 Email queue worker loop ended")

    # ------------------------------------------------------------------
    # Sender
    # ------------------------------------------------------------------

    async def _send_email(self, item: EmailItem) -> bool:
        """Envoie un email via Resend API avec gestion des erreurs.

        Passe par le rate limiter global (``RESEND_LIMITER``) pour respecter la
        limite Resend (2 req/s par worker par défaut, configurable via
        ``RESEND_RATE_LIMIT_PER_SEC``). Si un 429 passe quand même, un retry
        avec backoff exponentiel (1s/2s/4s) est appliqué via
        ``send_with_rate_limit``. Voir ``core/email_rate_limiter.py``.
        """
        api_key = EMAIL_CONFIG.get("RESEND_API_KEY")
        if not api_key:
            logger.warning("RESEND_API_KEY not configured")
            return False

        from_email = EMAIL_CONFIG.get("FROM_EMAIL", "noreply@deepsightsynthesis.com")
        from_name = EMAIL_CONFIG.get("FROM_NAME", APP_NAME)

        async def _do_post() -> httpx.Response:
            async with httpx.AsyncClient() as client:
                return await client.post(
                    RESEND_API_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": f"{from_name} <{from_email}>",
                        "to": [item.to],
                        "subject": item.subject,
                        "html": item.html,
                        "text": item.text,
                    },
                    timeout=15,
                )

        try:
            response = await send_with_rate_limit(
                _do_post,
                is_rate_limited=lambda r: r.status_code == 429,
                context=f"to={item.to}",
            )

            self._last_send_time = time.time()

            if response.status_code in (200, 201):
                logger.info(f"📧 Sent: {item.to} — {item.subject}")
                return True
            elif response.status_code >= 500:
                # Server error — sera retry par la queue externe
                logger.warning(f"📧 Server error ({response.status_code}) for {item.to}")
                return False
            else:
                # Client error (400, 403, etc.) — pas de retry
                logger.error(f"📧 Client error ({response.status_code}) for {item.to}: {response.text}")
                self.total_failed += 1
                return True  # Don't retry client errors

        except ResendRateLimitError:
            # All inner 429 retries exhausted — bubble up to queue-level retry
            logger.warning(f"📧 Rate limited (429) for {item.to} after all retries")
            return False
        except httpx.TimeoutException:
            logger.warning(f"📧 Timeout sending to {item.to}")
            return False
        except Exception as e:
            logger.error(f"📧 Send error for {item.to}: {e}")
            return False


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

email_queue = EmailQueue()
