"""
Background monitoring job - runs every 5 minutes.

Sends alert emails ONLY on status transitions (operational -> down/degraded,
down/degraded -> operational) with a 24h reminder for persistent issues.
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

from monitoring.checks import run_all_checks

# ─── In-memory state ─────────────────────────────────────────────────────────

# Per-service: last time an alert was fired
_last_alert_sent: Dict[str, datetime] = {}

# Per-service: last known status (to detect transitions)
_last_known_status: Dict[str, str] = {}

# Cooldown for PERSISTENT issues (same status, no transition)
# Only re-alert once per 24h if service stays down/degraded
PERSISTENT_COOLDOWN = timedelta(hours=24)


# ─── Alert emails ────────────────────────────────────────────────────────────


def _build_alert_html(service_name: str, status: str, message: Optional[str]) -> str:
    color = "#ef4444" if status == "down" else "#f59e0b"
    return f"""\
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;
            background:#0a0a0f;color:#f5f5f7;padding:32px;border-radius:12px;
            border:1px solid #1e1e2a;">
  <h2 style="margin:0 0 16px;color:{color};">
    DeepSight — Service Alert
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Service</td>
      <td style="padding:8px 0;font-weight:600;">{service_name}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Status</td>
      <td style="padding:8px 0;font-weight:600;color:{color};">
        {status.upper()}
      </td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Message</td>
      <td style="padding:8px 0;">{message or "—"}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Time (UTC)</td>
      <td style="padding:8px 0;">{datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}</td>
    </tr>
  </table>
  <p style="font-size:13px;color:#6b6b80;margin:0;">
    Sent by DeepSight Monitoring — alerts fire on status change only (24h reminder for persistent issues).
  </p>
</div>"""


def _build_recovery_html(service_name: str) -> str:
    return f"""\
<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;
            background:#0a0a0f;color:#f5f5f7;padding:32px;border-radius:12px;
            border:1px solid #1e1e2a;">
  <h2 style="margin:0 0 16px;color:#10b981;">
    DeepSight — Service Recovered
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Service</td>
      <td style="padding:8px 0;font-weight:600;">{service_name}</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Status</td>
      <td style="padding:8px 0;font-weight:600;color:#10b981;">OPERATIONAL</td>
    </tr>
    <tr>
      <td style="padding:8px 0;color:#a1a1b5;">Time (UTC)</td>
      <td style="padding:8px 0;">{datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}</td>
    </tr>
  </table>
  <p style="font-size:13px;color:#6b6b80;margin:0;">
    Sent by DeepSight Monitoring.
  </p>
</div>"""


async def _send_alert(to: str, subject: str, html: str) -> None:
    try:
        from services.email_service import EmailService

        svc = EmailService()
        await svc.send_email(to=to, subject=subject, html_content=html)
    except Exception as e:
        print(f"Monitoring: failed to send alert email: {e}", flush=True)


# ─── Main job ────────────────────────────────────────────────────────────────


async def monitoring_job() -> None:
    """Run all health checks, log summary, send alerts on STATUS TRANSITIONS only."""
    try:
        from core.config import ADMIN_CONFIG
    except ImportError:
        ADMIN_CONFIG = {}

    admin_email: Optional[str] = ADMIN_CONFIG.get("ADMIN_EMAIL")
    now = datetime.now(timezone.utc)

    try:
        services = await run_all_checks()
    except Exception as e:
        print(f"Monitoring: run_all_checks failed: {e}", flush=True)
        return

    operational = sum(1 for s in services if s["status"] == "operational")
    total = len(services)
    print(f"Monitoring: {operational}/{total} services operational", flush=True)

    for svc in services:
        name = svc["name"]
        status = svc["status"]
        prev_status = _last_known_status.get(name)

        # ── Recovery: was bad, now operational ──
        if prev_status in ("down", "degraded") and status == "operational":
            if admin_email:
                await _send_alert(
                    to=admin_email,
                    subject=f"[DeepSight] {name} recovered",
                    html=_build_recovery_html(name),
                )
            _last_alert_sent.pop(name, None)

        # ── New incident: was OK (or unknown), now bad ──
        elif status in ("down", "degraded") and prev_status not in ("down", "degraded"):
            if admin_email:
                await _send_alert(
                    to=admin_email,
                    subject=f"[DeepSight] {name} is {status}",
                    html=_build_alert_html(name, status, svc.get("message")),
                )
                _last_alert_sent[name] = now

        # ── Persistent issue: still bad, only remind once per 24h ──
        elif status in ("down", "degraded") and prev_status in ("down", "degraded"):
            last_sent = _last_alert_sent.get(name)
            if last_sent is not None and (now - last_sent) >= PERSISTENT_COOLDOWN:
                if admin_email:
                    await _send_alert(
                        to=admin_email,
                        subject=f"[DeepSight] {name} still {status} (24h reminder)",
                        html=_build_alert_html(name, status, svc.get("message")),
                    )
                    _last_alert_sent[name] = now

        _last_known_status[name] = status
