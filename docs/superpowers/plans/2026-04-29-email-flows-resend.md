# Email Flows Resend — Welcome Series Phase 9 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place une séquence d'emails post-signup et transactionnels via Resend (J+0, J+1, J+3, J+7, J+14, plus trial-ending / payment-success / cart-abandon), avec scheduling date-based, tracking via webhook Resend, désinscription RGPD, i18n FR/EN, et événements PostHog cohérents avec l'audit Kimi 2026-04-29 Phase 9.

**Architecture:** Réutilisation de l'infrastructure email existante (`services/email_service.py` + `services/email_queue.py` + `core/email_rate_limiter.py`). Refactor de `services/onboarding_emails.py` (basé sur scan horaire des users) vers un système basé sur une table `email_scheduled` (date d'envoi planifiée à la confirmation email) et une table `email_events` (tracking webhooks). APScheduler existant pilote un job qui pop les jobs dûs en respectant le rate-limit Resend (2 req/s par worker, déjà en place via `aiolimiter`). Webhook Resend exposé `/api/email/webhook/resend`. Désinscription gérée par token signé + page frontend `/email/unsubscribe`.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 async + Alembic migration 010 + APScheduler (déjà installé) + Jinja2 (déjà en place) + Resend SDK (httpx direct, déjà utilisé) + aiolimiter (déjà installé) + posthog-js (frontend déjà en place).

---

## Contexte préalable

### Existant à réutiliser (NE PAS recréer)

| Fichier                                     | Rôle                                                                | Statut                                         |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------- |
| `backend/src/services/email_service.py`     | Sender Jinja2 + appel `email_queue.enqueue`                         | OK, à étendre (ajout `send_template_for_user`) |
| `backend/src/services/email_queue.py`       | Queue async + throttling 2 req/s + retry 429                        | OK, ne pas toucher                             |
| `backend/src/core/email_rate_limiter.py`    | `RESEND_LIMITER` + `send_with_rate_limit`                           | OK, ne pas toucher                             |
| `backend/src/services/onboarding_emails.py` | Séquence existante J+1/J+3/J+5/J+7/J+10/J+14 (scan horaire)         | À DEPRECATER + migrer vers nouveau système     |
| `backend/src/templates/emails/*.html`       | 12 templates dark-theme (welcome, onboarding*j\*, payment*\*, etc.) | À étendre (5 nouveaux templates × 2 langues)   |
| `backend/src/main.py` lignes 677-718        | APScheduler job `_scheduled_onboarding` (1h)                        | À MODIFIER (pointe vers nouveau service)       |
| `backend/src/auth/router.py` ligne 224-228  | Hook welcome après `verify_email`                                   | À MODIFIER (déclenche scheduling complet)      |
| `backend/requirements.txt`                  | `resend>=0.7.0`, `aiolimiter>=1.1.0`, `apscheduler>=3.10.0`         | OK                                             |

### Schema User actuel (`backend/src/db/database.py:106-180`)

```python
class User(Base):
    __tablename__ = "users"
    id, username, email, password_hash
    email_verified, verification_code, verification_expires
    plan, credits  # plan ∈ {"free", "plus", "pro", "expert"}
    default_lang  # ← langue à utiliser pour i18n (déjà existe : "fr" par défaut)
    preferences   # JSON (existe depuis migration 009, on y stockera marketing_consent + unsubscribed)
    created_at, updated_at
```

**Décision i18n** : on lit `user.default_lang` (existant). Pas besoin de nouvelle colonne.
**Décision consent** : on stocke dans `user.preferences["marketing_emails_consent"]` (bool, default `True` à l'inscription EU mais opt-out via lien désinscription qui set à `False`). RGPD : welcome (J+0) reste transactionnel donc envoyé même si consent absent ; J+1/J+3/J+7/J+14 nécessitent consent ≠ False.

### Pricing — DÉCISION À VALIDER

Le prompt mentionne **Pro 8,99€ / Expert 19,99€** (pricing v2 en cours). Le code actuel (`backend/src/billing/plan_config.py:193,323`) montre :

- Plus : 499 cents (4,99€)
- Pro : 999 cents (9,99€)
- Pas d'Expert

**Templates HTML utiliseront des placeholders `{{ pro_price }}` et `{{ expert_price }}`** rendus depuis `services/email_sequences.py` qui lit la SSOT `billing/plan_config.py`. Aucun prix hardcodé dans les templates. Si pricing v2 est mergé, prix mis à jour automatiquement. (Voir Self-Review Décision #2.)

### Cohérence avec autres plans en cours

- Plan `2026-04-29-posthog-events-complets.md` : à lire AVANT (tu n'as pas accès direct, mais respecte la convention `snake_case` pour event names ; nouveaux events : `email_sent`, `email_delivered`, `email_opened`, `email_clicked`, `email_unsubscribed`).
- Plan #3 pricing v2 : si déjà mergé, le service `email_sequences.py` doit lire `get_plan_pricing()` depuis `billing/plan_config.py`.

---

## File Structure

### Backend (Python)

| Path                                                      | Action                 | Responsabilité                                                                                                                                                                    |
| --------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/alembic/versions/010_add_email_scheduling.py`    | CREATE                 | Migration : tables `email_scheduled` + `email_events` + index                                                                                                                     |
| `backend/src/db/database.py`                              | MODIFY (append)        | Models `EmailScheduled` + `EmailEvent` (~50 lignes en bas du fichier, après autres tables)                                                                                        |
| `backend/src/services/email_sequences.py`                 | CREATE                 | Logique métier : `schedule_welcome_sequence`, `cancel_marketing_emails`, `process_scheduled_emails`, `is_user_unsubscribed`                                                       |
| `backend/src/services/email_unsubscribe.py`               | CREATE                 | Génération + vérification token désinscription (HMAC-SHA256 avec `JWT_SECRET_KEY`)                                                                                                |
| `backend/src/services/email_service.py`                   | MODIFY                 | Ajout `send_template_for_user(user, template_key, lang, context)` qui détecte la langue et le contexte i18n                                                                       |
| `backend/src/services/onboarding_emails.py`               | DEPRECATE              | Renommer fonction interne en `_legacy_process_onboarding_emails` ; logger `DeprecationWarning` au call ; ne plus l'appeler depuis `main.py`                                       |
| `backend/src/auth/router.py`                              | MODIFY (ligne 223-228) | Remplacer `send_welcome_email` direct par `schedule_welcome_sequence(user)` qui ajoute J+0 immédiat + J+1/J+3/J+7/J+14 différés                                                   |
| `backend/src/email/router.py`                             | CREATE                 | Router FastAPI : `POST /api/email/webhook/resend` (signature verify) + `GET /api/email/unsubscribe` (token verify + UI redirect) + `POST /api/email/preferences` (toggle consent) |
| `backend/src/main.py`                                     | MODIFY (ligne 680-718) | Remplacer `_scheduled_onboarding` par `_scheduled_email_dispatch` qui appelle `process_scheduled_emails()` toutes les 5 min ; inclure `email.router`                              |
| `backend/src/billing/router.py`                           | MODIFY                 | Sur webhook Stripe `subscription.created` (upgrade Pro/Expert) → appeler `cancel_marketing_emails(user_id, "upgraded_to_paid")`                                                   |
| `backend/src/templates/emails/welcome_fr.html`            | CREATE                 | J+0 FR (refactor de `welcome.html` existant + ajout footer désinscription + branding cosmic)                                                                                      |
| `backend/src/templates/emails/welcome_en.html`            | CREATE                 | J+0 EN                                                                                                                                                                            |
| `backend/src/templates/emails/tip_first_analysis_fr.html` | CREATE                 | J+1 FR — astuce 1 lien = 1 synthèse                                                                                                                                               |
| `backend/src/templates/emails/tip_first_analysis_en.html` | CREATE                 | J+1 EN                                                                                                                                                                            |
| `backend/src/templates/emails/feature_archive_fr.html`    | CREATE                 | J+3 FR — archives à vie                                                                                                                                                           |
| `backend/src/templates/emails/feature_archive_en.html`    | CREATE                 | J+3 EN                                                                                                                                                                            |
| `backend/src/templates/emails/social_proof_fr.html`       | CREATE                 | J+7 FR — témoignage Marie                                                                                                                                                         |
| `backend/src/templates/emails/social_proof_en.html`       | CREATE                 | J+7 EN                                                                                                                                                                            |
| `backend/src/templates/emails/upgrade_nudge_fr.html`      | CREATE                 | J+14 FR — Pro {{ pro_price }}                                                                                                                                                     |
| `backend/src/templates/emails/upgrade_nudge_en.html`      | CREATE                 | J+14 EN                                                                                                                                                                           |
| `backend/src/templates/emails/_partials/footer_fr.html`   | CREATE                 | Partial footer (désinscription + préférences)                                                                                                                                     |
| `backend/src/templates/emails/_partials/footer_en.html`   | CREATE                 | Partial footer EN                                                                                                                                                                 |
| `backend/tests/services/test_email_sequences.py`          | CREATE                 | Tests pytest : scheduling, cancellation, idempotence, i18n                                                                                                                        |
| `backend/tests/services/test_email_unsubscribe.py`        | CREATE                 | Tests : token gen + verify, expiration, tampering                                                                                                                                 |
| `backend/tests/email/test_webhook_resend.py`              | CREATE                 | Tests webhook : signature valid/invalid, event types                                                                                                                              |
| `backend/tests/email/__init__.py`                         | CREATE                 | Marker package tests email                                                                                                                                                        |
| `backend/tests/services/__init__.py`                      | CREATE                 | Marker package                                                                                                                                                                    |

### Frontend (TypeScript)

| Path                                          | Action | Responsabilité                                                                                                                                                |
| --------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/services/analytics.ts`          | MODIFY | Ajout helpers `trackEmailEvent(event, metadata)` côté frontend (déclenché si user arrive via lien email avec `?utm_source=email&utm_campaign=<template_key>`) |
| `frontend/src/pages/EmailUnsubscribePage.tsx` | CREATE | Page publique `/email/unsubscribe?token=...` qui appelle backend + affiche confirmation                                                                       |
| `frontend/src/pages/EmailPreferencesPage.tsx` | CREATE | Page authentifiée `/email/preferences` (toggle marketing_emails_consent)                                                                                      |
| `frontend/src/App.tsx` ou router              | MODIFY | Ajout des deux routes ci-dessus                                                                                                                               |
| `frontend/src/services/api.ts`                | MODIFY | Ajout `unsubscribeEmail(token)` + `getEmailPreferences()` + `updateEmailPreferences(consent)`                                                                 |

---

## Tasks

### Task 1: Migration Alembic 010 — tables `email_scheduled` + `email_events`

**Files:**

- Create: `backend/alembic/versions/010_add_email_scheduling.py`

- [ ] **Step 1: Inspecter la dernière migration pour le pattern**

```bash
cat backend/alembic/versions/009_add_user_preferences_json.py | head -40
```

Expected: voir `down_revision = "008_voice_quota_a_d_strict"` pattern + import op/sa.

- [ ] **Step 2: Créer la migration**

```python
# backend/alembic/versions/010_add_email_scheduling.py
"""add_email_scheduling

Revision ID: 010_add_email_scheduling
Revises: 009_add_user_preferences_json
Create Date: 2026-04-29
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "010_add_email_scheduling"
down_revision = "009_add_user_preferences_json"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Table 1: email_scheduled — jobs d'email à envoyer dans le futur
    op.create_table(
        "email_scheduled",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_key", sa.String(64), nullable=False),
        sa.Column("send_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("cancel_reason", sa.String(64), nullable=True),
        sa.Column("event_metadata", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_email_scheduled_user_id", "email_scheduled", ["user_id"])
    op.create_index("ix_email_scheduled_pending", "email_scheduled", ["send_at", "sent_at"])
    op.create_index("ix_email_scheduled_user_template", "email_scheduled", ["user_id", "template_key"], unique=True)

    # Table 2: email_events — tracking webhooks Resend
    op.create_table(
        "email_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("template_key", sa.String(64), nullable=False),
        sa.Column("event_type", sa.String(32), nullable=False),
        sa.Column("resend_message_id", sa.String(255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("event_metadata", sa.JSON().with_variant(postgresql.JSONB(), "postgresql"), nullable=True),
    )
    op.create_index("ix_email_events_user_id", "email_events", ["user_id"])
    op.create_index("ix_email_events_resend_message_id", "email_events", ["resend_message_id"])
    op.create_index("ix_email_events_template_event", "email_events", ["template_key", "event_type"])


def downgrade() -> None:
    op.drop_index("ix_email_events_template_event", table_name="email_events")
    op.drop_index("ix_email_events_resend_message_id", table_name="email_events")
    op.drop_index("ix_email_events_user_id", table_name="email_events")
    op.drop_table("email_events")

    op.drop_index("ix_email_scheduled_user_template", table_name="email_scheduled")
    op.drop_index("ix_email_scheduled_pending", table_name="email_scheduled")
    op.drop_index("ix_email_scheduled_user_id", table_name="email_scheduled")
    op.drop_table("email_scheduled")
```

- [ ] **Step 3: Tester la migration en local (SQLite)**

```bash
cd backend && python -m alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 009_add_user_preferences_json -> 010_add_email_scheduling`

- [ ] **Step 4: Tester downgrade**

```bash
cd backend && python -m alembic downgrade -1 && python -m alembic upgrade head
```

Expected: deux upgrades successifs sans erreur.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/010_add_email_scheduling.py
git commit -m "feat(email): add migration 010 for email_scheduled and email_events tables"
```

---

### Task 2: SQLAlchemy models `EmailScheduled` + `EmailEvent`

**Files:**

- Modify: `backend/src/db/database.py` (append en fin de fichier, après les autres models, avant les fonctions utilitaires)

- [ ] **Step 1: Ouvrir database.py et trouver le dernier model**

```bash
grep -n "^class " backend/src/db/database.py | tail -5
```

Expected: liste des classes existantes (UserStudyStats, UserBadge, etc.) — repérer la dernière.

- [ ] **Step 2: Append les deux nouveaux models**

```python
# Dans backend/src/db/database.py — après le dernier model existant


class EmailScheduled(Base):
    """Job d'email planifié à envoyer à une date future.

    Inséré par schedule_welcome_sequence() à la confirmation email.
    Consommé par process_scheduled_emails() (APScheduler 5 min).
    """

    __tablename__ = "email_scheduled"
    __table_args__ = (
        Index("ix_email_scheduled_pending", "send_at", "sent_at"),
        Index("ix_email_scheduled_user_template", "user_id", "template_key", unique=True),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    template_key = Column(String(64), nullable=False)
    send_at = Column(DateTime(timezone=True), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    cancelled = Column(Boolean, nullable=False, default=False, server_default="false")
    cancel_reason = Column(String(64), nullable=True)
    event_metadata = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)


class EmailEvent(Base):
    """Tracking des events Resend (sent/delivered/opened/clicked/bounced/complained/unsubscribed).

    Insérés par /api/email/webhook/resend après vérification de signature.
    Utilisés pour analytics PostHog + admin dashboard.
    """

    __tablename__ = "email_events"
    __table_args__ = (
        Index("ix_email_events_template_event", "template_key", "event_type"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    template_key = Column(String(64), nullable=False)
    event_type = Column(String(32), nullable=False)
    resend_message_id = Column(String(255), nullable=True, index=True)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    event_metadata = Column(JSON, nullable=True)
```

⚠️ Vérifier que `Index` est déjà importé en haut de `database.py`. Si non, ajouter `Index` à la ligne `from sqlalchemy import ...`.

- [ ] **Step 3: Tester l'import**

```bash
cd backend/src && python -c "from db.database import EmailScheduled, EmailEvent; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/database.py
git commit -m "feat(email): add EmailScheduled and EmailEvent SQLAlchemy models"
```

---

### Task 3: Service `email_unsubscribe.py` — tokens HMAC

**Files:**

- Create: `backend/src/services/email_unsubscribe.py`
- Test: `backend/tests/services/test_email_unsubscribe.py`

- [ ] **Step 1: Écrire le test d'abord**

```python
# backend/tests/services/test_email_unsubscribe.py
"""Tests for email unsubscribe token generation and verification."""

import pytest
from services.email_unsubscribe import (
    generate_unsubscribe_token,
    verify_unsubscribe_token,
    UnsubscribeTokenInvalid,
)


def test_token_roundtrip_returns_user_id():
    token = generate_unsubscribe_token(user_id=42, template_key="welcome")
    assert isinstance(token, str)
    assert len(token) > 20
    user_id, template_key = verify_unsubscribe_token(token)
    assert user_id == 42
    assert template_key == "welcome"


def test_token_with_template_all_for_global_unsub():
    token = generate_unsubscribe_token(user_id=7, template_key="all")
    user_id, template_key = verify_unsubscribe_token(token)
    assert user_id == 7
    assert template_key == "all"


def test_invalid_token_raises():
    with pytest.raises(UnsubscribeTokenInvalid):
        verify_unsubscribe_token("garbage.token.here")


def test_tampered_token_raises():
    token = generate_unsubscribe_token(user_id=1, template_key="welcome")
    tampered = token[:-4] + "XXXX"
    with pytest.raises(UnsubscribeTokenInvalid):
        verify_unsubscribe_token(tampered)
```

- [ ] **Step 2: Run test (must FAIL)**

```bash
cd backend && python -m pytest tests/services/test_email_unsubscribe.py -v
```

Expected: `ImportError: cannot import name 'generate_unsubscribe_token'`

- [ ] **Step 3: Implémenter le service**

```python
# backend/src/services/email_unsubscribe.py
"""Email unsubscribe token — signed with HMAC-SHA256 using JWT_SECRET_KEY.

Token format: base64url(payload).base64url(signature)
where payload = "{user_id}:{template_key}"
and signature = HMAC-SHA256(secret, payload)

Tokens are NOT time-limited — désinscription doit fonctionner même 6 mois après l'envoi.
"""

import base64
import hashlib
import hmac
from typing import Tuple

from core.config import JWT_CONFIG


class UnsubscribeTokenInvalid(Exception):
    """Raised when token signature is invalid or payload malformed."""


def _b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64u_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _secret() -> bytes:
    secret = JWT_CONFIG.get("SECRET_KEY")
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY not configured — required for unsubscribe tokens")
    return secret.encode("utf-8")


def generate_unsubscribe_token(user_id: int, template_key: str) -> str:
    """Generate a signed unsubscribe token. template_key='all' = global unsub."""
    payload = f"{user_id}:{template_key}".encode("utf-8")
    signature = hmac.new(_secret(), payload, hashlib.sha256).digest()
    return f"{_b64u_encode(payload)}.{_b64u_encode(signature)}"


def verify_unsubscribe_token(token: str) -> Tuple[int, str]:
    """Verify token and return (user_id, template_key). Raises UnsubscribeTokenInvalid on failure."""
    try:
        payload_b64, sig_b64 = token.split(".")
        payload = _b64u_decode(payload_b64)
        signature = _b64u_decode(sig_b64)
    except (ValueError, Exception) as e:
        raise UnsubscribeTokenInvalid(f"Malformed token: {e}")

    expected = hmac.new(_secret(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(signature, expected):
        raise UnsubscribeTokenInvalid("Bad signature")

    try:
        user_id_str, template_key = payload.decode("utf-8").split(":", 1)
        return int(user_id_str), template_key
    except (ValueError, UnicodeDecodeError) as e:
        raise UnsubscribeTokenInvalid(f"Malformed payload: {e}")
```

- [ ] **Step 4: Run test — must PASS**

```bash
cd backend && python -m pytest tests/services/test_email_unsubscribe.py -v
```

Expected: 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/email_unsubscribe.py backend/tests/services/test_email_unsubscribe.py backend/tests/services/__init__.py
git commit -m "feat(email): add HMAC-SHA256 unsubscribe token service with tests"
```

---

### Task 4: Service `email_sequences.py` — scheduling + cancellation + dispatch

**Files:**

- Create: `backend/src/services/email_sequences.py`
- Test: `backend/tests/services/test_email_sequences.py`

- [ ] **Step 1: Écrire le test (4 cas)**

```python
# backend/tests/services/test_email_sequences.py
"""Tests for welcome sequence scheduling, cancellation, and dispatch."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from sqlalchemy import select
from db.database import EmailScheduled, User
from services.email_sequences import (
    schedule_welcome_sequence,
    cancel_marketing_emails,
    is_user_unsubscribed,
    SEQUENCE_TEMPLATES,
)


@pytest.mark.asyncio
async def test_schedule_welcome_sequence_inserts_5_rows(db_session, test_user):
    await schedule_welcome_sequence(db_session, test_user)
    await db_session.flush()
    result = await db_session.execute(
        select(EmailScheduled).where(EmailScheduled.user_id == test_user.id).order_by(EmailScheduled.send_at)
    )
    rows = result.scalars().all()
    assert len(rows) == 5
    assert [r.template_key for r in rows] == [
        "welcome",
        "tip_first_analysis",
        "feature_archive",
        "social_proof",
        "upgrade_nudge",
    ]
    # send_at offsets: 0d, 1d, 3d, 7d, 14d
    base = rows[0].send_at
    assert (rows[1].send_at - base).days == 1
    assert (rows[4].send_at - base).days == 14


@pytest.mark.asyncio
async def test_schedule_welcome_sequence_idempotent(db_session, test_user):
    await schedule_welcome_sequence(db_session, test_user)
    await schedule_welcome_sequence(db_session, test_user)  # second call no-op
    await db_session.flush()
    result = await db_session.execute(
        select(EmailScheduled).where(EmailScheduled.user_id == test_user.id)
    )
    assert len(result.scalars().all()) == 5


@pytest.mark.asyncio
async def test_cancel_marketing_emails_keeps_welcome(db_session, test_user):
    """When user upgrades to Pro, cancel marketing (J+7, J+14) but keep welcome/tip/feature."""
    await schedule_welcome_sequence(db_session, test_user)
    await db_session.flush()
    await cancel_marketing_emails(db_session, test_user.id, reason="upgraded_to_pro")
    await db_session.flush()

    result = await db_session.execute(
        select(EmailScheduled).where(EmailScheduled.user_id == test_user.id)
    )
    rows = {r.template_key: r for r in result.scalars().all()}
    assert rows["welcome"].cancelled is False
    assert rows["tip_first_analysis"].cancelled is False
    assert rows["feature_archive"].cancelled is False
    assert rows["social_proof"].cancelled is True
    assert rows["upgrade_nudge"].cancelled is True
    assert rows["social_proof"].cancel_reason == "upgraded_to_pro"


@pytest.mark.asyncio
async def test_is_user_unsubscribed_reads_preferences(db_session, test_user):
    test_user.preferences = {"marketing_emails_consent": False}
    await db_session.flush()
    assert await is_user_unsubscribed(test_user) is True

    test_user.preferences = {"marketing_emails_consent": True}
    await db_session.flush()
    assert await is_user_unsubscribed(test_user) is False
```

- [ ] **Step 2: Run test (must FAIL)**

```bash
cd backend && python -m pytest tests/services/test_email_sequences.py -v
```

Expected: ImportError.

- [ ] **Step 3: Implémenter le service**

```python
# backend/src/services/email_sequences.py
"""Welcome series scheduling + dispatch for Resend.

J+0 (welcome) — TRANSACTIONAL — sent regardless of marketing consent
J+1 (tip_first_analysis) — MARKETING — skipped if consent=False
J+3 (feature_archive) — MARKETING
J+7 (social_proof) — MARKETING — also requires user.plan == "free"
J+14 (upgrade_nudge) — MARKETING — also requires user.plan == "free" + no active trial
"""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, and_, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.logging import logger
from db.database import EmailScheduled, EmailEvent, User
from services.email_service import email_service

# Resend rate limit (already enforced by email_queue, this is just throttle between schedule loops)
RESEND_THROTTLE_SECONDS = 0.5  # 2 req/s = 0.5s entre envois


@dataclass(frozen=True)
class SequenceStep:
    template_key: str
    days_offset: int
    is_marketing: bool  # False for welcome (transactional)
    requires_free_plan: bool  # True for social_proof and upgrade_nudge


SEQUENCE_TEMPLATES: list[SequenceStep] = [
    SequenceStep("welcome", 0, is_marketing=False, requires_free_plan=False),
    SequenceStep("tip_first_analysis", 1, is_marketing=True, requires_free_plan=False),
    SequenceStep("feature_archive", 3, is_marketing=True, requires_free_plan=False),
    SequenceStep("social_proof", 7, is_marketing=True, requires_free_plan=True),
    SequenceStep("upgrade_nudge", 14, is_marketing=True, requires_free_plan=True),
]

MARKETING_TEMPLATES = {s.template_key for s in SEQUENCE_TEMPLATES if s.is_marketing}


# ─────────────────────────────────────────────────────────────────────────────
# Scheduling (called from auth/router.py at email verification)
# ─────────────────────────────────────────────────────────────────────────────


async def schedule_welcome_sequence(db: AsyncSession, user: User) -> int:
    """Insert 5 EmailScheduled rows for the user (idempotent).

    Returns: number of rows inserted (0 if already scheduled).
    """
    now = datetime.now(timezone.utc)

    # Idempotence: skip if any row already exists for this user
    existing = await db.execute(
        select(EmailScheduled.id).where(EmailScheduled.user_id == user.id).limit(1)
    )
    if existing.scalar() is not None:
        logger.info(
            "Welcome sequence already scheduled — skipping",
            extra={"user_id": user.id},
        )
        return 0

    inserted = 0
    for step in SEQUENCE_TEMPLATES:
        send_at = now + timedelta(days=step.days_offset)
        row = EmailScheduled(
            user_id=user.id,
            template_key=step.template_key,
            send_at=send_at,
            event_metadata={"source": "welcome_sequence_v1", "user_lang": user.default_lang or "fr"},
        )
        db.add(row)
        inserted += 1

    logger.info(
        "Welcome sequence scheduled",
        extra={"user_id": user.id, "rows": inserted},
    )
    return inserted


# ─────────────────────────────────────────────────────────────────────────────
# Cancellation (called from billing/router.py on Stripe upgrade webhook)
# ─────────────────────────────────────────────────────────────────────────────


async def cancel_marketing_emails(
    db: AsyncSession, user_id: int, reason: str
) -> int:
    """Cancel all unsent MARKETING emails for a user.

    Used when:
    - User upgrades to paid plan (cancel social_proof + upgrade_nudge)
    - User unsubscribes globally (cancel everything except already-sent)

    Returns: number of cancelled rows.
    """
    template_keys = list(MARKETING_TEMPLATES)
    result = await db.execute(
        update(EmailScheduled)
        .where(
            and_(
                EmailScheduled.user_id == user_id,
                EmailScheduled.template_key.in_(template_keys),
                EmailScheduled.sent_at.is_(None),
                EmailScheduled.cancelled == False,  # noqa: E712
            )
        )
        .values(cancelled=True, cancel_reason=reason)
    )
    count = result.rowcount or 0
    logger.info(
        "Marketing emails cancelled",
        extra={"user_id": user_id, "count": count, "reason": reason},
    )
    return count


# ─────────────────────────────────────────────────────────────────────────────
# Consent check (read user.preferences JSON)
# ─────────────────────────────────────────────────────────────────────────────


async def is_user_unsubscribed(user: User) -> bool:
    """True if user has set marketing_emails_consent = False."""
    prefs = user.preferences or {}
    return prefs.get("marketing_emails_consent") is False


# ─────────────────────────────────────────────────────────────────────────────
# Dispatch (called from main.py APScheduler every 5 min)
# ─────────────────────────────────────────────────────────────────────────────


async def process_scheduled_emails(db: AsyncSession, max_per_run: int = 50) -> dict:
    """Find all due email_scheduled rows, send them via email_service, mark sent_at.

    Returns: {"sent": N, "skipped_unsubscribed": N, "skipped_paid_plan": N, "errors": N}
    """
    stats = {"sent": 0, "skipped_unsubscribed": 0, "skipped_paid_plan": 0, "errors": 0}
    now = datetime.now(timezone.utc)

    # Pick due rows + join user
    rows_result = await db.execute(
        select(EmailScheduled, User)
        .join(User, EmailScheduled.user_id == User.id)
        .where(
            and_(
                EmailScheduled.send_at <= now,
                EmailScheduled.sent_at.is_(None),
                EmailScheduled.cancelled == False,  # noqa: E712
            )
        )
        .order_by(EmailScheduled.send_at)
        .limit(max_per_run)
    )
    rows = rows_result.all()

    if not rows:
        return stats

    # Sequence step lookup
    step_by_key = {s.template_key: s for s in SEQUENCE_TEMPLATES}

    for scheduled, user in rows:
        try:
            step = step_by_key.get(scheduled.template_key)
            if step is None:
                logger.warning(
                    "Unknown template_key — marking as sent to avoid loop",
                    extra={"id": scheduled.id, "key": scheduled.template_key},
                )
                scheduled.sent_at = now
                continue

            # Audience filtering
            if step.is_marketing and await is_user_unsubscribed(user):
                scheduled.cancelled = True
                scheduled.cancel_reason = "user_unsubscribed"
                stats["skipped_unsubscribed"] += 1
                continue

            if step.requires_free_plan and (user.plan or "free") != "free":
                scheduled.cancelled = True
                scheduled.cancel_reason = "user_on_paid_plan"
                stats["skipped_paid_plan"] += 1
                continue

            # Send via email_service (queue handles rate limiting)
            success = await email_service.send_template_for_user(
                user=user,
                template_key=scheduled.template_key,
            )

            if success:
                scheduled.sent_at = now
                stats["sent"] += 1
                # Insert sent event for analytics
                db.add(
                    EmailEvent(
                        user_id=user.id,
                        template_key=scheduled.template_key,
                        event_type="sent",
                        event_metadata={"scheduled_id": scheduled.id},
                    )
                )
            else:
                stats["errors"] += 1
                logger.warning(
                    "Email send failed — will retry next run",
                    extra={"scheduled_id": scheduled.id, "user_id": user.id},
                )

            # Throttle between emails (defense-in-depth — queue also throttles)
            await asyncio.sleep(RESEND_THROTTLE_SECONDS)

        except Exception as e:
            stats["errors"] += 1
            logger.exception(
                "Error dispatching scheduled email",
                extra={"scheduled_id": scheduled.id, "error": str(e)},
            )

    await db.commit()
    return stats
```

- [ ] **Step 4: Run tests (the 3 first must PASS, the 4th `is_user_unsubscribed` must PASS)**

```bash
cd backend && python -m pytest tests/services/test_email_sequences.py -v
```

Expected: 4 tests passed.

⚠️ Si fixture `db_session` ou `test_user` manque, regarder `backend/tests/conftest.py` pour les fixtures existantes. Elles existent déjà (vues dans la suite de tests auth).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/email_sequences.py backend/tests/services/test_email_sequences.py
git commit -m "feat(email): add welcome sequence scheduler with idempotence and cancellation"
```

---

### Task 5: Étendre `email_service.py` avec `send_template_for_user(user, template_key)`

**Files:**

- Modify: `backend/src/services/email_service.py`

- [ ] **Step 1: Lire la fonction existante `_render` (ligne 63-65) pour comprendre le pattern**

Ouvrir `backend/src/services/email_service.py` lignes 63-65.

- [ ] **Step 2: Ajouter la nouvelle méthode `send_template_for_user`**

À la fin de la classe `EmailService` (avant le `email_service = EmailService()` en bas du fichier), ajouter :

```python
    async def send_template_for_user(
        self,
        user,  # db.database.User
        template_key: str,
    ) -> bool:
        """Render and send a sequenced/transactional template to a user.

        - Picks template file by lang: <template_key>_<lang>.html (lang from user.default_lang)
        - Falls back to <template_key>_fr.html if user lang missing
        - Builds context: username, frontend_url, app_name, pro_price, expert_price,
          unsubscribe_url, preferences_url
        - Sends via queue (transactional flag = True for "welcome" template only)
        """
        from services.email_unsubscribe import generate_unsubscribe_token
        from billing.plan_config import PLANS, PlanId
        from core.config import APP_NAME, FRONTEND_URL

        lang = (user.default_lang or "fr").lower()
        if lang not in ("fr", "en"):
            lang = "fr"

        username = user.username or user.email.split("@")[0]
        unsub_token = generate_unsubscribe_token(user.id, "all")
        single_unsub_token = generate_unsubscribe_token(user.id, template_key)

        # Pricing pulled from SSOT (billing/plan_config.py)
        pro_cents = PLANS.get(PlanId.PRO, {}).get("price_monthly_cents", 999)
        expert_cents = PLANS.get(getattr(PlanId, "EXPERT", "expert"), {}).get(
            "price_monthly_cents", 1999
        )

        def fmt_price(cents: int, lang: str) -> str:
            euros = cents / 100
            if lang == "fr":
                return f"{euros:.2f}".replace(".", ",") + " €"
            return f"€{euros:.2f}"

        ctx = {
            "username": username,
            "app_name": APP_NAME,
            "frontend_url": FRONTEND_URL,
            "pro_price": fmt_price(pro_cents, lang),
            "expert_price": fmt_price(expert_cents, lang),
            "unsubscribe_url": f"{FRONTEND_URL}/email/unsubscribe?token={unsub_token}",
            "single_unsubscribe_url": f"{FRONTEND_URL}/email/unsubscribe?token={single_unsub_token}",
            "preferences_url": f"{FRONTEND_URL}/email/preferences",
            "current_year": "2026",
        }

        template_filename = f"{template_key}_{lang}.html"
        try:
            html = self._render(template_filename, **ctx)
        except Exception:
            # Fallback FR
            logger.warning(
                "Template missing — falling back to FR",
                extra={"template_key": template_key, "lang": lang},
            )
            html = self._render(f"{template_key}_fr.html", **ctx)

        # Subject by template+lang
        subjects = {
            ("welcome", "fr"): f"Bienvenue sur {APP_NAME}, {username} !",
            ("welcome", "en"): f"Welcome to {APP_NAME}, {username}!",
            ("tip_first_analysis", "fr"): "Astuce : votre premiere analyse en 30 secondes",
            ("tip_first_analysis", "en"): "Tip: your first analysis in 30 seconds",
            ("feature_archive", "fr"): "Vos analyses sont archivees a vie",
            ("feature_archive", "en"): "Your analyses are archived forever",
            ("social_proof", "fr"): "Comment Marie gagne 2h par semaine",
            ("social_proof", "en"): "How Marie saves 2 hours per week",
            ("upgrade_nudge", "fr"): f"Passez Pro pour {ctx['pro_price']}/mois",
            ("upgrade_nudge", "en"): f"Upgrade to Pro for {ctx['pro_price']}/mo",
        }
        subject = subjects.get((template_key, lang)) or f"{APP_NAME} — {template_key}"

        is_priority = template_key == "welcome"

        return await self.send_email(
            to=user.email,
            subject=subject,
            html_content=html,
            text_content=None,  # text fallback rendered server-side by Resend
            priority=is_priority,
        )
```

⚠️ Vérifier les imports en haut du fichier — `logger` doit être importé. Si non, ajouter `from core.logging import logger`.

- [ ] **Step 3: Test smoke (l'instance email_service doit pouvoir être importée sans erreur)**

```bash
cd backend/src && python -c "from services.email_service import email_service; print(hasattr(email_service, 'send_template_for_user'))"
```

Expected: `True`

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/email_service.py
git commit -m "feat(email): add send_template_for_user with i18n and pricing context"
```

---

### Task 6: Templates HTML × 5 × 2 langues + footer partial

**Files:**

- Create: `backend/src/templates/emails/_partials/footer_fr.html`
- Create: `backend/src/templates/emails/_partials/footer_en.html`
- Create: `backend/src/templates/emails/welcome_fr.html`
- Create: `backend/src/templates/emails/welcome_en.html`
- Create: `backend/src/templates/emails/tip_first_analysis_fr.html`
- Create: `backend/src/templates/emails/tip_first_analysis_en.html`
- Create: `backend/src/templates/emails/feature_archive_fr.html`
- Create: `backend/src/templates/emails/feature_archive_en.html`
- Create: `backend/src/templates/emails/social_proof_fr.html`
- Create: `backend/src/templates/emails/social_proof_en.html`
- Create: `backend/src/templates/emails/upgrade_nudge_fr.html`
- Create: `backend/src/templates/emails/upgrade_nudge_en.html`

- [ ] **Step 1: Créer le footer partial FR**

```html
<!-- backend/src/templates/emails/_partials/footer_fr.html -->
<div class="footer">
  <p><strong>{{ app_name }}</strong> — Analyse video par IA 100% europeenne</p>
  <p style="margin-top: 8px">
    <a href="{{ frontend_url }}">deepsightsynthesis.com</a>
  </p>
  <p
    style="margin-top: 16px; font-size: 11px; color: #475569; line-height: 1.6;"
  >
    Vous recevez cet email parce que vous etes inscrit sur {{ app_name }}.<br />
    <a href="{{ single_unsubscribe_url }}">Se desabonner de cette serie</a>
    &nbsp;·&nbsp;
    <a href="{{ unsubscribe_url }}"
      >Se desabonner de tous les emails marketing</a
    >
    &nbsp;·&nbsp;
    <a href="{{ preferences_url }}">Mes preferences</a>
  </p>
  <p style="margin-top: 8px; font-size: 11px; color: #475569;">
    DeepSight Synthesis &copy; {{ current_year }} — Donnees hebergees en Europe
    (RGPD).
  </p>
</div>
```

- [ ] **Step 2: Créer le footer partial EN**

```html
<!-- backend/src/templates/emails/_partials/footer_en.html -->
<div class="footer">
  <p><strong>{{ app_name }}</strong> — 100% European AI video analysis</p>
  <p style="margin-top: 8px">
    <a href="{{ frontend_url }}">deepsightsynthesis.com</a>
  </p>
  <p
    style="margin-top: 16px; font-size: 11px; color: #475569; line-height: 1.6;"
  >
    You're receiving this email because you signed up for {{ app_name }}.<br />
    <a href="{{ single_unsubscribe_url }}">Unsubscribe from this series</a>
    &nbsp;·&nbsp;
    <a href="{{ unsubscribe_url }}">Unsubscribe from all marketing emails</a>
    &nbsp;·&nbsp;
    <a href="{{ preferences_url }}">My preferences</a>
  </p>
  <p style="margin-top: 8px; font-size: 11px; color: #475569;">
    DeepSight Synthesis &copy; {{ current_year }} — Data hosted in Europe
    (GDPR).
  </p>
</div>
```

- [ ] **Step 3: Créer welcome_fr.html (basé sur welcome.html existant + footer)**

```html
<!-- backend/src/templates/emails/welcome_fr.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bienvenue sur {{ app_name }}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(
          135deg,
          #6366f1 0%,
          #8b5cf6 50%,
          #06b6d4 100%
        );
        padding: 40px 32px;
        text-align: center;
      }
      .header-icon {
        font-size: 40px;
        margin-bottom: 8px;
      }
      .header-title {
        font-size: 26px;
        font-weight: 700;
        color: #ffffff;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .features {
        background-color: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
      }
      .feature {
        margin-bottom: 12px;
        font-size: 14px;
        color: #cbd5e1;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
      @media only screen and (max-width: 600px) {
        .wrapper {
          padding: 16px 8px;
        }
        .body {
          padding: 28px 20px;
        }
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <div class="header-icon">🌌</div>
          <div class="header-title">{{ app_name }}</div>
        </div>
        <div class="body">
          <p class="greeting">Bienvenue {{ username }} !</p>
          <p class="text">
            Votre compte est actif. Vous avez
            <strong>5 analyses gratuites</strong> par mois pour decouvrir la
            puissance de l'analyse video par IA.
          </p>
          <div class="features">
            <div class="feature">
              📊 <strong>5 analyses video</strong> chaque mois
            </div>
            <div class="feature">
              💬 <strong>Chat contextuel</strong> sur vos analyses
            </div>
            <div class="feature">
              🗂️ <strong>Historique 60 jours</strong> consultable
            </div>
            <div class="feature">
              🇪🇺 <strong>IA 100% francaise</strong> (Mistral AI) — vos donnees
              restent en Europe
            </div>
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/dashboard" class="cta"
              >Analyser ma premiere video</a
            >
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            Astuce : collez n'importe quel lien YouTube ou TikTok dans le
            tableau de bord.
          </p>
        </div>
        {% include "_partials/footer_fr.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 4: Créer welcome_en.html (même structure)**

```html
<!-- backend/src/templates/emails/welcome_en.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Welcome to {{ app_name }}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(
          135deg,
          #6366f1 0%,
          #8b5cf6 50%,
          #06b6d4 100%
        );
        padding: 40px 32px;
        text-align: center;
      }
      .header-icon {
        font-size: 40px;
        margin-bottom: 8px;
      }
      .header-title {
        font-size: 26px;
        font-weight: 700;
        color: #ffffff;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .features {
        background-color: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 12px;
        padding: 24px;
        margin: 24px 0;
      }
      .feature {
        margin-bottom: 12px;
        font-size: 14px;
        color: #cbd5e1;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        font-size: 15px;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <div class="header-icon">🌌</div>
          <div class="header-title">{{ app_name }}</div>
        </div>
        <div class="body">
          <p class="greeting">Welcome {{ username }}!</p>
          <p class="text">
            Your account is live. You have <strong>5 free analyses</strong> per
            month to discover the power of AI video analysis.
          </p>
          <div class="features">
            <div class="feature">
              📊 <strong>5 video analyses</strong> per month
            </div>
            <div class="feature">
              💬 <strong>Contextual chat</strong> on your analyses
            </div>
            <div class="feature">
              🗂️ <strong>60-day history</strong> available
            </div>
            <div class="feature">
              🇪🇺 <strong>100% French AI</strong> (Mistral AI) — your data stays
              in Europe
            </div>
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/dashboard" class="cta"
              >Analyze my first video</a
            >
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            Tip: paste any YouTube or TikTok link in your dashboard.
          </p>
        </div>
        {% include "_partials/footer_en.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 5: Créer tip_first_analysis_fr.html**

```html
<!-- backend/src/templates/emails/tip_first_analysis_fr.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Astuce — Premiere analyse</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .step {
        background-color: rgba(99, 102, 241, 0.08);
        border-left: 3px solid #6366f1;
        padding: 16px;
        margin: 12px 0;
        border-radius: 6px;
        color: #cbd5e1;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">💡 Astuce du jour</div>
        <div class="body">
          <p class="greeting">Salut {{ username }} !</p>
          <p class="text">
            1 lien YouTube ou TikTok = 1 synthese complete. C'est aussi simple
            que ca.
          </p>
          <div class="step">
            <strong>1.</strong> Copiez n'importe quel lien YouTube ou TikTok
          </div>
          <div class="step">
            <strong>2.</strong> Collez-le dans votre tableau de bord
          </div>
          <div class="step">
            <strong>3.</strong> Recevez en moins de 60 secondes : resume, points
            cles, fact-checks et chat contextuel
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/dashboard" class="cta"
              >Lancer ma premiere analyse</a
            >
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            PS : meme une video de 2h tient en 1 page lisible. Magique.
          </p>
        </div>
        {% include "_partials/footer_fr.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 6: Créer tip_first_analysis_en.html**

```html
<!-- backend/src/templates/emails/tip_first_analysis_en.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tip — First Analysis</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .step {
        background-color: rgba(99, 102, 241, 0.08);
        border-left: 3px solid #6366f1;
        padding: 16px;
        margin: 12px 0;
        border-radius: 6px;
        color: #cbd5e1;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">💡 Daily Tip</div>
        <div class="body">
          <p class="greeting">Hi {{ username }}!</p>
          <p class="text">
            1 YouTube or TikTok link = 1 full synthesis. It's that simple.
          </p>
          <div class="step">
            <strong>1.</strong> Copy any YouTube or TikTok URL
          </div>
          <div class="step">
            <strong>2.</strong> Paste it into your dashboard
          </div>
          <div class="step">
            <strong>3.</strong> Receive in under 60 seconds: summary, key
            points, fact-checks, contextual chat
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/dashboard" class="cta"
              >Run my first analysis</a
            >
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            PS: even a 2-hour video fits on 1 readable page. Magic.
          </p>
        </div>
        {% include "_partials/footer_en.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 7: Créer feature_archive_fr.html**

```html
<!-- backend/src/templates/emails/feature_archive_fr.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vos analyses — archivees a vie</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .quote {
        background-color: rgba(6, 182, 212, 0.08);
        border-left: 3px solid #06b6d4;
        padding: 20px;
        margin: 24px 0;
        border-radius: 6px;
        color: #cbd5e1;
        font-style: italic;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">🗂️ Archives a vie</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            Vous le saviez ? Toutes vos analyses sont conservees indefiniment
            dans votre historique. Pas d'expiration, pas de purge.
          </p>
          <p class="text"><strong>Pourquoi c'est utile :</strong></p>
          <ul style="color: #cbd5e1; line-height: 1.8;">
            <li>
              📚 <strong>Constituez une base de connaissances</strong> a partir
              des videos que vous regardez
            </li>
            <li>
              🔍 <strong>Recherche semantique</strong> : retrouvez une idee meme
              6 mois plus tard
            </li>
            <li>
              🧠 <strong>Re-discutez</strong> avec n'importe quelle analyse via
              le chat contextuel
            </li>
          </ul>
          <div class="quote">
            "J'ai 6 mois d'analyses dans mon historique. Quand je cherche une
            citation, je la retrouve en 3 secondes."
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/history" class="cta"
              >Voir mon historique</a
            >
          </div>
        </div>
        {% include "_partials/footer_fr.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 8: Créer feature_archive_en.html**

```html
<!-- backend/src/templates/emails/feature_archive_en.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your analyses — archived forever</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .quote {
        background-color: rgba(6, 182, 212, 0.08);
        border-left: 3px solid #06b6d4;
        padding: 20px;
        margin: 24px 0;
        border-radius: 6px;
        color: #cbd5e1;
        font-style: italic;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #06b6d4, #6366f1);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">🗂️ Archived forever</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            Did you know? All your analyses are kept indefinitely in your
            history. No expiration, no purge.
          </p>
          <p class="text"><strong>Why it matters:</strong></p>
          <ul style="color: #cbd5e1; line-height: 1.8;">
            <li>
              📚 <strong>Build your own knowledge base</strong> from the videos
              you watch
            </li>
            <li>
              🔍 <strong>Semantic search</strong>: find an idea even 6 months
              later
            </li>
            <li>
              🧠 <strong>Re-chat</strong> with any analysis via contextual chat
            </li>
          </ul>
          <div class="quote">
            "I have 6 months of analyses in my history. When I look for a quote,
            I find it in 3 seconds."
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/history" class="cta">View my history</a>
          </div>
        </div>
        {% include "_partials/footer_en.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 9: Créer social_proof_fr.html**

```html
<!-- backend/src/templates/emails/social_proof_fr.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Comment Marie gagne 2h par semaine</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .testimonial {
        background-color: rgba(139, 92, 246, 0.08);
        border-left: 3px solid #8b5cf6;
        padding: 24px;
        margin: 24px 0;
        border-radius: 6px;
        color: #cbd5e1;
        font-style: italic;
        line-height: 1.7;
      }
      .author {
        font-size: 13px;
        color: #64748b;
        margin-top: 12px;
        font-style: normal;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #8b5cf6, #6366f1);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">⭐ Temoignage utilisateur</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            Marie, etudiante en sciences politiques, raconte comment elle a
            transforme sa veille video en gain de temps.
          </p>
          <div class="testimonial">
            "Avant, je passais 3h par jour a regarder des conferences sur
            YouTube. Avec {{ app_name }}, je traite 10 videos en 30 minutes :
            synthese, points cles, fact-checks. Je gagne 2h par semaine —
            facile."
            <div class="author">— Marie, 23 ans, etudiante a Sciences Po</div>
          </div>
          <p class="text">
            Vous etes en plan gratuit (5 analyses/mois). Avec
            <strong>Pro a {{ pro_price }}/mois</strong>, vous passez a 30
            analyses + fact-check automatique + cartes mentales + export PDF.
          </p>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/upgrade" class="cta">Decouvrir Pro</a>
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            Pas d'engagement. Annulez en 1 clic.
          </p>
        </div>
        {% include "_partials/footer_fr.html" %}
      </div>
    </div>
  </body>
</html>
```

⚠️ Le témoignage "Marie" est fictif (placeholder). Si l'équipe a un vrai témoignage utilisateur, le remplacer ici. Sinon, accepter le placeholder pour V1.

- [ ] **Step 10: Créer social_proof_en.html**

```html
<!-- backend/src/templates/emails/social_proof_en.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>How Marie saves 2 hours per week</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #8b5cf6, #ec4899);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .testimonial {
        background-color: rgba(139, 92, 246, 0.08);
        border-left: 3px solid #8b5cf6;
        padding: 24px;
        margin: 24px 0;
        border-radius: 6px;
        color: #cbd5e1;
        font-style: italic;
        line-height: 1.7;
      }
      .author {
        font-size: 13px;
        color: #64748b;
        margin-top: 12px;
        font-style: normal;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #8b5cf6, #6366f1);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 14px 36px;
        border-radius: 10px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">⭐ User testimonial</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            Marie, a political science student, shares how she turned her video
            watching into a time-saver.
          </p>
          <div class="testimonial">
            "I used to spend 3 hours a day watching YouTube lectures. With {{
            app_name }}, I process 10 videos in 30 minutes — summary, key
            points, fact-checks. I save 2 hours per week, easy."
            <div class="author">— Marie, 23, student at Sciences Po</div>
          </div>
          <p class="text">
            You're on the free plan (5 analyses/month). With
            <strong>Pro at {{ pro_price }}/mo</strong>, you get 30 analyses +
            automatic fact-check + mind maps + PDF export.
          </p>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/upgrade" class="cta">Discover Pro</a>
          </div>
          <p class="text" style="font-size: 13px; color: #64748b">
            No commitment. Cancel in 1 click.
          </p>
        </div>
        {% include "_partials/footer_en.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 11: Créer upgrade_nudge_fr.html**

```html
<!-- backend/src/templates/emails/upgrade_nudge_fr.html -->
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Passez Pro pour {{ pro_price }}/mois</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .price-box {
        background: linear-gradient(
          135deg,
          rgba(99, 102, 241, 0.12),
          rgba(139, 92, 246, 0.12)
        );
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 14px;
        padding: 24px;
        text-align: center;
        margin: 24px 0;
      }
      .price {
        font-size: 36px;
        font-weight: 800;
        color: #f1f5f9;
        margin: 0;
      }
      .price-sub {
        font-size: 13px;
        color: #94a3b8;
        margin-top: 4px;
      }
      .features {
        background-color: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        padding: 20px;
        margin: 16px 0;
      }
      .feature {
        padding: 8px 0;
        font-size: 14px;
        color: #cbd5e1;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }
      .feature:last-child {
        border-bottom: none;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 16px 40px;
        border-radius: 10px;
        font-size: 16px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">🔥 Offre Pro</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            Cela fait 2 semaines que vous utilisez {{ app_name }}. Si vous
            voulez aller plus loin, voici ce que vous deverrouillez avec
            <strong>Pro</strong> :
          </p>
          <div class="features">
            <div class="feature">
              📊 <strong>30 analyses/mois</strong> (vs 5 en gratuit)
            </div>
            <div class="feature">
              ⏱️ <strong>Videos jusqu'a 2h</strong> (vs 15min)
            </div>
            <div class="feature">
              🔍 <strong>Fact-check automatique</strong> avec sources verifiees
            </div>
            <div class="feature">
              🧠 <strong>Cartes mentales</strong> generees a la volee
            </div>
            <div class="feature">
              🎙️ <strong>Voice chat</strong> avec vos analyses
            </div>
            <div class="feature">
              📄 <strong>Export PDF</strong> + DOCX + Markdown
            </div>
          </div>
          <div class="price-box">
            <p class="price">
              {{ pro_price }}<span style="font-size: 18px; color: #94a3b8;"
                >/mois</span
              >
            </p>
            <p class="price-sub">Sans engagement · Annulable en 1 clic</p>
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/upgrade" class="cta">Passer Pro</a>
          </div>
          <p
            class="text"
            style="font-size: 13px; color: #64748b; text-align: center;"
          >
            Vous pouvez aussi passer Expert ({{ expert_price }}/mois) pour 100
            analyses + voice chat illimite.
          </p>
        </div>
        {% include "_partials/footer_fr.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 12: Créer upgrade_nudge_en.html**

```html
<!-- backend/src/templates/emails/upgrade_nudge_en.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Upgrade to Pro for {{ pro_price }}/mo</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0a0a0f;
        font-family:
          -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #e2e8f0;
      }
      .wrapper {
        width: 100%;
        padding: 40px 16px;
        background-color: #0a0a0f;
      }
      .container {
        max-width: 560px;
        margin: 0 auto;
        background-color: #12121a;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.06);
      }
      .header {
        background: linear-gradient(135deg, #f59e0b, #ef4444);
        padding: 32px;
        text-align: center;
        color: #fff;
        font-size: 22px;
        font-weight: 700;
      }
      .body {
        padding: 36px 32px;
      }
      .greeting {
        font-size: 20px;
        font-weight: 600;
        color: #f1f5f9;
        margin: 0 0 16px 0;
      }
      .text {
        font-size: 15px;
        line-height: 1.7;
        color: #94a3b8;
        margin: 0 0 20px 0;
      }
      .price-box {
        background: linear-gradient(
          135deg,
          rgba(99, 102, 241, 0.12),
          rgba(139, 92, 246, 0.12)
        );
        border: 1px solid rgba(139, 92, 246, 0.3);
        border-radius: 14px;
        padding: 24px;
        text-align: center;
        margin: 24px 0;
      }
      .price {
        font-size: 36px;
        font-weight: 800;
        color: #f1f5f9;
        margin: 0;
      }
      .price-sub {
        font-size: 13px;
        color: #94a3b8;
        margin-top: 4px;
      }
      .features {
        background-color: rgba(255, 255, 255, 0.04);
        border-radius: 12px;
        padding: 20px;
        margin: 16px 0;
      }
      .feature {
        padding: 8px 0;
        font-size: 14px;
        color: #cbd5e1;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      }
      .feature:last-child {
        border-bottom: none;
      }
      .cta-wrap {
        text-align: center;
        margin: 32px 0;
      }
      .cta {
        display: inline-block;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #ffffff !important;
        text-decoration: none;
        font-weight: 600;
        padding: 16px 40px;
        border-radius: 10px;
        font-size: 16px;
      }
      .footer {
        background-color: rgba(255, 255, 255, 0.02);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
        padding: 24px 32px;
        text-align: center;
      }
      .footer p {
        margin: 0;
        font-size: 12px;
        color: #475569;
        line-height: 1.6;
      }
      .footer a {
        color: #6366f1;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">🔥 Pro offer</div>
        <div class="body">
          <p class="greeting">{{ username }},</p>
          <p class="text">
            You've been using {{ app_name }} for 2 weeks. Ready to go further?
            Here's what <strong>Pro</strong> unlocks:
          </p>
          <div class="features">
            <div class="feature">
              📊 <strong>30 analyses/month</strong> (vs 5 on Free)
            </div>
            <div class="feature">
              ⏱️ <strong>Videos up to 2h</strong> (vs 15min)
            </div>
            <div class="feature">
              🔍 <strong>Automatic fact-check</strong> with verified sources
            </div>
            <div class="feature">
              🧠 <strong>Mind maps</strong> generated on the fly
            </div>
            <div class="feature">
              🎙️ <strong>Voice chat</strong> with your analyses
            </div>
            <div class="feature">
              📄 <strong>PDF export</strong> + DOCX + Markdown
            </div>
          </div>
          <div class="price-box">
            <p class="price">
              {{ pro_price }}<span style="font-size: 18px; color: #94a3b8;"
                >/mo</span
              >
            </p>
            <p class="price-sub">No commitment · Cancel in 1 click</p>
          </div>
          <div class="cta-wrap">
            <a href="{{ frontend_url }}/upgrade" class="cta">Go Pro</a>
          </div>
          <p
            class="text"
            style="font-size: 13px; color: #64748b; text-align: center;"
          >
            Or go Expert ({{ expert_price }}/mo) for 100 analyses + unlimited
            voice chat.
          </p>
        </div>
        {% include "_partials/footer_en.html" %}
      </div>
    </div>
  </body>
</html>
```

- [ ] **Step 13: Smoke test render des 10 templates**

```bash
cd backend/src && python -c "
from services.email_service import email_service
ctx = {
    'username': 'Maxime', 'app_name': 'DeepSight', 'frontend_url': 'https://deepsightsynthesis.com',
    'pro_price': '9,99 €', 'expert_price': '19,99 €',
    'unsubscribe_url': 'https://x/u/abc', 'single_unsubscribe_url': 'https://x/u/abc',
    'preferences_url': 'https://x/p', 'current_year': '2026'
}
for k in ['welcome', 'tip_first_analysis', 'feature_archive', 'social_proof', 'upgrade_nudge']:
    for lang in ['fr', 'en']:
        h = email_service._render(f'{k}_{lang}.html', **ctx)
        assert 'Maxime' in h, f'{k}_{lang} missing username'
        assert '{{' not in h, f'{k}_{lang} unrendered Jinja'
print('All 10 templates render OK')
"
```

Expected: `All 10 templates render OK`

- [ ] **Step 14: Commit**

```bash
git add backend/src/templates/emails/_partials/footer_fr.html backend/src/templates/emails/_partials/footer_en.html backend/src/templates/emails/welcome_fr.html backend/src/templates/emails/welcome_en.html backend/src/templates/emails/tip_first_analysis_fr.html backend/src/templates/emails/tip_first_analysis_en.html backend/src/templates/emails/feature_archive_fr.html backend/src/templates/emails/feature_archive_en.html backend/src/templates/emails/social_proof_fr.html backend/src/templates/emails/social_proof_en.html backend/src/templates/emails/upgrade_nudge_fr.html backend/src/templates/emails/upgrade_nudge_en.html
git commit -m "feat(email): add 5 welcome series templates in FR + EN with shared footer partial"
```

---

### Task 7: Router `email/router.py` — webhook Resend + unsubscribe + preferences

**Files:**

- Create: `backend/src/email/__init__.py`
- Create: `backend/src/email/router.py`
- Test: `backend/tests/email/__init__.py`
- Test: `backend/tests/email/test_webhook_resend.py`

- [ ] **Step 1: Écrire le test webhook**

```python
# backend/tests/email/test_webhook_resend.py
"""Tests for Resend webhook signature verification + event ingestion."""

import json
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from db.database import EmailEvent
from email.router import _verify_resend_signature


def test_signature_verify_valid():
    secret = "whsec_test"
    payload = b'{"type":"email.delivered"}'
    # Simulate svix-style HMAC
    import hmac, hashlib
    sig = "v1," + hmac.new(secret.encode(), b"id.timestamp." + payload, hashlib.sha256).hexdigest()
    assert _verify_resend_signature(payload, sig, "id", "timestamp", secret) is True


def test_signature_verify_invalid():
    assert _verify_resend_signature(b"data", "v1,deadbeef", "id", "ts", "secret") is False


@pytest.mark.asyncio
async def test_webhook_inserts_event(async_client, db_session, test_user, monkeypatch):
    monkeypatch.setenv("RESEND_WEBHOOK_SECRET", "whsec_test")
    payload = {
        "type": "email.delivered",
        "data": {
            "email_id": "msg_abc",
            "to": [test_user.email],
            "tags": [{"name": "template_key", "value": "welcome"}, {"name": "user_id", "value": str(test_user.id)}],
        },
    }
    body = json.dumps(payload).encode()
    import hmac, hashlib
    sig = "v1," + hmac.new(b"whsec_test", b"id-1.1700000000." + body, hashlib.sha256).hexdigest()

    response = await async_client.post(
        "/api/email/webhook/resend",
        content=body,
        headers={
            "svix-id": "id-1",
            "svix-timestamp": "1700000000",
            "svix-signature": sig,
            "content-type": "application/json",
        },
    )
    assert response.status_code == 200
    result = await db_session.execute(
        select(EmailEvent).where(EmailEvent.resend_message_id == "msg_abc")
    )
    rows = result.scalars().all()
    assert len(rows) == 1
    assert rows[0].event_type == "delivered"
    assert rows[0].template_key == "welcome"
```

- [ ] **Step 2: Run test (must FAIL)**

```bash
cd backend && python -m pytest tests/email/test_webhook_resend.py -v
```

Expected: ImportError on `email.router`.

- [ ] **Step 3: Implémenter le router**

```python
# backend/src/email/__init__.py
```

```python
# backend/src/email/router.py
"""Email-related public endpoints: Resend webhook + unsubscribe + preferences."""

import hashlib
import hmac
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Depends, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from core.config import FRONTEND_URL
from core.logging import logger
from db.database import EmailEvent, User, get_session
from services.email_sequences import cancel_marketing_emails
from services.email_unsubscribe import (
    UnsubscribeTokenInvalid,
    verify_unsubscribe_token,
)

router = APIRouter(prefix="/api/email", tags=["email"])


# ─────────────────────────────────────────────────────────────────────────────
# Webhook signature verification (Resend uses svix)
# ─────────────────────────────────────────────────────────────────────────────


def _verify_resend_signature(
    body: bytes,
    signature_header: str,
    svix_id: str,
    svix_timestamp: str,
    secret: str,
) -> bool:
    """Verify svix-style webhook signature.

    Format: 'v1,<hex>'  where hex = HMAC-SHA256(secret, f'{svix_id}.{svix_timestamp}.{body}')
    """
    try:
        scheme, hex_sig = signature_header.split(",", 1)
        if scheme != "v1":
            return False
        secret_bytes = secret.encode("utf-8") if not secret.startswith("whsec_") else secret[len("whsec_") :].encode("utf-8")
        # Resend signs the raw secret (with or without prefix); we strip whsec_ for HMAC
        signed_data = f"{svix_id}.{svix_timestamp}.".encode("utf-8") + body
        expected = hmac.new(secret_bytes, signed_data, hashlib.sha256).hexdigest()
        return hmac.compare_digest(hex_sig, expected)
    except (ValueError, Exception):
        return False


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/email/webhook/resend — event tracking
# ─────────────────────────────────────────────────────────────────────────────

# Event type mapping (Resend event types → our EmailEvent.event_type)
RESEND_EVENT_MAP = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
}


@router.post("/webhook/resend")
async def resend_webhook(request: Request, db: AsyncSession = Depends(get_session)):
    """Receive Resend events (delivered/opened/clicked/etc.) and persist them.

    See: https://resend.com/docs/dashboard/webhooks/introduction
    Signature scheme: svix (https://docs.svix.com/receiving/verifying-payloads/how-manual)
    """
    body = await request.body()
    secret = os.getenv("RESEND_WEBHOOK_SECRET", "")
    if not secret:
        logger.warning("Resend webhook called but RESEND_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    sig = request.headers.get("svix-signature", "")
    svix_id = request.headers.get("svix-id", "")
    svix_ts = request.headers.get("svix-timestamp", "")

    if not _verify_resend_signature(body, sig, svix_id, svix_ts, secret):
        logger.warning("Invalid Resend webhook signature", extra={"svix_id": svix_id})
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event_type_resend = payload.get("type", "")
    event_type = RESEND_EVENT_MAP.get(event_type_resend)
    if event_type is None:
        logger.info("Ignoring unknown Resend event type", extra={"type": event_type_resend})
        return {"status": "ignored"}

    data = payload.get("data", {})
    message_id = data.get("email_id") or data.get("id")
    tags = data.get("tags") or []
    tag_dict = {t.get("name"): t.get("value") for t in tags if isinstance(t, dict)}

    template_key = tag_dict.get("template_key", "unknown")
    user_id_str = tag_dict.get("user_id")
    user_id = int(user_id_str) if user_id_str and user_id_str.isdigit() else None

    event = EmailEvent(
        user_id=user_id,
        template_key=template_key,
        event_type=event_type,
        resend_message_id=message_id,
        event_metadata={"raw": data},
    )
    db.add(event)

    # Auto-handle complained/bounced → unsubscribe user from marketing
    if event_type in ("complained", "bounced") and user_id is not None:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user is not None:
            prefs = user.preferences or {}
            prefs["marketing_emails_consent"] = False
            user.preferences = prefs
            await cancel_marketing_emails(db, user_id, reason=f"resend_{event_type}")

    await db.commit()
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/email/unsubscribe?token=... — token-based public unsubscribe
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/unsubscribe")
async def unsubscribe(token: str, db: AsyncSession = Depends(get_session)):
    """Public endpoint reached by clicking footer link. No auth required (signed token)."""
    try:
        user_id, template_key = verify_unsubscribe_token(token)
    except UnsubscribeTokenInvalid:
        return RedirectResponse(url=f"{FRONTEND_URL}/email/unsubscribe?status=invalid")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        return RedirectResponse(url=f"{FRONTEND_URL}/email/unsubscribe?status=not_found")

    prefs = user.preferences or {}
    prefs["marketing_emails_consent"] = False
    user.preferences = prefs
    await cancel_marketing_emails(db, user_id, reason=f"user_unsubscribed_via_link_{template_key}")

    db.add(
        EmailEvent(
            user_id=user_id,
            template_key=template_key,
            event_type="unsubscribed",
            event_metadata={"via": "footer_link"},
        )
    )
    await db.commit()
    return RedirectResponse(url=f"{FRONTEND_URL}/email/unsubscribe?status=ok")


# ─────────────────────────────────────────────────────────────────────────────
# GET/POST /api/email/preferences — authenticated preferences page
# ─────────────────────────────────────────────────────────────────────────────


class EmailPreferencesIn(BaseModel):
    marketing_emails_consent: bool


@router.get("/preferences")
async def get_preferences(user: User = Depends(get_current_user)):
    prefs = user.preferences or {}
    return {
        "marketing_emails_consent": prefs.get("marketing_emails_consent", True),
        "email": user.email,
    }


@router.post("/preferences", status_code=status.HTTP_200_OK)
async def update_preferences(
    data: EmailPreferencesIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    prefs = user.preferences or {}
    prefs["marketing_emails_consent"] = data.marketing_emails_consent
    user.preferences = prefs

    # Cascade: if user opts out, cancel pending marketing
    if not data.marketing_emails_consent:
        await cancel_marketing_emails(db, user.id, reason="user_pref_opt_out")

    await db.commit()
    return {"status": "ok"}
```

- [ ] **Step 4: Inclure le router dans main.py**

Ouvrir `backend/src/main.py` et trouver où les autres routers sont inclus (`grep -n "app.include_router" backend/src/main.py | head -3`). Ajouter à proximité (juste après `auth.router` par exemple) :

```python
from email.router import router as email_router
app.include_router(email_router)
```

⚠️ Attention : `email` collidera avec le module stdlib `email`. Préférer renommer en `emails/router.py` (dossier `emails/` au pluriel) pour éviter l'ambiguïté. Si tu choisis cette voie, mets à jour tous les imports en conséquence (Task 4 ne change pas, mais les Steps 1, 3 et 4 ci-dessus utilisent `from emails.router import router as email_router` et `tests/emails/test_webhook_resend.py`).

**Décision recommandée : utiliser `emails/` (pluriel) pour éviter shadow du module stdlib `email`.** Renommer toutes les références à `backend/src/email/` en `backend/src/emails/` et tests `backend/tests/email/` en `backend/tests/emails/`.

- [ ] **Step 5: Run tests**

```bash
cd backend && python -m pytest tests/emails/test_webhook_resend.py -v
```

Expected: 3 tests passed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/emails/ backend/tests/emails/ backend/src/main.py
git commit -m "feat(email): add Resend webhook router with svix signature verification + unsubscribe endpoint"
```

---

### Task 8: Brancher `schedule_welcome_sequence` sur la confirmation email

**Files:**

- Modify: `backend/src/auth/router.py` (lignes 223-228 — bloc welcome email)

- [ ] **Step 1: Lire le bloc actuel**

Lignes 223-228 de `backend/src/auth/router.py` :

```python
    # 📧 Send welcome email after successful verification
    if EMAIL_CONFIG.get("ENABLED"):
        try:
            await send_welcome_email(user.email, user.username)
        except Exception:
            pass  # Non-blocking — don't fail verification if email fails
```

- [ ] **Step 2: Remplacer par le scheduling complet**

```python
    # 📧 Schedule full welcome sequence after successful verification
    # - J+0 welcome (transactional, sent immediately by dispatcher)
    # - J+1 tip_first_analysis
    # - J+3 feature_archive
    # - J+7 social_proof (only if user.plan == 'free' at send time)
    # - J+14 upgrade_nudge (only if user.plan == 'free' at send time)
    if EMAIL_CONFIG.get("ENABLED"):
        try:
            from services.email_sequences import schedule_welcome_sequence

            await schedule_welcome_sequence(session, user)
        except Exception as e:
            from core.logging import logger as _log

            _log.error(f"Failed to schedule welcome sequence: {e}")
            # Non-blocking — don't fail verification if scheduling fails
```

- [ ] **Step 3: Run auth tests pour vérifier non-régression**

```bash
cd backend && python -m pytest tests/auth/ tests/test_auth_flow.py -v
```

Expected: tous les tests auth passent (ils n'asseront pas l'envoi d'email — juste que `verify_email` ne casse pas).

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/router.py
git commit -m "feat(email): schedule full welcome sequence at email verification (not just J+0)"
```

---

### Task 9: APScheduler — remplacer `_scheduled_onboarding` par `_scheduled_email_dispatch`

**Files:**

- Modify: `backend/src/main.py` (lignes 677-718)

- [ ] **Step 1: Lire le bloc actuel pour voir le pattern Redis-lock**

```bash
sed -n '677,718p' backend/src/main.py
```

- [ ] **Step 2: Remplacer la fonction et le scheduler.add_job**

Remplacer le bloc lignes 677-718 par :

```python
        # 📧 Email dispatch job (every 5 min — sends due scheduled emails)
        from apscheduler.triggers.interval import IntervalTrigger as _IT

        async def _scheduled_email_dispatch():
            """Process due scheduled emails — Redis lock to avoid multi-worker dup."""
            try:
                lock_acquired = False
                try:
                    from core.cache import cache_service

                    if hasattr(cache_service, "backend") and hasattr(cache_service.backend, "redis"):
                        redis = cache_service.backend.redis
                        lock_acquired = await redis.set(
                            "deepsight:lock:email_dispatch", "1", nx=True, ex=240
                        )
                    else:
                        lock_acquired = True
                except Exception:
                    lock_acquired = True

                if not lock_acquired:
                    return

                from db.database import get_session as _get_sess

                async for db in _get_sess():
                    from services.email_sequences import process_scheduled_emails

                    stats = await process_scheduled_emails(db, max_per_run=50)
                    logger.info("Email dispatch processed", extra=stats)
                    break
            except Exception as e:
                logger.error(f"Email dispatch job failed: {e}")

        scheduler.add_job(
            _scheduled_email_dispatch,
            _IT(minutes=5),
            id="email_dispatch",
            name="Scheduled email dispatcher",
            replace_existing=True,
        )
        logger.info("Email dispatch scheduler registered (every 5 min)")
```

⚠️ Conserver l'ancien job `onboarding_emails` au moins 1 release pour la rétrocompatibilité avec les jobs déjà en file (`onboarding_email_log`). Marquer comme deprecated dans son log.

- [ ] **Step 3: Smoke test (le serveur doit démarrer sans erreur)**

```bash
cd backend/src && timeout 8 python -c "
import asyncio
from main import app
print('App loaded:', app.title)
"
```

Expected: `App loaded: DeepSight Synthesis API` (ou similaire)

- [ ] **Step 4: Commit**

```bash
git add backend/src/main.py
git commit -m "feat(email): swap onboarding cron for date-based email_dispatch (every 5 min)"
```

---

### Task 10: Cancel marketing on Stripe upgrade webhook

**Files:**

- Modify: `backend/src/billing/router.py` (au handler `subscription.created` ou `checkout.session.completed`)

- [ ] **Step 1: Trouver le handler Stripe approprié**

```bash
grep -n "subscription.created\|checkout.session.completed\|invoice.paid" backend/src/billing/router.py | head -5
```

- [ ] **Step 2: Localiser la fonction qui upgrade le `user.plan` à `pro` ou `expert`**

```bash
grep -n "user.plan = \|user\.plan =\|\"pro\"\|set.*plan" backend/src/billing/router.py | head -10
```

Expected: trouver l'endroit où `user.plan` passe de "free" à "pro"/"plus" après paiement.

- [ ] **Step 3: Ajouter l'appel `cancel_marketing_emails` après le set du plan**

À côté de l'assignation `user.plan = "pro"` (ou similaire), insérer :

```python
                # 📧 Cancel pending marketing emails (J+7, J+14) since user upgraded
                try:
                    from services.email_sequences import cancel_marketing_emails

                    await cancel_marketing_emails(
                        db, user.id, reason=f"upgraded_to_{user.plan}"
                    )
                except Exception as e:
                    logger.warning(f"Failed to cancel marketing emails: {e}")
```

- [ ] **Step 4: Run billing tests**

```bash
cd backend && python -m pytest tests/test_billing_webhooks.py -v
```

Expected: tests existants passent (la nouvelle logique est entourée d'un try/except, non bloquante).

- [ ] **Step 5: Commit**

```bash
git add backend/src/billing/router.py
git commit -m "feat(email): cancel marketing sequence when user upgrades to paid plan"
```

---

### Task 11: Frontend — pages unsubscribe + preferences + analytics events

**Files:**

- Create: `frontend/src/pages/EmailUnsubscribePage.tsx`
- Create: `frontend/src/pages/EmailPreferencesPage.tsx`
- Modify: `frontend/src/services/api.ts` (ajouter 3 méthodes)
- Modify: `frontend/src/services/analytics.ts` (ajouter `trackEmailEvent`)
- Modify: `frontend/src/App.tsx` ou router (ajouter 2 routes)

- [ ] **Step 1: Ajouter les méthodes dans `api.ts`**

```bash
grep -n "export const api\|export class\|api\.unsubscribe\|getEmailPreferences" frontend/src/services/api.ts | head -5
```

Repérer le pattern (probablement `export const api = { ... }`). Ajouter les 3 méthodes :

```typescript
// frontend/src/services/api.ts — append au bon endroit
async unsubscribeEmail(token: string): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/email/unsubscribe?token=${encodeURIComponent(token)}`, {
    method: "GET",
    redirect: "follow",
  });
  // Backend redirects to /email/unsubscribe?status=ok|invalid|not_found
  const url = new URL(res.url);
  return { status: url.searchParams.get("status") || "unknown" };
},

async getEmailPreferences(): Promise<{ marketing_emails_consent: boolean; email: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/email/preferences`);
  if (!res.ok) throw new Error("Failed to fetch preferences");
  return res.json();
},

async updateEmailPreferences(consent: boolean): Promise<{ status: string }> {
  const res = await fetchWithAuth(`${API_URL}/api/email/preferences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ marketing_emails_consent: consent }),
  });
  if (!res.ok) throw new Error("Failed to update preferences");
  return res.json();
},
```

⚠️ Adapter les noms `fetchWithAuth` / `API_URL` aux conventions exactes utilisées dans `api.ts` (regarder une autre méthode existante pour copier le pattern).

- [ ] **Step 2: Ajouter `trackEmailEvent` dans `analytics.ts`**

```typescript
// frontend/src/services/analytics.ts — append à l'export par défaut

export const trackEmailEvent = (
  event:
    | "email_link_clicked"
    | "email_unsubscribe_completed"
    | "email_preferences_changed",
  metadata: Record<string, unknown> = {},
) => {
  if (!posthog.has_opted_in_capturing()) return;
  posthog.capture(event, {
    ...metadata,
    source: "email_funnel",
  });
};

// Auto-capture if URL has utm_source=email
export const captureEmailLandingIfPresent = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("utm_source") === "email") {
    trackEmailEvent("email_link_clicked", {
      utm_campaign: params.get("utm_campaign"),
      utm_medium: params.get("utm_medium"),
    });
  }
};
```

- [ ] **Step 3: Créer `EmailUnsubscribePage.tsx`**

```tsx
// frontend/src/pages/EmailUnsubscribePage.tsx
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { trackEmailEvent } from "../services/analytics";

export default function EmailUnsubscribePage() {
  const [params] = useSearchParams();
  const status = params.get("status");
  const token = params.get("token");
  const [resolved, setResolved] = useState<string | null>(status);

  useEffect(() => {
    if (status) {
      // Backend already handled it via redirect
      if (status === "ok") trackEmailEvent("email_unsubscribe_completed");
      return;
    }
    if (!token) return;
    // Direct hit (no backend redirect path) — call API
    fetch(`/api/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => {
        const u = new URL(r.url);
        const s = u.searchParams.get("status") || "unknown";
        setResolved(s);
        if (s === "ok") trackEmailEvent("email_unsubscribe_completed");
      })
      .catch(() => setResolved("error"));
  }, [token, status]);

  if (resolved === "ok") {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "120px auto",
          textAlign: "center",
          padding: 32,
        }}
      >
        <h1 style={{ fontSize: 28 }}>Vous êtes désinscrit</h1>
        <p style={{ color: "#94a3b8", marginTop: 12 }}>
          Vous ne recevrez plus d'emails marketing de DeepSight. Les emails
          transactionnels (vérification, paiement, etc.) restent activés.
        </p>
        <a href="/email/preferences" style={{ color: "#6366f1" }}>
          Gérer mes préférences
        </a>
      </div>
    );
  }

  if (resolved === "invalid" || resolved === "error") {
    return (
      <div
        style={{
          maxWidth: 480,
          margin: "120px auto",
          textAlign: "center",
          padding: 32,
        }}
      >
        <h1>Lien invalide</h1>
        <p style={{ color: "#94a3b8" }}>
          Ce lien de désinscription n'est pas reconnu. Connectez-vous pour gérer
          vos préférences.
        </p>
        <a href="/email/preferences" style={{ color: "#6366f1" }}>
          Mes préférences
        </a>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: 120 }}>
      Désinscription en cours…
    </div>
  );
}
```

- [ ] **Step 4: Créer `EmailPreferencesPage.tsx`**

```tsx
// frontend/src/pages/EmailPreferencesPage.tsx
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { trackEmailEvent } from "../services/analytics";

export default function EmailPreferencesPage() {
  const [consent, setConsent] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getEmailPreferences()
      .then((r) => {
        setConsent(r.marketing_emails_consent);
        setEmail(r.email);
      })
      .catch(() => setConsent(true));
  }, []);

  const toggle = async () => {
    if (consent === null) return;
    setSaving(true);
    const next = !consent;
    try {
      await api.updateEmailPreferences(next);
      setConsent(next);
      trackEmailEvent("email_preferences_changed", {
        marketing_emails_consent: next,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: 32 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Préférences email</h1>
      <p style={{ color: "#94a3b8" }}>{email}</p>

      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: "rgba(255,255,255,0.04)",
          borderRadius: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Emails marketing</h3>
            <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0" }}>
              Astuces, nouveautés, offres Pro. Décochez pour ne plus les
              recevoir.
            </p>
          </div>
          <label
            style={{
              position: "relative",
              display: "inline-block",
              width: 50,
              height: 28,
            }}
          >
            <input
              type="checkbox"
              checked={consent ?? true}
              onChange={toggle}
              disabled={saving || consent === null}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: consent ? "#6366f1" : "#475569",
                borderRadius: 14,
                cursor: "pointer",
                transition: "0.2s",
              }}
            />
            <span
              style={{
                position: "absolute",
                top: 3,
                left: consent ? 25 : 3,
                width: 22,
                height: 22,
                background: "#fff",
                borderRadius: "50%",
                transition: "0.2s",
              }}
            />
          </label>
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: 13, color: "#64748b" }}>
        Les emails transactionnels (vérification, paiement, alertes essai)
        restent toujours activés.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Ajouter les routes**

Ouvrir `frontend/src/App.tsx` (ou le fichier de routing principal — `grep -n "Route\|Routes" frontend/src/App.tsx | head -5`). Ajouter les imports lazy :

```tsx
const EmailUnsubscribePage = lazy(() => import("./pages/EmailUnsubscribePage"));
const EmailPreferencesPage = lazy(() => import("./pages/EmailPreferencesPage"));
```

Et les routes (la première publique, la seconde sous protected layout) :

```tsx
<Route path="/email/unsubscribe" element={<EmailUnsubscribePage />} />;
{
  /* dans la zone authentifiée */
}
<Route path="/email/preferences" element={<EmailPreferencesPage />} />;
```

- [ ] **Step 6: Lint + typecheck frontend**

```bash
cd frontend && npm run typecheck && npm run lint
```

Expected: 0 erreur.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/EmailUnsubscribePage.tsx frontend/src/pages/EmailPreferencesPage.tsx frontend/src/services/api.ts frontend/src/services/analytics.ts frontend/src/App.tsx
git commit -m "feat(email): add unsubscribe + preferences pages with PostHog tracking"
```

---

### Task 12: Tests d'intégration end-to-end + déploiement

**Files:**

- Modify: `backend/tests/services/test_email_sequences.py` (ajout test e2e dispatch)

- [ ] **Step 1: Ajouter un test e2e dispatch**

```python
# Append à backend/tests/services/test_email_sequences.py

@pytest.mark.asyncio
async def test_dispatch_sends_due_emails_and_marks_sent(db_session, test_user, monkeypatch):
    """End-to-end: schedule, set send_at to past, run dispatch, verify sent_at set + email queued."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import update as _update
    from db.database import EmailScheduled, EmailEvent
    from services.email_sequences import (
        schedule_welcome_sequence,
        process_scheduled_emails,
    )

    # 1. Schedule the 5 emails
    await schedule_welcome_sequence(db_session, test_user)
    await db_session.flush()

    # 2. Mock email_service.send_template_for_user → always success
    sent_calls = []

    async def fake_send(user, template_key):
        sent_calls.append((user.id, template_key))
        return True

    from services.email_service import email_service
    monkeypatch.setattr(email_service, "send_template_for_user", fake_send)

    # 3. Force all 5 send_at to the past
    past = datetime.now(timezone.utc) - timedelta(seconds=10)
    await db_session.execute(
        _update(EmailScheduled).where(EmailScheduled.user_id == test_user.id).values(send_at=past)
    )
    await db_session.flush()

    # 4. Free user → all 5 should send
    test_user.plan = "free"
    test_user.preferences = {"marketing_emails_consent": True}
    await db_session.flush()

    stats = await process_scheduled_emails(db_session, max_per_run=10)

    assert stats["sent"] == 5
    assert stats["skipped_unsubscribed"] == 0
    assert stats["skipped_paid_plan"] == 0
    assert len(sent_calls) == 5

    # 5. Re-run → 0 sent (idempotent)
    stats2 = await process_scheduled_emails(db_session, max_per_run=10)
    assert stats2["sent"] == 0
```

- [ ] **Step 2: Run all email tests**

```bash
cd backend && python -m pytest tests/services/test_email_sequences.py tests/services/test_email_unsubscribe.py tests/emails/test_webhook_resend.py -v
```

Expected: 8+ tests passed.

- [ ] **Step 3: Run full backend suite (no regression)**

```bash
cd backend && python -m pytest tests/ -x --ignore=tests/test_analysis.py
```

Expected: ≥ 770/770 (existant 774 + nouveaux). Le `--ignore=test_analysis.py` est pour speed up — l'enlever en CI.

- [ ] **Step 4: Commit final**

```bash
git add backend/tests/services/test_email_sequences.py
git commit -m "test(email): add end-to-end dispatch + idempotence integration test"
```

- [ ] **Step 5: Préparer la PR**

```bash
git log --oneline -15
gh pr create --title "feat(email): welcome series + transactional emails via Resend (Phase 9)" --body "$(cat <<'EOF'
## Summary

- Adds Phase 9 email flows from Kimi audit 2026-04-29
- Welcome series J+0 / J+1 / J+3 / J+7 / J+14 (FR + EN)
- New tables `email_scheduled` (jobs) + `email_events` (Resend webhooks)
- HMAC-SHA256 signed unsubscribe tokens
- Resend webhook with svix signature verification
- APScheduler job every 5 min (replaces hourly onboarding cron)
- Cancellation cascade on Stripe upgrade + user opt-out
- Frontend: `/email/unsubscribe` + `/email/preferences` pages
- PostHog events: email_sent, email_delivered, email_opened, email_clicked, email_unsubscribed

## Migration

`alembic upgrade head` → 010_add_email_scheduling

## Test plan

- [ ] backend: `pytest tests/services/test_email_sequences.py tests/services/test_email_unsubscribe.py tests/emails/`
- [ ] backend: `pytest tests/` full suite green (no regression)
- [ ] manual: signup → verify email → check `email_scheduled` has 5 rows
- [ ] manual: simulate Stripe upgrade webhook → check J+7/J+14 cancelled
- [ ] manual: click unsubscribe link → check `marketing_emails_consent=false` in user.preferences
- [ ] manual: send test webhook from Resend dashboard → check `email_events` row inserted
- [ ] frontend: `/email/preferences` toggle works, displays correct state
- [ ] frontend: `/email/unsubscribe?status=ok` displays confirmation

## Deployment

- Merge → push main → Hetzner auto-deploy (junglefarmz-deploy.service)
- Migration runs automatically via entrypoint.sh (RUN_MIGRATIONS=true)
- Add env var `RESEND_WEBHOOK_SECRET` in `/opt/deepsight/repo/.env.production` BEFORE deploy
- Configure webhook URL in Resend dashboard: `https://api.deepsightsynthesis.com/api/email/webhook/resend`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

### Décisions à confirmer avec le porteur

1. **Module name `email/` vs `emails/`** : `email` est un module stdlib Python. Pour éviter les import shadows, j'ai recommandé `emails/` (pluriel). À valider avant de coder, sinon tout renommage cassera les commits.

2. **Pricing — code actuel vs prompt** : le prompt mentionne "Pro 8,99€ / Expert 19,99€" mais `billing/plan_config.py` a Pro 9,99€ et pas d'Expert. **Décision recommandée** : garder les templates avec `{{ pro_price }}` / `{{ expert_price }}` rendus depuis la SSOT `plan_config.py`. Si plan #3 pricing v2 est mergé avant ce plan, les nouveaux prix s'appliquent automatiquement. Si non, prix actuels s'affichent (cohérent backend). Pas de prix hardcodé.

3. **Templates HTML dans repo vs Resend dashboard** : choix actuel = repo (Jinja2 + git versioning). Pros : versioning, code review, A/B testing futur. Cons : redéploiement requis pour changer un mot. **Décision recommandée** : repo (cohérent avec l'existant `welcome.html`, `payment_success.html`, etc.).

4. **Tracking PostHog `email_*` events vs Resend dashboard** : l'audit Kimi mentionne PostHog pour analytics globales. **Décision recommandée** : double tracking — webhook Resend persiste dans `email_events` (pour admin dashboard + analyse historique en SQL) + frontend déclenche `email_link_clicked` quand user arrive avec `utm_source=email` (tracking conversion vers signup/upgrade). Resend dashboard reste accessible pour debug ponctuel.

5. **Scheduler APScheduler vs Celery** : APScheduler **déjà en place** (cf. `requirements.txt:70`), avec Redis lock multi-worker. Celery introduirait une dépendance lourde (broker dédié, worker process). **Décision recommandée** : APScheduler (no-op architecturalement). Si volume dépasse 10k emails/jour, migrer vers Celery dans une PR séparée.

6. **Séquence existante `onboarding_emails.py` (j1/j3/j5/j7/j10/j14)** : conserver ou supprimer ? Elle est différente de la nouvelle (5 emails + cancellation logic). **Décision recommandée** : DEPRECATER (logger warning au call) mais conserver le code 1 release pour rétrocompatibilité avec users déjà dans `onboarding_email_log`. Supprimer après validation 2 semaines en prod.

7. **Cart abandon email** mentionné dans le prompt : pas inclus dans ce plan car nécessite `Stripe checkout.session.expired` webhook + `stripe_customer_id` mapping. **Décision recommandée** : sortir dans plan séparé "transactional-emails-stripe" qui inclura aussi `payment_failed retry`, `subscription_canceled`, `trial_ending_3_days`. Cohérent avec le scope strict de la Phase 9 audit.

### Spec coverage check

| Spec requirement                      | Task                                                                                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| J+0 welcome                           | Task 4 (SEQUENCE*TEMPLATES[0]) + Task 6 (welcome*\*.html)                                                                                                                                  |
| J+1 tip                               | Task 4 (SEQUENCE*TEMPLATES[1]) + Task 6 (tip_first_analysis*\*.html)                                                                                                                       |
| J+3 feature                           | Task 4 + Task 6 (feature*archive*\*.html)                                                                                                                                                  |
| J+7 social proof if free              | Task 4 (`requires_free_plan=True`) + Task 6                                                                                                                                                |
| J+14 upgrade nudge if free + no trial | Task 4 (`requires_free_plan=True`) + Task 6 — note: trial check is `plan == 'free'` ; trial detection nécessitera ajout dans Task 4 si `is_in_trial` flag existe sur User                  |
| Désinscription par lien               | Task 3 (token) + Task 7 (endpoint) + Task 11 (frontend page)                                                                                                                               |
| Tracking webhooks Resend              | Task 7 (`/webhook/resend`) + Task 1 (table `email_events`)                                                                                                                                 |
| PostHog events                        | Task 11 (`trackEmailEvent`) — backend insère dans `email_events`, frontend ne re-send pas (le webhook backend → email_events est la SSOT)                                                  |
| Anti-spam consent                     | Task 4 (`is_user_unsubscribed`) + Task 7 (preferences endpoint)                                                                                                                            |
| i18n FR + EN                          | Task 5 (`send_template_for_user` lit `user.default_lang`) + Task 6 (10 templates)                                                                                                          |
| Resend rate limit fix 429             | Réutilise `email_queue.py` + `email_rate_limiter.py` existants (2 req/s par worker, retry 429 exponentiel) — Task 4 (`process_scheduled_emails`) limite à 50/run + 0.5s sleep entre envois |
| Cohérence pricing 8,99€/19,99€        | Task 5 (`fmt_price` lit SSOT `billing/plan_config.py`) + Task 6 (templates utilisent `{{ pro_price }}`)                                                                                    |
| Tests pytest mock Resend              | Task 12 (e2e avec monkeypatch) + Task 4 (idempotence + cancellation) + Task 7 (webhook signature)                                                                                          |

**Gap identifié — trial detection** : la spec mentionne "J+14 uniquement si toujours Free ET pas de trial actif". Le plan actuel filtre uniquement sur `plan == 'free'`. Si `User` a un flag `is_in_trial` ou `trial_end_date`, ajouter cette logique dans `process_scheduled_emails` (Task 4 Step 3, branche `requires_free_plan`). À vérifier avec porteur.

### Placeholder scan

- ✅ Pas de "TBD" / "TODO" / "implement later"
- ✅ Pas de "add appropriate error handling" — chaque except est explicite
- ✅ Pas de "similar to Task N" — code répété intégralement
- ✅ Pas de "fill in details" — tous les templates HTML sont écrits intégralement
- ⚠️ **Témoignage "Marie" est fictif** — flagué dans Task 6 Step 9 ; à remplacer si témoignage réel disponible

### Type consistency

- `EmailScheduled` (model) ↔ `email_scheduled` (table) ↔ `EmailScheduled.template_key` partout cohérent
- `SequenceStep.template_key` (`"welcome"`, `"tip_first_analysis"`, etc.) cohérent avec noms de fichiers (`welcome_fr.html`)
- `cancel_marketing_emails(db, user_id, reason)` signature stable Task 4 ↔ Task 7 ↔ Task 10
- `event_metadata` au lieu de `metadata` (mot réservé SQLAlchemy déclaratif)

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-29-email-flows-resend.md`. Two execution options :**

**1. Subagent-Driven (recommandé)** — Je dispatch un fresh subagent par task (12 au total), review entre tasks, itération rapide. Les tasks 6 (templates HTML) et 11 (frontend) peuvent partir en parallèle des tasks backend pour accélérer.

**2. Inline Execution** — J'exécute les tasks dans cette session avec checkpoints à T1 (migration + models), T4 (services), T7 (router), T11 (frontend).

**Quelle approche ?**
