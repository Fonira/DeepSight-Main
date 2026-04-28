# Quick Voice Call V1.1 — Fixes après audit (2026-04-28)

**Date** : 2026-04-28
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Implémenté — en cours de validation manuelle
**Spec parente** : [`2026-04-26-quick-voice-call-design.md`](./2026-04-26-quick-voice-call-design.md)

## Contexte

La V1 de Quick Voice Call est mergée et déployée (PRs #122/#124/#126/#130/#133/#134 + migration 007 sur Hetzner, cf. mémoire `project_deepsight-elevenlabs-hub-sprint`). Lors de la première session live de validation manuelle, trois problèmes UX bloquants ont été observés malgré le fait que le pipeline backend fonctionnait techniquement.

V1.1 = sprint de patch ciblé pour les corriger sans toucher à l'architecture asynchrone progressive.

## Diagnostic — 3 root causes

### 1. Orchestrator no-op en production

**Symptôme** : pendant l'appel, la barre de progression restait figée à 0 % — aucun `transcript_chunk` ni `analysis_partial` ne remontait via SSE jusqu'au side panel.

**Root cause** : `voice/router.py::create_voice_session` instanciait l'orchestrator via `create_default_orchestrator(redis=redis)`. Or cette factory est délibérément câblée sur des fetchers no-op (`_default_fetch_transcript`, `_default_run_analysis`) — c'est une fixture de dev local, pas un wiring prod. La fonction `create_production_orchestrator` (qui plug `extract_transcript_for_analysis` + cache `Summary`) existait mais n'était appelée nulle part.

**Conséquence côté agent** : l'agent ElevenLabs ne recevait jamais de `[CTX UPDATE: …]`. Il fallback sur `web_search` (per spec § risk table) mais perdait l'intérêt de l'asynchrone progressif.

### 2. Transcripts vocaux non affichés dans le side panel

**Symptôme** : pendant l'appel, l'utilisateur entendait l'agent et le voyait répondre, mais la zone de chat dans le side panel restait vide. Aucune trace écrite de la conversation. Régression UX vs Quick Chat texte.

**Root cause** : `useExtensionVoiceChat` collectait bien les transcripts via le callback `onMessage` du SDK ElevenLabs et les stockait dans `transcripts[]`, mais `VoiceView.tsx` n'avait jamais rendu de composant pour les afficher. La V1 originale s'était concentrée sur le pipeline ctx + le timer, sans UI dédiée à l'historique chat de l'appel.

### 3. Prompt streaming sans video meta

**Symptôme** : l'agent ouvrait l'appel par "Bonjour, je suis ton assistant" sans nommer la vidéo, et certaines réponses étaient génériques (parlait de la vidéo "abstraitement" sans utiliser le titre/chaîne) tant que le ctx n'était pas complet.

**Root cause** : `streaming_prompts.EXPLORER_STREAMING` ne recevait pas les métadonnées vidéo (titre + chaîne + durée) au moment de la création de session. Tant que les `[CTX UPDATE]` n'étaient pas arrivés, l'agent n'avait littéralement aucune info sur ce qu'il était censé écouter.

## Solutions implémentées

Trois agents Opus 4.7 (1M context) ont travaillé en parallèle sur des dossiers disjoints pour éviter les conflits :

### Agent A — Backend (orchestrator + prompt)

- Bascule `voice/router.py::create_voice_session` sur `create_production_orchestrator` pour les sessions `is_streaming=True`. Le no-op factory reste disponible pour tests/dev local mais n'est plus la valeur par défaut en prod.
- Injecte `video_title`, `channel_name`, `duration_str` dans le system prompt streaming via une extension de la signature `EXPLORER_STREAMING.format(...)` (récupération depuis `youtube-dl` / `extract_transcript_for_analysis` metadata, ou fallback `pendingVoiceCall.videoTitle`).

### Agent B — Extension UI (transcripts list)

- Ajoute le composant `VoiceTranscriptList` (`extension/src/sidepanel/components/VoiceTranscriptList.tsx`) — bulles user/agent chat-style, scrollables, role="log" + aria-live="polite".
- Branche le composant dans `VoiceView.tsx` sous `CallActiveView` et `ContextProgressBar`, alimenté par `voiceChat.transcripts`.

### Agent C — Tests E2E + doc (ce sprint)

- `extension/e2e/quick-voice-call-flow.spec.ts` — 4 spécifications Playwright (transcripts, gear button drawer, progress bar SSE, hangup → upgrade CTA). Marqués `test.skip()` documenté tant que le bundle prod n'expose pas `window.__deepsightTestHooks__` pour bypasser le SDK ElevenLabs.
- `backend/tests/voice/test_quick_voice_call_e2e.py` — 1 test pytest qui wire `create_production_orchestrator` end-to-end avec un FakeRedis et patch `extract_transcript_for_analysis` + cache `Summary`. Vérifie que le pipeline publie ≥ 1 `transcript_chunk`, ≥ 1 `analysis_partial`, exactement 1 `ctx_complete` sur `voice:ctx:{session_id}`.
- Ce document spec.

## Checklist de validation manuelle

Après reload de l'extension dans `chrome://extensions` (mode développeur → "Actualiser" sur DeepSight) :

- [ ] Ouvrir une vidéo YouTube de test (ex : `kBX4WgajxW8` si dispo dans l'historique, sinon n'importe quelle vidéo Free user qui a un transcript Supadata)
- [ ] Cliquer sur le bouton 🎙️ injecté par le content script DeepSight → le side panel s'ouvre sur `ConnectingView`
- [ ] L'agent ElevenLabs commence à parler dans les ~2 s (premier message agent doit citer le titre de la vidéo)
- [ ] Pendant l'appel :
    - [ ] La zone chat (`role="log"`) affiche les bulles user (👤, à droite) et agent (🤖, à gauche) au fur et à mesure
    - [ ] La barre de progression `role="progressbar"` bouge à > 0 % dans les 5 premières secondes (= au moins un `transcript_chunk` reçu)
    - [ ] Le bouton ⚙ en haut à droite ouvre le drawer `VoiceSettingsDrawer` quand on clique dessus, et le ferme quand on clique sur la croix
    - [ ] Le bouton Mute mute effectivement le micro (pas juste l'UI — vérifier qu'on n'entend plus côté agent)
- [ ] Cliquer Raccrocher avant les 3 minutes :
    - [ ] L'`UpgradeCTA` apparaît avec `reason="trial_used"` (texte "essai gratuit", CTA Expert 14.99 €/mois)
    - [ ] La page `/upgrade?plan=expert&source=voice_call` s'ouvre dans un nouvel onglet quand on clique le CTA
- [ ] Relancer un appel sur la même vidéo :
    - [ ] Le backend renvoie `402` avec `reason: "trial_used"` → l'`UpgradeCTA` s'affiche directement (pas de `ConnectingView`)

## Tests automatisés

```bash
# Backend — pipeline E2E avec mocks
cd backend && pytest tests/voice/test_quick_voice_call_e2e.py -v

# Extension — Playwright (les 4 nouveaux tests sont skip jusqu'au test hook bundle)
cd extension && npm run e2e -- quick-voice-call-flow.spec.ts
```

## Notes de déploiement

- Backend : push to `main` après merge des PRs des 3 agents → container `repo-backend-1` recréé en ~30 s sur Hetzner (cf. `reference_deepsight-hetzner-auto-deploy`)
- Extension : `npm run build` → ZIP `dist/` → soumettre la nouvelle version au Chrome Web Store. La V1 originale n'étant pas encore soumise, V1.1 deviendra la première version publique.
- Pas de migration DB nécessaire — V1.1 ne touche pas au schéma.

## Références

- Spec parente : [`2026-04-26-quick-voice-call-design.md`](./2026-04-26-quick-voice-call-design.md)
- Mémoire sprint ElevenLabs : `project_deepsight-elevenlabs-hub-sprint`
- Issue racine orchestrator : `voice/streaming_orchestrator.py::create_default_orchestrator` vs `create_production_orchestrator`
- Issue racine transcripts UI : `VoiceView.tsx` rendait `CallActiveView` + `ContextProgressBar` mais pas la zone chat
