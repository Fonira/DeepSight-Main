> **⚠️ SUPERSEDED** by spec [`2026-05-10-tuteur-refactor.md`](../specs/2026-05-10-tuteur-refactor.md) (mergé prod 2026-05-11). State machine 4 phases simplifié à 3 phases, voice mode du popup retiré, voice tutor déplacé sur agent ConvAI ElevenLabs `knowledge_tutor` séparé.

# Le Tuteur (Companion conversationnel) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tout sub-agent dispatché DOIT tourner en `claude-opus-4-7[1m]`** (cf. décision 13 du spec).

**Goal:** Remplacer le widget passif `DidYouKnowCard` et le système WhackAMole par un Tuteur conversationnel sobre (Magistral texte + Voxtral voix), state machine 4 phases, scope V1 web-only.

**Architecture:** Refonte du widget ambient en 1 composant frontend `Tutor.tsx` (state machine `idle / prompting / mini-chat / deep-session`) + 1 nouveau module backend FastAPI `backend/src/tutor/` (3 endpoints, sessions Redis TTL 1h, pas de migration DB V1). Réutilisation maximale de l'existant : `LoadingWordContext`, infra Voice, Magistral chat v4, plan_limits SSOT.

**Tech Stack:** Backend FastAPI + Python 3.11 (Pydantic v2, Redis, Mistral Magistral, Voxtral, ElevenLabs). Frontend React 18 + TypeScript strict + Vite + Tailwind + Framer Motion. Tests : pytest backend, Vitest + React Testing Library frontend, Playwright E2E.

**Spec source:** `docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md` (commit `a8e1063c`).

**Divergence assumée du spec :** le module backend est nommé `tutor/` au lieu de `companion/` pour éviter la collision de naming avec les fichiers existants `backend/src/voice/companion_*.py` (Coach Vocal de Découverte). Tous les paths code (module, endpoints, hook, types, API client) suivent cette correction. Le concept produit reste "Le Tuteur" en UX FR.

**Prérequis** :

- Branche dédiée : créer `feat/le-tuteur-companion` depuis `main` (ou rebaser depuis la branche WIP `fix/hub-nav-redesign` après merge)
- Variables d'environnement : `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY` doivent exister dans `.env.production`
- Redis accessible (déjà le cas)

---

## File Structure

### Nouveaux fichiers

**Backend** :

| Fichier                               | Rôle                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `backend/src/tutor/__init__.py`       | Exposition du router                                                                              |
| `backend/src/tutor/router.py`         | 3 endpoints `/api/tutor/session/{start,turn,end}` + plan gating                                   |
| `backend/src/tutor/schemas.py`        | Pydantic v2 — `SessionStartRequest/Response`, `SessionTurnRequest/Response`, `SessionEndResponse` |
| `backend/src/tutor/service.py`        | Orchestration : Redis session store + Magistral + Voxtral STT + ElevenLabs TTS                    |
| `backend/src/tutor/prompts.py`        | Constante `TUTOR_SYSTEM_PROMPT` (template persona "sobre & pro")                                  |
| `backend/tests/test_tutor_router.py`  | Unit tests 3 endpoints (happy path + erreurs)                                                     |
| `backend/tests/test_tutor_service.py` | Unit tests Redis session store + prompts rendering                                                |

**Frontend** :

| Fichier                                                  | Rôle                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `frontend/src/components/Tutor/Tutor.tsx`                | Composant racine, branche selon state                             |
| `frontend/src/components/Tutor/TutorIdle.tsx`            | State `idle` (top-right, concept passif)                          |
| `frontend/src/components/Tutor/TutorPrompting.tsx`       | State `prompting` (mode selector Texte/Voix)                      |
| `frontend/src/components/Tutor/TutorMiniChat.tsx`        | State `mini-chat` (panel expansé texte)                           |
| `frontend/src/components/Tutor/TutorDeepSession.tsx`     | State `deep-session` (modal fullscreen voix)                      |
| `frontend/src/components/Tutor/useTutor.ts`              | Hook reducer state machine + persistance localStorage + API calls |
| `frontend/src/components/Tutor/tutorConstants.ts`        | Constantes (LS keys, durées par défaut, sizes)                    |
| `frontend/src/components/Tutor/index.ts`                 | Re-export public                                                  |
| `frontend/src/components/Tutor/__tests__/Tutor.test.tsx` | Vitest unit — state machine transitions + API mock                |
| `frontend/src/types/tutor.ts`                            | Types TS (`TutorSession`, `TutorTurn`, `TutorMode`, etc.)         |
| `frontend/e2e/tutor.spec.ts`                             | Playwright E2E flow text mode + voice mode mocké                  |

### Fichiers modifiés

| Fichier                                            | Modif                                                                                                                               |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/main.py`                              | Ajouter `from tutor.router import router as tutor_router` + `app.include_router(tutor_router, prefix="/api/tutor", tags=["tutor"])` |
| `backend/src/core/plan_limits.py` (ou `config.py`) | Ajouter feature `companion_dialogue` dans `is_feature_available()` matrix                                                           |
| `frontend/src/services/api.ts`                     | Ajouter `export const tutorApi = { sessionStart, sessionTurn, sessionEnd }`                                                         |
| `frontend/src/App.tsx` (ou `DashboardLayout.tsx`)  | Remplacer `<DidYouKnowCard />` par `<Tutor />`                                                                                      |
| `frontend/src/components/layout/Sidebar.tsx`       | Supprimer `WhackAMoleToggle` (lignes 304-414) + son import                                                                          |
| `frontend/src/i18n/fr.json`                        | Supprimer clés `dashboard.modes.{toggle_on,toggle_off,quiz,classic,expert,focus}` ; ajouter clés `tutor.*`                          |
| `frontend/src/i18n/en.json`                        | Idem fr.json                                                                                                                        |

### Fichiers archivés (déplacés, pas supprimés)

| Source                                                      | Destination                                               |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `frontend/src/components/WhackAMole/FactRevealCard.tsx`     | `frontend/src/_archive/WhackAMole/FactRevealCard.tsx`     |
| `frontend/src/components/WhackAMole/ImageGuessCard.tsx`     | `frontend/src/_archive/WhackAMole/ImageGuessCard.tsx`     |
| `frontend/src/components/WhackAMole/useWhackAMole.ts`       | `frontend/src/_archive/WhackAMole/useWhackAMole.ts`       |
| `frontend/src/components/WhackAMole/whackAMoleConstants.ts` | `frontend/src/_archive/WhackAMole/whackAMoleConstants.ts` |
| `frontend/src/components/DidYouKnowCard.tsx`                | `frontend/src/_archive/DidYouKnowCard.tsx`                |

### Fichiers explicitement INCHANGÉS (ne pas toucher)

- `frontend/src/contexts/LoadingWordContext.tsx` — source des concepts
- `frontend/src/data/defaultWords.ts` — 50 mots fascinants
- `frontend/src/pages/StudyHubPage.tsx`, `frontend/src/pages/StudyPage.tsx`
- `frontend/src/store/studyStore.ts`
- `frontend/src/components/Study/*` (FSRS gamification existant)
- `backend/src/study/*` (FSRS backend)
- `backend/src/voice/companion_*.py` (Coach Vocal de Découverte)

---

## Phase 1 — Préparation (suppressions et nettoyage)

### Task 1.1 : Archiver les fichiers WhackAMole

**Files:**

- Move: `frontend/src/components/WhackAMole/*` → `frontend/src/_archive/WhackAMole/`
- Move: `frontend/src/components/DidYouKnowCard.tsx` → `frontend/src/_archive/DidYouKnowCard.tsx`

- [ ] **Step 1: Créer le dossier d'archive**

```bash
mkdir -p frontend/src/_archive/WhackAMole
```

- [ ] **Step 2: Déplacer les fichiers WhackAMole**

```bash
git mv frontend/src/components/WhackAMole/FactRevealCard.tsx frontend/src/_archive/WhackAMole/FactRevealCard.tsx
git mv frontend/src/components/WhackAMole/ImageGuessCard.tsx frontend/src/_archive/WhackAMole/ImageGuessCard.tsx
git mv frontend/src/components/WhackAMole/useWhackAMole.ts frontend/src/_archive/WhackAMole/useWhackAMole.ts
git mv frontend/src/components/WhackAMole/whackAMoleConstants.ts frontend/src/_archive/WhackAMole/whackAMoleConstants.ts
```

- [ ] **Step 3: Déplacer DidYouKnowCard**

```bash
git mv frontend/src/components/DidYouKnowCard.tsx frontend/src/_archive/DidYouKnowCard.tsx
```

- [ ] **Step 4: Vérifier git status**

```bash
git status frontend/src/_archive/ frontend/src/components/WhackAMole/ frontend/src/components/DidYouKnowCard.tsx
```

Expected: les 5 fichiers sont en `R` (renamed) vers `_archive/`.

- [ ] **Step 5: Note pour les écrans suivants**

Le typecheck/lint va échouer après cette task (imports cassés). C'est attendu — la task suivante les corrige. **Ne pas lancer `npm run typecheck` ou `npm run build` ici.**

- [ ] **Step 6: Commit**

```bash
git commit -m "chore(frontend): archive WhackAMole + DidYouKnowCard (remplacés par le Tuteur)

Préparation pour la refonte du widget en Tuteur conversationnel.
Les fichiers archivés peuvent renaître en V2 (Mode Défi optionnel).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2 : Supprimer `WhackAMoleToggle` de `Sidebar.tsx`

**Files:**

- Modify: `frontend/src/components/layout/Sidebar.tsx` (supprimer le composant `WhackAMoleToggle` ~ lignes 304-414, supprimer l'import `Gamepad2` si plus utilisé, supprimer l'utilisation `<WhackAMoleToggle />` dans le rendering)

- [ ] **Step 1: Lire le contenu actuel de Sidebar.tsx pour repérer les lignes exactes**

```bash
grep -n 'WhackAMoleToggle\|Gamepad2' frontend/src/components/layout/Sidebar.tsx
```

Note: la grille de lignes peut avoir bougé. Utiliser ce grep pour localiser, puis retirer :

- La fonction `const WhackAMoleToggle: React.FC = ...` (déclaration entière)
- L'import de `Gamepad2` depuis `lucide-react` (si exclusivement utilisé par WhackAMoleToggle — sinon laisser)
- L'élément `<WhackAMoleToggle collapsed={collapsed} />` dans le rendering du Sidebar

- [ ] **Step 2: Modifier Sidebar.tsx**

Utiliser l'outil `Edit` pour supprimer la fonction `WhackAMoleToggle` et son utilisation. Pas de remplacement par autre chose — la sidebar perd simplement cette section.

- [ ] **Step 3: Lancer le typecheck (uniquement le frontend)**

```bash
cd frontend && npm run typecheck
```

Expected: PASS sur tous les fichiers SAUF éventuellement des fichiers qui importent `DidYouKnowCard` ou `WhackAMole/*`. Lister ces erreurs et les fixer dans la même commit (probablement `App.tsx` ou un layout).

- [ ] **Step 4: Si erreurs d'import dans App.tsx ou autre, fixer en supprimant l'import + l'utilisation**

```bash
grep -rn 'DidYouKnowCard\|WhackAMole' frontend/src --include='*.tsx' --include='*.ts' | grep -v _archive
```

Pour chaque match : retirer l'import + l'utilisation. **Ne PAS** réintroduire `<Tutor />` à ce stade (ce sera la Task 5.1).

- [ ] **Step 5: Re-typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS clean.

- [ ] **Step 6: Build frontend pour confirmation**

```bash
cd frontend && npm run build
```

Expected: build success. Le widget ambient est maintenant complètement absent.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/App.tsx
# (et autres fichiers fixés en step 4)
git commit -m "refactor(sidebar): retire WhackAMoleToggle + références orphelines

Le Tuteur conversationnel le remplacera. Pour l'instant le dashboard
n'a plus de widget ambient — état transitoire jusqu'à Task 5.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.3 : Nettoyer les clés i18n inutiles

**Files:**

- Modify: `frontend/src/i18n/fr.json` — supprimer `dashboard.modes.{toggle_on,toggle_off,quiz,classic,expert,focus}` ; ajouter `tutor.*`
- Modify: `frontend/src/i18n/en.json` — idem

- [ ] **Step 1: Localiser les clés à supprimer dans fr.json**

```bash
grep -n 'modes\|toggle_on\|toggle_off\|focus\|classic\|expert\|quiz' frontend/src/i18n/fr.json | head -20
```

- [ ] **Step 2: Supprimer le bloc `dashboard.modes` dans fr.json**

Cible : retirer les lignes 174-192 environ (le bloc `"modes": { ... }` complet) et son trailing comma. Vérifier que le JSON reste valide.

- [ ] **Step 3: Ajouter les nouvelles clés `tutor.*` dans fr.json**

Insérer dans `dashboard` (ou créer un nouveau bloc `tutor` au top-level si plus propre) :

```json
"tutor": {
  "title": "Le Tuteur",
  "idle": {
    "hint": "Cliquez pour dialoguer"
  },
  "prompting": {
    "ask": "On en parle ?",
    "mode_text": "Texte",
    "mode_text_duration": "30s",
    "mode_voice": "Voix",
    "mode_voice_duration": "5min",
    "back": "Annuler"
  },
  "mini_chat": {
    "input_placeholder": "Tapez votre réponse...",
    "deepen": "Approfondir",
    "close": "Fermer"
  },
  "deep_session": {
    "pause": "Pause",
    "switch_to_text": "Texte",
    "end": "Fin",
    "source_link": "Voir l'analyse source"
  },
  "errors": {
    "session_failed": "Session impossible — réessayez",
    "plan_required": "Disponible avec Pro ou Expert",
    "voice_unavailable": "Voix indisponible — utilisez le mode texte"
  }
}
```

- [ ] **Step 4: Idem en.json (traduction anglaise)**

```json
"tutor": {
  "title": "The Tutor",
  "idle": { "hint": "Click to chat" },
  "prompting": {
    "ask": "Want to discuss?",
    "mode_text": "Text",
    "mode_text_duration": "30s",
    "mode_voice": "Voice",
    "mode_voice_duration": "5min",
    "back": "Cancel"
  },
  "mini_chat": {
    "input_placeholder": "Type your answer...",
    "deepen": "Go deeper",
    "close": "Close"
  },
  "deep_session": {
    "pause": "Pause",
    "switch_to_text": "Text",
    "end": "End",
    "source_link": "View source analysis"
  },
  "errors": {
    "session_failed": "Session failed — please retry",
    "plan_required": "Available with Pro or Expert",
    "voice_unavailable": "Voice unavailable — use text mode"
  }
}
```

- [ ] **Step 5: Valider que les JSON sont valides**

```bash
node -e "JSON.parse(require('fs').readFileSync('frontend/src/i18n/fr.json'))" && node -e "JSON.parse(require('fs').readFileSync('frontend/src/i18n/en.json'))" && echo OK
```

Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/i18n/fr.json frontend/src/i18n/en.json
git commit -m "chore(i18n): supprime keys WhackAMole + ajoute tutor.*

Préparation traductions FR/EN pour le Tuteur conversationnel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2 — Backend module `tutor/`

### Task 2.1 : Créer les schemas Pydantic v2

**Files:**

- Create: `backend/src/tutor/__init__.py` (vide ou re-export)
- Create: `backend/src/tutor/schemas.py`

- [ ] **Step 1: Créer le dossier**

```bash
mkdir -p backend/src/tutor
touch backend/src/tutor/__init__.py
```

- [ ] **Step 2: Écrire les schemas dans `backend/src/tutor/schemas.py`**

```python
"""
Pydantic v2 schemas pour le router /api/tutor/*.

Sessions sont stockées en Redis (TTL 1h, pas de table SQL).
"""
from typing import Literal, Optional, List
from pydantic import BaseModel, Field


TutorMode = Literal["text", "voice"]
TutorLang = Literal["fr", "en"]


class SessionStartRequest(BaseModel):
    """Body de POST /api/tutor/session/start."""

    concept_term: str = Field(..., min_length=1, max_length=200)
    concept_def: str = Field(..., min_length=1, max_length=2000)
    summary_id: Optional[int] = Field(None, description="ID de l'analyse vidéo source si concept vient de l'historique")
    source_video_title: Optional[str] = Field(None, max_length=300)
    mode: TutorMode = "text"
    lang: TutorLang = "fr"


class SessionStartResponse(BaseModel):
    session_id: str
    first_prompt: str
    audio_url: Optional[str] = Field(None, description="Présent si mode='voice'")


class SessionTurnRequest(BaseModel):
    """Body de POST /api/tutor/session/{id}/turn.

    Soit user_input (texte) soit audio_blob (base64) doit être présent.
    """

    user_input: Optional[str] = Field(None, max_length=2000)
    audio_blob_b64: Optional[str] = Field(None, description="Audio user encodé base64 si mode voice")


class SessionTurnResponse(BaseModel):
    ai_response: str
    audio_url: Optional[str] = None
    turn_count: int


class SessionEndResponse(BaseModel):
    duration_sec: int
    turns_count: int
    source_summary_url: Optional[str] = None
    source_video_title: Optional[str] = None


class TutorTurn(BaseModel):
    """Représentation interne d'un tour, persistée en Redis."""

    role: Literal["user", "assistant"]
    content: str
    timestamp_ms: int


class TutorSessionState(BaseModel):
    """État interne de la session, persisté en Redis."""

    session_id: str
    user_id: int
    concept_term: str
    concept_def: str
    summary_id: Optional[int] = None
    source_video_title: Optional[str] = None
    mode: TutorMode
    lang: TutorLang
    started_at_ms: int
    turns: List[TutorTurn] = []
    persona_version: str = "v1"
```

- [ ] **Step 3: Vérifier l'import**

```bash
cd backend && python -c "from src.tutor.schemas import SessionStartRequest; print(SessionStartRequest.model_fields)"
```

Expected: print du dict des fields, pas d'erreur.

- [ ] **Step 4: Commit**

```bash
git add backend/src/tutor/
git commit -m "feat(tutor): pydantic schemas pour sessions

Schemas pour /api/tutor/session/{start,turn,end} + état Redis.
Pas de table SQL V1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2 : Créer le persona prompt

**Files:**

- Create: `backend/src/tutor/prompts.py`

- [ ] **Step 1: Écrire `backend/src/tutor/prompts.py`**

```python
"""
System prompts pour le Tuteur DeepSight (persona "sobre & professionnel").

V1 : prompt fixe. V2 envisagée : personnalisable par user.
"""
from typing import Optional


TUTOR_PERSONA_VERSION = "v1"


TUTOR_SYSTEM_PROMPT_TEMPLATE = """Tu es le Tuteur intellectuel de l'utilisateur de DeepSight, plateforme française d'analyse de vidéos YouTube.
Ton rôle : aider l'utilisateur à approfondir un concept qu'il a rencontré dans ses analyses récentes.

PRINCIPES :
- Ton sobre, professionnel, respectueux du temps de l'utilisateur
- Vouvoiement par défaut (ou tutoiement neutre si l'utilisateur l'utilise)
- Pose des questions ouvertes qui font réfléchir, ne donne pas tout de suite la réponse
- Si l'utilisateur dit "je ne sais pas", reformule plus simplement, ne juge jamais
- Cite l'origine du concept si pertinent ("Vous l'avez croisé dans votre analyse de [video_title]")
- Sois concis : réponses courtes (2-3 phrases), favorise le dialogue
- Si la session dépasse 5 min sans que l'utilisateur progresse, propose de "passer à autre chose"
- Pas de gimmick, pas d'emoji excessif, pas de "Bravo !" inutile

CONCEPT EN COURS : {concept_term}
DÉFINITION DE RÉFÉRENCE : {concept_def}
SOURCE (si disponible) : {source_clause}
LANGUE DE L'UTILISATEUR : {lang}

PREMIER MESSAGE :
Pose une question ouverte qui invite l'utilisateur à formuler le concept avec ses propres mots,
ou à appliquer le concept à un cas concret. 2 phrases maximum.
"""


def build_tutor_system_prompt(
    concept_term: str,
    concept_def: str,
    source_video_title: Optional[str],
    lang: str = "fr",
) -> str:
    """Construit le system prompt final.

    Args:
        concept_term: ex. "Rasoir d'Occam"
        concept_def: définition courte ou longue (max 2000 chars)
        source_video_title: titre de l'analyse source si dispo (peut être None)
        lang: "fr" ou "en"
    """
    if source_video_title:
        source_clause = f'analyse vidéo "{source_video_title}"'
    else:
        source_clause = "concept général de votre culture intellectuelle"

    return TUTOR_SYSTEM_PROMPT_TEMPLATE.format(
        concept_term=concept_term,
        concept_def=concept_def,
        source_clause=source_clause,
        lang=lang,
    )
```

- [ ] **Step 2: Vérifier l'import et le rendering**

```bash
cd backend && python -c "from src.tutor.prompts import build_tutor_system_prompt; print(build_tutor_system_prompt('Rasoir d\\'Occam', 'Principe de parcimonie...', 'Vidéo Mr. Phi', 'fr')[:200])"
```

Expected: print les 200 premiers chars du prompt rendu, pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tutor/prompts.py
git commit -m "feat(tutor): persona prompt 'sobre & professionnel' V1

System prompt fixe pour Magistral. Persona DeepSight aligné
positionnement sérieux (vouvoiement, pas de gimmick).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.3 : Créer le service (Redis + Magistral + STT/TTS)

**Files:**

- Create: `backend/src/tutor/service.py`
- Create: `backend/tests/test_tutor_service.py`

- [ ] **Step 1: Écrire le test FAILING dans `backend/tests/test_tutor_service.py`**

```python
"""Tests unit pour tutor.service — Redis store + Magistral orchestration."""
import pytest
from unittest.mock import AsyncMock, patch
from src.tutor.service import (
    create_session,
    load_session,
    append_turn,
    delete_session,
)
from src.tutor.schemas import TutorSessionState, TutorTurn


@pytest.mark.asyncio
async def test_create_and_load_session(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-1",
        user_id=42,
        concept_term="Rasoir d'Occam",
        concept_def="Principe de parcimonie...",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)

    loaded = await load_session(redis_client_fixture, "test-1")
    assert loaded is not None
    assert loaded.user_id == 42
    assert loaded.concept_term == "Rasoir d'Occam"
    assert loaded.turns == []


@pytest.mark.asyncio
async def test_append_turn(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-2",
        user_id=42,
        concept_term="X",
        concept_def="Y",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)

    await append_turn(
        redis_client_fixture,
        "test-2",
        TutorTurn(role="user", content="Hello", timestamp_ms=1700000001000),
    )

    loaded = await load_session(redis_client_fixture, "test-2")
    assert len(loaded.turns) == 1
    assert loaded.turns[0].role == "user"


@pytest.mark.asyncio
async def test_delete_session(redis_client_fixture):
    state = TutorSessionState(
        session_id="test-3",
        user_id=42,
        concept_term="X",
        concept_def="Y",
        mode="text",
        lang="fr",
        started_at_ms=1700000000000,
    )
    await create_session(redis_client_fixture, state)
    await delete_session(redis_client_fixture, "test-3")

    loaded = await load_session(redis_client_fixture, "test-3")
    assert loaded is None
```

Avant de lancer le test : ajouter la fixture `redis_client_fixture` dans `backend/tests/conftest.py` si elle n'existe pas. Vérifier d'abord :

```bash
grep -n 'redis_client' backend/tests/conftest.py
```

Si absente, ajouter dans `conftest.py` :

```python
import fakeredis.aioredis
import pytest_asyncio

@pytest_asyncio.fixture
async def redis_client_fixture():
    client = fakeredis.aioredis.FakeRedis(decode_responses=True)
    yield client
    await client.flushall()
    await client.aclose()
```

(Installer `fakeredis` si absent : `pip install 'fakeredis[lua]'` et l'ajouter à `requirements.txt`.)

- [ ] **Step 2: Lancer le test → DOIT échouer (module n'existe pas)**

```bash
cd backend && python -m pytest tests/test_tutor_service.py -v
```

Expected: FAIL `ImportError: cannot import name 'create_session' from 'src.tutor.service'`.

- [ ] **Step 3: Écrire l'implémentation minimale dans `backend/src/tutor/service.py`**

```python
"""
Service Tutor : session storage Redis + orchestration LLM/STT/TTS.

V1 : sessions en Redis avec TTL 1h. Pas de table SQL.
"""
import json
import uuid
import time
import logging
from typing import Optional
import redis.asyncio as aioredis
from src.tutor.schemas import TutorSessionState, TutorTurn, TutorMode, TutorLang
from src.tutor.prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION


logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 60 * 60  # 1 heure
ACTIVE_LOCK_TTL_SECONDS = 60 * 60


def _session_key(session_id: str) -> str:
    return f"tutor:session:{session_id}"


def _active_key(user_id: int) -> str:
    return f"tutor:session:user:{user_id}:active"


async def create_session(
    redis: aioredis.Redis,
    state: TutorSessionState,
) -> None:
    """Persiste une nouvelle session avec TTL 1h."""
    payload = state.model_dump_json()
    await redis.set(_session_key(state.session_id), payload, ex=SESSION_TTL_SECONDS)
    await redis.set(_active_key(state.user_id), state.session_id, ex=ACTIVE_LOCK_TTL_SECONDS)
    logger.info(f"[tutor] created session {state.session_id} user={state.user_id}")


async def load_session(redis: aioredis.Redis, session_id: str) -> Optional[TutorSessionState]:
    raw = await redis.get(_session_key(session_id))
    if raw is None:
        return None
    return TutorSessionState.model_validate_json(raw)


async def append_turn(
    redis: aioredis.Redis,
    session_id: str,
    turn: TutorTurn,
) -> None:
    state = await load_session(redis, session_id)
    if state is None:
        raise ValueError(f"Session {session_id} not found or expired")
    state.turns.append(turn)
    await redis.set(_session_key(session_id), state.model_dump_json(), ex=SESSION_TTL_SECONDS)


async def delete_session(redis: aioredis.Redis, session_id: str) -> None:
    state = await load_session(redis, session_id)
    if state is not None:
        await redis.delete(_active_key(state.user_id))
    await redis.delete(_session_key(session_id))


def make_session_id() -> str:
    return f"tutor-{uuid.uuid4().hex[:12]}"


def now_ms() -> int:
    return int(time.time() * 1000)
```

- [ ] **Step 4: Re-run tests → PASS**

```bash
cd backend && python -m pytest tests/test_tutor_service.py -v
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tutor/service.py backend/tests/test_tutor_service.py backend/tests/conftest.py backend/requirements.txt
git commit -m "feat(tutor): redis session store (create/load/append/delete)

Sessions en Redis TTL 1h. Tests fakeredis 3 cas.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.4 : Créer le router et endpoint `POST /session/start`

**Files:**

- Create: `backend/src/tutor/router.py`
- Create: `backend/tests/test_tutor_router.py`

- [ ] **Step 1: Écrire le test FAILING dans `backend/tests/test_tutor_router.py`**

```python
"""Tests unit pour tutor.router — 3 endpoints + plan gating."""
import pytest
from httpx import AsyncClient
from src.main import app


@pytest.mark.asyncio
async def test_session_start_pro_user_text_mode(authenticated_pro_client):
    """Un user Pro peut démarrer une session text mode."""
    response = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "Rasoir d'Occam",
            "concept_def": "Principe de parcimonie : la plus simple explication est la plus probable.",
            "summary_id": None,
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "session_id" in data
    assert data["session_id"].startswith("tutor-")
    assert isinstance(data["first_prompt"], str)
    assert len(data["first_prompt"]) > 10
    assert data["audio_url"] is None  # text mode


@pytest.mark.asyncio
async def test_session_start_free_user_blocked(authenticated_free_client):
    """Un user Free reçoit 403 (plan gating)."""
    response = await authenticated_free_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "mode": "text",
            "lang": "fr",
        },
    )
    assert response.status_code == 403
    assert "plan" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_session_start_unauthenticated(async_client):
    """Sans token : 401."""
    response = await async_client.post(
        "/api/tutor/session/start",
        json={"concept_term": "X", "concept_def": "Y"},
    )
    assert response.status_code == 401
```

Vérifier que les fixtures `authenticated_pro_client`, `authenticated_free_client`, `async_client` existent dans `conftest.py`. Sinon, repérer les patterns dans `tests/test_chat.py` et reproduire.

- [ ] **Step 2: Lancer → FAIL (router n'existe pas)**

```bash
cd backend && python -m pytest tests/test_tutor_router.py::test_session_start_pro_user_text_mode -v
```

Expected: 404 ou ImportError.

- [ ] **Step 3: Implémenter `backend/src/tutor/router.py`**

```python
"""
Router /api/tutor/* — 3 endpoints pour le Tuteur conversationnel.

Sessions Redis TTL 1h. LLM Magistral. Voix Voxtral STT + ElevenLabs TTS.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from db.database import get_session, User
from auth.dependencies import get_current_user
from core.plan_limits import is_feature_available
from core.config import settings
from core.redis_client import get_redis  # ADAPTER selon le helper Redis existant
from core.llm_provider import generate_chat_response  # ADAPTER selon le helper Mistral existant

from src.tutor.schemas import (
    SessionStartRequest,
    SessionStartResponse,
    SessionTurnRequest,
    SessionTurnResponse,
    SessionEndResponse,
    TutorSessionState,
    TutorTurn,
)
from src.tutor.service import (
    create_session,
    load_session,
    append_turn,
    delete_session,
    make_session_id,
    now_ms,
)
from src.tutor.prompts import build_tutor_system_prompt, TUTOR_PERSONA_VERSION


logger = logging.getLogger(__name__)
router = APIRouter()


def _check_plan_access(user: User) -> None:
    """Bloque les users Free."""
    if not is_feature_available(user.plan, "companion_dialogue", platform="web"):
        raise HTTPException(
            status_code=403,
            detail="Cette fonctionnalité nécessite un plan Pro ou Expert.",
        )


def _select_magistral_model(user_plan: str) -> str:
    """Magistral medium pour Pro, large pour Expert."""
    if user_plan == "expert":
        return settings.MISTRAL_MAGISTRAL_LARGE_MODEL or "magistral-medium-2509"
    return settings.MISTRAL_MAGISTRAL_MEDIUM_MODEL or "magistral-medium-2509"


@router.post("/session/start", response_model=SessionStartResponse)
async def session_start(
    body: SessionStartRequest,
    user: User = Depends(get_current_user),
):
    """Démarre une session Tutor : crée Redis + génère 1er prompt Magistral."""
    _check_plan_access(user)

    redis = await get_redis()

    # Créer la session
    session_id = make_session_id()
    state = TutorSessionState(
        session_id=session_id,
        user_id=user.id,
        concept_term=body.concept_term,
        concept_def=body.concept_def,
        summary_id=body.summary_id,
        source_video_title=body.source_video_title,
        mode=body.mode,
        lang=body.lang,
        started_at_ms=now_ms(),
        persona_version=TUTOR_PERSONA_VERSION,
    )
    await create_session(redis, state)

    # Générer 1er prompt Magistral
    system_prompt = build_tutor_system_prompt(
        concept_term=body.concept_term,
        concept_def=body.concept_def,
        source_video_title=body.source_video_title,
        lang=body.lang,
    )
    model = _select_magistral_model(user.plan)
    first_prompt = await generate_chat_response(
        system_prompt=system_prompt,
        messages=[],  # premier tour, pas d'historique user
        model=model,
        max_tokens=300,
        temperature=0.7,
    )

    # Persister le 1er turn assistant
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=first_prompt, timestamp_ms=now_ms()),
    )

    # TTS si voice mode (V1.0 : on rend audio_url None ; voice TTS implémenté en task séparée)
    audio_url: Optional[str] = None
    if body.mode == "voice":
        # TODO Phase 2.6 : appeler ElevenLabs TTS et stocker en S3/R2 → URL signée
        audio_url = None  # placeholder V1.0

    return SessionStartResponse(
        session_id=session_id,
        first_prompt=first_prompt,
        audio_url=audio_url,
    )
```

**ATTENTION** : adapter les imports `core.redis_client` et `core.llm_provider` aux helpers réels du projet (probablement `from core.config import get_redis_client` et `from core.llm_provider import mistral_chat_completion` ou similaire). Lancer `grep -rn "Redis\b\|aioredis\|magistral" backend/src/core/` pour repérer les helpers existants.

- [ ] **Step 4: Wire le router dans `backend/src/main.py`**

Repérer dans `main.py` la zone des `app.include_router(...)`. Ajouter :

```python
from tutor.router import router as tutor_router
app.include_router(tutor_router, prefix="/api/tutor", tags=["tutor"])
```

- [ ] **Step 5: Ajouter `companion_dialogue` à `is_feature_available()` SSOT**

Repérer `backend/src/core/plan_limits.py` (ou `config.py`). Ajouter une entrée :

```python
FEATURES = {
    # ... existant ...
    "companion_dialogue": {
        "free": False,
        "pro": True,
        "expert": True,
    },
    # ...
}
```

(Adapter selon la structure réelle.)

- [ ] **Step 6: Re-run le test**

```bash
cd backend && python -m pytest tests/test_tutor_router.py::test_session_start_pro_user_text_mode -v
```

Expected: PASS. Si KO : check les imports adaptés en step 3.

- [ ] **Step 7: Run les autres tests (free + unauth)**

```bash
cd backend && python -m pytest tests/test_tutor_router.py -v
```

Expected: 3 PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/tutor/router.py backend/src/main.py backend/src/core/plan_limits.py backend/tests/test_tutor_router.py
git commit -m "feat(tutor): POST /api/tutor/session/start

Démarre une session conversationnelle, génère 1er prompt Magistral.
Plan gating Pro+. Sessions Redis TTL 1h.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.5 : Endpoint `POST /session/{id}/turn`

**Files:**

- Modify: `backend/src/tutor/router.py`
- Modify: `backend/tests/test_tutor_router.py`

- [ ] **Step 1: Ajouter le test FAILING**

Dans `backend/tests/test_tutor_router.py` :

```python
@pytest.mark.asyncio
async def test_session_turn_text(authenticated_pro_client):
    """Un turn texte : POST avec user_input retourne ai_response."""
    # 1. Démarrer une session
    start_resp = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "Rasoir d'Occam",
            "concept_def": "Principe de parcimonie...",
            "mode": "text",
            "lang": "fr",
        },
    )
    session_id = start_resp.json()["session_id"]

    # 2. Envoyer un tour user
    turn_resp = await authenticated_pro_client.post(
        f"/api/tutor/session/{session_id}/turn",
        json={"user_input": "Choisir l'explication la plus simple."},
    )
    assert turn_resp.status_code == 200
    data = turn_resp.json()
    assert "ai_response" in data
    assert isinstance(data["ai_response"], str)
    assert data["turn_count"] == 3  # 1 assistant initial + 1 user + 1 assistant


@pytest.mark.asyncio
async def test_session_turn_invalid_session(authenticated_pro_client):
    """Session inexistante → 404."""
    response = await authenticated_pro_client.post(
        "/api/tutor/session/tutor-doesnotexist/turn",
        json={"user_input": "test"},
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_session_turn_empty_input(authenticated_pro_client):
    """Ni user_input ni audio_blob → 400."""
    start_resp = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={"concept_term": "X", "concept_def": "Y", "mode": "text", "lang": "fr"},
    )
    session_id = start_resp.json()["session_id"]

    response = await authenticated_pro_client.post(
        f"/api/tutor/session/{session_id}/turn",
        json={},
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Lancer → FAIL**

```bash
cd backend && python -m pytest tests/test_tutor_router.py::test_session_turn_text -v
```

Expected: FAIL 404 (endpoint absent).

- [ ] **Step 3: Implémenter l'endpoint dans `backend/src/tutor/router.py`**

Ajouter à la fin du router :

```python
@router.post("/session/{session_id}/turn", response_model=SessionTurnResponse)
async def session_turn(
    session_id: str,
    body: SessionTurnRequest,
    user: User = Depends(get_current_user),
):
    """Un tour de conversation : user input → IA response."""
    _check_plan_access(user)

    if not body.user_input and not body.audio_blob_b64:
        raise HTTPException(
            status_code=400,
            detail="user_input ou audio_blob_b64 requis",
        )

    redis = await get_redis()
    state = await load_session(redis, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session non trouvée ou expirée")
    if state.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session non autorisée")

    # STT si audio
    user_text = body.user_input
    if body.audio_blob_b64 and not user_text:
        # TODO Phase 2.6 : Voxtral STT
        # from voice.voxtral_stt import transcribe_audio
        # user_text = await transcribe_audio(body.audio_blob_b64, lang=state.lang)
        raise HTTPException(status_code=501, detail="STT non implémenté V1.0 (use user_input)")

    # Append user turn
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="user", content=user_text, timestamp_ms=now_ms()),
    )

    # Reload to get full conversation
    state = await load_session(redis, session_id)
    messages = [{"role": t.role, "content": t.content} for t in state.turns]
    system_prompt = build_tutor_system_prompt(
        concept_term=state.concept_term,
        concept_def=state.concept_def,
        source_video_title=state.source_video_title,
        lang=state.lang,
    )
    model = _select_magistral_model(user.plan)

    ai_response = await generate_chat_response(
        system_prompt=system_prompt,
        messages=messages[:-1] + [messages[-1]],  # tout l'historique, dernier = user_text
        model=model,
        max_tokens=300,
        temperature=0.7,
    )

    # Append assistant turn
    await append_turn(
        redis,
        session_id,
        TutorTurn(role="assistant", content=ai_response, timestamp_ms=now_ms()),
    )

    # TTS si voice mode (V1.1 — placeholder None)
    audio_url = None

    # Reload pour avoir le turn count à jour
    state = await load_session(redis, session_id)

    return SessionTurnResponse(
        ai_response=ai_response,
        audio_url=audio_url,
        turn_count=len(state.turns),
    )
```

- [ ] **Step 4: Re-run les tests turn**

```bash
cd backend && python -m pytest tests/test_tutor_router.py -v
```

Expected: 6 PASS (3 existants + 3 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add backend/src/tutor/router.py backend/tests/test_tutor_router.py
git commit -m "feat(tutor): POST /api/tutor/session/{id}/turn

Tour de conversation user→IA. Magistral chat avec full history.
Validation session existante + ownership user.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.6 : Endpoint `POST /session/{id}/end`

**Files:**

- Modify: `backend/src/tutor/router.py`
- Modify: `backend/tests/test_tutor_router.py`

- [ ] **Step 1: Test FAILING**

Ajouter dans `test_tutor_router.py` :

```python
@pytest.mark.asyncio
async def test_session_end(authenticated_pro_client):
    """Fermer une session retourne durée + turn count + supprime de Redis."""
    start_resp = await authenticated_pro_client.post(
        "/api/tutor/session/start",
        json={
            "concept_term": "X",
            "concept_def": "Y",
            "summary_id": 42,
            "source_video_title": "Vidéo Test",
            "mode": "text",
            "lang": "fr",
        },
    )
    session_id = start_resp.json()["session_id"]

    end_resp = await authenticated_pro_client.post(
        f"/api/tutor/session/{session_id}/end",
        json={},
    )
    assert end_resp.status_code == 200
    data = end_resp.json()
    assert data["turns_count"] >= 1
    assert data["duration_sec"] >= 0
    assert data["source_summary_url"] == "/dashboard?id=42"
    assert data["source_video_title"] == "Vidéo Test"

    # La session doit être supprimée
    turn_after_end = await authenticated_pro_client.post(
        f"/api/tutor/session/{session_id}/turn",
        json={"user_input": "still alive?"},
    )
    assert turn_after_end.status_code == 404
```

- [ ] **Step 2: Lancer → FAIL**

```bash
cd backend && python -m pytest tests/test_tutor_router.py::test_session_end -v
```

- [ ] **Step 3: Implémenter `/session/{id}/end`**

Ajouter dans `router.py` :

```python
@router.post("/session/{session_id}/end", response_model=SessionEndResponse)
async def session_end(
    session_id: str,
    user: User = Depends(get_current_user),
):
    """Termine une session : durée, log analytics, supprime Redis."""
    _check_plan_access(user)

    redis = await get_redis()
    state = await load_session(redis, session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session non trouvée ou expirée")
    if state.user_id != user.id:
        raise HTTPException(status_code=403, detail="Session non autorisée")

    duration_sec = max(0, (now_ms() - state.started_at_ms) // 1000)
    source_summary_url = f"/dashboard?id={state.summary_id}" if state.summary_id else None

    # TODO V1.1 : log analytics dans table AnalyticsEvent
    # from analytics.service import log_event
    # await log_event(user.id, "tutor_session_ended", {"duration_sec": duration_sec, "turns": len(state.turns), "concept": state.concept_term})

    await delete_session(redis, session_id)

    return SessionEndResponse(
        duration_sec=duration_sec,
        turns_count=len(state.turns),
        source_summary_url=source_summary_url,
        source_video_title=state.source_video_title,
    )
```

- [ ] **Step 4: Re-run tests**

```bash
cd backend && python -m pytest tests/test_tutor_router.py -v
```

Expected: 7 PASS (6 existants + 1 nouveau).

- [ ] **Step 5: Commit**

```bash
git add backend/src/tutor/router.py backend/tests/test_tutor_router.py
git commit -m "feat(tutor): POST /api/tutor/session/{id}/end

Termine la session, calcule durée, retourne lien analyse source si dispo,
supprime de Redis. Hook analytics V1.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.7 : Smoke test backend complet

**Files:**

- Run: ensemble des tests backend pour vérifier non-régression

- [ ] **Step 1: Lancer la full suite Tutor**

```bash
cd backend && python -m pytest tests/test_tutor_router.py tests/test_tutor_service.py -v
```

Expected: tous PASS (10 tests).

- [ ] **Step 2: Lancer les tests des modules touchés (régression)**

```bash
cd backend && python -m pytest tests/test_chat.py tests/test_voice*.py tests/test_billing.py -v
```

Expected: pas de régression. Si fail : investiguer (probablement collision import core).

- [ ] **Step 3: Démarrer le backend en dev local et hit l'endpoint**

```bash
cd backend/src && uvicorn main:app --port 8000 &
sleep 3
# Avec un token Pro valide (à récupérer via /api/auth/login)
TOKEN="<paste pro user token>"
curl -X POST http://localhost:8000/api/tutor/session/start \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"concept_term":"Rasoir d Occam","concept_def":"Principe de parcimonie","mode":"text","lang":"fr"}'
```

Expected: réponse JSON `{"session_id": "tutor-xxxx", "first_prompt": "...", "audio_url": null}` avec un first_prompt cohérent (question ouverte).

- [ ] **Step 4: Tuer le serveur dev**

```bash
kill %1
```

- [ ] **Step 5: Pas de commit (smoke test, rien à committer)**

---

## Phase 3 — Frontend API client + types

### Task 3.1 : Types TypeScript Tutor

**Files:**

- Create: `frontend/src/types/tutor.ts`

- [ ] **Step 1: Écrire les types**

```typescript
// frontend/src/types/tutor.ts

export type TutorMode = "text" | "voice";
export type TutorLang = "fr" | "en";
export type TutorPhase = "idle" | "prompting" | "mini-chat" | "deep-session";

export interface TutorTurn {
  role: "user" | "assistant";
  content: string;
  timestamp_ms: number;
}

export interface SessionStartRequest {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  mode: TutorMode;
  lang: TutorLang;
}

export interface SessionStartResponse {
  session_id: string;
  first_prompt: string;
  audio_url: string | null;
}

export interface SessionTurnRequest {
  user_input?: string;
  audio_blob_b64?: string;
}

export interface SessionTurnResponse {
  ai_response: string;
  audio_url: string | null;
  turn_count: number;
}

export interface SessionEndResponse {
  duration_sec: number;
  turns_count: number;
  source_summary_url: string | null;
  source_video_title: string | null;
}
```

- [ ] **Step 2: Vérifier compile**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/tutor.ts
git commit -m "feat(types): tutor session types (mirrors backend pydantic)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 3.2 : API client `tutorApi`

**Files:**

- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Trouver le pattern existant**

```bash
grep -n 'export const chatApi' frontend/src/services/api.ts
```

Repérer la fin du `chatApi` (~ ligne 1445) pour insérer `tutorApi` juste après.

- [ ] **Step 2: Ajouter `tutorApi` dans `services/api.ts`**

Insérer après le `chatApi` :

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// 🎓 TUTOR API — Le Tuteur conversationnel (sessions Redis TTL 1h)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  SessionStartRequest,
  SessionStartResponse,
  SessionTurnRequest,
  SessionTurnResponse,
  SessionEndResponse,
} from "../types/tutor";

export const tutorApi = {
  async sessionStart(
    payload: SessionStartRequest,
  ): Promise<SessionStartResponse> {
    const response = await fetch(`${API_URL}/api/tutor/session/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `tutorApi.sessionStart failed: ${response.status} ${text}`,
      );
    }
    return response.json();
  },

  async sessionTurn(
    sessionId: string,
    payload: SessionTurnRequest,
  ): Promise<SessionTurnResponse> {
    const response = await fetch(
      `${API_URL}/api/tutor/session/${sessionId}/turn`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
        },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `tutorApi.sessionTurn failed: ${response.status} ${text}`,
      );
    }
    return response.json();
  },

  async sessionEnd(sessionId: string): Promise<SessionEndResponse> {
    const response = await fetch(
      `${API_URL}/api/tutor/session/${sessionId}/end`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token") ?? ""}`,
        },
        body: JSON.stringify({}),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`tutorApi.sessionEnd failed: ${response.status} ${text}`);
    }
    return response.json();
  },
};
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat(api): tutorApi client (sessionStart/Turn/End)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Frontend composant `Tutor`

### Task 4.1 : Hook `useTutor` avec reducer state machine

**Files:**

- Create: `frontend/src/components/Tutor/tutorConstants.ts`
- Create: `frontend/src/components/Tutor/useTutor.ts`
- Create: `frontend/src/components/Tutor/__tests__/useTutor.test.ts`

- [ ] **Step 1: Constants**

`frontend/src/components/Tutor/tutorConstants.ts` :

```typescript
export const LS_TUTOR_HIDDEN = "ds-tutor-hidden";
export const LS_TUTOR_DEFAULT_MODE = "ds-tutor-default-mode"; // "text" | "voice"
export const LS_TUTOR_SOUND_ON = "ds-tutor-sound-on";

export const TUTOR_IDLE_SIZE = { width: 200, height: 140 };
export const TUTOR_PROMPTING_SIZE = { width: 220, height: 180 };
export const TUTOR_MINICHAT_SIZE = { width: 280, height: 400 };

export const DEFAULT_TEXT_DURATION_S = 30;
export const DEFAULT_VOICE_DURATION_S = 5 * 60;
```

- [ ] **Step 2: Test FAILING pour `useTutor`**

`frontend/src/components/Tutor/__tests__/useTutor.test.ts` :

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTutor } from "../useTutor";

vi.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment expliqueriez-vous ce concept ?",
      audio_url: null,
    }),
    sessionTurn: vi.fn().mockResolvedValue({
      ai_response: "Bonne idée. Et si...",
      audio_url: null,
      turn_count: 3,
    }),
    sessionEnd: vi.fn().mockResolvedValue({
      duration_sec: 45,
      turns_count: 3,
      source_summary_url: "/dashboard?id=42",
      source_video_title: "Test video",
    }),
  },
}));

describe("useTutor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("starts in idle phase", () => {
    const { result } = renderHook(() => useTutor());
    expect(result.current.phase).toBe("idle");
  });

  it("transitions idle → prompting on click", () => {
    const { result } = renderHook(() => useTutor());
    act(() => result.current.openPrompting());
    expect(result.current.phase).toBe("prompting");
  });

  it("starts mini-chat session on text mode", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "Rasoir d'Occam",
        concept_def: "Principe de parcimonie",
        mode: "text",
      });
    });
    expect(result.current.phase).toBe("mini-chat");
    expect(result.current.sessionId).toBe("tutor-test123");
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("assistant");
  });

  it("appends user + assistant on submit", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    await act(async () => {
      await result.current.submitTextTurn("Mon idée");
    });
    expect(result.current.messages).toHaveLength(3);
    expect(result.current.messages[1].role).toBe("user");
    expect(result.current.messages[2].role).toBe("assistant");
  });

  it("ends session and returns to idle", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    await act(async () => {
      await result.current.endSession();
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.sessionId).toBeNull();
  });

  it("transitions mini-chat → deep-session on deepen()", async () => {
    const { result } = renderHook(() => useTutor());
    await act(async () => {
      await result.current.startSession({
        concept_term: "X",
        concept_def: "Y",
        mode: "text",
      });
    });
    act(() => result.current.deepen());
    expect(result.current.phase).toBe("deep-session");
  });
});
```

- [ ] **Step 3: Lancer → FAIL**

```bash
cd frontend && npm run test -- useTutor.test.ts
```

Expected: tests fail (hook absent).

- [ ] **Step 4: Implémenter `useTutor.ts`**

```typescript
// frontend/src/components/Tutor/useTutor.ts

import { useReducer, useCallback } from "react";
import { tutorApi } from "../../services/api";
import type {
  TutorPhase,
  TutorMode,
  TutorLang,
  TutorTurn,
} from "../../types/tutor";

interface TutorState {
  phase: TutorPhase;
  sessionId: string | null;
  messages: TutorTurn[];
  conceptTerm: string | null;
  conceptDef: string | null;
  summaryId: number | null;
  sourceVideoTitle: string | null;
  mode: TutorMode;
  lang: TutorLang;
  loading: boolean;
  error: string | null;
}

type Action =
  | { type: "OPEN_PROMPTING" }
  | { type: "CANCEL_PROMPTING" }
  | { type: "SESSION_STARTING"; mode: TutorMode; lang: TutorLang }
  | {
      type: "SESSION_STARTED";
      session_id: string;
      first_prompt: string;
      concept_term: string;
      concept_def: string;
      summary_id: number | null;
      source_video_title: string | null;
    }
  | { type: "TURN_PENDING"; user_input: string }
  | { type: "TURN_DONE"; ai_response: string }
  | { type: "DEEPEN" }
  | { type: "SESSION_ENDED" }
  | { type: "ERROR"; message: string };

const initialState: TutorState = {
  phase: "idle",
  sessionId: null,
  messages: [],
  conceptTerm: null,
  conceptDef: null,
  summaryId: null,
  sourceVideoTitle: null,
  mode: "text",
  lang: "fr",
  loading: false,
  error: null,
};

function reducer(state: TutorState, action: Action): TutorState {
  switch (action.type) {
    case "OPEN_PROMPTING":
      return { ...state, phase: "prompting", error: null };
    case "CANCEL_PROMPTING":
      return { ...state, phase: "idle" };
    case "SESSION_STARTING":
      return {
        ...state,
        mode: action.mode,
        lang: action.lang,
        loading: true,
        error: null,
      };
    case "SESSION_STARTED":
      return {
        ...state,
        phase: state.mode === "voice" ? "deep-session" : "mini-chat",
        sessionId: action.session_id,
        conceptTerm: action.concept_term,
        conceptDef: action.concept_def,
        summaryId: action.summary_id,
        sourceVideoTitle: action.source_video_title,
        messages: [
          {
            role: "assistant",
            content: action.first_prompt,
            timestamp_ms: Date.now(),
          },
        ],
        loading: false,
      };
    case "TURN_PENDING":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "user",
            content: action.user_input,
            timestamp_ms: Date.now(),
          },
        ],
        loading: true,
      };
    case "TURN_DONE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: action.ai_response,
            timestamp_ms: Date.now(),
          },
        ],
        loading: false,
      };
    case "DEEPEN":
      return { ...state, phase: "deep-session" };
    case "SESSION_ENDED":
      return initialState;
    case "ERROR":
      return { ...state, error: action.message, loading: false };
    default:
      return state;
  }
}

interface StartSessionParams {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  mode: TutorMode;
  lang?: TutorLang;
}

export function useTutor() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openPrompting = useCallback(
    () => dispatch({ type: "OPEN_PROMPTING" }),
    [],
  );
  const cancelPrompting = useCallback(
    () => dispatch({ type: "CANCEL_PROMPTING" }),
    [],
  );

  const startSession = useCallback(async (params: StartSessionParams) => {
    const lang = params.lang ?? "fr";
    dispatch({ type: "SESSION_STARTING", mode: params.mode, lang });
    try {
      const resp = await tutorApi.sessionStart({
        concept_term: params.concept_term,
        concept_def: params.concept_def,
        summary_id: params.summary_id,
        source_video_title: params.source_video_title,
        mode: params.mode,
        lang,
      });
      dispatch({
        type: "SESSION_STARTED",
        session_id: resp.session_id,
        first_prompt: resp.first_prompt,
        concept_term: params.concept_term,
        concept_def: params.concept_def,
        summary_id: params.summary_id ?? null,
        source_video_title: params.source_video_title ?? null,
      });
    } catch (err) {
      dispatch({ type: "ERROR", message: (err as Error).message });
    }
  }, []);

  const submitTextTurn = useCallback(
    async (user_input: string) => {
      if (!state.sessionId) return;
      dispatch({ type: "TURN_PENDING", user_input });
      try {
        const resp = await tutorApi.sessionTurn(state.sessionId, {
          user_input,
        });
        dispatch({ type: "TURN_DONE", ai_response: resp.ai_response });
      } catch (err) {
        dispatch({ type: "ERROR", message: (err as Error).message });
      }
    },
    [state.sessionId],
  );

  const deepen = useCallback(() => dispatch({ type: "DEEPEN" }), []);

  const endSession = useCallback(async () => {
    if (state.sessionId) {
      try {
        await tutorApi.sessionEnd(state.sessionId);
      } catch (err) {
        // Best effort — logger mais ne pas bloquer
        console.error("[useTutor] endSession failed", err);
      }
    }
    dispatch({ type: "SESSION_ENDED" });
  }, [state.sessionId]);

  return {
    ...state,
    openPrompting,
    cancelPrompting,
    startSession,
    submitTextTurn,
    deepen,
    endSession,
  };
}
```

- [ ] **Step 5: Re-run les tests**

```bash
cd frontend && npm run test -- useTutor.test.ts
```

Expected: 6 PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Tutor/tutorConstants.ts frontend/src/components/Tutor/useTutor.ts frontend/src/components/Tutor/__tests__/useTutor.test.ts
git commit -m "feat(tutor): hook useTutor (state machine 4 phases)

Reducer + actions pour idle/prompting/mini-chat/deep-session.
Tests Vitest 6 cas (transitions, API mocks, errors).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.2 : Composant `TutorIdle`

**Files:**

- Create: `frontend/src/components/Tutor/TutorIdle.tsx`

- [ ] **Step 1: Inspirer du DidYouKnowCard archivé pour le visuel**

```bash
cat frontend/src/_archive/DidYouKnowCard.tsx
```

Reprendre la structure (cosmic spinner + glassmorphism) en simplifiant : on retire les boutons next/refresh/expand, on ajoute juste un click handler global qui passe en `prompting`.

- [ ] **Step 2: Écrire `TutorIdle.tsx`**

```tsx
import React from "react";
import { motion } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";

interface TutorIdleProps {
  onClick: () => void;
}

const SPINNER_SIZE = 28;
const WHEEL_SIZE = 26;

export const TutorIdle: React.FC<TutorIdleProps> = ({ onClick }) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();

  if (!currentWord) return null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-3 right-3 z-40 hidden lg:block w-[200px] text-left rounded-2xl border border-accent-primary/15 bg-bg-secondary/95 backdrop-blur-xl p-3 hover:border-accent-primary/40 transition-colors cursor-pointer"
      aria-label={language === "fr" ? "Ouvrir le Tuteur" : "Open the Tutor"}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="relative"
          style={{ width: SPINNER_SIZE, height: SPINNER_SIZE }}
        >
          <img
            src="/spinner-cosmic.jpg"
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover rounded-full"
            style={{
              maskImage:
                "radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)",
              WebkitMaskImage:
                "radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)",
              mixBlendMode: "screen",
            }}
          />
          <img
            src="/spinner-wheel.jpg"
            alt=""
            aria-hidden="true"
            style={{
              width: WHEEL_SIZE,
              height: WHEEL_SIZE,
              position: "relative",
              zIndex: 2,
              mixBlendMode: "screen",
              opacity: 0.85,
              filter: "brightness(1.2) contrast(1.25) saturate(1.1)",
              animation: "tutor-spin 8s linear infinite",
            }}
          />
        </div>
        <span className="font-display text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
          {language === "fr" ? "Le Tuteur" : "The Tutor"}
        </span>
      </div>
      <div className="font-display text-sm font-semibold text-text-primary leading-tight mb-1">
        {currentWord.term}
      </div>
      <div className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
        {currentWord.shortDefinition}
      </div>
      <style>{`
        @keyframes tutor-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.button>
  );
};
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Tutor/TutorIdle.tsx
git commit -m "feat(tutor): TutorIdle component (state idle)

Card top-right cliquable, reprend cosmic spinner du DidYouKnowCard.
Click → openPrompting().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.3 : Composant `TutorPrompting`

**Files:**

- Create: `frontend/src/components/Tutor/TutorPrompting.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
import React from "react";
import { motion } from "framer-motion";
import { X, Type, Mic } from "lucide-react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorMode } from "../../types/tutor";

interface TutorPromptingProps {
  onMode: (mode: TutorMode) => void;
  onCancel: () => void;
}

export const TutorPrompting: React.FC<TutorPromptingProps> = ({
  onMode,
  onCancel,
}) => {
  const { currentWord } = useLoadingWord();
  const { t } = useTranslation();

  if (!currentWord) return null;
  // @ts-expect-error - i18n keys ajoutées en Task 1.3
  const tt = t.tutor;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed top-3 right-3 z-40 w-[220px] rounded-2xl border border-accent-primary/40 bg-bg-secondary/97 backdrop-blur-xl p-3 shadow-lg shadow-black/40"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-display text-sm font-semibold text-text-primary leading-tight">
          {currentWord.term}
        </div>
        <button
          onClick={onCancel}
          className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 -mt-0.5 -mr-0.5"
          aria-label={tt.prompting.back}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-text-secondary mb-3 italic">
        {tt.prompting.ask}
      </p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onMode("text")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-medium transition-colors border border-accent-primary/20"
        >
          <span className="flex items-center gap-2">
            <Type className="w-3.5 h-3.5" />
            {tt.prompting.mode_text}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.prompting.mode_text_duration}
          </span>
        </button>
        <button
          onClick={() => onMode("voice")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-medium transition-colors border border-white/10"
        >
          <span className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5" />
            {tt.prompting.mode_voice}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.prompting.mode_voice_duration}
          </span>
        </button>
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS (les `tt.tutor.*` keys sont déjà ajoutées en Task 1.3).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Tutor/TutorPrompting.tsx
git commit -m "feat(tutor): TutorPrompting component (state prompting)

Mode selector Texte / Voix avec durées indicatives.
Bouton retour → cancel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.4 : Composant `TutorMiniChat`

**Files:**

- Create: `frontend/src/components/Tutor/TutorMiniChat.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send, Maximize2 } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorTurn } from "../../types/tutor";

interface TutorMiniChatProps {
  conceptTerm: string;
  messages: TutorTurn[];
  loading: boolean;
  onSubmit: (input: string) => void;
  onDeepen: () => void;
  onClose: () => void;
}

export const TutorMiniChat: React.FC<TutorMiniChatProps> = ({
  conceptTerm,
  messages,
  loading,
  onSubmit,
  onDeepen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // @ts-expect-error i18n keys
  const tt = t.tutor;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className="fixed top-3 right-3 z-40 w-[280px] h-[400px] rounded-2xl border border-accent-primary/30 bg-bg-secondary/98 backdrop-blur-xl shadow-2xl shadow-black/50 flex flex-col"
      role="dialog"
      aria-label={tt.title}
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="font-display text-sm font-semibold text-text-primary leading-tight truncate">
          {conceptTerm}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDeepen}
            className="text-text-tertiary hover:text-accent-primary p-1 transition-colors"
            aria-label={tt.mini_chat.deepen}
            title={tt.mini_chat.deepen}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-red-400 p-1 transition-colors"
            aria-label={tt.mini_chat.close}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`px-3 py-2 rounded-lg text-xs leading-relaxed ${
              msg.role === "assistant"
                ? "bg-accent-primary/10 text-text-secondary self-start max-w-[85%]"
                : "bg-indigo-500/15 text-text-primary self-end max-w-[85%] ml-auto"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="px-3 py-2 rounded-lg bg-accent-primary/5 text-text-tertiary text-xs italic max-w-[85%]">
            …
          </div>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1.5 p-2 border-t border-white/5"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tt.mini_chat.input_placeholder}
          disabled={loading}
          className="flex-1 bg-white/5 border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="p-1.5 rounded-md bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </motion.div>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Tutor/TutorMiniChat.tsx
git commit -m "feat(tutor): TutorMiniChat component (state mini-chat)

Panel expansé 280×400 avec thread messages + input texte +
boutons Approfondir / Fermer.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.5 : Composant `TutorDeepSession` (V1.0 — texte uniquement, voice TODO)

**Files:**

- Create: `frontend/src/components/Tutor/TutorDeepSession.tsx`

**Note importante** : V1.0 implémente le LAYOUT fullscreen + le mode texte (réutilisation de la logique mini-chat). Le mode voix vrai (Voxtral STT + ElevenLabs TTS playback) est marqué TODO V1.1 — l'orb pulsante est statique (animation visuelle), pas de capture audio active. Cela permet de shipper V1.0 sans dépendance bloquante côté infrastructure voice.

- [ ] **Step 1: Écrire le composant**

```tsx
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Type, Pause } from "lucide-react";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorTurn } from "../../types/tutor";

interface TutorDeepSessionProps {
  conceptTerm: string;
  messages: TutorTurn[];
  loading: boolean;
  mode: "text" | "voice";
  onSubmit: (input: string) => void;
  onSwitchToText: () => void;
  onClose: () => void;
}

export const TutorDeepSession: React.FC<TutorDeepSessionProps> = ({
  conceptTerm,
  messages,
  loading,
  mode,
  onSubmit,
  onSwitchToText,
  onClose,
}) => {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [textInputVisible, setTextInputVisible] = useState(mode === "text");
  const [elapsedSec, setElapsedSec] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // @ts-expect-error i18n keys
  const tt = t.tutor;

  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (textInputVisible) inputRef.current?.focus();
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [textInputVisible, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !loading) {
      onSubmit(input.trim());
      setInput("");
    }
  };

  const handleSwitchText = () => {
    setTextInputVisible(true);
    onSwitchToText();
  };

  const formatElapsed = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-2xl h-[80vh] rounded-3xl border border-accent-primary/25 bg-bg-secondary/98 backdrop-blur-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
        >
          <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-accent-primary font-semibold">
                {mode === "voice" ? "Session vocale" : "Session texte"}
              </span>
              <span className="font-display text-xl font-semibold text-text-primary mt-0.5">
                {conceptTerm}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-tertiary tabular-nums">
                {formatElapsed(elapsedSec)}
              </span>
              <button
                onClick={onClose}
                className="text-text-tertiary hover:text-red-400 p-1.5 transition-colors"
                aria-label={tt.deep_session.end}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {mode === "voice" && !textInputVisible && (
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.4, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-32 h-32 rounded-full bg-gradient-radial from-accent-primary/40 to-transparent flex items-center justify-center"
              >
                <div className="w-12 h-12 rounded-full bg-accent-primary/80" />
              </motion.div>
              <p className="absolute bottom-32 text-text-tertiary text-sm italic">
                Mode voix V1.1 — utilise le bouton "
                {tt.deep_session.switch_to_text}" en attendant.
              </p>
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-[75%] ${
                  msg.role === "assistant"
                    ? "bg-accent-primary/10 text-text-secondary self-start"
                    : "bg-indigo-500/20 text-text-primary self-end ml-auto"
                }`}
              >
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="px-4 py-3 rounded-2xl bg-accent-primary/5 text-text-tertiary text-sm italic max-w-[75%]">
                …
              </div>
            )}
          </div>

          {textInputVisible && (
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 px-6 py-4 border-t border-white/5"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={tt.mini_chat.input_placeholder}
                disabled={loading}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary/40"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-accent-primary/20 hover:bg-accent-primary/30 text-accent-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-accent-primary/30"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          <footer className="flex justify-center gap-2 px-6 py-3 border-t border-white/5 bg-bg-tertiary/50">
            {mode === "voice" && !textInputVisible && (
              <button
                onClick={handleSwitchText}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-medium transition-colors border border-white/10"
              >
                <Type className="w-3.5 h-3.5" />
                {tt.deep_session.switch_to_text}
              </button>
            )}
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-colors border border-red-500/20"
            >
              {tt.deep_session.end}
            </button>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Tutor/TutorDeepSession.tsx
git commit -m "feat(tutor): TutorDeepSession component (state deep-session)

Modal fullscreen avec orb pulsante (visuel) + transcript + input texte.
Mode voix V1.0 affiche l'orb mais STT/TTS reportés à V1.1.
Esc / clique 'Fin' → fermeture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 4.6 : Composant racine `Tutor.tsx` + index

**Files:**

- Create: `frontend/src/components/Tutor/Tutor.tsx`
- Create: `frontend/src/components/Tutor/index.ts`
- Create: `frontend/src/components/Tutor/__tests__/Tutor.test.tsx`

- [ ] **Step 1: Test FAILING**

`frontend/src/components/Tutor/__tests__/Tutor.test.tsx` :

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Tutor } from "../Tutor";
import { LoadingWordProvider } from "../../../contexts/LoadingWordContext";
import { LanguageProvider } from "../../../contexts/LanguageContext";

vi.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn().mockResolvedValue({
      session_id: "tutor-test123",
      first_prompt: "Comment l'expliqueriez-vous ?",
      audio_url: null,
    }),
    sessionTurn: vi.fn().mockResolvedValue({
      ai_response: "Très bien.",
      audio_url: null,
      turn_count: 3,
    }),
    sessionEnd: vi.fn().mockResolvedValue({
      duration_sec: 30,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    }),
  },
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { plan: "pro" },
  }),
}));

const renderTutor = () =>
  render(
    <LanguageProvider>
      <LoadingWordProvider>
        <Tutor />
      </LoadingWordProvider>
    </LanguageProvider>,
  );

describe("Tutor (composant racine)", () => {
  it("renders idle state by default", async () => {
    renderTutor();
    await waitFor(() => {
      expect(screen.getByLabelText(/Ouvrir le Tuteur/i)).toBeInTheDocument();
    });
  });

  it("transitions to prompting on click idle", async () => {
    renderTutor();
    const idleButton = await screen.findByLabelText(/Ouvrir le Tuteur/i);
    fireEvent.click(idleButton);
    await waitFor(() => {
      expect(screen.getByText(/On en parle/i)).toBeInTheDocument();
    });
  });

  it("transitions to mini-chat on text mode", async () => {
    renderTutor();
    const idleButton = await screen.findByLabelText(/Ouvrir le Tuteur/i);
    fireEvent.click(idleButton);
    const textBtn = await screen.findByText("Texte");
    fireEvent.click(textBtn);
    await waitFor(() => {
      expect(
        screen.getByText("Comment l'expliqueriez-vous ?"),
      ).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Lancer → FAIL**

```bash
cd frontend && npm run test -- Tutor.test.tsx
```

- [ ] **Step 3: Implémenter `Tutor.tsx`**

```tsx
import React from "react";
import { AnimatePresence } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAuth } from "../../hooks/useAuth";
import { useTutor } from "./useTutor";
import { TutorIdle } from "./TutorIdle";
import { TutorPrompting } from "./TutorPrompting";
import { TutorMiniChat } from "./TutorMiniChat";
import { TutorDeepSession } from "./TutorDeepSession";
import type { TutorMode } from "../../types/tutor";

export const Tutor: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tutor = useTutor();

  if (!isAuthenticated || !currentWord) return null;

  const handleMode = (mode: TutorMode) => {
    tutor.startSession({
      concept_term: currentWord.term,
      concept_def: currentWord.definition,
      summary_id: currentWord.summaryId,
      source_video_title: currentWord.videoTitle,
      mode,
      lang: language === "fr" ? "fr" : "en",
    });
  };

  return (
    <AnimatePresence mode="wait">
      {tutor.phase === "idle" && (
        <TutorIdle key="idle" onClick={tutor.openPrompting} />
      )}
      {tutor.phase === "prompting" && (
        <TutorPrompting
          key="prompting"
          onMode={handleMode}
          onCancel={tutor.cancelPrompting}
        />
      )}
      {tutor.phase === "mini-chat" && tutor.conceptTerm && (
        <TutorMiniChat
          key="mini-chat"
          conceptTerm={tutor.conceptTerm}
          messages={tutor.messages}
          loading={tutor.loading}
          onSubmit={tutor.submitTextTurn}
          onDeepen={tutor.deepen}
          onClose={tutor.endSession}
        />
      )}
      {tutor.phase === "deep-session" && tutor.conceptTerm && (
        <TutorDeepSession
          key="deep-session"
          conceptTerm={tutor.conceptTerm}
          messages={tutor.messages}
          loading={tutor.loading}
          mode={tutor.mode}
          onSubmit={tutor.submitTextTurn}
          onSwitchToText={() => {
            /* déjà géré dans le composant : on switch local. Le mode reste sur 'voice' au niveau state. */
          }}
          onClose={tutor.endSession}
        />
      )}
    </AnimatePresence>
  );
};

export default Tutor;
```

- [ ] **Step 4: Index**

```typescript
// frontend/src/components/Tutor/index.ts
export { Tutor, default } from "./Tutor";
```

- [ ] **Step 5: Re-run tests**

```bash
cd frontend && npm run test -- Tutor.test.tsx
```

Expected: 3 PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Tutor/Tutor.tsx frontend/src/components/Tutor/index.ts frontend/src/components/Tutor/__tests__/Tutor.test.tsx
git commit -m "feat(tutor): Tutor root component (state machine routing)

Compose les 4 sous-composants selon useTutor.phase.
Tests Vitest 3 cas (idle render, prompting click, mini-chat start).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Intégration

### Task 5.1 : Remplacer `DidYouKnowCard` par `Tutor` dans le layout

**Files:**

- Modify: `frontend/src/App.tsx` (ou `frontend/src/components/layout/DashboardLayout.tsx` selon où DidYouKnowCard était monté)

- [ ] **Step 1: Localiser l'ancien mount**

```bash
grep -rn 'DidYouKnowCard' frontend/src --include='*.tsx' --include='*.ts' | grep -v _archive
```

Si aucun résultat (les imports ont été nettoyés en Task 1.2) : ajouter le mount à l'endroit où DidYouKnowCard était utilisé. Sinon : remplacer.

- [ ] **Step 2: Ajouter `<Tutor />` dans le layout**

Repérer `App.tsx` (ou `DashboardLayout.tsx`). Ajouter l'import :

```tsx
import { Tutor } from "./components/Tutor";
```

Et monter le composant **uniquement pour les utilisateurs authentifiés**, dans le layout des routes `/dashboard`, `/study`, `/history` (pas sur les routes publiques `/`, `/login`, `/upgrade`).

Exemple si pattern existant :

```tsx
// dans le rendering des routes protégées
<>
  <Sidebar ... />
  <main>{children}</main>
  <Tutor />
</>
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Lancer le dev server et vérifier visuellement**

```bash
cd frontend && npm run dev
```

Naviguer vers `http://localhost:5173/dashboard` (avec un user Pro authentifié). Vérifier :

- Le widget Tutor apparaît top-right
- Click → state prompting (avec mode selector)
- Click "Texte" → state mini-chat avec premier prompt Magistral
- Tap input + Enter → user message + ai response
- Click maximiser → state deep-session fullscreen
- Esc ou Fin → retour idle

Si KO : checker la console DevTools pour erreurs réseau / TS.

- [ ] **Step 5: Tuer le dev server**

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
# (ou DashboardLayout.tsx)
git commit -m "feat(layout): mount Tutor sur les routes protégées

Remplace DidYouKnowCard par Tutor dans le dashboard.
Affiché uniquement pour users authentifiés.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5.2 : Vérification non-régression frontend

**Files:**

- Run: typecheck + tests + build complet du frontend

- [ ] **Step 1: Typecheck full**

```bash
cd frontend && npm run typecheck
```

Expected: PASS clean (zéro erreur).

- [ ] **Step 2: Tests Vitest**

```bash
cd frontend && npm run test -- --run
```

Expected: tous PASS (au moins les nouveaux Tutor + pas de régression sur l'existant).

- [ ] **Step 3: Build production**

```bash
cd frontend && npm run build
```

Expected: build success. Vérifier qu'il n'y a pas de warning sur les fichiers archivés.

- [ ] **Step 4: Pas de commit (smoke test)**

---

## Phase 6 — Tests E2E + finalisation

### Task 6.1 : Test E2E text mode (Playwright)

**Files:**

- Create: `frontend/e2e/tutor.spec.ts`

- [ ] **Step 1: Inspirer des tests existants**

```bash
ls frontend/e2e/ && cat frontend/e2e/dashboard-minimal.spec.ts | head -30
```

Repérer le pattern login + navigation.

- [ ] **Step 2: Écrire le test E2E**

```typescript
// frontend/e2e/tutor.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Tutor — text mode flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login as Pro user (réutiliser le helper existant si dispo)
    await page.goto("/login");
    await page.fill(
      'input[name="email"]',
      process.env.E2E_PRO_EMAIL || "pro@test.com",
    );
    await page.fill(
      'input[name="password"]',
      process.env.E2E_PRO_PASSWORD || "test1234",
    );
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard");
  });

  test("idle → prompting → mini-chat (text) → end", async ({ page }) => {
    // 1. Idle visible
    const tutorButton = page.getByLabel(/Ouvrir le Tuteur|Open the Tutor/);
    await expect(tutorButton).toBeVisible({ timeout: 10000 });

    // 2. Click → prompting
    await tutorButton.click();
    await expect(page.getByText(/On en parle|Want to discuss/)).toBeVisible();

    // 3. Click "Texte" → mini-chat
    await page.getByText(/^Texte$|^Text$/).click();
    // Attendre que le 1er prompt Magistral arrive (peut prendre 2-5s)
    await expect(
      page
        .locator('[role="dialog"]')
        .or(page.locator('text="Tapez votre réponse"').first()),
    ).toBeVisible({ timeout: 15000 });

    // 4. Envoyer un tour
    const input = page
      .locator('input[placeholder*="Tapez"]')
      .or(page.locator('input[placeholder*="Type"]'))
      .first();
    await input.fill("C'est un principe de simplicité.");
    await input.press("Enter");

    // 5. Vérifier qu'une réponse IA arrive (loading puis message)
    await expect(
      page
        .locator("div")
        .filter({ hasText: /^.{20,}/ })
        .nth(2),
    ).toBeVisible({ timeout: 15000 });

    // 6. Fermer
    await page.getByLabel(/Fermer|Close/).click();
    await expect(tutorButton).toBeVisible();
  });
});
```

- [ ] **Step 3: Run le test E2E**

```bash
cd frontend && npx playwright test tutor.spec.ts --reporter=list
```

Expected: PASS (peut requérir un user E2E_PRO préalable en DB).

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/tutor.spec.ts
git commit -m "test(e2e): tutor text mode flow (idle → prompting → mini-chat → end)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6.2 : QA manuelle 5 concepts variés

**Files:**

- Document: `docs/superpowers/plans/2026-05-03-le-tuteur-companion.md` (cette section)

- [ ] **Step 1: Lancer le stack complet en local**

```bash
# Terminal 1
cd backend/src && uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Login user Pro**

Naviguer `http://localhost:5173/login` et se logger comme user Pro.

- [ ] **Step 3: Tester 5 concepts variés**

Pour chacun, ouvrir le widget, lancer mode Texte, échanger 2-3 tours, vérifier la qualité du dialogue (ton sobre/pro, pas de gimmick, questions ouvertes, citations source si dispo) :

1. **Effet Dunning-Kruger** (biais cognitif)
2. **Rasoir d'Occam** (philosophie)
3. **Entropie** (science)
4. **Allégorie de la caverne** (philosophie)
5. **Effet papillon** (science chaos)

- [ ] **Step 4: Documenter les retours dans une note manuelle**

Si la qualité du dialogue est OK : marquer ce step done.
Si la qualité est mauvaise (dialogue creux, ton mauvais, hallucination) : créer une issue ou ajuster le `TUTOR_SYSTEM_PROMPT_TEMPLATE` dans `backend/src/tutor/prompts.py` (incrément `TUTOR_PERSONA_VERSION` à `v1.1`).

- [ ] **Step 5: Si ajustement prompt nécessaire, recommitter**

```bash
git add backend/src/tutor/prompts.py
git commit -m "tweak(tutor): persona prompt v1.1 — [explique l'ajustement]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 6.3 : Finalisation — push + PR

**Files:**

- Run: tests complets + push branche + créer PR

- [ ] **Step 1: Lancer toute la suite de tests**

```bash
cd backend && python -m pytest tests/test_tutor*.py -v
cd ../frontend && npm run typecheck && npm run test -- --run
```

Expected: tous PASS.

- [ ] **Step 2: Vérifier git state propre**

```bash
git status
```

Expected: rien à committer (tout est sur la branche `feat/le-tuteur-companion` ou similaire).

- [ ] **Step 3: Push la branche**

```bash
git push -u origin feat/le-tuteur-companion
```

(Si la branche est `fix/hub-nav-redesign` car on a tout ajouté dessus, demander à l'user s'il préfère un rebase / cherry-pick sur une branche dédiée. Cf. mémoire `feedback_auto-push-after-commit.md` : pas de push auto sur branches feature.)

- [ ] **Step 4: Créer la PR**

```bash
gh pr create --title "feat: Le Tuteur — refonte widget en compagnon conversationnel" --body "$(cat <<'EOF'
## Summary

- Remplace `DidYouKnowCard` (widget passif) et le système `WhackAMole` (mini-jeu) par **Le Tuteur**, un compagnon conversationnel sobre basé sur Magistral (texte) + Voxtral/ElevenLabs (voix V1.1).
- State machine 4 phases : `idle` → `prompting` → `mini-chat` (texte) ou `deep-session` (voix).
- Module backend `backend/src/tutor/` : 3 endpoints `/api/tutor/session/{start,turn,end}`, sessions Redis TTL 1h, persona "sobre & pro" via system prompt fixe V1.
- Plan gating : Pro & Expert (Free → CTA upgrade).

## Spec & plan

- Spec : `docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md`
- Plan : `docs/superpowers/plans/2026-05-03-le-tuteur-companion.md`

## Suppressions
- `frontend/src/components/DidYouKnowCard.tsx` → archivé
- `frontend/src/components/WhackAMole/*` → archivés
- `WhackAMoleToggle` (sidebar) supprimé
- Clés i18n `dashboard.modes.*` supprimées, remplacées par `tutor.*`

## Test plan
- [x] Backend pytest tests/test_tutor_*.py
- [x] Frontend Vitest Tutor.test.tsx + useTutor.test.ts
- [x] E2E Playwright tutor.spec.ts (text mode)
- [x] QA manuelle 5 concepts variés
- [ ] Mode voix (V1.1, hors PR)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Retourner l'URL PR à l'utilisateur**

L'URL de la PR doit s'afficher après `gh pr create`. Si non : `gh pr view --web`.

---

## Self-Review

Vérification du plan vs spec :

**1. Spec coverage** (chaque section du spec couverte par une task) :

- ✅ Contexte / objectifs / décisions verrouillées : reflétés dans le préambule du plan
- ✅ Architecture macro : Phase 2 (backend) + Phase 4 (frontend)
- ✅ Composant frontend `Tutor.tsx` + state machine 4 états : Tasks 4.1 à 4.6
- ✅ Backend router 3 endpoints : Tasks 2.4, 2.5, 2.6
- ✅ Schemas Pydantic : Task 2.1
- ✅ Persona prompt sobre & pro : Task 2.2
- ✅ Session state Redis : Task 2.3
- ✅ Quotas & plan gating : Task 2.4 step 5 (`is_feature_available`)
- ✅ Réutilisation existant : `LoadingWordContext` (Task 4.2), Voice infra (Tasks 4.5 + 6.x), Magistral (Tasks 2.4-2.5)
- ✅ Suppressions : Tasks 1.1, 1.2
- ✅ i18n : Task 1.3
- ✅ Tests unit + E2E : Tasks 2.3, 2.4, 4.1, 4.6, 6.1
- ✅ Migrations DB : "aucune V1" — confirmé partout
- ⚠️ Voix complète (Voxtral STT + ElevenLabs TTS playback) : marqué V1.1 / TODO dans Task 4.5 et Task 2.5. **Divergence assumée** : V1.0 livre le mode texte complet + le LAYOUT voix (orb, fullscreen) sans capture audio, V1.1 branche STT/TTS. Ceci permet de shipper plus vite.

**2. Placeholder scan** :

- Pas de "TBD", "TODO" hors V1.1 documentés
- Tous les imports `core.redis_client` / `core.llm_provider` sont marqués "ADAPTER selon helpers existants" : c'est un step explicite (grep pour repérer le helper réel), pas un placeholder caché.
- Tests unit + E2E ont du code complet, pas "écris des tests pour"

**3. Type consistency** :

- `TutorMode = "text" | "voice"` cohérent entre backend (schemas.py) et frontend (types/tutor.ts)
- `TutorPhase = "idle" | "prompting" | "mini-chat" | "deep-session"` utilisé dans hook + composant racine
- `SessionStartRequest` / `SessionStartResponse` mêmes champs frontend ↔ backend
- `tutorApi.sessionStart/Turn/End` ↔ endpoints backend `/session/{start,turn,end}` cohérents

**Issue identifiée et corrigée inline** : initialement j'avais mentionné `audio_blob` dans schemas.py mais `audio_blob_b64` dans le test. Harmonisé sur `audio_blob_b64` (base64 string) partout.

**Issue mineure** : le plan ne couvre pas explicitement le test backend "session expired" (TTL Redis 1h passé). À ajouter en Task 2.7 ou suivant si besoin. Pour V1, le test "session inexistante" couvre l'essentiel.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-03-le-tuteur-companion.md`.**

**Two execution options** :

1. **Subagent-Driven (recommended)** — Je dispatche un sub-agent Opus 4.7 frais par task (ou par phase si l'user préfère plus gros lot), review entre chaque, fast iteration. Bien adapté pour ce plan avec 6 phases relativement indépendantes.

2. **Inline Execution** — Je l'exécute moi-même dans cette session, batch execution avec checkpoints toutes les 1-2 phases.

**Which approach ?**
