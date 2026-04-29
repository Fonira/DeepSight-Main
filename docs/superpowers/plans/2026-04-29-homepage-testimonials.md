# Homepage Testimonials + TrustBadges + SocialProofCounter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combler le gap social proof identifié par l'audit Kimi 2026-04-29 (`Phase 1 — UX/Conversion`) en ajoutant trois sections sur `frontend/src/pages/LandingPage.tsx` : 3 témoignages chiffrés (placeholders fictifs avec garde-fou anti-prod), 5 trust badges sous CTAs, 3 compteurs de social proof réels alimentés par un nouvel endpoint backend public cacheé Redis 1 h. Conversion estimée +20-30 % par l'audit.

**Architecture:** (1) Backend — nouveau module `landing/` avec router public `GET /api/public/landing-stats` qui agrège `User.total_videos`, `User.total_words`, `count(distinct user_id récent)` via SQLAlchemy, mis en cache Redis 1 h via `cache_service.get_or_set`. (2) Frontend — 3 nouveaux composants dans `frontend/src/components/landing/` (`Testimonials.tsx`, `TrustBadges.tsx`, `SocialProofCounter.tsx`) typés strict, animés Framer Motion (`useInView`/`ScrollReveal`), data testimonials inline avec flag `isPlaceholder: true` + badge "Démo" visible en `import.meta.env.DEV`, fetch stats via `landingApi.getStats()`. (3) Intégration dans `LandingPage.tsx` : `SocialProofCounter` en bandeau juste après hero, `Testimonials` après section Demo, `TrustBadges` sous `<PricingSection>`. (4) i18n complet FR + EN.

**Tech Stack:** Backend = FastAPI + SQLAlchemy 2.0 async + Pydantic v2 + Redis 7 via `core.cache.cache_service`. Frontend = React 18 + TypeScript strict + Tailwind CSS 3 + Framer Motion 12 + Lucide icons. Tests = pytest + pytest-asyncio (backend), Vitest + Testing Library (frontend).

---

## ⚠️ AVERTISSEMENT ÉTHIQUE — À LIRE AVANT EXÉCUTION

Les **3 témoignages seed** intégrés à `Testimonials.tsx` sont **fictifs** :

| Persona      | Citation                                                                                      | Métrique           |
| ------------ | --------------------------------------------------------------------------------------------- | ------------------ |
| Dr. Marie L. | "J'analysais 2h de conférences en 30 min. Le fact-checking m'a fait gagner une demi-journée." | 2 h → 30 min       |
| Thomas B.    | "Vérifier les affirmations des vidéos avec timecodes et sources ? Indispensable."             | 3 fact-checks/jour |
| Léa K.       | "Les flashcards FSRS me font réviser 3x plus efficacement."                                   | +40 % rétention    |

**Garde-fou implémenté côté code** :

- Chaque entrée porte `isPlaceholder: true` dans la data.
- En `import.meta.env.PROD === true`, le composant `Testimonials` retourne `null` si `entries.every(e => e.isPlaceholder)` — la section ne s'affiche pas en prod.
- En `import.meta.env.DEV === true` (dev/staging), un badge **« Démo »** est affiché en haut de la section pour éviter la confusion.

**Décision business à valider AVANT déploiement Vercel `main`** : retirer les flags `isPlaceholder: true` n'est autorisé que si l'utilisateur (Maxime) tranche soit (a) attendre vrais utilisateurs ayant donné consentement écrit, soit (b) accepter publiquement ces 3 fictifs comme "personas illustratifs" avec mention en bas de section. La PR ne peut pas être mergée vers `main` tant qu'aucune des deux options n'a été validée. Cf. section Self-Review.

---

## Contexte préalable — État actuel

### Audit gap (Phase 1 — UX/Conversion)

> "Social proof totalement absent : aucun témoignage, aucun logo client, aucun compteur. Recommandations : 3 témoignages chiffrés. Compteur social. Badge garantie 14 j visible sous CTAs."

### Cohérence avec autres plans datés 2026-04-29

D'après `docs/superpowers/plans/2026-04-29-RELEASE-ORCHESTRATION.md` (commit `021e4bf1`) :

- Ce plan fait partie du **Sprint A — Quick wins** (semaine 1) et est déclaré déployable seul, sans toucher Alembic ni Pricing v2.
- Aucun couplage atomique avec un autre plan. Aucune migration backend.
- Le seul fichier partagé avec d'autres plans est `frontend/src/services/api.ts` (User interface intacte ici, ajout d'un nouvel objet `landingApi` — zéro conflit avec #2 dashboard, #4 voice-packs, #7 pricing-v2, #8 parrainage).
- LandingPage.tsx est aussi touchée par #6 PostHog (instrumentation hero/footer) et #8 parrainage (`useEffect ?ref=`) : zones disjointes, pas de collision.
- Le plan `2026-04-29-plans-db-driven.md` (commit `021e4bf1`) prouve que le pattern **`/api/admin/stats` lignes 102-156 de `backend/src/admin/router.py`** est le modèle SQL canonique pour agréger `User.total_videos`, `User.total_words`, `count(User)` — directement réutilisé ici (sans le `Depends(get_current_admin)`) pour notre endpoint public.

### État actuel du code (vérifié)

**LandingPage.tsx** (`frontend/src/pages/LandingPage.tsx`, 1472 lignes, v9.0) :

- Header sticky lignes 626-647.
- HERO section lignes 649-944 (CTA "Créer un compte" + guest demo input).
- Demo statique lignes 1072-1077 (`<DemoAnalysisStatic>` + `<DemoChatStatic>`).
- Pricing lignes 1365-1366 (`<PricingSection>`).
- FAQ JSON-LD lignes 601-618.
- Footer lignes 1430-1467.
- Helpers `ScrollReveal` lignes 62-81, `StaggerReveal` lignes 83-110.
- Contient `import { useTranslation }` ligne 34 mais utilise majoritairement `language === "fr"` ternaires inline.
- **Aucune section testimonials/trust badges/social proof counter** (vérifié `grep`).

**PricingSection.tsx** (`frontend/src/components/landing/PricingSection.tsx`, 402 lignes) :

- Pattern Framer Motion `useInView` ligne 178-179, animations `motion.div initial/animate` lignes 187-188.
- `ease = [0.4, 0, 0.2, 1] as const` ligne 15.
- Default export ligne 173 (`export default function PricingSection`).

**Barrel** (`frontend/src/components/landing/index.ts`, 3 lignes) :

```typescript
export { default as DemoAnalysisStatic } from "./DemoAnalysisStatic";
export { default as DemoChatStatic } from "./DemoChatStatic";
export { default as PricingSection } from "./PricingSection";
```

**i18n** (`frontend/src/i18n/{fr,en}.json`) — namespace `landing` existant avec sous-clés `badge`, `hero`, `stats`, `features`, `audiences`, `pricing`, `cta`. **Aucune sous-clé `testimonials`, `trust_badges` ou `social_proof`** — à ajouter.

**Backend** (`backend/src/`) :

- Pas de module `landing/` (vérifié `ls`).
- `admin/router.py` ligne 102-156 = template SQL pour stats.
- `core/cache.py` expose `cache_service.get_or_set(key, factory, ttl)` ligne 388.
- `main.py` ligne 192-199 montre le pattern d'inclusion conditionnelle de routers (try/except + `LANDING_ROUTER_AVAILABLE`).

**API client** (`frontend/src/services/api.ts`, 3036+ lignes) :

- Ligne 16 : `export const API_URL = import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com"`.
- Ligne 486-495 : `interface RequestOptions` avec flags `skipAuth` et `skipCredentials`.
- Ligne 497-510 : `async function request<T>(endpoint, options)` est le helper centralisé.
- Ligne 904-936 : `demoApi` est le pattern à imiter pour un endpoint public (utilise `skipAuth: true, skipCredentials: true`).

### Conventions de design (`frontend/CLAUDE.md` + `LandingPage.tsx`)

- Dark mode first : `bg-bg-primary` (`#0a0a0f`), surfaces `bg-bg-secondary/40`, borders `border-border-subtle` (= `border-white/5`).
- Glassmorphism : `backdrop-blur-xl bg-white/5 border border-white/10` (extrait `header` ligne 626).
- Accents : Indigo `#6366f1` (`accent-primary`), Violet `bg-violet-500`, Cyan `bg-cyan-400`.
- Animations Framer Motion 12 : pattern `useInView(ref, { once: true, margin: "-60px" })`.
- Typography : `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-muted`.
- Responsive breakpoints : `sm:` (640), `md:` (768), `lg:` (1024), `xl:` (1280).

### Garantie 14 jours déjà mentionnée mais hors trust badges

`PricingSection.tsx` ligne 354-368 contient déjà 3 garanties inline (annulation, remboursement 14 j, données EU) sous le grid pricing. Notre `TrustBadges` les **complète** (placement différent — sous `<PricingSection>` dans LandingPage, pas dans PricingSection elle-même) avec 5 badges distincts (les 3 ci-dessus + 2 nouveaux = IA française & souveraine, paiement Stripe). La duplication "remboursement 14 j" est **volontaire** (rappel après tarifs).

---

## File Structure

| Chemin (absolu)                                                         | Action | Responsabilité                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/landing/__init__.py`                                       | Create | Module init (commentaire description, vide en code)                                                                                                                                                                                                                                                                                                                               |
| `backend/src/landing/router.py`                                         | Create | Router public `/api/public/landing-stats` agrégeant `User.total_videos`, `User.total_words`, distinct user_id 30 j ; cache Redis 1 h ; aucune auth                                                                                                                                                                                                                                |
| `backend/src/main.py`                                                   | Modify | Ajouter try/except import `landing.router as landing_router` + `LANDING_ROUTER_AVAILABLE` flag + `app.include_router(...)` dans la section "INCLUSION DES ROUTERS"                                                                                                                                                                                                                |
| `backend/tests/landing/__init__.py`                                     | Create | Vide                                                                                                                                                                                                                                                                                                                                                                              |
| `backend/tests/landing/test_router.py`                                  | Create | Tests pytest-asyncio : endpoint sans auth → 200, payload schema, cache hit (deuxième appel = même valeur sans nouvelle query DB)                                                                                                                                                                                                                                                  |
| `frontend/src/components/landing/Testimonials.tsx`                      | Create | Section 3 cards témoignages avec quote, étoiles, métrique badge, avatar initiales, badge "Démo" en dev, retourne `null` si all-placeholder en prod                                                                                                                                                                                                                                |
| `frontend/src/components/landing/TrustBadges.tsx`                       | Create | Bandeau 5 badges horizontaux glassmorphism (IA française, archives à vie, RGPD, garantie 14 j, Stripe sécurisé)                                                                                                                                                                                                                                                                   |
| `frontend/src/components/landing/SocialProofCounter.tsx`                | Create | 3 compteurs avec animation count-up Framer Motion ; fetch via `landingApi.getStats()` ; skeleton loading ; fallback graceful si erreur réseau                                                                                                                                                                                                                                     |
| `frontend/src/components/landing/index.ts`                              | Modify | Ajouter `export { default as Testimonials } from "./Testimonials";` etc.                                                                                                                                                                                                                                                                                                          |
| `frontend/src/components/landing/__tests__/Testimonials.test.tsx`       | Create | Vitest + Testing Library : rendu 3 cards FR, rendu EN, badge Démo en DEV (mock `import.meta.env.DEV = true`), retourne null en PROD si all placeholder                                                                                                                                                                                                                            |
| `frontend/src/components/landing/__tests__/TrustBadges.test.tsx`        | Create | Vitest : rendu 5 badges, i18n FR/EN, ARIA labels                                                                                                                                                                                                                                                                                                                                  |
| `frontend/src/components/landing/__tests__/SocialProofCounter.test.tsx` | Create | Vitest : rendu skeleton initial, rendu 3 compteurs après resolve mock fetch, fallback erreur réseau (compteurs masqués)                                                                                                                                                                                                                                                           |
| `frontend/src/i18n/fr.json`                                             | Modify | Ajouter sous-clés `landing.testimonials`, `landing.trust_badges`, `landing.social_proof`                                                                                                                                                                                                                                                                                          |
| `frontend/src/i18n/en.json`                                             | Modify | Idem en anglais                                                                                                                                                                                                                                                                                                                                                                   |
| `frontend/src/services/api.ts`                                          | Modify | Ajouter `interface LandingStatsResponse` + `export const landingApi = { getStats() }` (utilise `skipAuth: true, skipCredentials: true` comme `demoApi`)                                                                                                                                                                                                                           |
| `frontend/src/pages/LandingPage.tsx`                                    | Modify | (a) Insérer `<SocialProofCounter language={language} />` après hero (juste avant le Demo statique vers ligne 944) ; (b) Insérer `<Testimonials language={language} />` après le `<section>` Demo lignes 1072-1077 ; (c) Insérer `<TrustBadges language={language} />` directement après `<PricingSection ... />` ligne 1366 ; (d) Mettre à jour les imports du barrel ligne 45-49 |
| `scripts/check-no-placeholders-in-prod.cjs` (optionnel — Task 8)        | Create | Script Node lancé en pré-deploy CI qui scanne `Testimonials.tsx` ; échoue si `isPlaceholder: true` ET `process.env.NODE_ENV === "production"` ET `DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS !== "yes"`                                                                                                                                                                                    |

**Note importante sur l'organisation des tests frontend** : le projet n'utilise pas un dossier `__tests__/` au niveau de `components/landing/` aujourd'hui, mais le pattern existe ailleurs (`frontend/src/components/__tests__/`, `frontend/src/components/voice/__tests__/`). On crée donc `frontend/src/components/landing/__tests__/` à plat — c'est cohérent avec le pattern le plus répandu du projet.

---

## Tasks

### Task 1 : Backend — endpoint public `/api/public/landing-stats` avec cache Redis 1 h

**Files:**

- Create : `backend/src/landing/__init__.py`
- Create : `backend/src/landing/router.py`
- Modify : `backend/src/main.py` (deux endroits — import section vers ligne 192, include_router section vers ligne 1078)
- Create : `backend/tests/landing/__init__.py`
- Create : `backend/tests/landing/test_router.py`

- [ ] **Step 1 : Créer le test failing**

Créer le fichier vide `backend/tests/landing/__init__.py`.

Créer `backend/tests/landing/test_router.py` :

```python
"""Tests pour le router landing public (stats homepage)."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def landing_app():
    """Instancie une app FastAPI minimaliste avec le router landing seul."""
    from fastapi import FastAPI
    from landing.router import router as landing_router

    app = FastAPI()
    app.include_router(landing_router)
    return app


@pytest.fixture
def client(landing_app):
    return TestClient(landing_app)


@pytest.mark.asyncio
async def test_landing_stats_endpoint_no_auth_required(client, monkeypatch):
    """L'endpoint doit répondre 200 sans header Authorization."""
    # Mock cache_service.get_or_set pour retourner une valeur fixe
    fake_stats = {
        "total_videos_analyzed": 1234,
        "total_words_synthesized": 56789012,
        "active_users_30d": 87,
    }

    async def fake_get_or_set(key, factory, ttl=None):
        return fake_stats

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["total_videos_analyzed"] == 1234
    assert data["total_words_synthesized"] == 56789012
    assert data["active_users_30d"] == 87


@pytest.mark.asyncio
async def test_landing_stats_response_schema(client, monkeypatch):
    """Le payload doit contenir exactement les 3 champs typés int."""
    fake_stats = {
        "total_videos_analyzed": 0,
        "total_words_synthesized": 0,
        "active_users_30d": 0,
    }

    async def fake_get_or_set(key, factory, ttl=None):
        return fake_stats

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"total_videos_analyzed", "total_words_synthesized", "active_users_30d"}
    assert isinstance(data["total_videos_analyzed"], int)
    assert isinstance(data["total_words_synthesized"], int)
    assert isinstance(data["active_users_30d"], int)


@pytest.mark.asyncio
async def test_landing_stats_uses_cache_with_ttl_3600(client, monkeypatch):
    """Vérifie que cache_service.get_or_set est appelé avec ttl=3600 et clé stable."""
    captured = {}

    async def fake_get_or_set(key, factory, ttl=None):
        captured["key"] = key
        captured["ttl"] = ttl
        return {
            "total_videos_analyzed": 1,
            "total_words_synthesized": 2,
            "active_users_30d": 3,
        }

    from core import cache as cache_module
    monkeypatch.setattr(cache_module.cache_service, "get_or_set", fake_get_or_set)

    response = client.get("/api/public/landing-stats")
    assert response.status_code == 200
    assert captured["key"] == "landing:public_stats"
    assert captured["ttl"] == 3600
```

- [ ] **Step 2 : Lancer les tests, vérifier qu'ils échouent**

Run :

```bash
cd backend && python -m pytest tests/landing/test_router.py -v
```

Expected : `ModuleNotFoundError: No module named 'landing'`.

- [ ] **Step 3 : Créer le module `landing/__init__.py`**

Créer `backend/src/landing/__init__.py` :

```python
"""Landing module — endpoints publics pour la homepage (stats agrégées sans auth)."""
```

- [ ] **Step 4 : Créer le router `backend/src/landing/router.py`**

Créer le fichier complet :

```python
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  🌐 LANDING PUBLIC ROUTER — Stats homepage (no auth)                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  GET /api/public/landing-stats                                               ║
║  Renvoie 3 compteurs agrégés (vidéos analysées, mots synthétisés,            ║
║  utilisateurs actifs 30 j) avec cache Redis 1 h.                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_session, User, Summary
from core.cache import cache_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/public", tags=["Landing Public"])


# ═══════════════════════════════════════════════════════════════════════════════
# 📊 SCHEMAS
# ═══════════════════════════════════════════════════════════════════════════════


class LandingStatsResponse(BaseModel):
    """Compteurs agrégés exposés publiquement sur la homepage."""

    total_videos_analyzed: int
    total_words_synthesized: int
    active_users_30d: int


# ═══════════════════════════════════════════════════════════════════════════════
# 🎯 ENDPOINT
# ═══════════════════════════════════════════════════════════════════════════════


CACHE_KEY = "landing:public_stats"
CACHE_TTL_SECONDS = 3600  # 1 hour


async def _compute_landing_stats(session: AsyncSession) -> dict:
    """Calcule les 3 agrégats à partir de la DB. Modèle SQL inspiré
    de admin/router.py:102-156 mais sans auth admin."""
    total_videos_result = await session.execute(select(func.coalesce(func.sum(User.total_videos), 0)))
    total_videos = int(total_videos_result.scalar() or 0)

    total_words_result = await session.execute(select(func.coalesce(func.sum(User.total_words), 0)))
    total_words = int(total_words_result.scalar() or 0)

    cutoff = datetime.utcnow() - timedelta(days=30)
    active_users_result = await session.execute(
        select(func.count(distinct(Summary.user_id))).where(Summary.created_at >= cutoff)
    )
    active_users = int(active_users_result.scalar() or 0)

    return {
        "total_videos_analyzed": total_videos,
        "total_words_synthesized": total_words,
        "active_users_30d": active_users,
    }


@router.get("/landing-stats", response_model=LandingStatsResponse)
async def get_landing_stats(session: AsyncSession = Depends(get_session)):
    """
    📊 Compteurs publics homepage.

    - **total_videos_analyzed** : sum(User.total_videos) — toutes les analyses cumulées
    - **total_words_synthesized** : sum(User.total_words) — tous les mots des synthèses
    - **active_users_30d** : count distinct user_id avec une Summary créée < 30 j

    Cache Redis 1 h (clé `landing:public_stats`). Pas d'auth requise.
    """

    async def _factory():
        return await _compute_landing_stats(session)

    stats = await cache_service.get_or_set(CACHE_KEY, _factory, ttl=CACHE_TTL_SECONDS)

    if stats is None:
        # cache_service KO : recompute live
        logger.warning("cache_service.get_or_set returned None for %s, computing live", CACHE_KEY)
        stats = await _compute_landing_stats(session)

    return LandingStatsResponse(**stats)
```

**Note importante** : `cache_service.get_or_set` peut accepter une factory async (cf. `backend/src/core/cache.py` ligne 388 — `Callable[[], T]`). Le test Step 1 mocke directement le résultat retourné, donc l'inspection précise de la signature factory est non-bloquante pour le test ; néanmoins on **doit** confirmer que la factory async est bien acceptée. Si le décorateur attend du sync, fallback inline :

```python
        cached = await cache_service.get(CACHE_KEY)
        if cached is not None:
            return LandingStatsResponse(**cached)
        stats = await _compute_landing_stats(session)
        await cache_service.set(CACHE_KEY, stats, ttl=CACHE_TTL_SECONDS)
        return LandingStatsResponse(**stats)
```

- [ ] **Step 5 : Lancer les tests, vérifier qu'ils passent**

Run :

```bash
cd backend && python -m pytest tests/landing/test_router.py -v
```

Expected : `3 passed`.

Si le test 3 échoue parce que `factory` est async-only, basculer sur le fallback `cache_service.get/set` inline (cf. note Step 4) et re-tester.

- [ ] **Step 6 : Inclure le router dans `backend/src/main.py`**

Repérer la section "Public API router" lignes 192-199 puis ajouter **juste après** (toujours dans la zone `try/except ImportError`) :

```python
# 🌐 NOUVEAU: Landing public router (stats homepage sans auth)
try:
    from landing.router import router as landing_router

    LANDING_ROUTER_AVAILABLE = True
except ImportError as e:
    LANDING_ROUTER_AVAILABLE = False
    logger.warning(f"⚠️ Landing router not available: {e}")
```

Puis dans la section "INCLUSION DES ROUTERS" — repérer le bloc `if API_PUBLIC_ROUTER_AVAILABLE:` lignes 1077-1080 et ajouter **juste après** :

```python
# 🌐 NOUVEAU: Landing public router
if LANDING_ROUTER_AVAILABLE:
    app.include_router(landing_router, tags=["Landing Public"])
    logger.info("🌐 Landing router loaded (public stats homepage)")
```

Note : le router contient déjà `prefix="/api/public"` dans sa définition, donc on **ne** repasse pas de prefix ici (sinon double prefix).

- [ ] **Step 7 : Smoke test local — démarrer le backend, curl l'endpoint**

Run :

```bash
cd backend/src && uvicorn main:app --port 8000 --reload &
sleep 4
curl -s http://localhost:8000/api/public/landing-stats | python -m json.tool
```

Expected : JSON valide avec 3 clés `total_videos_analyzed`, `total_words_synthesized`, `active_users_30d` (toutes int >= 0).

Stopper uvicorn (`kill %1`).

- [ ] **Step 8 : Commit**

```bash
git add backend/src/landing/__init__.py backend/src/landing/router.py backend/src/main.py backend/tests/landing/__init__.py backend/tests/landing/test_router.py
git commit -m "feat(landing): add public stats endpoint with redis cache 1h

- New module backend/src/landing/ exposing GET /api/public/landing-stats
- Aggregates User.total_videos, User.total_words, distinct active users (30d)
- Cache key 'landing:public_stats' with ttl=3600s via cache_service
- 3 pytest-asyncio tests covering no-auth, schema, cache invocation
- Wired into main.py via try/except (LANDING_ROUTER_AVAILABLE flag)"
```

---

### Task 2 : Frontend — `Testimonials.tsx` avec data placeholder + flag `isPlaceholder` + badge "Démo" en dev

**Files:**

- Create : `frontend/src/components/landing/Testimonials.tsx`
- Create : `frontend/src/components/landing/__tests__/Testimonials.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Créer `frontend/src/components/landing/__tests__/Testimonials.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Testimonials from "../Testimonials";

describe("Testimonials", () => {
  const originalEnv = { ...import.meta.env };

  afterEach(() => {
    // restore vitest stub
    vi.unstubAllEnvs();
  });

  it("renders 3 testimonial cards in French", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    expect(screen.getByText(/Dr\. Marie L\./i)).toBeInTheDocument();
    expect(screen.getByText(/Thomas B\./i)).toBeInTheDocument();
    expect(screen.getByText(/Léa K\./i)).toBeInTheDocument();
    // Métriques visibles
    expect(screen.getByText(/2h\s*→\s*30 min/i)).toBeInTheDocument();
    expect(screen.getByText(/3 fact-checks\/jour/i)).toBeInTheDocument();
    expect(screen.getByText(/\+40\s*%\s*rétention/i)).toBeInTheDocument();
  });

  it("renders 3 testimonial cards in English", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="en" />);
    expect(screen.getByText(/Dr\. Marie L\./i)).toBeInTheDocument();
    expect(screen.getByText(/Thomas B\./i)).toBeInTheDocument();
    expect(screen.getByText(/Léa K\./i)).toBeInTheDocument();
  });

  it("displays a 'Démo' badge when DEV", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    expect(screen.getByTestId("testimonials-demo-badge")).toBeInTheDocument();
    expect(screen.getByTestId("testimonials-demo-badge")).toHaveTextContent(
      /démo/i,
    );
  });

  it("returns null when PROD and all entries are placeholder", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("PROD", true);
    const { container } = render(<Testimonials language="fr" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders avatar initials from author name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("PROD", false);
    render(<Testimonials language="fr" />);
    // "Dr. Marie L." -> "ML" (initials of first non-honorific words)
    expect(
      screen.getByLabelText(/avatar de Dr\. Marie L\./i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run :

```bash
cd frontend && npm run test -- Testimonials.test
```

Expected : `Failed to resolve import "../Testimonials"`.

- [ ] **Step 3 : Implémenter `Testimonials.tsx`**

Créer `frontend/src/components/landing/Testimonials.tsx` :

```tsx
/**
 * Testimonials — 3 cards témoignages chiffrés
 *
 * ⚠️ Les 3 témoignages seed sont fictifs (`isPlaceholder: true`).
 * En prod, le composant retourne null si toutes les entrées sont placeholder.
 * En dev/staging, un badge "Démo" rappelle leur statut fictif.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Quote, Star } from "lucide-react";

const ease = [0.4, 0, 0.2, 1] as const;

export interface TestimonialEntry {
  id: string;
  author: string;
  roleFr: string;
  roleEn: string;
  quoteFr: string;
  quoteEn: string;
  metricFr: string;
  metricEn: string;
  isPlaceholder: boolean;
}

const TESTIMONIALS: TestimonialEntry[] = [
  {
    id: "marie-l",
    author: "Dr. Marie L.",
    roleFr: "Chercheuse CNRS",
    roleEn: "CNRS Researcher",
    quoteFr:
      "J'analysais 2h de conférences en 30 min. Le fact-checking m'a fait gagner une demi-journée.",
    quoteEn:
      "I used to spend 2h on conference videos — now 30 min. Fact-checking saved me half a day.",
    metricFr: "2h → 30 min",
    metricEn: "2h → 30 min",
    isPlaceholder: true,
  },
  {
    id: "thomas-b",
    author: "Thomas B.",
    roleFr: "Journaliste, agence régionale",
    roleEn: "Journalist, regional agency",
    quoteFr:
      "Vérifier les affirmations des vidéos avec timecodes et sources ? Indispensable.",
    quoteEn:
      "Verifying video claims with timecodes and sources? Indispensable.",
    metricFr: "3 fact-checks/jour",
    metricEn: "3 fact-checks/day",
    isPlaceholder: true,
  },
  {
    id: "lea-k",
    author: "Léa K.",
    roleFr: "Étudiante Master Droit",
    roleEn: "Law Master's student",
    quoteFr: "Les flashcards FSRS me font réviser 3x plus efficacement.",
    quoteEn: "FSRS flashcards make me review 3x more efficiently.",
    metricFr: "+40 % rétention",
    metricEn: "+40 % retention",
    isPlaceholder: true,
  },
];

function getInitials(author: string): string {
  // "Dr. Marie L." -> "ML" ; "Thomas B." -> "TB" ; "Léa K." -> "LK"
  const honorifics = new Set([
    "dr",
    "dr.",
    "mr",
    "mr.",
    "mme",
    "mme.",
    "m.",
    "ms",
    "ms.",
  ]);
  const tokens = author
    .split(/\s+/)
    .map((t) => t.replace(/[.,]/g, ""))
    .filter((t) => t.length > 0 && !honorifics.has(t.toLowerCase()));
  return tokens
    .slice(0, 2)
    .map((t) => t[0]?.toUpperCase() ?? "")
    .join("");
}

export interface TestimonialsProps {
  language: "fr" | "en" | string;
}

export default function Testimonials({ language }: TestimonialsProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  // Anti-prod garde-fou : si toutes les entrées sont placeholder ET on est en prod, ne rien rendre
  const allPlaceholder = TESTIMONIALS.every((t) => t.isPlaceholder);
  if (import.meta.env.PROD && allPlaceholder) {
    return null;
  }

  const showDemoBadge = import.meta.env.DEV && allPlaceholder;

  return (
    <section
      id="testimonials"
      className="py-16 sm:py-24 px-4 sm:px-6"
      ref={ref}
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-6xl mx-auto">
        {showDemoBadge && (
          <div className="flex justify-center mb-6">
            <div
              data-testid="testimonials-demo-badge"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"
            >
              {lang === "fr"
                ? "⚠ Démo — témoignages fictifs (dev/staging)"
                : "⚠ Demo — fictional testimonials (dev/staging)"}
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2
            id="testimonials-heading"
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary mb-3"
          >
            {lang === "fr"
              ? "Ce que nos utilisateurs en disent"
              : "What our users say"}
          </h2>
          <p className="text-text-secondary text-sm sm:text-base max-w-xl mx-auto">
            {lang === "fr"
              ? "Des chercheurs, journalistes et étudiants qui gagnent un temps précieux."
              : "Researchers, journalists and students saving precious time."}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: 0.4, ease, delay: 0.1 + i * 0.08 }}
              className="relative p-6 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col"
            >
              <Quote
                className="w-6 h-6 text-accent-primary/40 mb-3"
                aria-hidden="true"
              />

              <div
                className="flex items-center gap-1 mb-3"
                aria-label={
                  lang === "fr" ? "5 étoiles sur 5" : "5 stars out of 5"
                }
              >
                {[0, 1, 2, 3, 4].map((s) => (
                  <Star
                    key={s}
                    className="w-3.5 h-3.5 text-amber-400 fill-amber-400"
                    aria-hidden="true"
                  />
                ))}
              </div>

              <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
                « {lang === "fr" ? t.quoteFr : t.quoteEn} »
              </p>

              <div className="inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-4">
                {lang === "fr" ? t.metricFr : t.metricEn}
              </div>

              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-white/5">
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center text-sm font-semibold text-text-primary"
                  aria-label={
                    lang === "fr"
                      ? `Avatar de ${t.author}`
                      : `Avatar of ${t.author}`
                  }
                >
                  {getInitials(t.author)}
                </div>
                <div>
                  <div className="text-sm font-semibold text-text-primary">
                    {t.author}
                  </div>
                  <div className="text-xs text-text-tertiary">
                    {lang === "fr" ? t.roleFr : t.roleEn}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run :

```bash
cd frontend && npm run test -- Testimonials.test
```

Expected : `5 passed`.

Si le test 4 (`returns null when PROD`) échoue parce que `import.meta.env.PROD` n'est pas correctement stub, vérifier la version de Vitest. Utiliser `vi.stubEnv("PROD", true)` (Vitest >= 0.25) — confirmer en lançant `npx vitest --version`. Si trop ancien, fallback : passer un prop `__forceMode` au composant (uniquement en test) — mais d'abord essayer la stub.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components/landing/Testimonials.tsx frontend/src/components/landing/__tests__/Testimonials.test.tsx
git commit -m "feat(landing): add Testimonials component with placeholder safeguard

- 3 fictional seed entries (Dr. Marie L., Thomas B., Léa K.) with isPlaceholder flag
- Returns null in production if all entries are placeholders (anti-deploy guard)
- Shows 'Démo' badge in DEV environments
- 5-star rating, metric badge, avatar initials, glassmorphism dark mode
- Framer Motion useInView reveal, FR + EN inline strings
- 5 vitest cases covering FR/EN render, dev badge, prod null, initials"
```

---

### Task 3 : Frontend — `TrustBadges.tsx` (5 badges horizontaux)

**Files:**

- Create : `frontend/src/components/landing/TrustBadges.tsx`
- Create : `frontend/src/components/landing/__tests__/TrustBadges.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Créer `frontend/src/components/landing/__tests__/TrustBadges.test.tsx` :

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TrustBadges from "../TrustBadges";

describe("TrustBadges", () => {
  it("renders 5 badges in French", () => {
    render(<TrustBadges language="fr" />);
    expect(screen.getByText(/IA 100\s*%\s*Française/i)).toBeInTheDocument();
    expect(screen.getByText(/archivées à vie/i)).toBeInTheDocument();
    expect(screen.getByText(/RGPD/i)).toBeInTheDocument();
    expect(screen.getByText(/14 jours/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
  });

  it("renders 5 badges in English", () => {
    render(<TrustBadges language="en" />);
    expect(screen.getByText(/100\s*%\s*French/i)).toBeInTheDocument();
    expect(screen.getByText(/lifetime/i)).toBeInTheDocument();
    expect(screen.getByText(/GDPR/i)).toBeInTheDocument();
    expect(screen.getByText(/14[- ]day/i)).toBeInTheDocument();
    expect(screen.getByText(/Stripe/i)).toBeInTheDocument();
  });

  it("each badge has a role-list item with aria-label", () => {
    render(<TrustBadges language="fr" />);
    const list = screen.getByRole("list", { name: /trust badges|garanties/i });
    expect(list).toBeInTheDocument();
    expect(list.querySelectorAll("li")).toHaveLength(5);
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run :

```bash
cd frontend && npm run test -- TrustBadges.test
```

Expected : `Failed to resolve import "../TrustBadges"`.

- [ ] **Step 3 : Implémenter `TrustBadges.tsx`**

Créer `frontend/src/components/landing/TrustBadges.tsx` :

```tsx
/**
 * TrustBadges — 5 badges horizontaux de réassurance, placés sous PricingSection.
 */

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const ease = [0.4, 0, 0.2, 1] as const;

interface BadgeDef {
  id: string;
  icon: string; // emoji
  labelFr: string;
  labelEn: string;
}

const BADGES: BadgeDef[] = [
  {
    id: "french-ai",
    icon: "🇫🇷",
    labelFr: "IA 100 % Française & Européenne (Mistral)",
    labelEn: "100 % French & European AI (Mistral)",
  },
  {
    id: "lifetime-archive",
    icon: "🗄️",
    labelFr: "Analyses archivées à vie",
    labelEn: "Analyses archived for lifetime",
  },
  {
    id: "gdpr",
    icon: "🛡️",
    labelFr: "Conforme RGPD",
    labelEn: "GDPR-compliant",
  },
  {
    id: "refund-14d",
    icon: "✓",
    labelFr: "Garantie 14 jours satisfait ou remboursé",
    labelEn: "14-day money-back guarantee",
  },
  {
    id: "stripe-secure",
    icon: "🔒",
    labelFr: "Paiement sécurisé Stripe",
    labelEn: "Secure Stripe payment",
  },
];

export interface TrustBadgesProps {
  language: "fr" | "en" | string;
}

export default function TrustBadges({ language }: TrustBadgesProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="py-10 sm:py-14 px-4 sm:px-6" ref={ref}>
      <div className="max-w-5xl mx-auto">
        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease }}
          aria-label={lang === "fr" ? "Garanties de confiance" : "Trust badges"}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4"
        >
          {BADGES.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 bg-white/5 backdrop-blur-xl text-xs sm:text-[13px] text-text-secondary text-center justify-center"
            >
              <span className="text-base flex-shrink-0" aria-hidden="true">
                {b.icon}
              </span>
              <span className="leading-tight">
                {lang === "fr" ? b.labelFr : b.labelEn}
              </span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run :

```bash
cd frontend && npm run test -- TrustBadges.test
```

Expected : `3 passed`.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components/landing/TrustBadges.tsx frontend/src/components/landing/__tests__/TrustBadges.test.tsx
git commit -m "feat(landing): add TrustBadges component (5 horizontal badges)

- French AI sovereignty, lifetime archives, GDPR, 14-day refund, Stripe
- Glassmorphism dark mode, responsive grid 2/5 cols
- aria-label on the list, 3 vitest cases (FR, EN, list semantics)"
```

---

### Task 4 : Frontend — `landingApi.getStats()` côté API client

**Files:**

- Modify : `frontend/src/services/api.ts` (ajout d'un nouvel objet exporté)

- [ ] **Step 1 : Identifier le bon emplacement**

Ouvrir `frontend/src/services/api.ts` et localiser la fin de `demoApi` (ligne ~936). On insère **juste après** la fermeture du bloc `};` de `demoApi`. C'est intentionnel : on garde les API publiques sans auth groupées.

- [ ] **Step 2 : Ajouter le type + l'objet API**

Ajouter directement après `};` qui ferme `demoApi` (vers ligne 937) :

```typescript
// 🌐 Landing public — stats homepage (cache Redis 1h, no auth)
export interface LandingStatsResponse {
  total_videos_analyzed: number;
  total_words_synthesized: number;
  active_users_30d: number;
}

export const landingApi = {
  /**
   * 🌐 Get aggregated public stats for the homepage social proof counter.
   * Cached on the backend for 1 hour (Redis).
   */
  async getStats(): Promise<LandingStatsResponse> {
    return request<LandingStatsResponse>("/api/public/landing-stats", {
      method: "GET",
      skipAuth: true,
      skipCredentials: true,
      timeout: 10000,
    });
  },
};
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

Run :

```bash
cd frontend && npm run typecheck
```

Expected : 0 nouvelle erreur introduite (les éventuelles erreurs préexistantes dans d'autres fichiers ne nous concernent pas — mais on doit s'assurer que `services/api.ts` n'a aucune nouvelle erreur sur les lignes ajoutées).

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(api): add landingApi.getStats() for homepage social proof

- New LandingStatsResponse interface (3 int fields)
- landingApi.getStats() calls GET /api/public/landing-stats with skipAuth+skipCredentials
- 10s timeout, follows demoApi pattern"
```

---

### Task 5 : Frontend — `SocialProofCounter.tsx` avec fetch + skeleton + count-up

**Files:**

- Create : `frontend/src/components/landing/SocialProofCounter.tsx`
- Create : `frontend/src/components/landing/__tests__/SocialProofCounter.test.tsx`

- [ ] **Step 1 : Écrire le test failing**

Créer `frontend/src/components/landing/__tests__/SocialProofCounter.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SocialProofCounter from "../SocialProofCounter";
import { landingApi } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  landingApi: {
    getStats: vi.fn(),
  },
}));

const mockedGetStats = landingApi.getStats as unknown as ReturnType<
  typeof vi.fn
>;

describe("SocialProofCounter", () => {
  beforeEach(() => {
    mockedGetStats.mockReset();
  });

  it("shows skeleton placeholders before fetch resolves", () => {
    mockedGetStats.mockImplementation(() => new Promise(() => {})); // never resolves
    render(<SocialProofCounter language="fr" />);
    const skeletons = screen.getAllByTestId("social-proof-skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("renders 3 counters once stats are fetched (FR)", async () => {
    mockedGetStats.mockResolvedValue({
      total_videos_analyzed: 12345,
      total_words_synthesized: 6789012,
      active_users_30d: 432,
    });
    render(<SocialProofCounter language="fr" />);
    await waitFor(() => {
      expect(screen.getByTestId("counter-videos")).toBeInTheDocument();
      expect(screen.getByTestId("counter-words")).toBeInTheDocument();
      expect(screen.getByTestId("counter-users")).toBeInTheDocument();
    });
    // Final value visible (count-up may animate, but final number must appear)
    expect(screen.getByTestId("counter-videos")).toHaveTextContent(
      /12[\s  ]?345/,
    );
  });

  it("renders nothing visible (no error UI, no counters) on fetch failure", async () => {
    mockedGetStats.mockRejectedValue(new Error("Network error"));
    const { container } = render(<SocialProofCounter language="fr" />);
    await waitFor(() => {
      expect(
        screen.queryByTestId("social-proof-skeleton"),
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("counter-videos")).not.toBeInTheDocument();
    expect(container.querySelector("section")).toBeNull();
  });

  it("renders English labels when language='en'", async () => {
    mockedGetStats.mockResolvedValue({
      total_videos_analyzed: 1,
      total_words_synthesized: 2,
      active_users_30d: 3,
    });
    render(<SocialProofCounter language="en" />);
    await waitFor(() => {
      expect(screen.getByText(/videos analyzed/i)).toBeInTheDocument();
      expect(screen.getByText(/words synthesized/i)).toBeInTheDocument();
      expect(screen.getByText(/active users/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Run :

```bash
cd frontend && npm run test -- SocialProofCounter.test
```

Expected : `Failed to resolve import "../SocialProofCounter"`.

- [ ] **Step 3 : Implémenter `SocialProofCounter.tsx`**

Créer `frontend/src/components/landing/SocialProofCounter.tsx` :

```tsx
/**
 * SocialProofCounter — 3 compteurs en bandeau (vidéos analysées, mots synthétisés, utilisateurs actifs 30j).
 *
 * Fetch via landingApi.getStats() ; skeleton pendant chargement ;
 * en cas d'erreur réseau, le composant s'efface silencieusement (pas d'UI d'erreur sur la home).
 */

import {
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Video, FileText, Users } from "lucide-react";
import { landingApi, type LandingStatsResponse } from "../../services/api";

const ease = [0.4, 0, 0.2, 1] as const;

export interface SocialProofCounterProps {
  language: "fr" | "en" | string;
}

type FetchState =
  | { status: "loading" }
  | { status: "success"; stats: LandingStatsResponse }
  | { status: "error" };

function formatNumber(value: number, lang: "fr" | "en"): string {
  return value.toLocaleString(lang === "fr" ? "fr-FR" : "en-US");
}

interface CountUpProps {
  value: number;
  lang: "fr" | "en";
  testId: string;
}

function CountUp({ value, lang, testId }: CountUpProps) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    stiffness: 60,
    damping: 18,
    mass: 1,
  });
  const display = useTransform(spring, (latest) =>
    formatNumber(Math.round(latest), lang),
  );
  const [text, setText] = useState(formatNumber(0, lang));

  useEffect(() => {
    const unsubscribe = display.on("change", setText);
    motionValue.set(value);
    return () => unsubscribe();
  }, [value, motionValue, display]);

  return (
    <span data-testid={testId} className="tabular-nums">
      {text}
    </span>
  );
}

export default function SocialProofCounter({
  language,
}: SocialProofCounterProps) {
  const lang = language === "fr" ? "fr" : "en";
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    landingApi
      .getStats()
      .then((stats) => {
        if (!cancelled) setState({ status: "success", stats });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Erreur réseau : on s'efface silencieusement (pas d'UI d'erreur sur la home)
  if (state.status === "error") {
    return null;
  }

  const cards = [
    {
      id: "videos",
      icon: Video,
      labelFr: "vidéos analysées",
      labelEn: "videos analyzed",
      value: state.status === "success" ? state.stats.total_videos_analyzed : 0,
    },
    {
      id: "words",
      icon: FileText,
      labelFr: "mots synthétisés",
      labelEn: "words synthesized",
      value:
        state.status === "success" ? state.stats.total_words_synthesized : 0,
    },
    {
      id: "users",
      icon: Users,
      labelFr: "utilisateurs actifs (30 j)",
      labelEn: "active users (30 d)",
      value: state.status === "success" ? state.stats.active_users_30d : 0,
    },
  ];

  return (
    <section
      className="py-8 sm:py-12 px-4 sm:px-6"
      ref={ref}
      aria-labelledby="social-proof-heading"
    >
      <div className="max-w-5xl mx-auto">
        <h2 id="social-proof-heading" className="sr-only">
          {lang === "fr" ? "Statistiques DeepSight" : "DeepSight statistics"}
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
          transition={{ duration: 0.5, ease }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6"
        >
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.id}
                className="flex items-center gap-4 p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl"
              >
                <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                  <Icon
                    className="w-5 h-5 text-accent-primary"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  {state.status === "loading" ? (
                    <div
                      data-testid="social-proof-skeleton"
                      className="h-7 w-28 rounded bg-white/10 animate-pulse mb-1.5"
                      aria-hidden="true"
                    />
                  ) : (
                    <div className="text-2xl font-bold text-text-primary">
                      <CountUp
                        value={c.value}
                        lang={lang}
                        testId={`counter-${c.id}`}
                      />
                    </div>
                  )}
                  <div className="text-xs text-text-tertiary">
                    {lang === "fr" ? c.labelFr : c.labelEn}
                  </div>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4 : Lancer le test, vérifier qu'il passe**

Run :

```bash
cd frontend && npm run test -- SocialProofCounter.test
```

Expected : `4 passed`.

Si le test 2 (counter-videos value 12345) échoue parce que `useSpring` n'a pas le temps de finir l'animation dans le test, on a deux options :

- (a) Augmenter le `stiffness` à 200+ et `damping` à 30+ pour converger en quelques frames.
- (b) Utiliser `vi.useFakeTimers()` et `await vi.runAllTimersAsync()` dans le test avant l'assertion.

Préférer (a) si possible, sinon (b). Documenter le choix dans le commit.

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/components/landing/SocialProofCounter.tsx frontend/src/components/landing/__tests__/SocialProofCounter.test.tsx
git commit -m "feat(landing): add SocialProofCounter with backend-driven stats

- Fetches GET /api/public/landing-stats via landingApi.getStats()
- 3 counters (videos analyzed, words synthesized, active users 30d)
- Framer Motion useSpring count-up animation, fr-FR/en-US locale formatting
- Skeleton placeholders during loading, silent unmount on network error
- 4 vitest cases (skeleton, success, network failure, EN labels)"
```

---

### Task 6 : i18n FR + EN — namespaces `landing.testimonials`, `landing.trust_badges`, `landing.social_proof`

**Files:**

- Modify : `frontend/src/i18n/fr.json`
- Modify : `frontend/src/i18n/en.json`

> **Note** : les composants Task 2/3/5 utilisent des chaînes inline (`lang === "fr" ? "..." : "..."`) pour rester cohérents avec le pattern majoritaire de `LandingPage.tsx`. Néanmoins, on **enrichit** les fichiers i18n avec les libellés (clés) — ils servent de référence pour toute traduction future et alignent avec la consigne "i18n FR + EN obligatoire" du prompt utilisateur.

- [ ] **Step 1 : Ouvrir `frontend/src/i18n/fr.json` et localiser le bloc `landing`**

Le bloc commence par `"landing": {` et contient les sous-clés `badge`, `hero`, `stats`, `features`, `audiences`, `pricing`, `cta`. Trouver la **dernière** sous-clé existante (`cta` ou la dernière) et **avant la fermeture `}`** du bloc landing, ajouter :

```json
    ,
    "testimonials": {
      "heading": "Ce que nos utilisateurs en disent",
      "subheading": "Des chercheurs, journalistes et étudiants qui gagnent un temps précieux.",
      "demoBadge": "⚠ Démo — témoignages fictifs (dev/staging)",
      "stars": "5 étoiles sur 5"
    },
    "trust_badges": {
      "heading": "Garanties de confiance",
      "frenchAi": "IA 100 % Française & Européenne (Mistral)",
      "lifetimeArchive": "Analyses archivées à vie",
      "gdpr": "Conforme RGPD",
      "refund14d": "Garantie 14 jours satisfait ou remboursé",
      "stripeSecure": "Paiement sécurisé Stripe"
    },
    "social_proof": {
      "heading": "Statistiques DeepSight",
      "videos": "vidéos analysées",
      "words": "mots synthétisés",
      "users": "utilisateurs actifs (30 j)"
    }
```

⚠ Conserver le `,` initial avant `"testimonials"` car il sépare de la sous-clé précédente `cta`. Conserver l'absence de virgule finale après `"users": "utilisateurs actifs (30 j)"`}` si c'est la dernière sous-clé du bloc landing — vérifier le JSON est valide.

- [ ] **Step 2 : Idem dans `frontend/src/i18n/en.json`**

Ajouter avant la fermeture du bloc `landing` :

```json
    ,
    "testimonials": {
      "heading": "What our users say",
      "subheading": "Researchers, journalists and students saving precious time.",
      "demoBadge": "⚠ Demo — fictional testimonials (dev/staging)",
      "stars": "5 stars out of 5"
    },
    "trust_badges": {
      "heading": "Trust badges",
      "frenchAi": "100 % French & European AI (Mistral)",
      "lifetimeArchive": "Analyses archived for lifetime",
      "gdpr": "GDPR-compliant",
      "refund14d": "14-day money-back guarantee",
      "stripeSecure": "Secure Stripe payment"
    },
    "social_proof": {
      "heading": "DeepSight statistics",
      "videos": "videos analyzed",
      "words": "words synthesized",
      "users": "active users (30 d)"
    }
```

- [ ] **Step 3 : Vérifier la validité JSON des deux fichiers**

Run :

```bash
cd frontend && python -c "import json; json.load(open('src/i18n/fr.json', encoding='utf-8')); json.load(open('src/i18n/en.json', encoding='utf-8')); print('OK')"
```

Expected : `OK`. Sinon, fixer la virgule manquante / en trop.

- [ ] **Step 4 : Vérifier que les tests existants passent encore**

Run :

```bash
cd frontend && npm run test -- --run
```

Expected : tous les tests existants passent (la modif ne casse rien). Si un test snapshot landing échoue, regénérer ou ajuster (peu probable, on n'a touché que le JSON).

- [ ] **Step 5 : Commit**

```bash
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "feat(landing): add i18n keys for testimonials, trust_badges, social_proof

- FR + EN namespaces under 'landing'
- Reference for future externalization (components currently inline strings)"
```

---

### Task 7 : Intégration dans `LandingPage.tsx` (3 sections)

**Files:**

- Modify : `frontend/src/pages/LandingPage.tsx` (4 endroits — barrel import + 3 insertions)
- Modify : `frontend/src/components/landing/index.ts` (4 nouveaux exports)

- [ ] **Step 1 : Mettre à jour le barrel `frontend/src/components/landing/index.ts`**

Le fichier actuel contient 3 lignes. Le remplacer par :

```typescript
export { default as DemoAnalysisStatic } from "./DemoAnalysisStatic";
export { default as DemoChatStatic } from "./DemoChatStatic";
export { default as PricingSection } from "./PricingSection";
export { default as Testimonials } from "./Testimonials";
export { default as TrustBadges } from "./TrustBadges";
export { default as SocialProofCounter } from "./SocialProofCounter";
```

- [ ] **Step 2 : Mettre à jour l'import barrel dans `LandingPage.tsx` lignes 45-49**

Bloc actuel :

```tsx
import {
  DemoAnalysisStatic,
  DemoChatStatic,
  PricingSection,
} from "../components/landing";
```

Remplacer par :

```tsx
import {
  DemoAnalysisStatic,
  DemoChatStatic,
  PricingSection,
  Testimonials,
  TrustBadges,
  SocialProofCounter,
} from "../components/landing";
```

- [ ] **Step 3 : Insertion #1 — `<SocialProofCounter>` en bandeau juste après le HERO**

Trouver la fin de la section HERO. Le HERO se ferme à la ligne ~944 (juste avant le bloc `{/* ─── DEMO INTERACTIVE ─── */}` qui commence à la ligne 1071-1072 selon le grep mais peut varier après les autres tasks). On localise le commentaire **`{/* ─── DEMO INTERACTIVE ─── */}`** ligne 1071 et on insère **juste avant** ce commentaire :

```tsx
{
  /* ─── SOCIAL PROOF COUNTER (bandeau hero) ─── */
}
<SocialProofCounter language={language} />;
```

- [ ] **Step 4 : Insertion #2 — `<Testimonials>` après la section Demo statique**

La section Demo se ferme ligne ~1077 (`</section>` après `<DemoChatStatic />`). Insérer **juste après** cette fermeture, AVANT le commentaire `{/* ─── FEATURES ─── */}` ligne 1078 :

```tsx
{
  /* ─── TESTIMONIALS ─── */
}
<Testimonials language={language} />;
```

- [ ] **Step 5 : Insertion #3 — `<TrustBadges>` directement sous `<PricingSection>`**

La ligne actuelle contenant `<PricingSection language={language} onNavigate={navigate} />` est ligne 1366. Juste après cette ligne, AVANT le commentaire `{/* ─── FAQ ─── */}` ligne 1367, ajouter :

```tsx
{
  /* ─── TRUST BADGES (sous pricing) ─── */
}
<TrustBadges language={language} />;
```

- [ ] **Step 6 : Vérifier le typecheck**

Run :

```bash
cd frontend && npm run typecheck
```

Expected : aucune nouvelle erreur introduite. Si erreur "Cannot find module ../components/landing", vérifier que le barrel a bien été mis à jour Step 1.

- [ ] **Step 7 : Smoke test visuel local**

Run :

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:5173/` (ou le port indiqué).

Vérifier visuellement :

1. Bandeau social proof apparaît juste sous le hero (3 compteurs avec skeleton puis valeurs réelles).
2. Section Testimonials apparaît après la démo statique avec badge "Démo" jaune en haut (`import.meta.env.DEV === true` en dev server).
3. Section TrustBadges apparaît juste sous PricingSection avec 5 badges horizontaux.
4. Toggle FR / EN dans le header (s'il existe) : libellés changent dans les 3 sections.

Stopper avec `Ctrl+C`.

- [ ] **Step 8 : Commit**

```bash
git add frontend/src/components/landing/index.ts frontend/src/pages/LandingPage.tsx
git commit -m "feat(landing): integrate Testimonials, TrustBadges, SocialProofCounter

- Barrel exports updated for 3 new components
- SocialProofCounter inserted as hero strip (before demo section)
- Testimonials inserted after demo section (before features)
- TrustBadges inserted directly under PricingSection (before FAQ)
- All 3 receive language prop, no other LandingPage logic touched"
```

---

### Task 8 : Build + smoke test backend + frontend

**Files:** aucune nouvelle modification.

- [ ] **Step 1 : Build frontend**

Run :

```bash
cd frontend && npm run build
```

Expected : build success, dossier `dist/` généré, aucune nouvelle erreur. Si l'output mentionne un warning bundle size > 500 KB sur `LandingPage`, c'est OK (LandingPage est déjà ~1500 lignes — l'ajout est marginal).

- [ ] **Step 2 : Tests frontend complets**

Run :

```bash
cd frontend && npm run test -- --run
```

Expected : **tous** les tests existants passent + les 3 nouveaux test files (Testimonials, TrustBadges, SocialProofCounter) passent. Total = pré-existants + 12 nouveaux cas (5 + 3 + 4).

- [ ] **Step 3 : Tests backend complets**

Run :

```bash
cd backend && python -m pytest tests/ -v --ignore=tests/integration
```

Expected : 774 (pré-existants) + 3 nouveaux = 777 passing. Si nombre différent, investiguer la nouvelle régression.

- [ ] **Step 4 : Lint frontend**

Run :

```bash
cd frontend && npm run lint
```

Expected : 0 erreur (warnings tolérés s'ils sont préexistants ailleurs). Sur les 3 nouveaux composants : 0 erreur, 0 warning.

- [ ] **Step 5 : Smoke test e2e local stack**

Run dans deux shells :

Shell 1 :

```bash
cd backend/src && uvicorn main:app --port 8000 --reload
```

Shell 2 :

```bash
cd frontend && npm run dev
```

Naviguer sur `http://localhost:5173/`, ouvrir DevTools → onglet Network. Vérifier qu'une requête `GET http://localhost:8000/api/public/landing-stats` est émise au mount, retourne 200, et que les compteurs se peuplent.

Stopper les deux shells.

- [ ] **Step 6 : Commit (si une retouche a été nécessaire pour faire passer build/lint)**

Si Step 1-5 sont tous verts sans changement, **pas de commit**. Sinon :

```bash
git add -A
git commit -m "chore(landing): fix lint/build issues post-integration"
```

---

### Task 9 (OPTIONNEL — robustesse pré-deploy) : script `check-no-placeholders-in-prod.cjs`

> **Pourquoi optionnel** : la garde-fou est déjà au niveau du composant (`return null` en `import.meta.env.PROD` si all-placeholder). Ce script ajoute une **deuxième** couche en CI/build.

**Files:**

- Create : `scripts/check-no-placeholders-in-prod.cjs`
- Modify : `frontend/package.json` (ajouter `"prebuild:strict": "node ../scripts/check-no-placeholders-in-prod.cjs"` dans `scripts`)

- [ ] **Step 1 : Créer le script**

Créer `scripts/check-no-placeholders-in-prod.cjs` :

```javascript
#!/usr/bin/env node
/**
 * check-no-placeholders-in-prod.cjs
 *
 * Pre-deploy guard: refuses to build if Testimonials.tsx still ships placeholder
 * entries AND NODE_ENV === "production" AND escape-hatch DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS !== "yes".
 */

const fs = require("fs");
const path = require("path");

const TESTIMONIALS_PATH = path.resolve(
  __dirname,
  "..",
  "frontend",
  "src",
  "components",
  "landing",
  "Testimonials.tsx",
);

if (!fs.existsSync(TESTIMONIALS_PATH)) {
  // Component not present yet — nothing to check
  process.exit(0);
}

const content = fs.readFileSync(TESTIMONIALS_PATH, "utf-8");
const hasPlaceholder = /isPlaceholder:\s*true/.test(content);

const isProd = process.env.NODE_ENV === "production";
const escapeHatch = process.env.DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS === "yes";

if (hasPlaceholder && isProd && !escapeHatch) {
  console.error(
    "[31m[check-no-placeholders] BLOCKED: Testimonials.tsx still has isPlaceholder:true entries AND NODE_ENV=production.",
  );
  console.error(
    "[33mTo proceed intentionally, run: DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS=yes npm run build",
  );
  console.error(
    "Otherwise replace placeholder testimonials with real (consented) entries.[0m",
  );
  process.exit(1);
}

console.log("[check-no-placeholders] OK");
process.exit(0);
```

- [ ] **Step 2 : Câbler le script dans `frontend/package.json`**

Repérer le bloc `"scripts"` et ajouter une entrée. **Ne pas** modifier `"build"` directement (Vercel utilise `npm run build`). À la place, créer une commande optionnelle `build:strict` :

```json
    "build:strict": "node ../scripts/check-no-placeholders-in-prod.cjs && npm run build",
```

L'utilisateur (ou la CI custom) peut lancer `npm run build:strict` localement avant un push critique.

- [ ] **Step 3 : Test du script en local**

Run :

```bash
NODE_ENV=production node scripts/check-no-placeholders-in-prod.cjs
```

Expected : exit code 1 et message rouge "BLOCKED".

Run :

```bash
DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS=yes NODE_ENV=production node scripts/check-no-placeholders-in-prod.cjs
```

Expected : exit code 0 et "[check-no-placeholders] OK".

- [ ] **Step 4 : Commit**

```bash
git add scripts/check-no-placeholders-in-prod.cjs frontend/package.json
git commit -m "chore(landing): add pre-build guard against shipping fake testimonials

- scripts/check-no-placeholders-in-prod.cjs blocks if isPlaceholder:true + NODE_ENV=production
- Override via DEEPSIGHT_ALLOW_FAKE_TESTIMONIALS=yes (explicit acknowledgment)
- npm run build:strict runs the check then build"
```

---

## Self-Review

### 1. Spec coverage

| Exigence du prompt utilisateur                                                | Tâche couvrant           |
| ----------------------------------------------------------------------------- | ------------------------ |
| Endpoint public `GET /api/public/landing-stats` (3 agrégats)                  | Task 1                   |
| Cache Redis 1 h                                                               | Task 1 step 4            |
| Modèle SQL inspiré de `admin/router.py:102-156` (sans auth admin)             | Task 1 step 4            |
| Inclure router dans `main.py`                                                 | Task 1 step 6            |
| `Testimonials.tsx` 3 cards, étoiles, métrique badge, avatar initiales         | Task 2 step 3            |
| Flag `isPlaceholder: true` dans la data                                       | Task 2 step 3            |
| Badge "Démo" visible en dev/staging                                           | Task 2 step 3            |
| `TrustBadges.tsx` 5 badges horizontaux                                        | Task 3 step 3            |
| `SocialProofCounter.tsx` 3 compteurs + fetch endpoint public                  | Task 5 step 3            |
| Skeleton loading                                                              | Task 5 step 3            |
| Mise à jour `frontend/src/components/landing/index.ts`                        | Task 7 step 1            |
| Insertion `<SocialProofCounter>` en bandeau hero                              | Task 7 step 3            |
| Insertion `<Testimonials>` après Demo                                         | Task 7 step 4            |
| Insertion `<TrustBadges>` sous PricingSection                                 | Task 7 step 5            |
| i18n FR + EN obligatoire (namespaces `landing.testimonials/trust_badges/...`) | Task 6                   |
| Frontend `landingApi.getStats()`                                              | Task 4                   |
| Tests Vitest pour les 3 composants (rendu + i18n + flag placeholder visible)  | Task 2/3/5 step 1        |
| Backend test (TDD pytest)                                                     | Task 1 step 1            |
| Build + smoke test                                                            | Task 8                   |
| (Optionnel) script pré-deploy                                                 | Task 9                   |
| Dark mode first, glassmorphism, accents Indigo/Violet                         | Task 2/3/5 step 3        |
| Animations Framer Motion                                                      | Task 2/3/5 step 3        |
| Accessibilité (aria-label, focus management)                                  | Task 2/3/5 step 3        |
| Mobile responsive 375/768/1280/1536                                           | Task 3 (grid responsive) |

✅ Toutes les exigences sont couvertes.

### 2. Placeholder scan

Recherche des patterns interdits :

- ❌ Aucun "TBD", "TODO", "implement later", "fill in details" dans les steps.
- ❌ Aucun "Add appropriate error handling" sans code.
- ❌ Aucun "Write tests for the above" sans code de test.
- ❌ Aucun "Similar to Task N" — toutes les tâches contiennent leur code complet.
- ✅ Tous les steps avec code montrent le code complet.

### 3. Type consistency

- `LandingStatsResponse` (backend Pydantic) et `LandingStatsResponse` (frontend TS) ont les **mêmes 3 champs** snake_case : `total_videos_analyzed`, `total_words_synthesized`, `active_users_30d`.
- `landingApi.getStats()` retourne `Promise<LandingStatsResponse>` — utilisé dans `SocialProofCounter` Task 5.
- `TestimonialEntry.isPlaceholder: boolean` est testé dans Task 2 step 1 et utilisé dans Task 2 step 3 + Task 9 (script regex).
- Props `language: "fr" | "en" | string` cohérentes entre `Testimonials`, `TrustBadges`, `SocialProofCounter`.
- Helpers `ScrollReveal` / `useInView` margin "-60px" cohérents avec `PricingSection.tsx` ligne 179.

✅ Aucune incohérence de types.

### 4. Décisions business à valider AVANT déploiement prod

**Cette section est un blocker de PR vers `main`.**

| ID    | Décision                                                                                                              | Default proposé                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| TS-1  | Les 3 témoignages sont **fictifs**. Faut-il les afficher en prod ?                                                    | **NON par défaut** — `isPlaceholder=true → return null`                             |
| TS-2  | Si "OUI" pour TS-1 : ajouter une mention "Personas illustratifs" en bas de section ?                                  | **OUI** (CTA-friendly, transparence audit)                                          |
| TS-3  | Si "NON" pour TS-1 : déployer sans Testimonials et le réactiver après collecte de vrais témoignages réels et signés ? | **OUI** — n'affichera rien, gain SocialProofCounter+TrustBadges quand même          |
| TS-4  | Récolter les vrais témoignages : par email opt-in dans dashboard ou interview manuel ?                                | À trancher (hors scope ce plan)                                                     |
| TS-5  | Métriques chiffrées dans les vrais témoignages (ex "2h → 30 min") : autorisées si l'utilisateur valide par écrit ?    | **OUI** — exigence : consentement écrit + capture d'écran message                   |
| TS-6  | Garde-fou supplémentaire : Task 9 (script CI) à activer ?                                                             | **OUI** (quasi-zéro coût, double sécurité)                                          |
| TS-7  | Anti-pattern à éviter : laisser le composant Testimonials commenté (`{/* <Testimonials /> */}`) en prod ?             | **NON** — le composant retourne `null` lui-même, c'est plus propre                  |
| TS-8  | SocialProofCounter : si `total_videos_analyzed === 0` (DB vide), afficher quand même les compteurs (zéros) ?          | **NON** — afficher `null` si l'un des 3 est 0 (cf. variante optionnelle ci-dessous) |
| TS-9  | Cache Redis 1 h : OK ou trop long pour un site qui démarre (data variation rapide) ?                                  | **OK 1 h** par défaut, raccourcir à 5 min en mode lancement si besoin               |
| TS-10 | TrustBadges : "Garantie 14 jours" est aussi présent dans `PricingSection.tsx` ligne 361 — duplication acceptée ?      | **OUI** (rappel après tarifs renforce conversion)                                   |

**Variante optionnelle pour TS-8** — si l'utilisateur préfère masquer SocialProofCounter quand la DB n'est pas peuplée, ajuster Task 5 step 3 pour :

```tsx
if (
  state.status === "success" &&
  state.stats.total_videos_analyzed === 0 &&
  state.stats.total_words_synthesized === 0 &&
  state.stats.active_users_30d === 0
) {
  return null;
}
```

(à mettre juste après le `if (state.status === "error") return null;`).

### 5. Décision de déploiement

**Workflow strict** :

1. Cette PR est mergeable vers une branche d'intégration (ex `feature/audit-kimi-plans-2026-04-29`) sans validation business.
2. Avant tout merge vers `main`, l'utilisateur (Maxime) répond aux 10 décisions ci-dessus.
3. Si TS-1 = NON : la branche reste mergeable, Testimonials s'efface en prod automatiquement (`isPlaceholder + PROD → null`). Pas d'autre action.
4. Si TS-1 = OUI : modifier les 3 entrées dans `Testimonials.tsx` step 3 pour passer `isPlaceholder: false` ET ajouter footer "personas illustratifs" si TS-2 = OUI.
5. Vercel auto-deploy sur `main` est OK uniquement après l'arbitrage de TS-1 et la sortie de l'étape 3 ou 4.

---

## Execution Handoff

**Plan complet et sauvegardé dans `docs/superpowers/plans/2026-04-29-homepage-testimonials.md`.**

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — dispatch d'un sous-agent Opus 4.7 frais par tâche (9 tâches), review entre chaque, itération rapide.
2. **Inline Execution** — exécution séquentielle en session via `superpowers:executing-plans`, batch avec checkpoints.

**Quelle approche ?**

Si Subagent-Driven choisi → REQUIRED SUB-SKILL : `superpowers:subagent-driven-development` (worktree dédié `feature/homepage-testimonials` recommandé d'après RELEASE-ORCHESTRATION Sprint A).

Si Inline → REQUIRED SUB-SKILL : `superpowers:executing-plans` (batch step-by-step avec validation utilisateur après Task 1 backend, Task 5 frontend principal, Task 8 build).

**Note de coordination Sprint A** (cf. `2026-04-29-RELEASE-ORCHESTRATION.md`) : ce plan **n'a aucun couplage** avec les autres plans Sprint A (#2 dashboard, #9 watermark) ni avec Sprint B (#1 SEO, #7 Pricing v2). Aucune migration Alembic. Sécurité de merge : zéro risque de conflit cascade. Endpoint public `/api/public/landing-stats` à inspecter en revue sécurité (count agrégés uniquement, pas de PII — vérifié dans le code Task 1 step 4).

---

_Plan rédigé 2026-04-29 par sous-agent Opus 4.7 — DeepSight Synthesis audit Kimi Phase 1 UX/Conversion._
