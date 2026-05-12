"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  📧 EMAIL QUEUE — Async email queue avec throttling pour Resend                   ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  Résout le problème de rate limiting Resend (429 errors).                          ║
║  Resend Free: 100 emails/jour, 1 req/s | Pro: 50k/mois, 10 req/s                 ║
║                                                                                    ║
║  Sprint scalabilité — chantier B :                                                 ║
║  - Token bucket Redis-backed (cap global, voir core/email_rate_limiter.py)         ║
║  - Back-off exponentiel sur 429 et 5xx via send_with_rate_limit                    ║
║  - DLQ : emails qui échouent définitivement → table email_dlq pour replay          ║
║  - Métriques structurées : email.sent / .rate_limited / .failed / .dlq            ║
║                                                                                    ║
║  Usage:                                                                            ║
║    from services.email_queue import email_queue                                    ║
║    await email_queue.enqueue(to="user@mail.com", subject="...", html="...")        ║
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

# Resend rate limits (conservative — compatible plan Free & Pro).
# La queue spacing minimum, le rate limiter global (Redis token bucket dans
# email_rate_limiter.py) gère le cap dur 10 req/s partagé entre les 4 workers.
MAX_EMAILS_PER_SECOND = 2  # Resend Free = 1/s, Pro = 10/s → on prend 2 par sécurité
MIN_INTERVAL_SECONDS = 1.0 / MAX_EMAILS_PER_SECOND  # 0.5s entre chaque email
MAX_QUEUE_RETRIES = 3  # Nombre de retry à la queue (en plus des retries internes 429)
QUEUE_BACKOFF_BASE = 5.0  # Backoff queue : 5s, 10s, 20s
MAX_QUEUE_SIZE = 500  # Protection mémoire
WORKER_CHECK_INTERVAL = 0.5  # Fréquence de vérification de la queue


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
    user_id: Optional[int] = None
    template_name: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 EMAIL QUEUE SERVICE
# ═══════════════════════════════════════════════════════════════════════════════


class EmailQueue:
    """
    Queue async avec throttling pour les emails Resend.

    - Respecte le rate limit Resend (token bucket Redis global)
    - Retry automatique sur 429/5xx avec backoff exponentiel
    - DLQ : persiste les emails qui échouent définitivement
    - Priorité pour les emails critiques (vérification, reset)
    - Protection mémoire (max queue size)
    - Metrics structurées (loggées en JSON via extra={})
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
        self.total_rate_limited = 0  # 429 events (counted per occurrence)
        self.total_dlq = 0  # Emails persisted in DLQ
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
        user_id: Optional[int] = None,
        template_name: Optional[str] = None,
    ) -> bool:
        """
        Ajoute un email à la queue.

        Args:
            to: Destinataire
            subject: Sujet
            html: Contenu HTML
            text: Contenu texte (fallback)
            priority: True pour les emails critiques (vérification, reset)
            user_id: ID utilisateur cible (pour DLQ tracking, optionnel)
            template_name: Nom du template Jinja (pour DLQ tracking, optionnel)

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
            user_id=user_id,
            template_name=template_name,
        )

        target_queue = self._priority_queue if priority else self._queue

        if len(target_queue) >= target_queue.maxlen:
            logger.warning(f"Email queue full — dropping email to {to}: {subject}")
            self.total_dropped += 1
            # Persist to DLQ for visibility (queue saturation = ops alert)
            try:
                from services.email_dlq_service import persist_failed_email

                await persist_failed_email(
                    email_to=to,
                    subject=subject,
                    html=html,
                    text=text,
                    user_id=user_id,
                    template_name=template_name,
                    priority=priority,
                    error_message="Email queue full (in-memory queue saturated)",
                    error_status_code=None,
                    attempts=0,
                )
                self.total_dlq += 1
            except Exception as e:
                logger.error(f"Failed to DLQ a queue-full email: {e}")
            return False

        target_queue.append(item)
        logger.info(
            "email.enqueued",
            extra={
                "metric": "email.enqueued",
                "to": to,
                "priority": priority,
                "queue_size": len(self._queue) + len(self._priority_queue),
            },
        )

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
        logger.info(
            f"📧 Email queue stopped — sent: {self.total_sent}, failed: {self.total_failed}, "
            f"retried: {self.total_retried}, dlq: {self.total_dlq}"
        )

    def get_stats(self) -> dict:
        """Retourne les statistiques de la queue."""
        return {
            "queue_size": len(self._queue),
            "priority_queue_size": len(self._priority_queue),
            "total_sent": self.total_sent,
            "total_failed": self.total_failed,
            "total_retried": self.total_retried,
            "total_rate_limited": self.total_rate_limited,
            "total_dlq": self.total_dlq,
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

                # Throttling — respecter le rate limit (le rate limiter global
                # via send_with_rate_limit fait le gros du travail, mais on
                # ajoute un floor à 0.5s pour smooth les bursts).
                elapsed = time.time() - self._last_send_time
                if elapsed < MIN_INTERVAL_SECONDS:
                    await asyncio.sleep(MIN_INTERVAL_SECONDS - elapsed)

                # Envoyer l'email — _send_email persiste lui-même en DLQ si fail définitif
                outcome = await self._send_email(item)

                if outcome == "sent":
                    self.total_sent += 1
                elif outcome == "client_error":
                    # 4xx non-recoverable → DLQ déjà persisté dans _send_email
                    self.total_failed += 1
                elif outcome == "transient" and item.retries < MAX_QUEUE_RETRIES:
                    # 5xx ou erreur réseau → re-queue avec backoff
                    item.retries += 1
                    self.total_retried += 1
                    backoff = QUEUE_BACKOFF_BASE * (2 ** (item.retries - 1))
                    logger.warning(
                        "email.queue_retry",
                        extra={
                            "metric": "email.queue_retry",
                            "to": item.to,
                            "attempt": item.retries,
                            "max_retries": MAX_QUEUE_RETRIES,
                            "backoff_seconds": backoff,
                        },
                    )
                    await asyncio.sleep(backoff)
                    self._priority_queue.append(item)
                elif outcome == "transient":
                    # Transient retries exhausted → DLQ
                    await self._dlq(item, "Transient retries exhausted at queue level", None)
                    self.total_failed += 1
                # else: outcome == "rate_limited_dlq" or "exception_dlq" → handled in _send_email

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

    async def _send_email(self, item: EmailItem) -> str:
        """Envoie un email via Resend API avec gestion des erreurs.

        Retourne :
        - ``"sent"`` : email accepté par Resend (200/201)
        - ``"client_error"`` : 4xx non-recoverable (DLQ déjà persisté)
        - ``"transient"`` : 5xx ou erreur réseau → re-queue éligible
        - ``"rate_limited_dlq"`` : 429 retries exhausted (DLQ déjà persisté)
        - ``"exception_dlq"`` : exception inattendue (DLQ déjà persisté)
        """
        api_key = EMAIL_CONFIG.get("RESEND_API_KEY")
        if not api_key:
            logger.warning("RESEND_API_KEY not configured")
            await self._dlq(item, "RESEND_API_KEY not configured", None)
            return "client_error"

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
                is_retryable_5xx=lambda r: 500 <= r.status_code < 600,
                context=f"to={item.to}",
            )

            self._last_send_time = time.time()

            if response.status_code in (200, 201):
                logger.info(
                    "email.sent",
                    extra={
                        "metric": "email.sent",
                        "to": item.to,
                        "subject": item.subject[:80],
                        "template": item.template_name,
                    },
                )
                return "sent"

            elif 500 <= response.status_code < 600:
                # 5xx : send_with_rate_limit a déjà retryé. Si on arrive ici, retries épuisés.
                logger.warning(
                    "email.5xx_exhausted",
                    extra={
                        "metric": "email.failed",
                        "to": item.to,
                        "status_code": response.status_code,
                    },
                )
                # Re-queue éligible (queue-level retry) pour donner une 2e chance après un long backoff
                return "transient"

            else:
                # 4xx (other than 429) — pas de retry, DLQ direct
                err_text = ""
                try:
                    err_text = response.text[:500]
                except Exception:
                    pass
                logger.error(
                    "email.client_error",
                    extra={
                        "metric": "email.failed",
                        "to": item.to,
                        "status_code": response.status_code,
                        "response_text": err_text,
                    },
                )
                await self._dlq(
                    item,
                    f"Resend client error {response.status_code}: {err_text}",
                    response.status_code,
                )
                return "client_error"

        except ResendRateLimitError as e:
            # 429 retries exhausted → DLQ
            self.total_rate_limited += 1
            logger.warning(
                "email.rate_limited",
                extra={
                    "metric": "email.rate_limited",
                    "to": item.to,
                    "subject": item.subject[:80],
                },
            )
            await self._dlq(item, f"Resend rate-limited (429 retries exhausted): {e}", 429)
            return "rate_limited_dlq"
        except httpx.TimeoutException as e:
            logger.warning(f"📧 Timeout sending to {item.to}: {e}")
            return "transient"
        except Exception as e:
            logger.error(f"📧 Unexpected send error for {item.to}: {e}")
            await self._dlq(item, f"Unexpected error: {e}", None)
            return "exception_dlq"

    async def _dlq(self, item: EmailItem, error_message: str, status_code: Optional[int]) -> None:
        """Persiste un email échoué dans la table email_dlq."""
        try:
            from services.email_dlq_service import persist_failed_email

            attempts = item.retries + 1  # 1-based for human readability
            await persist_failed_email(
                email_to=item.to,
                subject=item.subject,
                html=item.html,
                text=item.text,
                user_id=item.user_id,
                template_name=item.template_name,
                priority=bool(item.priority),
                error_message=error_message,
                error_status_code=status_code,
                attempts=attempts,
            )
            self.total_dlq += 1
        except Exception as e:
            logger.error(f"Failed to persist email to DLQ (item.to={item.to}): {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 📦 SINGLETON
# ═══════════════════════════════════════════════════════════════════════════════

email_queue = EmailQueue()
