"""
EMAIL SERVICE — Design sobre et professionnel v2.0
"""

import httpx
from typing import Optional
from core.config import EMAIL_CONFIG, APP_NAME, FRONTEND_URL

RESEND_API_URL = "https://api.resend.com/emails"

EMAIL_BASE_STYLE = """
<style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; line-height: 1.6; }
    .container { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 32px; text-align: center; }
    .logo { font-size: 28px; font-weight: 600; color: #ffffff; }
    .logo-icon { display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; margin-bottom: 12px; line-height: 48px; font-size: 24px; }
    .content { padding: 40px 32px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .text { color: #475569; font-size: 15px; margin-bottom: 16px; line-height: 1.7; }
    .code-box { background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%); border: 2px solid #fbbf24; border-radius: 12px; padding: 24px; text-align: center; margin: 28px 0; }
    .code { font-size: 36px; font-weight: 700; color: #1e293b; letter-spacing: 8px; font-family: monospace; }
    .code-label { font-size: 11px; color: #92400e; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; font-weight: 600; }
    .btn { display: inline-block; background: linear-gradient(135deg, #f59e0b, #d97706); color: #ffffff !important; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; }
    .info-box { background: #f1f5f9; border-left: 4px solid #64748b; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .info-box p { margin: 0; font-size: 14px; color: #475569; }
    .warning-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0; }
    .warning-box p { margin: 0; font-size: 14px; color: #991b1b; }
    .footer { background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; font-size: 13px; color: #94a3b8; }
    .footer a { color: #64748b; text-decoration: none; }
    .feature-list { background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .feature-item { margin-bottom: 12px; font-size: 14px; color: #475569; }
</style>
"""


async def send_email(to: str, subject: str, html: str, text: Optional[str] = None) -> bool:
    if not EMAIL_CONFIG.get("ENABLED"):
        print("📧 Email disabled", flush=True)
        return False
    
    api_key = EMAIL_CONFIG.get("RESEND_API_KEY")
    if not api_key:
        print("📧 Resend API key not configured", flush=True)
        return False
    
    from_email = EMAIL_CONFIG.get("FROM_EMAIL", "noreply@deepsightsynthesis.com")
    from_name = EMAIL_CONFIG.get("FROM_NAME", APP_NAME)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                RESEND_API_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": f"{from_name} <{from_email}>", "to": [to], "subject": subject, "html": html, "text": text or ""},
                timeout=10
            )
            if response.status_code in [200, 201]:
                print(f"📧 Email sent to {to}", flush=True)
                return True
            else:
                print(f"📧 Email failed: {response.status_code} - {response.text}", flush=True)
                return False
    except Exception as e:
        print(f"📧 Email error: {e}", flush=True)
        return False


async def send_verification_email(email: str, code: str, username: str) -> bool:
    subject = f"Vérifiez votre email — {APP_NAME}"
    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">{EMAIL_BASE_STYLE}</head><body>
    <div class="container">
        <div class="header"><div class="logo-icon">🔍</div><div class="logo">{APP_NAME}</div></div>
        <div class="content">
            <p class="greeting">Bonjour {username},</p>
            <p class="text">Bienvenue sur {APP_NAME} ! Pour activer votre compte, veuillez entrer le code de vérification ci-dessous.</p>
            <div class="code-box"><div class="code-label">Code de vérification</div><div class="code">{code}</div></div>
            <div class="info-box"><p>⏱️ Ce code expire dans <strong>10 minutes</strong>.</p></div>
            <p class="text" style="color: #94a3b8; font-size: 13px;">Si vous n'avez pas créé de compte sur {APP_NAME}, vous pouvez ignorer cet email.</p>
        </div>
        <div class="footer"><p><strong>{APP_NAME}</strong> — Analyse vidéo intelligente</p></div>
    </div></body></html>"""
    text = f"Bonjour {username},\n\nVotre code de vérification : {code}\n\nCe code expire dans 10 minutes.\n\n— {APP_NAME}"
    return await send_email(email, subject, html, text)


async def send_password_reset_email(email: str, code: str) -> bool:
    """Delegates to EmailService with Jinja2 template."""
    from services.email_service import email_service
    reset_url = f"{FRONTEND_URL}/reset-password?code={code}&email={email}"
    return await email_service.send_reset_password(to=email, reset_url=reset_url)


async def send_welcome_email(email: str, username: str, plan: str = "free") -> bool:
    """Delegates to EmailService with Jinja2 template."""
    from services.email_service import email_service
    return await email_service.send_welcome(to=email, username=username)
