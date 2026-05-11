# Le Tuteur — Refonte 2026-05-10

**Date** : 2026-05-10
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Active — implémentation en cours via 2 sub-agents Opus 4.7 parallèles
**Supersedes** : `2026-05-03-le-tuteur-voice-v1-1-design.md`, `2026-05-03-le-tuteur-companion-design.md` (parties voice TTS one-shot abandonnées)

## Contexte

Le Tuteur web actuel (`frontend/src/components/Tutor/`) souffre de 3 problèmes :

1. **Popup coincé en `fixed top-3 right-3`** — pas de drag, pas de minimize, pas de close persistant
2. **Mode "voice" cassé** — le bouton lance une session avec TTS one-shot par turn (ElevenLabs), mais STT renvoie 501 (`backend/src/tutor/router.py:194`). User doit cliquer "Switch to text" pour répondre. UX décevante : "ça lance juste un chat textuel"
3. **Pas de Tuteur vocal global** — l'expérience voice doit être détachée du popup et offrir un agent ConvAI ElevenLabs avec contexte historique (analyses passées, concepts clés)

## Décisions verrouillées (2026-05-10)

| # | Décision | Choix retenu |
|---|---|---|
| 1 | Bouton "Voice" du popup `TutorPrompting` | **Retiré**. Popup text-only |
| 2 | Comportement fenêtre Tuteur (UX windowing) | **Drag libre + snap aux 4 coins** |
| 3 | Architecture Tuteur ElevenLabs | **Nouvel agent `knowledge_tutor`** (à côté de COMPANION dans `agent_types.py`) |
| 4 | Point d'entrée Tuteur Vocal | **Sidebar item + bouton dans popup** (combinaison) |
| 5 | LLM | Magistral pour text popup (déjà en place), ElevenLabs ConvAI pour voice |
| 6 | Périmètre V1 | **Web only**. Mobile + Extension → V2 (pas de changement) |
| 7 | Sub-agents implémentation | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`) |

## Architecture cible

### Axe A — Popup windowing (drag + snap + minimize + close)

Nouveau wrapper `frontend/src/components/Tutor/DraggableTutorWindow.tsx` :

- **Drag libre** via Framer Motion `drag` avec `dragConstraints` clampés au viewport
- **Snap au lâcher** : `onDragEnd` calcule le coin le plus proche (TR/TL/BR/BL), anime vers `top/left` avec margin 12px
- **Position persistée** : `localStorage["ds-tutor-corner"]` ∈ `{TR, TL, BR, BL}`
- **Header drag-handle** : zone 32px haut, `cursor-grab` → `cursor-grabbing` + boutons minimize/close
- **Minimize** : `localStorage["ds-tutor-minimized"]`. Render pastille 48×48 (spinner cosmic seul)
- **Close** : `localStorage["ds-tutor-hidden"] = "true"`. Re-affichage seulement après nouvelle analyse OU clic sur item sidebar de réveil
- **Resize fenêtre** : recalcul depuis le coin sauvé (pas x/y absolus)

Wrap chacun de `TutorIdle.tsx`, `TutorPrompting.tsx`, `TutorMiniChat.tsx` dans `<DraggableTutorWindow>`. Retirer leur `fixed top-3 right-3` actuel.

### Axe B — Popup text-only

- `TutorPrompting.tsx` : retirer le bouton "Voice" (lignes 58-69). Conserver "Texte" seul (renommé "Démarrer" ou "Discuter")
- `Tutor.tsx` : supprimer la branche `phase === "deep-session"` (lignes 55-68)
- `useTutor.ts` : supprimer `mode: "voice"`, `currentAudioUrl`, branchements deep-session. State machine = `idle → prompting → mini-chat`
- `types/tutor.ts` : `TutorMode = "text"` only (ou supprimer le type)
- `i18n/fr.json` + `en.json` : cleanup clés `tutor.prompting.mode_voice*`, `tutor.deep_session.*`
- **Backend `tutor/router.py` non touché** (le code voice reste, inutilisé)

### Axe C — Nouvel agent voice `knowledge_tutor`

#### Backend `backend/src/voice/agent_types.py`

Ajouter après `EXPLORER_STREAMING` :

```python
KNOWLEDGE_TUTOR = AgentConfig(
    agent_type="knowledge_tutor",
    display_name="Knowledge Tutor",
    display_name_fr="Tuteur",
    description="Reviews concepts and key ideas across your watched videos",
    description_fr="Révise concepts et idées clés vus dans tes analyses",
    system_prompt_fr=KNOWLEDGE_TUTOR_PROMPT_FR,
    system_prompt_en=KNOWLEDGE_TUTOR_PROMPT_EN,
    tools=[
        "get_user_history",
        "get_concept_keys",
        "search_history",
        "get_summary_detail",
        "web_search",
    ],
    voice_style="warm",
    temperature=0.65,
    max_session_minutes=15,
    requires_summary=False,
    first_message_fr="Bonjour. Je suis le Tuteur — je connais les analyses que vous avez consultées. Sur quoi voulez-vous revenir aujourd'hui ?",
    first_message="Hello. I'm the Tutor — I know the analyses you've reviewed. What would you like to revisit today?",
    plan_minimum="pro",
)

AGENT_REGISTRY["knowledge_tutor"] = KNOWLEDGE_TUTOR
```

#### Nouveau `backend/src/voice/knowledge_tutor_prompts.py`

Inspiré du brief sobre du spec mai 2026 :

- Persona "Le Tuteur DeepSight" (vouvoiement adulte neutre, ton sobre + chaleureux, pas de gimmick)
- Doit appeler **systématiquement** `get_concept_keys` + `get_user_history` au début pour orienter
- Méthode socratique : poser une question ouverte, écouter, corriger avec bienveillance, proposer un sujet adjacent
- Cadre : 15 min max
- Fallback `web_search` si concept non couvert par l'historique

Format : 2 strings `KNOWLEDGE_TUTOR_PROMPT_FR` et `KNOWLEDGE_TUTOR_PROMPT_EN`, suivre le pattern de `companion_prompt.py` ou `streaming_prompts.py`.

#### Nouveau `backend/src/voice/knowledge_tutor_tools.py`

```python
async def get_user_history(user: User, limit: int = 10, days_back: int = 60) -> list[dict]:
    """Last N analyses du user — { id, title, video_id, platform, created_at, key_concepts }."""

async def get_concept_keys(user: User, limit: int = 20) -> list[dict]:
    """Top concepts/keywords agrégés — réutilise /api/history/keywords logic."""

async def search_history(user: User, query: str, top_k: int = 5) -> list[dict]:
    """Semantic search V1 (PR #292 deployed prod 2026-05-03)."""

async def get_summary_detail(user: User, summary_id: int) -> dict:
    """Détail d'une analyse : titre, full_digest, points clés, fact-check."""
```

Wiring : enregistrer ces tools dans `backend/src/voice/tools.py` (ou équivalent) avec le bon mapping vers le ConvAI tools schema. **Suivre le pattern de COMPANION** : ses tools (`web_search`, `transfer_to_video`, `get_more_recos`, `start_analysis`) sont définis dans `voice/web_tools.py`, `voice/companion_recos.py`, `voice/companion_external.py` — calquer.

#### Aucune migration DB

Réutilise `Summary`, `User`, `TranscriptEmbedding` (semantic search V1).

### Axe D — Frontend voice tutor entry points

#### Sidebar — entrée globale

`frontend/src/components/layout/Sidebar.tsx` :

- Ajouter item "Tuteur Vocal" avec icône `GraduationCap` (lucide-react)
- Gating : `canAccess(plan, "companion_dialogue", "web")` (cf `frontend/src/config/planPrivileges.ts`)
- Au clic → ouvrir le composant voice existant (réutiliser le drawer/modal qui gère COMPANION) avec `agent_type: "knowledge_tutor"`
- L'infra Quick Voice Call WebSocket ConvAI est déjà en place (cf `frontend/src/components/Voice/*` ou similaire — à localiser dans le worktree)

#### Bouton dans popup `TutorMiniChat`

- Ajouter bouton header "🎙 Tuteur Vocal" entre Maximize2 et X
- Au clic → même session ConvAI mais en passant le concept courant en `initial_context: { concept_term, summary_id? }`
- L'agent reçoit le concept comme amorce dans son `first_message_fr` ou via injection `[CONTEXT]` block

## Plan d'exécution — 2 agents Opus 4.7 parallèles

| Agent | Phases | Branche | Worktree | Fichiers principaux |
|---|---|---|---|---|
| **A — Frontend popup refactor** | Phase 1 (text-only) + Phase 2 (windowing) | `feat/tutor-popup-refactor` | `.claude-worktrees/tutor-popup` | `frontend/src/components/Tutor/*`, `frontend/src/types/tutor.ts`, `frontend/src/i18n/*` |
| **B — Backend knowledge_tutor agent** | Phase 3 (agent + tools) | `feat/knowledge-tutor-agent` | `.claude-worktrees/knowledge-tutor` | `backend/src/voice/agent_types.py`, `backend/src/voice/knowledge_tutor_prompts.py` (new), `backend/src/voice/knowledge_tutor_tools.py` (new), `backend/src/voice/tools.py` (wiring) |

**Phase 4** (frontend voice entry points) attend Phase 3 mergée puis sera dispatchée séparément.

## Tests requis (par agent)

### Agent A
- `cd frontend && npm run typecheck && npm run lint && npm run test -- Tutor`
- Vitest tests sur `DraggableTutorWindow` (snap logic 4 coins, persistance localStorage)
- Mettre à jour `frontend/src/components/Tutor/__tests__/Tutor.test.tsx` (state machine simplifiée)
- E2E `frontend/e2e/tutor.spec.ts` : flow text complet OK

### Agent B
- `cd backend && python -m pytest tests/voice/ -v`
- Nouveau `backend/tests/voice/test_knowledge_tutor.py` :
  - `get_agent_config("knowledge_tutor")` retourne config attendue
  - Tools schema valides pour ConvAI
  - `get_user_history` retourne format attendu sur fixture user
  - `search_history` réutilise pipeline semantic V1 sans régression

## Conventions DeepSight (rappel pour les agents)

- **Backend** : async/await, type hints, Pydantic v2, httpx (pas requests), logger structuré, secrets via `core/config.py`
- **Frontend** : TypeScript strict zéro `any`, functional components, Tailwind (pas CSS modules), Framer Motion, React Router 6
- **Commits atomiques** : un commit logique = un sujet. Format `feat(tutor): ...` ou `refactor(tutor): ...`
- **Règle absolue Opus 4.7** : tout sub-agent spawné doit tourner en `claude-opus-4-7[1m]`
- **Push automatique sur main interdit** : créer une branche `feat/...`, push la branche, créer une PR via `gh pr create`
- **Memory feedback** : pas de redemande sur choix design DeepSight, appliquer le choix recommandé directement

## Workflow par agent

1. `cd C:\Users\33667\DeepSight-Main`
2. `git fetch origin && git checkout main && git pull origin main`
3. `git worktree add .claude-worktrees/<nom> -b <branche>` (depuis main à jour)
4. `cd .claude-worktrees/<nom>`
5. Implémenter selon les sections de ce spec
6. Tests verts
7. `git add` ciblé (pas `-A`), `git commit -m "..."`
8. `git push -u origin <branche>`
9. `gh pr create --title "..." --body "..."` (référencer ce spec dans le body)
10. Reporter au main thread : URL PR, fichiers touchés, tests passés

## Phases hors scope V1

- **Phase 4** (frontend voice entry points) : à dispatcher après merge Phase 3
- **Phase 5** (QA + deploy + docs) : à faire manuellement après merge des 2 PRs
- **Mobile + Extension** : V2

## Memory à créer après deploy

`project_tutor-refactor-2026-05-10.md` dans `~/.claude/projects/C--Users-33667/memory/` — résumant ce qui a été déployé, PRs mergées, état tri-plateforme.
