"""
EmailService — Transactional emails via Resend + Jinja2 templates
Tous les envois passent par la queue async avec throttling (email_queue.py).

Sprint scalabilité — chantier B :
- ``template_name`` est maintenant tracé pour la DLQ (visible dans
  ``GET /api/admin/email-dlq``).
- Les retries 429/5xx, le DLQ et le rate limiter global vivent dans
  ``services/email_queue.py`` et ``core/email_rate_limiter.py``.
"""

from pathlib import Path
from typing import Optional
from jinja2 import Environment, FileSystemLoader, select_autoescape

from core.config import APP_NAME, FRONTEND_URL

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "emails"


class EmailService:
    """Centralized transactional email sender using Resend API + Jinja2 templates."""

    def __init__(self) -> None:
        self._jinja = Environment(
            loader=FileSystemLoader(str(TEMPLATES_DIR)),
            autoescape=select_autoescape(["html"]),
        )
        # Common template variables available in every render
        self._globals = {
            "app_name": APP_NAME,
            "frontend_url": FRONTEND_URL,
            "current_year": "2026",
        }

    # ------------------------------------------------------------------
    # Low-level sender
    # ------------------------------------------------------------------

    async def send_email(
        self,
        to: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        priority: bool = False,
        user_id: Optional[int] = None,
        template_name: Optional[str] = None,
    ) -> bool:
        """
        Queue an email for sending via the throttled email queue.
        Returns True if successfully queued.

        Args:
            priority: True for critical emails (verification, password reset)
            user_id: ID utilisateur cible (DLQ tracking)
            template_name: Nom du template Jinja (DLQ tracking)
        """
        from services.email_queue import email_queue

        return await email_queue.enqueue(
            to=to,
            subject=subject,
            html=html_content,
            text=text_content or "",
            priority=priority,
            user_id=user_id,
            template_name=template_name,
        )

    # ------------------------------------------------------------------
    # Template renderer
    # ------------------------------------------------------------------

    def _render(self, template_name: str, **kwargs: object) -> str:
        tpl = self._jinja.get_template(template_name)
        return tpl.render(**self._globals, **kwargs)

    # ------------------------------------------------------------------
    # High-level email methods
    # ------------------------------------------------------------------

    async def send_welcome(self, to: str, username: str, user_id: Optional[int] = None) -> bool:
        html = self._render("welcome.html", username=username)
        return await self.send_email(
            to=to,
            subject=f"Bienvenue sur {APP_NAME}, {username} !",
            html_content=html,
            text_content=(
                f"Bienvenue {username} !\n\n"
                f"Votre compte {APP_NAME} est actif.\n"
                f"Commencez ici : {FRONTEND_URL}/dashboard\n\n"
                f"— L'equipe {APP_NAME}"
            ),
            user_id=user_id,
            template_name="welcome.html",
        )

    async def send_verification(
        self, to: str, username: str, code: str, user_id: Optional[int] = None
    ) -> bool:
        html = self._render("verification.html", username=username, code=code)
        return await self.send_email(
            to=to,
            subject=f"Vérifiez votre email — {APP_NAME}",
            html_content=html,
            text_content=(
                f"Bonjour {username},\n\n"
                f"Votre code de vérification : {code}\n\n"
                f"Ce code expire dans 10 minutes.\n\n"
                f"— {APP_NAME}"
            ),
            priority=True,
            user_id=user_id,
            template_name="verification.html",
        )

    async def send_reset_password(
        self, to: str, reset_url: str, user_id: Optional[int] = None
    ) -> bool:
        html = self._render("reset_password.html", reset_url=reset_url)
        return await self.send_email(
            to=to,
            subject=f"Reinitialisation de votre mot de passe — {APP_NAME}",
            html_content=html,
            text_content=(
                f"Reinitialisation de mot de passe\n\n"
                f"Cliquez ici : {reset_url}\n\n"
                f"Ce lien expire dans 1 heure.\n"
                f"— {APP_NAME}"
            ),
            priority=True,
            user_id=user_id,
            template_name="reset_password.html",
        )

    async def send_payment_success(
        self, to: str, username: str, plan: str, credits: int, user_id: Optional[int] = None
    ) -> bool:
        plan_display = {"pro": "Pro", "expert": "Expert"}.get(plan, plan.capitalize())
        # Pricing v2 (Alembic 012, mergée 2026-04-30)
        price_display = {"pro": "8,99", "expert": "19,99"}.get(plan, "—")
        html = self._render(
            "payment_success.html",
            username=username,
            plan=plan_display,
            credits=credits,
            price=price_display,
        )
        return await self.send_email(
            to=to,
            subject=f"Paiement confirme — Plan {plan_display} active",
            html_content=html,
            text_content=(
                f"Bonjour {username},\n\n"
                f"Votre plan {plan_display} est actif.\n"
                f"Credits ajoutes : {credits}\n\n"
                f"— {APP_NAME}"
            ),
            user_id=user_id,
            template_name="payment_success.html",
        )

    async def send_payment_failed(
        self, to: str, username: str, plan: str, user_id: Optional[int] = None
    ) -> bool:
        plan_display = {"starter": "Starter", "pro": "Pro", "expert": "Expert"}.get(plan, plan.capitalize())
        html = self._render(
            "payment_failed.html",
            username=username,
            plan=plan_display,
        )
        return await self.send_email(
            to=to,
            subject="Echec de paiement — Action requise",
            html_content=html,
            text_content=(
                f"Bonjour {username},\n\n"
                f"Le paiement pour votre plan {plan_display} a echoue.\n"
                f"Mettez a jour vos informations de paiement :\n"
                f"{FRONTEND_URL}/settings\n\n"
                f"— {APP_NAME}"
            ),
            user_id=user_id,
            template_name="payment_failed.html",
        )

    async def send_trial_ending_reminder(
        self,
        to: str,
        username: str,
        trial_end_date: str,
        plan: str = "Pro",
        user_id: Optional[int] = None,
    ) -> bool:
        plan_display = {"pro": "Pro", "expert": "Expert"}.get(plan, plan.capitalize())
        price_display = {"pro": "5,99", "expert": "14,99"}.get(plan, "5,99")
        html = self._render(
            "trial_ending.html",
            username=username,
            trial_end_date=trial_end_date,
            plan=plan_display,
            price=price_display,
        )
        return await self.send_email(
            to=to,
            subject=f"Votre essai {plan_display} se termine le {trial_end_date}",
            html_content=html,
            text_content=(
                f"Bonjour {username},\n\n"
                f"Votre essai gratuit du plan {plan_display} se termine le {trial_end_date}.\n"
                f"Gardez toutes vos fonctionnalites pour seulement {price_display}EUR/mois.\n\n"
                f"Continuer : {FRONTEND_URL}/upgrade\n"
                f"Gerer : {FRONTEND_URL}/settings\n\n"
                f"— {APP_NAME}"
            ),
            user_id=user_id,
            template_name="trial_ending.html",
        )

    async def send_analysis_complete(
        self,
        to: str,
        username: str,
        video_title: str,
        summary_id: str,
        user_id: Optional[int] = None,
    ) -> bool:
        analysis_url = f"{FRONTEND_URL}/analysis/{summary_id}"
        html = self._render(
            "analysis_complete.html",
            username=username,
            video_title=video_title,
            analysis_url=analysis_url,
        )
        return await self.send_email(
            to=to,
            subject=f"Analyse terminee — {video_title[:60]}",
            html_content=html,
            text_content=(
                f"Bonjour {username},\n\n"
                f'Votre analyse de "{video_title}" est prete.\n'
                f"Consultez-la ici : {analysis_url}\n\n"
                f"— {APP_NAME}"
            ),
            user_id=user_id,
            template_name="analysis_complete.html",
        )


# Singleton instance — import and use directly
email_service = EmailService()
