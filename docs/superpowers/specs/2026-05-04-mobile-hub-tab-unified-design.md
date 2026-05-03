---
title: Mobile Hub Tab Unifié — Design
date: 2026-05-04
type: spec
tags:
  - projet/deepsight
  - type/spec
  - platform/mobile
status: draft
supersedes:
  - docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md (mobile portion only)
---

# Mobile Hub Tab Unifié — Design

**Date** : 2026-05-04
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — décisions architecturales verrouillées avec user 2026-05-04 via AskUserQuestion
**Plateforme ciblée** : Mobile (Expo SDK 54)
**Source d'inspiration** : `frontend/src/pages/HubPage.tsx` + `frontend/src/components/hub/*` (mirror direct)

---

## 1. Contexte et problème

### 1.1 État actuel mobile (vérifié 2026-05-04)

- **Pas d'onglet Hub** : `mobile/app/(tabs)/_layout.tsx` déclare 5 onglets (`index`, `library`, `study`, `profile`, `subscription`) + `analysis/[id]` caché. Aucun `hub.tsx`.
- **Quick Chat depuis Home** (`mobile/app/(tabs)/index.tsx:75-109`) : POST `/api/videos/quick-chat` → navigate `/(tabs)/analysis/[id]?quickChat=true` → rend `QuickChatScreen` plein écran.
- **`QuickChatScreen.tsx`** (`mobile/src/components/analysis/QuickChatScreen.tsx`) : chat texte uniquement, **AUCUN bouton voice**. Bug : l'utilisateur ne peut pas lancer un Quick Call sur la vidéo qu'il vient de coller.
- **Voice uniquement sur analyse complète** : `mobile/app/(tabs)/analysis/[id].tsx:657-685` rend `<VoiceButton>` + `<VoiceScreen>` Modal **uniquement si `summary` chargé ET pas en mode `quickChat`**. Le FAB gold n'apparaît donc qu'après une analyse complète terminée.
- **Pas de `ConversationScreen`** : le composant prévu par la spec `2026-05-02-quick-chat-call-unified-design.md` n'a jamais été créé. La spec est restée draft.
- **3 sub-tabs sur analyse[id]** : Résumé / Sources / Chat (PagerView). Chat = `ChatView.tsx` séparé.

### 1.2 Référence web (HubPage)

- **Route `/hub`** (`frontend/src/pages/HubPage.tsx`) : single page conversationnelle.
- **Composants `frontend/src/components/hub/*`** : `HubHeader`, `Timeline`, `MessageBubble`, `InputBar`, `ConversationsDrawer`, `SummaryCollapsible`, `VideoPiPPlayer`, `CallModeFullBleed`, `VoiceWaveformBars`, `VoiceBubble`.
- **State global** : `frontend/src/store/hubStore.ts` (Zustand + Immer), 19 slots (conversations, activeConvId, messages, summaryContext, drawerOpen, voiceCallOpen, pipExpanded, voiceState, etc.).
- **Backend déjà unifié** (PR #203 mergée) : `GET /api/chat/history/{summary_id}` retourne timeline mixte `text` + `voice_user` + `voice_agent` via colonnes `chat_messages.{source, voice_speaker, voice_session_id, time_in_call_secs}`.
- **Mapping HubMessage** : `source = "text" | "voice_user" | "voice_agent"` (aplati frontend depuis le couple backend `(source, voice_speaker)`).

### 1.3 Vision cible mobile

- **Onglet `/(tabs)/hub`** = **mirror direct du pattern HubPage web**, single screen avec drawer overlay liste convos, Timeline scrollable, InputBar bas, VoiceControls intégré, CallModeFullBleed overlay.
- **Quick Chat depuis Home** = navigate vers `/(tabs)/hub?videoUrl=X&initialMode=chat` (au lieu de `analysis/[id]?quickChat=true`).
- **Quick Call depuis Home** = nouveau bouton à côté de Quick Chat, navigate vers `/(tabs)/hub?videoUrl=X&initialMode=call`.
- **Suppression** : `QuickChatScreen.tsx`, `VoiceScreen.tsx`, FAB voice sur `analysis/[id].tsx`.
- **`analysis/[id]/Chat` sub-tab** : conservé mais refactorise `ChatView.tsx` pour réutiliser les composants Hub (`Timeline` + `InputBar` partagés) — code partagé, UX cohérente.
- **Audio user invisible** : règle UX permanente DeepSight, filtre dans `Timeline` (`source === "voice_user"` exclu).

---

## 2. Objectifs

1. **Hub mobile = onglet stable** : route `/(tabs)/hub` accessible depuis la TabBar (à côté de Home/Library/Study/Profile/Abo).
2. **Mirror direct web** : structure UI 1:1 avec `HubPage.tsx` (HubHeader / SummaryCollapsible / Timeline / InputBar / ConversationsDrawer / VideoPiPPlayer / CallModeFullBleed). Pas de réinvention.
3. **Quick Chat + Quick Call accessibles depuis Home** : 2 boutons à côté l'un de l'autre dans le bloc actuel "Quick Chat" → migrent vers Hub avec `initialMode` adapté.
4. **Fil unique mixté** : `HubMessage[]` triés par timestamp, bulles différenciées par `source` (text user/assistant, voice_agent avec badge 🎙️). `voice_user` exclu de l'affichage.
5. **State global Zustand** : `mobile/src/stores/hubStore.ts` mirror minimal du `frontend/src/store/hubStore.ts` (slots web non-pertinents pour mobile = supprimés : `fullSummary`, `concepts`, `reliability`, `activeTab`, `tabScrollPositions`).
6. **Suppression composants legacy** : `QuickChatScreen.tsx` + `VoiceScreen.tsx` + FAB voice analyse[id].
7. **`analysis/[id]/Chat` sub-tab refactor** : `ChatView.tsx` utilise `Timeline` + `InputBar` du Hub. Code partagé. **PAS de duplication des composants**.
8. **Backend zéro changement** : timeline déjà unifiée (PR #203). Sanity test pytest optionnel.
9. **Phasage 2 PRs parallèles** : PR1 Hub Foundation (sans voice) / PR2 Voice Integration + cleanup. 2 sub-agents Opus 4.7 dans worktrees séparés.

---

## 3. Décisions verrouillées (validées avec user 2026-05-04)

| #   | Décision                                  | Choix retenu                                                                                                          |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | Pattern Hub mobile                        | **Mirror direct web HubPage** (single screen + drawer overlay liste convos)                                           |
| 2   | Quick Call entry points                   | **Hub onglet (toujours)** + **Home onglet (Quick Call rapide)**. PAS de FAB analyse[id], PAS de Library long-press    |
| 3   | FAB voice gold sur `analysis/[id].tsx`    | **Supprimé**. Remplacé par bouton "Discuter / Appeler" dans `ActionBar` qui navigate vers `/hub?summaryId=X`          |
| 4   | Sub-tab Chat dans `analysis/[id].tsx`     | **Gardé mais réutilise composants Hub** (Timeline + InputBar partagés). Code partagé, UX cohérente                    |
| 5   | Phasage de livraison                      | **2 PRs parallèles** : PR1 Hub Foundation (sans voice) / PR2 Voice Integration + cleanup                              |
| 6   | Sub-agents implémentation                 | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`) — mémoire user perma                                                 |
| 7   | Worktrees                                 | `C:\Users\33667\DeepSight-hub-foundation` (PR1) + `C:\Users\33667\DeepSight-hub-voice` (PR2)                          |
| 8   | Branche                                   | `feat/mobile-hub-tab-foundation` (PR1) + `feat/mobile-hub-tab-voice` (PR2) depuis `origin/main`                       |
| 9   | Backend                                   | **Aucun changement**. Sanity test pytest optionnel sur `/api/chat/history/{id}` champs voice                          |
| 10  | `QuickChatScreen.tsx` + `VoiceScreen.tsx` | **Supprimés en PR2** (callsites migrés). Pas conservés en legacy                                                      |
| 11  | Audio user (voice_user) dans Timeline     | **Filtré côté UI** (mirror web : `m.source === "voice_user"` exclu de l'affichage). Persistance backend conservée     |
| 12  | Routing Expo Router                       | `/(tabs)/hub` index avec query params : `?videoUrl=X&initialMode=chat\|call&summaryId=Y&convId=Z`                     |
| 13  | TabBar order                              | Home / **Hub** / Library / Study / Profile / Abo (Hub en position 2, juste après Accueil)                             |
| 14  | Icône TabBar Hub                          | `chatbubbles-outline` / `chatbubbles` (Ionicons), label "Hub"                                                         |
| 15  | ConversationsDrawer pattern mobile        | **Bottom sheet** (`@gorhom/bottom-sheet`, déjà installé) au lieu de side drawer. Plus mobile-friendly que side drawer |

---

## 4. Architecture macro — Mobile

```
┌─ mobile/app/(tabs)/hub.tsx (NEW) ──────────────────────────────────────┐
│  Route Expo Router : /(tabs)/hub                                       │
│  Query params : ?videoUrl=X&initialMode=chat|call&summaryId=Y&convId=Z │
│                                                                        │
│  ┌── <HubHeader />                                                     │
│  │   - Bouton ☰ → toggle ConversationsDrawer (bottom sheet)           │
│  │   - Title (videoTitle ou "Hub")                                     │
│  │   - Subtitle (platform badge YT/TikTok)                             │
│  │   - VideoPiPPlayer slot (mini thumbnail vidéo si activeConv)       │
│  └──                                                                   │
│                                                                        │
│  ┌── <SummaryCollapsible /> (visible si summaryContext)                │
│  │   - Court résumé vidéo (≤200 char)                                  │
│  │   - Citations [timestamp_secs, label] cliquables                    │
│  └──                                                                   │
│                                                                        │
│  ┌── <Timeline />  (FlashList, scroll inverted)                        │
│  │   data = HubMessage[] (filter voice_user, trié par timestamp)       │
│  │   - <MessageBubble> user texte (right, indigo)                      │
│  │   - <MessageBubble> agent texte (left, card)                        │
│  │   - <MessageBubble> agent voice (left, card + 🎙️ badge)            │
│  │   - <VoiceBubble> avec waveform pendant call live                   │
│  │   - Empty state : "Pose ta première question…"                      │
│  │   - <ThinkingDots /> en bas si isThinking                           │
│  └──                                                                   │
│                                                                        │
│  ┌── <VoiceControls />  (PR2 — zone bas, fixe ~80dp)                   │
│  │   États : 'off' | 'live' | 'ended' | 'quota_exceeded'               │
│  │   - 'off' : zone discrète, pas affichée                             │
│  │   - 'live' : Mute + End + timer + waveform                          │
│  │   - 'ended' : toast 3s "✅ Appel terminé · X:XX"                    │
│  │   - 'quota_exceeded' : CTA "Acheter des minutes"                    │
│  └──                                                                   │
│                                                                        │
│  ┌── <InputBar />  (sticky bottom, au-dessus TabBar)                  │
│  │   - TextInput multiline (placeholder dynamique)                    │
│  │   - 📤 Send button                                                  │
│  │   - 🎙️ Mic toggle (PR2) :                                          │
│  │       voiceMode='off' → tap = Alert confirm + voice.start()         │
│  │       voiceMode='live' → tap = voice.toggleMute()                   │
│  │   - quota label                                                     │
│  └──                                                                   │
│                                                                        │
│  ┌── <ConversationsDrawer />  (BottomSheet, snapPoints ['25%','75%']) │
│  │   - Liste FlashList des conversations                               │
│  │   - Item : thumbnail + titre + timestamp + last_snippet            │
│  │   - Bouton "+ Nouvelle conversation" → focus URL input             │
│  │   - Tap item → setActiveConv(id)                                   │
│  └──                                                                   │
│                                                                        │
│  ┌── <CallModeFullBleed />  (PR2 — overlay full-screen pendant call)  │
│  │   - Visible si voiceCallOpen && voiceState='call_active'           │
│  │   - Background gradient gold + waveform fullscreen                 │
│  │   - Bouton End centré bas                                          │
│  │   - Tap arrière-plan → minimize (revient au Hub avec voice live)   │
│  └──                                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Composants à créer (PR1 — Foundation)

| Fichier                                             | Rôle                                                                  | Référence web                        |
| --------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| `mobile/app/(tabs)/hub.tsx`                         | Route Expo Router racine + orchestration                              | `pages/HubPage.tsx`                  |
| `mobile/src/components/hub/HubHeader.tsx`           | Header (menu drawer + title + PiP slot)                               | `components/hub/HubHeader`           |
| `mobile/src/components/hub/Timeline.tsx`            | FlashList inverted, filter voice_user, render MessageBubble           | `components/hub/Timeline`            |
| `mobile/src/components/hub/MessageBubble.tsx`       | Bulle user/agent texte/voice avec badge 🎙️                            | `components/hub/MessageBubble`       |
| `mobile/src/components/hub/InputBar.tsx`            | TextInput + Send (mic = PR2)                                          | `components/hub/InputBar`            |
| `mobile/src/components/hub/ConversationsDrawer.tsx` | BottomSheet liste convos                                              | `components/hub/ConversationsDrawer` |
| `mobile/src/components/hub/SummaryCollapsible.tsx`  | Card collapsible avec contexte vidéo + citations                      | `components/hub/SummaryCollapsible`  |
| `mobile/src/components/hub/VideoPiPPlayer.tsx`      | Mini thumbnail dans HubHeader                                         | `components/hub/VideoPiPPlayer`      |
| `mobile/src/components/hub/types.ts`                | `HubMessage`, `HubConversation`, `HubSummaryContext`, `HubVoiceState` | `components/hub/types.ts`            |
| `mobile/src/components/hub/index.ts`                | Barrel export                                                         | —                                    |
| `mobile/src/stores/hubStore.ts`                     | Zustand (Immer) — slots minimum (cf. §4.3)                            | `store/hubStore.ts`                  |
| `mobile/src/hooks/useHubData.ts`                    | Fetch conversations + messages quand activeConvId change              | (inline dans HubPage web)            |

### 4.2 Composants à créer (PR2 — Voice)

| Fichier                                           | Rôle                                                          | Référence web                      |
| ------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `mobile/src/components/hub/VoiceControls.tsx`     | Zone voice bas (off/live/ended/quota_exceeded)                | (split de `CallModeFullBleed`)     |
| `mobile/src/components/hub/CallModeFullBleed.tsx` | Overlay fullscreen pendant call active                        | `components/hub/CallModeFullBleed` |
| `mobile/src/components/hub/VoiceWaveformBars.tsx` | Barres de waveform animées Reanimated                         | `components/hub/VoiceWaveformBars` |
| `mobile/src/components/hub/VoiceBubble.tsx`       | Bulle voice agent avec waveform mini                          | `components/hub/VoiceBubble`       |
| `mobile/src/hooks/useHubVoice.ts`                 | Orchestre `useVoiceChat` + sync vers `hubStore.appendMessage` | (inline dans HubPage web)          |

### 4.3 Slot store minimal (mobile)

```typescript
// mobile/src/stores/hubStore.ts
interface HubState {
  // Données
  conversations: HubConversation[];
  activeConvId: number | null;
  messages: HubMessage[];
  summaryContext: HubSummaryContext | null;

  // UI state
  drawerOpen: boolean;
  summaryExpanded: boolean;
  pipExpanded: boolean;
  voiceCallOpen: boolean; // PR2
  voiceState: HubVoiceState; // PR2

  // Setters
  setConversations: (c: HubConversation[]) => void;
  setActiveConv: (id: number | null) => void;
  setMessages: (m: HubMessage[]) => void;
  appendMessage: (m: HubMessage) => void;
  setSummaryContext: (ctx: HubSummaryContext | null) => void;
  toggleDrawer: () => void;
  toggleSummary: () => void;
  setPipExpanded: (v: boolean) => void;
  setVoiceCallOpen: (v: boolean) => void; // PR2
  setVoiceState: (s: HubVoiceState) => void; // PR2
  reset: () => void;
}
```

**Slots web NON portés mobile (volontairement)** : `fullSummary`, `concepts`, `reliability`, `reliabilityLoading`, `newConvModalOpen`, `analyzingTaskId`, `activeTab`, `tabScrollPositions`. Raison : liés à l'`AnalysisHub` web qui n'a pas d'équivalent mobile (l'analyse mobile reste sur `analysis/[id].tsx` avec ses 3 sub-tabs).

### 4.4 Composants à modifier (PR1)

| Fichier                                             | Modification                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile/app/(tabs)/_layout.tsx`                     | Ajouter `<Tabs.Screen name="hub" options={{title:"Hub"}}/>` en position 2 (après index)                                                                                                                                                                                                        |
| `mobile/src/components/navigation/CustomTabBar.tsx` | Ajouter entrée `hub` dans `TAB_META` (icône `chatbubbles-outline`/`chatbubbles`, label "Hub")                                                                                                                                                                                                  |
| `mobile/src/types/index.ts`                         | Étendre `ChatMessage` : `source?: "text"\|"voice"`, `voice_speaker?: "user"\|"agent"\|null`, `voice_session_id?: string\|null`, `time_in_call_secs?: number\|null`                                                                                                                             |
| `mobile/src/services/api.ts`                        | Vérifier `chatApi.getHistory` mappe ces champs (passthrough). Si drop → fix.                                                                                                                                                                                                                   |
| `mobile/app/(tabs)/index.tsx` (Home)                | Bloc Quick Chat actuel : ajouter bouton **Quick Call** à côté du Send. Quick Chat URL → `router.push('/(tabs)/hub?videoUrl=X&initialMode=chat')`. Quick Call → `router.push('/(tabs)/hub?videoUrl=X&initialMode=call')`. Supprimer l'appel `videoApi.quickChat()` (déplacé dans Hub si besoin) |

### 4.5 Composants à modifier (PR2)

| Fichier                                        | Modification                                                                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mobile/src/components/hub/Timeline.tsx`       | Ajouter rendu `<VoiceBubble>` pour `source === "voice_agent"` avec waveform                                                                                                                                    |
| `mobile/src/components/hub/InputBar.tsx`       | Ajouter Mic toggle button : `voiceMode='off'` → Alert confirm + start ; `voiceMode='live'` → toggleMute                                                                                                        |
| `mobile/app/(tabs)/hub.tsx`                    | Intégrer `<VoiceControls>` + `<CallModeFullBleed>` + auto-start si `initialMode='call'`                                                                                                                        |
| `mobile/app/(tabs)/analysis/[id].tsx`          | Supprimer `<VoiceButton>` + `<VoiceScreen>` (lignes 657-685, ligne 33-34 imports). Supprimer `useVoiceChat({summaryId: id})` (ligne 162). Supprimer state `isVoiceVisible`                                     |
| `mobile/src/components/analysis/ActionBar.tsx` | Ajouter bouton "Discuter / Appeler" qui navigate vers `/hub?summaryId=X` (avec menu pour choisir mode chat ou call)                                                                                            |
| `mobile/src/components/analysis/ChatView.tsx`  | Refactor : utiliser `<Timeline>` + `<InputBar>` + `<MessageBubble>` du Hub. Supprimer code dupliqué (TypingIndicator, renderMessage, suggestions row). Conserver `useChat(summaryId)` + `keyboardOffset` props |
| `mobile/src/services/api.ts`                   | Ajouter `voiceApi.createSessionForHub({video_url, initialMode})` si pattern Hub Voice diffère (sinon réutiliser existant)                                                                                      |

### 4.6 Composants à supprimer (PR2)

- `mobile/src/components/analysis/QuickChatScreen.tsx` ❌ (callsites migrés vers Hub)
- `mobile/src/components/voice/VoiceScreen.tsx` ❌ (remplacé par `CallModeFullBleed` dans Hub)
- `mobile/src/components/voice/VoiceButton.tsx` ❌ ou conserver pour bouton dans ActionBar (à décider en PR2 review)
- `mobile/src/components/voice/PostCallScreen.tsx` ❌ (si encore présent, supprimer — déjà absent ?)
- Tests Jest associés : `__tests__/QuickChatScreen.test.tsx`, `__tests__/VoiceScreen.test.tsx`, `__tests__/VoiceButton.test.tsx`, `__tests__/VoiceButton.placement.test.tsx`, `__tests__/PostCallScreen.test.tsx`

### 4.7 Routing Expo Router — query params

```
/(tabs)/hub                                      → Hub vide (liste convos visible via drawer)
/(tabs)/hub?convId=42                           → Hub avec activeConv=42 (charge messages)
/(tabs)/hub?summaryId=42                        → Hub avec activeConv=summaryId (alias)
/(tabs)/hub?videoUrl=https://...&initialMode=chat → Hub Quick Chat sur vidéo fraîche
/(tabs)/hub?videoUrl=https://...&initialMode=call → Hub Quick Call sur vidéo fraîche
```

Logique mount dans `hub.tsx` :

1. Lit query params via `useLocalSearchParams()`
2. Si `convId` ou `summaryId` → `setActiveConv(Number(id))`
3. Si `videoUrl` + `initialMode` :
   - `'chat'` → POST `/api/videos/quick-chat` → setActiveConv(result.summary_id)
   - `'call'` → délégation à `useHubVoice.startWithVideoUrl(videoUrl)` (PR2)

### 4.8 Diagnostic Quick Call invisible (résolu par cette spec)

**Cause racine** : `mobile/app/(tabs)/analysis/[id].tsx:426-428` bypasse le rendu normal en mode `quickChat`, retournant `<QuickChatScreen>` qui n'a aucun bouton voice. Le FAB `<VoiceButton>` (lignes 657-685) n'est rendu qu'en mode analyse complète + `summary` chargé.

**Conséquence** : un utilisateur qui colle une URL dans Quick Chat sur Home ne voit JAMAIS le Quick Call sur cette vidéo. Il faut lancer une analyse complète (3-5 min de wait) pour voir le FAB gold.

**Fix** : la PR1 ajoute un bouton **Quick Call** dans le bloc Quick Chat de Home (à côté de Quick Chat). Tap = navigate `/hub?videoUrl=X&initialMode=call`. La PR2 implémente l'intégration voice dans le Hub. Le FAB sur analyse[id] est supprimé en PR2 et remplacé par un bouton "Discuter / Appeler" dans `ActionBar` qui ouvre le Hub.

---

## 5. Backend — aucun changement requis

**Constat** : la timeline chat + voice est **DÉJÀ unifiée backend** depuis PR #203 mergée 2026-04. Cf. spec `2026-05-02-quick-chat-call-unified-design.md` §6 pour détails complets :

- Table `chat_messages` (`backend/src/db/database.py`) : colonnes `source`, `voice_speaker`, `voice_session_id`, `time_in_call_secs`
- Endpoint `GET /api/chat/history/{summary_id}` (`backend/src/chat/router.py:397`) : retourne timeline mixte ordonnée
- Endpoint `POST /api/voice/transcripts/append` (`backend/src/voice/router.py:1927`) : persiste un tour voice
- Schéma Pydantic `ChatHistoryItem` (`backend/src/chat/schemas.py:106-110`) : expose tous les champs

**Sanity check optionnel** (~10 lignes pytest) : `backend/tests/chat/test_history_includes_voice_fields.py` pour empêcher régression silencieuse côté backend. Peut être inclus dans PR1 ou commit séparé.

---

## 6. Phasage — 2 PRs (parallélisables, validé user)

| PR  | Scope                                                                                                                                                                                                                                                                                                                                                               | Effort | Sub-agent | Worktree                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------- | ----------------------------------------- |
| PR1 | **Hub Foundation (sans voice)** : tab `/hub` + 12 composants (HubHeader, Timeline, MessageBubble, InputBar, ConversationsDrawer, SummaryCollapsible, VideoPiPPlayer, types, hubStore, useHubData) + extension `ChatMessage` mobile + Home boutons Quick Chat/Quick Call → navigate Hub + tests Jest                                                                 | 2j     | Agent A   | `C:\Users\33667\DeepSight-hub-foundation` |
| PR2 | **Voice Integration + Cleanup** : VoiceControls + CallModeFullBleed + VoiceWaveformBars + VoiceBubble + useHubVoice + Mic dans InputBar + auto-start initialMode='call' + bouton "Discuter/Appeler" dans ActionBar + ChatView refactor (réutilise Timeline+InputBar) + suppression QuickChatScreen + VoiceScreen + FAB analyse[id] + tests Jest + smoke iOS+Android | 2j     | Agent B   | `C:\Users\33667\DeepSight-hub-voice`      |

**Total** : ~4 jours Opus 4.7. Parallélisme via worktrees séparés. PR2 dépend logiquement de PR1 mais peut commencer en parallèle si Agent B mock les composants Hub manquants pendant PR1 en cours.

**Mémoires user à respecter** :

- `feedback_opus-4-7-preference.md` : Agent A et B doivent tourner en `claude-opus-4-7[1m]`
- `feedback_voice-fil-asymetrique.md` : audio user JAMAIS affiché dans Timeline (filter strict)
- `feedback_multi-claude-parallel-workflow.md` : worktrees séparés, sub-agents Opus 4.7

---

## 7. Risques et mitigations

| Risque                                                                                                              | Mitigation                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Composants Hub web utilisent Tailwind + Lucide icons → incompatibles RN                                             | Réécriture mobile native : `StyleSheet.create` + Ionicons. Le SOURCE de vérité est la **structure** (HubMessage, layout, behaviors), pas le code Tailwind/JSX.     |
| `chatApi.getHistory` mobile drop-t-il les champs `source/voice_speaker/voice_session_id/time_in_call_secs` ?        | Vérifier `mobile/src/services/api.ts` mapping. Test passthrough ajouté dans PR1.                                                                                   |
| Bouton Voice supprimé de analyse[id] : régression user ("où est passé le bouton gold ?")                            | Bouton "Discuter / Appeler" (avec menu chat/call) dans ActionBar = remplacement explicite. Smoke test iOS+Android validate.                                        |
| `QuickChatScreen` callsite Home : si Quick Chat URL fail backend → on ne peut plus retomber sur QuickChatScreen     | PR1 ne supprime pas encore QuickChatScreen. Suppression dans PR2 après validation que /hub avec videoUrl + chat marche bien.                                       |
| ConversationsDrawer en bottom sheet vs side drawer web : UX divergente                                              | Décision verrouillée (#15). BottomSheet est mobile-native (`@gorhom/bottom-sheet` déjà installé). Side drawer = anti-pattern mobile (TabBar bouffe l'espace).      |
| Sub-tab Chat dans analyse[id] partage Timeline + InputBar → bug couplage avec hubStore                              | `Timeline` + `InputBar` doivent rester pure components (props-driven). Ne PAS importer `useHubStore` directement dedans. Le Hub passe les props depuis `hub.tsx`.  |
| Auto-start voice en mode `initialMode='call'` consomme du quota sans confirmation                                   | Si `initialMode='call'` vient de Home (user a explicitement tapé "Quick Call") → start direct. Si autre source → garder Alert confirm. Décision verrouillable PR2. |
| Tests Jest existants `__tests__/QuickChatScreen.test.tsx`, `VoiceScreen.test.tsx`, `VoiceButton.placement.test.tsx` | Supprimés en PR2 (composants supprimés). Nouveaux tests Hub couvrent les mêmes scenarios.                                                                          |
| `analysis/[id]/Chat` sub-tab refactor casse le flow analyse                                                         | ChatView.tsx garde son interface (props `summaryId`, `keyboardOffset`). Refactor INTERNE uniquement (utilise Hub Timeline+InputBar en sous-composants). Tests E2E. |

---

## 8. Métriques de succès (PostHog)

- `hub_opened` (segmenté par source : `tabbar` | `home_quick_chat` | `home_quick_call` | `analysis_action_bar` | `library_card`)
- `hub_conversation_selected_from_drawer` (KPI engagement liste)
- `hub_message_sent_text` (segmenté par voiceMode au moment de l'envoi)
- `hub_message_received_voice_agent` (transcript ElevenLabs ajouté au fil)
- `hub_quick_call_from_home` (PR2 — bouton Quick Call sur Home)
- `hub_voice_started` / `hub_voice_ended` / `hub_voice_quota_exceeded`
- `hub_call_to_chat_dropped` (End pendant un call, retour fluide vers mode chat)
- **KPI primary** : `hub_opened` / `app_session_started` ratio. Si > 50%, le Hub est devenu le centre de gravité (succès).

---

## 9. Tests

### 9.1 PR1 — Mobile (Jest)

- `mobile/__tests__/stores/hubStore.test.ts` : mutations setConversations, setActiveConv (vide messages), appendMessage, toggleDrawer, reset
- `mobile/__tests__/components/hub/Timeline.test.tsx` :
  - `renders empty state when messages.length === 0`
  - `excludes voice_user messages from display (audio user invisible rule)`
  - `renders bubble user texte right-aligned`
  - `renders bubble agent texte left-aligned with markdown`
  - `renders thinking dots when isThinking=true`
- `mobile/__tests__/components/hub/MessageBubble.test.tsx` :
  - `user text bubble`
  - `assistant text bubble with markdown`
  - `assistant voice_agent bubble with 🎙️ badge`
- `mobile/__tests__/components/hub/ConversationsDrawer.test.tsx` :
  - `renders FlashList of conversations`
  - `tap item calls setActiveConv with correct id`
  - `bottom sheet snapPoints correct`
- `mobile/__tests__/services/chatApi.test.ts` (passthrough fields) :
  - `chatApi.getHistory returns source/voice_speaker/voice_session_id/time_in_call_secs unchanged`

### 9.2 PR2 — Mobile (Jest)

- `mobile/__tests__/hooks/useHubVoice.test.ts` :
  - `auto-starts voice when initialMode='call' on mount`
  - `does NOT auto-start voice when initialMode='chat'`
  - `appendMessage called with source='voice_agent' on transcript`
  - `transitions voiceState idle → connecting → call_active → call_ending → idle on hangup`
  - `voiceCallOpen toggles correctly`
- `mobile/__tests__/components/hub/VoiceControls.test.tsx` :
  - `renders nothing when voiceState='idle'`
  - `renders Mute+End when voiceState='call_active'`
  - `renders quota_exceeded CTA when voice quota=0`
- `mobile/__tests__/components/hub/CallModeFullBleed.test.tsx` :
  - `renders fullscreen when voiceCallOpen=true`
  - `tap background minimizes (sets voiceCallOpen=false)`
- `mobile/__tests__/components/hub/InputBar.test.tsx` (mic toggle) :
  - `mic button shows confirm dialog when voiceMode='off'`
  - `mic button toggles mute when voiceMode='live'`
- Tests existants supprimés : `QuickChatScreen.test.tsx`, `VoiceScreen.test.tsx`, `VoiceButton.test.tsx`, `VoiceButton.placement.test.tsx`, `PostCallScreen.test.tsx` (si présent)

### 9.3 Smoke E2E manuel (PR2)

**iOS + Android** :

1. Tab "Hub" depuis TabBar → Hub vide, drawer ouvre via menu ☰
2. Home → tap "Quick Chat" + URL → navigate Hub mode chat → message envoyé/reçu OK
3. Home → tap "Quick Call" + URL → navigate Hub mode call → voice auto-start → bulle 🎙️ apparaît
4. Pendant call : tape un message texte → injecté dans conversation, agent répond à l'oral
5. Tap End → toast "✅ Appel terminé" 3s → retour mode chat
6. Drawer → tap conversation → activeConv change, messages chargent
7. analyse[id] → tap "Discuter / Appeler" dans ActionBar → menu choix → navigate Hub avec summaryId
8. Vérifier que FAB gold ABSENT sur analyse[id] (supprimé en PR2)
9. analyse[id]/Chat sub-tab → vérifier que ChatView utilise Timeline+InputBar refactorisé (visuellement cohérent avec Hub)
10. Long session : vérifier persistance bottomSheet/drawer state, scroll position Timeline

---

## 10. Décisions ouvertes (à valider en review PR1/PR2)

| #   | Décision                                                                            | Défaut proposé                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Auto-start voice si `initialMode='call'` depuis Home : confirm dialog ou direct ?   | **Direct** (le user a explicitement tapé "Quick Call" sur Home, l'intention est claire). Confirm dialog garde sa place uniquement pour toggle Mic depuis chat. |
| 2   | Bouton "Discuter / Appeler" dans ActionBar : 2 boutons séparés ou 1 menu ?          | **1 bouton avec long-press menu** : tap = chat (default), long-press = menu choix [Chat / Call]. Économise l'espace dans ActionBar.                            |
| 3   | `VoiceButton.tsx` (existant) : conserver pour ActionBar ou supprimer complètement ? | **Supprimer** et créer un bouton inline simple dans ActionBar (pas de FAB). Le pattern FAB n'est plus utilisé.                                                 |
| 4   | Hub vide sans activeConv : afficher CTA "Coller URL" ou ouvrir drawer auto ?        | **CTA "Coller URL ou choisir une conversation"** + bouton ouvrir drawer. Empty state explicite, pas de drawer auto-open intrusif.                              |
| 5   | Persistance `hubStore` (Zustand) : in-memory ou avec `persist` middleware ?         | **In-memory** pour PR1. Activer `persist` (AsyncStorage) en PR3 si UX demande "rouvrir l'app sur la dernière conversation". Out-of-scope PR1+PR2.              |

---

## 11. Lien avec specs antérieures

- **Supersedes (mobile portion)** : `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md` — la partie mobile (Modal `ConversationScreen`) est REMPLACÉE par cette spec (onglet Hub stable). La partie extension reste valide et hors-scope ici.
- **Référence implémentation** : `frontend/src/pages/HubPage.tsx` + `frontend/src/components/hub/*` + `frontend/src/store/hubStore.ts` (mirror direct).
- **Étend** : `docs/superpowers/specs/2026-04-26-quick-voice-call-design.md` (V1 extension, mergée PR #149)
- **Cohérent avec** : `docs/superpowers/specs/2026-04-29-merge-voice-chat-context-design.md` (Agent context bidirectionnel)

---

_Spec produite en mode brainstorming Superpowers (Opus 4.7). Décisions verrouillées avec user 2026-05-04 via AskUserQuestion. Plan d'implémentation : `docs/superpowers/plans/2026-05-04-mobile-hub-tab-unified.md`._
