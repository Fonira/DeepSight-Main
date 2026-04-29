# Plans DB-Driven Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer la définition des plans (actuellement hardcoded dans `backend/src/billing/plan_config.py` + `frontend/src/config/planPrivileges.ts`) vers des tables PostgreSQL `plans` et `plan_features`, permettant l'A/B testing pricing et l'édition admin sans deploy, tout en gardant l'API publique inchangée et un fallback hardcoded en cas d'inaccessibilité DB.

**Architecture:** Approche en 3 couches : (1) deux nouvelles tables SQL `plans` + `plan_features` avec seed initial idempotent, (2) un service `PlanRegistry` qui lit ces tables avec cache Redis 5 min et fallback sur les valeurs hardcoded actuelles si DB injoignable, (3) `plan_config.py` conserve son API publique mais délègue au service ; le frontend ajoute un hook `useApiPlans()` (TanStack Query 5 min) qui consomme `/api/billing/plans`. Endpoints admin protégés par `get_current_admin` permettent de modifier prix/features et invalident le cache.

**Tech Stack:** SQLAlchemy 2.0 async + Alembic (PostgreSQL 17/SQLite), Pydantic v2, Redis 7 via `cache_service` singleton, FastAPI, React 18 + TanStack Query 5, Vitest pour les tests frontend, pytest+pytest-asyncio pour le backend.

---

## ⚠️ DÉPENDANCE CRITIQUE — À LIRE AVANT TOUTE EXÉCUTION

**Ce plan ne peut être exécuté QU'APRÈS le merge complet du plan #3 :**
`docs/superpowers/plans/2026-04-29-pricing-v2-stripe-grandfathering.md`

Pourquoi : le plan #3 effectue le rename `plus → pro` puis `pro → expert` à la fois en DB
(`UPDATE users SET plan = 'pro' WHERE plan = 'plus'` etc.) et en code (`PlanId` enum,
clés de `PLAN_LIMITS`, dictionnaires d'aliases). Si on migre vers DB-driven AVANT le rename,
il faudra refaire le `UPDATE` sur la table `plans` _après_, ce qui fragmente la migration
inutilement et expose des fenêtres d'incohérence (ex : `plans.slug = 'plus'` mais `users.plan = 'pro'`).

L'état initial seed-é dans la table `plans` par ce plan est **directement la grille v2** :

| slug   | name    | price_monthly_cents | price_yearly_cents (-17%) |
| ------ | ------- | ------------------- | ------------------------- |
| free   | Gratuit | 0                   | 0                         |
| pro    | Pro     | 899                 | 8949                      |
| expert | Expert  | 1999                | 19899                     |

**Task 0 ci-dessous est un blocker de pré-condition** — ne pas démarrer la Task 1 si elle échoue.

---

## Contexte préalable — État actuel à migrer

### Backend (à migrer)

`backend/src/billing/plan_config.py` (662 lignes, déjà analysé) expose :

- `PlanId` enum (3 valeurs après #3 : `free`, `pro`, `expert`)
- `PLAN_HIERARCHY: list[PlanId]`
- `PLANS: dict[str, dict[str, Any]]` — la "grosse" structure avec `name`, `description`, `price_monthly_cents`, `stripe_price_id_test/live`, `color`, `icon`, `badge`, `popular`, `limits` (dict de ~30 clés), `features_display` (list), `features_locked` (list), `platforms` (dict avec `web`/`mobile`/`extension` chacun ~16 booleans)
- Fonctions accessor : `normalize_plan_id`, `get_plan`, `get_limits`, `get_platform_features`, `is_feature_available`, `get_minimum_plan_for`, `get_price_id`, `get_plan_by_price_id`, `get_plan_index`, `is_upgrade`, `init_stripe_prices`
- `VOICE_CALL_QUICK_CAPABILITY` + `get_voice_call_quick_capability` (Quick Voice Call)
- `PLATFORM_LIMITS` (TikTok/YouTube — pas concerné, hors scope)

L'endpoint actuel `GET /api/billing/plans?platform=...` (`backend/src/billing/router.py:354`) lit `PLANS` en mémoire et formate la réponse.

### Frontend (à migrer)

`frontend/src/config/planPrivileges.ts` (555 lignes, déjà analysé) exporte :

- `PLAN_HIERARCHY`, `PLAN_LIMITS`, `PLAN_FEATURES`, `PLANS_INFO`
- Helpers : `hasFeature`, `getLimit`, `isUnlimited`, `getPlanInfo`, `isPlanHigher`, `getMinPlanForFeature`, `formatLimit`, `normalizePlanId`
- `CONVERSION_TRIGGERS`, `DIFFERENTIATORS`, `TESTIMONIALS` (hors scope — restent statiques côté front, ce sont du marketing)

`frontend/src/services/api.ts:1820` expose déjà `billingApi.getPlans(platform)` qui consomme `/api/billing/plans`. Il sera utilisé tel quel par le hook.

### Tables d'aliases (à conserver)

Backend : `PLAN_ALIASES = {"etudiant": "plus", "starter": "plus", "student": "plus", ...}`. Après #3, `plus` n'existe plus → ces aliases pointent désormais vers `pro` ou `expert` (le détail est dans le plan #3, on suit son output).

---

## File Structure

### À créer (backend)

| Fichier                                            | Responsabilité                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `backend/alembic/versions/0XX_add_plans_tables.py` | Migration Alembic : tables `plans` + `plan_features` + index unique          |
| `backend/src/db/database.py` (ajout)               | Models SQLAlchemy `Plan` et `PlanFeature` (ajout dans le fichier existant)   |
| `backend/src/billing/plan_registry.py`             | Service `PlanRegistry` : lecture DB + cache Redis 5 min + fallback hardcoded |
| `backend/src/billing/plan_admin_router.py`         | Endpoints admin `/api/admin/plans` (GET / PUT / POST duplicate)              |
| `backend/scripts/seed_plans_db.py`                 | Script idempotent UPSERT par slug (3 plans v2 + features)                    |
| `backend/tests/billing/test_plan_registry.py`      | Tests unitaires PlanRegistry (DB read, cache, fallback)                      |
| `backend/tests/billing/test_plan_admin_router.py`  | Tests endpoints admin + invalidation cache                                   |

### À modifier (backend)

| Fichier                                 | Change                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `backend/src/billing/plan_config.py`    | Refactor interne : les fonctions accessor délèguent au `PlanRegistry`                   |
| `backend/src/billing/router.py:354-397` | `GET /plans` lit via `plan_registry.list_plans(platform)` au lieu de `PLANS` en mémoire |
| `backend/src/main.py`                   | Inclure `plan_admin_router` sous `/api/admin/plans`                                     |
| `backend/src/admin/router.py`           | Update `UpdateUserRequest.validate_plan` valid_plans = lus depuis registry              |

### À créer (frontend)

| Fichier                                             | Responsabilité                                                        |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `frontend/src/hooks/useApiPlans.ts`                 | Hook TanStack Query qui fetch `/api/billing/plans` + cache 5 min      |
| `frontend/src/config/planPrivilegesFallback.ts`     | **Renommé** depuis `planPrivileges.ts` — devient le fallback statique |
| `frontend/src/__tests__/hooks/useApiPlans.test.tsx` | Tests Vitest (mock fetch, fallback erreur)                            |

### À modifier (frontend)

| Fichier                                 | Change                                                              |
| --------------------------------------- | ------------------------------------------------------------------- |
| `frontend/src/config/planPrivileges.ts` | Réexporte `planPrivilegesFallback` pour compat + ajoute des helpers |

### À créer (admin UI — phase 2 optionnelle, voir Self-Review)

> Discussion de scope dans la self-review : on documente ici les fichiers prévus mais
> Tasks 13-14 sont marquées **OPTIONNELLES** et peuvent être un follow-up.

| Fichier                                 | Responsabilité                                                              |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `frontend/src/pages/AdminPlansPage.tsx` | Page admin minimale liste + édition prix/features                           |
| `frontend/src/services/api.ts` (ajout)  | `adminApi.listPlans()`, `adminApi.updatePlan()`, `adminApi.duplicatePlan()` |

---

## Tasks

### Task 0: Vérifier la pré-condition pricing v2 (BLOCKER)

**Files:**

- Read-only check : `backend/src/billing/plan_config.py`, DB prod via SSH si possible

- [ ] **Step 1 : Vérifier que `plan_config.py` reflète la grille v2**

Lire `backend/src/billing/plan_config.py` lignes 22-32 et vérifier que `PlanId` contient
exactement `FREE`, `PRO`, `EXPERT` (et **pas** `PLUS`). Vérifier `PLANS[PlanId.PRO]["price_monthly_cents"] == 899` et `PLANS[PlanId.EXPERT]["price_monthly_cents"] == 1999`.

Si l'enum contient encore `PLUS` ou les prix sont 499/999 → **STOP** : le plan #3 n'est pas mergé. Reporter ce plan jusqu'à ce que #3 soit en main + déployé prod.

- [ ] **Step 2 : Vérifier la prod**

Si l'utilisateur a accès SSH au VPS Hetzner, exécuter :

```bash
ssh root@89.167.23.214 "docker exec repo-postgres-1 psql -U deepsight -d deepsight -c \"SELECT DISTINCT plan FROM users;\""
```

Expected output : `free`, `pro`, `expert` uniquement (pas de `plus` résiduel hors aliases déjà migrés).

Si la query montre encore `plus` → STOP, attendre que la migration data du plan #3 ait tourné.

- [ ] **Step 3 : Constater le numéro de migration suivant**

```bash
ls backend/alembic/versions/
```

Noter le numéro le plus haut. **Au moment de la rédaction de ce plan, le dernier était `009_add_user_preferences_json.py`.** Le plan #3 ajoute probablement `010` (rename users.plan) et `011` (column grandfathering). Adapter `0XX` ci-dessous au numéro réellement disponible (probable **012**).

> Dans la suite du plan, on note `0XX` pour le numéro de migration. **Remplacer par le bon numéro avant exécution Task 1.**

- [ ] **Step 4 : Pas de commit** — Task 0 est purement un check.

---

### Task 1 : Modèles SQLAlchemy `Plan` + `PlanFeature`

**Files:**

- Modify : `backend/src/db/database.py` (ajouter à la fin avant `__all__` si présent, sinon avant la dernière ligne)
- Test : `backend/tests/billing/test_plan_registry.py` (créer le fichier vide pour le moment)

- [ ] **Step 1 : Écrire le test failing**

Créer `backend/tests/billing/test_plan_registry.py` (le dossier `tests/billing/` peut ne pas exister, créer `__init__.py` si besoin) :

```python
"""Tests pour le PlanRegistry et les modèles Plan/PlanFeature."""
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Plan, PlanFeature


@pytest.mark.asyncio
async def test_plan_model_can_be_inserted(db_session: AsyncSession):
    plan = Plan(
        slug="test_free",
        name="Test Free",
        description="A test plan",
        price_monthly_cents=0,
        price_yearly_cents=0,
        yearly_discount_percent=17,
        is_active=True,
        display_order=0,
        cta_label="S'abonner",
        trial_days=7,
    )
    db_session.add(plan)
    await db_session.commit()
    await db_session.refresh(plan)

    assert plan.id is not None
    assert plan.slug == "test_free"
    assert plan.created_at is not None


@pytest.mark.asyncio
async def test_plan_feature_unique_constraint(db_session: AsyncSession):
    plan = Plan(
        slug="test_pro",
        name="Test Pro",
        price_monthly_cents=899,
        price_yearly_cents=8949,
    )
    db_session.add(plan)
    await db_session.commit()
    await db_session.refresh(plan)

    f1 = PlanFeature(plan_id=plan.id, feature_key="monthly_analyses", limit_value=25, is_enabled=True)
    db_session.add(f1)
    await db_session.commit()

    # Le doublon doit échouer
    f2 = PlanFeature(plan_id=plan.id, feature_key="monthly_analyses", limit_value=99, is_enabled=True)
    db_session.add(f2)
    with pytest.raises(Exception):
        await db_session.commit()
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

```bash
cd backend && python -m pytest tests/billing/test_plan_registry.py -v
```

Expected : `ImportError: cannot import name 'Plan' from 'db.database'`.

- [ ] **Step 3 : Ajouter les modèles dans `backend/src/db/database.py`**

Ajouter (en respectant les conventions du fichier — `Base` est déclaré ligne 99, les autres modèles utilisent le même style) :

```python
class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)
    slug = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    price_monthly_cents = Column(Integer, nullable=False, default=0)
    price_yearly_cents = Column(Integer, nullable=False, default=0)
    yearly_discount_percent = Column(Integer, default=17, nullable=False)
    stripe_price_id_monthly = Column(String(100), nullable=True)
    stripe_price_id_yearly = Column(String(100), nullable=True)
    stripe_price_id_monthly_test = Column(String(100), nullable=True)
    stripe_price_id_yearly_test = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    highlight_label = Column(String(64), nullable=True)
    cta_label = Column(String(64), default="S'abonner", nullable=False)
    trial_days = Column(Integer, default=7, nullable=False)
    variant_label = Column(String(32), nullable=True, index=True)
    color = Column(String(16), nullable=True)
    icon = Column(String(32), nullable=True)
    popular = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    features = relationship(
        "PlanFeature",
        back_populates="plan",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class PlanFeature(Base):
    __tablename__ = "plan_features"

    id = Column(Integer, primary_key=True)
    plan_id = Column(
        Integer,
        ForeignKey("plans.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature_key = Column(String(64), nullable=False)
    limit_value = Column(Integer, nullable=True)
    is_enabled = Column(Boolean, default=True, nullable=False)
    feature_metadata = Column("metadata", JSON, nullable=True)

    plan = relationship("Plan", back_populates="features")

    __table_args__ = (
        UniqueConstraint("plan_id", "feature_key", name="uix_plan_feature"),
    )
```

⚠️ Notes d'intégration :

- `func`, `JSON`, `UniqueConstraint`, `ForeignKey`, `relationship`, `Text` doivent être importés en haut du fichier — vérifier que tous sont déjà présents (la plupart le sont).
- L'attribut Python s'appelle `feature_metadata` (mais la colonne SQL est `metadata`) parce que `metadata` est un mot réservé de SQLAlchemy `Base`.
- `lazy="selectin"` évite le N+1 quand on fait `Plan.features` dans une boucle.

- [ ] **Step 4 : Lancer les tests à nouveau**

```bash
cd backend && python -m pytest tests/billing/test_plan_registry.py -v
```

Expected : tests passent, mais peut-être skip si la fixture `db_session` n'existe pas — vérifier `backend/tests/conftest.py`. Si la fixture manque, ajouter dans la conftest existante :

```python
# backend/tests/conftest.py — vérifier la présence de db_session async fixture
# Si absente, voir un test existant qui utilise une session pour le pattern
```

(Pattern existant : regarder `backend/tests/auth/` ou `backend/tests/billing/` pour la fixture standard).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/db/database.py backend/tests/billing/test_plan_registry.py backend/tests/billing/__init__.py
git commit -m "feat(billing): add Plan and PlanFeature SQLAlchemy models"
```

---

### Task 2 : Migration Alembic `0XX_add_plans_tables`

**Files:**

- Create : `backend/alembic/versions/0XX_add_plans_tables.py` (remplacer `0XX` par le numéro réel)

- [ ] **Step 1 : Écrire la migration**

Créer `backend/alembic/versions/0XX_add_plans_tables.py` :

```python
"""Add plans and plan_features tables (DB-driven plans).

Revision ID: 0XX_add_plans_tables
Revises: 0YY_<previous_revision>
Create Date: 2026-04-29

Adds two tables to support DB-driven plans:
  - ``plans`` : pricing, display info, Stripe price IDs, A/B variant label
  - ``plan_features`` : key/value limits per plan (monthly_analyses=25, etc.)

Compat layer in plan_config.py keeps its public API; PlanRegistry
reads here with Redis cache 5 min and a hardcoded fallback if DB unreachable.

Cross-DB notes:
  - ``sa.JSON()`` becomes JSONB on PostgreSQL and TEXT on SQLite.
  - ``server_default`` for booleans uses ``sa.text("true")`` for portability.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "0XX_add_plans_tables"
down_revision: Union[str, None] = "0YY_<previous_revision>"  # ⚠️ remplacer par le réel
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_monthly_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("price_yearly_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("yearly_discount_percent", sa.Integer(), nullable=False, server_default="17"),
        sa.Column("stripe_price_id_monthly", sa.String(length=100), nullable=True),
        sa.Column("stripe_price_id_yearly", sa.String(length=100), nullable=True),
        sa.Column("stripe_price_id_monthly_test", sa.String(length=100), nullable=True),
        sa.Column("stripe_price_id_yearly_test", sa.String(length=100), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("highlight_label", sa.String(length=64), nullable=True),
        sa.Column("cta_label", sa.String(length=64), nullable=False, server_default="S'abonner"),
        sa.Column("trial_days", sa.Integer(), nullable=False, server_default="7"),
        sa.Column("variant_label", sa.String(length=32), nullable=True),
        sa.Column("color", sa.String(length=16), nullable=True),
        sa.Column("icon", sa.String(length=32), nullable=True),
        sa.Column("popular", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_plans_slug", "plans", ["slug"])
    op.create_index("ix_plans_slug", "plans", ["slug"])
    op.create_index("ix_plans_variant_label", "plans", ["variant_label"])

    op.create_table(
        "plan_features",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("feature_key", sa.String(length=64), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["plan_id"], ["plans.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("plan_id", "feature_key", name="uix_plan_feature"),
    )
    op.create_index("ix_plan_features_plan_id", "plan_features", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_features_plan_id", table_name="plan_features")
    op.drop_table("plan_features")
    op.drop_index("ix_plans_variant_label", table_name="plans")
    op.drop_index("ix_plans_slug", table_name="plans")
    op.drop_constraint("uq_plans_slug", "plans", type_="unique")
    op.drop_table("plans")
```

- [ ] **Step 2 : Tester la migration en local**

```bash
cd backend && alembic upgrade head
```

Expected : message `Running upgrade 0YY -> 0XX_add_plans_tables, Add plans and plan_features tables`. Aucune erreur.

Vérifier les tables :

```bash
cd backend && alembic current
```

Expected : `0XX_add_plans_tables (head)`.

- [ ] **Step 3 : Tester le downgrade aussi**

```bash
cd backend && alembic downgrade -1 && alembic upgrade head
```

Expected : downgrade puis upgrade sans erreur (idempotence).

- [ ] **Step 4 : Commit**

```bash
git add backend/alembic/versions/0XX_add_plans_tables.py
git commit -m "feat(db): add Alembic migration for plans and plan_features tables"
```

---

### Task 3 : Script seed `seed_plans_db.py` (idempotent UPSERT)

**Files:**

- Create : `backend/scripts/seed_plans_db.py`
- Test : `backend/tests/billing/test_seed_plans.py`

- [ ] **Step 1 : Écrire le test failing**

Créer `backend/tests/billing/test_seed_plans.py` :

```python
"""Tests pour le script de seed plans DB (idempotent UPSERT)."""
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Plan, PlanFeature
from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_seed_inserts_three_plans(db_session: AsyncSession):
    await seed_plans(db_session)
    result = await db_session.execute(select(Plan).order_by(Plan.display_order))
    plans = list(result.scalars().all())
    assert len(plans) == 3
    assert [p.slug for p in plans] == ["free", "pro", "expert"]
    assert [p.price_monthly_cents for p in plans] == [0, 899, 1999]


@pytest.mark.asyncio
async def test_seed_is_idempotent(db_session: AsyncSession):
    await seed_plans(db_session)
    await seed_plans(db_session)
    result = await db_session.execute(select(Plan))
    plans = list(result.scalars().all())
    assert len(plans) == 3  # Pas de doublons


@pytest.mark.asyncio
async def test_seed_updates_existing_plan(db_session: AsyncSession):
    await seed_plans(db_session)

    # Modifier en DB pour simuler une ancienne valeur
    existing = await db_session.execute(select(Plan).where(Plan.slug == "pro"))
    plan = existing.scalar_one()
    plan.price_monthly_cents = 999
    await db_session.commit()

    # Re-seed doit corriger
    await seed_plans(db_session)
    result = await db_session.execute(select(Plan).where(Plan.slug == "pro"))
    plan = result.scalar_one()
    assert plan.price_monthly_cents == 899  # Re-corrigé par le seed


@pytest.mark.asyncio
async def test_seed_creates_features(db_session: AsyncSession):
    await seed_plans(db_session)
    free = (await db_session.execute(select(Plan).where(Plan.slug == "free"))).scalar_one()
    feats = (await db_session.execute(
        select(PlanFeature).where(PlanFeature.plan_id == free.id)
    )).scalars().all()
    feat_map = {f.feature_key: f.limit_value for f in feats}
    assert feat_map["monthly_analyses"] == 5
    assert feat_map["max_video_length_min"] == 15
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

```bash
cd backend && python -m pytest tests/billing/test_seed_plans.py -v
```

Expected : `ModuleNotFoundError` ou `ImportError` sur `scripts.seed_plans_db`.

- [ ] **Step 3 : Implémenter le script**

Créer `backend/scripts/seed_plans_db.py` :

```python
"""Idempotent seed des 3 plans DeepSight v2 (free / pro / expert).

UPSERT par slug. Les features (limits) sont également UPSERT par (plan_id, feature_key).

Utilisation :
  - Standalone : `python -m scripts.seed_plans_db`
  - Programmatique : `await seed_plans(session)` depuis du code applicatif
  - Tests : importer `seed_plans` directement.

Source de vérité : grille v2 post-rename (plan #3 mergé).
"""
import asyncio
import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import Plan, PlanFeature, get_session

logger = logging.getLogger(__name__)


# ─── DEFINITIONS — Source de vérité v2 ───────────────────────────────────────
PLANS_SEED: list[dict[str, Any]] = [
    {
        "slug": "free",
        "name": "Gratuit",
        "description": "Découvrez DeepSight gratuitement",
        "price_monthly_cents": 0,
        "price_yearly_cents": 0,
        "yearly_discount_percent": 17,
        "is_active": True,
        "display_order": 0,
        "highlight_label": None,
        "cta_label": "Commencer gratuitement",
        "trial_days": 0,
        "color": "#6B7280",
        "icon": "⚡",
        "popular": False,
        "features": {
            "monthly_credits": 250,
            "monthly_analyses": 5,
            "max_video_length_min": 15,
            "concurrent_analyses": 1,
            "chat_questions_per_video": 5,
            "chat_daily_limit": 10,
            "academic_papers_per_analysis": 5,
            "history_retention_days": 60,
            "voice_monthly_minutes": 0,
            "web_search_monthly": 0,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "debate_monthly": 0,
            "geo_monthly": 0,
        },
        "boolean_features": {
            "priority_queue": False,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": False,
            "factcheck_enabled": False,
            "deep_research_enabled": False,
            "web_search_enabled": False,
            "playlists_enabled": False,
            "export_markdown": False,
            "export_pdf": False,
            "voice_chat_enabled": False,
            "bibliography_export": False,
            "academic_full_text": False,
            "debate_enabled": False,
            "tts_enabled": False,
            "geo_enabled": False,
        },
    },
    {
        "slug": "pro",
        "name": "Pro",
        "description": "L'essentiel pour apprendre mieux, plus vite",
        "price_monthly_cents": 899,
        "price_yearly_cents": 8949,  # -17% annuel
        "yearly_discount_percent": 17,
        "is_active": True,
        "display_order": 1,
        "highlight_label": "Populaire",
        "cta_label": "S'abonner",
        "trial_days": 7,
        "color": "#3B82F6",
        "icon": "⭐",
        "popular": True,
        "features": {
            "monthly_credits": 3000,
            "monthly_analyses": 25,
            "max_video_length_min": 60,
            "concurrent_analyses": 1,
            "chat_questions_per_video": 25,
            "chat_daily_limit": 50,
            "academic_papers_per_analysis": 15,
            "history_retention_days": -1,
            "voice_monthly_minutes": 0,
            "web_search_monthly": 20,
            "max_playlists": 0,
            "max_playlist_videos": 0,
            "debate_monthly": 3,
            "geo_monthly": 10,
        },
        "boolean_features": {
            "priority_queue": False,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": True,
            "factcheck_enabled": True,
            "deep_research_enabled": False,
            "web_search_enabled": True,
            "playlists_enabled": False,
            "export_markdown": True,
            "export_pdf": True,
            "voice_chat_enabled": False,
            "bibliography_export": True,
            "academic_full_text": False,
            "debate_enabled": True,
            "tts_enabled": False,
            "geo_enabled": True,
        },
    },
    {
        "slug": "expert",
        "name": "Expert",
        "description": "Toute la puissance de DeepSight, sans limites",
        "price_monthly_cents": 1999,
        "price_yearly_cents": 19899,  # -17% annuel
        "yearly_discount_percent": 17,
        "is_active": True,
        "display_order": 2,
        "highlight_label": "Le + puissant",
        "cta_label": "S'abonner",
        "trial_days": 7,
        "color": "#8B5CF6",
        "icon": "👑",
        "popular": False,
        "features": {
            "monthly_credits": 15000,
            "monthly_analyses": 100,
            "max_video_length_min": 240,
            "concurrent_analyses": 3,
            "chat_questions_per_video": -1,
            "chat_daily_limit": -1,
            "academic_papers_per_analysis": 50,
            "history_retention_days": -1,
            "voice_monthly_minutes": 45,
            "web_search_monthly": 60,
            "max_playlists": 10,
            "max_playlist_videos": 20,
            "debate_monthly": 20,
            "geo_monthly": -1,
        },
        "boolean_features": {
            "priority_queue": True,
            "flashcards_enabled": True,
            "quiz_enabled": True,
            "mindmap_enabled": True,
            "factcheck_enabled": True,
            "deep_research_enabled": True,
            "web_search_enabled": True,
            "playlists_enabled": True,
            "export_markdown": True,
            "export_pdf": True,
            "voice_chat_enabled": True,
            "bibliography_export": True,
            "academic_full_text": True,
            "debate_enabled": True,
            "tts_enabled": True,
            "geo_enabled": True,
        },
    },
]


async def seed_plans(session: AsyncSession) -> None:
    """UPSERT idempotent des 3 plans v2 + leurs features.

    - Cherche le plan par ``slug`` ; UPDATE si trouvé, INSERT sinon.
    - Pour chaque feature numérique : UPSERT ``(plan_id, feature_key)`` avec ``limit_value``.
    - Pour chaque feature booléenne : UPSERT ``(plan_id, feature_key)`` avec
      ``is_enabled`` et ``limit_value=NULL``.
    """
    for plan_def in PLANS_SEED:
        slug = plan_def["slug"]

        # UPSERT plan
        result = await session.execute(select(Plan).where(Plan.slug == slug))
        plan = result.scalar_one_or_none()

        plan_fields = {k: v for k, v in plan_def.items() if k not in ("features", "boolean_features")}

        if plan is None:
            plan = Plan(**plan_fields)
            session.add(plan)
            await session.flush()
            logger.info("Plan inserted: slug=%s", slug)
        else:
            for k, v in plan_fields.items():
                setattr(plan, k, v)
            logger.info("Plan updated: slug=%s", slug)

        # UPSERT features numériques
        for feat_key, limit_val in plan_def["features"].items():
            existing = await session.execute(
                select(PlanFeature).where(
                    PlanFeature.plan_id == plan.id,
                    PlanFeature.feature_key == feat_key,
                )
            )
            feat = existing.scalar_one_or_none()
            if feat is None:
                session.add(PlanFeature(
                    plan_id=plan.id,
                    feature_key=feat_key,
                    limit_value=limit_val,
                    is_enabled=True,
                ))
            else:
                feat.limit_value = limit_val
                feat.is_enabled = True

        # UPSERT features booléennes
        for feat_key, enabled in plan_def["boolean_features"].items():
            existing = await session.execute(
                select(PlanFeature).where(
                    PlanFeature.plan_id == plan.id,
                    PlanFeature.feature_key == feat_key,
                )
            )
            feat = existing.scalar_one_or_none()
            if feat is None:
                session.add(PlanFeature(
                    plan_id=plan.id,
                    feature_key=feat_key,
                    limit_value=None,
                    is_enabled=enabled,
                ))
            else:
                feat.limit_value = None
                feat.is_enabled = enabled

    await session.commit()


async def _main() -> None:
    """Entry point standalone : ouvre une session et lance le seed."""
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
    async for session in get_session():
        await seed_plans(session)
        return


if __name__ == "__main__":
    asyncio.run(_main())
```

- [ ] **Step 4 : Lancer les tests, vérifier le pass**

```bash
cd backend && python -m pytest tests/billing/test_seed_plans.py -v
```

Expected : 4 tests passent.

- [ ] **Step 5 : Lancer le seed en local**

```bash
cd backend && python -m scripts.seed_plans_db
```

Expected : 3 lignes "Plan inserted: slug=free / pro / expert".

Re-lancer pour vérifier l'idempotence :

```bash
cd backend && python -m scripts.seed_plans_db
```

Expected : 3 lignes "Plan updated: slug=...".

- [ ] **Step 6 : Commit**

```bash
git add backend/scripts/seed_plans_db.py backend/tests/billing/test_seed_plans.py
git commit -m "feat(billing): add idempotent seed_plans_db script for v2 grid"
```

---

### Task 4 : Service `PlanRegistry` (read DB + cache + fallback)

**Files:**

- Create : `backend/src/billing/plan_registry.py`
- Test : ajout dans `backend/tests/billing/test_plan_registry.py`

- [ ] **Step 1 : Étendre les tests**

Ajouter dans `backend/tests/billing/test_plan_registry.py` (à la fin) :

```python
from unittest.mock import AsyncMock, patch

from billing.plan_registry import PlanRegistry, plan_registry


@pytest.mark.asyncio
async def test_registry_reads_from_db(db_session: AsyncSession):
    from scripts.seed_plans_db import seed_plans
    await seed_plans(db_session)

    reg = PlanRegistry(session_factory=lambda: db_session)
    plans = await reg.list_plans()
    assert len(plans) == 3
    slugs = {p["slug"] for p in plans}
    assert slugs == {"free", "pro", "expert"}


@pytest.mark.asyncio
async def test_registry_uses_cache(db_session: AsyncSession):
    from scripts.seed_plans_db import seed_plans
    from core.cache import cache_service
    await seed_plans(db_session)

    reg = PlanRegistry(session_factory=lambda: db_session)
    await reg.invalidate_cache()
    p1 = await reg.list_plans()

    # Forcer DB vide pour vérifier que la 2e lecture vient du cache
    with patch.object(reg, "_load_from_db", new=AsyncMock(return_value=[])) as mock_load:
        p2 = await reg.list_plans()
        mock_load.assert_not_called()  # Cache hit
    assert len(p2) == 3


@pytest.mark.asyncio
async def test_registry_fallback_when_db_unreachable():
    """Si DB lance une exception, fallback sur les valeurs hardcoded."""
    async def _broken_factory():
        raise RuntimeError("DB unreachable")

    reg = PlanRegistry(session_factory=_broken_factory)
    await reg.invalidate_cache()
    plans = await reg.list_plans()

    # Doit utiliser le fallback hardcoded (3 plans v2)
    slugs = {p["slug"] for p in plans}
    assert slugs == {"free", "pro", "expert"}


@pytest.mark.asyncio
async def test_get_plan_by_slug(db_session: AsyncSession):
    from scripts.seed_plans_db import seed_plans
    await seed_plans(db_session)

    reg = PlanRegistry(session_factory=lambda: db_session)
    pro = await reg.get_plan("pro")
    assert pro is not None
    assert pro["price_monthly_cents"] == 899
    assert pro["features"]["monthly_analyses"] == 25


@pytest.mark.asyncio
async def test_get_limits_for_plan(db_session: AsyncSession):
    from scripts.seed_plans_db import seed_plans
    await seed_plans(db_session)

    reg = PlanRegistry(session_factory=lambda: db_session)
    limits = await reg.get_limits("expert")
    assert limits["monthly_analyses"] == 100
    assert limits["voice_chat_enabled"] is True
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

```bash
cd backend && python -m pytest tests/billing/test_plan_registry.py::test_registry_reads_from_db -v
```

Expected : `ImportError` sur `billing.plan_registry`.

- [ ] **Step 3 : Implémenter le service**

Créer `backend/src/billing/plan_registry.py` :

```python
"""PlanRegistry : lit la table ``plans`` avec cache Redis 5 min + fallback.

Patron : singleton-friendly, sans état mutable cross-requête.
Cache key namespace ``plans:`` invalidée à chaque mutation admin.

API publique :
    plan_registry.list_plans(active_only=True, variant=None) -> list[dict]
    plan_registry.get_plan(slug) -> dict | None
    plan_registry.get_limits(slug) -> dict
    plan_registry.invalidate_cache() -> None
"""
import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.cache import cache_service
from db.database import Plan, PlanFeature, get_session

logger = logging.getLogger(__name__)

CACHE_KEY_PREFIX = "plans"
CACHE_TTL_SECONDS = 300  # 5 minutes


# ─── FALLBACK — Grille v2 hardcoded (graceful degradation si DB injoignable) ──
# Aligné avec scripts/seed_plans_db.py — synchroniser les deux à chaque change.
FALLBACK_PLANS: list[dict[str, Any]] = [
    {
        "id": -1, "slug": "free", "name": "Gratuit",
        "description": "Découvrez DeepSight gratuitement",
        "price_monthly_cents": 0, "price_yearly_cents": 0, "yearly_discount_percent": 17,
        "is_active": True, "display_order": 0, "highlight_label": None,
        "cta_label": "Commencer gratuitement", "trial_days": 0, "variant_label": None,
        "color": "#6B7280", "icon": "⚡", "popular": False,
        "stripe_price_id_monthly": None, "stripe_price_id_yearly": None,
        "features": {
            "monthly_credits": 250, "monthly_analyses": 5, "max_video_length_min": 15,
            "concurrent_analyses": 1, "chat_questions_per_video": 5, "chat_daily_limit": 10,
            "academic_papers_per_analysis": 5, "history_retention_days": 60,
            "voice_monthly_minutes": 0, "web_search_monthly": 0, "max_playlists": 0,
            "max_playlist_videos": 0, "debate_monthly": 0, "geo_monthly": 0,
            "priority_queue": False, "flashcards_enabled": True, "quiz_enabled": True,
            "mindmap_enabled": False, "factcheck_enabled": False, "deep_research_enabled": False,
            "web_search_enabled": False, "playlists_enabled": False,
            "export_markdown": False, "export_pdf": False, "voice_chat_enabled": False,
            "bibliography_export": False, "academic_full_text": False, "debate_enabled": False,
            "tts_enabled": False, "geo_enabled": False,
        },
    },
    {
        "id": -2, "slug": "pro", "name": "Pro",
        "description": "L'essentiel pour apprendre mieux, plus vite",
        "price_monthly_cents": 899, "price_yearly_cents": 8949, "yearly_discount_percent": 17,
        "is_active": True, "display_order": 1, "highlight_label": "Populaire",
        "cta_label": "S'abonner", "trial_days": 7, "variant_label": None,
        "color": "#3B82F6", "icon": "⭐", "popular": True,
        "stripe_price_id_monthly": None, "stripe_price_id_yearly": None,
        "features": {
            "monthly_credits": 3000, "monthly_analyses": 25, "max_video_length_min": 60,
            "concurrent_analyses": 1, "chat_questions_per_video": 25, "chat_daily_limit": 50,
            "academic_papers_per_analysis": 15, "history_retention_days": -1,
            "voice_monthly_minutes": 0, "web_search_monthly": 20, "max_playlists": 0,
            "max_playlist_videos": 0, "debate_monthly": 3, "geo_monthly": 10,
            "priority_queue": False, "flashcards_enabled": True, "quiz_enabled": True,
            "mindmap_enabled": True, "factcheck_enabled": True, "deep_research_enabled": False,
            "web_search_enabled": True, "playlists_enabled": False,
            "export_markdown": True, "export_pdf": True, "voice_chat_enabled": False,
            "bibliography_export": True, "academic_full_text": False, "debate_enabled": True,
            "tts_enabled": False, "geo_enabled": True,
        },
    },
    {
        "id": -3, "slug": "expert", "name": "Expert",
        "description": "Toute la puissance de DeepSight, sans limites",
        "price_monthly_cents": 1999, "price_yearly_cents": 19899, "yearly_discount_percent": 17,
        "is_active": True, "display_order": 2, "highlight_label": "Le + puissant",
        "cta_label": "S'abonner", "trial_days": 7, "variant_label": None,
        "color": "#8B5CF6", "icon": "👑", "popular": False,
        "stripe_price_id_monthly": None, "stripe_price_id_yearly": None,
        "features": {
            "monthly_credits": 15000, "monthly_analyses": 100, "max_video_length_min": 240,
            "concurrent_analyses": 3, "chat_questions_per_video": -1, "chat_daily_limit": -1,
            "academic_papers_per_analysis": 50, "history_retention_days": -1,
            "voice_monthly_minutes": 45, "web_search_monthly": 60, "max_playlists": 10,
            "max_playlist_videos": 20, "debate_monthly": 20, "geo_monthly": -1,
            "priority_queue": True, "flashcards_enabled": True, "quiz_enabled": True,
            "mindmap_enabled": True, "factcheck_enabled": True, "deep_research_enabled": True,
            "web_search_enabled": True, "playlists_enabled": True,
            "export_markdown": True, "export_pdf": True, "voice_chat_enabled": True,
            "bibliography_export": True, "academic_full_text": True, "debate_enabled": True,
            "tts_enabled": True, "geo_enabled": True,
        },
    },
]


def _serialize_plan(plan: Plan) -> dict[str, Any]:
    """Converti un Plan ORM en dict JSON-friendly avec features inline."""
    features: dict[str, Any] = {}
    for f in (plan.features or []):
        if f.limit_value is not None:
            features[f.feature_key] = f.limit_value
        else:
            features[f.feature_key] = bool(f.is_enabled)

    return {
        "id": plan.id,
        "slug": plan.slug,
        "name": plan.name,
        "description": plan.description,
        "price_monthly_cents": plan.price_monthly_cents,
        "price_yearly_cents": plan.price_yearly_cents,
        "yearly_discount_percent": plan.yearly_discount_percent,
        "is_active": plan.is_active,
        "display_order": plan.display_order,
        "highlight_label": plan.highlight_label,
        "cta_label": plan.cta_label,
        "trial_days": plan.trial_days,
        "variant_label": plan.variant_label,
        "color": plan.color,
        "icon": plan.icon,
        "popular": plan.popular,
        "stripe_price_id_monthly": plan.stripe_price_id_monthly,
        "stripe_price_id_yearly": plan.stripe_price_id_yearly,
        "features": features,
    }


class PlanRegistry:
    """Service de lecture des plans (DB + cache + fallback hardcoded)."""

    def __init__(
        self,
        session_factory: Optional[Callable[..., AsyncSession | Awaitable[AsyncSession]]] = None,
    ) -> None:
        # session_factory = callable(*) -> AsyncSession (sync ou async).
        # Par défaut on passera par get_session() lors d'un appel.
        self._session_factory = session_factory

    async def _open_session(self) -> AsyncSession:
        if self._session_factory is None:
            # Pattern get_session() est un async generator
            async for s in get_session():
                return s
            raise RuntimeError("get_session() did not yield")
        result = self._session_factory()
        if asyncio.iscoroutine(result):
            return await result
        return result  # type: ignore[return-value]

    async def _load_from_db(self) -> list[dict[str, Any]]:
        session = await self._open_session()
        try:
            result = await session.execute(
                select(Plan).order_by(Plan.display_order, Plan.id)
            )
            plans = list(result.scalars().all())
            return [_serialize_plan(p) for p in plans]
        finally:
            # Si la session vient de get_session(), elle se nettoie via le context.
            # Sinon, c'est de la responsabilité de l'appelant.
            pass

    async def list_plans(
        self,
        active_only: bool = True,
        variant: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        cache_key = f"{CACHE_KEY_PREFIX}:list:active={int(active_only)}:variant={variant or 'all'}"

        cached = await cache_service.get(cache_key)
        if cached is not None:
            return cached

        try:
            plans = await self._load_from_db()
        except Exception as e:
            logger.warning("PlanRegistry DB read failed, falling back to hardcoded: %s", e)
            plans = list(FALLBACK_PLANS)

        if active_only:
            plans = [p for p in plans if p["is_active"]]
        if variant is not None:
            plans = [p for p in plans if (p.get("variant_label") or None) == variant]

        await cache_service.set(cache_key, plans, ttl=CACHE_TTL_SECONDS)
        return plans

    async def get_plan(self, slug: str) -> Optional[dict[str, Any]]:
        plans = await self.list_plans(active_only=False)
        for p in plans:
            if p["slug"] == slug:
                return p
        return None

    async def get_limits(self, slug: str) -> dict[str, Any]:
        plan = await self.get_plan(slug)
        if plan is None:
            # Fallback ultime : free
            free = next((p for p in FALLBACK_PLANS if p["slug"] == "free"), None)
            return free["features"] if free else {}
        return plan["features"]

    async def invalidate_cache(self) -> int:
        return await cache_service.invalidate_prefix(f"{CACHE_KEY_PREFIX}:")


# Instance singleton applicative
plan_registry = PlanRegistry()
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd backend && python -m pytest tests/billing/test_plan_registry.py -v
```

Expected : tous les tests Task 4 passent (5 tests + ceux de Task 1).

- [ ] **Step 5 : Commit**

```bash
git add backend/src/billing/plan_registry.py backend/tests/billing/test_plan_registry.py
git commit -m "feat(billing): add PlanRegistry service with Redis cache and hardcoded fallback"
```

---

### Task 5 : Brancher `plan_config.py` sur `plan_registry`

**Files:**

- Modify : `backend/src/billing/plan_config.py`
- Test : `backend/tests/billing/test_plan_config_compat.py`

- [ ] **Step 1 : Écrire un test de compat**

Créer `backend/tests/billing/test_plan_config_compat.py` :

```python
"""Vérifie que l'API publique de plan_config.py reste fonctionnelle après refactor.

Les fonctions accessor délèguent maintenant au PlanRegistry mais doivent garder
exactement la même signature et le même comportement pour les callers existants.
"""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from billing.plan_config import (
    PLAN_HIERARCHY,
    PlanId,
    get_plan,
    get_limits,
    get_plan_index,
    is_upgrade,
    normalize_plan_id,
    get_price_id,
)
from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_get_plan_returns_v2_grid(db_session: AsyncSession):
    await seed_plans(db_session)
    pro = await get_plan("pro")
    assert pro["price_monthly_cents"] == 899


@pytest.mark.asyncio
async def test_get_limits_returns_features(db_session: AsyncSession):
    await seed_plans(db_session)
    limits = await get_limits("expert")
    assert limits["monthly_analyses"] == 100


def test_normalize_plan_id_handles_aliases():
    assert normalize_plan_id("etudiant") == "pro"   # alias après #3
    assert normalize_plan_id("EXPERT") == "expert"
    assert normalize_plan_id("") == "free"
    assert normalize_plan_id("garbage") == "free"


def test_plan_hierarchy_is_3_tiers():
    slugs = [p.value if hasattr(p, "value") else p for p in PLAN_HIERARCHY]
    assert slugs == ["free", "pro", "expert"]


def test_get_plan_index():
    assert get_plan_index("free") == 0
    assert get_plan_index("pro") == 1
    assert get_plan_index("expert") == 2


def test_is_upgrade():
    assert is_upgrade("free", "pro") is True
    assert is_upgrade("expert", "pro") is False
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

Les tests asynchrones vont échouer parce que `get_plan` / `get_limits` étaient sync auparavant.

```bash
cd backend && python -m pytest tests/billing/test_plan_config_compat.py -v
```

Expected : échec sur les tests `async`.

- [ ] **Step 3 : Refactor `plan_config.py`**

⚠️ Stratégie : on **conserve** l'API sync existante côté caller en exposant des shims,
mais les nouvelles versions sont async. On :

1. Garde `PlanId`, `PLAN_HIERARCHY`, `PLAN_ALIASES`, `normalize_plan_id` (fonction sync pure — pas d'I/O).
2. Garde `VOICE_CALL_QUICK_CAPABILITY`, `get_voice_call_quick_capability`, `PLATFORM_LIMITS`, `get_platform_limits`, `get_credit_multiplier` (purement statiques).
3. Garde `init_stripe_prices()` mais le fait écrire dans le PlanRegistry (next task) — pour l'instant on le NEUTRALISE et on log un warning si appelé.
4. Convertit `get_plan`, `get_limits`, `get_platform_features`, `is_feature_available`, `get_minimum_plan_for`, `get_price_id`, `get_plan_by_price_id` en **async** qui délèguent au registry.

Modifier `backend/src/billing/plan_config.py` — remplacer la section `ACCESSOR FUNCTIONS` (lignes 530-655 environ) par :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# ACCESSOR FUNCTIONS — Maintenant async, délèguent au PlanRegistry (DB + cache)
# ═══════════════════════════════════════════════════════════════════════════════

from billing.plan_registry import plan_registry


async def get_plan(plan_id: str) -> dict[str, Any]:
    """Retourne la config complète d'un plan. Normalise les aliases, fallback FREE."""
    normalized = normalize_plan_id(plan_id)
    plan = await plan_registry.get_plan(normalized)
    if plan is None:
        plan = await plan_registry.get_plan(PlanId.FREE.value)
    # Forme rétrocompat : limits inline pour les anciens callers
    if plan is not None and "limits" not in plan:
        plan["limits"] = plan.get("features", {})
    return plan or {}


async def get_limits(plan_id: str) -> dict[str, Any]:
    """Retourne uniquement les limites/features d'un plan."""
    normalized = normalize_plan_id(plan_id)
    return await plan_registry.get_limits(normalized)


async def get_platform_features(plan_id: str, platform: str) -> dict[str, bool]:
    """Retourne les features disponibles pour un plan sur une plateforme.

    NOTE : la matrice ``platforms`` n'est pas dans la table ``plans`` v1.
    On dérive depuis les booléens de ``features`` selon des règles internes
    plateforme. À étendre dans une migration future si on veut DB-driver
    ce niveau aussi (voir Self-Review).
    """
    limits = await get_limits(plan_id)

    # Mapping feature -> disponibilité par plateforme
    # Cohérent avec l'ancienne matrice PLANS[plan]["platforms"][platform]
    base = {
        "analyse": True,
        "chat": True,
        "history": True,
        "tts": bool(limits.get("tts_enabled", False)),
        "flashcards": bool(limits.get("flashcards_enabled", False)),
        "quiz": bool(limits.get("quiz_enabled", False)),
        "mindmap": bool(limits.get("mindmap_enabled", False)),
        "web_search": bool(limits.get("web_search_enabled", False)),
        "export_md": bool(limits.get("export_markdown", False)),
        "export_pdf": bool(limits.get("export_pdf", False)),
        "playlists": bool(limits.get("playlists_enabled", False)),
        "voice_chat": bool(limits.get("voice_chat_enabled", False)),
        "voice_call_quick": True,  # géré séparément par capability matrix
        "debate": bool(limits.get("debate_enabled", False)),
        "deep_research": bool(limits.get("deep_research_enabled", False)),
        "geo": bool(limits.get("geo_enabled", False)),
    }

    # Restrictions plateforme — extension/mobile ont moins
    if platform == "extension":
        for k in ("flashcards", "quiz", "mindmap", "web_search", "export_md",
                  "export_pdf", "playlists", "voice_chat", "debate",
                  "deep_research", "geo", "tts"):
            base[k] = False
    elif platform == "mobile":
        for k in ("mindmap", "web_search", "export_md", "export_pdf",
                  "debate", "deep_research"):
            base[k] = False

    return base


async def is_feature_available(plan_id: str, feature: str, platform: str = "web") -> bool:
    pf = await get_platform_features(plan_id, platform)
    return pf.get(feature, False)


async def get_minimum_plan_for(feature: str) -> str:
    for plan_id in PLAN_HIERARCHY:
        limits = await get_limits(plan_id.value)
        if feature in limits and isinstance(limits[feature], bool) and limits[feature]:
            return plan_id.value
        if feature in limits and isinstance(limits[feature], (int, float)):
            v = limits[feature]
            if v == -1 or v > 0:
                return plan_id.value
    return PlanId.PRO.value if PlanId.PRO in PLAN_HIERARCHY else PLAN_HIERARCHY[-1].value


async def get_price_id(plan_id: str, test_mode: bool = True) -> Optional[str]:
    plan = await plan_registry.get_plan(plan_id)
    if plan is None:
        return None
    # Pas de séparation test/live en DB v1 — pour l'instant on utilise les memes IDs
    # Les Stripe price IDs prod sont injectés via l'admin endpoint après seed.
    if test_mode:
        return plan.get("stripe_price_id_monthly_test") or plan.get("stripe_price_id_monthly")
    return plan.get("stripe_price_id_monthly")


async def get_plan_by_price_id(price_id: str) -> Optional[str]:
    if not price_id:
        return None
    plans = await plan_registry.list_plans(active_only=False)
    for p in plans:
        if p.get("stripe_price_id_monthly") == price_id:
            return p["slug"]
        if p.get("stripe_price_id_monthly_test") == price_id:
            return p["slug"]
        if p.get("stripe_price_id_yearly") == price_id:
            return p["slug"]
        if p.get("stripe_price_id_yearly_test") == price_id:
            return p["slug"]
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# DEPRECATED — init_stripe_prices()
# ═══════════════════════════════════════════════════════════════════════════════

def init_stripe_prices() -> None:
    """DEPRECATED — les Stripe price IDs vivent désormais en DB.

    Pour migrer une env var legacy vers la DB, utiliser le seed Hetzner
    ou l'endpoint admin PUT /api/admin/plans/{id}.
    """
    logger.info(
        "init_stripe_prices() is now a no-op — Stripe price IDs are stored in the plans table. "
        "Use the admin endpoint or seed script to set them."
    )
```

⚠️ **Important** : la ligne `init_stripe_prices()` à la fin du fichier (ligne 661) doit être conservée, mais maintenant elle est juste un log.

⚠️ Toutes les **callers** existants de `get_plan`, `get_limits`, `is_feature_available` etc. dans le backend sont sync et appellent ces fonctions sync. Il faut donc identifier les callers et les passer en async OU créer une couche de compat sync (cache local du registry).

**Décision plan : créer un wrapper sync `_get_limits_sync()` dans `core/plan_limits.py`.** Ne PAS toucher tous les callers dans cette task — c'est la Task 6.

Pour cette task, on exporte juste les versions async. La compat sync sera Task 6.

- [ ] **Step 4 : Lancer les tests**

```bash
cd backend && python -m pytest tests/billing/test_plan_config_compat.py -v
```

Expected : tests passent.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/billing/plan_config.py backend/tests/billing/test_plan_config_compat.py
git commit -m "refactor(billing): plan_config accessors delegate to PlanRegistry (async)"
```

---

### Task 6 : Wrapper sync pour callers existants (`core/plan_limits.py`)

**Files:**

- Read existing : `backend/src/core/plan_limits.py`
- Modify : `backend/src/core/plan_limits.py`
- Test : `backend/tests/core/test_plan_limits_sync.py`

**Pourquoi cette task** : beaucoup d'endpoints actuels appellent `is_feature_available()` ou `get_limits()` de manière **synchrone** (dans des fonctions `def` non-async, ou dans des hooks Pydantic). Les passer tous en async d'un coup = blast radius énorme. On expose un wrapper sync qui lit un **cache local** rafraîchi au boot.

- [ ] **Step 1 : Lire `core/plan_limits.py` pour comprendre l'API existante**

```bash
cd backend && grep -n "def " src/core/plan_limits.py | head -30
```

(Le fichier existe déjà — il faut adapter, pas remplacer.)

- [ ] **Step 2 : Écrire les tests**

Créer `backend/tests/core/test_plan_limits_sync.py` :

```python
"""Wrapper sync pour callers existants — refresh cache local au boot."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from core.plan_limits import (
    refresh_plan_cache,
    get_limits_sync,
    is_feature_available_sync,
)
from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_refresh_then_sync_read(db_session: AsyncSession):
    await seed_plans(db_session)
    await refresh_plan_cache()

    limits = get_limits_sync("pro")
    assert limits["monthly_analyses"] == 25


@pytest.mark.asyncio
async def test_is_feature_available_sync(db_session: AsyncSession):
    await seed_plans(db_session)
    await refresh_plan_cache()

    assert is_feature_available_sync("expert", "voice_chat") is True
    assert is_feature_available_sync("free", "voice_chat") is False


def test_sync_uses_fallback_if_cache_empty():
    """Sans refresh, le wrapper utilise le fallback hardcoded sans crash."""
    # Force vidage cache
    import core.plan_limits as mod
    mod._LOCAL_CACHE.clear()

    limits = get_limits_sync("pro")
    # Vient du fallback hardcoded (mêmes valeurs que la grille v2)
    assert limits["monthly_analyses"] == 25
```

- [ ] **Step 3 : Lancer les tests, vérifier l'échec**

```bash
cd backend && python -m pytest tests/core/test_plan_limits_sync.py -v
```

Expected : `ImportError` sur `refresh_plan_cache` / `get_limits_sync`.

- [ ] **Step 4 : Ajouter le wrapper sync dans `backend/src/core/plan_limits.py`**

Au choix : ajouter à la fin du fichier existant. Ne pas toucher l'existant.

```python
# ═══════════════════════════════════════════════════════════════════════════════
# SYNC WRAPPER — pour callers existants non-async (transition layer)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Lit le PlanRegistry au boot dans un cache local in-memory ; les appels sync
# lisent ce cache. À refresh à chaque mutation admin (via le router admin).
# Si le cache est vide (avant le boot ou en cas d'erreur), retombe sur le
# fallback hardcoded.

import logging as _logging
from typing import Any as _Any

_logger = _logging.getLogger(__name__)
_LOCAL_CACHE: dict[str, dict[str, _Any]] = {}


async def refresh_plan_cache() -> None:
    """Recharge le cache local depuis le PlanRegistry. À appeler au boot
    et à chaque mutation admin."""
    from billing.plan_registry import plan_registry, FALLBACK_PLANS

    try:
        plans = await plan_registry.list_plans(active_only=False)
    except Exception as e:
        _logger.warning("refresh_plan_cache: registry failed, using fallback: %s", e)
        plans = list(FALLBACK_PLANS)

    _LOCAL_CACHE.clear()
    for p in plans:
        _LOCAL_CACHE[p["slug"]] = p
    _logger.info("refresh_plan_cache: %d plans loaded", len(_LOCAL_CACHE))


def get_limits_sync(plan_slug: str) -> dict[str, _Any]:
    """Lecture sync depuis le cache local. Fallback hardcoded si vide."""
    from billing.plan_registry import FALLBACK_PLANS

    if plan_slug in _LOCAL_CACHE:
        return _LOCAL_CACHE[plan_slug].get("features", {})

    # Fallback hardcoded
    for p in FALLBACK_PLANS:
        if p["slug"] == plan_slug:
            return p["features"]

    # Ultimate fallback : free
    free = next((p for p in FALLBACK_PLANS if p["slug"] == "free"), None)
    return free["features"] if free else {}


def is_feature_available_sync(plan_slug: str, feature: str) -> bool:
    """Variante sync de ``is_feature_available`` (web platform par défaut).

    Pour la matrice plateforme/feature précise, utiliser la version async."""
    limits = get_limits_sync(plan_slug)
    val = limits.get(feature, False)
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val == -1 or val > 0
    return bool(val)
```

- [ ] **Step 5 : Brancher le refresh au boot dans `main.py`**

Dans `backend/src/main.py`, trouver la section lifespan / startup event et ajouter :

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ... code existant ...
    # NEW : précharger le cache local des plans
    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()
    yield
    # ... cleanup ...
```

(Si `lifespan` n'existe pas mais que `startup` event est utilisé, ajouter dans le startup event existant — ne pas restructurer.)

- [ ] **Step 6 : Lancer les tests**

```bash
cd backend && python -m pytest tests/core/test_plan_limits_sync.py -v
```

Expected : 3 tests passent.

- [ ] **Step 7 : Commit**

```bash
git add backend/src/core/plan_limits.py backend/src/main.py backend/tests/core/test_plan_limits_sync.py
git commit -m "feat(core): add sync plan_limits wrapper with boot-time refresh"
```

---

### Task 7 : Refactorer `GET /api/billing/plans` pour lire DB

**Files:**

- Modify : `backend/src/billing/router.py:354-397`
- Test : `backend/tests/billing/test_router_plans_endpoint.py`

- [ ] **Step 1 : Écrire le test**

Créer `backend/tests/billing/test_router_plans_endpoint.py` :

```python
"""Tests pour GET /api/billing/plans — version DB-driven."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_get_plans_returns_seeded_plans(client: AsyncClient, db_session: AsyncSession):
    await seed_plans(db_session)
    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()

    resp = await client.get("/api/billing/plans?platform=web")
    assert resp.status_code == 200
    data = resp.json()
    assert "plans" in data
    slugs = [p["id"] for p in data["plans"]]
    assert slugs == ["free", "pro", "expert"]


@pytest.mark.asyncio
async def test_get_plans_filters_by_variant(client: AsyncClient, db_session: AsyncSession):
    """Si on duplique un plan en variant=B, ?variant=B retourne juste celui-là."""
    await seed_plans(db_session)

    # Créer manuellement un plan variant B
    from db.database import Plan, PlanFeature
    pro_b = Plan(
        slug="pro_b",
        name="Pro (B)",
        price_monthly_cents=799,
        price_yearly_cents=7949,
        is_active=True,
        display_order=10,
        variant_label="B",
    )
    db_session.add(pro_b)
    await db_session.commit()

    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()

    resp = await client.get("/api/billing/plans?platform=web&variant=B")
    assert resp.status_code == 200
    data = resp.json()
    slugs = [p["id"] for p in data["plans"]]
    assert "pro_b" in slugs
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

```bash
cd backend && python -m pytest tests/billing/test_router_plans_endpoint.py::test_get_plans_filters_by_variant -v
```

Expected : échec — l'endpoint actuel ignore `variant`.

- [ ] **Step 3 : Refactorer le handler**

Dans `backend/src/billing/router.py`, remplacer le handler `/plans` (lignes 354-397) :

```python
@router.get("/plans")
async def get_plans(
    platform: str = Query("web", pattern="^(web|mobile|extension)$"),
    variant: Optional[str] = Query(None, max_length=32),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Retourne la liste des plans actifs avec limites filtrées par plateforme.

    Source : table ``plans`` (DB-driven), cache Redis 5 min.
    Public (enrichi avec is_current / is_upgrade / is_downgrade si user connecté).

    - ``platform`` : ``web`` | ``mobile`` | ``extension``
    - ``variant`` : ``A`` | ``B`` | ``None`` (par défaut, ne retourne que les
       plans sans variant_label, i.e. la variante de contrôle).
    """
    from billing.plan_registry import plan_registry
    from billing.plan_config import (
        get_platform_features,
        get_plan_index,
    )

    user_plan = (current_user.plan if current_user else "free") or "free"
    user_index = get_plan_index(user_plan)

    plans = await plan_registry.list_plans(active_only=True, variant=variant)
    # Si pas de variant demandée, on filtre les plans avec variant_label != None
    # afin de ne montrer que la variante de contrôle (ne pas mélanger A et B)
    if variant is None:
        plans = [p for p in plans if not p.get("variant_label")]

    result: list[dict[str, Any]] = []
    for plan in plans:
        plan_index = get_plan_index(plan["slug"])
        platform_features = await get_platform_features(plan["slug"], platform)

        result.append(
            {
                "id": plan["slug"],
                "name": plan["name"],
                "name_en": plan.get("name_en") or plan["name"],
                "description": plan["description"],
                "description_en": plan.get("description_en") or plan["description"],
                "price_monthly_cents": plan["price_monthly_cents"],
                "price_yearly_cents": plan.get("price_yearly_cents", 0),
                "yearly_discount_percent": plan.get("yearly_discount_percent", 17),
                "color": plan.get("color"),
                "icon": plan.get("icon"),
                "badge": (
                    {"text": plan["highlight_label"], "color": plan.get("color") or "#3B82F6"}
                    if plan.get("highlight_label") else None
                ),
                "popular": plan.get("popular", False),
                "limits": plan["features"],
                "platform_features": platform_features,
                "features_display": [],   # legacy field — vide en v1 DB-driven
                "features_locked": [],    # legacy field — vide en v1 DB-driven
                "is_current": plan["slug"] == user_plan,
                "is_upgrade": plan_index > user_index,
                "is_downgrade": plan_index < user_index and plan_index >= 0,
                "variant_label": plan.get("variant_label"),
                "trial_days": plan.get("trial_days", 7),
                "cta_label": plan.get("cta_label", "S'abonner"),
            }
        )

    return {"plans": result}
```

⚠️ Note : `features_display` et `features_locked` étaient des arrays cosmétiques pour l'UI marketing — la v1 DB-driven les laisse vides. Le frontend doit les recomposer côté front à partir de `limits`. Si c'est trop violent, on peut ajouter une colonne JSON `display_metadata` à la table plans dans une migration follow-up.

- [ ] **Step 4 : Lancer les tests**

```bash
cd backend && python -m pytest tests/billing/test_router_plans_endpoint.py -v
```

Expected : 2 tests passent.

- [ ] **Step 5 : Commit**

```bash
git add backend/src/billing/router.py backend/tests/billing/test_router_plans_endpoint.py
git commit -m "refactor(billing): GET /plans reads from DB-driven PlanRegistry"
```

---

### Task 8 : Endpoints admin `/api/admin/plans` (read + write)

**Files:**

- Create : `backend/src/billing/plan_admin_router.py`
- Modify : `backend/src/main.py` (inclure le router)
- Test : `backend/tests/billing/test_plan_admin_router.py`

- [ ] **Step 1 : Écrire les tests**

Créer `backend/tests/billing/test_plan_admin_router.py` :

```python
"""Tests endpoints admin /api/admin/plans — auth, mutations, invalidation cache."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_unauthenticated_returns_401(client: AsyncClient):
    resp = await client.get("/api/admin/plans")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_non_admin_returns_403(client: AsyncClient, regular_user_token: str):
    resp = await client.get(
        "/api/admin/plans",
        headers={"Authorization": f"Bearer {regular_user_token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_admin_lists_all_plans(
    client: AsyncClient, db_session: AsyncSession, admin_token: str
):
    await seed_plans(db_session)
    resp = await client.get(
        "/api/admin/plans",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["plans"]) == 3


@pytest.mark.asyncio
async def test_admin_updates_plan_price_invalidates_cache(
    client: AsyncClient, db_session: AsyncSession, admin_token: str
):
    await seed_plans(db_session)
    from db.database import Plan
    from sqlalchemy import select
    pro = (await db_session.execute(select(Plan).where(Plan.slug == "pro"))).scalar_one()

    # Première lecture publique pour remplir le cache
    pub_before = await client.get("/api/billing/plans?platform=web")
    pro_before = next(p for p in pub_before.json()["plans"] if p["id"] == "pro")
    assert pro_before["price_monthly_cents"] == 899

    # Mutation admin
    resp = await client.put(
        f"/api/admin/plans/{pro.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"price_monthly_cents": 1099},
    )
    assert resp.status_code == 200

    # Lecture publique doit voir la nouvelle valeur (cache invalidé)
    pub_after = await client.get("/api/billing/plans?platform=web")
    pro_after = next(p for p in pub_after.json()["plans"] if p["id"] == "pro")
    assert pro_after["price_monthly_cents"] == 1099


@pytest.mark.asyncio
async def test_admin_updates_plan_feature(
    client: AsyncClient, db_session: AsyncSession, admin_token: str
):
    await seed_plans(db_session)
    from db.database import Plan
    from sqlalchemy import select
    pro = (await db_session.execute(select(Plan).where(Plan.slug == "pro"))).scalar_one()

    resp = await client.put(
        f"/api/admin/plans/{pro.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "features": [
                {"feature_key": "monthly_analyses", "limit_value": 30, "is_enabled": True}
            ]
        },
    )
    assert resp.status_code == 200

    pub = await client.get("/api/billing/plans?platform=web")
    pro_pub = next(p for p in pub.json()["plans"] if p["id"] == "pro")
    assert pro_pub["limits"]["monthly_analyses"] == 30


@pytest.mark.asyncio
async def test_admin_duplicates_plan_for_ab_test(
    client: AsyncClient, db_session: AsyncSession, admin_token: str
):
    await seed_plans(db_session)
    from db.database import Plan
    from sqlalchemy import select
    pro = (await db_session.execute(select(Plan).where(Plan.slug == "pro"))).scalar_one()

    resp = await client.post(
        f"/api/admin/plans/{pro.id}/duplicate",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"variant_label": "B", "price_monthly_cents": 799},
    )
    assert resp.status_code == 201
    new_plan = resp.json()
    assert new_plan["slug"].startswith("pro_b")
    assert new_plan["variant_label"] == "B"
    assert new_plan["price_monthly_cents"] == 799
```

- [ ] **Step 2 : Lancer les tests, vérifier l'échec**

```bash
cd backend && python -m pytest tests/billing/test_plan_admin_router.py -v
```

Expected : 404 sur tous les endpoints admin (pas encore enregistrés).

- [ ] **Step 3 : Implémenter le router admin**

Créer `backend/src/billing/plan_admin_router.py` :

```python
"""Endpoints admin pour gérer les plans (CRUD + duplication A/B test).

Tous les endpoints sont protégés par ``get_current_admin``.
Chaque mutation invalide le cache plans (Redis) ET le cache local sync
(``core/plan_limits.py``).

Audit log via ``AdminLog`` (qui, quand, quoi).
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_admin
from billing.plan_registry import plan_registry, _serialize_plan
from db.database import (
    AdminLog,
    Plan,
    PlanFeature,
    User,
    get_session,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class PlanFeatureUpdate(BaseModel):
    feature_key: str = Field(..., max_length=64)
    limit_value: Optional[int] = None
    is_enabled: bool = True


class PlanUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    price_monthly_cents: Optional[int] = Field(None, ge=0)
    price_yearly_cents: Optional[int] = Field(None, ge=0)
    yearly_discount_percent: Optional[int] = Field(None, ge=0, le=100)
    stripe_price_id_monthly: Optional[str] = Field(None, max_length=100)
    stripe_price_id_yearly: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    highlight_label: Optional[str] = Field(None, max_length=64)
    cta_label: Optional[str] = Field(None, max_length=64)
    trial_days: Optional[int] = Field(None, ge=0, le=365)
    variant_label: Optional[str] = Field(None, max_length=32)
    color: Optional[str] = Field(None, max_length=16)
    icon: Optional[str] = Field(None, max_length=32)
    popular: Optional[bool] = None
    features: Optional[list[PlanFeatureUpdate]] = None


class PlanDuplicateRequest(BaseModel):
    variant_label: str = Field(..., min_length=1, max_length=32)
    slug: Optional[str] = Field(None, max_length=64)
    price_monthly_cents: Optional[int] = Field(None, ge=0)
    price_yearly_cents: Optional[int] = Field(None, ge=0)


# ═══════════════════════════════════════════════════════════════════════════════
# 🔧 HELPERS
# ═══════════════════════════════════════════════════════════════════════════════


async def _audit(
    session: AsyncSession,
    admin: User,
    action: str,
    target_id: Optional[int],
    payload: dict[str, Any],
) -> None:
    log = AdminLog(
        admin_user_id=admin.id,
        action=action,
        target_type="plan",
        target_id=target_id,
        # Selon le schema d'AdminLog actuel — vérifier dans db/database.py
        # Si la colonne s'appelle différemment, adapter.
        details=payload,
    )
    session.add(log)


async def _invalidate_caches() -> None:
    await plan_registry.invalidate_cache()
    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()


# ═══════════════════════════════════════════════════════════════════════════════
# 🔍 GET /api/admin/plans  — liste détaillée (incluant inactifs)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get("/plans")
async def admin_list_plans(
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(Plan).order_by(Plan.display_order, Plan.id)
    )
    plans = list(result.scalars().all())
    return {"plans": [_serialize_plan(p) for p in plans]}


# ═══════════════════════════════════════════════════════════════════════════════
# ✏️ PUT /api/admin/plans/{plan_id}  — mise à jour
# ═══════════════════════════════════════════════════════════════════════════════


@router.put("/plans/{plan_id}")
async def admin_update_plan(
    plan_id: int,
    body: PlanUpdateRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")

    update_data = body.model_dump(exclude_unset=True, exclude={"features"})
    for k, v in update_data.items():
        setattr(plan, k, v)

    if body.features is not None:
        for feat_update in body.features:
            existing = await session.execute(
                select(PlanFeature).where(
                    PlanFeature.plan_id == plan.id,
                    PlanFeature.feature_key == feat_update.feature_key,
                )
            )
            feat = existing.scalar_one_or_none()
            if feat is None:
                session.add(PlanFeature(
                    plan_id=plan.id,
                    feature_key=feat_update.feature_key,
                    limit_value=feat_update.limit_value,
                    is_enabled=feat_update.is_enabled,
                ))
            else:
                feat.limit_value = feat_update.limit_value
                feat.is_enabled = feat_update.is_enabled

    await _audit(session, admin, "plan.update", plan.id, body.model_dump(exclude_unset=True))
    await session.commit()
    await session.refresh(plan)
    await _invalidate_caches()

    return _serialize_plan(plan)


# ═══════════════════════════════════════════════════════════════════════════════
# 📋 POST /api/admin/plans/{plan_id}/duplicate  — variant A/B
# ═══════════════════════════════════════════════════════════════════════════════


@router.post("/plans/{plan_id}/duplicate", status_code=status.HTTP_201_CREATED)
async def admin_duplicate_plan(
    plan_id: int,
    body: PlanDuplicateRequest,
    admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(Plan).where(Plan.id == plan_id))
    src = result.scalar_one_or_none()
    if src is None:
        raise HTTPException(status_code=404, detail="Source plan not found")

    new_slug = body.slug or f"{src.slug}_{body.variant_label.lower()}"
    existing = await session.execute(select(Plan).where(Plan.slug == new_slug))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=409,
            detail=f"Plan with slug '{new_slug}' already exists",
        )

    new_plan = Plan(
        slug=new_slug,
        name=f"{src.name} ({body.variant_label})",
        description=src.description,
        price_monthly_cents=body.price_monthly_cents
            if body.price_monthly_cents is not None else src.price_monthly_cents,
        price_yearly_cents=body.price_yearly_cents
            if body.price_yearly_cents is not None else src.price_yearly_cents,
        yearly_discount_percent=src.yearly_discount_percent,
        is_active=True,
        display_order=src.display_order + 100,  # placer après le contrôle
        highlight_label=src.highlight_label,
        cta_label=src.cta_label,
        trial_days=src.trial_days,
        variant_label=body.variant_label,
        color=src.color,
        icon=src.icon,
        popular=False,
    )
    session.add(new_plan)
    await session.flush()

    # Copier les features
    src_features = await session.execute(
        select(PlanFeature).where(PlanFeature.plan_id == src.id)
    )
    for f in src_features.scalars().all():
        session.add(PlanFeature(
            plan_id=new_plan.id,
            feature_key=f.feature_key,
            limit_value=f.limit_value,
            is_enabled=f.is_enabled,
            feature_metadata=f.feature_metadata,
        ))

    await _audit(
        session, admin, "plan.duplicate", new_plan.id,
        {"source_id": src.id, "variant_label": body.variant_label, "slug": new_slug},
    )
    await session.commit()
    await session.refresh(new_plan)
    await _invalidate_caches()

    return _serialize_plan(new_plan)
```

⚠️ Vérification `AdminLog` : ouvrir `backend/src/db/database.py` ligne 466 pour confirmer le nom des champs (`admin_user_id`, `action`, `target_type`, `target_id`, `details`). Si différent, adapter.

- [ ] **Step 4 : Inclure le router dans `main.py`**

Dans `backend/src/main.py`, après les autres `app.include_router(...)` :

```python
from billing.plan_admin_router import router as plan_admin_router

app.include_router(
    plan_admin_router,
    prefix="/api/admin",
    tags=["admin", "plans"],
)
```

- [ ] **Step 5 : Lancer les tests**

```bash
cd backend && python -m pytest tests/billing/test_plan_admin_router.py -v
```

Expected : 6 tests passent.

⚠️ Si certaines fixtures (`admin_token`, `regular_user_token`, `client`) n'existent pas, elles doivent être ajoutées dans `backend/tests/conftest.py`. Pattern à reproduire depuis un fichier de test admin existant — examiner `backend/tests/admin/` ou utiliser `pytest --fixtures` pour lister celles dispo.

- [ ] **Step 6 : Commit**

```bash
git add backend/src/billing/plan_admin_router.py backend/src/main.py backend/tests/billing/test_plan_admin_router.py
git commit -m "feat(admin): add /api/admin/plans CRUD + A/B duplicate endpoint"
```

---

### Task 9 : Frontend — renommer le statique en fallback + créer hook `useApiPlans`

**Files:**

- Rename : `frontend/src/config/planPrivileges.ts` → `frontend/src/config/planPrivilegesFallback.ts`
- Modify : `frontend/src/config/planPrivileges.ts` (recréer comme façade)
- Create : `frontend/src/hooks/useApiPlans.ts`
- Test : `frontend/src/__tests__/hooks/useApiPlans.test.tsx`

- [ ] **Step 1 : Écrire le test du hook**

Créer `frontend/src/__tests__/hooks/useApiPlans.test.tsx` :

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

import { useApiPlans } from "../../hooks/useApiPlans";
import { billingApi } from "../../services/api";

vi.mock("../../services/api", () => ({
  billingApi: {
    getPlans: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("useApiPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches plans from /api/billing/plans", async () => {
    (billingApi.getPlans as any).mockResolvedValue({
      plans: [
        { id: "free", name: "Gratuit", price_monthly_cents: 0, limits: {} },
        { id: "pro", name: "Pro", price_monthly_cents: 899, limits: {} },
      ],
    });

    const { result } = renderHook(() => useApiPlans("web"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.plans).toHaveLength(2);
    expect(result.current.plans[0].id).toBe("free");
  });

  it("falls back to hardcoded plans on API error", async () => {
    (billingApi.getPlans as any).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useApiPlans("web"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // Le hook expose un `plans` non vide même en erreur
    expect(result.current.plans.length).toBeGreaterThan(0);
    const slugs = result.current.plans.map((p) => p.id);
    expect(slugs).toContain("free");
    expect(slugs).toContain("pro");
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier l'échec**

```bash
cd frontend && npm run test -- useApiPlans --run
```

Expected : `Cannot find module '../../hooks/useApiPlans'`.

- [ ] **Step 3 : Renommer le fichier statique**

```bash
git mv frontend/src/config/planPrivileges.ts frontend/src/config/planPrivilegesFallback.ts
```

- [ ] **Step 4 : Recréer `planPrivileges.ts` comme façade**

Créer `frontend/src/config/planPrivileges.ts` :

```typescript
// Façade : ré-exporte tout le module fallback statique pour garder
// la compat avec les imports existants. Les composants modernes doivent
// préférer le hook ``useApiPlans`` qui fetch /api/billing/plans.
export * from "./planPrivilegesFallback";
export { default } from "./planPrivilegesFallback";
```

- [ ] **Step 5 : Implémenter le hook**

Créer `frontend/src/hooks/useApiPlans.ts` :

```typescript
import { useQuery } from "@tanstack/react-query";
import { billingApi, type ApiBillingPlan } from "../services/api";
import { PLAN_LIMITS, PLANS_INFO, type PlanId } from "../config/planPrivileges";

const STALE_TIME_MS = 5 * 60 * 1000; // 5 min — aligné avec le cache backend

/**
 * Fallback : transforme la grille hardcoded en format API pour ne pas casser
 * l'UI si le backend est down.
 */
function buildFallbackPlans(): ApiBillingPlan[] {
  return (Object.keys(PLAN_LIMITS) as PlanId[]).map((id) => {
    const info = PLANS_INFO[id];
    const limits = PLAN_LIMITS[id];
    return {
      id,
      name: info.name,
      name_en: info.nameEn,
      description: info.description,
      description_en: info.descriptionEn,
      price_monthly_cents: info.priceMonthly,
      color: info.color,
      icon: info.icon,
      badge: info.badge,
      popular: info.popular,
      limits: limits as unknown as Record<string, unknown>,
      platform_features: {},
      features_display: [],
      features_locked: [],
      is_current: false,
      is_upgrade: false,
      is_downgrade: false,
    } as unknown as ApiBillingPlan;
  });
}

/**
 * Hook React Query qui charge la grille de plans depuis l'API.
 *
 * En cas d'échec réseau, le hook expose tout de même `plans` (fallback hardcoded).
 * `isError` reste `true` pour permettre à l'UI d'afficher un toast / banner si elle veut.
 *
 * @param platform — `web` | `mobile` | `extension`. Filtre côté backend.
 * @param variant — Optionnel, pour forcer une variante A/B.
 */
export function useApiPlans(
  platform: "web" | "mobile" | "extension" = "web",
  variant?: string,
) {
  const query = useQuery({
    queryKey: ["billing", "plans", platform, variant ?? "control"],
    queryFn: async () => {
      const data = await billingApi.getPlans(platform);
      return data.plans;
    },
    staleTime: STALE_TIME_MS,
    gcTime: STALE_TIME_MS * 2,
    retry: 1,
  });

  const plans =
    query.data && query.data.length > 0 ? query.data : buildFallbackPlans();

  return {
    plans,
    isLoading: query.isLoading,
    isSuccess: query.isSuccess,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
```

⚠️ Si `billingApi.getPlans` ne supporte pas encore le param `variant`, on l'ajoutera Task 12. Pour l'instant le hook ne le passe pas au backend.

- [ ] **Step 6 : Lancer les tests**

```bash
cd frontend && npm run test -- useApiPlans --run
```

Expected : 2 tests passent.

- [ ] **Step 7 : Vérifier que le typecheck passe (les imports existants ne sont pas cassés par le rename)**

```bash
cd frontend && npm run typecheck
```

Expected : pas de nouvelle erreur (les erreurs pré-existantes hors scope sont OK).

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/config/planPrivileges.ts frontend/src/config/planPrivilegesFallback.ts frontend/src/hooks/useApiPlans.ts frontend/src/__tests__/hooks/useApiPlans.test.tsx
git commit -m "feat(frontend): add useApiPlans hook + rename static config to fallback"
```

---

### Task 10 : Migration `RUN_MIGRATIONS=true` + seed sur Hetzner (deploy)

**Files:**

- Modify : `backend/scripts/seed_plans_db.py` (ajout d'un mode "boot" optionnel)
- Modify : `deploy/hetzner/entrypoint.sh` (vérifier la présence de la commande seed)

- [ ] **Step 1 : Vérifier l'entrypoint actuel**

```bash
cat deploy/hetzner/entrypoint.sh
```

Lire et comprendre le flow actuel — comment `RUN_MIGRATIONS=true` est géré (Memory note : "Migrations auto via entrypoint.sh + RUN_MIGRATIONS=true depuis PR #189").

- [ ] **Step 2 : Ajouter une étape seed conditionnelle**

Modifier `deploy/hetzner/entrypoint.sh` — ajouter après l'étape `alembic upgrade head` :

```bash
# Seed les plans v2 (idempotent — UPSERT par slug)
if [ "$SEED_PLANS_ON_BOOT" = "true" ]; then
  echo "[entrypoint] Running seed_plans_db (idempotent UPSERT)..."
  python -m scripts.seed_plans_db || echo "[entrypoint] seed_plans_db failed (non-blocking)"
fi
```

⚠️ Ne pas activer `SEED_PLANS_ON_BOOT=true` en permanence — l'utiliser une seule fois après le merge, puis le retirer pour ne plus écraser les modifs admin.

- [ ] **Step 3 : Documenter la procédure de déploiement**

Créer `deploy/hetzner/PLANS_DB_DEPLOY.md` :

````markdown
# Déploiement DB-driven plans

## Première mise en prod (one-shot)

1. Le merge de la branche déclenche le webhook Hetzner → `docker run` avec
   `RUN_MIGRATIONS=true` → la migration `0XX_add_plans_tables` est appliquée.
2. **Avant** le restart final, ajouter `SEED_PLANS_ON_BOOT=true` dans le
   `.env.production` côté Hetzner :
   ```bash
   ssh root@89.167.23.214 "echo 'SEED_PLANS_ON_BOOT=true' >> /opt/deepsight/repo/.env.production"
   ```
````

3. Restart le container backend pour exécuter le seed.
4. **Retirer** `SEED_PLANS_ON_BOOT=true` immédiatement après pour ne plus
   écraser les modifs admin :
   ```bash
   ssh root@89.167.23.214 "sed -i '/^SEED_PLANS_ON_BOOT=/d' /opt/deepsight/repo/.env.production"
   ```
5. Vérifier : `curl https://api.deepsightsynthesis.com/api/billing/plans?platform=web`
   doit retourner les 3 plans v2.

## Édition admin sans deploy

```bash
curl -X PUT https://api.deepsightsynthesis.com/api/admin/plans/2 \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"price_monthly_cents": 999}'
```

Le cache Redis est invalidé automatiquement (TTL 5 min sinon).

````

- [ ] **Step 4 : Commit**

```bash
git add deploy/hetzner/entrypoint.sh deploy/hetzner/PLANS_DB_DEPLOY.md
git commit -m "chore(deploy): add SEED_PLANS_ON_BOOT step + deploy doc"
````

---

### Task 11 : Tests E2E intégration (zero downtime + cache invalidation)

**Files:**

- Create : `backend/tests/billing/test_plans_e2e_integration.py`

- [ ] **Step 1 : Écrire le test E2E**

Créer `backend/tests/billing/test_plans_e2e_integration.py` :

```python
"""Test E2E : seed → query → admin update → cache invalidation → query.

Simule le scénario réel d'un admin qui change un prix Pro entre deux requêtes
publiques. Vérifie que la 2e requête voit la nouvelle valeur (cache invalidé).
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from scripts.seed_plans_db import seed_plans


@pytest.mark.asyncio
async def test_full_flow_seed_query_update_cache_invalidation(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    # 1. Seed
    await seed_plans(db_session)
    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()

    # 2. Public query (warming le cache)
    r1 = await client.get("/api/billing/plans?platform=web")
    assert r1.status_code == 200
    pro_v1 = next(p for p in r1.json()["plans"] if p["id"] == "pro")
    assert pro_v1["price_monthly_cents"] == 899

    # 3. Admin update price
    from db.database import Plan
    from sqlalchemy import select
    pro = (await db_session.execute(select(Plan).where(Plan.slug == "pro"))).scalar_one()

    update = await client.put(
        f"/api/admin/plans/{pro.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"price_monthly_cents": 1099},
    )
    assert update.status_code == 200

    # 4. Public query immediately after — must see new value (cache invalidated)
    r2 = await client.get("/api/billing/plans?platform=web")
    pro_v2 = next(p for p in r2.json()["plans"] if p["id"] == "pro")
    assert pro_v2["price_monthly_cents"] == 1099


@pytest.mark.asyncio
async def test_zero_downtime_during_update(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_token: str,
):
    """Pendant qu'un admin update, les lectures publiques ne doivent jamais
    retourner 5xx. Au pire, elles voient l'ancienne valeur (cache stale)."""
    import asyncio

    await seed_plans(db_session)
    from core.plan_limits import refresh_plan_cache
    await refresh_plan_cache()

    from db.database import Plan
    from sqlalchemy import select
    pro = (await db_session.execute(select(Plan).where(Plan.slug == "pro"))).scalar_one()

    async def reader():
        results = []
        for _ in range(10):
            r = await client.get("/api/billing/plans?platform=web")
            results.append(r.status_code)
            await asyncio.sleep(0.05)
        return results

    async def writer():
        await asyncio.sleep(0.1)
        return await client.put(
            f"/api/admin/plans/{pro.id}",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"price_monthly_cents": 1099},
        )

    reads, write = await asyncio.gather(reader(), writer())
    assert all(r == 200 for r in reads), f"Status codes: {reads}"
    assert write.status_code == 200
```

- [ ] **Step 2 : Lancer le test**

```bash
cd backend && python -m pytest tests/billing/test_plans_e2e_integration.py -v
```

Expected : 2 tests passent.

- [ ] **Step 3 : Commit**

```bash
git add backend/tests/billing/test_plans_e2e_integration.py
git commit -m "test(billing): add E2E integration test for seed + admin update + cache flow"
```

---

### Task 12 : Frontend — utiliser `useApiPlans` dans la page Pricing/Upgrade

**Files:**

- Modify : `frontend/src/services/api.ts` (ajouter `variant` au signature de `getPlans`)
- Modify : la page Pricing/Upgrade existante (à identifier)
- Test : pas de nouveau test (tests d'intégration UI hors scope ici)

- [ ] **Step 1 : Identifier la page Pricing**

```bash
cd frontend && grep -rn "billingApi.getPlans\|getPlans(" src/pages/
```

Noter le ou les fichiers qui consomment l'endpoint actuel. Souvent : `frontend/src/pages/UpgradePage.tsx` ou `frontend/src/pages/PricingPage.tsx`.

- [ ] **Step 2 : Ajouter le param `variant` à `billingApi.getPlans`**

Modifier `frontend/src/services/api.ts` (ligne ~1820) :

```typescript
async getPlans(
  platform: string = "web",
  variant?: string,
): Promise<{ plans: ApiBillingPlan[] }> {
  const query = new URLSearchParams({ platform });
  if (variant) query.set("variant", variant);
  return request(`/api/billing/plans?${query.toString()}`);
},
```

Et propager au hook :

```typescript
// dans useApiPlans.ts
queryFn: async () => {
  const data = await billingApi.getPlans(platform, variant);
  return data.plans;
},
```

- [ ] **Step 3 : Migrer un caller (preuve de concept)**

Dans la page Pricing identifiée, remplacer l'appel direct :

```typescript
// Avant
const [plans, setPlans] = useState<ApiBillingPlan[]>([]);
useEffect(() => {
  billingApi.getPlans("web").then((data) => setPlans(data.plans));
}, []);

// Après
import { useApiPlans } from "../hooks/useApiPlans";
const { plans, isLoading } = useApiPlans("web");
```

⚠️ Garder l'UI fonctionnelle — ne pas refactor la page entièrement, juste remplacer la source des plans.

- [ ] **Step 4 : Vérifier en local**

```bash
cd frontend && npm run dev
```

Ouvrir la page Pricing dans le browser et vérifier visuellement que les 3 plans s'affichent.

- [ ] **Step 5 : Lancer les tests**

```bash
cd frontend && npm run test --run
cd frontend && npm run typecheck
```

Expected : pas de régression.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/services/api.ts frontend/src/hooks/useApiPlans.ts frontend/src/pages/<PricingPage>.tsx
git commit -m "feat(frontend): wire useApiPlans on PricingPage + variant param support"
```

---

### Task 13 (OPTIONNELLE — Phase 2) : Page admin minimale d'édition

> **À discuter avant exécution** : voir Self-Review. Cette task peut être déferrée
> à un follow-up PR si le scope du PR principal est déjà large.

**Files:**

- Create : `frontend/src/pages/AdminPlansPage.tsx`
- Modify : `frontend/src/services/api.ts` (ajouter `adminApi.listPlans`, `updatePlan`, `duplicatePlan`)

- [ ] **Step 1 : Ajouter les méthodes admin au client API**

Dans `frontend/src/services/api.ts`, créer un nouveau bloc `adminApi` :

```typescript
export const adminApi = {
  async listPlans(): Promise<{ plans: ApiBillingPlan[] }> {
    return request("/api/admin/plans");
  },
  async updatePlan(
    id: number,
    body: Partial<ApiBillingPlan> & {
      features?: Array<{
        feature_key: string;
        limit_value: number | null;
        is_enabled: boolean;
      }>;
    },
  ): Promise<ApiBillingPlan> {
    return request(`/api/admin/plans/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  async duplicatePlan(
    id: number,
    body: {
      variant_label: string;
      slug?: string;
      price_monthly_cents?: number;
      price_yearly_cents?: number;
    },
  ): Promise<ApiBillingPlan> {
    return request(`/api/admin/plans/${id}/duplicate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
```

(Adapter à la structure exacte de `request()` existant — ne pas casser le pattern fetch).

- [ ] **Step 2 : Implémenter une page minimale**

Créer `frontend/src/pages/AdminPlansPage.tsx` — table des plans avec édition inline du prix uniquement (le reste sera Phase 3 si besoin) :

```tsx
import { useState, useEffect } from "react";
import { adminApi } from "../services/api";
import type { ApiBillingPlan } from "../services/api";

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<ApiBillingPlan[]>([]);
  const [editing, setEditing] = useState<{ id: number; price: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi.listPlans().then((d) => setPlans(d.plans));
  }, []);

  const save = async () => {
    if (!editing) return;
    setLoading(true);
    try {
      await adminApi.updatePlan(editing.id, {
        price_monthly_cents: editing.price,
      });
      const refreshed = await adminApi.listPlans();
      setPlans(refreshed.plans);
      setEditing(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin · Plans</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-2">Slug</th>
            <th className="text-left p-2">Name</th>
            <th className="text-right p-2">Price (€/mo)</th>
            <th className="text-left p-2">Variant</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={(p as any).id} className="border-b border-white/5">
              <td className="p-2 font-mono">{p.id}</td>
              <td className="p-2">{p.name}</td>
              <td className="p-2 text-right">
                {editing?.id === (p as any).id ? (
                  <input
                    type="number"
                    value={editing.price}
                    onChange={(e) =>
                      setEditing({
                        id: editing.id,
                        price: parseInt(e.target.value, 10),
                      })
                    }
                    className="bg-white/10 px-2 py-1 rounded w-24 text-right"
                  />
                ) : (
                  (p.price_monthly_cents / 100).toFixed(2)
                )}
              </td>
              <td className="p-2 text-xs">
                {(p as any).variant_label || "control"}
              </td>
              <td className="p-2 text-center">
                {editing?.id === (p as any).id ? (
                  <>
                    <button
                      onClick={save}
                      disabled={loading}
                      className="text-emerald-400 mr-2"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-zinc-400"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() =>
                      setEditing({
                        id: (p as any).id,
                        price: p.price_monthly_cents,
                      })
                    }
                    className="text-indigo-400"
                  >
                    Edit
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3 : Enregistrer la route**

Dans le router principal du frontend (`App.tsx` ou équivalent), ajouter une route protégée admin :

```typescript
<Route path="/admin/plans" element={<RequireAdmin><AdminPlansPage /></RequireAdmin>} />
```

(Pattern : reproduire la protection des autres routes admin existantes — examiner `frontend/src/pages/AdminDashboard.tsx` ou similaire).

- [ ] **Step 4 : Test manuel**

Login en tant qu'admin, naviguer `/admin/plans`, modifier un prix, vérifier que l'API publique reflète le change.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/services/api.ts frontend/src/pages/AdminPlansPage.tsx frontend/src/App.tsx
git commit -m "feat(admin-ui): add minimal /admin/plans page for inline price editing"
```

---

### Task 14 (OPTIONNELLE — Phase 2) : Documentation runbook + ADR

**Files:**

- Create : `docs/architecture/ADR-2026-04-29-plans-db-driven.md`
- Update : `backend/CLAUDE.md` (mention rapide du nouveau pattern)

- [ ] **Step 1 : Créer l'ADR**

Créer `docs/architecture/ADR-2026-04-29-plans-db-driven.md` :

```markdown
# ADR — Plans DB-Driven

**Date** : 2026-04-29
**Status** : Accepted
**Context** : Issue #N — A/B testing pricing impossible avec config hardcoded

## Decision

Migrer `PLANS` de `plan_config.py` vers tables PostgreSQL `plans` + `plan_features`.
Cache Redis 5 min, fallback hardcoded si DB injoignable.

## Consequences

### Positives

- A/B testing pricing sans deploy (variant_label)
- Édition admin live (PUT /api/admin/plans/{id})
- Audit trail via AdminLog

### Négatives

- Latence ajoutée (cache miss = 1 query DB)
- Complexité : 2 sources potentielles (DB vs fallback)
- Risque divergence DB vs `seed_plans_db.py` si on oublie de re-seed après modif code

## Alternatives Considered

1. **PostHog feature flags** seul : non, on veut audit + rollback côté DB
2. **JSON file en DB** : moins flexible pour A/B
3. **Redis storage** : pas durable, on perd l'audit
```

- [ ] **Step 2 : Mention dans `backend/CLAUDE.md`**

Ajouter une ligne dans la section "Feature gating" :

```markdown
**NEW (avril 2026)** : Les plans sont DB-driven. `PLAN_LIMITS` en mémoire est
maintenant un wrapper sync alimenté par `core/plan_limits.refresh_plan_cache()`
au boot. Pour modifier un plan en prod : `PUT /api/admin/plans/{id}`.
```

- [ ] **Step 3 : Commit**

```bash
git add docs/architecture/ADR-2026-04-29-plans-db-driven.md backend/CLAUDE.md
git commit -m "docs: add ADR for DB-driven plans + update backend CLAUDE.md"
```

---

## Self-Review

### 1. Spec coverage check

| Spec requirement                                      | Task                                          |
| ----------------------------------------------------- | --------------------------------------------- |
| Tables `plans` + `plan_features` SQLAlchemy           | Task 1                                        |
| Migration Alembic (numéro à déterminer dynamiquement) | Task 2 (cf. Step 3 Task 0)                    |
| Seed script idempotent UPSERT par slug                | Task 3                                        |
| Service `PlanRegistry` avec cache Redis 5 min         | Task 4                                        |
| Fallback hardcoded si DB injoignable                  | Task 4 (FALLBACK_PLANS)                       |
| `plan_config.py` API publique inchangée               | Task 5 + Task 6 (wrapper sync)                |
| Frontend hook `useApiPlans` TanStack Query 5 min      | Task 9                                        |
| Build-time fallback statique conservé                 | Task 9 (planPrivilegesFallback.ts)            |
| Endpoint `GET /api/billing/plans` migré               | Task 7                                        |
| Endpoints admin GET/PUT/POST duplicate                | Task 8                                        |
| Cache invalidation à chaque PUT admin                 | Task 8 (`_invalidate_caches`)                 |
| Audit log AdminLog                                    | Task 8 (`_audit`)                             |
| Sécurité admin (`get_current_admin`)                  | Task 8 (Depends)                              |
| Tests pytest backend (seed→query→update→cache)        | Task 11 (E2E)                                 |
| Tests Vitest frontend (mock + erreur fallback)        | Task 9                                        |
| Zero downtime garanti                                 | Task 11 (test_zero_downtime_during_update)    |
| Dépendance #3 explicite                               | Header + Task 0                               |
| Reprend la grille v2 (free/pro 8.99/expert 19.99)     | Task 3 (PLANS_SEED) + Task 4 (FALLBACK_PLANS) |

✅ Tout couvert.

### 2. Placeholder scan

- Pas de "TBD"/"TODO" dans les blocs de code.
- Tasks 13 et 14 sont marquées **OPTIONNELLES** explicitement, ce n'est pas un placeholder mais une décision de scope.
- Le numéro `0XX` de la migration est explicitement noté comme "à remplacer par le numéro réel" en Task 0 Step 3 — c'est une instruction explicite, pas un placeholder caché.

✅ Pas de placeholder caché.

### 3. Type consistency

- `Plan` et `PlanFeature` modèles sont définis Task 1, utilisés cohéremment Task 2 (migration), Task 3 (seed), Task 4 (registry), Task 8 (admin router).
- `_serialize_plan` est défini Task 4, importé/réutilisé Task 8.
- `FALLBACK_PLANS` défini Task 4, réutilisé Task 6 (`refresh_plan_cache`).
- `useApiPlans` hook signature `(platform, variant?)` cohérente entre Task 9 (création) et Task 12 (utilisation).
- L'attribut Python `feature_metadata` (vs colonne SQL `metadata`) est noté en Task 1 et réutilisé en Task 8 (`f.feature_metadata`).

✅ Cohérent.

### 4. Décisions à confirmer avec l'utilisateur AVANT exécution

Trois questions matérielles avant de lancer les Tasks :

**Q1 — Admin UI dans ce plan ou Phase 2 ?**
Tasks 13 et 14 sont marquées OPTIONNELLES. La création/duplication/désactivation d'un plan via API curl marche déjà après Task 8. Recommandation : démarrer sans Task 13-14 et planifier une PR follow-up "admin-plans-ui" séparée pour limiter le diff. À confirmer.

**Q2 — Routing A/B : feature flag PostHog côté frontend OU param `variant` côté backend ?**
Le plan implémente le param backend (Task 7 — `?variant=B`). Pour le routage _quel user voit quelle variante_, deux options :

- **(a) Frontend décide via PostHog** (`useFeatureFlag('pricing_variant')` → call `useApiPlans('web', flag)`). Simple, pas de cookie côté backend, mais le user voit la variante sélectionnée par PostHog.
- **(b) Backend décide via session/user_id hash** : `/api/billing/plans` retourne automatiquement la variante assignée. Plus stable (pas de flicker au reload) mais nécessite logique côté plan_admin_router.
  Recommandation : (a) PostHog — déjà installé côté frontend (cf. memory `posthog-events-complets`), zéro infra backend.
  À confirmer.

**Q3 — Grandfathering des users existants vs `variant_label` ?**
Le plan #3 introduit déjà un champ users grandfathering (price legacy). Ici, si un user est sur `pro` (variante de contrôle) et qu'on crée `pro_b` à 7.99, le user ne migre PAS automatiquement. Ses webhooks Stripe restent sur le price_id de `pro` (contrôle). Si plus tard l'admin déprécie `pro` au profit de `pro_b`, il faut une logique de migration.
Recommandation : ignorer dans ce plan — le grandfathering est géré par #3 sur un autre axe (`users.grandfathered_price`). Les variants A/B sont uniquement des leviers d'acquisition, pas de migration en masse.
À confirmer.

### 5. Risques techniques

- **Risque 1 : `init_stripe_prices()` neutralisé**. Tout caller qui appelle cette fonction au runtime (même rare) s'attend à ce que les Stripe price IDs soient peuplés. Solution : Task 5 garde la fonction mais ne fait que log. Les Stripe IDs doivent être seed-és via env var → admin endpoint, ou directement dans le SQL d'init. **Prévoir un seed initial des Stripe price IDs dans `seed_plans_db.py`** lisant les env vars `STRIPE_PRICE_PRO_LIVE` etc. Si l'utilisateur confirme, ajouter ce comportement à Task 3.
- **Risque 2 : double cache (Redis registry + sync local)**. Si l'invalidation du sync local échoue silencieusement (e.g. boot vide), un caller sync peut voir des stale data. Mitigation : Task 6 fait `refresh_plan_cache` au boot ET à chaque mutation admin. Test E2E Task 11 couvre le scénario.
- **Risque 3 : performance N+1 sur `Plan.features`**. Mitigé par `lazy="selectin"` (Task 1). Test : la query dans `_load_from_db` doit faire 2 requêtes SQL (1 plans + 1 features), pas N+1.

---

## Execution Handoff

**Plan complet et sauvegardé. Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Je dispatch un subagent frais par task, review entre chaque task, itération rapide.

**2. Inline Execution** — Exécution batch dans cette session avec checkpoints.

**Avant l'exécution, attendre la réponse aux 3 questions de la Self-Review (Q1 admin UI, Q2 routage A/B, Q3 grandfathering) pour ne pas fragmenter le travail.**

**Quelle approche ?**
