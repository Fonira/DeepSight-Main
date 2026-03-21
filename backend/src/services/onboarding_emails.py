"""
📧 Onboarding Email Sequence — 3 emails automatiques post-inscription

Séquence :
  J+0 : Email de bienvenue (déjà envoyé par auth/router.py)
  J+2 : Feature discovery — présentation des fonctionnalités clés
  J+7 : Engagement / upgrade — incitation à explorer les plans payants

Stratégie : Léger, sans Celery Beat (Railway 512MB).
  → Appelé via un endpoint CRON (/api/health/cron/onboarding)
  → Railway Cron Job le déclenche toutes les heures
  → Idempotent : ne renvoie jamais un email déjà envoyé

Tracking : Table onboarding_email_log (auto-créée si absente).
  Pas besoin de migration Alembic — la table est créée au premier appel.
"""

import asyncio
from datetime import datetime, timedelta
from sqlalchemy import (
    Column, Integer, String, DateTime, func, select, and_, text,
)
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Base, User
from services.email_service import EmailService
from core.config import APP_NAME, FRONTEND_URL
from core.logging import logger

# Resend rate limit: 2 req/sec → 0.6s entre chaque envoi pour marge
RESEND_THROTTLE_SECONDS = 0.6

email_service = EmailService()


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 TRACKING — Table de log onboarding (légère, auto-créée)
# ═══════════════════════════════════════════════════════════════════════════════

class OnboardingEmailLog(Base):
    """Log des emails onboarding envoyés — garantit l'idempotence."""
    __tablename__ = "onboarding_email_log"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    email_key = Column(String(20), nullable=False)  # "j2", "j7"
    sent_at = Column(DateTime, default=func.now())


async def _ensure_table_exists(db: AsyncSession) -> None:
    """Crée la table onboarding_email_log si elle n'existe pas."""
    try:
        conn = await db.connection()
        await conn.run_sync(
            lambda sync_conn: OnboardingEmailLog.__table__.create(
                sync_conn, checkfirst=True
            )
        )
    except Exception as e:
        logger.warning("Could not ensure onboarding_email_log table", extra={"error": str(e)})


async def _get_sent_keys(db: AsyncSession, user_id: int) -> set[str]:
    """Retourne les clés d'emails onboarding déjà envoyés pour un user."""
    result = await db.execute(
        select(OnboardingEmailLog.email_key).where(
            OnboardingEmailLog.user_id == user_id
        )
    )
    return {row[0] for row in result.fetchall()}


async def _mark_email_sent(db: AsyncSession, user_id: int, email_key: str) -> None:
    """Enregistre qu'un email onboarding a été envoyé."""
    try:
        log = OnboardingEmailLog(user_id=user_id, email_key=email_key)
        db.add(log)
        await db.flush()  # flush uniquement — le commit final est fait par l'appelant
    except Exception as e:
        await db.rollback()
        logger.error("Failed to mark email sent", extra={"user_id": user_id, "email_key": email_key, "error": str(e)})
        raise


# ═══════════════════════════════════════════════════════════════════════════════
# 📧 TEMPLATES
# ═══════════════════════════════════════════════════════════════════════════════

async def _send_j2_feature_discovery(user: User) -> bool:
    """J+2 : Présentation des fonctionnalités clés."""
    username = user.username or user.email.split('@')[0]

    html = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e2e8f0; padding: 40px 30px;">
      <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 20px;">
        {username}, avez-vous essayé ces fonctionnalités ? 🔍
      </h1>

      <p style="color: #94a3b8; line-height: 1.7;">
        Vous utilisez {APP_NAME} depuis 2 jours. Voici 3 fonctionnalités que vous n'avez peut-être pas encore découvertes :
      </p>

      <div style="background: #12121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #8b5cf6; margin-top: 0;">🔬 Fact-checking IA</h3>
        <p style="color: #94a3b8; margin-bottom: 0;">
          Chaque affirmation est vérifiée avec des sources fiables. Repérez les fake news en un clic.
        </p>
      </div>

      <div style="background: #12121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #06b6d4; margin-top: 0;">💬 Chat contextuel</h3>
        <p style="color: #94a3b8; margin-bottom: 0;">
          Posez des questions sur n'importe quelle vidéo analysée. L'IA répond avec le contexte exact.
        </p>
      </div>

      <div style="background: #12121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #22c55e; margin-top: 0;">📤 Export PDF / Markdown</h3>
        <p style="color: #94a3b8; margin-bottom: 0;">
          Exportez vos analyses pour les partager ou les archiver. Parfait pour les cours et recherches.
        </p>
      </div>

      <a href="{FRONTEND_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-top: 16px;">
        Explorer maintenant →
      </a>

      <p style="color: #475569; font-size: 12px; margin-top: 40px;">
        {APP_NAME} — Analyse vidéo augmentée par l'IA
      </p>
    </div>
    """

    return await email_service.send_email(
        to=user.email,
        subject=f"🔍 3 features {APP_NAME} que vous n'avez pas encore essayées",
        html_content=html,
        text_content=f"Bonjour {username},\n\nVoici 3 fonctionnalités à découvrir : Fact-checking IA, Chat contextuel, Export PDF.\n\nEssayez-les : {FRONTEND_URL}/dashboard\n\n— {APP_NAME}",
    )


async def _send_j7_engagement(user: User) -> bool:
    """J+7 : Bilan première semaine + incitation upgrade."""
    username = user.username or user.email.split('@')[0]
    plan = user.plan or "free"

    upgrade_block = ""
    if plan == "free":
        upgrade_block = f"""
        <div style="background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 24px; margin: 24px 0;">
          <h3 style="color: #3b82f6; margin-top: 0;">🚀 Passez au niveau supérieur</h3>
          <p style="color: #94a3b8;">
            Avec le plan Student à 2,99€/mois, débloquez les flashcards, les cartes conceptuelles et 40 analyses par mois.
          </p>
          <a href="{FRONTEND_URL}/upgrade" style="display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
            Voir les plans →
          </a>
        </div>
        """

    html = f"""
    <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #e2e8f0; padding: 40px 30px;">
      <h1 style="color: #3b82f6; font-size: 24px; margin-bottom: 20px;">
        Votre première semaine avec {APP_NAME} 🎉
      </h1>

      <p style="color: #94a3b8; line-height: 1.7;">
        {username}, cela fait maintenant une semaine que vous utilisez {APP_NAME}.
        Nous espérons que l'outil vous aide à mieux comprendre le contenu vidéo !
      </p>

      <div style="background: #12121a; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #f59e0b; margin-top: 0;">💡 Astuce de la semaine</h3>
        <p style="color: #94a3b8; margin-bottom: 0;">
          Utilisez le chat contextuel pour poser des questions précises sur une vidéo.
          Par exemple : <em>"Quelles sont les sources citées dans cette vidéo ?"</em>
        </p>
      </div>

      {upgrade_block}

      <p style="color: #94a3b8; line-height: 1.7;">
        Une question ? Répondez directement à cet email, nous lisons tout.
      </p>

      <p style="color: #475569; font-size: 12px; margin-top: 40px;">
        {APP_NAME} — Analyse vidéo augmentée par l'IA<br>
        <a href="{FRONTEND_URL}/settings" style="color: #475569;">Se désabonner des emails</a>
      </p>
    </div>
    """

    return await email_service.send_email(
        to=user.email,
        subject=f"🎉 Votre première semaine avec {APP_NAME} — et la suite ?",
        html_content=html,
        text_content=f"Bonjour {username},\n\nCela fait une semaine que vous utilisez {APP_NAME}. Astuce : utilisez le chat contextuel pour poser des questions sur vos vidéos.\n\n— {APP_NAME}",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 🚀 ORCHESTRATEUR
# ═══════════════════════════════════════════════════════════════════════════════

async def process_onboarding_emails(db: AsyncSession) -> dict[str, int]:
    """
    Traite les emails onboarding pour tous les utilisateurs éligibles.
    Idempotent — safe à appeler toutes les heures.

    Returns: {"j2_sent": N, "j7_sent": N, "errors": N, "users_checked": N}
    """
    await _ensure_table_exists(db)

    now = datetime.utcnow()
    stats = {"j2_sent": 0, "j7_sent": 0, "errors": 0, "users_checked": 0}

    cutoff_old = now - timedelta(days=30)
    cutoff_j2 = now - timedelta(days=2)

    result = await db.execute(
        select(User).where(
            and_(
                User.created_at >= cutoff_old,
                User.created_at <= cutoff_j2,
                User.email_verified == True,  # noqa: E712
            )
        )
    )
    users = result.scalars().all()
    stats["users_checked"] = len(users)

    # Safety cap — max 30 emails par run pour ne pas exploser le quota Resend (100/jour plan gratuit)
    MAX_EMAILS_PER_RUN = 30
    emails_sent_this_run = 0

    for user in users:
        if emails_sent_this_run >= MAX_EMAILS_PER_RUN:
            logger.warning("Onboarding cron hit MAX_EMAILS_PER_RUN cap", extra={"cap": MAX_EMAILS_PER_RUN})
            break

        try:
            sent_keys = await _get_sent_keys(db, user.id)
            days_since_signup = (now - user.created_at).days

            # J+2 : Feature discovery
            if days_since_signup >= 2 and "j2" not in sent_keys:
                await asyncio.sleep(RESEND_THROTTLE_SECONDS)
                success = await _send_j2_feature_discovery(user)
                if success:
                    await _mark_email_sent(db, user.id, "j2")
                    stats["j2_sent"] += 1
                    emails_sent_this_run += 1
                    logger.info("Onboarding J+2 sent", extra={"user_id": user.id, "email": user.email})

            # J+7 : Engagement
            if days_since_signup >= 7 and "j7" not in sent_keys and emails_sent_this_run < MAX_EMAILS_PER_RUN:
                await asyncio.sleep(RESEND_THROTTLE_SECONDS)
                success = await _send_j7_engagement(user)
                if success:
                    await _mark_email_sent(db, user.id, "j7")
                    stats["j7_sent"] += 1
                    emails_sent_this_run += 1
                    logger.info("Onboarding J+7 sent", extra={"user_id": user.id, "email": user.email})

        except Exception as e:
            stats["errors"] += 1
            logger.error("Onboarding email error", extra={"user_id": user.id, "error": str(e)})

    # Commit final unique — une seule transaction pour tous les logs
    try:
        await db.commit()
    except Exception as e:
        logger.error("Failed to commit onboarding email logs", extra={"error": str(e)})

    return stats
