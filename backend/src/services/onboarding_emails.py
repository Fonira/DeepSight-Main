"""
📧 Onboarding Email Sequence — 7 emails educatifs post-inscription

Sequence :
  J+0  : Email de bienvenue (envoye par auth/router.py)
  J+1  : Tutoriel premiere analyse (30 secondes)
  J+3  : Feature discovery — chat contextuel
  J+5  : Flashcards — revision mobile
  J+7  : Bilan premiere semaine + teaser Pro
  J+10 : Differenciateur europeen (Mistral AI / RGPD)
  J+14 : Essai Pro gratuit 7 jours (CTA final)

Strategie : Eduquer d'abord, monetiser ensuite.
  → Appele toutes les heures via APScheduler (main.py)
  → Idempotent : ne renvoie jamais un email deja envoye
  → Safety cap: max 30 emails par run (legacy)

Sprint scalabilité — chantier B :
- ÉTALEMENT BURST : si plus de ``ONBOARDING_BURST_THRESHOLD`` emails sont à
  envoyer, on étale les envois sur ``ONBOARDING_SPREAD_WINDOW_SECONDS``
  (1 email toutes les ``ONBOARDING_BURST_INTERVAL_SECONDS``). Cela laisse de la
  marge aux emails transactionnels (verification, reset password, payment
  success) qui passent en priorité dans la queue mais sont toujours bridés par
  le rate limiter Resend (10 req/s global).
- ``email_service.send_email`` propage maintenant ``user_id`` + ``template_name``
  jusqu'à la DLQ pour traçabilité du replay manuel.

Tracking : Table onboarding_email_log (auto-creee si absente).
"""

import asyncio
import os
from datetime import datetime, timedelta
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    func,
    select,
    and_,
)
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Base, User
from services.email_service import EmailService
from core.config import APP_NAME, FRONTEND_URL
from core.logging import logger

# Resend rate limit: 2 req/sec → 0.6s entre chaque envoi pour marge.
# Note: la queue email_queue + le rate limiter global gèrent déjà le cap dur,
# ce throttle local sert juste à smooth le pacing dans le cron.
RESEND_THROTTLE_SECONDS = 0.6

# ─────────────────────────────────────────────────────────────────────────────
# Étalement burst (sprint scalabilité — chantier B)
# ─────────────────────────────────────────────────────────────────────────────
# Si plus de N emails sont à envoyer dans un seul run, on étale sur W secondes
# pour laisser de la marge aux emails transactionnels (login, payment, etc.).
ONBOARDING_BURST_THRESHOLD: int = int(os.environ.get("ONBOARDING_BURST_THRESHOLD", "30"))
ONBOARDING_SPREAD_WINDOW_SECONDS: int = int(
    os.environ.get("ONBOARDING_SPREAD_WINDOW_SECONDS", "300")  # 5 minutes
)
# Per-email floor when burst-spreading (1/10s = 0.1 req/s pour onboarding,
# le reste de la bande passante Resend reste dispo pour le transactionnel).
ONBOARDING_BURST_INTERVAL_SECONDS: float = float(
    os.environ.get("ONBOARDING_BURST_INTERVAL_SECONDS", "10.0")
)

email_service = EmailService()


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TRACKING — Table de log onboarding (legere, auto-creee)
# ═══════════════════════════════════════════════════════════════════════════════


class OnboardingEmailLog(Base):
    """Log des emails onboarding envoyes — garantit l'idempotence."""

    __tablename__ = "onboarding_email_log"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    email_key = Column(String(20), nullable=False)  # "j1", "j3", "j5", "j7", "j10", "j14"
    sent_at = Column(DateTime, default=func.now())


async def _ensure_table_exists(db: AsyncSession) -> None:
    """Cree la table onboarding_email_log si elle n'existe pas."""
    try:
        conn = await db.connection()
        await conn.run_sync(lambda sync_conn: OnboardingEmailLog.__table__.create(sync_conn, checkfirst=True))
    except Exception as e:
        logger.warning("Could not ensure onboarding_email_log table", extra={"error": str(e)})


async def _get_sent_keys(db: AsyncSession, user_id: int) -> set[str]:
    """Retourne les cles d'emails onboarding deja envoyes pour un user."""
    result = await db.execute(select(OnboardingEmailLog.email_key).where(OnboardingEmailLog.user_id == user_id))
    return {row[0] for row in result.fetchall()}


async def _mark_email_sent(db: AsyncSession, user_id: int, email_key: str) -> None:
    """Enregistre qu'un email onboarding a ete envoye."""
    try:
        log = OnboardingEmailLog(user_id=user_id, email_key=email_key)
        db.add(log)
        await db.flush()
    except Exception as e:
        await db.rollback()
        logger.error(
            "Failed to mark email sent",
            extra={"user_id": user_id, "email_key": email_key, "error": str(e)},
        )
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# 📧 EMAIL SENDERS — Jinja2 templates
# ═══════════════════════════════════════════════════════════════════════════════


async def _send_j1_first_analysis(user: User) -> bool:
    """J+1 : Tutoriel — votre premiere analyse en 30 secondes."""
    username = user.username or user.email.split("@")[0]
    html = email_service._render("onboarding_j1.html", username=username)
    return await email_service.send_email(
        to=user.email,
        subject=f"Votre premiere analyse en 30 secondes — {APP_NAME}",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"3 etapes pour lancer votre premiere analyse :\n"
            f"1. Copiez un lien YouTube\n"
            f"2. Collez-le dans le tableau de bord\n"
            f"3. Decouvrez la synthese\n\n"
            f"Commencez : {FRONTEND_URL}/dashboard\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j1.html",
    )


async def _send_j3_chat_discovery(user: User) -> bool:
    """J+3 : Avez-vous essaye le chat contextuel ?"""
    username = user.username or user.email.split("@")[0]
    html = email_service._render("onboarding_j3.html", username=username)
    return await email_service.send_email(
        to=user.email,
        subject=f"Avez-vous essaye le chat ? — {APP_NAME}",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"Saviez-vous que vous pouvez poser des questions sur vos videos analysees ?\n"
            f"Le chat comprend le contexte et repond avec precision.\n\n"
            f"Essayez : {FRONTEND_URL}/dashboard\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j3.html",
    )


async def _send_j5_flashcards(user: User) -> bool:
    """J+5 : Transformez vos videos en flashcards."""
    username = user.username or user.email.split("@")[0]
    html = email_service._render("onboarding_j5.html", username=username)
    return await email_service.send_email(
        to=user.email,
        subject=f"Transformez vos videos en flashcards — {APP_NAME}",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"Chaque video analysee peut etre transformee en flashcards.\n"
            f"Revisez dans le metro avec l'app mobile.\n\n"
            f"Generez vos flashcards : {FRONTEND_URL}/dashboard\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j5.html",
    )


async def _send_j7_weekly_recap(user: User) -> bool:
    """J+7 : Bilan premiere semaine + teaser Pro."""
    username = user.username or user.email.split("@")[0]
    plan = user.plan or "free"

    html = email_service._render(
        "onboarding_j7.html",
        username=username,
        plan=plan,
        app_name=APP_NAME,
        frontend_url=FRONTEND_URL,
    )

    return await email_service.send_email(
        to=user.email,
        subject=f"Votre premiere semaine avec {APP_NAME}",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"Cela fait une semaine que vous utilisez {APP_NAME}.\n"
            f"Astuce : utilisez le chat pour poser des questions sur vos videos.\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j7.html",
    )


async def _send_j10_european_ai(user: User) -> bool:
    """J+10 : Differenciateur europeen — Mistral AI / RGPD."""
    username = user.username or user.email.split("@")[0]
    html = email_service._render("onboarding_j10.html", username=username)
    return await email_service.send_email(
        to=user.email,
        subject="IA 100% europeenne — vos donnees restent en Europe",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"{APP_NAME} est propulse par Mistral AI, la reference europeenne en IA.\n"
            f"Vos donnees restent en Europe. Conforme RGPD.\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j10.html",
    )


async def _send_j14_trial_cta(user: User) -> bool:
    """J+14 : Essai Pro gratuit 7 jours (CTA final — seulement pour free users)."""
    if (user.plan or "free") != "free":
        return True  # Skip — already on a paid plan

    username = user.username or user.email.split("@")[0]
    html = email_service._render("onboarding_j14.html", username=username)
    return await email_service.send_email(
        to=user.email,
        subject="7 jours Pro gratuits — essayez sans engagement",
        html_content=html,
        text_content=(
            f"Bonjour {username},\n\n"
            f"Vous utilisez {APP_NAME} depuis 2 semaines.\n"
            f"Essayez Pro gratuitement pendant 7 jours :\n"
            f"- 30 analyses/mois (au lieu de 5)\n"
            f"- Videos de 2h max\n"
            f"- Cartes mentales + fact-checking\n"
            f"- Export PDF\n\n"
            f"Demarrer l'essai : {FRONTEND_URL}/upgrade\n"
            f"Annulez a tout moment, aucun engagement.\n\n"
            f"— {APP_NAME}"
        ),
        user_id=user.id,
        template_name="onboarding_j14.html",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SEQUENCE DEFINITION
# ═══════════════════════════════════════════════════════════════════════════════

# (email_key, days_after_signup, sender_function)
ONBOARDING_SEQUENCE = [
    ("j1", 1, _send_j1_first_analysis),
    ("j3", 3, _send_j3_chat_discovery),
    ("j5", 5, _send_j5_flashcards),
    ("j7", 7, _send_j7_weekly_recap),
    ("j10", 10, _send_j10_european_ai),
    ("j14", 14, _send_j14_trial_cta),
]

# Backwards compatibility: old keys "j2" are treated as already sent
LEGACY_KEY_MAP = {"j2": "j3"}  # j2 feature discovery → now j3


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 ORCHESTRATEUR
# ═══════════════════════════════════════════════════════════════════════════════


async def _plan_due_emails(
    db: AsyncSession, users: list, now: datetime
) -> list[tuple[User, str, callable]]:
    """Compute the (user, email_key, sender_fn) tuples that are due to send.

    Idempotent: skips keys already in onboarding_email_log. Honored by both
    the burst path (étalement) and the legacy fast path (no spread).
    """
    due: list[tuple[User, str, callable]] = []
    for user in users:
        try:
            sent_keys = await _get_sent_keys(db, user.id)
            for old_key, new_key in LEGACY_KEY_MAP.items():
                if old_key in sent_keys:
                    sent_keys.add(new_key)

            days_since_signup = (now - user.created_at).days
            for email_key, min_days, sender_fn in ONBOARDING_SEQUENCE:
                if days_since_signup >= min_days and email_key not in sent_keys:
                    due.append((user, email_key, sender_fn))
        except Exception as e:
            logger.error(
                "Onboarding planning error",
                extra={"user_id": user.id, "error": str(e)},
            )
    return due


async def process_onboarding_emails(db: AsyncSession) -> dict[str, int]:
    """
    Traite les emails onboarding pour tous les utilisateurs eligibles.
    Idempotent — safe a appeler toutes les heures.

    Sprint scalabilité — chantier B :
    - Si plus de ``ONBOARDING_BURST_THRESHOLD`` (default 30) emails sont à
      envoyer dans ce run, on étale les envois sur
      ``ONBOARDING_SPREAD_WINDOW_SECONDS`` (default 5min) à raison de
      1 email toutes les ``ONBOARDING_BURST_INTERVAL_SECONDS`` (default 10s).
    - Le rate limiter global (token bucket Redis) reste seul juge final du
      pacing, ce sleep local laisse juste de la marge pour le transactionnel.

    Returns: {"j1_sent": N, ..., "errors": N, "users_checked": N, "burst_spread": bool}
    """
    await _ensure_table_exists(db)

    now = datetime.utcnow()
    stats = {f"{key}_sent": 0 for key, _, _ in ONBOARDING_SEQUENCE}
    stats["errors"] = 0
    stats["users_checked"] = 0
    stats["burst_spread"] = 0  # 0 or 1, surfacé pour les métriques cron
    stats["due_count"] = 0

    # Only process users signed up between 1 and 30 days ago
    cutoff_old = now - timedelta(days=30)
    cutoff_recent = now - timedelta(days=1)

    result = await db.execute(
        select(User).where(
            and_(
                User.created_at >= cutoff_old,
                User.created_at <= cutoff_recent,
                User.email_verified == True,  # noqa: E712
            )
        )
    )
    users = list(result.scalars().all())
    stats["users_checked"] = len(users)

    # Plan all due emails first → décide ensuite si on étale le burst.
    due = await _plan_due_emails(db, users, now)
    stats["due_count"] = len(due)

    # Cap dur global (legacy safety) — dérivé de la fenêtre d'étalement quand
    # le burst est actif (ex: 5min × 1/10s = 30 emails/run en burst).
    use_burst_spread = len(due) > ONBOARDING_BURST_THRESHOLD
    if use_burst_spread:
        max_emails_per_run = max(
            ONBOARDING_BURST_THRESHOLD,
            int(ONBOARDING_SPREAD_WINDOW_SECONDS / ONBOARDING_BURST_INTERVAL_SECONDS),
        )
        spread_interval = ONBOARDING_BURST_INTERVAL_SECONDS
        stats["burst_spread"] = 1
        logger.warning(
            "onboarding.burst_spread",
            extra={
                "metric": "onboarding.burst_spread",
                "due_count": len(due),
                "spread_window_seconds": ONBOARDING_SPREAD_WINDOW_SECONDS,
                "interval_seconds": spread_interval,
                "max_emails_per_run": max_emails_per_run,
            },
        )
    else:
        max_emails_per_run = max(ONBOARDING_BURST_THRESHOLD, 30)
        spread_interval = RESEND_THROTTLE_SECONDS

    emails_sent_this_run = 0

    for user, email_key, sender_fn in due:
        if emails_sent_this_run >= max_emails_per_run:
            logger.warning(
                "Onboarding cron hit MAX_EMAILS_PER_RUN cap",
                extra={"cap": max_emails_per_run, "burst_spread": bool(stats["burst_spread"])},
            )
            break

        try:
            await asyncio.sleep(spread_interval)
            success = await sender_fn(user)
            if success:
                await _mark_email_sent(db, user.id, email_key)
                stats[f"{email_key}_sent"] += 1
                emails_sent_this_run += 1
                logger.info(
                    f"Onboarding {email_key} sent",
                    extra={"user_id": user.id, "email": user.email},
                )

        except Exception as e:
            stats["errors"] += 1
            logger.error("Onboarding email error", extra={"user_id": user.id, "error": str(e)})

    # Commit final unique
    try:
        await db.commit()
    except Exception as e:
        logger.error("Failed to commit onboarding email logs", extra={"error": str(e)})

    return stats
