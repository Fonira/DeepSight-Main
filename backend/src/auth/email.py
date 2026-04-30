"""
EMAIL SERVICE — DeepSight brand v3.0
All sends go through EmailService → email_queue (throttled, priority).
Templates live in backend/src/templates/emails/ and extend `_base.html`.
"""

from typing import Optional
from core.config import APP_NAME, FRONTEND_URL


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    priority: bool = False,
) -> bool:
    """Queue an email for sending via the throttled email queue.
    All auth emails (verification, reset) use priority=True."""
    from services.email_queue import email_queue

    return await email_queue.enqueue(
        to=to,
        subject=subject,
        html=html,
        text=text or "",
        priority=priority,
    )


async def send_verification_email(email: str, code: str, username: str) -> bool:
    """Delegates to EmailService with Jinja2 template (verification.html)."""
    from services.email_service import email_service

    return await email_service.send_verification(to=email, username=username, code=code)


async def send_password_reset_email(email: str, code: str) -> bool:
    """Delegates to EmailService with Jinja2 template (reset_password.html)."""
    from services.email_service import email_service

    reset_url = f"{FRONTEND_URL}/reset-password?code={code}&email={email}"
    return await email_service.send_reset_password(to=email, reset_url=reset_url)


async def send_welcome_email(email: str, username: str, plan: str = "free") -> bool:
    """Delegates to EmailService with Jinja2 template (welcome.html)."""
    from services.email_service import email_service

    return await email_service.send_welcome(to=email, username=username)
