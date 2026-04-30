# Pricing v2 — Stripe + Grandfathering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer la grille pricing v0 (Free / Plus 4,99 € / Pro 9,99 €) vers la grille v2 (Free / Pro 8,99 € / Expert 19,99 €) avec toggle mensuel/annuel −17 %, trial 7 j sans CB pour Pro et Expert, et grandfathering des abonnés existants au prix legacy.

**Architecture:** Migration Alembic 011 atomique (CASE SQL pour le rename `plus`→`pro` et `pro`→`expert`) + ajout colonne `users.is_legacy_pricing` pour figer le prix Stripe legacy des abonnés actuels. Backend hardcoded SSOT dans `plan_config.py` (8 helpers + lookups Stripe par couple `(plan, cycle)`). Frontend miroir dans `planPrivileges.ts` + nouveaux composants `BillingToggle` et `ComparisonTable` sur `UpgradePage` v9. 4 nouveaux Stripe Prices créés via script idempotent. Grille v2 reste hardcodée — la transition vers DB-driven est traitée par le plan séparé `2026-04-29-plans-db-driven.md`.

**Tech Stack:** Python 3.11 + FastAPI + SQLAlchemy async + Alembic + Stripe SDK ; React 18 + TypeScript strict + Vite + Tailwind ; pytest-asyncio + Vitest + Testing Library.

---

## Contexte préalable

### Etat v0 actuel (à migrer)

Le code backend + frontend est sur **grille v0**, PAS sur la grille marketing v1 affichée dans `CLAUDE.md`. Voici ce que disent les fichiers :

- `backend/src/billing/plan_config.py:22-25` : `PlanId.FREE | PLUS | PRO`
- `backend/src/billing/plan_config.py:36-44` : `PLAN_ALIASES = {"etudiant": "plus", "starter": "plus", "expert": "pro", "team": "pro", ...}` (à inverser)
- `backend/src/core/config.py:91-94` : `STRIPE_PRICE_PLUS_TEST/LIVE`, `STRIPE_PRICE_PRO_TEST/LIVE` (4 vars uniquement, mensuel)
- `backend/src/billing/router.py:226-277` : `/trial-eligibility` retourne `trial_plan="plus"` hardcodé
- `backend/src/billing/router.py:280-348` : `POST /start-pro-trial` (route fixe sur Plus, malgré son nom — bug v0)
- `backend/src/billing/voice_quota.py:37-44` : `TOP_TIER_MONTHLY_MINUTES = 30.0` hardcodé
- `frontend/src/config/planPrivileges.ts:8-10` : `PlanId = "free" | "plus" | "pro"`
- `frontend/src/pages/UpgradePage.tsx` (header doc) : "Pricing 3 plans (Free / Plus / Pro). Facturation mensuelle uniquement"

### Grilles distinguées

| Grille                 | Free | Tier intermédiaire                      | Tier premium                                 | Cycles           |
| ---------------------- | ---- | --------------------------------------- | -------------------------------------------- | ---------------- |
| **v0 (code actuel)**   | 0 €  | Plus 4,99 €/mo                          | Pro 9,99 €/mo                                | mensuel          |
| **v2 (cible ce plan)** | 0 €  | **Pro 8,99 €/mo** ou 89,90 €/an (-17 %) | **Expert 19,99 €/mo** ou 199,90 €/an (-17 %) | mensuel + annuel |

### Mapping de migration

```
old "free"  → new "free"   (no change)
old "plus"  → new "pro"    (4.99 € → 8.99 € ; legacy users grandfathered to old Stripe price 4.99)
old "pro"   → new "expert" (9.99 € → 19.99 € ; legacy users grandfathered to old 9.99)
```

⚠️ **Migration Alembic 011** doit faire le rename atomiquement avec CASE SQL pour éviter le double-mapping (sans CASE, un `UPDATE plan='pro' WHERE plan='plus'` suivi d'un `UPDATE plan='expert' WHERE plan='pro'` transformerait les anciens Plus en Expert).

### Décisions business locked (post-audit Kimi 2026-04-29)

| #   | Décision                                                                                                                                    | Source      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| H1  | Pro = 8,99 €/mo, 89,90 €/an (−17 %) ≈ 7,49 €/mo équivalent                                                                                  | Q1 Option B |
| H2  | Expert = 19,99 €/mo, 199,90 €/an (−17 %) ≈ 16,66 €/mo équivalent                                                                            | Q1 Option B |
| H3  | Grandfathering : tout user `stripe_subscription_id != NULL` à la migration garde son prix Stripe legacy. Reset si downgrade puis re-upgrade | Q1 + DB     |
| H4  | Allowance ElevenLabs : Pro 30 min/mois, Expert 120 min/mois                                                                                 | Q4 + DC     |
| H5  | Trial 7 j sans CB, accessible 1 fois par user, applicable Pro **ou** Expert                                                                 | Q1 + DD     |
| H6  | 4 Stripe Prices créés dès la PR (mensuel + annuel × Pro + Expert)                                                                           | DA          |
| H7  | `is_legacy_pricing` colonne sur `User` (pas table Subscription qui n'existe pas)                                                            | DB révisé   |
| H8  | Plans restent hardcodés (`plan_config.py` + `planPrivileges.ts`) — DB-driven plan séparé                                                    | Q2 reportée |

### Couplage release-train (CRITIQUE)

Ce plan **doit merger ENSEMBLE** avec `2026-04-29-audit-kimi-phase-0-seo-securite.md` (à venir batch 2) sur branche commune `release/pricing-v2`. Sinon : SEO annonce 8,99 € pendant Stripe facture 5,99 € (incohérence marketing/billing).

Couplage en aval :

- `2026-04-29-plans-db-driven.md` est `BLOCKED-BY` ce plan (il déplacera `PLANS` du code vers la DB ; ne peut pas commencer avant que `pro`/`expert` soient les noms canoniques).
- `2026-04-29-elevenlabs-voice-packs.md` (Alembic 010) est INDÉPENDANT — ne touche pas pricing, peut merger en parallèle dans `release/pricing-v2` si besoin.

---

## File Structure

| Fichier                                                              | Action | Responsabilité                                                                                                                                                                                                         |
| -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/alembic/versions/011_pricing_v2_rename.py`                  | Create | Ajoute `users.is_legacy_pricing` + UPDATE atomique CASE rename + backfill grandfathering pour subs actifs                                                                                                              |
| `backend/src/db/database.py`                                         | Modify | Colonne `User.is_legacy_pricing: Boolean`                                                                                                                                                                              |
| `backend/src/billing/plan_config.py`                                 | Modify | Refactor `PlanId` → `FREE/PRO/EXPERT` + `PLAN_ALIASES` inversés (`plus`→`pro`, ancien-`pro`→`expert`) + clés `PLANS` renommées + helpers `get_price_id(plan, cycle)`, `get_voice_minutes(plan)`, dict `PLAN_PRICES_V2` |
| `backend/src/core/config.py`                                         | Modify | 8 nouvelles env vars Stripe v2 (Pro/Expert × monthly/yearly × test/live). Conserver `STRIPE_PRICE_PLUS_*` et `STRIPE_PRICE_PRO_*` pour grandfathering                                                                  |
| `backend/src/billing/router.py`                                      | Modify | `/trial-eligibility?plan=pro\|expert`, `POST /start-trial` (param plan), redirection legacy `/start-pro-trial`, `/plans` retourne grille v2 + cycles, `POST /create-checkout` accepte `cycle=monthly\|yearly`          |
| `backend/src/billing/voice_quota.py`                                 | Modify | Replace constant `TOP_TIER_MONTHLY_MINUTES` par lookup `get_voice_minutes(user.plan)` (Pro 30, Expert 120) ; conserver l'alias `EXPERT_MONTHLY_MINUTES` pour rétro-compat tests existants                              |
| `backend/scripts/seed_stripe_prices_v2.py`                           | Create | Idempotent — crée 4 Stripe Products + 4 Prices via lookup_key, output Price IDs à coller en `.env.production`                                                                                                          |
| `backend/tests/billing/test_pricing_v2.py`                           | Create | pytest : migration rename, alias resolution, voice minutes par plan, trial pour Pro/Expert, grandfathering flag, prices par cycle                                                                                      |
| `frontend/src/config/planPrivileges.ts`                              | Modify | Refactor `PlanId = "free"\|"pro"\|"expert"` + clés `PLAN_LIMITS`/`PLAN_FEATURES`/`PLANS_INFO` renommées + voice minutes Pro 30 / Expert 120 + aliases v0→v2 inversés                                                   |
| `frontend/src/services/api.ts`                                       | Modify | Types `BillingCycle`, `ApiBillingPlan` + méthodes `billingApi.startTrial(plan)`, `createCheckout(plan, cycle)`, `checkTrialEligibility(plan)`                                                                          |
| `frontend/src/pages/UpgradePage.tsx`                                 | Modify | Refonte v9 : intégration `BillingToggle` + `ComparisonTable` + 2 CTAs trial (Pro + Expert)                                                                                                                             |
| `frontend/src/components/pricing/BillingToggle.tsx`                  | Create | Switch mensuel/annuel + badge "−17 %" / "2 mois offerts"                                                                                                                                                               |
| `frontend/src/components/pricing/ComparisonTable.tsx`                | Create | Tableau matrice features × plans avec check / cross / valeurs numériques                                                                                                                                               |
| `frontend/src/components/pricing/__tests__/BillingToggle.test.tsx`   | Create | Vitest : rendu, interactions, switch state, prix affichés                                                                                                                                                              |
| `frontend/src/components/pricing/__tests__/ComparisonTable.test.tsx` | Create | Vitest : rendu features par plan, valeurs voice minutes, badges populaire                                                                                                                                              |

---

## Tasks

### Task 1: Migration Alembic 011 — rename atomique + colonne is_legacy_pricing

**Files:**

- Create: `backend/alembic/versions/011_pricing_v2_rename.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (création initiale, ajouter le test ci-dessous)

- [ ] **Step 1: Écrire le test pytest qui vérifie le rename atomique et le backfill is_legacy_pricing**

Créer `backend/tests/billing/test_pricing_v2.py` avec ce test :

```python
"""Tests pour la migration Pricing v2 (Alembic 011)."""

import pytest
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import User


@pytest.mark.asyncio
async def test_migration_011_rename_plans_atomic(db_session: AsyncSession):
    """La migration doit renommer plus→pro et ancien-pro→expert sans collision.

    Cas piège : un UPDATE séquentiel (plus→pro puis pro→expert) transformerait
    les anciens Plus en Expert. La migration utilise CASE pour éviter cela.
    """
    # Setup : 1 user "plus" + 1 user "pro" pré-migration (état v0)
    u_plus = User(
        username="alice", email="alice@test.fr", password_hash="x", plan="plus",
        stripe_subscription_id="sub_legacy_plus_001",
    )
    u_pro = User(
        username="bob", email="bob@test.fr", password_hash="x", plan="pro",
        stripe_subscription_id="sub_legacy_pro_001",
    )
    u_free = User(username="carol", email="carol@test.fr", password_hash="x", plan="free")
    db_session.add_all([u_plus, u_pro, u_free])
    await db_session.commit()

    # Exécuter le rename CASE (simule l'upgrade migration)
    await db_session.execute(text(
        "UPDATE users SET plan = CASE "
        "WHEN plan = 'pro' THEN 'expert' "
        "WHEN plan = 'plus' THEN 'pro' "
        "ELSE plan END "
        "WHERE plan IN ('plus', 'pro')"
    ))
    await db_session.commit()

    # Verify : Alice (plus → pro), Bob (pro → expert), Carol inchangée
    res = await db_session.execute(select(User).order_by(User.id))
    users = res.scalars().all()
    assert users[0].plan == "pro", f"alice should be pro, got {users[0].plan}"
    assert users[1].plan == "expert", f"bob should be expert, got {users[1].plan}"
    assert users[2].plan == "free"


@pytest.mark.asyncio
async def test_migration_011_backfill_is_legacy_pricing(db_session: AsyncSession):
    """Tout user avec stripe_subscription_id non null doit avoir is_legacy_pricing=True
    après le backfill de la migration."""
    u_paid = User(
        username="dave", email="dave@test.fr", password_hash="x", plan="pro",
        stripe_subscription_id="sub_legacy_pro_002",
        is_legacy_pricing=False,
    )
    u_free = User(
        username="eve", email="eve@test.fr", password_hash="x", plan="free",
        stripe_subscription_id=None,
        is_legacy_pricing=False,
    )
    db_session.add_all([u_paid, u_free])
    await db_session.commit()

    # Backfill : tout sub actif → is_legacy_pricing=True
    await db_session.execute(text(
        "UPDATE users SET is_legacy_pricing = TRUE "
        "WHERE stripe_subscription_id IS NOT NULL"
    ))
    await db_session.commit()

    res = await db_session.execute(select(User).order_by(User.id))
    users = res.scalars().all()
    assert users[0].is_legacy_pricing is True, "dave (paid) should be legacy"
    assert users[1].is_legacy_pricing is False, "eve (free) should NOT be legacy"
```

- [ ] **Step 2: Run le test, vérifier qu'il échoue (colonne is_legacy_pricing absente, fixture db_session existante)**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v`
Expected : FAIL avec `AttributeError: 'User' object has no attribute 'is_legacy_pricing'` ou `OperationalError: no such column users.is_legacy_pricing`

- [ ] **Step 3: Écrire le fichier de migration 011**

Créer `backend/alembic/versions/011_pricing_v2_rename.py` :

```python
"""Pricing v2 — atomic plan rename (plus→pro, pro→expert) + grandfathering flag.

Revision ID: 011_pricing_v2_rename
Revises: 010_add_conversation_digests
Create Date: 2026-04-29

Migrations:
  1. Add ``users.is_legacy_pricing`` BOOLEAN NOT NULL DEFAULT FALSE.
  2. ATOMIC rename via CASE SQL :
       plus  → pro
       pro   → expert
     (sans CASE, un UPDATE séquentiel ferait passer les anciens Plus en Expert)
  3. Backfill grandfathering : tout user avec stripe_subscription_id non null
     conserve son prix Stripe legacy → is_legacy_pricing = TRUE.

Downgrade : reverse rename (pro→plus, expert→pro) + drop colonne.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "011_pricing_v2_rename"
down_revision: Union[str, None] = "010_add_conversation_digests"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Colonne grandfathering
    op.add_column(
        "users",
        sa.Column(
            "is_legacy_pricing",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # 2. Rename atomique CASE
    op.execute(
        "UPDATE users SET plan = CASE "
        "WHEN plan = 'pro' THEN 'expert' "
        "WHEN plan = 'plus' THEN 'pro' "
        "ELSE plan END "
        "WHERE plan IN ('plus', 'pro')"
    )

    # 3. Backfill grandfathering : subs actifs au moment de la migration
    op.execute(
        "UPDATE users SET is_legacy_pricing = TRUE "
        "WHERE stripe_subscription_id IS NOT NULL"
    )


def downgrade() -> None:
    # Reverse rename (expert→pro, pro→plus)
    op.execute(
        "UPDATE users SET plan = CASE "
        "WHEN plan = 'expert' THEN 'pro' "
        "WHEN plan = 'pro' THEN 'plus' "
        "ELSE plan END "
        "WHERE plan IN ('pro', 'expert')"
    )
    op.drop_column("users", "is_legacy_pricing")
```

- [ ] **Step 4: Ajouter `is_legacy_pricing` au model User**

Modifier `backend/src/db/database.py` autour de la ligne 134 (après `stripe_subscription_id`) :

```python
    # Stripe
    stripe_customer_id = Column(String(100))
    stripe_subscription_id = Column(String(100))
    # Pricing v2 — grandfathering: True = sub créé sous prix legacy (Plus 4.99 / Pro 9.99)
    is_legacy_pricing = Column(Boolean, default=False, nullable=False, server_default="false")
```

- [ ] **Step 5: Appliquer la migration en dev SQLite**

Run : `cd backend && alembic upgrade head`
Expected : `INFO  [alembic.runtime.migration] Running upgrade 010_add_conversation_digests -> 011_pricing_v2_rename`

- [ ] **Step 6: Run les tests, vérifier qu'ils passent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v`
Expected : 2 passed

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/011_pricing_v2_rename.py backend/src/db/database.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(billing): add Alembic 011 atomic plan rename + is_legacy_pricing flag"
```

---

### Task 2: Refactor plan_config.py — SSOT v2 (PlanId, aliases inverses, helpers)

**Files:**

- Modify: `backend/src/billing/plan_config.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (étendre le fichier créé en Task 1)

- [ ] **Step 1: Écrire les tests pour les helpers v2**

Ajouter à `backend/tests/billing/test_pricing_v2.py` :

```python
from billing.plan_config import (
    PlanId,
    PLAN_ALIASES,
    PLAN_PRICES_V2,
    normalize_plan_id,
    get_price_id,
    get_voice_minutes,
)


def test_planid_v2_enum_values():
    assert PlanId.FREE.value == "free"
    assert PlanId.PRO.value == "pro"
    assert PlanId.EXPERT.value == "expert"
    # No "plus" left in the enum
    with pytest.raises(AttributeError):
        _ = PlanId.PLUS  # noqa: F841


def test_aliases_inverted():
    """Aliases must map LEGACY names → v2 canonical."""
    # Legacy "plus" (anciens souscripteurs) doit résoudre vers "pro" v2
    assert normalize_plan_id("plus") == "pro"
    # Legacy "expert" était l'alias de l'ancien "pro" v0 → reste "expert" v2
    assert normalize_plan_id("expert") == "expert"
    # Et "pro" canonique v2 reste "pro"
    assert normalize_plan_id("pro") == "pro"
    # Inconnu → free
    assert normalize_plan_id("unknown") == "free"
    assert normalize_plan_id(None) == "free"


def test_voice_minutes_per_plan():
    assert get_voice_minutes("free") == 0
    assert get_voice_minutes("pro") == 30
    assert get_voice_minutes("expert") == 120
    # Alias legacy
    assert get_voice_minutes("plus") == 30  # plus → pro → 30 min


def test_get_price_id_by_cycle(monkeypatch):
    """get_price_id(plan, cycle, test_mode) renvoie l'env var attendue."""
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY_TEST", "price_test_pro_m")
    monkeypatch.setenv("STRIPE_PRICE_PRO_YEARLY_TEST", "price_test_pro_y")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_MONTHLY_TEST", "price_test_exp_m")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_YEARLY_TEST", "price_test_exp_y")

    # Reload module pour rafraîchir le cache des env vars
    import importlib
    import billing.plan_config as pc
    importlib.reload(pc)

    assert pc.get_price_id("pro", "monthly", test_mode=True) == "price_test_pro_m"
    assert pc.get_price_id("pro", "yearly", test_mode=True) == "price_test_pro_y"
    assert pc.get_price_id("expert", "monthly", test_mode=True) == "price_test_exp_m"
    assert pc.get_price_id("expert", "yearly", test_mode=True) == "price_test_exp_y"
    # Free n'a pas de price
    assert pc.get_price_id("free", "monthly", test_mode=True) is None
    # Cycle invalide → None
    assert pc.get_price_id("pro", "lifetime", test_mode=True) is None


def test_plan_prices_v2_structure():
    """PLAN_PRICES_V2 doit contenir les 4 couples (plan, cycle) → prix en cents."""
    assert PLAN_PRICES_V2["pro"]["monthly"] == 899
    assert PLAN_PRICES_V2["pro"]["yearly"] == 8990
    assert PLAN_PRICES_V2["expert"]["monthly"] == 1999
    assert PLAN_PRICES_V2["expert"]["yearly"] == 19990
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v`
Expected : FAIL avec `AttributeError: PRO`/`EXPERT` ou `ImportError: cannot import name 'PLAN_PRICES_V2'`

- [ ] **Step 3: Refactor plan_config.py — enum, aliases, structure PLANS**

Modifier `backend/src/billing/plan_config.py`. Remplacer les sections existantes :

**Section PlanId (lignes 22-32)** :

```python
class PlanId(str, Enum):
    FREE = "free"
    PRO = "pro"        # Tier intermédiaire v2 — anciennement "plus"
    EXPERT = "expert"  # Tier premium v2 — anciennement "pro"


PLAN_HIERARCHY: list[PlanId] = [
    PlanId.FREE,
    PlanId.PRO,
    PlanId.EXPERT,
]
```

**Section PLAN_ALIASES (lignes 34-45)** — INVERSER complètement :

```python
# Aliases rétrocompatibilité — anciens plan IDs v0/v1 → plan canonique v2
PLAN_ALIASES: dict[str, str] = {
    # v0 legacy
    "plus": "pro",         # ancien Plus 4.99 € → nouveau Pro 8.99 €
    # Anciens marketing names mappés sur v2
    "etudiant": "pro",
    "starter": "pro",
    "student": "pro",
    "equipe": "expert",
    "team": "expert",
    "unlimited": "expert",
}
```

⚠️ Note : "expert" en clé du dict est REMPLACÉ par la valeur canonique de l'enum. Tout `normalize_plan_id("expert")` doit donc passer le `try: PlanId(lowered)` avec succès — pas besoin d'alias explicite.

**Section PLANS dict (lignes 65-449)** : renommer les clés et mettre à jour les prix :

- `PlanId.PLUS` → `PlanId.PRO` partout dans le dict (clé externe + métadonnées internes)
- `PlanId.PRO` (ancien) → `PlanId.EXPERT` partout
- `PLANS[PlanId.PRO]["price_monthly_cents"]` = `899` (au lieu de 499)
- `PLANS[PlanId.PRO]["price_yearly_cents"]` = `8990` (NEW, à ajouter)
- `PLANS[PlanId.PRO]["name"]` = `"Pro"` (au lieu de "Plus")
- `PLANS[PlanId.PRO]["description"]` = `"L'essentiel pour apprendre mieux, plus vite"` (inchangé)
- `PLANS[PlanId.EXPERT]["price_monthly_cents"]` = `1999` (au lieu de 999)
- `PLANS[PlanId.EXPERT]["price_yearly_cents"]` = `19990` (NEW)
- `PLANS[PlanId.EXPERT]["name"]` = `"Expert"` (au lieu de "Pro")
- Renommer `voice_monthly_minutes` : `PLANS[PlanId.PRO]["limits"]["voice_monthly_minutes"]` = `30` (avant 0 sur Plus, désormais 30 sur Pro v2 — H4)
- `PLANS[PlanId.EXPERT]["limits"]["voice_monthly_minutes"]` = `120` (avant 45 — H4)
- Toutes les références `"unlock_plan": "plus"` → `"unlock_plan": "pro"` ; `"unlock_plan": "pro"` (ancien) → `"unlock_plan": "expert"`

**Ajouter au-dessus de la section ACCESSOR FUNCTIONS (autour ligne 530)** :

```python
# ═══════════════════════════════════════════════════════════════════════════════
# PLAN_PRICES_V2 — Pricing v2 (8.99 / 19.99) avec cycle mensuel + annuel −17 %
# ═══════════════════════════════════════════════════════════════════════════════

# Prix en centimes (€). Annuel = mensuel × 12 × 0.833 (≈ −17 %).
PLAN_PRICES_V2: dict[str, dict[str, int]] = {
    "pro": {
        "monthly": 899,    # 8.99 €
        "yearly": 8990,    # 89.90 € → ≈ 7.49 €/mo équivalent
    },
    "expert": {
        "monthly": 1999,   # 19.99 €
        "yearly": 19990,   # 199.90 € → ≈ 16.66 €/mo équivalent
    },
}

# Voice minutes par plan — Pricing v2 (H4)
PLAN_VOICE_MINUTES_V2: dict[str, int] = {
    "free": 0,
    "pro": 30,
    "expert": 120,
}


def get_voice_minutes(plan_id: str) -> int:
    """Retourne le nombre de minutes ElevenLabs/voice par mois pour un plan v2.

    Free=0, Pro=30, Expert=120. Aliases legacy résolus.
    """
    normalized = normalize_plan_id(plan_id)
    return PLAN_VOICE_MINUTES_V2.get(normalized, 0)
```

**Refactor get_price_id (ligne 636) — accepter cycle** :

```python
def get_price_id(plan_id: str, cycle: str = "monthly", test_mode: bool = True) -> Optional[str]:
    """Retourne le stripe_price_id pour un (plan, cycle) v2.

    Args:
        plan_id: "free" | "pro" | "expert" (ou alias legacy)
        cycle: "monthly" | "yearly"
        test_mode: True = clés Stripe TEST, False = LIVE

    Returns:
        Price ID ou None si plan free / cycle invalide / env var non set.
    """
    if cycle not in ("monthly", "yearly"):
        return None
    normalized = normalize_plan_id(plan_id)
    if normalized == "free":
        return None
    suffix = "TEST" if test_mode else "LIVE"
    env_var = f"STRIPE_PRICE_{normalized.upper()}_{cycle.upper()}_{suffix}"
    return os.environ.get(env_var) or None
```

**Refactor init_stripe_prices (ligne 498) — charger les 8 nouvelles env vars + conserver legacy** :

```python
def init_stripe_prices() -> None:
    """Charge les stripe_price_id v2 depuis les variables d'environnement.

    Env vars v2 (nouvelles) :
      STRIPE_PRICE_PRO_MONTHLY_TEST / _LIVE
      STRIPE_PRICE_PRO_YEARLY_TEST  / _LIVE
      STRIPE_PRICE_EXPERT_MONTHLY_TEST / _LIVE
      STRIPE_PRICE_EXPERT_YEARLY_TEST  / _LIVE

    Env vars v0 LEGACY (conservées pour grandfathering — ne plus utiliser pour
    nouveaux checkouts mais les webhooks Stripe les voient encore) :
      STRIPE_PRICE_PLUS_TEST / _LIVE   → ancien Plus 4.99 €
      STRIPE_PRICE_PRO_TEST  / _LIVE   → ancien Pro 9.99 €
    """
    for plan in (PlanId.PRO, PlanId.EXPERT):
        for cycle in ("monthly", "yearly"):
            for mode in ("test", "live"):
                env_key = f"STRIPE_PRICE_{plan.value.upper()}_{cycle.upper()}_{mode.upper()}"
                val = os.environ.get(env_key, "")
                # Stocker dans le dict du plan pour debug / inspection
                price_field = f"stripe_price_id_{cycle}_{mode}"
                PLANS[plan][price_field] = val or None
                if val:
                    logger.info("Stripe v2 price loaded: %s=%s", env_key, bool(val))
```

- [ ] **Step 4: Run les tests pour valider le refactor**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v`
Expected : tous les tests pricing_v2 passent (5+ tests)

- [ ] **Step 5: Run la suite complète backend pour détecter les régressions**

Run : `cd backend && python -m pytest tests/ -x --ignore=tests/integration 2>&1 | tail -40`
Expected : pas plus de régressions que celles documentées (tests `voice_quota.py` peuvent échouer — corrigé en Task 7)

- [ ] **Step 6: Commit**

```bash
git add backend/src/billing/plan_config.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(billing): refactor plan_config to v2 (Free/Pro/Expert) with cycle-aware pricing"
```

---

### Task 3: Env vars Stripe v2 dans core/config.py

**Files:**

- Modify: `backend/src/core/config.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (étendre)

- [ ] **Step 1: Écrire le test qui vérifie que les 8 env vars v2 sont exposées**

Ajouter à `backend/tests/billing/test_pricing_v2.py` :

```python
def test_config_exposes_v2_env_vars(monkeypatch):
    """core/config.py doit exposer les 8 nouvelles env vars Pricing v2."""
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY_TEST", "price_pro_m_t")
    monkeypatch.setenv("STRIPE_PRICE_PRO_MONTHLY_LIVE", "price_pro_m_l")
    monkeypatch.setenv("STRIPE_PRICE_PRO_YEARLY_TEST", "price_pro_y_t")
    monkeypatch.setenv("STRIPE_PRICE_PRO_YEARLY_LIVE", "price_pro_y_l")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_MONTHLY_TEST", "price_exp_m_t")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_MONTHLY_LIVE", "price_exp_m_l")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_YEARLY_TEST", "price_exp_y_t")
    monkeypatch.setenv("STRIPE_PRICE_EXPERT_YEARLY_LIVE", "price_exp_y_l")

    import importlib
    import core.config as cfg
    importlib.reload(cfg)

    prices = cfg.STRIPE_CONFIG["PRICES"]
    assert prices["pro"]["monthly"]["test"] == "price_pro_m_t"
    assert prices["pro"]["monthly"]["live"] == "price_pro_m_l"
    assert prices["pro"]["yearly"]["test"] == "price_pro_y_t"
    assert prices["pro"]["yearly"]["live"] == "price_pro_y_l"
    assert prices["expert"]["monthly"]["test"] == "price_exp_m_t"
    assert prices["expert"]["monthly"]["live"] == "price_exp_m_l"
    assert prices["expert"]["yearly"]["test"] == "price_exp_y_t"
    assert prices["expert"]["yearly"]["live"] == "price_exp_y_l"
    # Legacy v0 conservées
    assert "plus" in prices  # ancien Plus 4.99 €
```

- [ ] **Step 2: Run le test, vérifier qu'il échoue**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py::test_config_exposes_v2_env_vars -v`
Expected : FAIL avec `KeyError: 'pro'` ou `KeyError: 'monthly'`

- [ ] **Step 3: Ajouter les env vars à \_DeepSightSettings**

Modifier `backend/src/core/config.py` autour des lignes 91-94. Remplacer :

```python
    STRIPE_PRICE_PLUS_TEST: str = ""
    STRIPE_PRICE_PLUS_LIVE: str = ""
    STRIPE_PRICE_PRO_TEST: str = ""
    STRIPE_PRICE_PRO_LIVE: str = ""
```

par :

```python
    # Pricing v0 LEGACY — conservées pour grandfathering / mapping webhooks
    STRIPE_PRICE_PLUS_TEST: str = ""
    STRIPE_PRICE_PLUS_LIVE: str = ""
    STRIPE_PRICE_PRO_TEST: str = ""    # ⚠️ ancien Pro 9.99 € (legacy), pas le nouveau Pro 8.99 €
    STRIPE_PRICE_PRO_LIVE: str = ""

    # Pricing v2 — 4 plans actifs (Pro 8.99 / Expert 19.99) × 2 cycles
    STRIPE_PRICE_PRO_MONTHLY_TEST: str = ""
    STRIPE_PRICE_PRO_MONTHLY_LIVE: str = ""
    STRIPE_PRICE_PRO_YEARLY_TEST: str = ""
    STRIPE_PRICE_PRO_YEARLY_LIVE: str = ""
    STRIPE_PRICE_EXPERT_MONTHLY_TEST: str = ""
    STRIPE_PRICE_EXPERT_MONTHLY_LIVE: str = ""
    STRIPE_PRICE_EXPERT_YEARLY_TEST: str = ""
    STRIPE_PRICE_EXPERT_YEARLY_LIVE: str = ""
```

- [ ] **Step 4: Étendre STRIPE_CONFIG["PRICES"] pour exposer la grille v2**

Modifier `backend/src/core/config.py` autour des lignes 324-337. Remplacer :

```python
    "PRICES": {
        "plus": {
            "test": _settings.STRIPE_PRICE_PLUS_TEST,
            "live": _settings.STRIPE_PRICE_PLUS_LIVE,
            "amount": 499,
            "name": "Plus",
        },
        "pro": {
            "test": _settings.STRIPE_PRICE_PRO_TEST,
            "live": _settings.STRIPE_PRICE_PRO_LIVE,
            "amount": 999,
            "name": "Pro",
        },
    },
```

par :

```python
    "PRICES": {
        # v0 legacy (grandfathering — ne plus utiliser pour nouveaux checkouts)
        "plus": {
            "test": _settings.STRIPE_PRICE_PLUS_TEST,
            "live": _settings.STRIPE_PRICE_PLUS_LIVE,
            "amount": 499,
            "name": "Plus (legacy)",
        },
        # v2 — actif
        "pro": {
            "monthly": {
                "test": _settings.STRIPE_PRICE_PRO_MONTHLY_TEST,
                "live": _settings.STRIPE_PRICE_PRO_MONTHLY_LIVE,
                "amount": 899,
            },
            "yearly": {
                "test": _settings.STRIPE_PRICE_PRO_YEARLY_TEST,
                "live": _settings.STRIPE_PRICE_PRO_YEARLY_LIVE,
                "amount": 8990,
            },
            "name": "Pro",
            # legacy fields pour rétro-compat code v0 — pointent sur l'ancien Pro 9.99
            "test": _settings.STRIPE_PRICE_PRO_TEST,
            "live": _settings.STRIPE_PRICE_PRO_LIVE,
        },
        "expert": {
            "monthly": {
                "test": _settings.STRIPE_PRICE_EXPERT_MONTHLY_TEST,
                "live": _settings.STRIPE_PRICE_EXPERT_MONTHLY_LIVE,
                "amount": 1999,
            },
            "yearly": {
                "test": _settings.STRIPE_PRICE_EXPERT_YEARLY_TEST,
                "live": _settings.STRIPE_PRICE_EXPERT_YEARLY_LIVE,
                "amount": 19990,
            },
            "name": "Expert",
        },
    },
```

- [ ] **Step 5: Run le test, vérifier qu'il passe**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py::test_config_exposes_v2_env_vars -v`
Expected : 1 passed

- [ ] **Step 6: Commit**

```bash
git add backend/src/core/config.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(config): add 8 Stripe v2 env vars (Pro/Expert × monthly/yearly × test/live)"
```

---

### Task 4: Script seed_stripe_prices_v2.py — création idempotente des Stripe Prices

**Files:**

- Create: `backend/scripts/seed_stripe_prices_v2.py`

- [ ] **Step 1: Écrire le script de seed idempotent**

Créer `backend/scripts/seed_stripe_prices_v2.py` :

```python
"""Idempotent Stripe Products + Prices seeder for Pricing v2.

Usage :
    cd backend && STRIPE_TEST_MODE=true python scripts/seed_stripe_prices_v2.py
    cd backend && STRIPE_TEST_MODE=false python scripts/seed_stripe_prices_v2.py

Crée (si absents via lookup_key) :
  - 2 Products :  prod_deepsight_pro / prod_deepsight_expert
  - 4 Prices  :  pro_monthly / pro_yearly / expert_monthly / expert_yearly

Output : copie/colle les 4 Price IDs à mettre dans .env.production.
Idempotent : ré-exécutable à volonté, ne duplique jamais.
"""
from __future__ import annotations

import os
import sys
from typing import Optional

import stripe

# Ajouter src/ au path pour importer les helpers config
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from core.config import get_stripe_key  # noqa: E402


SEED_SPEC = [
    # (product_lookup_key, product_name, price_lookup_key, amount_cents, interval)
    ("prod_deepsight_pro",    "DeepSight Pro",    "pro_monthly",       899,   "month"),
    ("prod_deepsight_pro",    "DeepSight Pro",    "pro_yearly",        8990,  "year"),
    ("prod_deepsight_expert", "DeepSight Expert", "expert_monthly",    1999,  "month"),
    ("prod_deepsight_expert", "DeepSight Expert", "expert_yearly",     19990, "year"),
]


def get_or_create_product(lookup_key: str, name: str) -> stripe.Product:
    """Retrieve product by metadata.lookup_key or create it."""
    products = stripe.Product.search(query=f"metadata['lookup_key']:'{lookup_key}'")
    if products.data:
        print(f"  ✓ Product exists: {lookup_key} ({products.data[0].id})")
        return products.data[0]
    p = stripe.Product.create(
        name=name,
        metadata={"lookup_key": lookup_key, "managed_by": "seed_stripe_prices_v2"},
    )
    print(f"  + Product created: {lookup_key} ({p.id})")
    return p


def get_or_create_price(
    product_id: str,
    lookup_key: str,
    amount_cents: int,
    interval: str,
) -> stripe.Price:
    """Retrieve price by lookup_key or create it.

    Stripe natively supports ``lookup_key`` on Price → idempotence facile.
    """
    existing = stripe.Price.list(lookup_keys=[lookup_key], limit=1)
    if existing.data:
        print(f"  ✓ Price exists: {lookup_key} ({existing.data[0].id})")
        return existing.data[0]
    price = stripe.Price.create(
        product=product_id,
        unit_amount=amount_cents,
        currency="eur",
        recurring={"interval": interval},
        lookup_key=lookup_key,
        metadata={"managed_by": "seed_stripe_prices_v2"},
    )
    print(f"  + Price created: {lookup_key} ({price.id}) — {amount_cents/100:.2f} EUR / {interval}")
    return price


def main() -> int:
    api_key = get_stripe_key()
    if not api_key:
        print("ERROR: no Stripe key configured (check STRIPE_SECRET_KEY_TEST/LIVE)", file=sys.stderr)
        return 1
    stripe.api_key = api_key
    test_mode = os.environ.get("STRIPE_TEST_MODE", "true").lower() == "true"
    print(f"Stripe seed v2 — mode={'TEST' if test_mode else 'LIVE'}")

    out: dict[str, str] = {}
    for product_lookup, product_name, price_lookup, amount, interval in SEED_SPEC:
        product = get_or_create_product(product_lookup, product_name)
        price = get_or_create_price(product.id, price_lookup, amount, interval)
        out[price_lookup] = price.id

    suffix = "TEST" if test_mode else "LIVE"
    print("\n" + "=" * 70)
    print(f"# Add to .env.production ({suffix} keys):")
    print("=" * 70)
    print(f"STRIPE_PRICE_PRO_MONTHLY_{suffix}={out['pro_monthly']}")
    print(f"STRIPE_PRICE_PRO_YEARLY_{suffix}={out['pro_yearly']}")
    print(f"STRIPE_PRICE_EXPERT_MONTHLY_{suffix}={out['expert_monthly']}")
    print(f"STRIPE_PRICE_EXPERT_YEARLY_{suffix}={out['expert_yearly']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Vérifier que le script s'importe sans erreur (smoke check syntaxe)**

Run : `cd backend && python -c "import scripts.seed_stripe_prices_v2"`
Expected : pas d'erreur d'import (le main() ne s'exécute pas car `__name__ != "__main__"`)

- [ ] **Step 3: Tester le mode TEST en dry-run**

⚠️ Ce step requiert une clé Stripe TEST configurée. Si pas dispo localement, sauter et exécuter en CI/staging.

Run : `cd backend && STRIPE_TEST_MODE=true python scripts/seed_stripe_prices_v2.py`
Expected output (1ère exécution) :

```
Stripe seed v2 — mode=TEST
  + Product created: prod_deepsight_pro (prod_xxx)
  + Price created: pro_monthly (price_yyy) — 8.99 EUR / month
  + Price created: pro_yearly (price_zzz) — 89.90 EUR / year
  + Product created: prod_deepsight_expert (prod_aaa)
  + Price created: expert_monthly (price_bbb) — 19.99 EUR / month
  + Price created: expert_yearly (price_ccc) — 199.90 EUR / year

# Add to .env.production (TEST keys):
STRIPE_PRICE_PRO_MONTHLY_TEST=price_yyy
...
```

Re-run :
Expected : `✓ Product exists` / `✓ Price exists` partout (idempotence).

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_stripe_prices_v2.py
git commit -m "feat(billing): add idempotent Stripe v2 prices seeder script"
```

---

### Task 5: Endpoint /billing/start-trial v2 (Pro OU Expert) + redirection /start-pro-trial

**Files:**

- Modify: `backend/src/billing/router.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (étendre)

- [ ] **Step 1: Écrire les tests pour /trial-eligibility et /start-trial v2**

Ajouter à `backend/tests/billing/test_pricing_v2.py` :

```python
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_trial_eligibility_returns_pro_default(authed_client: AsyncClient):
    """GET /api/billing/trial-eligibility (sans param) → trial_plan=pro v2 par défaut."""
    r = await authed_client.get("/api/billing/trial-eligibility")
    assert r.status_code == 200
    body = r.json()
    assert body["trial_plan"] == "pro"
    assert body["trial_days"] == 7


@pytest.mark.asyncio
async def test_trial_eligibility_with_explicit_plan(authed_client: AsyncClient):
    """GET /api/billing/trial-eligibility?plan=expert → trial_plan=expert."""
    r = await authed_client.get("/api/billing/trial-eligibility?plan=expert")
    assert r.status_code == 200
    body = r.json()
    assert body["trial_plan"] == "expert"
    assert body["trial_days"] == 7


@pytest.mark.asyncio
async def test_trial_eligibility_rejects_invalid_plan(authed_client: AsyncClient):
    """plan=free ou inconnu → 400."""
    r = await authed_client.get("/api/billing/trial-eligibility?plan=free")
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_start_trial_with_plan_param_creates_checkout(
    authed_client: AsyncClient, mock_stripe
):
    """POST /api/billing/start-trial?plan=pro → checkout 7j sans CB sur Pro."""
    mock_stripe.checkout.Session.create.return_value.url = "https://stripe/checkout/sess_pro"
    r = await authed_client.post("/api/billing/start-trial?plan=pro")
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "pro"
    assert body["trial_days"] == 7
    assert "checkout_url" in body
    # Vérifier que la session Stripe a bien trial_period_days=7 et payment_method_collection=if_required
    call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
    assert call_kwargs["subscription_data"]["trial_period_days"] == 7
    assert call_kwargs["payment_method_collection"] == "if_required"


@pytest.mark.asyncio
async def test_legacy_start_pro_trial_redirects_to_pro_trial(
    authed_client: AsyncClient, mock_stripe
):
    """POST /api/billing/start-pro-trial (legacy) → redirige vers nouveau /start-trial?plan=pro."""
    mock_stripe.checkout.Session.create.return_value.url = "https://stripe/checkout/legacy"
    r = await authed_client.post("/api/billing/start-pro-trial")
    assert r.status_code == 200
    body = r.json()
    # Mapping : legacy "plus" trial → désormais "pro" trial v2
    assert body["plan"] == "pro"
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k trial`
Expected : FAIL — `/start-trial` n'existe pas, `/start-pro-trial` retourne `plus`.

- [ ] **Step 3: Refactor /trial-eligibility avec param plan**

Dans `backend/src/billing/router.py`, remplacer la section autour des lignes 220-277. Nouveau code :

```python
class TrialEligibilityResponse(BaseModel):
    """Réponse d'éligibilité à l'essai gratuit."""

    eligible: bool
    reason: Optional[str] = None
    trial_days: int = 7
    trial_plan: str = "pro"  # v2 default — anciennement "plus"


@router.get("/trial-eligibility", response_model=TrialEligibilityResponse)
async def check_trial_eligibility(
    plan: str = Query("pro", description="Plan cible du trial : pro ou expert"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🆓 Vérifie l'éligibilité à un essai 7 j sans CB pour Pro ou Expert (v2 H5).

    Conditions :
      - plan ∈ {pro, expert}
      - user.plan == "free"
      - Aucun stripe_subscription_id existant
      - Aucune transaction passée de type purchase / trial / upgrade
    """
    if plan not in ("pro", "expert"):
        raise HTTPException(status_code=400, detail={
            "code": "invalid_plan",
            "message": "plan must be 'pro' or 'expert'",
        })

    if current_user.plan != "free":
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà un abonnement actif",
            trial_days=0,
            trial_plan=plan,
        )

    if current_user.stripe_subscription_id:
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà bénéficié d'un abonnement",
            trial_days=0,
            trial_plan=plan,
        )

    result = await session.execute(
        select(CreditTransaction)
        .where(CreditTransaction.user_id == current_user.id)
        .where(CreditTransaction.transaction_type.in_(["purchase", "trial", "upgrade"]))
        .limit(1)
    )
    if result.scalar_one_or_none() is not None:
        return TrialEligibilityResponse(
            eligible=False,
            reason="Vous avez déjà bénéficié d'un essai ou d'un abonnement",
            trial_days=0,
            trial_plan=plan,
        )

    return TrialEligibilityResponse(eligible=True, trial_days=7, trial_plan=plan)
```

- [ ] **Step 4: Ajouter /start-trial (param plan) et conserver /start-pro-trial en legacy**

Ajouter avant `@router.post("/start-pro-trial")` ligne 280 :

```python
@router.post("/start-trial")
async def start_trial(
    plan: str = Query("pro", description="Plan cible : pro ou expert"),
    cycle: str = Query("monthly", description="monthly | yearly"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🆓 Démarre un essai gratuit 7 j sans CB sur Pro ou Expert (Pricing v2 H5).

    Crée une session Stripe Checkout avec :
      - trial_period_days = 7
      - payment_method_collection = "if_required"  → pas de CB demandée pendant le trial
    """
    if plan not in ("pro", "expert"):
        raise HTTPException(status_code=400, detail={
            "code": "invalid_plan",
            "message": "plan must be 'pro' or 'expert'",
        })
    if cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail={
            "code": "invalid_cycle",
            "message": "cycle must be 'monthly' or 'yearly'",
        })

    eligibility = await check_trial_eligibility(plan, current_user, session)
    if not eligibility.eligible:
        raise HTTPException(
            status_code=400,
            detail={"code": "not_eligible", "message": eligibility.reason or "Non éligible"},
        )
    if not STRIPE_CONFIG.get("ENABLED"):
        raise HTTPException(status_code=400, detail="Stripe not enabled")
    if not init_stripe():
        raise HTTPException(status_code=500, detail="Stripe not configured")

    test_mode = STRIPE_CONFIG.get("TEST_MODE", True)
    from .plan_config import get_price_id as plan_get_price_id
    price_id = plan_get_price_id(plan, cycle, test_mode=test_mode)
    if not price_id:
        raise HTTPException(status_code=400, detail=f"Plan {plan} ({cycle}) not configured")

    try:
        customer_id = await get_or_create_stripe_customer(current_user, session)
    except stripe.error.StripeError as e:
        logger.error(f"Stripe customer error: {e}")
        raise HTTPException(status_code=500, detail="Stripe customer error")

    try:
        checkout_session = stripe.checkout.Session.create(
            customer=customer_id,
            payment_method_types=["card"],
            payment_method_collection="if_required",  # H5 : pas de CB pour le trial
            line_items=[{"price": price_id, "quantity": 1}],
            mode="subscription",
            subscription_data={
                "trial_period_days": 7,
                "metadata": {
                    "user_id": str(current_user.id),
                    "is_trial": "true",
                    "trial_plan": plan,
                    "cycle": cycle,
                },
            },
            success_url=f"{FRONTEND_URL}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&plan={plan}&cycle={cycle}&trial=true",
            cancel_url=f"{FRONTEND_URL}/upgrade",
            allow_promotion_codes=False,
            metadata={
                "user_id": str(current_user.id),
                "plan": plan,
                "cycle": cycle,
                "is_trial": "true",
            },
        )
        logger.info(f"Trial v2 checkout: user={current_user.id} plan={plan} cycle={cycle}")
        return {
            "checkout_url": checkout_session.url,
            "session_id": checkout_session.id,
            "trial_days": 7,
            "plan": plan,
            "cycle": cycle,
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Stripe error")
```

- [ ] **Step 5: Convertir /start-pro-trial en redirection legacy vers /start-trial?plan=pro**

Remplacer le corps de `/start-pro-trial` (autour lignes 280-360) par :

```python
@router.post("/start-pro-trial", deprecated=True)
async def start_pro_trial_legacy(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """🔄 LEGACY — Ancien endpoint v0 qui démarrait un trial Plus 4.99 €.

    Désormais redirige vers le nouveau /start-trial?plan=pro&cycle=monthly v2.
    Conservé pour compatibilité clients mobiles non encore mis à jour.
    """
    return await start_trial(
        plan="pro",
        cycle="monthly",
        current_user=current_user,
        session=session,
    )
```

- [ ] **Step 6: Run les tests, vérifier qu'ils passent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k trial`
Expected : tous trial-related tests passent.

- [ ] **Step 7: Commit**

```bash
git add backend/src/billing/router.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(billing): /start-trial v2 (Pro/Expert + cycle) + legacy /start-pro-trial redirect"
```

---

### Task 6: Endpoints /plans et /create-checkout v2 (avec cycle)

**Files:**

- Modify: `backend/src/billing/router.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (étendre)

- [ ] **Step 1: Écrire les tests /plans v2 et /create-checkout cycle**

Ajouter à `backend/tests/billing/test_pricing_v2.py` :

```python
@pytest.mark.asyncio
async def test_plans_endpoint_returns_v2_grid(client: AsyncClient):
    """GET /api/billing/plans → grille v2 avec free/pro/expert + cycles."""
    r = await client.get("/api/billing/plans")
    assert r.status_code == 200
    body = r.json()
    plan_ids = {p["id"] for p in body["plans"]}
    assert plan_ids == {"free", "pro", "expert"}, f"Got {plan_ids}"

    pro = next(p for p in body["plans"] if p["id"] == "pro")
    assert pro["price_monthly_cents"] == 899
    assert pro["price_yearly_cents"] == 8990

    expert = next(p for p in body["plans"] if p["id"] == "expert")
    assert expert["price_monthly_cents"] == 1999
    assert expert["price_yearly_cents"] == 19990


@pytest.mark.asyncio
async def test_create_checkout_with_cycle_yearly(authed_client: AsyncClient, mock_stripe):
    """POST /api/billing/create-checkout {plan:pro,cycle:yearly} → utilise yearly Price ID."""
    mock_stripe.checkout.Session.create.return_value.url = "https://stripe/checkout/yearly"
    r = await authed_client.post(
        "/api/billing/create-checkout",
        json={"plan": "pro", "cycle": "yearly"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "checkout_url" in body
    call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
    line_items = call_kwargs["line_items"]
    # Le Price ID résolu doit être celui yearly (env var STRIPE_PRICE_PRO_YEARLY_TEST)
    assert "price" in line_items[0]


@pytest.mark.asyncio
async def test_create_checkout_rejects_unknown_plan(authed_client: AsyncClient):
    """POST /api/billing/create-checkout {plan:foo} → 400."""
    r = await authed_client.post(
        "/api/billing/create-checkout", json={"plan": "foo", "cycle": "monthly"}
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_create_checkout_default_cycle_monthly(authed_client: AsyncClient, mock_stripe):
    """Sans cycle → default monthly."""
    mock_stripe.checkout.Session.create.return_value.url = "https://stripe/sess"
    r = await authed_client.post(
        "/api/billing/create-checkout", json={"plan": "expert"}
    )
    assert r.status_code == 200
    call_kwargs = mock_stripe.checkout.Session.create.call_args.kwargs
    metadata = call_kwargs.get("metadata", {})
    assert metadata.get("cycle") == "monthly"
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k "plans or checkout"`
Expected : FAIL — schema CreateCheckoutRequest n'a pas de champ cycle, /plans retourne ancienne grille.

- [ ] **Step 3: Étendre CreateCheckoutRequest schema**

Dans `backend/src/billing/router.py`, modifier la classe `CreateCheckoutRequest` (lignes 76-82) :

```python
class CreateCheckoutRequest(BaseModel):
    """Requête pour créer une session de paiement v2."""

    plan: str  # "pro" | "expert"
    cycle: str = "monthly"  # "monthly" | "yearly"
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None
```

- [ ] **Step 4: Implémenter /plans v2**

Localiser le handler `@router.get("/plans")` existant et le remplacer (ou ajouter si absent) :

```python
@router.get("/plans")
async def list_plans():
    """GET /api/billing/plans — Grille publique v2 (Free / Pro / Expert).

    Retourne pour chaque plan : id, name, prices (monthly + yearly cents),
    voice_minutes, features_display. Le frontend l'utilise pour rendre
    UpgradePage + ComparisonTable.
    """
    from .plan_config import PLANS, PLAN_HIERARCHY, PLAN_PRICES_V2, PLAN_VOICE_MINUTES_V2

    plans = []
    for plan_id in PLAN_HIERARCHY:
        cfg = PLANS[plan_id]
        prices = PLAN_PRICES_V2.get(plan_id.value, {})
        plans.append({
            "id": plan_id.value,
            "name": cfg["name"],
            "name_en": cfg["name_en"],
            "description": cfg["description"],
            "description_en": cfg["description_en"],
            "price_monthly_cents": prices.get("monthly", 0),
            "price_yearly_cents": prices.get("yearly", 0),
            "voice_minutes": PLAN_VOICE_MINUTES_V2.get(plan_id.value, 0),
            "color": cfg["color"],
            "icon": cfg["icon"],
            "badge": cfg.get("badge"),
            "popular": cfg.get("popular", False),
            "features_display": cfg["features_display"],
            "features_locked": cfg.get("features_locked", []),
            "limits": cfg["limits"],
        })

    return {"plans": plans, "currency": "EUR", "yearly_discount_pct": 17}
```

- [ ] **Step 5: Refactor /create-checkout pour accepter cycle**

Localiser `@router.post("/create-checkout")`. Remplacer la résolution de price_id :

```python
# AVANT (v0) :
# price_id = get_price_id(req.plan)

# APRES (v2) :
from .plan_config import get_price_id as plan_get_price_id
if req.plan not in ("pro", "expert"):
    raise HTTPException(400, detail={"code": "invalid_plan", "message": "plan must be 'pro' or 'expert'"})
if req.cycle not in ("monthly", "yearly"):
    raise HTTPException(400, detail={"code": "invalid_cycle"})

test_mode = STRIPE_CONFIG.get("TEST_MODE", True)
price_id = plan_get_price_id(req.plan, req.cycle, test_mode=test_mode)
if not price_id:
    raise HTTPException(400, detail=f"Plan {req.plan} ({req.cycle}) price not configured")
```

Ajouter `cycle` à `metadata` de `stripe.checkout.Session.create` :

```python
metadata={
    "user_id": str(current_user.id),
    "plan": req.plan,
    "cycle": req.cycle,
},
```

- [ ] **Step 6: Run les tests**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k "plans or checkout"`
Expected : tous passent.

- [ ] **Step 7: Commit**

```bash
git add backend/src/billing/router.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(billing): /plans v2 grid + /create-checkout cycle param (monthly|yearly)"
```

---

### Task 7: Voice quota par plan — Pro 30 / Expert 120

**Files:**

- Modify: `backend/src/billing/voice_quota.py`
- Test: `backend/tests/billing/test_pricing_v2.py` (étendre)

- [ ] **Step 1: Écrire les tests voice quota par plan**

Ajouter à `backend/tests/billing/test_pricing_v2.py` :

```python
from billing.voice_quota import check_voice_quota, EXPERT_MONTHLY_MINUTES


@pytest.mark.asyncio
async def test_voice_quota_pro_returns_30_minutes(db_session: AsyncSession):
    """Plan pro v2 → max_minutes = 30 (au lieu du 30 hardcodé v0)."""
    user = User(username="pro_user", email="pro@test.fr", password_hash="x", plan="pro")
    db_session.add(user)
    await db_session.commit()
    check = await check_voice_quota(user, db_session)
    assert check.allowed is True
    assert check.max_minutes == 30


@pytest.mark.asyncio
async def test_voice_quota_expert_returns_120_minutes(db_session: AsyncSession):
    """Plan expert v2 → max_minutes = 120 (H4)."""
    user = User(username="expert_user", email="expert@test.fr", password_hash="x", plan="expert")
    db_session.add(user)
    await db_session.commit()
    check = await check_voice_quota(user, db_session)
    assert check.allowed is True
    assert check.max_minutes == 120


@pytest.mark.asyncio
async def test_voice_quota_legacy_plus_resolves_to_pro_30(db_session: AsyncSession):
    """User encore tagué 'plus' (avant migration) → résolu via alias en pro 30 min."""
    user = User(username="legacy_plus", email="lp@test.fr", password_hash="x", plan="plus")
    db_session.add(user)
    await db_session.commit()
    check = await check_voice_quota(user, db_session)
    # plus → pro v2 → 30 min
    assert check.allowed is True
    assert check.max_minutes == 30


def test_expert_monthly_minutes_alias_is_120():
    """L'alias EXPERT_MONTHLY_MINUTES exposé doit valoir 120 (v2 H4)."""
    assert EXPERT_MONTHLY_MINUTES == 120
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k voice`
Expected : FAIL — Pro renvoie 30 (déjà v0 bon par hasard) mais Expert renvoie 30 (mauvais), legacy plus échoue (TOP_TIER_PLANS exclut "plus").

- [ ] **Step 3: Refactor voice_quota.py — lookup dynamique par plan**

Modifier `backend/src/billing/voice_quota.py`. Remplacer les constantes (lignes 36-44) :

```python
# ─── Pricing v2 (H4 — locked 2026-04-29) ──────────────────────────────────
# Voice allowance par plan : Pro 30 min, Expert 120 min.
# Source de vérité unique : plan_config.PLAN_VOICE_MINUTES_V2 (résolution alias incluse).
from billing.plan_config import get_voice_minutes, normalize_plan_id

# Backwards-compat aliases (consommés par tests legacy + voice/router.py)
PRO_MONTHLY_MINUTES: float = float(get_voice_minutes("pro"))      # 30
EXPERT_MONTHLY_MINUTES: float = float(get_voice_minutes("expert"))  # 120
TOP_TIER_MONTHLY_MINUTES: float = PRO_MONTHLY_MINUTES  # ⚠️ DEPRECATED — utilisez get_voice_minutes()
FREE_TRIAL_MINUTES: float = 3.0
MONTHLY_PERIOD_DAYS: int = 30

# Plans avec quota voice mensuel rolling 30j
TOP_TIER_PLANS: frozenset[str] = frozenset({"pro", "expert"})
```

Refactor `check_voice_quota` (ligne 110-152). Remplacer la branche `if plan in TOP_TIER_PLANS:` par :

```python
async def check_voice_quota(user: User, db: AsyncSession) -> QuotaCheck:
    plan_raw = (user.plan or "free").lower()
    plan = normalize_plan_id(plan_raw)  # résout legacy "plus" → "pro" automatiquement
    quota = await _get_or_create_quota(user.id, plan, db)

    if plan == "free":
        if quota.lifetime_trial_used:
            return QuotaCheck(allowed=False, reason="trial_used", cta="upgrade_pro")
        return QuotaCheck(allowed=True, max_minutes=FREE_TRIAL_MINUTES, is_trial=True)

    if plan in TOP_TIER_PLANS:
        plan_minutes = float(get_voice_minutes(plan))
        remaining = plan_minutes - float(quota.monthly_minutes_used or 0.0)
        if remaining <= 0:
            return QuotaCheck(allowed=False, reason="monthly_quota")
        return QuotaCheck(allowed=True, max_minutes=remaining)

    logger.info("Plan '%s' not top-tier voice plan for user_id=%d — upgrade CTA", plan, user.id)
    return QuotaCheck(allowed=False, reason="pro_no_voice", cta="upgrade_pro")
```

- [ ] **Step 4: Run les tests, vérifier qu'ils passent**

Run : `cd backend && python -m pytest tests/billing/test_pricing_v2.py -v -k voice`
Expected : tous passent.

- [ ] **Step 5: Run la suite voice complète**

Run : `cd backend && python -m pytest tests/voice/ -v`
Expected : pas de régression — les tests existants utilisant `EXPERT_MONTHLY_MINUTES = 30.0` peuvent échouer ⚠️ → mettre à jour tests obsolètes (la valeur passe de 30 à 120 par décision H4).

- [ ] **Step 6: Commit**

```bash
git add backend/src/billing/voice_quota.py backend/tests/billing/test_pricing_v2.py
git commit -m "feat(voice): dynamic voice quota lookup (Pro 30 / Expert 120) via get_voice_minutes()"
```

---

### Task 8: Frontend planPrivileges.ts — refactor v2 (rename + voice minutes)

**Files:**

- Modify: `frontend/src/config/planPrivileges.ts`
- Test: `frontend/src/config/__tests__/planPrivileges.test.ts` (créer si absent)

- [ ] **Step 1: Écrire les tests Vitest pour planPrivileges v2**

Créer `frontend/src/config/__tests__/planPrivileges.test.ts` :

```typescript
import { describe, it, expect } from "vitest";
import {
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  normalizePlanId,
  type PlanId,
} from "../planPrivileges";

describe("Pricing v2 — planPrivileges", () => {
  it("PlanId is free | pro | expert", () => {
    expect(PLAN_HIERARCHY).toEqual<PlanId[]>(["free", "pro", "expert"]);
  });

  it("Pro voice 30 min, Expert 120 min", () => {
    expect(PLAN_LIMITS.pro.voiceChatMonthlyMinutes).toBe(30);
    expect(PLAN_LIMITS.expert.voiceChatMonthlyMinutes).toBe(120);
    expect(PLAN_LIMITS.free.voiceChatMonthlyMinutes).toBe(0);
  });

  it("Pro priceMonthly 899, Expert 1999", () => {
    expect(PLANS_INFO.pro.priceMonthly).toBe(899);
    expect(PLANS_INFO.expert.priceMonthly).toBe(1999);
  });

  it("Pro priceYearly 8990, Expert 19990 (-17 %)", () => {
    expect(PLANS_INFO.pro.priceYearly).toBe(8990);
    expect(PLANS_INFO.expert.priceYearly).toBe(19990);
  });

  it("Aliases legacy v0→v2 inverted", () => {
    expect(normalizePlanId("plus")).toBe("pro");
    expect(normalizePlanId("starter")).toBe("pro");
    expect(normalizePlanId("etudiant")).toBe("pro");
    // "expert" canonique reste expert
    expect(normalizePlanId("expert")).toBe("expert");
    expect(normalizePlanId("team")).toBe("expert");
    expect(normalizePlanId("equipe")).toBe("expert");
    expect(normalizePlanId("unlimited")).toBe("expert");
    // Inconnu / null
    expect(normalizePlanId("foo")).toBe("free");
    expect(normalizePlanId(undefined)).toBe("free");
  });

  it("Voice chat enabled on pro AND expert (v2)", () => {
    expect(PLAN_FEATURES.pro.voiceChat).toBe(true);
    expect(PLAN_FEATURES.expert.voiceChat).toBe(true);
    expect(PLAN_FEATURES.free.voiceChat).toBe(false);
  });

  it("Pro has expert features-locked (e.g. deepResearch)", () => {
    expect(PLAN_FEATURES.pro.deepResearch).toBe(false);
    expect(PLAN_FEATURES.expert.deepResearch).toBe(true);
  });
});
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd frontend && npm run test -- src/config/__tests__/planPrivileges.test.ts`
Expected : FAIL — `PLAN_HIERARCHY` contient `"plus"`, `PLAN_LIMITS.expert` undefined.

- [ ] **Step 3: Refactor planPrivileges.ts**

Modifier `frontend/src/config/planPrivileges.ts` :

**Header (lignes 1-2)** :

```typescript
// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers
// Migration Avril 2026 : Pricing v2 — 3 plans (Free / Pro 8.99 € / Expert 19.99 €)
// Avec toggle mensuel/annuel −17 % et trial 7 j sans CB.
```

**Type PlanId (ligne 8)** :

```typescript
export type PlanId = "free" | "pro" | "expert";

export const PLAN_HIERARCHY: PlanId[] = ["free", "pro", "expert"];

export type BillingCycle = "monthly" | "yearly";
```

**PLAN_LIMITS (lignes 61-167)** : renommer la clé `plus` → `pro`, et l'ancienne `pro` → `expert`. Mettre à jour les voice minutes :

```typescript
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    /* ...inchangé... */
  },

  // Anciennement "plus" v0 — devenu "pro" v2 (8.99 €) avec voice 30 min/mo
  pro: {
    monthlyAnalyses: 25,
    maxVideoLengthMin: 60,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 25,
    chatDailyLimit: 50,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 20,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ["txt", "md", "pdf"],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ["mistral-small-2603", "mistral-medium-2508"],
    defaultModel: "mistral-medium-2508",
    academicSearch: true,
    academicPapersPerAnalysis: 15,
    bibliographyExport: true,
    voiceChatEnabled: true, // ⚠️ v2 : Pro a voice (avant Plus n'avait pas)
    voiceChatMonthlyMinutes: 30, // ⚠️ v2 H4
    debateEnabled: true,
    debateMonthly: 3,
    debateCreditsPerDebate: 6,
    debateChatDaily: 10,
    deepResearchEnabled: false,
    factcheckEnabled: true,
    ttsEnabled: false,
  },

  // Anciennement "pro" v0 — devenu "expert" v2 (19.99 €) avec voice 120 min/mo
  expert: {
    monthlyAnalyses: 100,
    maxVideoLengthMin: 240,
    concurrentAnalyses: 3,
    priorityQueue: true,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 60,
    playlistsEnabled: true,
    maxPlaylists: 10,
    maxPlaylistVideos: 20,
    exportFormats: ["txt", "md", "pdf"],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: [
      "mistral-small-2603",
      "mistral-medium-2508",
      "mistral-large-2512",
    ],
    defaultModel: "mistral-large-2512",
    academicSearch: true,
    academicPapersPerAnalysis: 50,
    bibliographyExport: true,
    voiceChatEnabled: true,
    voiceChatMonthlyMinutes: 120, // ⚠️ v2 H4
    debateEnabled: true,
    debateMonthly: 20,
    debateCreditsPerDebate: 4,
    debateChatDaily: -1,
    deepResearchEnabled: true,
    factcheckEnabled: true,
    ttsEnabled: true,
  },
};
```

**PLAN_FEATURES (lignes 191-243)** : mêmes renames, et `voiceChat: true` sur pro v2 :

```typescript
export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    /* ...inchangé... */
  },
  pro: {
    flashcards: true,
    mindmap: true,
    webSearch: true,
    playlists: false,
    exportPdf: true,
    exportMarkdown: true,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    academicSearch: true,
    bibliographyExport: true,
    voiceChat: true, // ⚠️ v2 : Pro a voice
    debate: true,
    deepResearch: false,
    factcheck: true,
  },
  expert: {
    flashcards: true,
    mindmap: true,
    webSearch: true,
    playlists: true,
    exportPdf: true,
    exportMarkdown: true,
    ttsAudio: true,
    apiAccess: false,
    prioritySupport: true,
    academicSearch: true,
    bibliographyExport: true,
    voiceChat: true,
    debate: true,
    deepResearch: true,
    factcheck: true,
  },
};
```

**PlanInfo + PLANS_INFO (lignes 254-306)** : ajouter `priceYearly` et renommer :

```typescript
export interface PlanInfo {
  id: PlanId;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  priceMonthly: number; // cents
  priceYearly: number; // cents — Pricing v2
  color: string;
  icon: string;
  badge: PlanBadge | null;
  popular: boolean;
}

export const PLANS_INFO: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: "Gratuit",
    nameEn: "Free",
    description: "Découvrez DeepSight gratuitement",
    descriptionEn: "Discover DeepSight for free",
    priceMonthly: 0,
    priceYearly: 0,
    color: "#6B7280",
    icon: "Zap",
    badge: null,
    popular: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    nameEn: "Pro",
    description: "L'essentiel pour apprendre mieux, plus vite",
    descriptionEn: "Everything you need to learn better, faster",
    priceMonthly: 899,
    priceYearly: 8990,
    color: "#3B82F6",
    icon: "Star",
    badge: { text: "Populaire", color: "#3B82F6" },
    popular: true,
  },
  expert: {
    id: "expert",
    name: "Expert",
    nameEn: "Expert",
    description: "Toute la puissance de DeepSight, sans limites",
    descriptionEn: "The full power of DeepSight, unlimited",
    priceMonthly: 1999,
    priceYearly: 19990,
    color: "#8B5CF6",
    icon: "Crown",
    badge: { text: "Le + puissant", color: "#8B5CF6" },
    popular: false,
  },
};
```

**normalizePlanId (lignes 363-386)** : INVERSER les aliases :

```typescript
export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return "free";
  const lower = raw.toLowerCase().trim();
  const aliases: Record<string, PlanId> = {
    free: "free",
    gratuit: "free",
    // v0 legacy → v2 canonique
    plus: "pro", // ancien Plus → nouveau Pro v2
    student: "pro",
    etudiant: "pro",
    étudiant: "pro",
    starter: "pro",
    // Anciens premium / unlimited → expert
    team: "expert",
    equipe: "expert",
    équipe: "expert",
    unlimited: "expert",
    admin: "expert",
    // v2 canonique
    pro: "pro",
    expert: "expert",
  };
  return aliases[lower] ?? "free";
}
```

**CONVERSION_TRIGGERS (lignes 354-360)** : `trialPlan` passe à `pro`, et `trialEnabled: true` (H5) :

```typescript
export const CONVERSION_TRIGGERS = {
  freeAnalysisLimit: 5,
  freeAnalysisWarning: 3,
  trialEnabled: true, // v2 H5 : trial 7 j actif
  trialDays: 7,
  trialPlan: "pro" as PlanId, // default trial → Pro
};
```

**TESTIMONIALS (lignes 471-502)** : `plan: "plus"` → `plan: "pro"`, `plan: "pro"` (ancien) → `plan: "expert"` partout.

- [ ] **Step 4: Run les tests, vérifier qu'ils passent**

Run : `cd frontend && npm run test -- src/config/__tests__/planPrivileges.test.ts`
Expected : 5 passed.

- [ ] **Step 5: Run le typecheck pour détecter les régressions**

Run : `cd frontend && npm run typecheck 2>&1 | head -50`
Expected : erreurs dans les fichiers consommateurs (UpgradePage, etc.) qui référencent encore `"plus"` — ces erreurs seront corrigées en Tasks 9-11. Lister-les pour les corriger ensuite.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/config/planPrivileges.ts frontend/src/config/__tests__/planPrivileges.test.ts
git commit -m "feat(frontend): refactor planPrivileges to v2 (Free/Pro/Expert) with yearly cycle"
```

---

### Task 9: Frontend api.ts — types BillingCycle + méthodes v2

**Files:**

- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Localiser et refactor les méthodes billing dans api.ts**

Modifier `frontend/src/services/api.ts`. Localiser la section `billingApi` ou équivalent (chercher `trial-eligibility`, `start-pro-trial`, `create-checkout`).

Ajouter les types (avant `billingApi`) :

```typescript
export type BillingCycle = "monthly" | "yearly";
export type ApiBillingPlan = "free" | "pro" | "expert";

export interface PlanResponse {
  id: ApiBillingPlan;
  name: string;
  name_en: string;
  description: string;
  description_en: string;
  price_monthly_cents: number;
  price_yearly_cents: number;
  voice_minutes: number;
  color: string;
  icon: string;
  badge: { text: string; color: string } | null;
  popular: boolean;
  features_display: Array<{ text: string; icon: string; highlight?: boolean }>;
  features_locked: Array<{ text: string; unlock_plan: string }>;
}

export interface PlansV2Response {
  plans: PlanResponse[];
  currency: string;
  yearly_discount_pct: number;
}

export interface TrialEligibility {
  eligible: boolean;
  reason: string | null;
  trial_days: number;
  trial_plan: ApiBillingPlan;
}
```

Refactor les méthodes :

```typescript
export const billingApi = {
  /** GET /api/billing/plans — grille publique v2. */
  async getPlans(): Promise<PlansV2Response> {
    return apiClient.get("/api/billing/plans");
  },

  /** GET /api/billing/trial-eligibility?plan=pro|expert */
  async checkTrialEligibility(
    plan: ApiBillingPlan = "pro",
  ): Promise<TrialEligibility> {
    return apiClient.get(`/api/billing/trial-eligibility?plan=${plan}`);
  },

  /** POST /api/billing/start-trial?plan=pro|expert&cycle=monthly|yearly */
  async startTrial(
    plan: ApiBillingPlan = "pro",
    cycle: BillingCycle = "monthly",
  ): Promise<{
    checkout_url: string;
    session_id: string;
    trial_days: number;
    plan: string;
    cycle: string;
  }> {
    return apiClient.post(
      `/api/billing/start-trial?plan=${plan}&cycle=${cycle}`,
    );
  },

  /** POST /api/billing/create-checkout body { plan, cycle } */
  async createCheckout(
    plan: ApiBillingPlan,
    cycle: BillingCycle = "monthly",
    success_url?: string,
    cancel_url?: string,
  ): Promise<{ checkout_url: string; session_id: string }> {
    return apiClient.post("/api/billing/create-checkout", {
      plan,
      cycle,
      success_url,
      cancel_url,
    });
  },

  // ... autres méthodes existantes (portal, cancel, etc.) inchangées
};
```

⚠️ Si la méthode existante `startProTrial` (legacy) est utilisée ailleurs, garder un alias :

```typescript
/** @deprecated v0 — use startTrial(plan='pro') instead */
async startProTrial() {
  return this.startTrial("pro", "monthly");
},
```

- [ ] **Step 2: Run le typecheck**

Run : `cd frontend && npm run typecheck 2>&1 | grep -i "billingApi\|BillingCycle\|ApiBillingPlan" | head -20`
Expected : pas d'erreur sur les nouvelles méthodes (mais des erreurs `'plus'` sur les consommateurs — corrigés Tasks 10-11).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(frontend): add v2 billing API methods (startTrial, createCheckout with cycle)"
```

---

### Task 10: Composant BillingToggle — switch monthly/yearly avec badge −17 %

**Files:**

- Create: `frontend/src/components/pricing/BillingToggle.tsx`
- Create: `frontend/src/components/pricing/__tests__/BillingToggle.test.tsx`

- [ ] **Step 1: Écrire les tests Vitest**

Créer `frontend/src/components/pricing/__tests__/BillingToggle.test.tsx` :

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingToggle } from "../BillingToggle";

describe("BillingToggle", () => {
  it("renders monthly active state by default", () => {
    render(<BillingToggle value="monthly" onChange={() => {}} />);
    const monthly = screen.getByRole("button", { name: /mensuel/i });
    expect(monthly).toHaveAttribute("aria-pressed", "true");
  });

  it("renders yearly active state", () => {
    render(<BillingToggle value="yearly" onChange={() => {}} />);
    const yearly = screen.getByRole("button", { name: /annuel/i });
    expect(yearly).toHaveAttribute("aria-pressed", "true");
  });

  it("displays −17 % badge near yearly", () => {
    render(<BillingToggle value="monthly" onChange={() => {}} />);
    expect(screen.getByText(/-17\s*%/)).toBeInTheDocument();
  });

  it("calls onChange('yearly') when clicking annuel", () => {
    const onChange = vi.fn();
    render(<BillingToggle value="monthly" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /annuel/i }));
    expect(onChange).toHaveBeenCalledWith("yearly");
  });

  it("calls onChange('monthly') when clicking mensuel", () => {
    const onChange = vi.fn();
    render(<BillingToggle value="yearly" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /mensuel/i }));
    expect(onChange).toHaveBeenCalledWith("monthly");
  });
});
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd frontend && npm run test -- src/components/pricing/__tests__/BillingToggle.test.tsx`
Expected : FAIL — `Cannot find module '../BillingToggle'`.

- [ ] **Step 3: Implémenter BillingToggle.tsx**

Créer `frontend/src/components/pricing/BillingToggle.tsx` :

```typescript
import { motion } from "framer-motion";
import type { BillingCycle } from "../../services/api";

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}

/**
 * Switch mensuel / annuel pour la pricing page v2.
 * Badge "-17 % / 2 mois offerts" affiché à côté du choix annuel.
 */
export function BillingToggle({ value, onChange, className = "" }: BillingToggleProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        role="group"
        aria-label="Cycle de facturation"
        className="inline-flex items-center rounded-full bg-white/5 border border-white/10 p-1 backdrop-blur-xl"
      >
        <button
          type="button"
          role="button"
          aria-pressed={value === "monthly"}
          onClick={() => onChange("monthly")}
          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            value === "monthly" ? "text-white" : "text-white/60 hover:text-white/80"
          }`}
        >
          {value === "monthly" && (
            <motion.span
              layoutId="billing-toggle-active"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10">Mensuel</span>
        </button>
        <button
          type="button"
          role="button"
          aria-pressed={value === "yearly"}
          onClick={() => onChange("yearly")}
          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            value === "yearly" ? "text-white" : "text-white/60 hover:text-white/80"
          }`}
        >
          {value === "yearly" && (
            <motion.span
              layoutId="billing-toggle-active"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10">Annuel</span>
        </button>
      </div>
      <span
        aria-label="Réduction annuelle"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      >
        -17 % · 2 mois offerts
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run les tests, vérifier qu'ils passent**

Run : `cd frontend && npm run test -- src/components/pricing/__tests__/BillingToggle.test.tsx`
Expected : 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pricing/BillingToggle.tsx frontend/src/components/pricing/__tests__/BillingToggle.test.tsx
git commit -m "feat(pricing): add BillingToggle component (monthly/yearly + -17% badge)"
```

---

### Task 11: Composant ComparisonTable — matrice features × plans

**Files:**

- Create: `frontend/src/components/pricing/ComparisonTable.tsx`
- Create: `frontend/src/components/pricing/__tests__/ComparisonTable.test.tsx`

- [ ] **Step 1: Écrire les tests Vitest**

Créer `frontend/src/components/pricing/__tests__/ComparisonTable.test.tsx` :

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonTable } from "../ComparisonTable";

describe("ComparisonTable", () => {
  it("renders 3 columns (free, pro, expert) + features column", () => {
    render(<ComparisonTable cycle="monthly" />);
    // Headers : 3 plans
    expect(screen.getByText(/^Gratuit$/i)).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Pro$/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /^Expert$/i })).toBeInTheDocument();
  });

  it("displays Pro voice minutes (30) and Expert (120)", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/30\s*min/i)).toBeInTheDocument();
    expect(screen.getByText(/120\s*min/i)).toBeInTheDocument();
  });

  it("shows monthly prices when cycle=monthly", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/8[,.]?99/)).toBeInTheDocument();
    expect(screen.getByText(/19[,.]?99/)).toBeInTheDocument();
  });

  it("shows yearly prices when cycle=yearly", () => {
    render(<ComparisonTable cycle="yearly" />);
    expect(screen.getByText(/89[,.]?90/)).toBeInTheDocument();
    expect(screen.getByText(/199[,.]?90/)).toBeInTheDocument();
  });

  it("highlights popular badge on Pro", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/populaire/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run les tests, vérifier qu'ils échouent**

Run : `cd frontend && npm run test -- src/components/pricing/__tests__/ComparisonTable.test.tsx`
Expected : FAIL — composant absent.

- [ ] **Step 3: Implémenter ComparisonTable.tsx**

Créer `frontend/src/components/pricing/ComparisonTable.tsx` :

```typescript
import { Check, X } from "lucide-react";
import {
  PLAN_LIMITS,
  PLANS_INFO,
  PLAN_HIERARCHY,
  type PlanId,
} from "../../config/planPrivileges";
import type { BillingCycle } from "../../services/api";

interface ComparisonTableProps {
  cycle: BillingCycle;
  className?: string;
}

interface FeatureRow {
  label: string;
  values: Record<PlanId, string | boolean | number>;
}

function formatPriceCents(cents: number): string {
  if (cents === 0) return "0 €";
  const euros = cents / 100;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function buildRows(): FeatureRow[] {
  return [
    {
      label: "Analyses / mois",
      values: {
        free: PLAN_LIMITS.free.monthlyAnalyses,
        pro: PLAN_LIMITS.pro.monthlyAnalyses,
        expert: PLAN_LIMITS.expert.monthlyAnalyses,
      },
    },
    {
      label: "Durée vidéo max",
      values: {
        free: `${PLAN_LIMITS.free.maxVideoLengthMin} min`,
        pro: `${PLAN_LIMITS.pro.maxVideoLengthMin} min`,
        expert: `${PLAN_LIMITS.expert.maxVideoLengthMin} min`,
      },
    },
    {
      label: "Chat / vidéo",
      values: {
        free: PLAN_LIMITS.free.chatQuestionsPerVideo,
        pro: PLAN_LIMITS.pro.chatQuestionsPerVideo,
        expert: PLAN_LIMITS.expert.chatQuestionsPerVideo === -1
          ? "Illimité"
          : PLAN_LIMITS.expert.chatQuestionsPerVideo,
      },
    },
    {
      label: "Mind maps",
      values: {
        free: PLAN_LIMITS.free.mindmapEnabled,
        pro: PLAN_LIMITS.pro.mindmapEnabled,
        expert: PLAN_LIMITS.expert.mindmapEnabled,
      },
    },
    {
      label: "Recherche web IA",
      values: {
        free: false,
        pro: `${PLAN_LIMITS.pro.webSearchMonthly}/mois`,
        expert: `${PLAN_LIMITS.expert.webSearchMonthly}/mois`,
      },
    },
    {
      label: "Playlists",
      values: {
        free: false,
        pro: false,
        expert: `${PLAN_LIMITS.expert.maxPlaylists} max`,
      },
    },
    {
      label: "Export PDF + Markdown",
      values: {
        free: false,
        pro: PLAN_LIMITS.pro.exportPdf,
        expert: PLAN_LIMITS.expert.exportPdf,
      },
    },
    {
      label: "Chat vocal ElevenLabs",
      values: {
        free: false,
        pro: `${PLAN_LIMITS.pro.voiceChatMonthlyMinutes} min/mois`,
        expert: `${PLAN_LIMITS.expert.voiceChatMonthlyMinutes} min/mois`,
      },
    },
    {
      label: "Deep Research",
      values: {
        free: false,
        pro: false,
        expert: PLAN_LIMITS.expert.deepResearchEnabled,
      },
    },
    {
      label: "File prioritaire",
      values: {
        free: false,
        pro: false,
        expert: PLAN_LIMITS.expert.priorityQueue,
      },
    },
  ];
}

function renderCell(value: string | boolean | number) {
  if (value === true) return <Check className="w-5 h-5 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-white/30 mx-auto" />;
  return <span className="text-white">{value}</span>;
}

export function ComparisonTable({ cycle, className = "" }: ComparisonTableProps) {
  const rows = buildRows();
  return (
    <div className={`overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${className}`}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10">
            <th scope="col" className="px-5 py-4 text-sm font-semibold text-white/60">
              Fonctionnalité
            </th>
            {PLAN_HIERARCHY.map((plan) => {
              const info = PLANS_INFO[plan];
              const price = cycle === "monthly" ? info.priceMonthly : info.priceYearly;
              return (
                <th
                  key={plan}
                  scope="col"
                  className="px-5 py-4 text-center"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-bold text-white">{info.name}</span>
                    {info.popular && (
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Populaire
                      </span>
                    )}
                    <span className="text-2xl font-extrabold text-white">
                      {formatPriceCents(price)}
                    </span>
                    <span className="text-xs text-white/50">
                      /{cycle === "monthly" ? "mois" : "an"}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-white/5 last:border-b-0">
              <td className="px-5 py-3 text-sm text-white/80">{row.label}</td>
              {PLAN_HIERARCHY.map((plan) => (
                <td key={plan} className="px-5 py-3 text-center text-sm">
                  {renderCell(row.values[plan])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run les tests**

Run : `cd frontend && npm run test -- src/components/pricing/__tests__/ComparisonTable.test.tsx`
Expected : 5 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pricing/ComparisonTable.tsx frontend/src/components/pricing/__tests__/ComparisonTable.test.tsx
git commit -m "feat(pricing): add ComparisonTable component (matrix features x plans v2)"
```

---

### Task 12: UpgradePage v9 — refonte avec toggle + comparison + dual trial CTA

**Files:**

- Modify: `frontend/src/pages/UpgradePage.tsx`

- [ ] **Step 1: Lire UpgradePage.tsx pour identifier la structure existante**

Run : `cd frontend && wc -l src/pages/UpgradePage.tsx` (info — pas un step de test).

- [ ] **Step 2: Refactor UpgradePage v9**

Modifier `frontend/src/pages/UpgradePage.tsx`. Remplacer le doc-header en haut du fichier :

```typescript
/**
 * UpgradePage v9 — Pricing v2 (Free / Pro 8.99 € / Expert 19.99 €).
 *
 * Différences vs v8 :
 *  - Toggle BillingToggle mensuel / annuel (-17 %)
 *  - Composant ComparisonTable (matrice features x plans)
 *  - 2 CTAs trial : "Essai 7 j gratuit Pro" + "Essai 7 j gratuit Expert"
 *  - api.startTrial(plan, cycle) + api.createCheckout(plan, cycle)
 *  - Affichage prix barré legacy si user.is_legacy_pricing (grandfathering)
 */
```

Importer les nouveaux composants/types :

```typescript
import { useState } from "react";
import { BillingToggle } from "../components/pricing/BillingToggle";
import { ComparisonTable } from "../components/pricing/ComparisonTable";
import {
  billingApi,
  type BillingCycle,
  type ApiBillingPlan,
} from "../services/api";
import { PLANS_INFO, PLAN_HIERARCHY } from "../config/planPrivileges";
```

Dans le composant principal, ajouter le state `cycle` :

```typescript
const [cycle, setCycle] = useState<BillingCycle>("monthly");
const [loadingPlan, setLoadingPlan] = useState<ApiBillingPlan | null>(null);
```

Handlers :

```typescript
async function handleStartTrial(plan: ApiBillingPlan) {
  setLoadingPlan(plan);
  try {
    const { checkout_url } = await billingApi.startTrial(plan, cycle);
    window.location.href = checkout_url;
  } catch (e) {
    // toast error existant
  } finally {
    setLoadingPlan(null);
  }
}

async function handleSubscribe(plan: ApiBillingPlan) {
  setLoadingPlan(plan);
  try {
    const { checkout_url } = await billingApi.createCheckout(plan, cycle);
    window.location.href = checkout_url;
  } catch (e) {
    // toast error
  } finally {
    setLoadingPlan(null);
  }
}
```

Dans le JSX, juste après le hero/headline et avant la grille de plans, insérer :

```tsx
<div className="flex flex-col items-center gap-4 mb-10">
  <BillingToggle value={cycle} onChange={setCycle} />
</div>
```

Pour chaque plan card v2 (boucler sur `PLAN_HIERARCHY` filtré sur `["pro", "expert"]`), afficher 2 boutons :

```tsx
{
  PLAN_HIERARCHY.filter((p) => p !== "free").map((plan) => {
    const info = PLANS_INFO[plan];
    const price = cycle === "monthly" ? info.priceMonthly : info.priceYearly;
    return (
      <div
        key={plan}
        className="rounded-2xl bg-white/5 border border-white/10 p-6 backdrop-blur-xl"
      >
        <h3 className="text-2xl font-bold text-white">{info.name}</h3>
        <p className="text-white/60 text-sm">{info.description}</p>
        <div className="my-4">
          <span className="text-4xl font-extrabold text-white">
            {(price / 100).toFixed(2).replace(".", ",")} €
          </span>
          <span className="text-white/50 ml-1">
            /{cycle === "monthly" ? "mois" : "an"}
          </span>
        </div>
        <button
          onClick={() => handleStartTrial(plan)}
          disabled={loadingPlan === plan}
          className="w-full mb-2 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold disabled:opacity-50"
        >
          {loadingPlan === plan ? "..." : `Essai 7 j gratuit ${info.name}`}
        </button>
        <button
          onClick={() => handleSubscribe(plan)}
          disabled={loadingPlan === plan}
          className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium disabled:opacity-50"
        >
          S'abonner directement
        </button>
      </div>
    );
  });
}
```

Ajouter en bas de page, avant le footer, le tableau comparatif :

```tsx
<section className="mt-16">
  <h2 className="text-2xl font-bold text-white text-center mb-6">
    Comparer les plans
  </h2>
  <ComparisonTable cycle={cycle} className="max-w-5xl mx-auto" />
</section>
```

Ajouter un affichage barré legacy pour les grandfathered users (récupérer `is_legacy_pricing` depuis le user context) :

```tsx
{
  user?.is_legacy_pricing && (
    <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 mb-6 text-sm text-amber-200">
      🎁 Vous bénéficiez du tarif historique{" "}
      <strong>
        {user.plan === "pro"
          ? "4,99 €/mois"
          : user.plan === "expert"
            ? "9,99 €/mois"
            : ""}
      </strong>
      . Vous gardez ce prix tant que votre abonnement reste actif.
    </div>
  );
}
```

- [ ] **Step 3: Run le typecheck**

Run : `cd frontend && npm run typecheck 2>&1 | tail -20`
Expected : pas d'erreur sur UpgradePage. S'il reste des erreurs sur d'autres fichiers consommant `"plus"`, les noter pour follow-up.

- [ ] **Step 4: Lancer le frontend en dev pour smoke test visuel**

Run : `cd frontend && npm run dev`
Ouvrir `http://localhost:5173/upgrade`. Vérifier :

- Toggle mensuel/annuel s'affiche, badge -17 % visible
- Switch annuel : prix passent à 89,90 € / 199,90 €
- 2 CTAs par plan : "Essai 7 j gratuit Pro" + "S'abonner directement"
- ComparisonTable rendue en bas avec voice 30 min / 120 min

(Couper le dev server après vérif visuelle).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/UpgradePage.tsx
git commit -m "feat(upgrade): UpgradePage v9 — BillingToggle + ComparisonTable + dual trial CTA (Pro/Expert)"
```

---

## Self-Review

### 1. Spec coverage

- ✅ H1 Pro 8,99 / 89,90 € : Tasks 2, 3, 8, 11
- ✅ H2 Expert 19,99 / 199,90 € : Tasks 2, 3, 8, 11
- ✅ H3 Grandfathering : Task 1 (colonne + backfill) + Task 12 (affichage)
- ✅ H4 Voice Pro 30 / Expert 120 : Tasks 2, 7, 8
- ✅ H5 Trial 7 j sans CB Pro+Expert : Task 5 (`payment_method_collection="if_required"`)
- ✅ H6 4 Stripe Prices : Tasks 3, 4
- ✅ H7 `users.is_legacy_pricing` : Task 1
- ✅ H8 Plans hardcodés : tout le plan reste sur `plan_config.py` + `planPrivileges.ts`, aucun chargement DB-driven
- ✅ Toggle mensuel/annuel : Task 10 + 12
- ✅ Migration atomique CASE : Task 1 step 3
- ✅ Aliases inversés : Tasks 2 et 8
- ✅ Tests pytest + Vitest pour migration, helpers, endpoints, composants : Tasks 1, 2, 3, 5, 6, 7, 8, 10, 11

### 2. Décisions à confirmer (questions ouvertes pour l'équipe)

| ID     | Question                                                                                                                                              | Default proposé                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **D1** | Branche unique `release/pricing-v2` shared avec SEO Phase 0, ou 2 branches qui rebase l'une sur l'autre ?                                             | Branche unique (release-train classique)                                              |
| **D2** | Stripe : seed TEST mode d'abord (preview Vercel + staging), puis LIVE seulement après validation manuelle E2E ?                                       | Oui — séquentiel, pas de seed LIVE en CI                                              |
| **D3** | Migration des subs Stripe legacy (clients déjà sur ancien Plus 4,99) vers nouveau Price ID Pro 8,99 ? Ou laisser legacy actif jusqu'à churn naturel ? | Laisser legacy (H3 = grandfathering durable)                                          |
| **D4** | Marketing : afficher le prix legacy barré (4,99 → 8,99) sur UpgradePage pour les grandfathered ? Ou banner discret seulement (cf Task 12 step 2) ?    | Banner discret amber (déjà implémenté)                                                |
| **D5** | App mobile : refonte pricing dans ce plan ou plan séparé ?                                                                                            | Plan séparé — mobile/UpgradeScreen.tsx hors scope ici (pricing v2 mobile = follow-up) |

### 3. Placeholder scan

Aucun "TBD", "TODO", "implement later", "fill in details" trouvé. Toutes les tasks contiennent du code complet exécutable.

### 4. Type consistency

- ✅ `PlanId` cohérent backend (Python enum) + frontend (TS union) = `"free" | "pro" | "expert"`
- ✅ `BillingCycle` = `"monthly" | "yearly"` exporté depuis `services/api.ts` et utilisé par `BillingToggle`, `ComparisonTable`, `UpgradePage`
- ✅ `get_voice_minutes(plan)` (Python) + `PLAN_LIMITS[plan].voiceChatMonthlyMinutes` (TS) → mêmes valeurs (0 / 30 / 120)
- ✅ `get_price_id(plan, cycle, test_mode)` (Python) ↔ env vars `STRIPE_PRICE_{PLAN}_{CYCLE}_{MODE}` cohérent dans `core/config.py` + `seed_stripe_prices_v2.py`
- ✅ `is_legacy_pricing` même nom backend (DB column) + frontend (User context)

---

## Release coordination

Ce plan est un **release-train coordonné** avec :

1. **Plan SEO Phase 0** (`2026-04-29-audit-kimi-phase-0-seo-securite.md`, à venir batch 2) :
   - Doivent merger ENSEMBLE sur branche commune `release/pricing-v2`.
   - Sinon : SEO annonce 8,99 € en prod pendant Stripe facture l'ancien 4,99 € → incohérence marketing/billing.
   - Coordination concrète : créer `release/pricing-v2` après merge des deux feature branches dans une PR aggrégée vers `main`.

2. **Plan ElevenLabs voice packs** (`2026-04-29-elevenlabs-voice-packs.md`, parallèle batch 2) :
   - Indépendant pricing — Alembic 010 (ne touche pas `users.plan`).
   - Peut merger en parallèle. Ordre : Alembic 010 → Alembic 011 (chaining naturel via `down_revision = "010_add_conversation_digests"` confirmé Task 1).

3. **Plan plans-DB-driven** (`2026-04-29-plans-db-driven.md`) :
   - `BLOCKED-BY` ce plan. Ne peut pas commencer tant que `pro`/`expert` ne sont pas les noms canoniques en DB + code.

### Checklist coordination merge

- [ ] Merge des deux PRs (pricing-v2 + SEO Phase 0) dans `release/pricing-v2` (squash interdit, merge commit pour traçabilité)
- [ ] Tag de la branche `release/pricing-v2` avec `pricing-v2-rc1`
- [ ] Run E2E sur staging avec :
  - [ ] Migration 011 appliquée sur snapshot prod (validation grandfathering backfill)
  - [ ] Stripe TEST seedé via `seed_stripe_prices_v2.py` mode test
  - [ ] Smoke check UpgradePage staging affiche les bons prix (8,99 / 19,99 / 89,90 / 199,90)
- [ ] PR `release/pricing-v2` → `main` avec :
  - [ ] Description complète : tableaux v0 → v2, capture UpgradePage v9, screenshots toggle, mention grandfathering
  - [ ] Checklist déploiement post-merge (run seed Stripe LIVE, set 8 env vars Hetzner, restart container)
- [ ] Post-merge sur `main` :
  - [ ] Push → Vercel auto-deploy frontend
  - [ ] SSH Hetzner : `cd /opt/deepsight/repo && git pull && docker build` + restart container avec `RUN_MIGRATIONS=true`
  - [ ] Vérifier `users.is_legacy_pricing` populée correctement en prod (count des subs actifs)
  - [ ] Run `seed_stripe_prices_v2.py` mode LIVE depuis VPS
  - [ ] Coller les 4 Price IDs LIVE dans `.env.production` Hetzner et restart container
  - [ ] Vérification E2E manuelle prod : checkout Pro mensuel + Expert annuel + trial Pro

### Rollback plan

En cas de problème post-merge :

1. `git revert` du merge commit `release/pricing-v2` → `main`
2. `alembic downgrade -1` pour reverse-rename `pro→plus` / `expert→pro` (Task 1 step 3 a un downgrade complet)
3. Restart container backend
4. Stripe Prices v2 restent créés mais inutilisés — pas de cleanup nécessaire (idempotence)

---

## Execution Handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-29-pricing-v2-stripe-grandfathering.md`. Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent frais par task, review entre les tasks, itération rapide. SKILL : `superpowers:subagent-driven-development`.

2. **Inline Execution** — tasks dans la session courante avec batch + checkpoints. SKILL : `superpowers:executing-plans`.

Quelle approche ?

### Manual E2E checklist (Task 12 / post-merge)

Une fois Tasks 1-12 mergées + Stripe seedé, cocher manuellement en staging puis prod :

- [ ] Checkout Pro mensuel : carte test 4242, abonnement créé, `user.plan = "pro"`, `user.is_legacy_pricing = false`
- [ ] Checkout Pro annuel : même flow, prix 89,90 € en banner Stripe
- [ ] Checkout Expert mensuel : 19,99 €, `user.plan = "expert"`
- [ ] Checkout Expert annuel : 199,90 €
- [ ] Trial Pro : redirect vers Stripe Checkout en mode `if_required` (pas de CB demandée), DB `user.plan = "pro"` après webhook trial-start, factureation déclenchée à J+7 si CB ajoutée
- [ ] Trial Expert : idem
- [ ] Grandfathering simulation : créer un user en DB avec `plan = "pro"` + `is_legacy_pricing = true` + `stripe_subscription_id = "sub_legacy"`, vérifier banner amber 4,99 € sur UpgradePage et que `/portal` Stripe renvoie ancien Price ID
- [ ] Voice quota Pro : appel test 31e min → erreur quota dépassé (confirme 30 min H4)
- [ ] Voice quota Expert : appel test 121e min → erreur quota dépassé
