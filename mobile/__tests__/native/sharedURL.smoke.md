# E2E Smoke Test — Quick Voice Call mobile V3 Share Extensions

**Build profile** : `eas build --profile production`
**Branch** : `feat/qvc-mobile-pr3-native` (puis main après merge)
**Backend prod** : Hetzner — vérifier `https://api.deepsightsynthesis.com/api/voice/context/stream?session_id=ping` → 401 (OK, route active).

## iOS — Share depuis YouTube app

1. [ ] Installer le build prod iOS (TestFlight ou via lien EAS Internal)
2. [ ] Ouvrir l'app YouTube iOS
3. [ ] Choisir une vidéo publique (ex : `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
4. [ ] Tap "Partager" (icône)
5. [ ] **Vérifier** : "DeepSight" apparaît dans la grille des activités
6. [ ] Tap "DeepSight"
7. [ ] L'app DeepSight s'ouvre
8. [ ] **Vérifier** : VoiceScreen modal apparaît AUTOMATIQUEMENT (autostart=true via useDeepLinkURL → handleDeepLink)
9. [ ] **Vérifier** : indicateur "Connecting…" puis "Listening"
10. [ ] **Vérifier** : agent dit "j'écoute la vidéo en même temps que toi" ou similaire (prompt explorer_streaming)
11. [ ] Parler "Donne-moi un résumé"
12. [ ] **Vérifier** : agent répond avec "d'après ce que j'écoute pour l'instant…"
13. [ ] Attendre 30-60s → progress bar atteint 100% + "Contexte vidéo complet"
14. [ ] Re-poser une question
15. [ ] **Vérifier** : agent répond avec "maintenant que j'ai tout le contexte…"
16. [ ] Tap hangup
17. [ ] **Vérifier** : PostCallScreen apparaît avec transcript + 2 CTAs

## iOS — Share depuis TikTok app

Reproduire steps 1-17 avec TikTok app. **Vérifier** que l'extraction transcript TikTok fonctionne (le `transcripts/tiktok.py` existant a ses propres fallbacks).

## iOS — Share depuis Safari (URL collée)

1. [ ] Safari → barre URL → coller `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → Go
2. [ ] Tap "Partager" (icône safari)
3. [ ] Vérifier "DeepSight" dans la grille + tap
4. [ ] Reproduire steps 7-17

## Android — Share depuis YouTube app

Reproduire la procédure iOS sur device Android. L'expérience peut différer :
- "DeepSight" apparaît dans la liste de partage Android
- Tap → l'app s'ouvre avec autostart
- Reste du flow identique

## Android — Share depuis TikTok app

Idem.

## Test négatif — URL non supportée

1. [ ] Safari → coller `https://vimeo.com/123` → Go
2. [ ] Partager → DeepSight
3. [ ] **Vérifier** : l'app s'ouvre mais l'appel NE démarre PAS (URL filtered out par `validateVideoURL` côté `useDeepLinkURL`)

## Test deep link manuel

1. [ ] Notes app → coller `deepsight://voice-call?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ&autostart=true` → tap
2. [ ] **Vérifier** : DeepSight s'ouvre + autostart Voice Call

## Test clipboard auto-detect (PR2 fonctionnalité, vérifier non-régression)

1. [ ] Copier `https://youtu.be/dQw4w9WgXcQ` dans n'importe quelle app (Notes, Messages, etc.)
2. [ ] Ouvrir DeepSight depuis launcher (ou switcher vers DeepSight si déjà ouvert)
3. [ ] **Vérifier** : bandeau gold "📋 LIEN DÉTECTÉ" apparaît dans le bloc Voice Call
4. [ ] Tap le bandeau
5. [ ] **Vérifier** : appel démarre automatiquement

## Verdict

- [ ] iOS YouTube : PASS / FAIL
- [ ] iOS TikTok : PASS / FAIL
- [ ] iOS Safari : PASS / FAIL
- [ ] Android YouTube : PASS / FAIL
- [ ] Android TikTok : PASS / FAIL
- [ ] URL non supportée filtered : PASS / FAIL
- [ ] Deep link manuel : PASS / FAIL
- [ ] Clipboard auto-detect : PASS / FAIL

Tester par : __________ Date : __________
