# ElevenLabs Voice Top-up Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux abonnés Pro/Expert d'acheter des packs de minutes vocales ElevenLabs (30 / 60 / 180 min) en one-shot Stripe lorsqu'ils ont épuisé leur allowance mensuelle, avec consommation allowance-first puis purchased-fallback.

**Architecture:** Deux nouvelles tables `voice_credit_packs` (catalogue) + `voice_credit_purchases` (historique idempotent), une colonne `purchased_minutes` ajoutée à `voice_quota`. Stripe Checkout en `mode=payment` (one-shot, pas subscription) avec metadata `kind=voice_pack` routée vers un handler webhook idempotent. La fonction `consume_voice_minutes` est étendue pour décrémenter d'abord l'allowance plan rolling-30j puis le solde acheté permanent. Le legacy `voice_addon` (table `voice_quotas` + `user.voice_bonus_seconds`) reste intact pour le classic voice chat ; le nouveau système cible exclusivement la table `voice_quota` (Quick Voice Call A+D, migration 008).

**Tech Stack:** FastAPI 0.110+, SQLAlchemy 2.0 async, Alembic, PostgreSQL 17 / SQLite (dev), Stripe Python SDK 9.x, React 18 + TypeScript strict + Vite 5, Tailwind CSS 3, Vitest + Testing Library, pytest-asyncio.

---

## Contexte préalable

### État DeepSight au 2026-04-29

- **Branche** : `feature/audit-kimi-plans-2026-04-29` (déjà checkout)
- **Backend Quick Voice Call A+D** : `backend/src/billing/voice_quota.py` expose `check_voice_quota` et `consume_voice_minutes`. Plans Pro/Expert reçoivent 30 min/30j rolling (`TOP_TIER_MONTHLY_MINUTES = 30.0`). Free a un trial 3 min lifetime.
- **Modèle DB** : `VoiceQuotaStreaming` (table `voice_quota` SINGULIER, migration 008) — colonnes actuelles : `user_id`, `plan`, `monthly_minutes_used`, `monthly_period_start`, `lifetime_trial_used`, `lifetime_trial_used_at`. Il n'y a PAS de colonne `purchased_minutes`.
- **Webhook Stripe** : `backend/src/billing/router.py:1502-1622` (`stripe_webhook`) avec dispatch `checkout.session.completed` → `handle_checkout_completed` (ligne 1623). Branchements existants : `voice_addon` (mort code orphelin — pas d'endpoint front), `credit_pack`, et le flow `subscription` standard.
- **Legacy parallèle** : `backend/src/voice/router.py:2509` définit `VOICE_ADDON_PACKS` hardcodé pour la table LEGACY `voice_quotas` PLURIEL via `user.voice_bonus_seconds`. **À ne pas confondre** : ce système-là crédite le classic voice chat, pas le Quick Voice Call. Il sera **deprecated** à terme mais reste actif pour rétrocompatibilité.
- **Frontend `VoiceAddonModal`** : `frontend/src/components/voice/VoiceAddonModal.tsx` existe déjà avec packs hardcodés `voice_10/voice_30/voice_60` mais appelle l'endpoint legacy. **À refactorer** pour pointer vers le nouveau catalogue DB-driven.
- **Migrations Alembic** : `backend/alembic/versions/` contient jusqu'à `010_add_conversation_digests.py` (down_revision `009_add_user_preferences_json`). **La nouvelle migration sera 011**, pas 010 (correction par rapport au prompt initial : 010 vient d'être commitée pour le plan digests).
- **`User.stripe_customer_id`** : `backend/src/db/database.py:133` — déjà existant, réutilisable.

### Hypothèses business à confirmer (voir Self-Review § Décisions)

| #   | Hypothèse                                                                        | Justif                                                           |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| H1  | Allowance défaut Pro 30 min / Expert 120 min                                     | Décision DC audit Kimi 2026-04-29 + différenciation tier         |
| H2  | Packs accessibles **uniquement** Pro/Expert (Free bloqué 402 `upgrade_required`) | Évite contournement upgrade                                      |
| H3  | Minutes achetées **n'expirent pas**                                              | Pratique SaaS top-up standard (Twilio, Loom, Otter)              |
| H4  | Allowance plan consommée **avant** purchased                                     | Protège minutes payées du reset mensuel                          |
| H5  | Stripe Checkout `mode=payment` (one-shot, pas subscription)                      | Réutilise `stripe_customer_id` existant                          |
| H6  | TVA via Stripe Tax (`automatic_tax: enabled`)                                    | Déjà actif pour subs ; cohérence comptable                       |
| H7  | Migration Alembic numérotée **011** (pas 010 comme dans le prompt initial)       | 010_add_conversation_digests.py existe déjà en down_revision 009 |
| H8  | Consommation atomique (single transaction) du double-bucket allowance/purchased  | Évite over-debit en cas de race-condition concurrent             |

### Catalogue figé (seed Stripe + DB)

| Slug        | Minutes | Prix cents | Prix EUR | Marge brute (~$0.05/min ElevenLabs gros volume) |
| ----------- | ------- | ---------- | -------- | ----------------------------------------------- |
| `voice-30`  | 30      | 299        | 2,99 €   | ~30 %                                           |
| `voice-60`  | 60      | 499        | 4,99 €   | ~16 %                                           |
| `voice-180` | 180     | 1299       | 12,99 €  | ~3 %                                            |

Le slug utilise `-` (kebab-case) pour éviter collision avec les legacy `voice_30/voice_60` (snake_case).

---

## File Structure

### Création

| Fichier                                                             | Responsabilité                                                                                              |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `backend/alembic/versions/011_add_voice_credit_packs.py`            | Migration : tables `voice_credit_packs`, `voice_credit_purchases` + colonne `voice_quota.purchased_minutes` |
| `backend/src/billing/voice_packs_service.py`                        | Pure logic : list packs, add purchased minutes idempotent, helpers status                                   |
| `backend/src/billing/voice_packs_router.py`                         | Endpoints REST `/api/billing/voice-packs/*`                                                                 |
| `backend/scripts/seed_voice_packs.py`                               | Script idempotent qui crée les Stripe Products/Prices + insère les rows DB                                  |
| `backend/tests/billing/test_voice_packs_service.py`                 | Tests unitaires service (TDD ~6 tests)                                                                      |
| `backend/tests/billing/test_voice_packs_consume.py`                 | Tests `consume_voice_minutes` allowance-first / purchased-fallback (TDD 2 tests)                            |
| `backend/tests/billing/test_voice_packs_router.py`                  | Tests endpoints REST (3 tests : list, my-credits, checkout)                                                 |
| `backend/tests/billing/test_voice_packs_webhook.py`                 | Tests webhook handler idempotent (TDD 2 tests : credit + duplicate skip)                                    |
| `frontend/src/components/voice/VoicePacksWidget.tsx`                | Widget liste packs + bouton acheter → redirect Stripe                                                       |
| `frontend/src/components/voice/__tests__/VoicePacksWidget.test.tsx` | Tests Vitest (2 tests : render packs, click checkout)                                                       |

### Modification

| Fichier                                        | Modification                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `backend/src/db/database.py:879-901`           | Ajouter `purchased_minutes` à `VoiceQuotaStreaming`, créer classes `VoiceCreditPack` + `VoiceCreditPurchase` |
| `backend/src/billing/voice_quota.py:155-175`   | Étendre `consume_voice_minutes` : allowance-first puis purchased-fallback                                    |
| `backend/src/billing/voice_quota.py:110-152`   | Étendre `check_voice_quota` : retourner `max_minutes = allowance_remaining + purchased_minutes`              |
| `backend/src/billing/router.py:1623-1630`      | Ajouter branchement `metadata.kind == "voice_pack"` → `_handle_voice_pack_checkout`                          |
| `backend/src/main.py`                          | Inclure le nouveau router `voice_packs_router`                                                               |
| `frontend/src/services/api.ts:2638-2710`       | Ajouter `voicePacksApi` (`list`, `myCredits`, `createCheckout`)                                              |
| `frontend/src/pages/MyAccount.tsx:537`         | Insérer `<VoicePacksWidget />` après section abonnement                                                      |
| `frontend/src/pages/VoiceCallPage.tsx:199-215` | Bannière `quota_exceeded` ajouter CTA secondaire `/account#voice-packs`                                      |

### File responsibility design rationale

- **`voice_packs_service.py`** isole la pure logic (DB I/O minimal, pas d'API Stripe ici) → testable sans mock complexe.
- **`voice_packs_router.py`** séparé de `billing/router.py` (déjà 1636 lignes, très chargé) → respecte la limite "petits fichiers focalisés" du CLAUDE.md.
- **Webhook handler** reste dans `billing/router.py` (au plus proche de `handle_checkout_completed`) car le dispatch metadata est centralisé là.
- **`VoicePacksWidget.tsx`** unique composant React qui s'auto-suffit — pas de découpage prématuré (YAGNI).

---

## Tasks

### Task 1 : Migration Alembic 011 (tables + colonne)

**Files:**

- Create: `backend/alembic/versions/011_add_voice_credit_packs.py`

- [ ] **Step 1 : Créer le fichier migration**

```python
"""Add voice credit packs catalog + purchases history + purchased_minutes column.

Revision ID: 011_add_voice_credit_packs
Revises: 010_add_conversation_digests
Create Date: 2026-04-29

Adds the ElevenLabs voice top-up packs system (Quick Win audit Kimi P0):
  * NEW table ``voice_credit_packs`` : catalog of buyable packs (slug, minutes,
    price_cents, Stripe product/price IDs).
  * NEW table ``voice_credit_purchases`` : history (1 row per Stripe checkout
    completion), used as idempotency key store.
  * NEW column ``voice_quota.purchased_minutes`` : non-expiring balance,
    consumed AFTER allowance plan in ``consume_voice_minutes``.

Backward compat:
  * All new tables independent → no impact on existing rows.
  * ``voice_quota.purchased_minutes`` defaults to 0 server-side → existing
    rows safe.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_add_voice_credit_packs"
down_revision: Union[str, None] = "010_add_conversation_digests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── voice_credit_packs (catalog) ─────────────────────────────────────
    op.create_table(
        "voice_credit_packs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("price_cents", sa.Integer(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stripe_product_id", sa.String(100), nullable=True),
        sa.Column("stripe_price_id", sa.String(100), nullable=True, unique=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # ── voice_credit_purchases (history + idempotency) ───────────────────
    op.create_table(
        "voice_credit_purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "pack_id",
            sa.Integer(),
            sa.ForeignKey("voice_credit_packs.id"),
            nullable=False,
        ),
        sa.Column("minutes_purchased", sa.Integer(), nullable=False),
        sa.Column("price_paid_cents", sa.Integer(), nullable=False),
        sa.Column("stripe_session_id", sa.String(255), nullable=True, unique=True),
        sa.Column("stripe_payment_intent_id", sa.String(255), nullable=True, unique=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_voice_credit_purchases_user_status",
        "voice_credit_purchases",
        ["user_id", "status"],
    )

    # ── voice_quota.purchased_minutes (non-expiring balance) ─────────────
    op.add_column(
        "voice_quota",
        sa.Column(
            "purchased_minutes",
            sa.Float(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )


def downgrade() -> None:
    op.drop_column("voice_quota", "purchased_minutes")
    op.drop_index(
        "ix_voice_credit_purchases_user_status",
        table_name="voice_credit_purchases",
    )
    op.drop_table("voice_credit_purchases")
    op.drop_table("voice_credit_packs")
```

- [ ] **Step 2 : Vérifier la migration en local**

Run: `cd backend && alembic upgrade head && alembic downgrade -1 && alembic upgrade head`
Expected: pas d'erreur, tables créées puis re-créées.

- [ ] **Step 3 : Commit**

```bash
git add backend/alembic/versions/011_add_voice_credit_packs.py
git commit -m "feat(billing): add Alembic 011 for voice credit packs

- voice_credit_packs catalog table (slug, minutes, price_cents, Stripe IDs)
- voice_credit_purchases history table (idempotent via stripe_session_id)
- voice_quota.purchased_minutes non-expiring balance column

Refs audit Kimi P0 quick win — ElevenLabs top-up packs."
```

---

### Task 2 : Modèles SQLAlchemy `VoiceCreditPack`, `VoiceCreditPurchase` + extend `VoiceQuotaStreaming`

**Files:**

- Modify: `backend/src/db/database.py:879-901`

- [ ] **Step 1 : Étendre `VoiceQuotaStreaming` avec `purchased_minutes`**

Trouver la définition existante (ligne 879) et ajouter la colonne après `lifetime_trial_used_at` :

```python
class VoiceQuotaStreaming(Base):
    """🎙️ Quick Voice Call A+D quota + purchased balance (migrations 008 + 011)."""

    __tablename__ = "voice_quota"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    plan = Column(String(20), nullable=False)
    monthly_minutes_used = Column(Float, nullable=False, default=0.0, server_default="0")
    monthly_period_start = Column(DateTime(timezone=True), nullable=False)
    lifetime_trial_used = Column(Boolean, nullable=False, default=False, server_default="false")
    lifetime_trial_used_at = Column(DateTime(timezone=True), nullable=True)
    # Non-expiring balance (top-up packs, migration 011)
    purchased_minutes = Column(Float, nullable=False, default=0.0, server_default="0")
```

- [ ] **Step 2 : Ajouter les classes `VoiceCreditPack` et `VoiceCreditPurchase` après `VoiceQuotaStreaming`**

Insérer après la ligne `purchased_minutes = Column(...)` (avant le bloc `# ═══════ GAMIFICATION ═══════`) :

```python
class VoiceCreditPack(Base):
    """🎙️ Catalog d'un pack de minutes vocales achetable (migration 011)."""

    __tablename__ = "voice_credit_packs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False)
    name = Column(String(255), nullable=False)
    minutes = Column(Integer, nullable=False)
    price_cents = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    stripe_product_id = Column(String(100), nullable=True)
    stripe_price_id = Column(String(100), nullable=True, unique=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    display_order = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class VoiceCreditPurchase(Base):
    """🎙️ Historique achat pack — 1 row par Stripe checkout completion."""

    __tablename__ = "voice_credit_purchases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    pack_id = Column(
        Integer,
        ForeignKey("voice_credit_packs.id"),
        nullable=False,
    )
    minutes_purchased = Column(Integer, nullable=False)
    price_paid_cents = Column(Integer, nullable=False)
    stripe_session_id = Column(String(255), unique=True, nullable=True)
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="'pending'")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_voice_credit_purchases_user_status", "user_id", "status"),
    )
```

- [ ] **Step 3 : Vérifier que les imports SQLAlchemy contiennent bien `text`**

Ils sont déjà importés ligne 22. Pas d'action.

- [ ] **Step 4 : Lancer les tests existants pour vérifier la non-régression**

Run: `cd backend && python -m pytest tests/test_db_models.py tests/billing/ -v 2>&1 | tail -20`
Expected: tous les tests passent (pas de nouveau test ajouté à cette tâche).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/db/database.py
git commit -m "feat(db): add VoiceCreditPack/Purchase models + purchased_minutes column

- VoiceCreditPack : catalog model (slug, name, minutes, price_cents, Stripe IDs)
- VoiceCreditPurchase : history with idempotency unique constraints on
  stripe_session_id / stripe_payment_intent_id
- VoiceQuotaStreaming.purchased_minutes : non-expiring balance"
```

---

### Task 3 : Service pure logic `voice_packs_service.py` — TDD 6 tests

**Files:**

- Create: `backend/src/billing/voice_packs_service.py`
- Create: `backend/tests/billing/test_voice_packs_service.py`

- [ ] **Step 1 : Créer le test file et les fixtures**

Créer `backend/tests/billing/__init__.py` (vide) si pas existant, puis `test_voice_packs_service.py` :

```python
"""Tests pure logic du service voice packs (sans Stripe)."""

import pytest
from datetime import datetime, timezone

from db.database import (
    User,
    VoiceCreditPack,
    VoiceCreditPurchase,
    VoiceQuotaStreaming,
)
from billing.voice_packs_service import (
    list_active_packs,
    get_pack_by_slug,
    add_purchased_minutes,
    get_user_credit_status,
)


@pytest.mark.asyncio
async def test_list_active_packs_returns_only_active_ordered(test_db_session):
    """list_active_packs filtre is_active et ordonne par display_order."""
    db = test_db_session
    db.add_all([
        VoiceCreditPack(slug="voice-30", name="30 min", minutes=30, price_cents=299, display_order=1, is_active=True),
        VoiceCreditPack(slug="voice-60", name="60 min", minutes=60, price_cents=499, display_order=2, is_active=True),
        VoiceCreditPack(slug="voice-old", name="Legacy", minutes=120, price_cents=999, display_order=99, is_active=False),
    ])
    await db.commit()

    packs = await list_active_packs(db)

    assert len(packs) == 2
    assert [p.slug for p in packs] == ["voice-30", "voice-60"]


@pytest.mark.asyncio
async def test_get_pack_by_slug_returns_none_for_unknown(test_db_session):
    """get_pack_by_slug retourne None pour slug inexistant."""
    pack = await get_pack_by_slug("nonexistent-slug", test_db_session)
    assert pack is None


@pytest.mark.asyncio
async def test_add_purchased_minutes_creates_quota_row_if_missing(test_db_session, test_user):
    """add_purchased_minutes crée la row voice_quota si absente, puis crédite."""
    db = test_db_session
    await add_purchased_minutes(test_user.id, 60.0, db)

    quota = await db.get(VoiceQuotaStreaming, test_user.id)
    assert quota is not None
    assert quota.purchased_minutes == 60.0


@pytest.mark.asyncio
async def test_add_purchased_minutes_increments_existing_balance(test_db_session, test_user):
    """add_purchased_minutes additionne au solde existant."""
    db = test_db_session
    db.add(VoiceQuotaStreaming(
        user_id=test_user.id,
        plan="pro",
        monthly_period_start=datetime.now(timezone.utc),
        purchased_minutes=30.0,
    ))
    await db.commit()

    await add_purchased_minutes(test_user.id, 60.0, db)

    quota = await db.get(VoiceQuotaStreaming, test_user.id)
    assert quota.purchased_minutes == 90.0


@pytest.mark.asyncio
async def test_get_user_credit_status_snapshot(test_db_session, test_user):
    """get_user_credit_status retourne le snapshot allowance + purchased."""
    db = test_db_session
    db.add(VoiceQuotaStreaming(
        user_id=test_user.id,
        plan="pro",
        monthly_period_start=datetime.now(timezone.utc),
        monthly_minutes_used=10.0,
        purchased_minutes=45.0,
    ))
    await db.commit()

    status = await get_user_credit_status(test_user, db)

    assert status["allowance_total"] == 30.0  # TOP_TIER_MONTHLY_MINUTES
    assert status["allowance_used"] == 10.0
    assert status["allowance_remaining"] == 20.0
    assert status["purchased_minutes"] == 45.0
    assert status["total_minutes_available"] == 65.0


@pytest.mark.asyncio
async def test_get_user_credit_status_free_plan_zero_allowance(test_db_session):
    """Free plan : allowance_total = 0, only trial."""
    free_user = User(id=999, email="free@test.com", plan="free")
    test_db_session.add(free_user)
    await test_db_session.commit()

    status = await get_user_credit_status(free_user, test_db_session)

    assert status["allowance_total"] == 0.0
    assert status["purchased_minutes"] == 0.0
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_service.py -v`
Expected: FAIL avec `ImportError: cannot import name 'list_active_packs'`.

- [ ] **Step 3 : Créer le service**

```python
"""Pure logic du système voice credit packs.

Pas d'API Stripe ici (séparation des préoccupations) — l'achat passe par le
router qui orchestre Stripe + DB. Ce service expose uniquement les opérations
de lecture/écriture DB et le calcul du snapshot crédit utilisateur.
"""

import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import (
    User,
    VoiceCreditPack,
    VoiceQuotaStreaming,
)
from billing.voice_quota import (
    TOP_TIER_MONTHLY_MINUTES,
    TOP_TIER_PLANS,
    FREE_TRIAL_MINUTES,
    _get_or_create_quota,
)

logger = logging.getLogger(__name__)


async def list_active_packs(db: AsyncSession) -> list[VoiceCreditPack]:
    """Catalogue des packs actifs ordonnés par display_order asc."""
    result = await db.execute(
        select(VoiceCreditPack)
        .where(VoiceCreditPack.is_active.is_(True))
        .order_by(VoiceCreditPack.display_order.asc(), VoiceCreditPack.id.asc())
    )
    return list(result.scalars().all())


async def get_pack_by_slug(slug: str, db: AsyncSession) -> Optional[VoiceCreditPack]:
    """Récupère un pack par slug, None si introuvable."""
    result = await db.execute(
        select(VoiceCreditPack).where(VoiceCreditPack.slug == slug)
    )
    return result.scalar_one_or_none()


async def add_purchased_minutes(
    user_id: int, minutes: float, db: AsyncSession
) -> None:
    """Crédite ``minutes`` au solde non-expirant de l'utilisateur.

    Crée la row ``voice_quota`` si elle n'existe pas. Ne commit PAS — c'est au
    caller webhook de wrap dans une transaction et commit avec
    ``VoiceCreditPurchase`` pour idempotency atomique.
    """
    user = await db.get(User, user_id)
    plan = (user.plan if user else "free") or "free"

    quota = await _get_or_create_quota(user_id, plan.lower(), db)
    quota.purchased_minutes = float(quota.purchased_minutes or 0.0) + float(minutes)


async def get_user_credit_status(user: User, db: AsyncSession) -> dict:
    """Snapshot allowance + purchased pour widgets dashboard.

    Returns:
        ``{"allowance_total", "allowance_used", "allowance_remaining",
           "purchased_minutes", "total_minutes_available", "is_trial"}``
    """
    plan = (user.plan or "free").lower()
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        allowance_total = FREE_TRIAL_MINUTES if not quota.lifetime_trial_used else 0.0
        allowance_used = 0.0  # trial est binaire
        is_trial = not quota.lifetime_trial_used
    elif plan in TOP_TIER_PLANS:
        allowance_total = TOP_TIER_MONTHLY_MINUTES
        allowance_used = float(quota.monthly_minutes_used or 0.0)
        is_trial = False
    else:
        allowance_total = 0.0
        allowance_used = 0.0
        is_trial = False

    purchased = float(quota.purchased_minutes or 0.0)
    allowance_remaining = max(allowance_total - allowance_used, 0.0)

    return {
        "allowance_total": allowance_total,
        "allowance_used": allowance_used,
        "allowance_remaining": allowance_remaining,
        "purchased_minutes": purchased,
        "total_minutes_available": allowance_remaining + purchased,
        "is_trial": is_trial,
    }
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_service.py -v`
Expected: 6 PASSED.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/billing/voice_packs_service.py backend/tests/billing/test_voice_packs_service.py backend/tests/billing/__init__.py
git commit -m "feat(billing): voice packs pure-logic service + 6 unit tests

- list_active_packs / get_pack_by_slug : catalog reads
- add_purchased_minutes : credit non-expiring balance (no commit, caller wraps)
- get_user_credit_status : dashboard snapshot allowance + purchased"
```

---

### Task 4 : Étendre `consume_voice_minutes` allowance-first / purchased-fallback — TDD 2 tests

**Files:**

- Modify: `backend/src/billing/voice_quota.py:155-175`
- Modify: `backend/src/billing/voice_quota.py:110-152` (étendre `check_voice_quota` pour inclure purchased dans `max_minutes`)
- Create: `backend/tests/billing/test_voice_packs_consume.py`

- [ ] **Step 1 : Écrire les tests**

```python
"""Tests consume_voice_minutes : ordre allowance-first puis purchased-fallback."""

import pytest
from datetime import datetime, timezone

from db.database import User, VoiceQuotaStreaming
from billing.voice_quota import consume_voice_minutes, check_voice_quota


@pytest.mark.asyncio
async def test_consume_drains_allowance_first(test_db_session, pro_user):
    """50 min consumed when 20 allowance + 60 purchased available
    → 0 allowance remaining + 30 purchased remaining (20 from allowance, 30 from purchased).
    """
    db = test_db_session
    db.add(VoiceQuotaStreaming(
        user_id=pro_user.id,
        plan="pro",
        monthly_period_start=datetime.now(timezone.utc),
        monthly_minutes_used=10.0,  # allowance: 30 - 10 = 20 remaining
        purchased_minutes=60.0,
    ))
    await db.commit()

    await consume_voice_minutes(pro_user, 50.0, db)

    quota = await db.get(VoiceQuotaStreaming, pro_user.id)
    assert quota.monthly_minutes_used == 30.0  # 10 + 20 (full drain of allowance)
    assert quota.purchased_minutes == 30.0     # 60 - 30 (overflow into purchased)


@pytest.mark.asyncio
async def test_consume_within_allowance_does_not_touch_purchased(
    test_db_session, pro_user
):
    """5 min consumed when 30 allowance + 100 purchased → only allowance hit."""
    db = test_db_session
    db.add(VoiceQuotaStreaming(
        user_id=pro_user.id,
        plan="pro",
        monthly_period_start=datetime.now(timezone.utc),
        monthly_minutes_used=0.0,
        purchased_minutes=100.0,
    ))
    await db.commit()

    await consume_voice_minutes(pro_user, 5.0, db)

    quota = await db.get(VoiceQuotaStreaming, pro_user.id)
    assert quota.monthly_minutes_used == 5.0
    assert quota.purchased_minutes == 100.0  # unchanged
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_consume.py -v`
Expected: FAIL — l'implémentation actuelle de `consume_voice_minutes` ignore `purchased_minutes`.

- [ ] **Step 3 : Modifier `consume_voice_minutes`**

Remplacer la fonction (ligne 155 environ) par :

```python
async def consume_voice_minutes(user: User, minutes: float, db: AsyncSession) -> None:
    """Record ``minutes`` of voice usage against ``user``'s quota.

    Consumption order (locked decision H4 — protect paid minutes from monthly reset):
      1. Plan allowance (rolling 30j) — drained first
      2. Purchased balance (non-expiring) — overflow fallback

    For Free users, flips the lifetime trial flag (single-shot).
    For top-tier users, splits ``minutes`` across both buckets.
    For other plans (Starter / Student), no-op — they are blocked upstream by
    ``check_voice_quota``, this stays safe if called by mistake.

    Always commits.
    """
    plan = (user.plan or "free").lower()
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        quota.lifetime_trial_used = True
        quota.lifetime_trial_used_at = datetime.now(timezone.utc)
    elif plan in TOP_TIER_PLANS:
        remaining_allowance = max(
            TOP_TIER_MONTHLY_MINUTES - float(quota.monthly_minutes_used or 0.0), 0.0
        )
        from_allowance = min(float(minutes), remaining_allowance)
        from_purchased = max(float(minutes) - from_allowance, 0.0)

        quota.monthly_minutes_used = float(quota.monthly_minutes_used or 0.0) + from_allowance
        if from_purchased > 0:
            current_purchased = float(quota.purchased_minutes or 0.0)
            # Clamp à 0 — ne jamais descendre sous zéro même si race-condition
            quota.purchased_minutes = max(current_purchased - from_purchased, 0.0)

    await db.commit()
```

- [ ] **Step 4 : Étendre `check_voice_quota` pour exposer le total disponible**

Modifier le bloc top-tier (ligne 133 environ) :

```python
    if plan in TOP_TIER_PLANS:
        remaining_allowance = max(
            TOP_TIER_MONTHLY_MINUTES - float(quota.monthly_minutes_used or 0.0), 0.0
        )
        purchased = float(quota.purchased_minutes or 0.0)
        total_available = remaining_allowance + purchased
        if total_available <= 0:
            return QuotaCheck(allowed=False, reason="monthly_quota")
        return QuotaCheck(allowed=True, max_minutes=total_available)
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_consume.py tests/voice/test_quota_integration.py -v`
Expected: PASS pour les 2 nouveaux + non-régression sur l'existant.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/billing/voice_quota.py backend/tests/billing/test_voice_packs_consume.py
git commit -m "feat(billing): consume voice minutes allowance-first then purchased

- consume_voice_minutes splits minutes across plan allowance + purchased
- check_voice_quota max_minutes now includes purchased balance
- 2 new TDD tests : drain_allowance_first + within_allowance_no_touch"
```

---

### Task 5 : Endpoints REST `/api/billing/voice-packs/*`

**Files:**

- Create: `backend/src/billing/voice_packs_router.py`
- Create: `backend/tests/billing/test_voice_packs_router.py`
- Modify: `backend/src/main.py`

- [ ] **Step 1 : Écrire le router**

```python
"""REST endpoints pour les packs voice top-up.

Routes:
  - GET  /api/billing/voice-packs/list         : public, catalogue actif
  - GET  /api/billing/voice-packs/my-credits   : auth, snapshot user
  - POST /api/billing/voice-packs/checkout/{slug} : auth, crée Stripe Checkout
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user, get_current_user_optional
from core.config import FRONTEND_URL, STRIPE_CONFIG, get_stripe_key
from db.database import User, get_session
from billing.voice_packs_service import (
    list_active_packs,
    get_pack_by_slug,
    get_user_credit_status,
)
from billing.voice_quota import TOP_TIER_PLANS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/billing/voice-packs", tags=["voice-packs"])


# ─── Schemas ─────────────────────────────────────────────────────────────


class PackOut(BaseModel):
    slug: str
    name: str
    minutes: int
    price_cents: int
    description: str | None = None
    display_order: int


class CreditStatusOut(BaseModel):
    plan: str
    allowance_total: float
    allowance_used: float
    allowance_remaining: float
    purchased_minutes: float
    total_minutes_available: float
    is_trial: bool


class CheckoutOut(BaseModel):
    checkout_url: str
    session_id: str


# ─── Routes ──────────────────────────────────────────────────────────────


@router.get("/list", response_model=list[PackOut])
async def list_packs(db: AsyncSession = Depends(get_session)):
    """Catalogue public des packs actifs."""
    packs = await list_active_packs(db)
    return [
        PackOut(
            slug=p.slug,
            name=p.name,
            minutes=p.minutes,
            price_cents=p.price_cents,
            description=p.description,
            display_order=p.display_order,
        )
        for p in packs
    ]


@router.get("/my-credits", response_model=CreditStatusOut)
async def my_credits(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Snapshot crédits voice de l'utilisateur courant."""
    status_data = await get_user_credit_status(current_user, db)
    return CreditStatusOut(plan=current_user.plan or "free", **status_data)


@router.post("/checkout/{slug}", response_model=CheckoutOut)
async def create_checkout(
    slug: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """Crée une Stripe Checkout Session one-shot pour le pack ``slug``."""
    plan = (current_user.plan or "free").lower()
    if plan not in TOP_TIER_PLANS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "upgrade_required",
                "message": "Voice packs are only available on Pro/Expert plans",
                "cta": "upgrade_pro",
            },
        )

    pack = await get_pack_by_slug(slug, db)
    if not pack or not pack.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "pack_not_found", "message": f"Unknown pack slug: {slug}"},
        )

    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "stripe_disabled", "message": "Stripe not enabled"},
        )

    stripe_key = get_stripe_key()
    if not stripe_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "stripe_not_configured", "message": "Stripe not configured"},
        )
    stripe.api_key = stripe_key

    # Reuse customer or create
    customer_id = current_user.stripe_customer_id
    if customer_id:
        try:
            stripe.Customer.retrieve(customer_id)
        except stripe.error.InvalidRequestError:
            customer_id = None
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        customer_id = customer.id
        current_user.stripe_customer_id = customer_id
        await db.commit()

    # Build line item — use stripe_price_id if seeded, else price_data fallback
    if pack.stripe_price_id:
        line_items = [{"price": pack.stripe_price_id, "quantity": 1}]
    else:
        line_items = [
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": pack.price_cents,
                    "product_data": {
                        "name": f"DeepSight Voice — {pack.name}",
                        "description": pack.description or f"{pack.minutes} minutes ElevenLabs",
                    },
                },
                "quantity": 1,
            }
        ]

    success_url = (
        f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
        f"&type=voice_pack&slug={slug}"
    )
    cancel_url = f"{FRONTEND_URL}/account#voice-packs"

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="payment",
            payment_method_types=["card"],
            line_items=line_items,
            automatic_tax={"enabled": True},
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "kind": "voice_pack",
                "pack_slug": slug,
                "pack_id": str(pack.id),
                "user_id": str(current_user.id),
                "minutes": str(pack.minutes),
            },
        )
    except stripe.error.StripeError as e:
        logger.error("Stripe checkout creation failed for pack=%s: %s", slug, e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"code": "stripe_error", "message": str(e)},
        )

    logger.info(
        "Voice pack checkout created — user=%d slug=%s session=%s",
        current_user.id,
        slug,
        checkout_session.id,
    )
    return CheckoutOut(
        checkout_url=checkout_session.url,
        session_id=checkout_session.id,
    )
```

- [ ] **Step 2 : Inclure le router dans `main.py`**

Trouver l'inclusion du `billing.router` dans `backend/src/main.py` et ajouter juste après :

```python
from billing.voice_packs_router import router as voice_packs_router
app.include_router(voice_packs_router)
```

- [ ] **Step 3 : Écrire les tests router**

```python
"""Tests endpoints REST voice packs."""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from db.database import VoiceCreditPack


@pytest.mark.asyncio
async def test_list_packs_public(test_client: TestClient, test_db_session):
    """GET /list est public et retourne les packs actifs."""
    test_db_session.add_all([
        VoiceCreditPack(slug="voice-30", name="30 min", minutes=30, price_cents=299, display_order=1, is_active=True),
        VoiceCreditPack(slug="voice-60", name="60 min", minutes=60, price_cents=499, display_order=2, is_active=True),
    ])
    await test_db_session.commit()

    response = test_client.get("/api/billing/voice-packs/list")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["slug"] == "voice-30"
    assert data[0]["price_cents"] == 299


@pytest.mark.asyncio
async def test_my_credits_requires_auth(test_client: TestClient):
    """GET /my-credits sans auth → 401."""
    response = test_client.get("/api/billing/voice-packs/my-credits")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_checkout_blocks_free_plan_with_402(
    test_client: TestClient, free_user_token, test_db_session
):
    """Free plan reçoit 402 upgrade_required."""
    test_db_session.add(VoiceCreditPack(slug="voice-30", name="30 min", minutes=30, price_cents=299))
    await test_db_session.commit()

    response = test_client.post(
        "/api/billing/voice-packs/checkout/voice-30",
        headers={"Authorization": f"Bearer {free_user_token}"},
    )

    assert response.status_code == 402
    body = response.json()
    assert body["detail"]["code"] == "upgrade_required"
    assert body["detail"]["cta"] == "upgrade_pro"
```

- [ ] **Step 4 : Lancer les tests**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_router.py -v`
Expected: 3 PASSED (les fixtures `test_client`, `free_user_token`, `pro_user_token` doivent exister dans `conftest.py` — sinon adapter).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/billing/voice_packs_router.py backend/tests/billing/test_voice_packs_router.py backend/src/main.py
git commit -m "feat(api): voice packs REST endpoints (list / my-credits / checkout)

- GET /api/billing/voice-packs/list : public catalog
- GET /api/billing/voice-packs/my-credits : auth snapshot
- POST /api/billing/voice-packs/checkout/{slug} : Stripe one-shot, blocks
  free with 402 upgrade_required
- 3 endpoint tests"
```

---

### Task 6 : Webhook Stripe handler idempotent — TDD 2 tests

**Files:**

- Modify: `backend/src/billing/router.py:1623-1635`
- Create: `backend/tests/billing/test_voice_packs_webhook.py`

- [ ] **Step 1 : Écrire les tests webhook**

```python
"""Tests webhook handler voice_pack — idempotency + crédit."""

import pytest
from datetime import datetime, timezone

from db.database import (
    User,
    VoiceCreditPack,
    VoiceCreditPurchase,
    VoiceQuotaStreaming,
)
from billing.router import _handle_voice_pack_checkout


@pytest.mark.asyncio
async def test_voice_pack_webhook_credits_user(test_db_session, pro_user):
    """Webhook checkout.session.completed crédite purchased_minutes + crée VoiceCreditPurchase."""
    db = test_db_session
    pack = VoiceCreditPack(
        slug="voice-60", name="60 min", minutes=60, price_cents=499, is_active=True
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)

    data = {
        "id": "cs_test_abc123",
        "payment_intent": "pi_test_xyz789",
        "amount_total": 499,
    }
    metadata = {
        "kind": "voice_pack",
        "pack_slug": "voice-60",
        "pack_id": str(pack.id),
        "user_id": str(pro_user.id),
        "minutes": "60",
    }

    await _handle_voice_pack_checkout(db, data, metadata)

    quota = await db.get(VoiceQuotaStreaming, pro_user.id)
    assert quota.purchased_minutes == 60.0

    purchase = (await db.execute(
        sa.select(VoiceCreditPurchase).where(
            VoiceCreditPurchase.stripe_session_id == "cs_test_abc123"
        )
    )).scalar_one()
    assert purchase.status == "completed"
    assert purchase.minutes_purchased == 60
    assert purchase.completed_at is not None


@pytest.mark.asyncio
async def test_voice_pack_webhook_idempotent_on_duplicate_session(
    test_db_session, pro_user
):
    """Si stripe_session_id déjà recordé, no-op (pas de double crédit)."""
    db = test_db_session
    pack = VoiceCreditPack(
        slug="voice-60", name="60 min", minutes=60, price_cents=499, is_active=True
    )
    db.add(pack)
    await db.commit()
    await db.refresh(pack)

    # First call
    data = {"id": "cs_dup_555", "payment_intent": "pi_dup_555"}
    metadata = {
        "kind": "voice_pack",
        "pack_slug": "voice-60",
        "pack_id": str(pack.id),
        "user_id": str(pro_user.id),
        "minutes": "60",
    }
    await _handle_voice_pack_checkout(db, data, metadata)

    # Second call (replay)
    await _handle_voice_pack_checkout(db, data, metadata)

    quota = await db.get(VoiceQuotaStreaming, pro_user.id)
    assert quota.purchased_minutes == 60.0  # NOT 120

    purchases = (await db.execute(
        sa.select(VoiceCreditPurchase).where(
            VoiceCreditPurchase.stripe_session_id == "cs_dup_555"
        )
    )).scalars().all()
    assert len(purchases) == 1
```

- [ ] **Step 2 : Lancer pour vérifier qu'ils échouent**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_webhook.py -v`
Expected: FAIL — `_handle_voice_pack_checkout` n'existe pas.

- [ ] **Step 3 : Modifier `handle_checkout_completed` dans `billing/router.py`**

Trouver le bloc `# ── Voice addon (one-time payment)` (ligne 1627) et ajouter le branchement voice_pack JUSTE AVANT (avant le legacy voice_addon, pour que le nouveau système soit prioritaire si quelqu'un passe accidentellement les deux flags) :

```python
    # ── Voice pack top-up (NEW system, migration 011) ─────────────────
    if metadata.get("kind") == "voice_pack":
        await _handle_voice_pack_checkout(session, data, metadata)
        return

    # ── Voice addon (LEGACY one-time payment, voice_bonus_seconds) ────
    if metadata.get("type") == "voice_addon":
        await _handle_voice_addon_checkout(session, data, metadata)
        return
```

- [ ] **Step 4 : Implémenter `_handle_voice_pack_checkout`**

Ajouter après `_handle_voice_addon_checkout` (vers ligne 1767) :

```python
async def _handle_voice_pack_checkout(session: AsyncSession, data: dict, metadata: dict):
    """Handle a completed voice pack one-shot payment (NEW system, migration 011).

    Idempotent : checks ``voice_credit_purchases.stripe_session_id`` before
    crediting. Wraps the credit + purchase row insert in a single transaction
    so a crash mid-handler can never leave purchased_minutes credited without
    a corresponding history row (and vice versa).
    """
    from db.database import VoiceCreditPack, VoiceCreditPurchase
    from billing.voice_packs_service import add_purchased_minutes

    session_id = data.get("id")
    payment_intent = data.get("payment_intent")
    user_id_str = metadata.get("user_id", "0")
    pack_id_str = metadata.get("pack_id", "0")
    minutes_str = metadata.get("minutes", "0")
    pack_slug = metadata.get("pack_slug", "unknown")

    try:
        user_id = int(user_id_str)
        pack_id = int(pack_id_str)
        minutes = int(minutes_str)
    except (ValueError, TypeError):
        logger.warning(
            "Voice pack: invalid metadata user_id=%s pack_id=%s minutes=%s",
            user_id_str, pack_id_str, minutes_str,
        )
        return

    if user_id <= 0 or pack_id <= 0 or minutes <= 0:
        logger.warning(
            "Voice pack: invalid values user_id=%s pack_id=%s minutes=%s",
            user_id, pack_id, minutes,
        )
        return

    # Idempotency: skip if this session_id already recorded
    if session_id:
        existing = await session.execute(
            select(VoiceCreditPurchase).where(
                VoiceCreditPurchase.stripe_session_id == session_id
            )
        )
        if existing.scalar_one_or_none():
            logger.info("Voice pack checkout %s already processed — skipping", session_id)
            return

    user = await session.get(User, user_id)
    if not user:
        logger.warning("Voice pack: user %s not found", user_id)
        return

    pack = await session.get(VoiceCreditPack, pack_id)
    if not pack:
        logger.warning("Voice pack: pack %s not found", pack_id)
        return

    # Credit + record in single transaction
    await add_purchased_minutes(user_id, float(minutes), session)

    purchase = VoiceCreditPurchase(
        user_id=user_id,
        pack_id=pack_id,
        minutes_purchased=minutes,
        price_paid_cents=int(data.get("amount_total") or pack.price_cents),
        stripe_session_id=session_id,
        stripe_payment_intent_id=payment_intent,
        status="completed",
        completed_at=datetime.now(timezone.utc),
    )
    session.add(purchase)

    await session.commit()
    logger.info(
        "Voice pack credited: +%dmin user=%d slug=%s session=%s",
        minutes, user_id, pack_slug, session_id,
    )
```

- [ ] **Step 5 : Lancer les tests**

Run: `cd backend && python -m pytest tests/billing/test_voice_packs_webhook.py -v`
Expected: 2 PASSED.

- [ ] **Step 6 : Lancer toute la suite billing pour non-régression**

Run: `cd backend && python -m pytest tests/billing/ -v 2>&1 | tail -30`
Expected: tous les tests passent.

- [ ] **Step 7 : Commit**

```bash
git add backend/src/billing/router.py backend/tests/billing/test_voice_packs_webhook.py
git commit -m "feat(billing): idempotent webhook handler for voice_pack checkouts

- _handle_voice_pack_checkout reads metadata.kind=voice_pack
- Idempotency via VoiceCreditPurchase.stripe_session_id unique
- Atomic credit + history row in single commit
- 2 TDD tests : credits_user + idempotent_on_duplicate_session"
```

---

### Task 7 : Seed Stripe Products + DB packs (script idempotent)

**Files:**

- Create: `backend/scripts/seed_voice_packs.py`

- [ ] **Step 1 : Écrire le script**

```python
"""Seed idempotent des packs voice + Stripe Products/Prices.

Usage:
    cd backend && STRIPE_SECRET_KEY=sk_test_xxx python scripts/seed_voice_packs.py

Comportement :
  * Pour chaque pack du catalogue, si DB row absente : insère.
  * Si STRIPE_SECRET_KEY actif et pack n'a pas de stripe_price_id : crée
    Stripe Product + Price puis update la row DB.
  * Re-runs successifs : no-op (UPSERT par slug).

À lancer après chaque migration sur tous les environnements.
"""

import asyncio
import logging
import os
import sys
from pathlib import Path

# Ensure backend/src on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from db.database import VoiceCreditPack, DATABASE_URL

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_voice_packs")


CATALOG = [
    {
        "slug": "voice-30",
        "name": "Pack 30 minutes",
        "minutes": 30,
        "price_cents": 299,
        "description": "30 minutes de chat vocal IA — ne expirent jamais",
        "display_order": 1,
    },
    {
        "slug": "voice-60",
        "name": "Pack 60 minutes",
        "minutes": 60,
        "price_cents": 499,
        "description": "60 minutes de chat vocal IA — meilleur rapport quantité",
        "display_order": 2,
    },
    {
        "slug": "voice-180",
        "name": "Pack 180 minutes",
        "minutes": 180,
        "price_cents": 1299,
        "description": "180 minutes de chat vocal IA — power users",
        "display_order": 3,
    },
]


async def seed():
    engine = create_async_engine(DATABASE_URL, future=True)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    stripe_key = os.environ.get("STRIPE_SECRET_KEY")
    if stripe_key:
        stripe.api_key = stripe_key
        logger.info("Stripe API enabled — will create Products/Prices if missing")
    else:
        logger.warning("STRIPE_SECRET_KEY not set — DB-only seed (no Stripe sync)")

    async with Session() as db:
        for cat in CATALOG:
            existing = await db.execute(
                select(VoiceCreditPack).where(VoiceCreditPack.slug == cat["slug"])
            )
            pack = existing.scalar_one_or_none()

            if pack is None:
                pack = VoiceCreditPack(**cat)
                db.add(pack)
                await db.flush()
                logger.info("DB inserted: %s (%dmin / %d¢)", pack.slug, pack.minutes, pack.price_cents)
            else:
                logger.info("DB exists: %s — skipping insert", pack.slug)

            if stripe_key and not pack.stripe_price_id:
                product = stripe.Product.create(
                    name=f"DeepSight Voice — {pack.name}",
                    description=pack.description,
                    metadata={"slug": pack.slug, "minutes": str(pack.minutes)},
                )
                price = stripe.Price.create(
                    product=product.id,
                    unit_amount=pack.price_cents,
                    currency="eur",
                    metadata={"slug": pack.slug},
                )
                pack.stripe_product_id = product.id
                pack.stripe_price_id = price.id
                logger.info("Stripe synced: %s → product=%s price=%s", pack.slug, product.id, price.id)

        await db.commit()
        logger.info("Seed complete — %d packs in catalog", len(CATALOG))

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2 : Tester en local sans Stripe (DB-only)**

Run: `cd backend && python scripts/seed_voice_packs.py`
Expected: log "Stripe API not enabled — DB-only seed", 3 packs insérés.

- [ ] **Step 3 : Tester l'idempotence**

Run: `cd backend && python scripts/seed_voice_packs.py`
Expected: log "DB exists: voice-30 — skipping insert" pour chaque pack.

- [ ] **Step 4 : Commit**

```bash
git add backend/scripts/seed_voice_packs.py
git commit -m "feat(scripts): idempotent seed_voice_packs.py for catalog + Stripe sync

- 3-pack catalog hardcoded : voice-30, voice-60, voice-180
- DB UPSERT by slug
- Stripe Product + Price creation when STRIPE_SECRET_KEY is set
- Re-runnable safely (no-op if exists)"
```

---

### Task 8 : Frontend api.ts + VoicePacksWidget + intégration MyAccount + bannière VoiceCallPage

**Files:**

- Modify: `frontend/src/services/api.ts:2638` (ajouter `voicePacksApi`)
- Create: `frontend/src/components/voice/VoicePacksWidget.tsx`
- Create: `frontend/src/components/voice/__tests__/VoicePacksWidget.test.tsx`
- Modify: `frontend/src/pages/MyAccount.tsx:537` (insérer widget)
- Modify: `frontend/src/pages/VoiceCallPage.tsx:199-215` (ajouter CTA secondaire)

- [ ] **Step 1 : Ajouter `voicePacksApi` dans `frontend/src/services/api.ts`**

Trouver `export const voiceApi` (ligne 2638) et ajouter JUSTE AVANT (ou après — peu importe) :

```typescript
export interface ApiVoicePack {
  slug: string;
  name: string;
  minutes: number;
  price_cents: number;
  description: string | null;
  display_order: number;
}

export interface ApiVoiceCreditStatus {
  plan: string;
  allowance_total: number;
  allowance_used: number;
  allowance_remaining: number;
  purchased_minutes: number;
  total_minutes_available: number;
  is_trial: boolean;
}

export const voicePacksApi = {
  /** GET /api/billing/voice-packs/list — catalogue public actif */
  async list(): Promise<ApiVoicePack[]> {
    return request("/api/billing/voice-packs/list", { method: "GET" });
  },

  /** GET /api/billing/voice-packs/my-credits — snapshot user (auth) */
  async myCredits(): Promise<ApiVoiceCreditStatus> {
    return request("/api/billing/voice-packs/my-credits", { method: "GET" });
  },

  /** POST /api/billing/voice-packs/checkout/{slug} — Stripe redirect URL */
  async createCheckout(
    slug: string,
  ): Promise<{ checkout_url: string; session_id: string }> {
    return request(`/api/billing/voice-packs/checkout/${slug}`, {
      method: "POST",
    });
  },
};
```

Ajouter `voicePacks: voicePacksApi` au bloc d'export agrégé (ligne 3066 environ) :

```typescript
const api = {
  // ... existing ...
  voicePacks: voicePacksApi,
};
```

- [ ] **Step 2 : Créer `VoicePacksWidget.tsx`**

```tsx
/**
 * VoicePacksWidget — Liste packs voice + bouton acheter.
 *
 * Inséré dans MyAccount.tsx section "Voice & Audio" et accessible via
 * l'ancre #voice-packs depuis VoiceCallPage en cas de quota épuisé.
 */

import React, { useEffect, useState } from "react";
import { Mic, ArrowRight, Loader2 } from "lucide-react";
import {
  voicePacksApi,
  type ApiVoicePack,
  type ApiVoiceCreditStatus,
} from "../../services/api";
import { useTranslation } from "../../hooks/useTranslation";

export const VoicePacksWidget: React.FC = () => {
  const [packs, setPacks] = useState<ApiVoicePack[]>([]);
  const [status, setStatus] = useState<ApiVoiceCreditStatus | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { language } = useTranslation();
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);

  useEffect(() => {
    Promise.all([voicePacksApi.list(), voicePacksApi.myCredits()])
      .then(([p, s]) => {
        setPacks(p);
        setStatus(s);
      })
      .catch((e) => setError(e?.message ?? "Erreur"));
  }, []);

  const handleBuy = async (slug: string) => {
    setLoadingSlug(slug);
    setError(null);
    try {
      const { checkout_url } = await voicePacksApi.createCheckout(slug);
      window.location.href = checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inattendue");
      setLoadingSlug(null);
    }
  };

  return (
    <section
      id="voice-packs"
      className="card"
      aria-labelledby="voice-packs-heading"
    >
      <div className="panel-header">
        <h2
          id="voice-packs-heading"
          className="font-semibold text-text-primary flex items-center gap-2"
        >
          <Mic className="w-5 h-5 text-indigo-400" />
          {tr("Minutes vocales", "Voice minutes")}
        </h2>
      </div>
      <div className="panel-body space-y-4">
        {status && (
          <div className="rounded-lg border border-white/5 bg-white/5 p-3 text-sm text-text-secondary">
            <p>
              {tr("Allowance restante :", "Allowance remaining:")}{" "}
              <strong className="text-text-primary">
                {status.allowance_remaining.toFixed(1)} /{" "}
                {status.allowance_total.toFixed(0)} min
              </strong>
            </p>
            <p>
              {tr("Minutes achetées :", "Purchased minutes:")}{" "}
              <strong className="text-text-primary">
                {status.purchased_minutes.toFixed(1)} min
              </strong>{" "}
              <span className="text-xs text-text-muted">
                ({tr("n'expirent jamais", "never expire")})
              </span>
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
          >
            {error}
          </div>
        )}

        {packs.length === 0 ? (
          <p className="text-sm text-text-muted">
            {tr("Aucun pack disponible", "No packs available")}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {packs.map((p) => (
              <article
                key={p.slug}
                className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-2"
              >
                <h3 className="font-semibold text-text-primary">{p.name}</h3>
                <p className="text-2xl font-bold text-indigo-400">
                  {p.minutes}{" "}
                  <span className="text-sm font-normal text-text-muted">
                    min
                  </span>
                </p>
                <p className="text-text-secondary">
                  {(p.price_cents / 100).toFixed(2)} €
                </p>
                <button
                  type="button"
                  onClick={() => handleBuy(p.slug)}
                  disabled={loadingSlug !== null}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-50"
                  aria-label={tr(`Acheter ${p.name}`, `Buy ${p.name}`)}
                >
                  {loadingSlug === p.slug ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {tr("Acheter", "Buy")}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default VoicePacksWidget;
```

- [ ] **Step 3 : Écrire les tests Vitest**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { VoicePacksWidget } from "../VoicePacksWidget";

vi.mock("../../../services/api", () => ({
  voicePacksApi: {
    list: vi.fn(),
    myCredits: vi.fn(),
    createCheckout: vi.fn(),
  },
}));

vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "en" }),
}));

import { voicePacksApi } from "../../../services/api";

describe("VoicePacksWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 3 packs from API", async () => {
    (voicePacksApi.list as any).mockResolvedValue([
      {
        slug: "voice-30",
        name: "30 min",
        minutes: 30,
        price_cents: 299,
        description: null,
        display_order: 1,
      },
      {
        slug: "voice-60",
        name: "60 min",
        minutes: 60,
        price_cents: 499,
        description: null,
        display_order: 2,
      },
      {
        slug: "voice-180",
        name: "180 min",
        minutes: 180,
        price_cents: 1299,
        description: null,
        display_order: 3,
      },
    ]);
    (voicePacksApi.myCredits as any).mockResolvedValue({
      plan: "pro",
      allowance_total: 30,
      allowance_used: 5,
      allowance_remaining: 25,
      purchased_minutes: 0,
      total_minutes_available: 25,
      is_trial: false,
    });

    render(<VoicePacksWidget />);

    await waitFor(() => {
      expect(screen.getByText("30 min")).toBeInTheDocument();
      expect(screen.getByText("60 min")).toBeInTheDocument();
      expect(screen.getByText("180 min")).toBeInTheDocument();
    });
  });

  it("redirects to Stripe checkout on Buy click", async () => {
    (voicePacksApi.list as any).mockResolvedValue([
      {
        slug: "voice-30",
        name: "30 min",
        minutes: 30,
        price_cents: 299,
        description: null,
        display_order: 1,
      },
    ]);
    (voicePacksApi.myCredits as any).mockResolvedValue({
      plan: "pro",
      allowance_total: 30,
      allowance_used: 0,
      allowance_remaining: 30,
      purchased_minutes: 0,
      total_minutes_available: 30,
      is_trial: false,
    });
    (voicePacksApi.createCheckout as any).mockResolvedValue({
      checkout_url: "https://checkout.stripe.com/test_session",
      session_id: "cs_test_xxx",
    });

    // Mock window.location.href setter
    const original = window.location;
    delete (window as any).location;
    (window as any).location = { ...original, href: "" };

    render(<VoicePacksWidget />);
    await waitFor(() => screen.getByText("30 min"));
    fireEvent.click(screen.getByLabelText(/Buy 30 min/i));

    await waitFor(() => {
      expect(voicePacksApi.createCheckout).toHaveBeenCalledWith("voice-30");
      expect(window.location.href).toBe(
        "https://checkout.stripe.com/test_session",
      );
    });

    (window as any).location = original;
  });
});
```

- [ ] **Step 4 : Lancer les tests Vitest**

Run: `cd frontend && npm run test -- VoicePacksWidget`
Expected: 2 PASSED.

- [ ] **Step 5 : Intégrer le widget dans `MyAccount.tsx`**

Trouver `</section>` à la ligne 537 (fin du bloc Subscription). Ajouter juste après l'import en haut :

```typescript
import { VoicePacksWidget } from "../components/voice/VoicePacksWidget";
```

Puis insérer le widget après la fermeture `</section>` du bloc abonnement (ligne 537) :

```tsx
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════════
                🎙️ VOICE PACKS — Top-up minutes ElevenLabs
            ═══════════════════════════════════════════════════════════════════════════ */}
            <VoicePacksWidget />
```

- [ ] **Step 6 : Modifier la bannière `quota_exceeded` dans `VoiceCallPage.tsx`**

Trouver le bloc `case "quota_exceeded":` (ligne 199) et remplacer le bouton actuel par deux CTAs :

```tsx
      case "quota_exceeded":
        return (
          <div className="flex flex-col items-center gap-3 max-w-md text-center">
            <AlertCircle className="w-8 h-8 text-amber-400" />
            <p className="text-sm font-medium text-amber-300">
              {tr("Quota de minutes épuisé", "Voice minutes quota exceeded")}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => navigate("/account#voice-packs")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-500 text-white font-medium text-sm hover:bg-indigo-600 transition-colors"
              >
                <Mic className="w-4 h-4" />
                {tr("Acheter un pack", "Buy a pack")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/upgrade?source=voice_call")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-text-secondary hover:bg-white/10 transition-colors text-sm"
              >
                <ArrowUpCircle className="w-4 h-4" />
                {tr("Passer au plan supérieur", "Upgrade plan")}
              </button>
            </div>
          </div>
        );
```

S'assurer que `Mic` est importé depuis `lucide-react` en haut du fichier (vérifier l'import existant).

- [ ] **Step 7 : Lancer typecheck + lint**

Run: `cd frontend && npm run typecheck && npm run lint`
Expected: 0 errors.

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/services/api.ts frontend/src/components/voice/VoicePacksWidget.tsx frontend/src/components/voice/__tests__/VoicePacksWidget.test.tsx frontend/src/pages/MyAccount.tsx frontend/src/pages/VoiceCallPage.tsx
git commit -m "feat(frontend): voice packs widget + MyAccount integration + VoiceCall CTA

- voicePacksApi : list / myCredits / createCheckout
- VoicePacksWidget component with credits snapshot + 3-pack grid
- MyAccount.tsx inserts widget below subscription section (anchor #voice-packs)
- VoiceCallPage.tsx quota_exceeded banner gains 'Buy a pack' CTA
- 2 Vitest tests : render + checkout redirect"
```

---

### Task 9 : E2E manuel — Stripe CLI + checkout test card + verify DB credit + idempotence replay

**Files:** (vérifications uniquement, pas de code)

- [ ] **Step 1 : Lancer le backend en local**

Run (terminal 1): `cd backend/src && uvicorn main:app --reload --port 8000`

- [ ] **Step 2 : Appliquer la migration et seeder**

Run: `cd backend && alembic upgrade head && python scripts/seed_voice_packs.py`
Expected: migration 011 appliquée, 3 packs insérés.

- [ ] **Step 3 : Lancer le frontend**

Run (terminal 2): `cd frontend && npm run dev`

- [ ] **Step 4 : Lancer Stripe CLI pour forwarder les webhooks**

Run (terminal 3): `stripe listen --forward-to http://localhost:8000/api/billing/webhook`
Noter la `Webhook signing secret` affichée et l'exporter dans `.env` backend si besoin.

- [ ] **Step 5 : Test E2E manuel — flow nominal**

1. Login en tant que user Pro (créer via `/admin/users` ou `psql UPDATE`)
2. Aller sur `/account#voice-packs` → vérifier widget render avec 3 packs + status
3. Cliquer "Acheter" sur `voice-60`
4. Carte de test Stripe : `4242 4242 4242 4242`, expiry `12/30`, CVC `123`
5. Confirmer le paiement → redirect vers `/payment/success?type=voice_pack`
6. Stripe CLI doit afficher `checkout.session.completed`
7. Backend logs : `Voice pack credited: +60min user=X slug=voice-60`
8. Vérifier en DB : `SELECT purchased_minutes FROM voice_quota WHERE user_id = X` → `60.0`
9. `SELECT * FROM voice_credit_purchases WHERE user_id = X` → 1 row status `completed`

- [ ] **Step 6 : Test idempotence replay**

Run: `stripe events resend evt_xxx_le_dernier`
Vérifier les logs backend : `Voice pack checkout cs_xxx already processed — skipping`
Vérifier en DB : toujours `purchased_minutes = 60.0` (pas 120), 1 seule row dans `voice_credit_purchases`.

- [ ] **Step 7 : Test 402 Free user**

1. Login en tant que user Free
2. Tenter `POST /api/billing/voice-packs/checkout/voice-30` via curl
3. Expected: HTTP 402 avec body `{"detail": {"code": "upgrade_required", "cta": "upgrade_pro"}}`

- [ ] **Step 8 : Test consume order après achat**

1. User Pro avec `monthly_minutes_used = 25` (allowance reste 5) + 60 purchased
2. Démarrer voice call
3. Consommer 50 min (peut nécessiter mock)
4. Vérifier DB : `monthly_minutes_used = 30` (allowance épuisée), `purchased_minutes = 15` (60 - 45)

- [ ] **Step 9 : Commit final (CHANGELOG si présent)**

```bash
# Si CHANGELOG.md existe
git add CHANGELOG.md
git commit -m "docs(changelog): voice top-up packs (audit Kimi P0 quick win)"
```

Sinon push direct des commits précédents :

```bash
git push origin feature/audit-kimi-plans-2026-04-29
```

---

## Self-Review

### 1. Spec coverage check

| Section spec                              | Task       |
| ----------------------------------------- | ---------- |
| Migration Alembic 010 (renumérotée → 011) | Task 1     |
| Tables voice_credit_packs/purchases       | Task 1 + 2 |
| Colonne purchased_minutes                 | Task 1 + 2 |
| Modèles SQLAlchemy                        | Task 2     |
| Service pure logic 6 tests                | Task 3     |
| consume_voice_minutes allowance-first     | Task 4     |
| check_voice_quota inclusion purchased     | Task 4     |
| Endpoints REST 3 routes                   | Task 5     |
| Webhook Stripe idempotent                 | Task 6     |
| Seed Stripe + DB                          | Task 7     |
| Frontend api + widget + intégration       | Task 8     |
| E2E manuel + idempotence                  | Task 9     |

Tous les éléments de la spec ont une tâche dédiée.

### 2. Placeholder scan

Aucun "TBD", "TODO", "implement later" dans le plan. Toutes les implémentations sont fournies en code complet.

### 3. Type consistency

- `VoiceCreditPack` / `VoiceCreditPurchase` : noms identiques entre migration, modèle, service, router, webhook handler.
- `kind="voice_pack"` (singulier, snake_case) : utilisé partout dans metadata Stripe + dispatcher.
- Slug `voice-30/60/180` (kebab-case) : cohérent entre seed, catalog, frontend, tests.
- `purchased_minutes` (Float) : même type DB / SQLAlchemy / API response (nombre).
- Endpoints `/api/billing/voice-packs/list` / `/my-credits` / `/checkout/{slug}` : cohérents Task 5 ↔ Task 8.
- `voicePacksApi.list / myCredits / createCheckout` : noms TypeScript cohérents Task 8 backend ↔ frontend.

### 4. Décisions à confirmer (avant exécution Task 1)

| Code | Décision                                                                                               | Choix par défaut (en cas de silence)                                           |
| ---- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| DA   | Allowance Pro 30 min / Expert 120 min, ou statu quo (les deux à 30 min) ?                              | Statu quo (TOP_TIER_MONTHLY_MINUTES = 30 partout) — diff Pro/Expert = autre PR |
| DB   | Free user : packs cachés (ne peut même pas voir le widget) ou affichés mais 402 au clic ?              | Affichés, 402 au clic (incite à l'upgrade)                                     |
| DC   | Refunds Stripe : flow ré-débit auto via webhook `charge.refunded` ou manuel admin ?                    | Hors scope — manuel admin pour V1                                              |
| DD   | Branche : continuer sur `feature/audit-kimi-plans-2026-04-29` ou créer `feat/voice-packs-elevenlabs` ? | Continuer sur la branche actuelle (audit Kimi)                                 |
| DE   | Feature gating : `is_feature_available(plan, "voice_packs", platform)` à ajouter SSOT ?                | Oui — ajouter dans `core/plan_limits.py` mais reportable à PR follow-up        |

Si l'utilisateur ne tranche pas, le plan part sur le choix par défaut listé dans la dernière colonne.

---

## Execution Handoff

**Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-29-elevenlabs-voice-packs.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — je dispatch un sous-agent fresh par tâche, review entre chaque, itération rapide.

**2. Inline Execution** — exécution des tâches dans cette session via `superpowers:executing-plans`, batch avec checkpoints.

**Quelle approche ?**
