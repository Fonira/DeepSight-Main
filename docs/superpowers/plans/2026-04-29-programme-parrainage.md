# Programme Parrainage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire un programme de parrainage acquisition virale "+5 / +5 analyses" (parrain ET filleul) avec table `referrals`, code stable par user, endpoints REST `/api/referral/*`, widget React et hook de complétion sur la 1ère analyse réussie du filleul.

**Architecture:** Backend FastAPI — nouveau module `backend/src/referral/` (router + service pure-logic) ; modèle SQLAlchemy `Referral` + colonne `User.referral_code` via migration Alembic **012** ; intégration aux flux existants (`auth/router.py register` pour `?ref=`, `videos/router.py` ligne ~1650 pour completion). Frontend React — nouveau composant `ReferralWidget` dans `MyAccount`, détection `?ref=` sur LandingPage avec relais `localStorage`, instrumentation PostHog des 5 events parrainage.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy 2.0 async + Alembic + PostgreSQL 17 (prod) / SQLite (dev), pytest async ; React 18 + TypeScript strict + Vite + Tailwind CSS 3 + Vitest + PostHog (déjà câblé).

---

## Contexte préalable

### Audit gap (Phase 5 audit Kimi 2026-04-29 — Quick win #11 P1)

L'audit Kimi a identifié l'absence totale de mécanisme d'acquisition virale comme un gap P1. La spec business est lockée :

- Code parrainage : permanent, format `ds_<base64(user_id)[:8]>`, 1 par user.
- Récompense **filleul** : +5 analyses (= +250 crédits Mistral Small) à l'inscription, immédiat.
- Récompense **parrain** : +5 analyses bonus quand le filleul confirme email **+** analyse 1 vidéo (status flip `pending` → `completed`).
- Anti-fraude soft V1 : SHA256(IP) + email_domain logged uniquement.
- Limite anti-farming : 50 parrainages "completed" max par user (au-delà, plus de récompense).
- Statuts : `pending` → `completed` ou `expired` (30 j sans completion).

Conversion crédits validée : Mistral Small = 50 crédits/analyse, plan free = 250 crédits/mois → +5 analyses = +250 crédits. Code utilisé : `core/credits.py:add_credits()` existant (signature `add_credits(session, user_id, amount, reason, transaction_type="bonus")`).

### Cohérence avec les autres plans batch 2

- **`2026-04-29-RELEASE-ORCHESTRATION.md`** (commit `021e4bf1`) — confirme migration Alembic **012** pour ce plan (renumérotation imposée depuis `010` car `010` voice-packs et `011` pricing-v2 viennent avant). `down_revision = "011"` (ou `"009"` si Sprint B pas encore mergé — voir ENV check à T1 step 1).
- **`2026-04-29-posthog-events-complets.md`** (en parallèle) — `EventPayloadMap` doit recevoir 5 nouveaux events : `referral_link_clicked`, `referral_signup_started`, `referral_completed`, `referral_link_copied`, `referral_share_clicked`. Si plan PostHog pas encore mergé, ce plan utilise des **stubs string** (commentaire `// TODO post plan #6`) — pas d'attente bloquante.

### État DeepSight actuel — vérifié dans le code

- `backend/src/db/database.py:106-185` — classe `User` avec colonnes existantes (`id`, `email`, `plan`, `credits`, `email_verified`, `verification_code`, `preferences` JSON migration 009, etc.). Pas de `referral_code` actuellement.
- `backend/src/db/database.py:293-307` — classe `CreditTransaction` (utilisée par `add_credits()`).
- `backend/alembic/versions/` — dernière migration en prod = `009_add_user_preferences_json.py` (révision str = `"009_add_user_preferences_json"`). Le plan voice-packs (`010`) et pricing-v2 (`011`) doivent merger AVANT ce plan ; sinon `down_revision = "009_add_user_preferences_json"`.
- `backend/src/auth/router.py:67-90` — endpoint `POST /api/auth/register` utilise `create_user(session, username, email, password)` du service. Pas de paramètre `referral_code` actuellement.
- `backend/src/auth/service.py:159-222` — `create_user()` hardcode crédits initiaux à `PLAN_LIMITS["free"]["monthly_credits"]` (= 250). C'est **ici** qu'on appliquera le bonus filleul (+250 → 500 total).
- `backend/src/auth/schemas.py:17-22` — schéma `UserRegister(username, email, password)`. À étendre avec `referral_code: Optional[str] = None`.
- `backend/src/videos/router.py:1646-1652` — ligne pivot V1 : juste après `increment_daily_usage(session, user_id)` du flux v2 principal. **C'est exactement là** qu'on hook `complete_referral_if_first_analysis(session, user_id)`.
- ⚠ **5 autres blocs `increment_daily_usage`** existent dans `videos/router.py` (lignes 941, 2502, 3254 entre autres — chunks/long-video, debate, batch). **V1 couvre uniquement le flux v2 principal** (ligne 1650). Gap explicite documenté pour itération post-mesure.
- `backend/src/main.py:1039-1119` — pattern `app.include_router(...)` à suivre pour brancher `referral_router`.
- `backend/src/core/credits.py:340-373` — `add_credits()` async, retourne `(success: bool, new_balance: int)`. Crée automatiquement une `CreditTransaction` avec `transaction_type="bonus"`.
- `backend/src/core/plan_limits.py:37-57` — `increment_daily_usage()` qui retourne le compteur du jour ; on pourra l'utiliser pour détecter "1ère analyse" (`new_count == 1` après increment).
- `frontend/src/services/api.ts:700-711` — `authApi.register(username, email, password)`. À étendre signature `(username, email, password, referralCode?)`.
- `frontend/src/contexts/AuthContext.tsx:10-14` — interface `register(username, email, password)`. À étendre avec `referralCode?`.
- `frontend/src/pages/Login.tsx:155-165` — appel `register(email.split("@")[0], email, password)`. À étendre pour passer `localStorage.getItem("pendingReferralCode")`.
- `frontend/src/pages/LandingPage.tsx:587-591` — `useEffect` redirect logged-in user. **À côté**, ajouter un `useEffect` détection `?ref=` au mount.
- `frontend/src/pages/MyAccount.tsx:880-887` — section "Mon abonnement / My Subscription" en card. **Juste avant** cette card, on insérera la nouvelle section "Parrainage / Referral Program".
- `frontend/src/services/analytics.ts:113-116` — `analytics.capture(event, properties)` est l'API standard. À utiliser dans le widget et le hook landing.

### Décisions lockées (cf. spec brief)

- D1 — Limite anti-farming : **50** completed/user (cohérent audit RELEASE-ORCHESTRATION RF-1).
- D2 — Anti-fraude V1 : **logs only** (SHA256 IP + email_domain) — pas de blocage auto.
- D3 — Récompense V1 : **crédits seuls** (250 = 5 analyses Mistral Small) — pas de voice minutes.
- D4 — Email notification parrain au completed : **V2 post-mesure** (pas dans ce sprint).
- D5 — Migration : **012** (imposé par `RELEASE-ORCHESTRATION.md`).

---

## File Structure

| Fichier                                                              | Action | Responsabilité                                                                                                                                                |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/alembic/versions/012_add_referrals.py`                      | Create | Migration : table `referrals` + enum `referral_status` + colonne `users.referral_code` (UNIQUE indexed nullable).                                             |
| `backend/src/db/database.py`                                         | Modify | Ajouter colonne `User.referral_code` + classe `Referral` (en bas, après `CreditTransaction`).                                                                 |
| `backend/src/referral/__init__.py`                                   | Create | Module init (vide ou export router).                                                                                                                          |
| `backend/src/referral/service.py`                                    | Create | Pure logic async : `generate_code`, `apply_code`, `complete_referral`, `get_stats`. SQLAlchemy queries + `add_credits` integration. Aucun couplage FastAPI.   |
| `backend/src/referral/schemas.py`                                    | Create | Pydantic schemas in/out (`ReferralCodeResponse`, `ReferralApplyRequest`, `ReferralStatsResponse`).                                                            |
| `backend/src/referral/router.py`                                     | Create | Endpoints REST `/api/referral/{generate,code/{code},apply,my-stats}`. Dépend de `service.py`.                                                                 |
| `backend/src/main.py`                                                | Modify | `app.include_router(referral_router, prefix="/api/referral", tags=["Referral"])`.                                                                             |
| `backend/src/auth/schemas.py`                                        | Modify | Ajouter `referral_code: Optional[str] = None` à `UserRegister`.                                                                                               |
| `backend/src/auth/router.py`                                         | Modify | `register` extrait `data.referral_code` et appelle `apply_code()` après `create_user`.                                                                        |
| `backend/src/auth/service.py`                                        | Modify | `create_user` retourne user, ne change pas — application du `apply_code` dans router.                                                                         |
| `backend/src/videos/router.py`                                       | Modify | Ligne ~1650 : appeler `complete_referral_if_first_analysis(session, user_id)` après `increment_daily_usage`. Try/except non-bloquant.                         |
| `backend/tests/test_referral.py`                                     | Create | Tests pytest async exhaustifs : idempotence generate, anti-double-credit, limite 50, expiry 30j, status flow, anti-fraud logging.                             |
| `frontend/src/services/api.ts`                                       | Modify | Ajouter `referralApi.{generate,getStats,applyCode,verifyCode}`. Étendre `authApi.register` signature avec `referralCode?`.                                    |
| `frontend/src/contexts/AuthContext.tsx`                              | Modify | Étendre interface `register` signature avec `referralCode?`.                                                                                                  |
| `frontend/src/components/referral/ReferralWidget.tsx`                | Create | Widget React : code visible + bouton copier + stats personnelles + share-buttons (Twitter, LinkedIn, Email). Tailwind, dark-first.                            |
| `frontend/src/components/referral/__tests__/ReferralWidget.test.tsx` | Create | Tests Vitest : rendu, bouton copier (mock `navigator.clipboard`), affichage stats.                                                                            |
| `frontend/src/pages/LandingPage.tsx`                                 | Modify | Ajouter `useEffect` détection `?ref=<CODE>` au mount + appel `referralApi.verifyCode` + `localStorage.setItem("pendingReferralCode", ...)` + analytics event. |
| `frontend/src/pages/Login.tsx`                                       | Modify | Dans `handleSubmit isRegister`, passer `localStorage.getItem("pendingReferralCode")` à `register()` puis `localStorage.removeItem(...)`.                      |
| `frontend/src/pages/MyAccount.tsx`                                   | Modify | Insérer `<ReferralWidget />` dans nouvelle section juste avant "Mon abonnement".                                                                              |
| `frontend/src/i18n/fr.json` + `en.json`                              | Modify | Ajouter clés i18n `referral.*` (titre, description, bouton copier, share buttons, stats labels).                                                              |

---

## Tasks bite-sized (TDD)

### Task 1: Migration Alembic 012 — table `referrals` + colonne `users.referral_code`

**Files:**

- Create: `backend/alembic/versions/012_add_referrals.py`

- [ ] **Step 1: Vérifier la dernière migration en place et ajuster `down_revision`**

Run: `ls C:/Users/33667/DeepSight-Main/backend/alembic/versions/`

Expected output: liste avec `009_add_user_preferences_json.py`. Si `010_add_voice_credit_packs.py` ET `011_pricing_v2_rename.py` sont aussi présents → `down_revision = "011"`. Sinon → `down_revision = "009_add_user_preferences_json"` (et noter en commentaire que renumérotation `012` reste correcte par convention RELEASE-ORCHESTRATION).

- [ ] **Step 2: Créer le fichier de migration**

```python
"""Add referrals table + users.referral_code column.

Revision ID: 012_add_referrals
Revises: 011_pricing_v2_rename  # ou "009_add_user_preferences_json" si voice-packs+pricing-v2 pas mergés
Create Date: 2026-04-29

Programme parrainage : table referrals + colonne stable users.referral_code.

Cross-DB:
  - referral_status enum → ENUM natif sur PostgreSQL, VARCHAR sur SQLite
  - server_default sur status = 'pending'
  - Index sur referrer_id (fréquent), code (lookup public), status (filtres stats)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "012_add_referrals"
down_revision: Union[str, None] = "011_pricing_v2_rename"  # adjust if needed
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Colonne stable referral_code sur users (UNIQUE, nullable, indexed)
    op.add_column(
        "users",
        sa.Column("referral_code", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_users_referral_code",
        "users",
        ["referral_code"],
        unique=True,
    )

    # Table referrals
    op.create_table(
        "referrals",
        sa.Column("id", sa.String(36), primary_key=True),  # uuid4().hex peut faire 32 sans tirets, garder 36 pour str(uuid4())
        sa.Column(
            "referrer_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "referee_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("code", sa.String(64), nullable=False, index=True),
        sa.Column(
            "status",
            sa.Enum("pending", "completed", "expired", name="referral_status"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("referrer_credits_awarded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("referee_credits_awarded", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("referrer_ip_hash", sa.String(64), nullable=True),
        sa.Column("referee_ip_hash", sa.String(64), nullable=True),
        sa.Column("referee_email_domain", sa.String(255), nullable=True),
    )
    op.create_index("ix_referrals_status", "referrals", ["status"])


def downgrade() -> None:
    op.drop_index("ix_referrals_status", table_name="referrals")
    op.drop_table("referrals")
    # Drop enum (PostgreSQL only — SQLite ignore)
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        sa.Enum(name="referral_status").drop(bind, checkfirst=True)
    op.drop_index("ix_users_referral_code", table_name="users")
    op.drop_column("users", "referral_code")
```

- [ ] **Step 3: Tester la migration en local SQLite (dev)**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ... -> 012_add_referrals`. Aucune erreur SQL.

- [ ] **Step 4: Vérifier rollback fonctionnel**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m alembic downgrade -1
python -m alembic upgrade head
```

Expected: rollback OK puis re-upgrade OK. La table `referrals` doit disparaître puis réapparaître.

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/012_add_referrals.py
git commit -m "feat(referral): add Alembic migration 012 for referrals table and users.referral_code"
```

---

### Task 2: Modèle SQLAlchemy `Referral` + ajout colonne `User.referral_code`

**Files:**

- Modify: `backend/src/db/database.py:106-185` (User class) + bottom of file (new Referral class)

- [ ] **Step 1: Ajouter la colonne `referral_code` à User**

Dans `class User(Base)`, après la ligne `preferences = Column(JSON, ...)` (ligne ~169) :

```python
    # Programme parrainage : code stable généré à la 1ère demande
    # (cf. referral/service.py:generate_code). Format ds_<base64(user_id)[:8]>.
    # UNIQUE pour permettre lookup via /api/referral/code/{code}.
    referral_code = Column(String(64), unique=True, nullable=True, index=True)
```

- [ ] **Step 2: Ajouter la classe `Referral` à la fin de `database.py`**

Juste après `CreditTransaction` (ligne ~307), ajouter :

```python
class Referral(Base):
    """Table des parrainages : 1 ligne par filleul.

    Lifecycle:
      pending  → créé au signup avec ?ref=. +5 crédits filleul immédiats.
      completed → filleul a confirmé email + analysé 1 vidéo. +5 crédits parrain.
      expired  → 30 jours sans completion. Pas de crédits parrain.

    Anti-fraude V1 (logs only, pas de blocage):
      referrer_ip_hash + referee_ip_hash : SHA256 des IP au moment des actions.
      referee_email_domain : domaine email filleul pour détection patterns.
    """

    __tablename__ = "referrals"

    id = Column(String(36), primary_key=True)  # uuid4 string
    referrer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    referee_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    code = Column(String(64), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    referrer_credits_awarded = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    referee_credits_awarded = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    referrer_ip_hash = Column(String(64), nullable=True)
    referee_ip_hash = Column(String(64), nullable=True)
    referee_email_domain = Column(String(255), nullable=True)

    def __repr__(self):
        return f"<Referral {self.id} {self.status} ({self.code})>"
```

Note : on utilise `String(20)` pour `status` au lieu de `Enum(...)` côté ORM pour rester portable (SQLite dev / PostgreSQL prod). La contrainte enum est posée par la migration côté PostgreSQL uniquement.

- [ ] **Step 3: Smoke test — import ne doit pas casser**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -c "from src.db.database import User, Referral; print(User.__tablename__, Referral.__tablename__)"
```

Expected output: `users referrals`. Aucune exception.

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/database.py
git commit -m "feat(referral): add User.referral_code column and Referral SQLAlchemy model"
```

---

### Task 3: Service `referral/service.py` — pure logic + tests TDD

**Files:**

- Create: `backend/src/referral/__init__.py`
- Create: `backend/src/referral/service.py`
- Create: `backend/tests/test_referral.py`

- [ ] **Step 1: Écrire les tests d'abord — `test_referral.py`**

```python
"""Tests pure-logic du service parrainage (TDD)."""
import hashlib
import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from src.db.database import User, Referral
from src.referral.service import (
    generate_code,
    apply_code,
    complete_referral_if_first_analysis,
    get_stats,
    REFERRAL_BONUS_CREDITS,
    MAX_COMPLETED_REFERRALS,
    REFERRAL_EXPIRY_DAYS,
)


@pytest.mark.asyncio
async def test_generate_code_idempotent(test_session, test_user):
    """Le code d'un user ne change jamais entre 2 appels."""
    code1 = await generate_code(test_session, test_user.id)
    code2 = await generate_code(test_session, test_user.id)
    assert code1 == code2
    assert code1.startswith("ds_")
    assert len(code1) >= 11  # ds_ + 8 chars min


@pytest.mark.asyncio
async def test_generate_code_unique_per_user(test_session, test_user, test_user_2):
    """Deux users ont des codes différents."""
    code_a = await generate_code(test_session, test_user.id)
    code_b = await generate_code(test_session, test_user_2.id)
    assert code_a != code_b


@pytest.mark.asyncio
async def test_apply_code_creates_pending_referral_and_awards_referee(test_session, test_user, test_user_2):
    """Applique un code valide à un nouveau filleul : referral pending + +250 au filleul."""
    code = await generate_code(test_session, test_user.id)
    initial_credits = test_user_2.credits

    result = await apply_code(
        test_session,
        referee_id=test_user_2.id,
        code=code,
        referee_ip="1.2.3.4",
        referee_email="filleul@example.com",
    )

    assert result["status"] == "applied"
    assert result["referee_credits_awarded"] is True

    # Vérifier referral créé
    ref = (await test_session.execute(select(Referral).where(Referral.referee_id == test_user_2.id))).scalar_one()
    assert ref.status == "pending"
    assert ref.referrer_id == test_user.id
    assert ref.referee_credits_awarded is True
    assert ref.referrer_credits_awarded is False
    assert ref.referee_email_domain == "example.com"
    assert ref.referee_ip_hash == hashlib.sha256(b"1.2.3.4").hexdigest()

    # Vérifier crédit filleul
    await test_session.refresh(test_user_2)
    assert test_user_2.credits == initial_credits + REFERRAL_BONUS_CREDITS


@pytest.mark.asyncio
async def test_apply_code_self_referral_rejected(test_session, test_user):
    """Un user ne peut pas se parrainer lui-même."""
    code = await generate_code(test_session, test_user.id)
    result = await apply_code(
        test_session, referee_id=test_user.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com"
    )
    assert result["status"] == "rejected"
    assert result["reason"] == "self_referral"


@pytest.mark.asyncio
async def test_apply_code_invalid_code(test_session, test_user_2):
    """Code inconnu : rejected."""
    result = await apply_code(
        test_session, referee_id=test_user_2.id, code="ds_unknown", referee_ip="1.2.3.4", referee_email="x@y.com"
    )
    assert result["status"] == "rejected"
    assert result["reason"] == "invalid_code"


@pytest.mark.asyncio
async def test_apply_code_already_used_by_referee(test_session, test_user, test_user_2):
    """Un filleul ne peut être parrainé qu'une fois."""
    code = await generate_code(test_session, test_user.id)
    await apply_code(test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com")
    # Second apply
    result = await apply_code(
        test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com"
    )
    assert result["status"] == "rejected"
    assert result["reason"] == "already_referred"


@pytest.mark.asyncio
async def test_complete_referral_first_analysis_awards_referrer(test_session, test_user, test_user_2):
    """Première analyse du filleul : flip pending → completed, +250 au parrain."""
    code = await generate_code(test_session, test_user.id)
    await apply_code(test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com")
    initial_referrer_credits = test_user.credits

    result = await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)

    assert result["status"] == "completed"
    ref = (await test_session.execute(select(Referral).where(Referral.referee_id == test_user_2.id))).scalar_one()
    assert ref.status == "completed"
    assert ref.referrer_credits_awarded is True
    assert ref.completed_at is not None

    await test_session.refresh(test_user)
    assert test_user.credits == initial_referrer_credits + REFERRAL_BONUS_CREDITS


@pytest.mark.asyncio
async def test_complete_referral_idempotent_no_double_credit(test_session, test_user, test_user_2):
    """Appeler complete deux fois ne double-crédit pas le parrain."""
    code = await generate_code(test_session, test_user.id)
    await apply_code(test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com")

    await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)
    await test_session.refresh(test_user)
    credits_after_first = test_user.credits

    await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)
    await test_session.refresh(test_user)
    assert test_user.credits == credits_after_first  # pas de double-credit


@pytest.mark.asyncio
async def test_complete_referral_no_op_when_no_referral(test_session, test_user_2):
    """User sans referral pending : no-op."""
    result = await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)
    assert result["status"] == "noop"


@pytest.mark.asyncio
async def test_max_completed_referrals_blocks_referrer_credit(test_session, test_user, factory_user, factory_referral_completed):
    """Au-delà de 50 completed, le parrain ne reçoit plus de crédits (filleul si)."""
    # Créer 50 referrals déjà completed pour test_user
    for _ in range(MAX_COMPLETED_REFERRALS):
        ref = await factory_referral_completed(referrer_id=test_user.id)
        assert ref.referrer_credits_awarded is True

    initial_referrer_credits = test_user.credits

    # Nouveau filleul (51e)
    new_referee = await factory_user(email="referee_51@example.com")
    code = await generate_code(test_session, test_user.id)
    await apply_code(test_session, referee_id=new_referee.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com")
    await complete_referral_if_first_analysis(test_session, user_id=new_referee.id)

    await test_session.refresh(test_user)
    # Le filleul a quand même reçu ses crédits ; le parrain est plafonné
    assert test_user.credits == initial_referrer_credits  # PAS de crédit en plus pour le 51e


@pytest.mark.asyncio
async def test_get_stats_counts_correctly(test_session, test_user):
    """get_stats retourne code, share_url, total_referrals, completed_count, pending_count, credits_earned."""
    code = await generate_code(test_session, test_user.id)
    stats = await get_stats(test_session, test_user.id)

    assert stats["code"] == code
    assert stats["share_url"] == f"https://www.deepsightsynthesis.com/?ref={code}"
    assert stats["total_referrals"] == 0
    assert stats["completed_count"] == 0
    assert stats["pending_count"] == 0
    assert stats["credits_earned"] == 0


@pytest.mark.asyncio
async def test_expiry_30_days_marks_expired(test_session, test_user, test_user_2):
    """Un referral pending de plus de 30 jours est marqué expired (manuellement testé via direct DB)."""
    code = await generate_code(test_session, test_user.id)
    await apply_code(test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com")
    ref = (await test_session.execute(select(Referral).where(Referral.referee_id == test_user_2.id))).scalar_one()
    # Force created_at à 31 jours en arrière
    ref.created_at = datetime.now(timezone.utc) - timedelta(days=REFERRAL_EXPIRY_DAYS + 1)
    await test_session.commit()

    # Le filleul fait sa 1ère analyse APRÈS expiry — le parrain ne doit PAS recevoir
    initial_referrer_credits = test_user.credits
    result = await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)

    await test_session.refresh(test_user)
    assert test_user.credits == initial_referrer_credits  # expired, pas de crédit
    ref = (await test_session.execute(select(Referral).where(Referral.referee_id == test_user_2.id))).scalar_one()
    assert ref.status == "expired"
```

Note : ces tests supposent les fixtures suivantes dans `tests/conftest.py` (déjà partiellement présentes) :

- `test_session` (AsyncSession liée à une SQLite in-memory)
- `test_user`, `test_user_2` (User créés en fixtures)
- `factory_user(email)` (factory qui crée un User)
- `factory_referral_completed(referrer_id)` (factory qui crée un Referral status="completed")

Si les factories n'existent pas encore, les ajouter dans `conftest.py` :

```python
# tests/conftest.py — ajouter en bas si absent
import uuid
from sqlalchemy import select as sa_select
from src.db.database import User, Referral

@pytest.fixture
async def factory_user(test_session):
    async def _make_user(email: str = "factory@example.com", username: str = None):
        username = username or email.split("@")[0]
        user = User(
            username=username,
            email=email,
            password_hash="$2b$12$dummy",
            email_verified=True,
            plan="free",
            credits=250,
        )
        test_session.add(user)
        await test_session.commit()
        await test_session.refresh(user)
        return user
    return _make_user


@pytest.fixture
async def factory_referral_completed(test_session, factory_user):
    async def _make_completed_referral(referrer_id: int):
        referee = await factory_user(email=f"completed_{uuid.uuid4().hex[:6]}@example.com")
        ref = Referral(
            id=str(uuid.uuid4()),
            referrer_id=referrer_id,
            referee_id=referee.id,
            code=f"ds_{uuid.uuid4().hex[:8]}",
            status="completed",
            referrer_credits_awarded=True,
            referee_credits_awarded=True,
            completed_at=datetime.now(timezone.utc),
        )
        test_session.add(ref)
        await test_session.commit()
        return ref
    return _make_completed_referral
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent (TDD red)**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'src.referral'` ou similaire.

- [ ] **Step 3: Créer `backend/src/referral/__init__.py`**

```python
"""Module parrainage — endpoints + service pure-logic."""
```

- [ ] **Step 4: Implémenter `backend/src/referral/service.py`**

```python
"""Programme parrainage — logique pure async (TDD).

Toutes les fonctions sont pures (pas de I/O HTTP). Couplage uniquement avec
SQLAlchemy AsyncSession + db.database.User/Referral + core/credits.add_credits.
"""
import base64
import hashlib
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User, Referral
from core.credits import add_credits

# Constantes business (cf. RELEASE-ORCHESTRATION RF-1/RF-2/RF-3 + spec lockée)
REFERRAL_BONUS_CREDITS = 250  # = 5 analyses Mistral Small (50 crédits/analyse)
MAX_COMPLETED_REFERRALS = 50  # Anti-farming : au-delà, plus de récompense parrain
REFERRAL_EXPIRY_DAYS = 30  # Pending au-delà de 30j → expired

SHARE_URL_BASE = "https://www.deepsightsynthesis.com"


def _hash_ip(ip: Optional[str]) -> Optional[str]:
    """SHA256 d'une IP. Retourne None si IP absent."""
    if not ip:
        return None
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _email_domain(email: Optional[str]) -> Optional[str]:
    """Extrait le domaine d'un email. Retourne None si invalide."""
    if not email or "@" not in email:
        return None
    return email.split("@", 1)[1].lower().strip()[:255]


async def generate_code(session: AsyncSession, user_id: int) -> str:
    """Génère/retourne le code parrainage stable d'un user (idempotent).

    Format : ds_<base64url(user_id 4 bytes big-endian)[:8]>
    """
    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise ValueError(f"User {user_id} not found")

    if user.referral_code:
        return user.referral_code

    # Encoder user_id sur 4 bytes + base64 urlsafe sans padding
    raw = user_id.to_bytes(4, "big", signed=False)
    encoded = base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")
    code = f"ds_{encoded[:8]}"

    user.referral_code = code
    await session.commit()
    await session.refresh(user)
    return code


async def verify_code(session: AsyncSession, code: str) -> Optional[Dict[str, Any]]:
    """Vérifie qu'un code existe (lookup public landing). Retourne {referrer_id, referrer_username} ou None."""
    if not code or not code.startswith("ds_"):
        return None
    result = await session.execute(select(User).where(User.referral_code == code))
    user = result.scalar_one_or_none()
    if user is None:
        return None
    return {"referrer_id": user.id, "referrer_username": user.username}


async def apply_code(
    session: AsyncSession,
    referee_id: int,
    code: str,
    referee_ip: Optional[str],
    referee_email: Optional[str],
) -> Dict[str, Any]:
    """Applique un code parrainage à un nouveau filleul (au signup).

    - Crée Referral(status="pending") si valide.
    - Crédite +250 au filleul (referee_credits_awarded=True).
    - Pas de crédit parrain ici (vient au complete).

    Retourne :
      {"status": "applied", "referee_credits_awarded": True, "referral_id": "..."}
      {"status": "rejected", "reason": "self_referral|invalid_code|already_referred"}
    """
    # Lookup parrain via code
    result = await session.execute(select(User).where(User.referral_code == code))
    referrer = result.scalar_one_or_none()
    if referrer is None:
        return {"status": "rejected", "reason": "invalid_code"}

    if referrer.id == referee_id:
        return {"status": "rejected", "reason": "self_referral"}

    # Vérifier que le filleul n'a pas déjà été parrainé
    existing = await session.execute(select(Referral).where(Referral.referee_id == referee_id))
    if existing.scalar_one_or_none() is not None:
        return {"status": "rejected", "reason": "already_referred"}

    # Créer Referral pending
    ref = Referral(
        id=str(uuid.uuid4()),
        referrer_id=referrer.id,
        referee_id=referee_id,
        code=code,
        status="pending",
        referrer_credits_awarded=False,
        referee_credits_awarded=False,
        referee_ip_hash=_hash_ip(referee_ip),
        referee_email_domain=_email_domain(referee_email),
    )
    session.add(ref)
    await session.commit()

    # Créditer le filleul (+250)
    success, _ = await add_credits(
        session,
        user_id=referee_id,
        amount=REFERRAL_BONUS_CREDITS,
        reason=f"Bonus parrainage (filleul de {referrer.username})",
        transaction_type="bonus",
    )
    if success:
        ref.referee_credits_awarded = True
        await session.commit()

    return {
        "status": "applied",
        "referee_credits_awarded": ref.referee_credits_awarded,
        "referral_id": ref.id,
    }


async def complete_referral_if_first_analysis(
    session: AsyncSession, user_id: int
) -> Dict[str, Any]:
    """Hook à appeler après chaque analyse réussie d'un user.

    - Si le user a un Referral pending dont il est le filleul, et qu'il vient
      de compléter sa 1ère analyse : flip à completed + crédite parrain (+250)
      sauf si parrain a déjà MAX_COMPLETED_REFERRALS completed.
    - Si referral pending est expired (> 30j), flip à expired sans crédit.
    - Sinon no-op.

    Idempotent : le check `referrer_credits_awarded` empêche le double-credit.
    """
    result = await session.execute(
        select(Referral).where(
            Referral.referee_id == user_id,
            Referral.status == "pending",
        )
    )
    ref = result.scalar_one_or_none()
    if ref is None:
        return {"status": "noop"}

    now = datetime.now(timezone.utc)
    # created_at peut être naive sur SQLite ; normalize
    created_at = ref.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)

    # Vérifier expiry
    if now - created_at > timedelta(days=REFERRAL_EXPIRY_DAYS):
        ref.status = "expired"
        await session.commit()
        return {"status": "expired"}

    # Vérifier le quota anti-farming du parrain
    completed_count_result = await session.execute(
        select(func.count(Referral.id)).where(
            Referral.referrer_id == ref.referrer_id,
            Referral.status == "completed",
        )
    )
    completed_count = completed_count_result.scalar_one()

    # Flip à completed (toujours, même si pas de crédit parrain)
    ref.status = "completed"
    ref.completed_at = now

    if completed_count >= MAX_COMPLETED_REFERRALS:
        # Anti-farming hit : on flip mais on ne crédite pas le parrain
        await session.commit()
        return {"status": "completed", "referrer_credits_awarded": False, "reason": "max_reached"}

    if not ref.referrer_credits_awarded:
        success, _ = await add_credits(
            session,
            user_id=ref.referrer_id,
            amount=REFERRAL_BONUS_CREDITS,
            reason=f"Bonus parrainage (filleul user_id={user_id} a complété 1 analyse)",
            transaction_type="bonus",
        )
        if success:
            ref.referrer_credits_awarded = True

    await session.commit()
    return {"status": "completed", "referrer_credits_awarded": ref.referrer_credits_awarded}


async def get_stats(session: AsyncSession, user_id: int) -> Dict[str, Any]:
    """Retourne les stats parrainage du user (pour widget MyAccount)."""
    code = await generate_code(session, user_id)
    share_url = f"{SHARE_URL_BASE}/?ref={code}"

    # Count par status
    result = await session.execute(
        select(Referral.status, func.count(Referral.id))
        .where(Referral.referrer_id == user_id)
        .group_by(Referral.status)
    )
    counts: Dict[str, int] = {"pending": 0, "completed": 0, "expired": 0}
    for status, count in result.all():
        counts[status] = count

    total = counts["pending"] + counts["completed"] + counts["expired"]
    credits_earned = counts["completed"] * REFERRAL_BONUS_CREDITS  # approximation

    return {
        "code": code,
        "share_url": share_url,
        "total_referrals": total,
        "completed_count": counts["completed"],
        "pending_count": counts["pending"],
        "credits_earned": credits_earned,
    }
```

- [ ] **Step 5: Lancer les tests — TDD green**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py -v
```

Expected: tous les tests PASS (12 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/referral/__init__.py backend/src/referral/service.py backend/tests/test_referral.py backend/tests/conftest.py
git commit -m "feat(referral): add service.py with TDD tests for generate/apply/complete/get_stats"
```

---

### Task 4: Schemas Pydantic + endpoints REST `/api/referral/*`

**Files:**

- Create: `backend/src/referral/schemas.py`
- Create: `backend/src/referral/router.py`
- Modify: `backend/src/main.py:1039-1119` (include_router)
- Modify (existing): `backend/tests/test_referral.py` (ajouter tests endpoints)

- [ ] **Step 1: Écrire les tests endpoints (TDD red)**

Ajouter à la fin de `backend/tests/test_referral.py` :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# Tests endpoints REST
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_endpoint_generate_returns_code(async_client, auth_headers):
    """POST /api/referral/generate retourne un code stable."""
    r1 = await async_client.post("/api/referral/generate", headers=auth_headers)
    assert r1.status_code == 200
    data1 = r1.json()
    assert "code" in data1
    assert "share_url" in data1
    assert data1["code"].startswith("ds_")

    # Idempotence
    r2 = await async_client.post("/api/referral/generate", headers=auth_headers)
    assert r2.json()["code"] == data1["code"]


@pytest.mark.asyncio
async def test_endpoint_verify_code_public(async_client, test_session, test_user):
    """GET /api/referral/code/{code} est public et retourne 200 si code valide."""
    code = await generate_code(test_session, test_user.id)
    r = await async_client.get(f"/api/referral/code/{code}")
    assert r.status_code == 200
    data = r.json()
    assert data["valid"] is True
    assert data["referrer_username"] == test_user.username


@pytest.mark.asyncio
async def test_endpoint_verify_code_404(async_client):
    """GET /api/referral/code/<unknown> retourne 404."""
    r = await async_client.get("/api/referral/code/ds_unknown")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_endpoint_my_stats(async_client, auth_headers):
    """GET /api/referral/my-stats retourne {code, share_url, total_referrals, ...}."""
    r = await async_client.get("/api/referral/my-stats", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    for key in ("code", "share_url", "total_referrals", "completed_count", "pending_count", "credits_earned"):
        assert key in data


@pytest.mark.asyncio
async def test_endpoint_apply_called_internally(async_client, test_session, test_user, factory_user):
    """POST /api/referral/apply (interne, auth) crée un referral."""
    code = await generate_code(test_session, test_user.id)
    referee = await factory_user(email="apply_endpoint@example.com")
    # Auth as referee
    referee_token = create_test_jwt(referee.id)  # helper conftest
    r = await async_client.post(
        "/api/referral/apply",
        headers={"Authorization": f"Bearer {referee_token}"},
        json={"code": code},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "applied"
```

Note : ces tests supposent les fixtures `async_client`, `auth_headers` et l'helper `create_test_jwt` dans `conftest.py`. Si absents, voir le pattern dans `tests/test_billing.py` ou `tests/test_auth_flow.py` et adapter.

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py::test_endpoint_generate_returns_code -v
```

Expected: FAIL — endpoint inexistant.

- [ ] **Step 2: Créer `backend/src/referral/schemas.py`**

```python
"""Pydantic schemas pour le module parrainage."""
from typing import Optional
from pydantic import BaseModel, Field


class ReferralCodeResponse(BaseModel):
    """Réponse de POST /api/referral/generate."""

    code: str = Field(..., description="Code parrainage stable")
    share_url: str = Field(..., description="Lien complet à partager")


class ReferralVerifyResponse(BaseModel):
    """Réponse de GET /api/referral/code/{code}."""

    valid: bool
    referrer_username: Optional[str] = None


class ReferralApplyRequest(BaseModel):
    """Body de POST /api/referral/apply."""

    code: str = Field(..., min_length=4, max_length=64)


class ReferralApplyResponse(BaseModel):
    """Réponse de POST /api/referral/apply."""

    status: str  # "applied" | "rejected"
    reason: Optional[str] = None
    referee_credits_awarded: Optional[bool] = None
    referral_id: Optional[str] = None


class ReferralStatsResponse(BaseModel):
    """Réponse de GET /api/referral/my-stats."""

    code: str
    share_url: str
    total_referrals: int
    completed_count: int
    pending_count: int
    credits_earned: int
```

- [ ] **Step 3: Créer `backend/src/referral/router.py`**

```python
"""Endpoints REST du programme parrainage."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from db.database import User, get_session

from .schemas import (
    ReferralApplyRequest,
    ReferralApplyResponse,
    ReferralCodeResponse,
    ReferralStatsResponse,
    ReferralVerifyResponse,
)
from .service import (
    SHARE_URL_BASE,
    apply_code,
    generate_code,
    get_stats,
    verify_code,
)

router = APIRouter()


def _client_ip(request: Request) -> str:
    """Extrait l'IP client en respectant les headers de proxy."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


@router.post("/generate", response_model=ReferralCodeResponse)
async def generate(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReferralCodeResponse:
    """Génère ou retourne le code parrainage stable de l'utilisateur (idempotent)."""
    code = await generate_code(session, user.id)
    return ReferralCodeResponse(code=code, share_url=f"{SHARE_URL_BASE}/?ref={code}")


@router.get("/code/{code}", response_model=ReferralVerifyResponse)
async def verify(code: str, session: AsyncSession = Depends(get_session)) -> ReferralVerifyResponse:
    """Vérifie publiquement la validité d'un code (utilisé par la landing au mount avec ?ref=)."""
    info = await verify_code(session, code)
    if info is None:
        raise HTTPException(status_code=404, detail="Code parrainage inconnu")
    return ReferralVerifyResponse(valid=True, referrer_username=info["referrer_username"])


@router.post("/apply", response_model=ReferralApplyResponse)
async def apply(
    payload: ReferralApplyRequest,
    request: Request,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReferralApplyResponse:
    """Applique un code parrainage au compte du user authentifié.

    Normalement appelé en interne par /api/auth/register quand referral_code est
    fourni au signup. Endpoint exposé pour le cas où le user est déjà connecté
    et entre un code après coup (rare, mais supporté).
    """
    result = await apply_code(
        session,
        referee_id=user.id,
        code=payload.code,
        referee_ip=_client_ip(request),
        referee_email=user.email,
    )
    return ReferralApplyResponse(**result)


@router.get("/my-stats", response_model=ReferralStatsResponse)
async def my_stats(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ReferralStatsResponse:
    """Retourne les stats parrainage de l'utilisateur authentifié."""
    stats = await get_stats(session, user.id)
    return ReferralStatsResponse(**stats)
```

- [ ] **Step 4: Brancher le router dans `backend/src/main.py`**

Dans `backend/src/main.py` :

1. En haut, après les autres imports de routers (ligne ~1039 zone) :

```python
from referral.router import router as referral_router
```

2. Après les autres `app.include_router(...)` (ligne ~1119) :

```python
app.include_router(referral_router, prefix="/api/referral", tags=["Referral"])
```

- [ ] **Step 5: Lancer les tests endpoints — TDD green**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py -v
```

Expected: tous les tests PASS.

- [ ] **Step 6: Smoke test runtime**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend/src
uvicorn main:app --port 8000 &
sleep 3
curl -s http://localhost:8000/openapi.json | python -c "import sys, json; d=json.load(sys.stdin); print([p for p in d['paths'] if 'referral' in p])"
```

Expected output : `['/api/referral/generate', '/api/referral/code/{code}', '/api/referral/apply', '/api/referral/my-stats']`

- [ ] **Step 7: Commit**

```bash
git add backend/src/referral/schemas.py backend/src/referral/router.py backend/src/main.py backend/tests/test_referral.py
git commit -m "feat(referral): add REST endpoints /api/referral/{generate,verify,apply,my-stats}"
```

---

### Task 5: Hook signup — `auth/router.py register` accepte `referral_code`

**Files:**

- Modify: `backend/src/auth/schemas.py:17-22` (UserRegister)
- Modify: `backend/src/auth/router.py:67-90` (register endpoint)
- Modify: `backend/tests/test_referral.py` (ajouter test signup E2E)

- [ ] **Step 1: Test E2E signup avec referral_code (TDD red)**

Ajouter à `backend/tests/test_referral.py` :

```python
@pytest.mark.asyncio
async def test_signup_with_referral_code_credits_referee(async_client, test_session, test_user):
    """POST /api/auth/register avec referral_code → +250 crédits au filleul."""
    code = await generate_code(test_session, test_user.id)

    r = await async_client.post(
        "/api/auth/register",
        json={
            "username": "newreferee",
            "email": "newreferee@example.com",
            "password": "secret123",
            "referral_code": code,
        },
    )
    assert r.status_code == 200

    # Vérifier que le user créé a 500 crédits (250 plan free + 250 bonus)
    from sqlalchemy import select
    from src.db.database import User
    user = (await test_session.execute(select(User).where(User.email == "newreferee@example.com"))).scalar_one()
    assert user.credits == 500


@pytest.mark.asyncio
async def test_signup_with_invalid_referral_code_still_creates_user(async_client):
    """POST /api/auth/register avec referral_code invalide → user créé sans bonus, pas d'erreur 400."""
    r = await async_client.post(
        "/api/auth/register",
        json={
            "username": "noreferral",
            "email": "noreferral@example.com",
            "password": "secret123",
            "referral_code": "ds_garbage",
        },
    )
    assert r.status_code == 200  # le signup n'échoue pas
```

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py::test_signup_with_referral_code_credits_referee -v
```

Expected: FAIL — `referral_code` est ignoré.

- [ ] **Step 2: Étendre `UserRegister` schema dans `auth/schemas.py`**

Remplacer la classe `UserRegister` (ligne 17-22) :

```python
class UserRegister(BaseModel):
    """Schéma pour l'inscription. referral_code est optionnel (passé via ?ref=<CODE> sur landing)."""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)
    referral_code: Optional[str] = Field(
        default=None,
        max_length=64,
        description="Code parrainage optionnel (ex: ds_a1b2c3d4) — accorde +250 crédits au filleul",
    )
```

- [ ] **Step 3: Étendre `register` dans `auth/router.py`**

Remplacer la fonction `register` (ligne 67-90) :

```python
@router.post("/register", response_model=MessageResponse)
async def register(
    data: UserRegister,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """
    Inscription d'un nouvel utilisateur.

    - Envoie un email de vérification si EMAIL_ENABLED.
    - Si data.referral_code est fourni et valide → +250 crédits filleul (immédiat).
    """
    success, user, message = await create_user(
        session, username=data.username, email=data.email, password=data.password
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    # 🎁 Programme parrainage : appliquer le code si fourni (best-effort, non-bloquant)
    if data.referral_code and user:
        try:
            from referral.service import apply_code

            # Extraire IP cliente
            forwarded = request.headers.get("X-Forwarded-For")
            referee_ip = forwarded.split(",")[0].strip() if forwarded else (
                request.client.host if request.client else None
            )
            apply_result = await apply_code(
                session,
                referee_id=user.id,
                code=data.referral_code,
                referee_ip=referee_ip,
                referee_email=user.email,
            )
            if apply_result.get("status") == "applied":
                print(f"🎁 Referral applied at signup: user {user.id} from code {data.referral_code}", flush=True)
        except Exception as ref_err:
            # Le signup réussit même si le bonus échoue (logged uniquement)
            print(f"⚠️ Referral application failed at signup (non-blocking): {ref_err}", flush=True)

    # Envoyer l'email de vérification
    if EMAIL_CONFIG.get("ENABLED") and user and user.verification_code:
        email_sent = await send_verification_email(
            email=user.email, code=user.verification_code, username=user.username
        )
        if email_sent:
            message = "✅ Compte créé ! Vérifiez votre email."
        else:
            message = "✅ Compte créé ! Email de vérification non envoyé."

    return MessageResponse(success=True, message=message)
```

⚠ Penser à ajouter `from fastapi import Request` en haut de `auth/router.py` si absent.

- [ ] **Step 4: Lancer les tests — TDD green**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py::test_signup_with_referral_code_credits_referee tests/test_referral.py::test_signup_with_invalid_referral_code_still_creates_user -v
```

Expected: 2 tests PASS.

- [ ] **Step 5: Vérifier non-régression auth tests**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_auth_flow.py tests/test_auth_comprehensive.py -v
```

Expected: tous les tests existants PASS (le champ `referral_code` est optionnel donc rétrocompatible).

- [ ] **Step 6: Commit**

```bash
git add backend/src/auth/schemas.py backend/src/auth/router.py backend/tests/test_referral.py
git commit -m "feat(referral): wire signup to apply referral_code at register time"
```

---

### Task 6: Hook completion — `videos/router.py` après 1ère analyse réussie

**Files:**

- Modify: `backend/src/videos/router.py:1646-1652` (point pivot V1 — flux v2 principal)
- Modify (existing): `backend/tests/test_referral.py` (ajouter test E2E completion)

⚠ V1 SCOPE EXPLICIT : seul le flux v2 principal (ligne 1650) est instrumenté. Les 5 autres blocs `increment_daily_usage` (chunks long-video ligne 941, batch ligne 2502, debate ligne 3254, etc.) ne déclenchent PAS le hook completion en V1. **Ce gap est volontaire** pour limiter le risque de régression — il sera comblé post-mesure usage en itération suivante.

- [ ] **Step 1: Ajouter test E2E completion (TDD red)**

Ajouter à `backend/tests/test_referral.py` :

```python
@pytest.mark.asyncio
async def test_complete_referral_called_after_first_analysis_v2(test_session, test_user, test_user_2):
    """Simule l'appel manuel du hook avec un user_id qui a un referral pending."""
    # Setup : code + apply
    code = await generate_code(test_session, test_user.id)
    await apply_code(
        test_session, referee_id=test_user_2.id, code=code, referee_ip="1.2.3.4", referee_email="x@y.com"
    )
    initial_referrer_credits = test_user.credits

    # Act : appel direct du hook (simule ce que videos/router.py fait à la ligne 1650)
    result = await complete_referral_if_first_analysis(test_session, user_id=test_user_2.id)

    # Assert
    assert result["status"] == "completed"
    await test_session.refresh(test_user)
    assert test_user.credits == initial_referrer_credits + REFERRAL_BONUS_CREDITS
```

Note : ce test confirme uniquement la pure-logic (déjà testée en Task 3) ; il sert ici de garde-fou que l'API est utilisable depuis videos/router.py.

- [ ] **Step 2: Modifier `videos/router.py` ligne 1646-1652**

Remplacer le bloc :

```python
            # Incrémenter le quota quotidien
            try:
                from core.plan_limits import increment_daily_usage

                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                logger.error(f"⚠️ [v2] Quota increment failed: {quota_err}")
```

par :

```python
            # Incrémenter le quota quotidien
            try:
                from core.plan_limits import increment_daily_usage

                await increment_daily_usage(session, user_id)
            except Exception as quota_err:
                logger.error(f"⚠️ [v2] Quota increment failed: {quota_err}")

            # 🎁 Programme parrainage : compléter referral pending si 1ère analyse
            # V1 SCOPE : seul ce flux v2 principal est instrumenté.
            # Les autres blocs `increment_daily_usage` (chunks, batch, debate)
            # ne déclenchent PAS encore — gap volontaire à itérer post-mesure.
            try:
                from referral.service import complete_referral_if_first_analysis

                ref_result = await complete_referral_if_first_analysis(session, user_id=user_id)
                if ref_result.get("status") == "completed":
                    logger.info(
                        f"🎁 Referral completed: user {user_id} triggered referrer credit "
                        f"(awarded={ref_result.get('referrer_credits_awarded')})"
                    )
            except Exception as ref_err:
                logger.error(f"⚠️ [v2] Referral completion check failed (non-blocking): {ref_err}")
```

- [ ] **Step 3: Lancer le test pure-logic**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_referral.py::test_complete_referral_called_after_first_analysis_v2 -v
```

Expected: PASS.

- [ ] **Step 4: Vérifier non-régression videos tests**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/backend
python -m pytest tests/test_analysis.py -v
```

Expected: tests existants PASS (le hook est try/except, ne casse rien si referral absent).

- [ ] **Step 5: Commit**

```bash
git add backend/src/videos/router.py backend/tests/test_referral.py
git commit -m "feat(referral): wire completion hook after v2 analysis success (videos/router.py:1650)"
```

---

### Task 7: Frontend `referralApi` dans `services/api.ts`

**Files:**

- Modify: `frontend/src/services/api.ts:700-711` (étendre `authApi.register` signature) + ajout en bas du fichier (`referralApi`)
- Modify: `frontend/src/contexts/AuthContext.tsx:10-14` (étendre interface)

- [ ] **Step 1: Étendre `authApi.register` signature**

Remplacer (ligne 700-711) :

```typescript
  async register(
    username: string,
    email: string,
    password: string,
    referralCode?: string,
  ): Promise<{ success: boolean; message: string }> {
    return request("/api/auth/register", {
      method: "POST",
      body: {
        username,
        email,
        password,
        ...(referralCode ? { referral_code: referralCode } : {}),
      },
      skipAuth: true,
    });
  },
```

- [ ] **Step 2: Ajouter `referralApi` à la fin de `services/api.ts`**

Ajouter en bas du fichier (avant le dernier export ou à la fin) :

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// 🎁 REFERRAL API — Programme parrainage
// ═══════════════════════════════════════════════════════════════════════════════

export interface ReferralCodeResponse {
  code: string;
  share_url: string;
}

export interface ReferralVerifyResponse {
  valid: boolean;
  referrer_username?: string;
}

export interface ReferralApplyResponse {
  status: "applied" | "rejected";
  reason?: string;
  referee_credits_awarded?: boolean;
  referral_id?: string;
}

export interface ReferralStatsResponse {
  code: string;
  share_url: string;
  total_referrals: number;
  completed_count: number;
  pending_count: number;
  credits_earned: number;
}

export const referralApi = {
  async generate(): Promise<ReferralCodeResponse> {
    return request("/api/referral/generate", { method: "POST" });
  },

  async verifyCode(code: string): Promise<ReferralVerifyResponse> {
    try {
      return await request<ReferralVerifyResponse>(
        `/api/referral/code/${encodeURIComponent(code)}`,
        { skipAuth: true },
      );
    } catch (err) {
      // 404 = code invalide → on retourne {valid:false} plutôt que de propager
      return { valid: false };
    }
  },

  async applyCode(code: string): Promise<ReferralApplyResponse> {
    return request("/api/referral/apply", {
      method: "POST",
      body: { code },
    });
  },

  async getStats(): Promise<ReferralStatsResponse> {
    return request("/api/referral/my-stats");
  },
};
```

- [ ] **Step 3: Étendre l'interface `AuthContextType` dans `contexts/AuthContext.tsx`**

Remplacer (ligne 10-14) :

```typescript
register: (
  username: string,
  email: string,
  password: string,
  referralCode?: string,
) => Promise<void>;
```

- [ ] **Step 4: Trouver et étendre le provider qui implémente `register`**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
grep -n "register:" src/components/AuthProvider.tsx 2>/dev/null || grep -rn "authApi.register" src/ | head -5
```

Identifier le fichier qui implémente le provider (probablement `App.tsx` ou un hook auth dédié) et étendre l'implémentation pour passer `referralCode` à `authApi.register`. Par exemple :

```typescript
// Dans le provider
const register = async (
  username: string,
  email: string,
  password: string,
  referralCode?: string,
) => {
  await authApi.register(username, email, password, referralCode);
  // ... reste inchangé
};
```

- [ ] **Step 5: Vérifier typecheck**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
```

Expected: `tsc --noEmit` sans nouvelle erreur.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/contexts/AuthContext.tsx
git commit -m "feat(referral): add referralApi client and extend authApi.register signature"
```

---

### Task 8: Composant `ReferralWidget` + tests Vitest

**Files:**

- Create: `frontend/src/components/referral/ReferralWidget.tsx`
- Create: `frontend/src/components/referral/__tests__/ReferralWidget.test.tsx`
- Modify: `frontend/src/i18n/fr.json` + `frontend/src/i18n/en.json`

- [ ] **Step 1: Tests Vitest (TDD red)**

Créer `frontend/src/components/referral/__tests__/ReferralWidget.test.tsx` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReferralWidget } from "../ReferralWidget";
import * as api from "../../../services/api";

vi.mock("../../../services/api", () => ({
  referralApi: {
    getStats: vi.fn(),
  },
}));

describe("ReferralWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays loading state initially then renders stats", async () => {
    (api.referralApi.getStats as any).mockResolvedValue({
      code: "ds_a1b2c3d4",
      share_url: "https://www.deepsightsynthesis.com/?ref=ds_a1b2c3d4",
      total_referrals: 3,
      completed_count: 2,
      pending_count: 1,
      credits_earned: 500,
    });

    render(<ReferralWidget />);

    expect(screen.getByText(/charg/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("ds_a1b2c3d4")).toBeInTheDocument();
    });

    expect(screen.getByText(/3/)).toBeInTheDocument(); // total
    expect(screen.getByText(/500/)).toBeInTheDocument(); // credits
  });

  it("copies link to clipboard when copy button clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    (api.referralApi.getStats as any).mockResolvedValue({
      code: "ds_test",
      share_url: "https://www.deepsightsynthesis.com/?ref=ds_test",
      total_referrals: 0,
      completed_count: 0,
      pending_count: 0,
      credits_earned: 0,
    });

    render(<ReferralWidget />);
    await waitFor(() => screen.getByText("ds_test"));

    const copyBtn = screen.getByRole("button", { name: /copi|copy/i });
    await userEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith(
      "https://www.deepsightsynthesis.com/?ref=ds_test",
    );
  });

  it("renders share buttons for Twitter, LinkedIn, Email", async () => {
    (api.referralApi.getStats as any).mockResolvedValue({
      code: "ds_share",
      share_url: "https://www.deepsightsynthesis.com/?ref=ds_share",
      total_referrals: 0,
      completed_count: 0,
      pending_count: 0,
      credits_earned: 0,
    });

    render(<ReferralWidget />);
    await waitFor(() => screen.getByText("ds_share"));

    expect(screen.getByRole("link", { name: /twitter|x/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /linkedin/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /email|mail/i })).toBeInTheDocument();
  });

  it("handles API error gracefully", async () => {
    (api.referralApi.getStats as any).mockRejectedValue(new Error("network"));

    render(<ReferralWidget />);

    await waitFor(() => {
      expect(screen.getByText(/erreur|error/i)).toBeInTheDocument();
    });
  });
});
```

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- ReferralWidget
```

Expected: FAIL — composant inexistant.

- [ ] **Step 2: Implémenter `ReferralWidget.tsx`**

Créer `frontend/src/components/referral/ReferralWidget.tsx` :

```typescript
import React, { useEffect, useState } from "react";
import {
  Copy,
  Check,
  Users,
  Gift,
  Twitter,
  Linkedin,
  Mail,
  Loader2,
} from "lucide-react";
import {
  referralApi,
  type ReferralStatsResponse,
} from "../../services/api";
import { useLanguage } from "../../contexts/LanguageContext";
import { analytics } from "../../services/analytics";

export const ReferralWidget: React.FC = () => {
  const { language } = useLanguage();
  const tr = (fr: string, en: string) => (language === "fr" ? fr : en);

  const [stats, setStats] = useState<ReferralStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    referralApi
      .getStats()
      .then((data) => {
        if (mounted) {
          setStats(data);
          setError(null);
        }
      })
      .catch(() => {
        if (mounted) {
          setError(tr("Erreur de chargement", "Loading error"));
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopy = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.share_url);
      setCopied(true);
      // PostHog event (TODO post plan #6 si pas typé encore)
      analytics.capture("referral_link_copied", {
        code: stats.code,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback : sélectionner le texte (rare)
    }
  };

  const handleShareClick = (channel: "twitter" | "linkedin" | "email") => {
    if (!stats) return;
    analytics.capture("referral_share_clicked", {
      code: stats.code,
      channel,
    });
  };

  if (loading) {
    return (
      <section className="card">
        <div className="panel-body flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
          <span className="ml-2 text-sm text-text-tertiary">
            {tr("Chargement…", "Loading…")}
          </span>
        </div>
      </section>
    );
  }

  if (error || !stats) {
    return (
      <section className="card">
        <div className="panel-body text-sm text-red-400 py-4">
          {error || tr("Erreur de chargement", "Loading error")}
        </div>
      </section>
    );
  }

  const shareText = encodeURIComponent(
    tr(
      "Je teste DeepSight pour analyser mes vidéos YouTube avec l'IA — utilise mon lien pour +5 analyses gratuites :",
      "I'm using DeepSight to analyze YouTube videos with AI — use my link for 5 free bonus analyses:",
    ),
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(stats.share_url)}`;
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(stats.share_url)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(
    tr("Découvre DeepSight", "Discover DeepSight"),
  )}&body=${shareText}%20${encodeURIComponent(stats.share_url)}`;

  return (
    <section className="card">
      <div className="panel-header">
        <h2 className="font-semibold text-text-primary flex items-center gap-2">
          <Gift className="w-5 h-5 text-accent-primary" />
          {tr("Programme parrainage", "Referral program")}
        </h2>
      </div>
      <div className="panel-body space-y-4">
        <p className="text-sm text-text-tertiary">
          {tr(
            "Invite des amis : +5 analyses pour eux à l'inscription, +5 pour toi quand ils analysent leur 1ère vidéo.",
            "Invite friends: +5 analyses for them at signup, +5 for you when they analyze their first video.",
          )}
        </p>

        {/* Code + bouton copier */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-mono text-sm text-text-primary flex items-center">
            {stats.code}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-3 rounded-xl bg-accent-primary/20 hover:bg-accent-primary/30 border border-accent-primary/40 text-accent-primary font-medium text-sm flex items-center gap-2 transition-colors"
            aria-label={tr("Copier le lien", "Copy link")}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {tr("Copié !", "Copied!")}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {tr("Copier le lien", "Copy link")}
              </>
            )}
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <Users className="w-4 h-4 mx-auto text-text-tertiary mb-1" />
            <div className="text-xl font-semibold text-text-primary">
              {stats.total_referrals}
            </div>
            <div className="text-xs text-text-tertiary">
              {tr("Total", "Total")}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <Check className="w-4 h-4 mx-auto text-success mb-1" />
            <div className="text-xl font-semibold text-success">
              {stats.completed_count}
            </div>
            <div className="text-xs text-text-tertiary">
              {tr("Complétés", "Completed")}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
            <Gift className="w-4 h-4 mx-auto text-accent-primary mb-1" />
            <div className="text-xl font-semibold text-accent-primary">
              {stats.credits_earned}
            </div>
            <div className="text-xs text-text-tertiary">
              {tr("Crédits gagnés", "Credits earned")}
            </div>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex flex-wrap gap-2 pt-2">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleShareClick("twitter")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-text-primary transition-colors"
            aria-label="Twitter"
          >
            <Twitter className="w-4 h-4" /> Twitter
          </a>
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleShareClick("linkedin")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-text-primary transition-colors"
            aria-label="LinkedIn"
          >
            <Linkedin className="w-4 h-4" /> LinkedIn
          </a>
          <a
            href={emailUrl}
            onClick={() => handleShareClick("email")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-text-primary transition-colors"
            aria-label="Email"
          >
            <Mail className="w-4 h-4" /> Email
          </a>
        </div>
      </div>
    </section>
  );
};
```

- [ ] **Step 3: Lancer les tests Vitest — TDD green**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run test -- ReferralWidget
```

Expected: 4 tests PASS.

- [ ] **Step 4: Ajouter clés i18n (placeholders pour usage futur)**

Dans `frontend/src/i18n/fr.json`, ajouter une section `referral` :

```json
{
  "referral": {
    "title": "Programme parrainage",
    "description": "Invite des amis : +5 analyses pour eux à l'inscription, +5 pour toi quand ils analysent leur 1ère vidéo.",
    "copy_link": "Copier le lien",
    "copied": "Copié !",
    "stats": {
      "total": "Total",
      "completed": "Complétés",
      "credits_earned": "Crédits gagnés"
    }
  }
}
```

Symétrique dans `en.json` :

```json
{
  "referral": {
    "title": "Referral program",
    "description": "Invite friends: +5 analyses for them at signup, +5 for you when they analyze their first video.",
    "copy_link": "Copy link",
    "copied": "Copied!",
    "stats": {
      "total": "Total",
      "completed": "Completed",
      "credits_earned": "Credits earned"
    }
  }
}
```

(Note : le widget utilise `tr()` inline pour ce sprint ; les clés i18n sont préparées pour migration ultérieure.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/referral/ frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(referral): add ReferralWidget with copy/stats/share + Vitest tests"
```

---

### Task 9: Détection `?ref=` LandingPage + relais Login → register

**Files:**

- Modify: `frontend/src/pages/LandingPage.tsx:586-591` (ajouter useEffect détection `?ref=`)
- Modify: `frontend/src/pages/Login.tsx:155-165` (passer pendingReferralCode à register)

- [ ] **Step 1: LandingPage — détection `?ref=` au mount**

Dans `frontend/src/pages/LandingPage.tsx`, ajouter en haut des imports :

```typescript
import { referralApi } from "../services/api";
import { analytics } from "../services/analytics";
```

Après le `useEffect` redirect logged-in (ligne 587), ajouter un nouveau `useEffect` :

```typescript
// 🎁 Programme parrainage : détecter ?ref=<CODE> au mount,
// vérifier validité, stocker en localStorage pour relais au signup.
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const refCode = params.get("ref");
  if (!refCode || !refCode.startsWith("ds_")) return;

  // Tracking immédiat (même si code invalide — utile pour analytics)
  analytics.capture("referral_link_clicked", { code: refCode });

  // Vérifier validité côté serveur (best-effort)
  referralApi
    .verifyCode(refCode)
    .then((res) => {
      if (res.valid) {
        localStorage.setItem("pendingReferralCode", refCode);
      } else {
        // Code invalide → ne pas stocker
        localStorage.removeItem("pendingReferralCode");
      }
    })
    .catch(() => {
      // En cas d'erreur réseau, on stocke quand même : le backend retentera au signup
      localStorage.setItem("pendingReferralCode", refCode);
    });
}, []);
```

- [ ] **Step 2: Login.tsx — relais pendingReferralCode au register**

Dans `frontend/src/pages/Login.tsx`, remplacer la ligne 157 :

```typescript
await register(email.split("@")[0], email, password);
```

par :

```typescript
const pendingRef = localStorage.getItem("pendingReferralCode") || undefined;
await register(email.split("@")[0], email, password, pendingRef);
if (pendingRef) {
  // Tracking : signup démarré avec referral
  analytics.capture("referral_signup_started", { code: pendingRef });
  localStorage.removeItem("pendingReferralCode");
}
```

⚠ Vérifier qu'`analytics` est importé en haut. Sinon ajouter :

```typescript
import { analytics } from "../services/analytics";
```

- [ ] **Step 3: Vérifier typecheck + lint**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck && npm run lint
```

Expected: aucune nouvelle erreur.

- [ ] **Step 4: Test manuel local (smoke)**

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run dev
```

Naviguer vers `http://localhost:5173/?ref=ds_a1b2c3d4` (avec un user existant ayant ce code) et vérifier dans DevTools Application > Local Storage que `pendingReferralCode = "ds_a1b2c3d4"`. Vérifier dans Network tab le call `GET /api/referral/code/ds_a1b2c3d4`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/Login.tsx
git commit -m "feat(referral): detect ?ref= on landing and relay to register via localStorage"
```

---

### Task 10: Insérer `ReferralWidget` dans `MyAccount.tsx`

**Files:**

- Modify: `frontend/src/pages/MyAccount.tsx:880-887` (insérer widget juste avant section "Mon abonnement")

- [ ] **Step 1: Importer le composant**

En haut de `MyAccount.tsx`, ajouter :

```typescript
import { ReferralWidget } from "../components/referral/ReferralWidget";
```

- [ ] **Step 2: Insérer le widget juste avant la card "Mon abonnement"**

Repérer le bloc commentaire/section `<section className="card">` qui contient `{tr("Mon abonnement", "My Subscription")}` (ligne ~881-887). **Juste avant** ce `<section>`, insérer :

```typescript
            {/* ═══════════════════════════════════════════════════════════════════════════
              🎁 PROGRAMME PARRAINAGE — ReferralWidget (acquisition virale)
              ═══════════════════════════════════════════════════════════════════════════ */}
            <ReferralWidget />

```

- [ ] **Step 3: Vérifier typecheck**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run typecheck
```

Expected: pas de nouvelle erreur.

- [ ] **Step 4: Smoke test visuel**

Run:

```bash
cd C:/Users/33667/DeepSight-Main/frontend
npm run dev
```

Login → naviguer vers `/account` → vérifier que le ReferralWidget apparaît juste au-dessus de la section "Mon abonnement" avec :

- Le code `ds_<8chars>` affiché
- Le bouton "Copier le lien" fonctionnel
- Les 3 compteurs (Total / Complétés / Crédits gagnés)
- Les 3 boutons share Twitter / LinkedIn / Email

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/MyAccount.tsx
git commit -m "feat(referral): insert ReferralWidget in MyAccount page above subscription section"
```

---

### Task 11 (validation E2E manuelle — pas du code à écrire)

Cette task est un **checklist E2E manuel** à exécuter contre une instance dev locale ou preview Vercel + backend dev. Aucun fichier modifié. Si un step échoue, créer une issue et revenir aux tâches précédentes.

**Précondition** : tasks 1-10 mergées sur `feature/audit-kimi-plans-2026-04-29`. Backend lancé (`uvicorn`) + frontend `npm run dev`.

- [ ] **Step 1: User parrain (Alice) génère son code**
  1. Login avec Alice (compte existant ou nouveau).
  2. Aller sur `/account`.
  3. Vérifier que le widget Referral affiche un code `ds_<8chars>`.
  4. Cliquer "Copier le lien" → vérifier copie clipboard.
  5. Inspecter dans DevTools Network : `POST /api/referral/generate` puis `GET /api/referral/my-stats` — 200 OK.

- [ ] **Step 2: User filleul (Bob) clique le lien**
  1. Logout Alice.
  2. Coller le lien copié dans un onglet privé : `https://localhost:5173/?ref=ds_<code>` (ou `http://localhost:5173/?ref=ds_xxx` selon ton setup).
  3. Vérifier dans DevTools : `GET /api/referral/code/ds_xxx` → 200 et `localStorage.pendingReferralCode === "ds_xxx"`.
  4. Vérifier l'event PostHog `referral_link_clicked` envoyé (si PostHog configuré en dev).

- [ ] **Step 3: Bob signup**
  1. Sur landing, cliquer "S'inscrire" / sur Login passer en mode register.
  2. Renseigner email `bob@example.com`, password.
  3. Submit.
  4. Vérifier dans DevTools Network : `POST /api/auth/register` body contient `referral_code: "ds_xxx"`.
  5. Confirmer email Bob (mode dev sans Resend = auto-verified).
  6. Login Bob → `/account` → vérifier que Bob a 500 crédits (250 + 250 bonus).

- [ ] **Step 4: Bob analyse 1 vidéo**
  1. Coller une URL YouTube courte (< 5 min) sur `/dashboard`.
  2. Lancer une analyse v2 standard (Mistral Small).
  3. Attendre la complétion (status "completed").

- [ ] **Step 5: Vérifier crédit parrain**
  1. Logout Bob, login Alice.
  2. Aller sur `/account`.
  3. Vérifier dans le ReferralWidget : `completed_count = 1`, `credits_earned = 250`.
  4. Vérifier que le solde de crédits Alice a augmenté de +250.
  5. Inspecter en DB :
     ```bash
     # SQLite dev
     sqlite3 backend/data/deepsight_users.db "SELECT id, status, referrer_credits_awarded, completed_at FROM referrals;"
     ```
     Expected : 1 ligne, `status='completed'`, `referrer_credits_awarded=1`.

- [ ] **Step 6: Test idempotence**
  1. Bob analyse une **2e** vidéo.
  2. Vérifier que les crédits Alice ne bougent PAS (`credits_earned` reste à 250 dans le widget).

- [ ] **Step 7: Test self-referral rejected**
  1. Logout, créer un nouveau user Charlie qui clique son propre lien.
  2. Vérifier que `apply` retourne `status: rejected, reason: self_referral`.

Si tous les steps passent, le plan est complet et la branche est prête pour PR review.

---

## PostHog events (cohérence plan #6)

Les events suivants sont émis depuis le frontend et sont à ajouter à `EventPayloadMap` du plan PostHog (#6) :

| Event                     | Source                                           | Properties                        |
| ------------------------- | ------------------------------------------------ | --------------------------------- |
| `referral_link_clicked`   | LandingPage useEffect ?ref=                      | `{code: string}`                  |
| `referral_link_copied`    | ReferralWidget bouton copier                     | `{code: string}`                  |
| `referral_share_clicked`  | ReferralWidget Twitter/LinkedIn/Email            | `{code: string, channel: string}` |
| `referral_signup_started` | Login.tsx handleSubmit isRegister                | `{code: string}`                  |
| `referral_completed`      | Backend (TODO V2 — webhook PostHog côté serveur) | (server-side)                     |

Si le plan #6 n'est pas encore mergé, ces events sont émis comme strings non-typés via `analytics.capture()` — pas d'erreur de compilation. Quand #6 sera mergé, étendre `EventPayloadMap` avec les 5 events ci-dessus.

---

## Self-review

### Spec coverage

- ✅ Code parrainage `ds_<base64(user_id)[:8]>` permanent — Task 3 step 4 (`generate_code`)
- ✅ Lien `https://www.deepsightsynthesis.com/?ref=<CODE>` — Task 3 (`SHARE_URL_BASE` constant)
- ✅ +5 analyses (= +250 crédits) parrain et filleul — Task 3 (`REFERRAL_BONUS_CREDITS = 250`)
- ✅ Récompense filleul à l'inscription — Task 3 (`apply_code` crédite immédiatement)
- ✅ Récompense parrain au flip pending → completed — Task 3 (`complete_referral_if_first_analysis`)
- ✅ Anti-fraude soft (SHA256 IP + email_domain logged) — Task 2/3 (`_hash_ip`, `_email_domain`)
- ✅ Limite 50 completed par user — Task 3 (`MAX_COMPLETED_REFERRALS = 50` testé)
- ✅ Statuts pending/completed/expired — Task 1/2 (enum PG, str20 ORM) + expiry 30j testé
- ✅ Migration Alembic 012 — Task 1
- ✅ User.referral_code colonne — Task 1/2
- ✅ POST /api/referral/generate — Task 4
- ✅ GET /api/referral/code/{code} — Task 4
- ✅ POST /api/referral/apply — Task 4
- ✅ GET /api/referral/my-stats — Task 4
- ✅ Hook signup — Task 5
- ✅ Hook completion videos/router.py:1650 — Task 6 (V1 scope explicite, gap autres flux noted)
- ✅ Frontend referralApi — Task 7
- ✅ ReferralWidget — Task 8
- ✅ Détection ?ref= LandingPage + relais Login — Task 9
- ✅ Insertion MyAccount — Task 10
- ✅ E2E manuel complet — Task 11
- ✅ 5 events PostHog — instrumentés dans Tasks 8/9 (commentés `TODO post plan #6` si pas typé)

### Décisions à confirmer

- **D1 — Limite 50 completed/user** : confirmée par RELEASE-ORCHESTRATION RF-1, default OK. Alternative 20 ou 100 si data ultérieure le justifie.
- **D2 — Anti-fraude soft (logs only)** : suffisant pour V1 (cf. RF-2). Pas de blocage IP/email_domain dans le code, juste logs SHA256. Itération possible si abuses détectés post-déploiement.
- **D3 — Récompense crédits-only** : 250 crédits suffisants pour V1 (cf. RF-3). Voice minutes pourront s'ajouter dans une V2 (table relation `referral_voice_bonus` à créer si nécessaire).
- **D4 — Pas d'email notif au completed V1** : confirmé (RF-4). Hook existe (`logger.info` dans Task 6) — V2 pourra brancher Resend ici sans toucher à la logique core.
- **D5 — Migration Alembic 012** : imposé par RELEASE-ORCHESTRATION META-2/RF-5. Ajustement `down_revision` à valider à T1 step 1 selon état réel des migrations 010/011 mergées ou pas.

### Type consistency

- `Referral.status` : `String(20)` côté ORM (portabilité SQLite/PG), Enum côté migration PG uniquement. Cohérent.
- `Referral.id` : `String(36)` (`uuid4` string) — cohérent partout (migration + ORM + service).
- `referralApi.verifyCode` retourne `ReferralVerifyResponse` partout (api.ts + LandingPage). OK.
- `referralApi.getStats` retourne `ReferralStatsResponse` aligné avec backend `ReferralStatsResponse` (mêmes 6 clés). OK.
- `User.referral_code` : `String(64) UNIQUE indexed nullable` cohérent (migration + ORM).

### Placeholder scan

Aucun `TBD`, `TODO sans contexte`, ni "implement later" non justifié. Les `TODO post plan #6` sont des stubs intentionnels, datés et tracés. Les 5 autres `increment_daily_usage` non instrumentés sont notés comme **gap V1 explicite**, pas un placeholder.

### Risques notés

- **Race condition** : si le filleul fait sa 1ère analyse exactement au moment où un autre filleul du même parrain le fait aussi, et que le parrain est à 49 completed → théoriquement les 2 pourraient passer la limite. Mitigation : `await session.commit()` séparé entre count check et award + idempotence par flag `referrer_credits_awarded`. Dans la pratique RAREMENT déclenché au volume V1.
- **Mobile/Extension non couverts** : ce plan ne touche que web. Mobile (`mobile/src/services/api.ts`) et Extension peuvent ajouter `referralApi` plus tard sans bloquer ce sprint. Listés comme gap explicite.
- **Si Sprint B (#7) pas encore mergé** : `down_revision = "009_add_user_preferences_json"` au lieu de `"011"`. Vérification à T1 step 1.

---

## Execution Handoff

**Plan complet et sauvegardé dans `C:\Users\33667\DeepSight-Main\docs\superpowers\plans\2026-04-29-programme-parrainage.md`. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — un subagent Opus 4.7 frais par task + two-stage review entre les tâches. Idéal pour ce plan qui mélange backend (TDD pytest) et frontend (TDD Vitest) — chaque sprint reste isolé.

**2. Inline Execution** — exécution batch dans la session courante avec checkpoints. Plus rapide mais moins de contrôle.

**Recommandation pour ce plan** : Subagent-Driven car :

- Tasks 1-6 (backend) et 7-10 (frontend) ont des stacks différents (pytest vs Vitest, Python vs TypeScript) — bénéfique de purger le contexte entre eux.
- Task 11 (E2E manuel) doit absolument être validé par un humain, pas un agent — checkpoint naturel.

**Quelle approche ?**
