# Voice Feature — Deployment Status

**Date**: 2026-03-24
**Auteur**: CI/Validation automatique

---

## Commits Voice sur `main`

| Commit     | Message                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| `fb3b1be6` | fix(voice): read seconds_remaining instead of missing minutes_remaining key |
| `7b839bfb` | fix(voice): use naive datetime for DB columns without timezone              |
| `4d5ca01a` | fix(voice): add expert and unlimited plans to VOICE_LIMITS                  |
| `6b2b2172` | test(voice): add 55 backend + 40 frontend/mobile tests, wire analytics      |
| `96efed04` | feat(voice): Parler à sa vidéo — ElevenLabs Conversational AI (#81)         |

Tous les commits sont **pushés sur `origin/main`**.

---

## Build Frontend

- **Status**: OK (build Vite en 54s)
- **Erreurs voice TypeScript**: 0 (corrigées dans cette session)
  - `VoiceQuotaBadge.test.tsx`: supprimé import React inutilisé
  - `VoiceWaveform.test.tsx`: supprimé variables inutilisées, fixé types MockInstance et HTMLElement
- **Erreurs pré-existantes (hors scope voice)**: ~80+ erreurs TS6133/TS2339 dans d'autres fichiers — non corrigées (hors scope)
- **Chunks produits**:
  - `TTSToggle-CyYZrKx_.js` — chunk dédié TTS (code-split)
  - `lib.modern-BPC_G117.js` — contient VoiceButton, VoiceModal, useVoiceChat, voiceAnalytics

---

## Deploy Vercel (Production)

- **Dernier deploy en prod**: commit `5024f79` ("migrate all API URLs from Railway to Hetzner")
- **Commits voice deployés**: NON
- **Cause probable**: Webhook GitHub → Vercel désynchronisé. Les 6 derniers commits sur `main` n'ont pas déclenché d'auto-deploy.
- **Action requise**: Redeploy manuel depuis le dashboard Vercel ou via `vercel --prod` depuis un terminal avec accès réseau.

---

## Deploy Backend (Hetzner VPS)

- **Status**: Non vérifié dans cette session (hors scope — consigne "ne pas toucher au backend")
- **Endpoints voice attendus**:
  - `POST /api/voice/session` — Créer une session ElevenLabs
  - `GET /api/voice/quota` — Vérifier le quota voice
  - `POST /api/voice/end-session` — Terminer une session

---

## Tests

| Suite                            | Résultat                             |
| -------------------------------- | ------------------------------------ |
| Frontend typecheck (voice files) | 0 erreurs                            |
| Frontend build (Vite)            | OK                                   |
| Backend tests (voice)            | 55 tests ajoutés (commit `6b2b2172`) |
| Frontend tests (voice)           | 40 tests ajoutés (commit `6b2b2172`) |

---

## Composants Voice dans le bundle

| Fichier source        | Inclus dans build |
| --------------------- | ----------------- |
| `VoiceButton.tsx`     | OK                |
| `VoiceModal.tsx`      | OK                |
| `VoiceWaveform.tsx`   | OK                |
| `VoiceQuotaBadge.tsx` | OK                |
| `VoiceTranscript.tsx` | OK                |
| `VoiceAddonModal.tsx` | OK                |
| `useVoiceChat.ts`     | OK                |
| `voiceAnalytics.ts`   | OK                |

---

## Problemes restants

1. **Vercel auto-deploy cassé** — Les commits voice ne sont pas en production malgré le push sur `main`. Vérifier l'intégration GitHub dans les settings Vercel.
2. **~80 erreurs TypeScript pré-existantes** — Dans des fichiers hors voice (ChatPopup, DashboardPage, History, LandingPage, etc.). Ne bloquent pas le build Vite mais bloquent `tsc --noEmit`.
3. **Backend non vérifié** — Les endpoints voice sur le VPS Hetzner n'ont pas été testés dans cette session.

---

## Prochaines actions

- [ ] Déclencher un redeploy Vercel (dashboard ou CLI)
- [ ] Vérifier les endpoints backend voice en prod (`curl https://api.deepsightsynthesis.com/api/voice/quota`)
- [ ] Tester le flow complet voice sur le site en prod après deploy
- [ ] Corriger les erreurs TypeScript pré-existantes (optionnel, hors voice)
