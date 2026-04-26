# ElevenLabs Ecosystem — Resume Plan (post-org-limit crash)

**Date** : 2026-04-25
**Contexte** : 6 agents Opus 4.7 ont été lancés en parallèle pour implémenter les 6 sous-specs du plan ElevenLabs. **5/6 ont planté avec « org monthly usage limit ».** Le travail partiel a été préservé sur des branches `feat/elevenlabs-spec-*` via PRs draft.

**Spec source** : `docs/superpowers/specs/2026-04-25-elevenlabs-ecosystem-architecture-design.md` (commit `f219dbc6`).

---

## État global

| PR          | Spec                             | Branche                                        | Statut            | À faire                            |
| ----------- | -------------------------------- | ---------------------------------------------- | ----------------- | ---------------------------------- |
| ~~#122~~ ✅ | #0 — fix express web search      | `feat/elevenlabs-spec-0` (mergée → `ac361e61`) | **DONE**          | rien                               |
| #124        | #1 — backend foundation          | `feat/elevenlabs-spec-1`                       | partial 2/8       | finir 6 sous-tâches                |
| #125        | #2 — web foundation              | `feat/elevenlabs-spec-2`                       | partial 1/5       | migration 3 pages + tests          |
| #127        | #3 — mobile                      | `feat/elevenlabs-spec-3`                       | recovery          | câblage library + study            |
| #128        | #4 — extension Chrome side panel | `feat/elevenlabs-spec-4`                       | recovery          | tests + build verify               |
| #126        | #5 — Chat IA web overlay         | `feat/elevenlabs-spec-5`                       | partial 4 commits | dépend de #1, vérif typecheck/test |

---

## ⚠️ Avertissement transverse — base obsolète

La base `spec/elevenlabs-base` (commit `f219dbc6`) **précède le merge du fix widget nuclear** (PR #116, commit `4d2949b2`). Toutes les branches `feat/elevenlabs-spec-*` ne contiennent pas le fix `#0a0a0f` hardcoded sauf #128 qui a été restaurée manuellement depuis `origin/main`.

**Action obligatoire avant merge** : rebase chaque PR sur `origin/main` ou squash-merge. Vérifier post-merge que `grep -c '0a0a0f' extension/src/styles/widget.css extension/dist/widget.css extension/src/content/widget.ts` retourne au minimum 6+6+5.

---

## Sous-tâches restantes par PR

### PR #124 — Spec #1 backend foundation (2/8 done)

Fait :

- ✅ `db1fb78a` — Migration Alembic 007 (chat_messages source/voice_session_id)
- ✅ `5c0cb708` — agent_type companion

Manquant (référencer `docs/superpowers/specs/2026-04-25-elevenlabs-ecosystem-architecture-design.md` lignes 116-285) :

- ❌ **c.** `POST /api/voice/session` — `summary_id: Optional[int]` + `agent_type: Literal[explorer, debate_moderator, companion]` (spec L163-180). Working tree contient `backend/src/voice/schemas.py` modifié non commité — examiner.
- ❌ **d.** Inject chat history dans system prompt (spec L182-194)
- ❌ **e.** `POST /api/voice/transcripts/append` (spec L196-225)
- ❌ **f.** Webhook reconciliation post-call (spec L227-241)
- ❌ **g.** `GET /api/chat/{summary_id}/history` schema étendu avec `source`, `voice_session_id`, `voice_speaker`, `time_in_call_secs` (spec L243-261)
- ❌ **h.** Quota chat ignore `source='voice'` (spec L263-265)
- ❌ Tests pytest pour endpoints + sécurité (auth, IDOR, rate-limits) — spec L267-285

### PR #125 — Spec #2 web foundation (1/5 done)

Fait :

- ✅ `4a563eaa` — VoiceCallProvider + VoiceCallButton + useVoiceEnabled + VoiceModal compact mode

Manquant :

- ❌ **e.** Migration des 3 pages existantes (History, Analyse, ChatPage) pour utiliser `<VoiceCallButton ... />`. Working tree a `frontend/src/pages/DashboardPage.tsx` modifié non commité.
- ❌ Tests vitest sur Provider, Button, hook (spec L342-349)

### PR #127 — Spec #3 mobile (recovery — non validé)

Fait par recovery commit `b152a40f` :

- 🚧 `VoiceButton.tsx` — bottomOffset prop (sub-task a)
- 🚧 `useVoiceChat.ts` — bidir sync onMessage/sendUserMessage (sub-task d)
- 🚧 `api.ts` — summary_id optional + agent_type (sub-task e)
- 🚧 Nouveaux tests `VoiceButton.placement.test.tsx` + `voiceApi.test.ts`

Manquant :

- ❌ **b.** Câblage `mobile/app/(tabs)/library.tsx` — FAB voice avec `agent_type='companion'` (spec L365-372)
- ❌ **c.** Câblage `mobile/app/(tabs)/study.tsx` sous-onglet `chat` (spec L374-384)
- ❌ Validation : `cd mobile && npm run typecheck && npm test -- voice`
- ❌ EAS preview build optionnel pour test sur device

### PR #128 — Spec #4 Chrome side panel (recovery — non validé)

Fait par recovery commit (single) :

- 🚧 manifest.json — side_panel + sidePanel permission
- 🚧 background.ts — `chrome.action.onClicked` → `sidePanel.open()`
- 🚧 `src/sidepanel/` (NEW) — App.tsx, VoiceView.tsx, index.tsx, types.ts, useExtensionVoiceChat.ts (ElevenLabs SDK adapter MV3)
- 🚧 `src/styles/sidepanel.css` (NEW)
- 🚧 `public/sidepanel.html` (NEW)
- 🚧 webpack.config.js — sidepanel entry
- 🚧 widget.ts + content/index.ts — voice button hook
- 🚧 5 tests Jest dans `__tests__/sidepanel/`
- ✅ widget nuclear fix `#0a0a0f` restauré depuis main (verified 6+6+5 occurrences)

Manquant :

- ❌ Run `npm test` sur le test suite sidepanel
- ❌ Run `npm run build` pour générer dist/sidepanel.html + dist/sidepanel.js
- ❌ Verify post-build widget integrity (`grep -c '#0a0a0f' dist/content.js >= 7`)
- ❌ Test manuel : reload extension, click action → side panel ouvre, voice button clickable

### PR #126 — Spec #5 Chat IA overlay (4 commits propres, le plus avancé)

Fait :

- ✅ `e125d5ff` — expose sendUserMessage + session info from useVoiceChat
- ✅ `b00287da` — VoiceOverlay floating panel
- ✅ `9427404b` — integrate VoiceOverlay + bidir sync in ChatPage (a/c/d/e/f)
- ✅ `7d68c06d` — ChatPage voice/text sync routing tests

Manquant :

- ❌ Run `cd frontend && npm run typecheck && npm test -- voice ChatPage`
- ❌ Vérifier UX : overlay 380×600 fixe bottom-right, focus trap, animation
- ❌ Smoke test : `npm run dev` + click bouton header → overlay ouvre + sync texte→voix→texte
- ⚠️ **Dépend de PR #124 (B1) endpoint `/api/voice/transcripts/append`** : actuellement utilise mock fetch. Remplacer par fetch réel après merge #124.

---

## Décisions ouvertes — défauts appliqués par les agents

| #   | Décision                          | Défaut                                                       |
| --- | --------------------------------- | ------------------------------------------------------------ |
| 1   | Voice ID companion                | Rachel (statu quo) + env var `ELEVENLABS_COMPANION_VOICE_ID` |
| 2   | Persistance transcripts companion | NULL `summary_id` autorisé sur `chat_messages` (option A)    |
| 3   | Mobile Library FAB                | FAB voice sans summary_id en mode companion                  |
| 4   | Overlay Chat IA web               | Fixé bottom-right (pas draggable)                            |

L'utilisateur peut override en review.

---

## Comment reprendre

### Ordre de merge recommandé

1. **#122 (B0)** ✅ déjà fait
2. **#124 (B1)** — finir les 6 sous-tâches manquantes, puis merger (squash, rebase sur main)
3. **#125 (B2)** — finir migration 3 pages + tests, merger après #124
4. **#127 (B3)** — câbler library + study + valider tests, merger en parallèle de #125 (indépendants)
5. **#128 (B4)** — npm test + npm build + verify widget, merger en parallèle (indépendant)
6. **#126 (B5)** — remplacer mock par fetch réel `/api/voice/transcripts/append`, valider tests, merger en dernier (dépend #124 + #125)

### Reprise par session locale (quota personnel)

Pour chaque PR à reprendre :

```powershell
cd C:\Users\33667\DeepSight-Main
git fetch origin
git worktree add ../DeepSight-resume-spec-N -b feat/elevenlabs-spec-N-resume origin/feat/elevenlabs-spec-N
cd ../DeepSight-resume-spec-N
git rebase origin/main  # IMPORTANT — apporte le fix widget si pas déjà fait
# Puis travailler les sous-tâches manquantes
```

### Reprise par agent Claude Code (quand quota org reset)

Référer à ce fichier + spec original pour relancer un agent. Les prompts originaux des agents B1-B5 sont préservés dans la conversation Claude Code historique.

---

## Worktrees — état post-cleanup

Les worktrees `DeepSight-spec0..5`, `DeepSight-audit`, `DeepSight-ext-rob`, `DeepSight-pkce-rebase` ont été supprimés (`git worktree remove`). Tout le travail est sur origin via les PRs.

Worktrees actifs restants :

- `C:/Users/33667/DeepSight-Main` — branche utilisateur (`fix/mobile-voice-elevenlabs`)
- `C:/Users/33667/DeepSight-fix-widget` — bridge maintenance (main)
