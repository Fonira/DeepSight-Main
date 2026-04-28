# DeepSight — Feature Parity Matrix (Web / Mobile / Extension)

**Date d'audit :** 2026-04-25
**Worktree :** `C:\Users\33667\DeepSight-audit`
**Branche :** `docs/feature-parity-2026-04-25` (basée sur `origin/main`)
**Commit HEAD audité :** `4d2949b2` — _fix(extension): widget YouTube — drop backdrop-filter, hardcode #0a0a0f (nuclear) (#116)_

---

## Méthode

Audit **read-only** sur le code applicatif. Aucune modification frontend/, mobile/, extension/, backend/. Sortie unique : ce markdown + une PR sur `origin`.

### Plateformes scannées

| Plateforme    | Racine                                                                            | Stack                                       |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------- |
| **Web**       | `frontend/src/components/`, `frontend/src/pages/`, `frontend/src/hooks/`          | React 18 + Vite + Tailwind + Zustand        |
| **Mobile**    | `mobile/src/components/`, `mobile/app/`, `mobile/src/hooks/`, `mobile/src/contexts/` | Expo SDK 54 + RN 0.81 + React 19 + Reanimated 4 |
| **Extension** | `extension/src/popup/`, `extension/src/viewer/`, `extension/src/content/`, `extension/src/background.ts` | Manifest V3 + React + Webpack 5             |

### Procédé

1. Inventaire fichier par fichier des dossiers `components/`, `pages/`, `app/(tabs)/`, `app/(auth)/`, `popup/`, `viewer/`, `content/`, `hooks/`, `contexts/`, `services/`, `stores/`, `i18n/`.
2. Recherche par mots-clés (Grep ripgrep) pour valider la présence ou l'absence de chaque feature dans le code source (et non uniquement dans le `package.json` ou la doc).
3. Croisement avec `frontend/src/services/api.ts`, `mobile/src/services/api.ts`, `extension/src/background.ts` pour confirmer que la feature est branchée à un endpoint backend (et pas seulement un composant orphelin).
4. Croisement avec `frontend/src/config/planPrivileges.ts` et `mobile/src/config/planPrivileges.ts` pour identifier le gating (Free/Pro/Expert).

### Légende

| Symbole  | Signification                                                                       |
| -------- | ----------------------------------------------------------------------------------- |
| `OK`     | Feature présente, branchée à l'API, avec UI complète                                |
| `PART`   | Implémentation partielle (UI sans backend, ou backend sans UI, ou un sous-cas seulement) |
| `NO`     | Feature absente du code source de la plateforme                                     |
| `N/A`    | Feature volontairement non pertinente sur la plateforme (décision archi)            |

> Le `CLAUDE.md` racine du repo contient un tableau "Features par plateforme" plus court — celui-ci est plus exhaustif (33 features) et corrige plusieurs entrées (notamment Export PDF mobile, ElevenLabs mobile, Tournesol).

---

## Tableau de parité

| #   | Feature                                  | Web    | Mobile | Extension | Notes / fichier de référence                                                                                                                                | Effort parité |
| --- | ---------------------------------------- | ------ | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Analyse vidéo (core)                     | OK     | OK     | OK        | `frontend/pages/DashboardPage.tsx`, `mobile/app/(tabs)/index.tsx`, `extension/src/popup/components/MainView.tsx`                                              | —             |
| 2   | Streaming SSE de l'analyse               | OK     | OK     | PART      | `useAnalysisStream.ts` (web/mobile). Extension polle via `chrome.runtime.sendMessage` — pas de SSE direct (limites MV3 service worker)                       | 1j (extension) |
| 3   | Quick Chat (0 crédits)                   | OK     | OK     | OK        | Branché sur `/api/videos/quick-chat`. Mobile : `mobile/app/(tabs)/study.tsx` (sous-onglet chat).                                                              | —             |
| 4   | Chat contextuel par vidéo                | OK     | OK     | OK        | `ChatPanel.tsx` (web), `chat/FloatingChat.tsx` (mobile), `popup/components/ChatDrawer.tsx` (ext)                                                              | —             |
| 5   | Copy button sur message bubbles          | OK     | NO     | NO        | `frontend/src/components/CopyMessageButton.tsx`. Aucun équivalent dans `mobile/src/components/chat/ChatBubble.tsx` ni `extension/src/popup/components/ChatDrawer.tsx` | < 0.5j × 2    |
| 6   | Voice chat (ElevenLabs WebSocket)        | OK     | OK     | NO        | Web : `components/voice/useVoiceChat.ts` + `VoiceModal.tsx`. Mobile : `mobile/src/components/voice/useVoiceChat.ts` (utilise `@elevenlabs/react-native`). Ext : 0. | 5-8j (extension, voir gros chantiers) |
| 7   | Voice PTT (push-to-talk)                 | OK     | NO     | NO        | `frontend/src/components/voice/VoicePTTButton.tsx` (144 LOC). Mobile a hold-to-talk via `VoiceScreen` mais pas de bouton PTT dédié. Ext : 0.                  | 1j (mobile)    |
| 8   | Live mic halo / waveform                 | OK     | OK     | NO        | Web : `voice/VoiceWaveform.tsx`. Mobile : `voice/VoiceWaveform.tsx`. Ext absente (pas de voice chat).                                                          | Inclus dans #6  |
| 9   | Voice quota badge / pref bus             | OK     | OK     | NO        | `voice/VoiceQuotaBadge.tsx`, `voicePrefsBus.ts` (web only)                                                                                                    | 0.5j (mobile)   |
| 10  | TTS read-aloud (synthèse vocale)         | OK     | OK     | OK        | Web : `hooks/useTTS.ts` + `TTSToolbar.tsx`. Mobile : `hooks/useTTS.ts` + `TTSContext`. Ext : `content/tts.ts` + endpoint `/api/tts`.                          | —             |
| 11  | Fact-check display                       | OK     | OK     | OK        | `FactCheckLite.tsx` (web), `factcheck/FactCheckDisplay.tsx` (mobile), `viewer/components/FactCheckSection.tsx` (ext)                                          | —             |
| 12  | Sources / citations / academic           | OK     | OK     | NO        | Web : `academic/AcademicSourcesPanel.tsx` + `BibliographyModal.tsx`. Mobile : `academic/AcademicSourcesSection.tsx` + `BibliographyExport.tsx`. Ext : 0.        | 2j (ext)       |
| 13  | Citation export (BibTeX, APA…)           | OK     | PART   | NO        | Web : `CitationExport.tsx`. Mobile : seulement `BibliographyExport.tsx` (académique), pas d'export citation générique pour la vidéo.                          | 1j (mobile)    |
| 14  | Concepts glossary                        | OK     | OK     | NO        | `ConceptsGlossary.tsx` (mêmes noms web + mobile)                                                                                                              | 1j (ext)       |
| 15  | Mind maps / concept maps                 | OK     | PART   | NO        | Web : `MindMap/index.tsx` + `ConceptMap.tsx` (xyflow + Cytoscape). Mobile : `study/MindMapComponent.tsx` (rendu réduit). Ext : 0 (CTA via FeatureCTAGrid).     | 3-5j (mobile complet) |
| 16  | Flashcards SRS (study mode)              | OK     | OK     | N/A       | Web : `Study/FlashcardDeck.tsx` + `StudyHubPage.tsx`. Mobile : `study/FlashcardDeck.tsx`. Ext : volontairement CTA.                                            | —             |
| 17  | Quiz / multi-answer quiz                 | OK     | OK     | N/A       | Web : `Study/QuizQuestion.tsx`. Mobile : `study/QuizGame.tsx` + `MultiAnswerQuiz.tsx` + `QuizComponent.tsx`. Ext : CTA.                                        | —             |
| 18  | Spaced repetition / streaks / XP         | OK     | OK     | N/A       | Web : `Study/StreakCounter.tsx`, `XPBar.tsx`, `MasteryRing.tsx`, `BadgeGrid.tsx`. Mobile : `study/FlashcardProgress.tsx` + `MicroConfetti.tsx`.                | —             |
| 19  | Playlists (analyse multi-vidéos)         | OK     | PART   | N/A       | Web : `pages/PlaylistPage.tsx` (1084 LOC) + création/analyse. Mobile : `library/PlaylistSection.tsx` (lecture seule, redirection web pour création). Ext : CTA. | 2j (mobile) ou décision N/A |
| 20  | Debate mode (2 vidéos confrontées)       | OK     | NO     | NO        | Web complet : `pages/DebatePage.tsx` + 9 composants `components/debate/*`. Aucune trace mobile/ext (sauf CTA dans `mobile/CLAUDE.md`).                          | 5-8j (mobile, décision archi probable) |
| 21  | Web search enrichissement (Perplexity)   | OK     | NO     | NO        | Backend `chat/router.py`. Web `useWebSocketChat.ts` + opt-in. Mobile/Ext : non exposé (CTA upgrade).                                                          | 1-2j (mobile, gating Pro+) |
| 22  | Tournesol intégration                    | OK     | OK     | NO        | Web : `TournesolWidget.tsx` + `TournesolTrendingSection.tsx`. Mobile : `tournesol/TournesolWidget.tsx` + `TournesolRecommendations.tsx`. Ext : 0.              | 2j (ext)       |
| 23  | HD thumbnails                            | OK     | OK     | OK        | `ThumbnailImage.tsx` (web + mobile). Ext via DOM scrape YouTube directement.                                                                                  | —             |
| 24  | Subscription / premium gating            | OK     | OK     | OK (CTA)  | Web : `PremiumFeatureGate.tsx` + `UpgradeModal.tsx`. Mobile : `upgrade/UpgradePromptModal.tsx`. Ext : `FeatureCTAGrid.tsx` redirige vers web (par design).      | —             |
| 25  | Stripe checkout / billing portal         | OK     | PART   | N/A       | Web complet (`pages/UpgradePage.tsx` + portal). Mobile : ouvre web Stripe (pas d'IAP App Store/Play). Ext : N/A.                                              | 5-8j (IAP iOS/Android — gros chantier) |
| 26  | Google Sign-In                           | OK     | OK     | OK        | Web : `pages/Login.tsx` (OAuth web). Mobile : `@react-native-google-signin` + `expo-auth-session` dans `AuthContext.tsx`. Ext : `chrome.identity.launchWebAuthFlow`. | —             |
| 27  | Share publique d'analyse (token public)  | OK     | OK     | OK        | Web : `pages/SharedAnalysisPage.tsx` + route `/s/:shareToken`. Mobile : `ShareAnalysisButton.tsx` (Share API native). Ext : `viewer/components/ActionBar.tsx` + `SHARE_ANALYSIS` action. | —             |
| 28  | Ambient light dynamique                  | OK     | OK     | NO        | Web : `AmbientLightLayer.tsx` + `DayNightContext.tsx`. Mobile : `backgrounds/AmbientLightLayer.tsx` + `useTimeOfDay.ts` (commit récent c955dbdb). Ext : 0.       | 1-2j (ext, décision archi probable — performance YouTube overlay) |
| 29  | Time-of-day theming                      | OK     | OK     | NO        | `hooks/useTimeOfDay.ts` (web + mobile). Ext force dark always (cf. memory `extension-shadow-dom-white-widget-fix`).                                            | N/A par décision (extension dark-only) |
| 30  | Doodles / illustrations background       | OK     | OK     | OK        | Web : `DoodleBackground.tsx`. Mobile : `doodles/` + `backgrounds/DoodleBackground.tsx`. Ext : `popup/components/doodles/DoodleIcon.tsx`.                       | —             |
| 31  | History (consultation analyses passées)  | OK     | OK     | PART      | Web : `pages/History.tsx` (3661 LOC) + `VirtualHistoryList.tsx`. Mobile : `app/(tabs)/library.tsx` + `library/AnalysisCard.tsx` (FlashList). Ext : local cache uniquement, pas de page list. | 1-2j (ext) |
| 32  | Settings (préférences utilisateur)       | OK     | OK     | PART      | Web : `pages/Settings.tsx` (622 LOC). Mobile : `app/(tabs)/profile.tsx` + `profile/PreferencesSection.tsx`. Ext : peu de settings (langue, dark mode, voice prefs absent). | 1-2j (ext)    |
| 33  | Onboarding / first-run flow              | OK     | OK     | NO        | Web : `pages/ExtensionWelcomePage.tsx` (cible extension !). Mobile : `app/(auth)/index.tsx`. Ext : aucun screen onboarding propre, popup direct sur LoginView. | 1-2j (ext)    |
| 34  | Search / filter (in-app history)         | OK     | OK     | NO        | Web : recherche dans `History.tsx` + `pages/__tests__/Login.test.tsx`. Mobile : `library/SearchBar.tsx`. Ext : 0.                                              | N/A par décision (ext = popup éphémère) |
| 35  | i18n (FR + EN)                           | OK     | OK     | OK        | Lignes JSON : Web 801, Mobile 976, Ext 246. Ext couvre une fraction des strings (UI plus simple).                                                              | —             |
| 36  | Sentry crash reporting                   | OK     | OK     | OK        | Web : `lib/sentry.ts`. Mobile : `services/CrashReporting.ts`. Ext : `utils/sentry-reporter.ts` + `crash-logger.ts`.                                            | —             |
| 37  | Offline banner / network status          | NO     | OK     | NO        | Mobile uniquement : `contexts/OfflineContext.tsx` + `common/OfflineBanner.tsx` + `hooks/useNetworkStatus.ts`. Pas de banner offline web (PWA `sw.js` mais pas de banner). | 0.5j (web) ; N/A ext |
| 38  | Push notifications                       | NO     | OK     | NO        | Mobile : `services/notifications.ts` + `hooks/useNotifications.ts` + push tokens FCM. Web : `NotificationBell.tsx` (in-app SSE only). Ext : 0.                  | N/A (web uses SSE) |
| 39  | In-app notifications (SSE)               | OK     | NO     | NO        | Web : `NotificationBell.tsx` + `useNotifications.ts` + endpoint `/api/notifications/sse/{id}`. Mobile/Ext : non exposé (mobile a pushs, ext rien).             | 1j (mobile in-app) |
| 40  | Cookie banner / GDPR consent             | OK     | N/A    | N/A       | Web : `CookieBanner.tsx`. Native apps n'ont pas besoin (consentement via stores).                                                                              | N/A           |
| 41  | Crisp chat support live                  | OK     | NO     | NO        | Web : `CrispChat.tsx`. Décision archi probable (support uniquement via web pour simplifier).                                                                   | N/A           |
| 42  | PostHog analytics                        | OK     | OK     | NO        | Web : `services/analytics.ts` + `hooks/useAnalytics.ts`. Mobile : `services/analytics.ts` + `voice/voiceAnalytics.ts`. Ext : non instrumenté.                  | 1j (ext)      |
| 43  | Skeleton loading states                  | OK     | OK     | PART      | Web : `components/ui/Skeleton.tsx`. Mobile : `ui/Skeleton.tsx` + `ui/SkeletonLoader.tsx` + `SkeletonCard.tsx`. Ext : skeleton minimal dans content states.     | 1j (ext)      |
| 44  | Streaming progress visuel (analyse)      | OK     | OK     | OK        | Web : `StreamingAnalysis.tsx`. Mobile : `analysis/StreamingAnalysisDisplay.tsx` + `StreamingOverlay.tsx`. Ext : `content/states/analyzing.ts`.                  | —             |
| 45  | Did You Know card / chat welcome insight | OK     | NO     | NO        | Web : `DidYouKnowCard.tsx` + `ChatWelcomeInsight.tsx` + `IntellectualProfileBanner.tsx`. Aucun équivalent mobile/ext.                                          | 1j (mobile)   |
| 46  | Engagement metrics display               | OK     | OK     | NO        | `EngagementMetrics.tsx` (web + mobile)                                                                                                                         | 1j (ext)      |
| 47  | Suggested questions / clickable          | OK     | OK     | OK        | `ClickableQuestions.tsx` (web), `chat/SuggestedQuestions.tsx` (mobile), `content/suggestions.ts` (ext)                                                          | —             |
| 48  | Carousel gallery (illustrations)         | OK     | OK     | NO        | `CarouselGallery.tsx` (web + mobile). Ext minimal.                                                                                                              | N/A           |
| 49  | Concept map / mind map xyflow            | OK     | NO     | NO        | Web utilise xyflow + Cytoscape lourd. Mobile : `MindMapComponent.tsx` simplifié. Ext : 0.                                                                       | N/A par décision |
| 50  | Export PDF / DOCX / Markdown             | OK     | OK     | NO        | Web : `services/api.ts` exportApi + dialog. Mobile : `export/ExportMenu.tsx` (PDF/MD/Text via `expo-sharing`). Ext : 0 (CTA). **Le CLAUDE.md racine indique mobile=NO, c'est faux.** | 1j (ext, optionnel) |
| 51  | Customization panel (UI tone, length…)   | OK     | OK     | NO        | `analysis/CustomizationPanel.tsx` (web), `customization/CustomizationPanel.tsx` (mobile)                                                                       | 1j (ext)      |
| 52  | Reliability score / freshness indicator  | OK     | OK     | OK        | `FreshnessIndicator.tsx` (web + mobile). Ext via `viewer/components/VerdictSection.tsx`.                                                                       | —             |
| 53  | Floating chat window                     | OK     | OK     | OK        | `FloatingChatWindow.tsx` (web), `chat/FloatingChat.tsx` (mobile), `popup/components/ChatDrawer.tsx` (ext)                                                       | —             |
| 54  | Guest mode / demo                        | NO     | NO     | OK        | Endpoint `/api/videos/guest-demo`. **Seule l'extension expose le mode invité** (ResultsView, MainView). Web/Mobile : auth required.                            | 1j (web), 2j (mobile) — décision archi probable |
| 55  | Glassmorphism / blur effects             | OK     | OK     | OK        | Web : Tailwind `backdrop-blur-xl`. Mobile : `expo-blur` + `GlassCard.tsx`. Ext : N/A (le widget YouTube a justement supprimé `backdrop-filter` cf. commit `4d2949b2`). | —             |
| 56  | Admin dashboard                          | OK     | NO     | NO        | Web : `pages/AdminPage.tsx` + route `/admin`. Décision archi probable (admin = web only).                                                                      | N/A           |
| 57  | API docs page                            | OK     | NO     | NO        | Web : `pages/ApiDocsPage.tsx`. Décision archi.                                                                                                                 | N/A           |
| 58  | Status page                              | OK     | NO     | NO        | Web : `pages/StatusPage.tsx`. Décision archi.                                                                                                                  | N/A           |
| 59  | Deep linking / share intent              | NO     | OK     | NO        | Mobile : `services/DeepLinking.ts` + `hooks/useShareIntent.ts` (incoming share intents iOS/Android).                                                            | N/A           |
| 60  | Haptic feedback                          | NO     | OK     | NO        | `expo-haptics` partout dans mobile. Native only.                                                                                                                | N/A           |
| 61  | Pull-to-refresh                          | NO     | OK     | NO        | Mobile : `DoodleRefreshControl.tsx`. Native only.                                                                                                               | N/A           |

**Total features auditées : 61** (les 25-30 demandées + 30 supplémentaires découvertes par exploration directe du code).

---

## Quick wins (effort < 1 jour, valeur claire)

> Classés par **valeur/effort** (le plus rentable d'abord).

| #   | Action                                                         | Plateforme cible | Effort | Valeur | Pourquoi                                                                                          |
| --- | -------------------------------------------------------------- | ---------------- | ------ | ------ | ------------------------------------------------------------------------------------------------- |
| QW1 | Ajouter Copy button sur message bubbles                        | Mobile + Ext     | 0.5j × 2 | Haute | Feature triviale, déjà sur web (`CopyMessageButton.tsx`). Pain UX courant en chat.                |
| QW2 | Mettre à jour `CLAUDE.md` racine — corriger la matrice         | Doc              | 0.2j   | Haute | Le tableau "Features par plateforme" indique mobile=NO pour Export, Tournesol, Academic alors que **les 3 sont implémentées**. Décourage le repo. |
| QW3 | Ajouter banner offline web                                     | Web              | 0.5j   | Moyenne | Mobile a `OfflineContext` + `OfflineBanner.tsx`. Web a juste `usePWA.ts` mais pas de banner.    |
| QW4 | Voice quota badge sur mobile (lecture quota)                   | Mobile           | 0.5j   | Moyenne | Backend retourne `quota_remaining_minutes` (cf. `useVoiceChat.ts:46`). UI existe sur web (`VoiceQuotaBadge.tsx`). |
| QW5 | PostHog instrumentation extension                              | Extension        | 1j     | Haute   | Web + mobile envoient des events. Extension complètement aveugle alors que c'est l'hameçon d'acquisition. Critique pour mesurer le funnel. |
| QW6 | Skeleton plus riche dans content states extension              | Extension        | 0.5-1j | Faible  | États visuels dans `extension/src/content/states/analyzing.ts` peuvent être étoffés.              |
| QW7 | EngagementMetrics dans le viewer extension                     | Extension        | 0.5-1j | Faible  | Composants existent web + mobile. Ext n'expose pas (mais pas critique).                            |

---

## Gros chantiers (effort > 3 jours, à arbitrer)

| #   | Chantier                                              | Plateforme | Effort   | Risques / décisions à prendre                                                                                                                                     |
| --- | ----------------------------------------------------- | ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GC1 | **Voice chat ElevenLabs dans extension**              | Extension  | 5-8j     | MV3 service worker peut être tué → WebSocket persistant difficile. Permissions micro Chrome. Décision : faut-il vraiment voice dans l'ext (qui est l'hameçon d'acquisition rapide) ? |
| GC2 | **In-App Purchase iOS + Google Play Billing**         | Mobile     | 5-8j     | Apple force IAP (commission 30% → 15%) pour vendre des features digitales sur iOS. Stripe link actuel viole les guidelines. Risque : rejet App Store si scrutin (déjà ascAppId 6740487498 publié). |
| GC3 | **Mind maps / concept maps complets dans mobile**     | Mobile     | 3-5j     | xyflow ne marche pas en RN. Alternatives : `react-native-svg` custom, Skia, ou tester `@react-native-graph`. Vraie valeur ? Mobile = compagnon de révision, pas d'analyse profonde. |
| GC4 | **Debate mode dans mobile**                           | Mobile     | 5-8j     | 9 composants à porter (DebateChat, DebateVS, DebateFactCheck, etc.). Backend prêt. Décision : feature pro reste-t-elle web-only ? Le `mobile/CLAUDE.md` dit "absentes UI mobile" — confirmer. |
| GC5 | **Playlists création + analyse complète mobile**      | Mobile     | 3-5j     | Lecture seule actuellement (`PlaylistSection.tsx`). Création + corpus chat = 1084 LOC à porter depuis `frontend/src/pages/PlaylistPage.tsx`. Idem GC4 : décision archi.                |
| GC6 | **Voice chat extension + voice PTT mobile**           | Multi      | 6-10j    | Combinaison de GC1 + porter `VoicePTTButton` mobile. Si GC1 est `non` (décision archi), juste 1j sur mobile.                                                       |

---

## Décisions architecture (asymétries volontaires à documenter)

Certaines features **doivent rester** asymétriques par décision produit. À matérialiser dans `CLAUDE.md` racine et `docs/ARCHITECTURE.md`.

| Asymétrie                                                                | Pourquoi (à valider avec le fondateur)                                                                                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin dashboard** : Web only                                           | Outil interne, mobile/ext ne peuvent pas en bénéficier. Statut : **N/A définitif**.                                                                                                                  |
| **API docs page** : Web only                                             | Cible développeurs. **N/A définitif**.                                                                                                                                                                |
| **Status page** : Web only                                               | Page publique uptime. **N/A définitif**.                                                                                                                                                              |
| **CrispChat support** : Web only                                         | Coût licence + opérations. **N/A par décision**.                                                                                                                                                       |
| **Cookie banner GDPR** : Web only                                        | Apps natives = consentement via stores (Apple/Google). **N/A définitif**.                                                                                                                            |
| **Time-of-day theming** : Web + Mobile, **pas Extension**                | Extension force dark always (memory `project_extension-shadow-dom-white-widget-fix.md`). YouTube overlay → contraste critique. **N/A définitif**.                                                       |
| **Mind maps xyflow lourd** : Web only                                    | xyflow non-RN. Mobile a un fallback `MindMapComponent.tsx` simplifié. **Décision : mobile garde simplifié**.                                                                                          |
| **Push notifications** : Mobile only / SSE in-app : Web only             | Web utilise déjà SSE pour notifications (NotificationBell). Pas de push web (browser permission UX cassante). **N/A par décision**.                                                                  |
| **Pull-to-refresh, haptic feedback, deep linking, share intent**         | Native only. **N/A définitif** (web/ext n'ont pas l'API).                                                                                                                                            |
| **Guest mode / demo** : Extension only                                   | Stratégie d'acquisition : "1 analyse gratuite sans compte" sur YouTube. Web = sign-up forcé, mobile = sign-up forcé. **N/A par décision**.                                                            |
| **Stripe checkout direct** : Web only                                    | À court terme, mobile ouvre web. À moyen terme, **chantier GC2** = IAP iOS + Play Billing (obligatoire pour grow App Store).                                                                          |
| **Search / filter in-app**                                               | Ext popup éphémère, ne tient pas une liste filtrable. **N/A par décision**.                                                                                                                          |
| **Debate mode** : Web only (à confirmer)                                 | `mobile/CLAUDE.md` dit "absentes UI mobile". Décision actuelle = web only. À matérialiser dans `CLAUDE.md` racine (actuellement marqué "❌ CTA" → cohérent).                                          |
| **Playlists création** : Web only (à confirmer)                          | Mobile a lecture seule (`PlaylistSection.tsx`). Création complexe = web only. À matérialiser.                                                                                                         |

---

## Proposed issues GitHub (NON créées — l'utilisateur arbitrera)

> Pour chaque cellule **PART** ou **NO** qui devrait raisonnablement être **OK**.

### Quick wins (effort ≤ 1j)

1. **`mobile`** Add CopyMessageButton equivalent on chat bubbles — _ref `frontend/src/components/CopyMessageButton.tsx`_
2. **`extension`** Add CopyMessageButton on ChatDrawer messages — _ref `extension/src/popup/components/ChatDrawer.tsx`_
3. **`docs`** Update `CLAUDE.md` root feature matrix (Export PDF mobile=OK, Tournesol mobile=OK, Academic mobile=OK)
4. **`web`** Add OfflineBanner equivalent (currently only mobile has it)
5. **`mobile`** Surface VoiceQuotaBadge in `VoiceScreen` header — _ref `frontend/src/components/voice/VoiceQuotaBadge.tsx`_
6. **`extension`** Instrument PostHog events (analyse_started, analyse_completed, chat_sent, share_clicked, login)
7. **`extension`** Richer skeleton states in `content/states/analyzing.ts`

### Features partielles à compléter (1-2j)

8. **`extension`** Add Tournesol score badge on viewer (`viewer/components/VerdictSection.tsx`)
9. **`extension`** Add academic sources display in viewer (read-only)
10. **`extension`** Add CitationExport equivalent
11. **`extension`** Add ConceptsGlossary in viewer
12. **`extension`** Add EngagementMetrics in viewer
13. **`extension`** Add CustomizationPanel (tone/length) in popup
14. **`extension`** Add Settings section (voice prefs, language, theme)
15. **`extension`** Add proper onboarding flow on first install (currently jumps to LoginView)
16. **`mobile`** Add CitationExport (non-académique) on analyses
17. **`mobile`** Add DidYouKnowCard / ChatWelcomeInsight
18. **`mobile`** Add in-app SSE notifications (via NotificationBell pattern)
19. **`web`** Add OfflineBanner (1 ligne)
20. **`extension`** Add real History list view (currently local-only)

### Gros chantiers (à brainstormer / arbitrer)

21. **`extension`** Voice chat ElevenLabs (GC1) — _décision archi requise_
22. **`mobile`** In-App Purchase iOS + Play Billing (GC2) — _bloquant pour App Store conformité_
23. **`mobile`** Voice PTT button (1j si voice mobile suffit) — _ref `frontend/src/components/voice/VoicePTTButton.tsx`_
24. **`mobile`** Mind maps complets (GC3) — _décision archi : reste simplifié ?_
25. **`mobile`** Debate mode (GC4) — _décision : reste web only ?_
26. **`mobile`** Playlists création + corpus chat (GC5) — _décision : reste web only ?_

---

## Annexes

### Top 10 fichiers les plus volumineux scannés (LOC)

| Fichier                                              | LOC   | Plateforme |
| ---------------------------------------------------- | ----- | ---------- |
| `frontend/src/pages/History.tsx`                     | 3 661 | Web        |
| `frontend/src/pages/PlaylistPage.tsx`                | 1 084 | Web        |
| `extension/src/popup/components/MainView.tsx`        | 729   | Extension  |
| `frontend/src/pages/Settings.tsx`                    | 622   | Web        |
| `mobile/app/(tabs)/profile.tsx`                      | 227   | Mobile     |
| `mobile/src/i18n/{fr,en}.json`                       | 976   | Mobile     |
| `frontend/src/i18n/{fr,en}.json`                     | 801   | Web        |
| `extension/src/i18n/{fr,en}.json`                    | 246   | Extension  |
| `extension/src/popup/components/FeatureCTAGrid.tsx`  | 167   | Extension  |
| `frontend/src/components/voice/VoicePTTButton.tsx`   | 144   | Web        |

### Volume i18n par plateforme

- Web : 801 strings
- Mobile : 976 strings (le plus exhaustif)
- Extension : 246 strings (cohérent avec UI réduite)

### Routes web (extrait de `frontend/src/App.tsx`)

```
/, /login, /auth/callback, /legal/cgu, /legal/cgv, /legal/privacy, /legal,
/status, /contact, /about, /payment/success, /payment/cancel, /api-docs,
/s/:shareToken, /dashboard, /playlists, /playlist/:id, /history, /upgrade,
/usage, /analytics, /settings, /account, /admin, /chat, /study, /study/:summaryId,
/debate, /debate/:id, /extension-welcome
```

29 routes — bien plus dense que mobile (5 tabs) ou extension (popup + viewer + content overlay).

---

_Audit conduit en read-only, sans modification de code source. Voir branche `docs/feature-parity-2026-04-25` et la PR associée pour décisions de priorisation._
