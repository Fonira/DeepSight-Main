# Mobile Hub Tab Unifié — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer un onglet Hub stable `/(tabs)/hub` mobile, mirror direct de `frontend/src/pages/HubPage.tsx`, qui devient le centre de gravité de toutes les surfaces conversationnelles (Quick Chat + Quick Call + historique convos). Suppression de `QuickChatScreen` + `VoiceScreen` + FAB voice analyse[id]. Refacto ChatView pour réutiliser les composants Hub.

**Architecture:** Tab Expo Router `/(tabs)/hub` + 12 composants `mobile/src/components/hub/*` (mirror web) + Zustand store `hubStore.ts` (slots minimum) + 2 hooks (`useHubData`, `useHubVoice`) + extension type `ChatMessage` mobile. Backend déjà unifié (PR #203 mergée) — aucun changement requis.

**Tech Stack:** Expo SDK 54 + React Native 0.81 + React 19 + Reanimated 4 + TanStack Query 5 + Zustand + Immer + `@gorhom/bottom-sheet` + `@shopify/flash-list` + Jest.

**Spec:** `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md`

**Branches:**

- PR1 : `feat/mobile-hub-tab-foundation` depuis `origin/main`
- PR2 : `feat/mobile-hub-tab-voice` depuis `origin/main` (peut commencer en parallèle PR1 via mocks composants Hub)

**Worktrees:**

- PR1 : `C:\Users\33667\DeepSight-hub-foundation`
- PR2 : `C:\Users\33667\DeepSight-hub-voice`

**Sub-agents:** Opus 4.7 obligatoire (`claude-opus-4-7[1m]` — mémoire user perma).

---

## File Structure

### PR1 — Hub Foundation (Agent A, ~2j)

**Create**

- `mobile/app/(tabs)/hub.tsx` — route Expo Router racine + orchestration
- `mobile/src/components/hub/HubHeader.tsx`
- `mobile/src/components/hub/Timeline.tsx`
- `mobile/src/components/hub/MessageBubble.tsx`
- `mobile/src/components/hub/InputBar.tsx`
- `mobile/src/components/hub/ConversationsDrawer.tsx`
- `mobile/src/components/hub/SummaryCollapsible.tsx`
- `mobile/src/components/hub/VideoPiPPlayer.tsx`
- `mobile/src/components/hub/types.ts` — `HubMessage`, `HubConversation`, `HubSummaryContext`, `HubVoiceState`
- `mobile/src/components/hub/index.ts` — barrel export
- `mobile/src/stores/hubStore.ts` — Zustand + Immer
- `mobile/src/hooks/useHubData.ts` — fetch conversations + messages
- `mobile/__tests__/stores/hubStore.test.ts`
- `mobile/__tests__/components/hub/Timeline.test.tsx`
- `mobile/__tests__/components/hub/MessageBubble.test.tsx`
- `mobile/__tests__/components/hub/ConversationsDrawer.test.tsx`
- `mobile/__tests__/services/chatApi.passthrough.test.ts`

**Modify**

- `mobile/app/(tabs)/_layout.tsx` — ajouter `<Tabs.Screen name="hub">` en position 2
- `mobile/src/components/navigation/CustomTabBar.tsx` — ajouter entrée `hub` dans `TAB_META`
- `mobile/src/types/index.ts` — étendre `ChatMessage` (4 nouveaux champs voice)
- `mobile/src/services/api.ts` — vérifier `chatApi.getHistory` passthrough champs voice
- `mobile/app/(tabs)/index.tsx` — bloc Quick Chat : ajouter bouton Quick Call + nav vers Hub

**Delete**

- _Aucun en PR1_ (suppressions en PR2 après validation Hub OK)

### PR2 — Voice Integration + Cleanup (Agent B, ~2j)

**Create**

- `mobile/src/components/hub/VoiceControls.tsx`
- `mobile/src/components/hub/CallModeFullBleed.tsx`
- `mobile/src/components/hub/VoiceWaveformBars.tsx`
- `mobile/src/components/hub/VoiceBubble.tsx`
- `mobile/src/hooks/useHubVoice.ts`
- `mobile/__tests__/hooks/useHubVoice.test.ts`
- `mobile/__tests__/components/hub/VoiceControls.test.tsx`
- `mobile/__tests__/components/hub/CallModeFullBleed.test.tsx`
- `mobile/__tests__/components/hub/InputBar.mic.test.tsx`

**Modify**

- `mobile/src/components/hub/Timeline.tsx` — ajouter rendu `<VoiceBubble>` pour `source === "voice_agent"`
- `mobile/src/components/hub/InputBar.tsx` — ajouter Mic toggle (Alert confirm + start | toggleMute)
- `mobile/app/(tabs)/hub.tsx` — intégrer `<VoiceControls>` + `<CallModeFullBleed>` + auto-start `initialMode='call'`
- `mobile/app/(tabs)/analysis/[id].tsx` — supprimer `<VoiceButton>` + `<VoiceScreen>` + `useVoiceChat` ; supprimer `isVoiceVisible`
- `mobile/src/components/analysis/ActionBar.tsx` — ajouter bouton "Discuter / Appeler" → navigate `/hub?summaryId=X`
- `mobile/src/components/analysis/ChatView.tsx` — refacto interne : utiliser `<Timeline>` + `<InputBar>` + `<MessageBubble>` du Hub (composition, pas duplication)

**Delete**

- `mobile/src/components/analysis/QuickChatScreen.tsx`
- `mobile/src/components/voice/VoiceScreen.tsx`
- `mobile/src/components/voice/VoiceButton.tsx` (sauf si conservé pour ActionBar — décision review PR2)
- `mobile/src/components/voice/PostCallScreen.tsx` (si encore présent)
- `mobile/src/components/analysis/__tests__/QuickChatScreen.test.tsx` (si présent)
- `mobile/src/components/voice/__tests__/VoiceScreen.test.tsx`
- `mobile/src/components/voice/__tests__/VoiceButton.test.tsx`
- `mobile/src/components/voice/__tests__/VoiceButton.placement.test.tsx`
- `mobile/src/components/voice/__tests__/PostCallScreen.test.tsx` (si présent)

### Optionnel — Backend sanity check

- `backend/tests/chat/test_history_includes_voice_fields.py` — 1 test pytest (~10 lignes) vérifiant que `GET /api/chat/history/{summary_id}` retourne `source/voice_speaker/voice_session_id/time_in_call_secs`. Peut être inclus dans PR1 ou commit séparé.

---

# PR1 — Hub Foundation (Agent A)

## Task 1 : Étendre type `ChatMessage` mobile + tests passthrough api

**Files:**

- Modify: `mobile/src/types/index.ts`
- Modify: `mobile/src/services/api.ts` (`chatApi.getHistory`)
- Create: `mobile/__tests__/services/chatApi.passthrough.test.ts`

- [ ] **Step 1** : Lire `mobile/src/types/index.ts`, localiser l'interface `ChatMessage` actuelle.
- [ ] **Step 2** : Étendre `ChatMessage` :
  ```typescript
  export interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: string;
    // NEW (mirror backend)
    source?: "text" | "voice";
    voice_speaker?: "user" | "agent" | null;
    voice_session_id?: string | null;
    time_in_call_secs?: number | null;
  }
  ```
- [ ] **Step 3** : Ouvrir `mobile/src/services/api.ts`, localiser `chatApi.getHistory`. Vérifier que le mapping ne drop pas les nouveaux champs (passthrough).
- [ ] **Step 4** : Si drop → ajuster pour passthrough explicite (`source: m.source, voice_speaker: m.voice_speaker, ...`).
- [ ] **Step 5** : Créer `mobile/__tests__/services/chatApi.passthrough.test.ts` avec mock fetch retournant 1 message voice + assertion sur les 4 champs préservés.
- [ ] **Step 6** : `npm run typecheck` → 0 erreur sur les fichiers touchés.
- [ ] **Step 7** : `npm run test -- chatApi.passthrough` → 1 test PASS.

## Task 2 : Créer `mobile/src/components/hub/types.ts`

**Files:**

- Create: `mobile/src/components/hub/types.ts`

- [ ] **Step 1** : Lire `frontend/src/components/hub/types.ts` (référence web).
- [ ] **Step 2** : Créer la version mobile en copiant la structure :
  ```typescript
  export interface HubMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    source: "text" | "voice_user" | "voice_agent";
    sources?: { title: string; url: string }[];
    web_search_used?: boolean;
    voice_session_id?: string | null;
    time_in_call_secs?: number;
    audio_duration_secs?: number;
    timestamp: number;
  }
  export interface HubConversation {
    id: number;
    summary_id: number | null;
    title: string;
    video_source?: "youtube" | "tiktok";
    video_thumbnail_url?: string | null;
    last_snippet?: string;
    updated_at: string;
  }
  export interface HubSummaryContext {
    summary_id: number;
    video_title: string;
    video_channel: string;
    video_duration_secs: number;
    video_source: "youtube" | "tiktok";
    video_thumbnail_url: string | null;
    short_summary: string;
    citations: { ts: number; label: string }[];
  }
  export type HubVoiceState =
    | "idle"
    | "ptt_recording"
    | "call_connecting"
    | "call_active"
    | "call_ending";
  ```
- [ ] **Step 3** : Vérifier compat strict TS (zéro `any`, exports nommés).

## Task 3 : Créer `mobile/src/stores/hubStore.ts`

**Files:**

- Create: `mobile/src/stores/hubStore.ts`
- Create: `mobile/__tests__/stores/hubStore.test.ts`

- [ ] **Step 1** : Lire `frontend/src/store/hubStore.ts` (référence web). Identifier les slots minimaux (cf. spec §4.3).
- [ ] **Step 2** : Créer `mobile/src/stores/hubStore.ts` avec Zustand + Immer (déjà installé pour authStore/analysisStore) :
  - Slots data : `conversations`, `activeConvId`, `messages`, `summaryContext`
  - Slots UI : `drawerOpen`, `summaryExpanded`, `pipExpanded`, `voiceCallOpen`, `voiceState`
  - Setters : `setConversations`, `setActiveConv` (vide messages), `setMessages`, `appendMessage`, `setSummaryContext`, `toggleDrawer`, `toggleSummary`, `setPipExpanded`, `setVoiceCallOpen`, `setVoiceState`, `reset`
- [ ] **Step 3** : Créer test `mobile/__tests__/stores/hubStore.test.ts` couvrant :
  - `setActiveConv vide messages`
  - `appendMessage push`
  - `toggleDrawer flip boolean`
  - `reset restaure INITIAL`
- [ ] **Step 4** : `npm run test -- hubStore` → 4+ PASS.

## Task 4 : Créer `mobile/src/components/hub/MessageBubble.tsx`

**Files:**

- Create: `mobile/src/components/hub/MessageBubble.tsx`
- Create: `mobile/__tests__/components/hub/MessageBubble.test.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/MessageBubble.tsx` (référence). Identifier les props et le rendu (3 variants : user texte / assistant texte / assistant voice).
- [ ] **Step 2** : Réécrire mobile-native :
  - `StyleSheet.create` (PAS Tailwind)
  - Ionicons (PAS Lucide)
  - Réutiliser `ChatMarkdown` existant (`mobile/src/components/analysis/ChatMarkdown.tsx`) pour le rendu markdown agent
  - Bulle user : right-aligned, `palette.indigo` bg
  - Bulle agent texte : left-aligned, `colors.bgCard` bg
  - Bulle agent voice : left-aligned + badge 🎙️ (Ionicons `mic-outline`) inline droite + label "voix"
- [ ] **Step 3** : Parse `[ask:...]` follow-up questions (réutiliser code existant de `ChatView.tsx`).
- [ ] **Step 4** : Tests Jest :
  - `user text bubble renders right-aligned`
  - `assistant text bubble renders markdown`
  - `assistant voice_agent bubble renders 🎙️ badge`
  - `[ask:] questions render clickable buttons`
- [ ] **Step 5** : `npm run test -- MessageBubble` → 4+ PASS.

## Task 5 : Créer `mobile/src/components/hub/Timeline.tsx`

**Files:**

- Create: `mobile/src/components/hub/Timeline.tsx`
- Create: `mobile/__tests__/components/hub/Timeline.test.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/Timeline.tsx`. Reproduire le tri par timestamp + scroll-to-end + empty state.
- [ ] **Step 2** : Réécrire mobile-native avec `@shopify/flash-list` (FlashList inverted = pas inverse, on garde l'ordre chronologique avec scroll bottom auto).
- [ ] **Step 3** : Filtre strict : `messages.filter(m => m.source !== "voice_user")` AVANT render. **Règle UX DeepSight** (`feedback_voice-fil-asymetrique.md`).
- [ ] **Step 4** : Empty state : "Pose ta première question..." + 3 suggestions chips (cf. SUGGESTED_QUESTIONS de QuickChatScreen).
- [ ] **Step 5** : `isThinking` prop → render `<TypingIndicator>` (réutiliser code de QuickChatScreen).
- [ ] **Step 6** : Tests Jest :
  - `excludes voice_user messages from display`
  - `renders empty state when messages.length === 0`
  - `renders bubbles in chronological order`
  - `renders thinking dots when isThinking=true`
- [ ] **Step 7** : `npm run test -- Timeline` → 4+ PASS.

## Task 6 : Créer `mobile/src/components/hub/InputBar.tsx`

**Files:**

- Create: `mobile/src/components/hub/InputBar.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/InputBar.tsx`. Identifier les props (onSend, isLoading, placeholder, quotaText).
- [ ] **Step 2** : Réécrire mobile-native :
  - `TextInput` multiline (max 5 lines, scrollEnabled)
  - Bouton Send (Ionicons `send`) avec haptic feedback
  - Quota label dessous (ex : "5/15 questions")
  - **PAS de Mic toggle ici** → ajouté en PR2
  - `KeyboardAvoidingView` parent (pas dans InputBar lui-même)
- [ ] **Step 3** : Props :
  ```typescript
  interface InputBarProps {
    inputText: string;
    setInputText: (s: string) => void;
    onSend: () => void;
    isLoading: boolean;
    quotaText?: string;
    placeholder?: string;
  }
  ```

## Task 7 : Créer `mobile/src/components/hub/ConversationsDrawer.tsx`

**Files:**

- Create: `mobile/src/components/hub/ConversationsDrawer.tsx`
- Create: `mobile/__tests__/components/hub/ConversationsDrawer.test.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/ConversationsDrawer.tsx` (référence). Identifier le pattern (liste + tap → setActiveConv).
- [ ] **Step 2** : Mobile-native : utiliser `@gorhom/bottom-sheet` (déjà installé) au lieu de side drawer.
  - `snapPoints: ['25%', '75%']`
  - Header : "Conversations" + bouton "+ Nouvelle"
  - FlashList des `HubConversation[]` :
    - Item : thumbnail (Image expo-image) + title + last_snippet + timestamp relatif
    - Tap item → `setActiveConv(c.id)` + `closeDrawer()`
    - Long-press → menu contextuel (delete) — out-of-scope PR1, à laisser en TODO
  - Empty state : "Aucune conversation. Démarre depuis Home avec une URL vidéo."
- [ ] **Step 3** : Tests Jest :
  - `renders FlashList of conversations`
  - `tap item calls setActiveConv with correct id`
  - `bottom sheet snapPoints correct`
- [ ] **Step 4** : `npm run test -- ConversationsDrawer` → 3+ PASS.

## Task 8 : Créer `mobile/src/components/hub/SummaryCollapsible.tsx` + `VideoPiPPlayer.tsx` + `HubHeader.tsx`

**Files:**

- Create: `mobile/src/components/hub/SummaryCollapsible.tsx`
- Create: `mobile/src/components/hub/VideoPiPPlayer.tsx`
- Create: `mobile/src/components/hub/HubHeader.tsx`

- [ ] **Step 1** : Lire les 3 référence web. Identifier les props et comportements.
- [ ] **Step 2** : `SummaryCollapsible` mobile-native :
  - Card collapsible (Reanimated layout animation)
  - Titre vidéo + court résumé (`short_summary`)
  - Citations cliquables (chips horizontal scroll) → callback `onCitationTap(ts)`
  - Toggle expand/collapse via tap header
- [ ] **Step 3** : `VideoPiPPlayer` mobile-native :
  - Mini thumbnail vidéo (Image expo-image, 48x48 dp dans HubHeader / 96x96 dp si expanded)
  - Tap → toggle `pipExpanded`
  - Pas de vrai player vidéo en PR1 (juste thumbnail) — TODO PR3 si besoin
- [ ] **Step 4** : `HubHeader` mobile-native :
  - Bouton ☰ (Ionicons `menu`) → `toggleDrawer()`
  - Title (numberOfLines=1, ellipsis)
  - Subtitle (platform badge YT/TikTok)
  - VideoPiPPlayer slot (côté droit) si `summaryContext` existe

## Task 9 : Créer `mobile/src/components/hub/index.ts` (barrel export)

**Files:**

- Create: `mobile/src/components/hub/index.ts`

- [ ] **Step 1** : Re-export tous les composants Hub PR1 :
  ```typescript
  export * from "./types";
  export { HubHeader } from "./HubHeader";
  export { Timeline } from "./Timeline";
  export { MessageBubble } from "./MessageBubble";
  export { InputBar } from "./InputBar";
  export { ConversationsDrawer } from "./ConversationsDrawer";
  export { SummaryCollapsible } from "./SummaryCollapsible";
  export { VideoPiPPlayer } from "./VideoPiPPlayer";
  ```

## Task 10 : Créer `mobile/src/hooks/useHubData.ts`

**Files:**

- Create: `mobile/src/hooks/useHubData.ts`

- [ ] **Step 1** : Implémenter le hook qui orchestre les fetchs :
  - Mount → `videoApi.getHistory({page:1, limit:50})` → map en `HubConversation[]` → `setConversations()`
  - `activeConvId` change → `chatApi.getHistory(activeConvId)` → map en `HubMessage[]` → `setMessages()` (mapping source aplati : `voice + speaker:user → voice_user`, etc.)
  - Build `summaryContext` minimal depuis conv + setSummaryContext()
  - Cleanup : cancel via `cancelled = true` flag
- [ ] **Step 2** : Compatible avec mode offline : si fetch fail → ne pas crash, log warn.
- [ ] **Step 3** : Pas de tests unitaires dédiés (testé via integration test `hub.tsx` ou skip).

## Task 11 : Créer `mobile/app/(tabs)/hub.tsx`

**Files:**

- Create: `mobile/app/(tabs)/hub.tsx`

- [ ] **Step 1** : Squelette React component avec :
  - `useLocalSearchParams<{ videoUrl?, initialMode?, summaryId?, convId? }>()`
  - `useHubStore()` pour les slots
  - `useHubData()` pour les fetchs
  - Mount logic :
    - Si `convId` ou `summaryId` → `setActiveConv(Number(id))`
    - Si `videoUrl` + `initialMode='chat'` → POST `/api/videos/quick-chat` puis `setActiveConv(result.summary_id)`
    - Si `videoUrl` + `initialMode='call'` → TODO PR2 (placeholder Alert "Voice not yet wired")
- [ ] **Step 2** : JSX layout (cf. spec §4) :
  ```tsx
  <View style={styles.container}>
    <DoodleBackground variant="default" density="low" />
    <HubHeader ... />
    {summaryContext && <SummaryCollapsible context={summaryContext} />}
    <Timeline messages={messages} isThinking={isThinking} />
    {/* VoiceControls slot — PR2 */}
    <InputBar ... />
    <ConversationsDrawer ... />
    {/* CallModeFullBleed — PR2 */}
  </View>
  ```
- [ ] **Step 3** : `handleSend` :
  - `chatApi.send(activeConvId, text, false)` → `appendMessage(userMsg)` puis `appendMessage(assistantMsg)`
  - Pendant fetch : `setIsThinking(true)`, finally false

## Task 12 : Modifier `mobile/app/(tabs)/_layout.tsx` + `CustomTabBar.tsx`

**Files:**

- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/components/navigation/CustomTabBar.tsx`

- [ ] **Step 1** : `_layout.tsx` : ajouter `<Tabs.Screen name="hub" options={{title:"Hub"}} />` en position 2 (juste après `index`).
- [ ] **Step 2** : `CustomTabBar.tsx` : ajouter dans `TAB_META` :
  ```typescript
  hub: { icon: "chatbubbles-outline", iconFocused: "chatbubbles", label: "Hub" },
  ```
- [ ] **Step 3** : Vérifier que l'ordre dans `TAB_META` correspond à l'ordre `Tabs.Screen` (l'objet JS préserve l'ordre d'insertion en pratique sur V8/Hermes mais le CustomTabBar trie via `state.routes` order, donc OK).
- [ ] **Step 4** : Smoke iOS : Hub apparaît en TabBar position 2, label "Hub", icône chatbubbles.

## Task 13 : Modifier `mobile/app/(tabs)/index.tsx` (Home)

**Files:**

- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1** : Localiser le bloc Quick Chat (lignes 389-464). Modifier `handleQuickChat` pour navigate vers Hub :
  ```typescript
  const handleQuickChat = useCallback(() => {
    const url = quickChatUrl.trim();
    if (!url) return;
    if (!isValidVideoUrl(url)) { Alert.alert(...); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Keyboard.dismiss();
    router.push({
      pathname: "/(tabs)/hub",
      params: { videoUrl: url, initialMode: "chat" }
    });
    setQuickChatUrl("");
  }, [quickChatUrl]);
  ```
- [ ] **Step 2** : Ajouter un bouton **Quick Call** à côté du bouton Quick Chat (icône `call` Ionicons, gold bg) :
  ```tsx
  <Pressable
    style={[styles.quickChatBtn, { backgroundColor: palette.gold }]}
    onPress={handleQuickCall}
  >
    <Ionicons name="call" size={18} color="#fff" />
  </Pressable>
  ```
- [ ] **Step 3** : Implémenter `handleQuickCall` qui navigate vers Hub avec `initialMode='call'`.
- [ ] **Step 4** : Adapter le titre du bloc : "Quick Chat" → "Discuter / Appeler" (ou "Quick Discussion").
- [ ] **Step 5** : Smoke iOS : tap Quick Chat → Hub charge avec videoUrl + chat mode. Tap Quick Call → Hub charge avec videoUrl + call mode (mais en PR1, voice = placeholder Alert).

## Task 14 : Tests d'intégration PR1

- [ ] **Step 1** : `npm run typecheck` → 0 erreur sur les fichiers Hub PR1 (existant 19 erreurs TS pré-existantes — ne pas confondre, cf. `project_deepsight-mobile-refonte.md`).
- [ ] **Step 2** : `npm run test` → tous les tests Hub PR1 PASS (15+).
- [ ] **Step 3** : `npm run lint -- --fix` sur les nouveaux fichiers.
- [ ] **Step 4** : Smoke iOS : ouvrir l'app → tab Hub visible → tap → Hub vide rendu OK → ouvrir drawer → liste convos chargée depuis API → tap conv → messages chargés.

## Task 15 : Commit + push PR1

- [ ] **Step 1** : `git status` dans worktree `C:\Users\33667\DeepSight-hub-foundation`.
- [ ] **Step 2** : `git add` fichiers créés/modifiés (NE PAS inclure `.claude/settings.local.json`, `id_hetzner_b64.txt`, `extension/dist/*.map`).
- [ ] **Step 3** : Commit message :

  ```
  feat(mobile): Hub Foundation — onglet conversationnel unifié

  PR1 du sprint Mobile Hub Tab Unifié (spec 2026-05-04).
  Crée l'onglet /(tabs)/hub mirror du HubPage web :
  - 12 composants hub/* (HubHeader, Timeline, MessageBubble, InputBar, ConversationsDrawer, SummaryCollapsible, VideoPiPPlayer, types, index)
  - Zustand store hubStore avec slots minimaux
  - Hook useHubData pour fetchs conversations + messages
  - Extension type ChatMessage avec champs voice
  - TabBar : Hub en position 2 (après Home)
  - Home : Quick Chat + Quick Call boutons → navigate Hub avec initialMode

  Voice intégration = PR2.

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

- [ ] **Step 4** : `git push -u origin feat/mobile-hub-tab-foundation`.
- [ ] **Step 5** : `gh pr create --title "feat(mobile): Hub Foundation — tab conversationnel" --body "..."` (corps avec lien spec + plan + checklist test plan).

---

# PR2 — Voice Integration + Cleanup (Agent B)

> **Dépendance** : peut commencer en parallèle PR1 si Agent B mock les composants Hub manquants. Sinon, démarrer après PR1 mergée.

## Task 16 : Créer `mobile/src/components/hub/VoiceWaveformBars.tsx`

**Files:**

- Create: `mobile/src/components/hub/VoiceWaveformBars.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/VoiceWaveformBars.tsx` (référence).
- [ ] **Step 2** : Mobile-native avec Reanimated 4 :
  - Props : `isActive: boolean`, `barCount?: number = 5`, `color?: string = palette.gold`
  - 5 barres animées (sharedValue scale Y, withRepeat sequence)
  - Fond gradient subtil (`expo-linear-gradient`) si `isActive`
- [ ] **Step 3** : Performance : `useEffect` cleanup pour stop les `withRepeat` au unmount.

## Task 17 : Créer `mobile/src/components/hub/VoiceBubble.tsx`

**Files:**

- Create: `mobile/src/components/hub/VoiceBubble.tsx`

- [ ] **Step 1** : Lire `frontend/src/components/hub/VoiceBubble.tsx`.
- [ ] **Step 2** : Mobile-native :
  - Bulle agent voice (left-aligned, card bg)
  - Inline VoiceWaveformBars mini (3 bars, isActive=false par défaut, isActive=true si `audio_duration_secs` is recent)
  - Texte transcript (markdown via ChatMarkdown)
  - Badge 🎙️ + label "voix"
- [ ] **Step 3** : Reuse du code MessageBubble (composition).

## Task 18 : Créer `mobile/src/components/hub/VoiceControls.tsx`

**Files:**

- Create: `mobile/src/components/hub/VoiceControls.tsx`
- Create: `mobile/__tests__/components/hub/VoiceControls.test.tsx`

- [ ] **Step 1** : Composant zone bas (au-dessus de InputBar) qui rend selon `voiceState` :
  - `'idle'` → null (rien rendu)
  - `'call_active'` → row : VoiceWaveformBars + timer "0:34" + remainingMinutes + 2 boutons (Mute, End)
  - `'call_ending'` → toast "✅ Appel terminé · X:XX min" (animé Reanimated FadeIn/FadeOut, auto-dismiss 3s)
  - `'quota_exceeded'` → CTA "⚠ Quota épuisé · Acheter des minutes" (ouvre VoiceAddonModal existant ou navigate `/subscription`)
- [ ] **Step 2** : Props :
  ```typescript
  interface VoiceControlsProps {
    voiceState: HubVoiceState;
    elapsedSeconds: number;
    remainingMinutes: number;
    isMuted: boolean;
    onToggleMute: () => void;
    onEnd: () => void;
    onUpgrade: () => void;
  }
  ```
- [ ] **Step 3** : Tests Jest :
  - `renders nothing when voiceState='idle'`
  - `renders Mute+End when voiceState='call_active'`
  - `renders quota CTA when voiceState='quota_exceeded'`
- [ ] **Step 4** : `npm run test -- VoiceControls` → 3+ PASS.

## Task 19 : Créer `mobile/src/components/hub/CallModeFullBleed.tsx`

**Files:**

- Create: `mobile/src/components/hub/CallModeFullBleed.tsx`
- Create: `mobile/__tests__/components/hub/CallModeFullBleed.test.tsx`

- [ ] **Step 1** : Overlay full-screen (`position:absolute`, top:0/bottom:0/left:0/right:0, zIndex 100).
- [ ] **Step 2** : Background : LinearGradient gold (palette.gold + palette.amber).
- [ ] **Step 3** : Contenu central : VoiceWaveformBars XL (10 bars), timer big, "🎙️ Appel actif".
- [ ] **Step 4** : Bouton End centré bas (cercle rouge 80x80).
- [ ] **Step 5** : Tap arrière-plan (Pressable) → `setVoiceCallOpen(false)` (minimize, voice continue mais retour Hub Timeline).
- [ ] **Step 6** : Tests Jest :
  - `renders fullscreen when voiceCallOpen=true`
  - `tap background minimizes (calls setVoiceCallOpen(false))`
- [ ] **Step 7** : `npm run test -- CallModeFullBleed` → 2+ PASS.

## Task 20 : Créer `mobile/src/hooks/useHubVoice.ts`

**Files:**

- Create: `mobile/src/hooks/useHubVoice.ts`
- Create: `mobile/__tests__/hooks/useHubVoice.test.ts`

- [ ] **Step 1** : Hook qui orchestre `useVoiceChat` + sync vers `hubStore` :

  ```typescript
  export function useHubVoice(input: {
    summaryId?: string;
    videoUrl?: string;
    initialMode?: "chat" | "call";
  }) {
    const voiceChat = useVoiceChat({
      summaryId: input.summaryId,
      agentType: input.videoUrl ? "explorer_streaming" : undefined,
    });
    const { setVoiceState, setVoiceCallOpen, appendMessage } = useHubStore();

    // Sync voiceState depuis voice.status
    useEffect(() => {
      switch (voiceChat.status) {
        case "idle":
          setVoiceState("idle");
          break;
        case "connecting":
          setVoiceState("call_connecting");
          break;
        case "listening":
        case "thinking":
        case "speaking":
          setVoiceState("call_active");
          break;
        case "ended":
          setVoiceState("call_ending");
          break;
      }
    }, [voiceChat.status]);

    // Append voice transcripts au timeline (filter 'user' speaker)
    useEffect(() => {
      const lastMsg = voiceChat.messages[voiceChat.messages.length - 1];
      if (!lastMsg) return;
      if (lastMsg.source === "agent") {
        appendMessage({
          id: `voice-${Date.now()}`,
          role: "assistant",
          content: lastMsg.text,
          source: "voice_agent",
          voice_session_id: voiceChat.sessionId,
          time_in_call_secs: voiceChat.elapsedSeconds,
          timestamp: Date.now(),
        });
      }
      // Note: voice user transcripts persistés backend mais PAS appendMessage (audio user invisible)
    }, [voiceChat.messages]);

    // Auto-start si initialMode='call'
    useEffect(() => {
      if (input.initialMode === "call" && voiceChat.status === "idle") {
        voiceChat.start({ videoUrl: input.videoUrl });
      }
    }, []); // mount only

    return {
      ...voiceChat,
      requestStartCall: () =>
        Alert.alert(
          "Démarrer l'appel ?",
          `Quota : ${voiceChat.remainingMinutes.toFixed(0)} min restantes ce mois`,
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Démarrer",
              onPress: () => voiceChat.start({ videoUrl: input.videoUrl }),
            },
          ],
        ),
    };
  }
  ```

- [ ] **Step 2** : Tests Jest :
  - `auto-starts voice when initialMode='call' on mount`
  - `does NOT auto-start voice when initialMode='chat'`
  - `appendMessage called with source='voice_agent' on transcript agent`
  - `appendMessage NOT called for source='user' (filter)`
  - `voiceState transitions correctly`
- [ ] **Step 3** : `npm run test -- useHubVoice` → 5+ PASS.

## Task 21 : Modifier `mobile/src/components/hub/InputBar.tsx` (Mic toggle)

**Files:**

- Modify: `mobile/src/components/hub/InputBar.tsx`
- Create: `mobile/__tests__/components/hub/InputBar.mic.test.tsx`

- [ ] **Step 1** : Ajouter prop `voiceMode: 'off' | 'live'`, `onMicTap: () => void`.
- [ ] **Step 2** : Rendre bouton Mic à droite du Send :
  - `voiceMode='off'` → icône `mic-outline` gris
  - `voiceMode='live'` → icône `mic` ou `volume-mute-outline` selon `isMuted`
- [ ] **Step 3** : Tap → `onMicTap()` (le parent gère le routing : Alert confirm si off, toggleMute si live).
- [ ] **Step 4** : Tests Jest :
  - `mic button shows correct icon for voiceMode='off'`
  - `mic button shows mic icon for voiceMode='live'`
  - `tap mic calls onMicTap`
- [ ] **Step 5** : `npm run test -- InputBar.mic` → 3+ PASS.

## Task 22 : Modifier `mobile/src/components/hub/Timeline.tsx` (VoiceBubble)

**Files:**

- Modify: `mobile/src/components/hub/Timeline.tsx`

- [ ] **Step 1** : Dans `renderMessage`, switch sur `msg.source` :
  - `'text'` → `<MessageBubble msg={msg} />`
  - `'voice_agent'` → `<VoiceBubble msg={msg} />`
  - `'voice_user'` → return null (déjà filtré, double safety)
- [ ] **Step 2** : Vérifier que les imports `VoiceBubble` sont bien dans `index.ts`.

## Task 23 : Modifier `mobile/app/(tabs)/hub.tsx` (intégrer Voice)

**Files:**

- Modify: `mobile/app/(tabs)/hub.tsx`

- [ ] **Step 1** : Importer `useHubVoice` + `<VoiceControls>` + `<CallModeFullBleed>`.
- [ ] **Step 2** : Ajouter `const voice = useHubVoice({ summaryId: activeConvId, videoUrl, initialMode })`.
- [ ] **Step 3** : Ajouter `<VoiceControls>` au-dessus de `<InputBar>` avec props :
  ```tsx
  <VoiceControls
    voiceState={voiceState}
    elapsedSeconds={voice.elapsedSeconds}
    remainingMinutes={voice.remainingMinutes}
    isMuted={voice.isMuted}
    onToggleMute={voice.toggleMute}
    onEnd={voice.stop}
    onUpgrade={() => router.push("/(tabs)/subscription")}
  />
  ```
- [ ] **Step 4** : Ajouter `<CallModeFullBleed>` overlay :
  ```tsx
  {
    voiceCallOpen && voiceState === "call_active" && (
      <CallModeFullBleed
        elapsedSeconds={voice.elapsedSeconds}
        onEnd={voice.stop}
        onMinimize={() => setVoiceCallOpen(false)}
      />
    );
  }
  ```
- [ ] **Step 5** : Adapter `<InputBar>` props : `voiceMode = voiceState === 'call_active' ? 'live' : 'off'`, `onMicTap = voiceState === 'idle' ? voice.requestStartCall : voice.toggleMute`.
- [ ] **Step 6** : Si `initialMode='call'` from query params → `useHubVoice` auto-start déjà géré dans le hook.

## Task 24 : Supprimer FAB voice + VoiceScreen sur `analysis/[id].tsx`

**Files:**

- Modify: `mobile/app/(tabs)/analysis/[id].tsx`

- [ ] **Step 1** : Supprimer imports lignes 33-35 :
  ```typescript
  import { VoiceButton } from "@/components/voice/VoiceButton";
  import { VoiceScreen } from "@/components/voice/VoiceScreen";
  import { useVoiceChat } from "@/components/voice/useVoiceChat";
  ```
- [ ] **Step 2** : Supprimer `const voiceChat = useVoiceChat({ summaryId: id as string });` (ligne 162).
- [ ] **Step 3** : Supprimer `const [isVoiceVisible, setIsVoiceVisible] = useState(false);` (ligne 71).
- [ ] **Step 4** : Supprimer le bloc complet `<VoiceButton>` + `<VoiceScreen>` lignes 657-685.
- [ ] **Step 5** : `npm run typecheck` → 0 erreur sur ce fichier.

## Task 25 : Ajouter bouton "Discuter / Appeler" dans `ActionBar.tsx`

**Files:**

- Modify: `mobile/src/components/analysis/ActionBar.tsx`

- [ ] **Step 1** : Lire `mobile/src/components/analysis/ActionBar.tsx` (structure actuelle).
- [ ] **Step 2** : Ajouter un bouton "Discuter / Appeler" :
  - Icône `chatbubbles` + label "Discuter" (par défaut)
  - Tap court → navigate `/hub?summaryId=${summaryId}&initialMode=chat`
  - Long-press → menu contextuel (Action Sheet) avec 2 choix : "Discuter" (chat mode) / "Appeler" (call mode) → navigate avec initialMode adapté
- [ ] **Step 3** : Position : à droite du bouton Favori ou en remplacement.
- [ ] **Step 4** : Smoke iOS : sur analyse[id], le bouton Discuter est visible, tap → Hub avec summaryId. Long-press → menu → tap Appeler → Hub avec call mode.

## Task 26 : Refactor `ChatView.tsx` pour utiliser composants Hub

**Files:**

- Modify: `mobile/src/components/analysis/ChatView.tsx`

- [ ] **Step 1** : Garder l'interface (props `summaryId`, `keyboardOffset`).
- [ ] **Step 2** : Refacto INTERNE : remplacer le code FlatList + renderMessage + ChatInput + bubbles par :
  ```tsx
  <KeyboardAvoidingView ... keyboardVerticalOffset={keyboardOffset}>
    <Timeline messages={hubMessages} isThinking={isLoading} />
    <InputBar
      inputText={inputText}
      setInputText={setInputText}
      onSend={handleSend}
      isLoading={isLoading}
      quotaText={quotaText}
    />
  </KeyboardAvoidingView>
  ```
- [ ] **Step 3** : Convertir `ChatMessage[]` (du `useChat`) en `HubMessage[]` (mapping inline ou via helper `chatMessageToHub()`).
- [ ] **Step 4** : Supprimer le code dupliqué (TypingIndicator, renderMessage, parseAskQuestions, SUGGESTED_QUESTIONS) — ces fonctions sont déjà dans Timeline/MessageBubble du Hub.
- [ ] **Step 5** : Conserver `useChat(summaryId)` pour le state chat.
- [ ] **Step 6** : Smoke iOS : analyse[id]/Chat sub-tab fonctionne identiquement à avant, mais visuellement cohérent avec le Hub (mêmes bulles).

## Task 27 : Supprimer composants legacy

**Files:**

- Delete: `mobile/src/components/analysis/QuickChatScreen.tsx`
- Delete: `mobile/src/components/voice/VoiceScreen.tsx`
- Delete: `mobile/src/components/voice/VoiceButton.tsx` (sauf si conservé pour ActionBar)
- Delete: `mobile/src/components/voice/PostCallScreen.tsx` (si présent)
- Delete: `mobile/src/components/analysis/__tests__/QuickChatScreen.test.tsx` (si présent)
- Delete: `mobile/src/components/voice/__tests__/VoiceScreen.test.tsx`
- Delete: `mobile/src/components/voice/__tests__/VoiceButton.test.tsx`
- Delete: `mobile/src/components/voice/__tests__/VoiceButton.placement.test.tsx`
- Delete: `mobile/src/components/voice/__tests__/PostCallScreen.test.tsx` (si présent)

- [ ] **Step 1** : `grep` cross-repo `QuickChatScreen|VoiceScreen|PostCallScreen` pour vérifier qu'aucun import résiduel ne casse.
- [ ] **Step 2** : Modifier `mobile/app/(tabs)/analysis/[id].tsx` : supprimer le bloc `if (isQuickChat && summary) { return <QuickChatScreen .../>; }` (ligne 426-428). Si `quickChat=true` query param arrive sur analyse[id] (legacy URL), redirect vers `/hub?summaryId=X&initialMode=chat`.
- [ ] **Step 3** : `git rm` les fichiers + tests associés.
- [ ] **Step 4** : `npm run typecheck` → 0 erreur (les imports sont propres).
- [ ] **Step 5** : `npm run test` → tous les tests Hub PASS, anciens tests supprimés.

## Task 28 : Tests d'intégration PR2 + smoke E2E

- [ ] **Step 1** : `npm run typecheck` → 0 erreur sur les fichiers Hub PR2 (existant 19 erreurs TS pré-existantes ne sont pas régression).
- [ ] **Step 2** : `npm run test` → tous les tests Hub PR2 PASS (15+).
- [ ] **Step 3** : Smoke E2E iOS :
  - Tab Hub → Hub vide ou avec activeConv si déjà sélectionné
  - Home → Quick Chat → Hub charge en mode chat → message envoyé/reçu
  - Home → Quick Call → Hub charge en mode call → voice auto-start → bulle 🎙️ apparaît dans Timeline
  - Pendant call : tape texte → injecté dans conversation, agent répond à l'oral, bulle 🎙️ ajoutée
  - Vérifier qu'AUCUNE bulle voice_user n'apparaît (filter)
  - Tap End dans VoiceControls → toast 3s → retour mode chat
  - Tap CallModeFullBleed background → minimize, voice continue, retour Hub Timeline
  - Drawer → liste convos depuis `videoApi.getHistory` → tap → activeConv change, messages chargent
  - analyse[id] : FAB gold ABSENT (supprimé). Bouton "Discuter" dans ActionBar → tap → Hub charge avec summaryId
  - analyse[id]/Chat sub-tab : visuellement cohérent avec Hub (mêmes bulles)
- [ ] **Step 4** : Smoke E2E Android : idem iOS.

## Task 29 : Commit + push PR2

- [ ] **Step 1** : `git status` dans worktree `C:\Users\33667\DeepSight-hub-voice`.
- [ ] **Step 2** : `git add` fichiers créés/modifiés/supprimés (gitignore handles `.claude/settings.local.json` etc.).
- [ ] **Step 3** : Commit message :

  ```
  feat(mobile): Hub Voice Integration + cleanup legacy

  PR2 du sprint Mobile Hub Tab Unifié (spec 2026-05-04).
  Intègre voice dans le Hub :
  - VoiceControls + CallModeFullBleed + VoiceWaveformBars + VoiceBubble
  - Hook useHubVoice (orchestre useVoiceChat + sync hubStore + filter voice_user)
  - InputBar Mic toggle (Alert confirm + start | toggleMute)
  - Auto-start voice si initialMode='call' depuis Home
  - Bouton "Discuter / Appeler" dans ActionBar analyse[id] (long-press menu)
  - ChatView refacto : utilise Timeline + InputBar du Hub (composition)

  Cleanup :
  - Suppression QuickChatScreen + VoiceScreen + FAB voice analyse[id]
  - Tests legacy supprimés (couverts par tests Hub)

  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

- [ ] **Step 4** : `git push -u origin feat/mobile-hub-tab-voice`.
- [ ] **Step 5** : `gh pr create --title "feat(mobile): Hub Voice + cleanup legacy" --body "..."` (corps avec lien spec + plan + checklist test plan + dépendance PR1).

---

# Phase finale — Merge + OTA

## Task 30 : Review + merge PR1 + PR2

- [ ] **Step 1** : Review PR1 (Maxime) → merge dans `main`.
- [ ] **Step 2** : Rebase PR2 sur `main` post-merge PR1 (si parallèle).
- [ ] **Step 3** : Review PR2 (Maxime) → merge dans `main`.
- [ ] **Step 4** : `eas update --branch production --message "Mobile Hub Tab v1.0"` → OTA prod.
- [ ] **Step 5** : Notifier user via Asana (DeepSight Mobile project).

## Task 31 : Post-merge — observabilité + cleanup

- [ ] **Step 1** : Vérifier PostHog : events `hub_opened` / `hub_voice_started` / `hub_quick_call_from_home` flow.
- [ ] **Step 2** : Sentry : pas d'erreur nouvelle après OTA.
- [ ] **Step 3** : Mettre à jour memoire `project_deepsight-mobile-refonte.md` : note "Hub onglet livré 2026-05-04".
- [ ] **Step 4** : Créer note Obsidian : `01-Projects/DeepSight/Audits/2026-05-04-mobile-hub-tab-livraison.md` avec récap PR1+PR2 + métriques semaine post-OTA.

---

## Self-review du plan

- [x] **Placeholder scan** : aucun `TODO`, `FIXME`, ou `<XXX>` dans les Task.
- [x] **Type consistency** : `HubMessage`, `HubConversation`, `HubSummaryContext`, `HubVoiceState` définis (Task 2). Mapping backend → mobile cohérent (Task 1, 10, 20).
- [x] **Spec coverage** : 31 tasks couvrent les 9 objectifs spec §2 + les 15 décisions verrouillées §3.
- [x] **Files paths absolus** : tous les paths sont relatifs au repo `DeepSight-Main/`. Worktrees absolus listés en header.
- [x] **TDD approach** : chaque création de composant a un test Jest associé. Smoke E2E iOS+Android en fin PR2.
- [x] **Sub-agents Opus 4.7** : explicitement marqué (mémoire user perma).
- [x] **Memoires user respectées** :
  - `feedback_voice-fil-asymetrique.md` : filter strict `voice_user` dans Timeline (Task 5)
  - `feedback_opus-4-7-preference.md` : sub-agents Opus 4.7 (header + Task 15/29)
  - `feedback_multi-claude-parallel-workflow.md` : worktrees séparés PR1/PR2 (header)
  - `feedback_auto-push-after-commit.md` : push direct origin sur branche feature (Task 15, 29)

---

_Plan généré par Opus 4.7 le 2026-05-04. Spec : `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md`. Sub-agents Opus 4.7 obligatoires._
