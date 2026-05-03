# Le Tuteur — V1.1 Voice TTS — Design

**Date** : 2026-05-03
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft
**Source** : Suite directe de V1.0 (PR #284 mergée). Continue le brainstorm 2026-05-03.

## Contexte

V1.0 du Tuteur (mergée sur main commit `2d2f4d9e`) livre :

- Un compagnon conversationnel sobre (Magistral) avec state machine 4 phases (`idle / prompting / mini-chat / deep-session`)
- Mode texte 100% fonctionnel (Pro/Expert plan gating)
- Mode voix : **layout fullscreen + orb pulsante visuelle** mais SANS audio réel — l'utilisateur tape encore en texte dans la modal deep-session

V1.1 ferme la moitié manquante du mode voix : **TTS de la réponse IA via ElevenLabs**. L'utilisateur tape encore en texte (capture mic STT = V1.2 ou plus tard), mais il **entend** le tuteur parler.

## Objectifs V1.1

1. Faire entendre la voix du Tuteur — différenciateur immédiat vs un chatbot texte classique
2. Réutiliser intégralement l'infra ElevenLabs déjà en prod (pattern `tts/audio_summary.py`, `voice/elevenlabs.py`, circuit breaker `elevenlabs_circuit`)
3. Scope minimal : 1 helper backend + 2 endpoints modifiés + 1 composant frontend modifié
4. Pas de capture mic (V1.2 reste reportée)

## Décisions verrouillées

| #   | Décision                  | Choix retenu                                                                                          |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Provider TTS              | **ElevenLabs** (pattern `_elevenlabs_generate_bytes` de `tts/audio_summary.py`)                       |
| 2   | Format de retour          | **Data URL inline** : `data:audio/mpeg;base64,...` dans le champ `audio_url` existant                  |
| 3   | Storage                   | Aucun — le bytes audio passe en JSON response (1 turn = ~30-200 KB MP3, OK pour V1.1)                  |
| 4   | Voice ID                  | Voix FR par défaut (réutiliser le helper `get_voice_id(language, gender)` ou voice_id config Tuteur)  |
| 5   | Quand générer le TTS      | Uniquement si `state.mode == "voice"`. Mode texte = `audio_url=None` comme aujourd'hui                |
| 6   | Frontend playback         | HTML5 `<audio>` avec `autoplay` dans `TutorDeepSession.tsx`. Pas de queue, pas de barge-in (V1.2)    |
| 7   | Capture mic user (STT)    | **Hors scope V1.1** — l'utilisateur tape encore en texte. V1.2 ajoutera Voxtral STT + MediaRecorder  |
| 8   | Circuit breaker           | Réutilise `elevenlabs_circuit` existant. Si open, retourner `audio_url=None` + log warning (graceful) |
| 9   | Sub-agents                | Opus 4.7 obligatoire (`claude-opus-4-7[1m]`)                                                          |

## Architecture

```
SESSION_START / SESSION_TURN (mode=voice)
        │
        ▼
[Magistral génère ai_response] ──▶ [synthesize_audio_data_url(text, lang)]
                                          │
                                          ▼
                                  [ElevenLabs API]
                                          │
                                          ▼
                                  bytes MP3 → base64 → "data:audio/mpeg;base64,..."
                                          │
                                          ▼
                                  return {ai_response, audio_url, turn_count}
                                          │
                                          ▼
                                  [Frontend TutorDeepSession]
                                          │
                                          ▼
                                  <audio src={audio_url} autoPlay />
```

## Composants modifiés

### Backend

| Fichier                         | Modif                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `backend/src/tutor/service.py`  | Ajouter `synthesize_audio_data_url(text, lang) -> Optional[str]`                   |
| `backend/src/tutor/router.py`   | Dans `session_start` + `session_turn` : si `mode=="voice"`, appeler le helper     |
| `backend/tests/test_tutor_service.py` | 1 nouveau test `test_synthesize_audio_data_url` (mock httpx)                |
| `backend/tests/test_tutor_router.py`  | 1 nouveau test `test_session_start_voice_mode_returns_audio_url` (mock TTS) |

### Frontend

| Fichier                                           | Modif                                                                              |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `frontend/src/components/Tutor/useTutor.ts`       | Stocker `currentAudioUrl` dans le state (dispatched par SESSION_STARTED + TURN_DONE) |
| `frontend/src/components/Tutor/TutorDeepSession.tsx` | `<audio src={audioUrl} autoPlay key={audioUrl}>` quand `mode === "voice"`     |
| `frontend/src/components/Tutor/Tutor.tsx`         | Passer `audioUrl` en prop à `TutorDeepSession`                                     |
| `frontend/src/components/Tutor/__tests__/useTutor.test.ts` | Adapter mocks tutorApi pour retourner `audio_url` non-null                |

## Tests

- **Backend** : 12 tests Tuteur attendus (10 V1.0 + 2 V1.1)
- **Frontend** : 9 tests Tuteur (inchangés, juste mocks audio_url)
- **Manuel** : QA sur 1 concept en mode voix → vérifier que l'audio joue + son/voix corrects

## Risks & open questions

| Risque                                                                  | Mitigation                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Latence ElevenLabs (~2-5s pour 100 mots)                                | UX : afficher l'orb en mode "thinking" pendant la génération              |
| Quota ElevenLabs ou circuit breaker open                                | Graceful : `audio_url=None`, fallback texte affiché normal                 |
| Auto-play bloqué par le navigateur si pas d'interaction user            | Le user a cliqué pour ouvrir la session = interaction, autoplay autorisé  |
| Taille payload (200 KB par turn × N turns)                              | Acceptable V1.1. V1.2 → URL signed S3/R2 si abus observé                  |
| Voix FR-natif vs voix EN avec accent FR (warning vu dans voice/router)  | Choisir une voix FR-native (ex: `21m00Tcm4TlvDq8ikWAM` avec lang=fr)      |

## V1.2+ roadmap

- **Capture mic STT** (Voxtral ou OpenAI Whisper) — vraie session vocale bout-en-bout
- **Streaming TTS** (chunks audio progressifs) au lieu de bytes complets
- **Audio storage S3/R2** au lieu de data URL inline
- **Barge-in** (l'utilisateur peut interrompre en parlant)
- **Voice picker** dans Settings (laisser l'user choisir la voix du Tuteur)

## Références

- Spec V1.0 : `docs/superpowers/specs/2026-05-03-le-tuteur-companion-design.md`
- Plan V1.0 : `docs/superpowers/plans/2026-05-03-le-tuteur-companion.md`
- Pattern TTS existant : `backend/src/tts/audio_summary.py` (`_elevenlabs_generate_bytes`)
- Helper config : `backend/src/core/config.py` (`get_elevenlabs_key()`)
- Circuit breaker : `backend/src/tts/service.py` (`elevenlabs_circuit`)
