# Plan d'implémentation Mobile Audit — DeepSight

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` recommandé. Steps use checkbox syntax.

**Goal:** Combler les gaps critiques identifiés dans l'audit mobile vs web (avril 2026) — passer de 5.75/10 à 8/10 sur la maturité mobile.

**Architecture:** Exécution en 2 phases. Phase 1 = quick wins faisables en 1-2 semaines (cette session). Phase 2 = chantiers structurels (gamification, AI Debate, IAP) reportés à des sessions dédiées.

**Tech Stack:** Expo SDK 54, React Native 0.81, Reanimated 4.1, @shopify/flash-list, @elevenlabs/react-native 0.5.12, expo-sharing, expo-file-system.

---

## Contexte

Audit complet réalisé le 2026-04-17. Résultats synthèses dans la conversation.

**Gaps critiques à combler (Phase 1) :**

1. voiceApi mobile incomplet (manque catalog, preferences, addon checkout)
2. 5 modules API absents : exportsApi, trendingApi, searchApi, reliabilityApi, keywordImageApi
3. Composants dead code non branchés : AcademicSourcesSection, FactCheckButton, FreshnessIndicator, ReliabilityScore
4. UI voice web (14 composants) vs mobile (2 composants) — manque Waveform, Transcript, Settings, QuotaBadge
5. library.tsx n'utilise pas FlashList (perf risk)
6. 14 fichiers .bak + ~18 écrans orphelins non nettoyés

**Reporté (Phase 2, sessions dédiées) :**

- Gamification complète (XP, badges, streaks, HeatMap) — ~1 mois
- AI Debate mobile — ~3 semaines
- Credit Packs + Voice Addon IAP (RevenueCat) — ~1 semaine
- Migration IAP vs Stripe web

---

## Phase 1 — Exécution parallèle via agents

### Task A — Extension `api.ts` mobile

**Files:**

- Modify: `mobile/src/services/api.ts` (actuellement 1957 lignes)

**Contenu:**

- Étendre `voiceApi` avec : `getCatalog()`, `getPreferences()`, `updatePreferences()`, `createAddonCheckout(packId)`
- Ajouter types : `VoicePreferences`, `VoiceCatalog`, `VoiceAddonPack`
- Ajouter `exportsApi` avec : `pdf(id)`, `markdown(id)`, `text(id)`
- Ajouter `trendingApi.getTrending(period, category, limit)`
- Ajouter `searchApi.semanticSearch(query, limit, category)`
- Ajouter `reliabilityApi.getReliability(id)`, `checkChannel(channelId)`
- Ajouter `keywordImageApi.getImage(keyword)` (optionnel)
- Mettre à jour l'export default en bas

**Référence web:** `frontend/src/services/api.ts` lignes 2572-2641 (voice), 2038-2060 (exports), 2387-2397 (trending), 2420-2431 (search), 1384-1396 (reliability), 2904+ (keywordImage)

### Task B — Cleanup dette technique

**Files:**

- Delete: tous les `*.tsx.bak`, `*.ts.bak` dans `mobile/src/`
- Delete: `mobile/src/navigation/AppNavigator.tsx` + `.bak`
- Delete: `mobile/src/screens/*.tsx` NON référencés par `app/` (orphelins)
- Keep: `mobile/src/screens/QuickChatScreen.tsx` et autres encore importés

**Vérification:** `grep -r "import.*from.*screens/X"` avant suppression de chaque screen.

### Task C — Composants voice UI (nouveaux)

**Files (créations):**

- Create: `mobile/src/components/voice/VoiceWaveform.tsx`
- Create: `mobile/src/components/voice/VoiceTranscript.tsx`
- Create: `mobile/src/components/voice/VoiceQuotaBadge.tsx`
- Create: `mobile/src/components/voice/VoiceSettings.tsx`
- Modify: `mobile/src/components/voice/index.ts` (exports)

**Specs:**

- VoiceWaveform : 5 barres animées Reanimated (pulse différé), props `isActive`, `color`
- VoiceTranscript : ScrollView auto-scroll, messages user/assistant, bubbles stylisées
- VoiceQuotaBadge : pill affichant `X min restants` avec coloration par seuil (>20min vert, 5-20 ambre, <5 rouge)
- VoiceSettings : bottom sheet @gorhom, list des voix depuis `voiceApi.getCatalog()`, selected mark, save via `updatePreferences`

### Task D — FlashList library.tsx

**Files:**

- Modify: `mobile/app/(tabs)/library.tsx`

**Spec:** Remplacer ScrollView/FlatList actuel par `<FlashList>` de `@shopify/flash-list`. Mesurer estimatedItemSize (typiquement 140). Conserver pull-to-refresh, infinite scroll, keyExtractor, header.

### Task E — Export UI mobile

**Files:**

- Create: `mobile/src/components/analysis/ExportMenu.tsx`
- Verify: `mobile/package.json` contient `expo-sharing` et `expo-file-system` (installer si besoin)

**Spec:** Bottom sheet ou Action Sheet natif avec 3 options (PDF, Markdown, Texte). Utilise `exportsApi.pdf/markdown/text()`, écrit via `FileSystem.writeAsStringAsync`, partage via `Sharing.shareAsync`. Plan gating : PDF/MD = plus+, TXT = free.

### Task F — Integration analysis/[id].tsx (post-phases A+C+E)

**Files:**

- Modify: `mobile/app/(tabs)/analysis/[id].tsx`

**Spec:** Brancher les composants existants (dead code aujourd'hui) :

- `AcademicSourcesSection` dans tab Sources
- `FactCheckButton` + `FreshnessIndicator` + `ReliabilityScore` en tête d'analyse
- Bouton ExportMenu dans ActionBar

---

## Phase 2 — À reporter (sessions dédiées)

1. **Gamification mobile** — 4-6 semaines — gamificationApi + ~10 composants + nouveau tab
2. **AI Debate mobile** — 3-4 semaines — debateApi + écran VS layout + chat + fact-check
3. **IAP natif (RevenueCat)** — 1-2 semaines — migration Stripe web → IAP iOS/Android pour packs vocaux
4. **MindMap mobile** — 2 semaines — décision : faire ou pas (retiré explicitement en 2026-02, reconsider?)
5. **Playlists mobile (création)** — 2 semaines — actuellement CTA web

---

## Commits

Chaque task produit 1 commit atomique avec message conforme `anthropic-skills:git-workflow` :

- `feat(mobile): extend voiceApi with catalog/preferences/addon`
- `feat(mobile): add exportsApi, trendingApi, searchApi, reliabilityApi`
- `chore(mobile): cleanup .bak files and orphaned screens`
- `feat(mobile): add VoiceWaveform/Transcript/QuotaBadge/Settings components`
- `perf(mobile): migrate library.tsx to FlashList`
- `feat(mobile): add ExportMenu with expo-sharing`
- `feat(mobile): wire academic/factcheck/freshness components in analysis detail`

---

## Verification

Après chaque task :

- `cd mobile && npm run typecheck`
- `cd mobile && npm test` (si impact sur composants testés)
- Lecture visuelle des diffs

Après Phase 1 complète :

- Relire CLAUDE.md mobile : synchronisation api.ts mobile/frontend OK
- Tester sur simulateur iOS + Android si possible
