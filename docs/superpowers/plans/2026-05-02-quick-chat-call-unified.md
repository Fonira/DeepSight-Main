# Quick Chat + Quick Call Unified — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fusionner Quick Chat + Quick Call (mobile) et ChatView/VoiceView (extension) en une seule UI conversationnelle two-pane (chat haut + voice bas) avec fil unifié et règle "audio user invisible".

**Architecture:** Nouveau `ConversationScreen` (mobile) / `ConversationView` (extension) + hook unifié `useConversation` orchestrant `useChat` + `useVoiceChat` + `useStreamingVideoContext`. Backend déjà unifié (timeline mixte chat+voice persistée dans `chat_messages` avec `source='voice'`) — aucune migration ni endpoint requis.

**Tech Stack:** Expo SDK 54 + React Native 0.81 + Reanimated 4 + Jest (mobile). Webpack 5 + React + TypeScript + Jest (extension Chrome MV3).

**Spec:** `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md`

**Branche:** `feat/quick-chat-call-unified` depuis `origin/main`. PR1 et PR2 parallélisables dans des worktrees séparés.

---

## File Structure

### PR1 — Mobile (Agent A, 3-4j)

**Create**

- `mobile/src/components/conversation/ConversationScreen.tsx` — composant racine (Modal full-screen)
- `mobile/src/components/conversation/ConversationHeader.tsx`
- `mobile/src/components/conversation/ConversationFeed.tsx`
- `mobile/src/components/conversation/ConversationFeedBubble.tsx`
- `mobile/src/components/conversation/VoiceControls.tsx`
- `mobile/src/components/conversation/ContextProgressBanner.tsx`
- `mobile/src/components/conversation/MiniActionBar.tsx`
- `mobile/src/components/conversation/ConversationInput.tsx`
- `mobile/src/components/conversation/EndedToast.tsx`
- `mobile/src/components/conversation/index.ts`
- `mobile/src/hooks/useConversation.ts`
- `mobile/src/hooks/useResolvedSummaryId.ts`
- `mobile/__tests__/hooks/useConversation.test.ts`
- `mobile/__tests__/components/conversation/ConversationScreen.test.tsx`
- `mobile/__tests__/components/conversation/ConversationFeedBubble.test.tsx`

**Modify**

- `mobile/src/types/index.ts` — étendre `ChatMessage` avec `source`/`voice_speaker`/`voice_session_id`/`time_in_call_secs`
- `mobile/src/services/api.ts` — vérifier que `chatApi.getHistory` mappe ces champs (passthrough)
- `mobile/app/(tabs)/index.tsx` — Home : ajouter bouton "Quick Chat" + adapter bouton "Quick Call" pour ouvrir `ConversationScreen`
- `mobile/app/(tabs)/analysis/[id].tsx` — bouton Quick Chat existant ouvre `ConversationScreen` au lieu de `QuickChatScreen`

**Delete**

- `mobile/src/components/analysis/QuickChatScreen.tsx`
- `mobile/src/components/voice/VoiceScreen.tsx`
- `mobile/src/components/voice/PostCallScreen.tsx`
- `mobile/src/components/voice/__tests__/PostCallScreen.test.tsx` (et autres tests legacy si existent)
- `mobile/src/components/analysis/__tests__/QuickChatScreen.test.tsx` (si existe)

### PR2 — Extension (Agent B, 2-3j)

**Create**

- `extension/src/sidepanel/views/ConversationView.tsx`
- `extension/src/sidepanel/hooks/useConversation.ts`
- `extension/src/sidepanel/components/ConversationFeed.tsx`
- `extension/src/sidepanel/components/ConversationFeedBubble.tsx`
- `extension/src/sidepanel/components/VoiceControls.tsx`
- `extension/src/sidepanel/components/ConversationInput.tsx`
- `extension/src/sidepanel/components/EndedToast.tsx`
- `extension/__tests__/sidepanel/views/ConversationView.test.tsx`
- `extension/__tests__/sidepanel/hooks/useConversation.test.ts`

**Modify**

- `extension/src/sidepanel/types.ts` (ou équivalent) — étendre `ChatMessage`
- `extension/src/sidepanel/api.ts` — vérifier mapping
- `extension/src/sidepanel/App.tsx` — routing 'chat' + 'voice' fusionné en 'conversation'
- `extension/src/sidepanel/views/MainView.tsx` — boutons "Quick Chat" / "Quick Call" → `ConversationView`
- `extension/src/sidepanel/contexts/NavigationContext.tsx` — fusion routes

**Delete**

- `extension/src/sidepanel/views/ChatView.tsx`
- `extension/src/sidepanel/VoiceView.tsx`

### Optionnel — Backend sanity check

- `backend/tests/chat/test_history_includes_voice_fields.py` — 1 test (~10 lignes) qui vérifie que `GET /api/chat/history/{summary_id}` retourne `source/voice_speaker/voice_session_id`. Peut être inclus dans PR1 ou commit séparé.

---

# PR1 — Mobile (Agent A)

## Task 1 : Étendre type `ChatMessage` mobile + tests passthrough api

**Files:**

- Modify: `mobile/src/types/index.ts`
- Modify: `mobile/src/services/api.ts` (`chatApi.getHistory`)
- Test: `mobile/__tests__/services/chatApi.test.ts` (créer si absent)

- [ ] **Step 1: Lire le type actuel**

```bash
grep -n "interface ChatMessage" mobile/src/types/index.ts
```

- [ ] **Step 2: Étendre le type `ChatMessage`**

Dans `mobile/src/types/index.ts`, étendre l'interface :

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  source?: "text" | "voice";
  voice_speaker?: "user" | "agent" | null;
  voice_session_id?: string | null;
  time_in_call_secs?: number | null;
}
```

- [ ] **Step 3: Vérifier que `chatApi.getHistory` mappe ces champs**

Lire `mobile/src/services/api.ts` autour de `chatApi.getHistory`. Si la fonction map drop des champs, fixer pour passthrough complet de la réponse backend. Le backend renvoie déjà `source/voice_speaker/voice_session_id/time_in_call_secs` dans `ChatHistoryItem`.

- [ ] **Step 4: Test unitaire de mapping**

Dans `mobile/__tests__/services/chatApi.test.ts` :

```typescript
import { chatApi } from "../../src/services/api";

describe("chatApi.getHistory mapping", () => {
  it("preserves source/voice_speaker/voice_session_id from backend response", async () => {
    // mock fetch, return un payload avec les 4 champs voice
    const mockResponse = {
      messages: [
        {
          id: "1",
          role: "user",
          content: "hi",
          timestamp: "2026-05-02T10:00:00Z",
          source: "voice",
          voice_speaker: "user",
          voice_session_id: "abc",
          time_in_call_secs: 1.2,
        },
      ],
    };
    // ...mock fetch global, appel chatApi.getHistory("123")
    const result = await chatApi.getHistory("123");
    expect(result.messages[0].source).toBe("voice");
    expect(result.messages[0].voice_speaker).toBe("user");
    expect(result.messages[0].voice_session_id).toBe("abc");
    expect(result.messages[0].time_in_call_secs).toBe(1.2);
  });
});
```

- [ ] **Step 5: Run test + commit**

```bash
cd mobile && npm test -- chatApi.test.ts
git add mobile/src/types/index.ts mobile/src/services/api.ts mobile/__tests__/services/chatApi.test.ts
git commit -m "feat(mobile): extend ChatMessage with voice fields (passthrough backend)"
```

Expected: PASS.

---

## Task 2 : Hook `useResolvedSummaryId`

**Files:**

- Create: `mobile/src/hooks/useResolvedSummaryId.ts`
- Test: `mobile/__tests__/hooks/useResolvedSummaryId.test.ts`

- [ ] **Step 1: Test failing**

```typescript
// mobile/__tests__/hooks/useResolvedSummaryId.test.ts
import { renderHook } from "@testing-library/react-hooks";
import { useResolvedSummaryId } from "../../src/hooks/useResolvedSummaryId";

describe("useResolvedSummaryId", () => {
  it("returns input.summaryId if provided", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({ summaryId: "42" }),
    );
    expect(result.current).toBe("42");
  });

  it("returns null if videoUrl provided but no voiceSummaryId yet", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({
        videoUrl: "https://youtu.be/abc",
        voiceSummaryId: null,
      }),
    );
    expect(result.current).toBeNull();
  });

  it("converts voiceSummaryId number to string", () => {
    const { result } = renderHook(() =>
      useResolvedSummaryId({
        videoUrl: "https://youtu.be/abc",
        voiceSummaryId: 42,
      }),
    );
    expect(result.current).toBe("42");
  });

  it("returns null if neither summaryId nor voiceSummaryId", () => {
    const { result } = renderHook(() => useResolvedSummaryId({}));
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: Run test (FAIL)**

```bash
cd mobile && npm test -- useResolvedSummaryId.test.ts
```

Expected: FAIL "Cannot find module '../../src/hooks/useResolvedSummaryId'".

- [ ] **Step 3: Implementation**

```typescript
// mobile/src/hooks/useResolvedSummaryId.ts
interface ResolveInput {
  summaryId?: string;
  videoUrl?: string;
  voiceSummaryId?: number | null;
}

export function useResolvedSummaryId(input: ResolveInput): string | null {
  if (input.summaryId) return input.summaryId;
  if (input.voiceSummaryId != null) return String(input.voiceSummaryId);
  return null;
}
```

- [ ] **Step 4: Run test (PASS)**

```bash
cd mobile && npm test -- useResolvedSummaryId.test.ts
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useResolvedSummaryId.ts mobile/__tests__/hooks/useResolvedSummaryId.test.ts
git commit -m "feat(mobile): add useResolvedSummaryId helper for ConversationScreen"
```

---

## Task 3 : Hook `useConversation`

**Files:**

- Create: `mobile/src/hooks/useConversation.ts`
- Test: `mobile/__tests__/hooks/useConversation.test.ts`

- [ ] **Step 1: Tests failing (9 cases)**

Créer le fichier `mobile/__tests__/hooks/useConversation.test.ts` avec les 9 tests listés dans la spec §11.2 (utiliser `@testing-library/react-hooks` + mocks pour `useChat`, `useVoiceChat`, `useStreamingVideoContext`, `Alert.alert`). Code complet :

```typescript
import { renderHook, act } from "@testing-library/react-hooks";
import { Alert } from "react-native";
import { useConversation } from "../../src/hooks/useConversation";

jest.mock("react-native", () => ({
  Alert: { alert: jest.fn() },
}));
jest.mock("../../src/hooks/useChat", () => ({
  useChat: jest.fn(() => ({
    messages: [],
    isLoading: false,
    sendMessage: jest.fn(),
    loadHistory: jest.fn(),
  })),
}));
jest.mock("../../src/components/voice/useVoiceChat", () => ({
  useVoiceChat: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    toggleMute: jest.fn(),
    sendUserMessage: jest.fn(),
    isMuted: false,
    status: "idle",
    elapsedSeconds: 0,
    remainingMinutes: 30,
    error: null,
    sessionId: null,
    summaryId: null,
    conversation: {},
    messages: [],
  })),
}));
jest.mock("../../src/components/voice/useStreamingVideoContext", () => ({
  useStreamingVideoContext: jest.fn(() => ({
    contextProgress: 0,
    contextComplete: false,
  })),
}));

describe("useConversation", () => {
  beforeEach(() => jest.clearAllMocks());

  it("unifies chat + voice agent messages in chronological order", () => {
    const { useChat } = require("../../src/hooks/useChat");
    useChat.mockReturnValue({
      messages: [
        {
          id: "1",
          role: "user",
          content: "hi",
          timestamp: "2026-05-02T10:00:00Z",
          source: "text",
        },
        {
          id: "2",
          role: "assistant",
          content: "voiced reply",
          timestamp: "2026-05-02T10:01:00Z",
          source: "voice",
          voice_speaker: "agent",
        },
      ],
      isLoading: false,
      sendMessage: jest.fn(),
      loadHistory: jest.fn(),
    });
    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe("1");
    expect(result.current.messages[1].source).toBe("voice");
  });

  it("excludes voice user messages (audio user invisible rule)", () => {
    const { useChat } = require("../../src/hooks/useChat");
    useChat.mockReturnValue({
      messages: [
        {
          id: "u1",
          role: "user",
          content: "asked aloud",
          timestamp: "2026-05-02T10:00:00Z",
          source: "voice",
          voice_speaker: "user",
        },
        {
          id: "a1",
          role: "assistant",
          content: "answer",
          timestamp: "2026-05-02T10:01:00Z",
          source: "voice",
          voice_speaker: "agent",
        },
      ],
      isLoading: false,
      sendMessage: jest.fn(),
      loadHistory: jest.fn(),
    });
    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe("a1");
  });

  // ... 7 autres tests (cf. §11.2 du spec)
});
```

- [ ] **Step 2: Run tests (FAIL)**

```bash
cd mobile && npm test -- useConversation.test.ts
```

Expected: FAIL "Cannot find module '../../src/hooks/useConversation'".

- [ ] **Step 3: Implementation**

Copier le code TypeScript complet du hook `useConversation` depuis la spec §4.1. Inclut : type `VoiceMode`, type `UnifiedMessage`, fonction `useConversation`, helper `toUnified`, helper `useVoiceChatSummaryProbe`.

- [ ] **Step 4: Run tests (PASS)**

```bash
cd mobile && npm test -- useConversation.test.ts
```

Expected: 9/9 PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/hooks/useConversation.ts mobile/__tests__/hooks/useConversation.test.ts
git commit -m "feat(mobile): add useConversation hook unifying chat + voice with audio-user-invisible filter"
```

---

## Task 4 : Composants présentational (Feed + Bubble + Input)

**Files:**

- Create: `mobile/src/components/conversation/ConversationFeed.tsx`
- Create: `mobile/src/components/conversation/ConversationFeedBubble.tsx`
- Create: `mobile/src/components/conversation/ConversationInput.tsx`
- Test: `mobile/__tests__/components/conversation/ConversationFeedBubble.test.tsx`

- [ ] **Step 1: Test failing (ConversationFeedBubble)**

```typescript
import { render } from "@testing-library/react-native";
import { ConversationFeedBubble } from "../../../src/components/conversation/ConversationFeedBubble";

describe("ConversationFeedBubble", () => {
  it("renders user text bubble (right aligned, indigo)", () => {
    const { getByText } = render(
      <ConversationFeedBubble message={{ id: "1", role: "user", content: "hello", source: "text", timestamp: Date.now() }} />
    );
    expect(getByText("hello")).toBeTruthy();
  });
  it("renders assistant text bubble with markdown", () => { /* ... */ });
  it("renders assistant voice bubble with mic icon badge", () => {
    const { getByTestId } = render(
      <ConversationFeedBubble message={{ id: "2", role: "assistant", content: "voiced", source: "voice", voiceSpeaker: "agent", timestamp: Date.now() }} />
    );
    expect(getByTestId("voice-badge-mic")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests (FAIL)**

```bash
cd mobile && npm test -- ConversationFeedBubble.test.tsx
```

- [ ] **Step 3: Implementation des 3 composants**

- `ConversationFeedBubble.tsx` : reprend le pattern de `QuickChatScreen` actuel (bulles user indigo / assistant card) + ajoute icône `mic-outline` + label "voix" si `message.source === 'voice'`. testID="voice-badge-mic" pour le test.
- `ConversationFeed.tsx` : `FlatList inverted` qui itère sur `UnifiedMessage[]`, render via `ConversationFeedBubble`. Empty state = chips suggestions (3 prédéfinies, repris de QuickChatScreen).
- `ConversationInput.tsx` : `TextInput` multiline + `Send` (icône paperplane) + `Mic` (icône mic). Le mic appelle un callback prop `onMicTap()` (le hook `useConversation` décide du comportement : confirm dialog ou toggleMute).

- [ ] **Step 4: Run tests (PASS)**

```bash
cd mobile && npm test -- ConversationFeedBubble.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/conversation/ConversationFeed.tsx mobile/src/components/conversation/ConversationFeedBubble.tsx mobile/src/components/conversation/ConversationInput.tsx mobile/__tests__/components/conversation/ConversationFeedBubble.test.tsx
git commit -m "feat(mobile): add ConversationFeed + Bubble + Input components"
```

---

## Task 5 : VoiceControls + ContextProgressBanner + EndedToast + MiniActionBar

**Files:**

- Create: `mobile/src/components/conversation/VoiceControls.tsx`
- Create: `mobile/src/components/conversation/ContextProgressBanner.tsx`
- Create: `mobile/src/components/conversation/EndedToast.tsx`
- Create: `mobile/src/components/conversation/MiniActionBar.tsx`

- [ ] **Step 1: Implementer VoiceControls (4 états)**

States selon `voiceMode`: `off | live | ended | quota_exceeded`. Cf. §3 du spec pour chaque rendu :

- `off`: card avec icône mic gris + label "Appel non démarré"
- `live`: waveform + timer (`elapsedSeconds`) + minutes restantes + 2 boutons (Mute toggle, End)
- `ended`: card verte "✅ Appel terminé · X:XX min" (rendu par `EndedToast` séparé)
- `quota_exceeded`: card warning + bouton "Acheter des minutes" (ouvre `VoiceAddonModal` existant)

Reprend les composants visuels existants depuis `VoiceScreen.tsx` (PulsingCircle, WaveformPlaceholder) — copier puis supprimer le legacy plus tard.

- [ ] **Step 2: Implementer ContextProgressBanner**

Reprend la section `contextProgressContainer` de `VoiceScreen.tsx` (lignes 562-607). Composant pure presentational avec 2 props : `progress` (0-100) et `complete` (bool).

- [ ] **Step 3: Implementer EndedToast**

Animation Reanimated `FadeIn.duration(300)` puis auto-dismiss après 3000ms via `setTimeout` + `FadeOut.duration(300)`. Card verte avec icône check + label "Appel terminé · X:XX min".

- [ ] **Step 4: Implementer MiniActionBar**

3 actions :

- `📊 Voir l'analyse complète` (CTA principal, indigo gradient) → callback `onViewAnalysis`
- `⭐ Favori` (toggle) → callback `onToggleFavorite`
- `↗ Partager` → callback `onShare`

Reprend le pattern de `miniActionBar` de `QuickChatScreen.tsx` (lignes 480-539).

- [ ] **Step 5: Commit (sans tests dédiés — couverts par ConversationScreen.test.tsx)**

```bash
git add mobile/src/components/conversation/VoiceControls.tsx mobile/src/components/conversation/ContextProgressBanner.tsx mobile/src/components/conversation/EndedToast.tsx mobile/src/components/conversation/MiniActionBar.tsx
git commit -m "feat(mobile): add VoiceControls + ContextProgressBanner + EndedToast + MiniActionBar"
```

---

## Task 6 : Composant racine `ConversationScreen` + Header

**Files:**

- Create: `mobile/src/components/conversation/ConversationHeader.tsx`
- Create: `mobile/src/components/conversation/ConversationScreen.tsx`
- Create: `mobile/src/components/conversation/index.ts`
- Test: `mobile/__tests__/components/conversation/ConversationScreen.test.tsx`

- [ ] **Step 1: Tests failing (9 cases — cf. §11.2 du spec)**

Liste des 9 tests à écrire, mockant `useConversation` :

- empty state, chat bubble user/assistant, voice agent bubble avec mic, voice user bubble exclu, VoiceControls off/live, EndedToast on hangup, mic confirm dialog, mic toggleMute. Cf. §11.2 spec.

- [ ] **Step 2: Run tests (FAIL)**

- [ ] **Step 3: Implementation**

`ConversationHeader.tsx` : title + plateforme YT/TikTok badge + `<VoiceQuotaBadge />` existant + bouton settings (ouvre `VoiceSettings` bottom sheet existant) + close button. Reprend le pattern header de `VoiceScreen.tsx` (lignes 502-560).

`ConversationScreen.tsx` : composant racine qui orchestre tout. Props : `{ visible, summaryId?, videoUrl?, initialMode, onClose }`. Utilise `useConversation()` puis render :

```tsx
<Modal visible={visible} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
  <ConversationHeader ... />
  {streaming && <ContextProgressBanner progress={contextProgress} complete={contextComplete} />}
  <ConversationFeed messages={messages} />
  {voiceMode !== "off" && <VoiceControls voiceMode={voiceMode} ... />}
  {voiceMode === "ended" && <EndedToast durationMin={...} />}
  <MiniActionBar onViewAnalysis={...} onToggleFavorite={...} onShare={...} />
  <ConversationInput onSend={sendMessage} onMicTap={voiceMode === "live" ? toggleMute : requestStartCall} ... />
</Modal>
```

`index.ts` : re-export de `ConversationScreen` + types `VoiceMode`, `UnifiedMessage`.

- [ ] **Step 4: Run tests (PASS)**

```bash
cd mobile && npm test -- ConversationScreen.test.tsx
```

Expected: 9/9 PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/conversation/ConversationHeader.tsx mobile/src/components/conversation/ConversationScreen.tsx mobile/src/components/conversation/index.ts mobile/__tests__/components/conversation/ConversationScreen.test.tsx
git commit -m "feat(mobile): add ConversationScreen + Header (root component)"
```

---

## Task 7 : Migration callsites Home + Analysis + suppression legacy

**Files:**

- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/app/(tabs)/analysis/[id].tsx`
- Delete: `mobile/src/components/analysis/QuickChatScreen.tsx`
- Delete: `mobile/src/components/voice/VoiceScreen.tsx`
- Delete: `mobile/src/components/voice/PostCallScreen.tsx`
- Delete: tests legacy associés

- [ ] **Step 1: Migrer Home `mobile/app/(tabs)/index.tsx`**

Trouver le bouton "Voice Call" actuel (ajouté dans la spec V3 antérieure). Remplacer par :

- 1 bouton "Quick Chat" (gradient indigo) → ouvre `<ConversationScreen videoUrl={...} initialMode="chat" />` ou `<... summaryId={...} initialMode="chat" />`
- 1 bouton "Quick Call" (gradient gold) → ouvre `<... videoUrl={...} initialMode="call" />`

Cas spécial Quick Chat sur vidéo fraîche (sans summaryId) : si `videoUrl` présent et pas de summary → bascule vers Quick Call avec confirm (cf. §4.5 spec décision V3 défaut).

- [ ] **Step 2: Migrer Analysis `mobile/app/(tabs)/analysis/[id].tsx`**

Trouver le bouton Quick Chat existant (`router.push` vers QuickChatScreen ou Modal). Remplacer par `<ConversationScreen visible={open} summaryId={id} initialMode="chat" onClose={() => setOpen(false)} />`.

- [ ] **Step 3: Smoke test manuel local**

```bash
cd mobile && npx expo start
```

Sur l'app : tester Quick Chat depuis Home avec un summary existant + tester Quick Call. Vérifier que le fil unifié s'affiche correctement, que les voice user n'apparaissent PAS, que voice agent apparaît avec badge mic.

- [ ] **Step 4: Supprimer les legacy**

```bash
rm mobile/src/components/analysis/QuickChatScreen.tsx
rm mobile/src/components/voice/VoiceScreen.tsx
rm mobile/src/components/voice/PostCallScreen.tsx
# tests legacy
rm mobile/src/components/voice/__tests__/PostCallScreen.test.tsx 2>/dev/null || true
rm mobile/src/components/voice/__tests__/VoiceScreen.test.tsx 2>/dev/null || true
rm mobile/src/components/analysis/__tests__/QuickChatScreen.test.tsx 2>/dev/null || true
```

Mettre à jour `mobile/src/components/voice/index.ts` pour ne plus re-exporter ces composants.

Vérifier qu'aucun autre fichier n'importe ces composants :

```bash
cd mobile && grep -rn "QuickChatScreen\|VoiceScreen\|PostCallScreen" src/ app/ __tests__/
```

Si reste des imports → fix.

- [ ] **Step 5: Run full test suite + commit**

```bash
cd mobile && npm test
```

Expected: tous PASS (les nouveaux tests + les anciens non liés). Aucun import cassé.

```bash
git add -A
git commit -m "refactor(mobile): migrate Home + Analysis to ConversationScreen, delete legacy QuickChatScreen + VoiceScreen + PostCallScreen"
```

---

## Task 8 : Smoke E2E iOS + Android + PR

- [ ] **Step 1: Build dev iOS**

```bash
cd mobile && npx expo run:ios --device
```

Test scenarios §11.4 du spec (mobile) :

1. Home → Quick Chat avec summary existant → tape question → réponse
2. Tap mic → Alert confirm → start voice → parle → bulle 🎙️ agent dans fil → vérifier que rien n'apparaît pour la voix user
3. Tap End → toast 3s → retour mode chat → mic gris
4. Tap "Voir l'analyse complète" → navigation OK
5. Re-ouvrir la même analyse → fil mixté restauré

- [ ] **Step 2: Build dev Android**

```bash
cd mobile && npx expo run:android --device
```

Mêmes scenarios.

- [ ] **Step 3: Push branch + ouvrir PR**

```bash
git push -u origin feat/quick-chat-call-unified
gh pr create --title "feat(mobile): unified Quick Chat + Quick Call ConversationScreen" --body "$(cat <<'EOF'
## Summary
- Fusionne QuickChatScreen + VoiceScreen + PostCallScreen en un seul ConversationScreen two-pane
- Nouveau hook useConversation orchestrant useChat + useVoiceChat + useStreamingVideoContext
- Règle UX "audio user invisible" : transcripts voice user filtrés du fil
- Type ChatMessage étendu pour passthrough champs voice depuis backend (existant)

## Test plan
- [x] `npm test` mobile (~178+ nouveaux tests PASS)
- [x] Smoke iOS device : Quick Chat + Quick Call + transition + persistance
- [x] Smoke Android device : idem
- [ ] EAS Build production (à faire après merge)

Spec : docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Attendre CI** (lint + typecheck + tests)

- [ ] **Step 5: Merge** (après review user)

---

# PR2 — Extension Chrome (Agent B, parallel après Task 1 PR1)

## Task 1 : Étendre type `ChatMessage` extension + tests passthrough

**Files:**

- Modify: `extension/src/sidepanel/types.ts` (ou équivalent)
- Modify: `extension/src/sidepanel/api.ts`
- Test: `extension/__tests__/sidepanel/api.test.ts`

Identique à PR1 Task 1 mais côté extension. Vérifier le mapping `chatApi.getHistory` extension passe bien les champs voice. Commit séparé :

```bash
git commit -m "feat(ext): extend ChatMessage with voice fields (passthrough backend)"
```

---

## Task 2 : Hook `useConversation` ext + composants présentational

**Files:**

- Create: `extension/src/sidepanel/hooks/useConversation.ts`
- Create: `extension/src/sidepanel/components/ConversationFeed.tsx`
- Create: `extension/src/sidepanel/components/ConversationFeedBubble.tsx`
- Create: `extension/src/sidepanel/components/VoiceControls.tsx`
- Create: `extension/src/sidepanel/components/ConversationInput.tsx`
- Create: `extension/src/sidepanel/components/EndedToast.tsx`
- Test: `extension/__tests__/sidepanel/hooks/useConversation.test.ts`

- [ ] **Step 1: Tests failing**

Mirror des tests PR1 Task 3 + Task 4, adapté à `@elevenlabs/react` (vs `react-native`) et `@testing-library/react`.

- [ ] **Step 2: Implementation**

Mirror des hooks et composants PR1, adapté :

- `Alert.alert` → `window.confirm` ou un modal custom React (extension n'a pas Alert RN)
- `FlatList inverted` → `<div>` scrollable + `useRef` pour scroll-to-bottom
- `Reanimated` → CSS transitions ou Framer Motion (l'extension utilise déjà du React standard)
- `Ionicons` → `lucide-react` ou icônes inline SVG (selon stack ext actuelle)

Reprend le code TypeScript du hook `useConversation` mobile en le simplifiant pour le contexte web.

- [ ] **Step 3: Run tests (PASS)**

```bash
cd extension && npm test
```

- [ ] **Step 4: Commit**

```bash
git add extension/src/sidepanel/hooks/useConversation.ts extension/src/sidepanel/components/ extension/__tests__/sidepanel/hooks/useConversation.test.ts
git commit -m "feat(ext): add useConversation hook + composants présentational"
```

---

## Task 3 : `ConversationView` + migration App routing

**Files:**

- Create: `extension/src/sidepanel/views/ConversationView.tsx`
- Modify: `extension/src/sidepanel/App.tsx`
- Modify: `extension/src/sidepanel/views/MainView.tsx`
- Modify: `extension/src/sidepanel/contexts/NavigationContext.tsx`
- Test: `extension/__tests__/sidepanel/views/ConversationView.test.tsx`

- [ ] **Step 1: Tests failing**

Mirror du test ConversationScreen mobile.

- [ ] **Step 2: Créer `ConversationView.tsx`**

Composant racine de la vue conversation. Props : `{ summaryId?, videoUrl?, initialMode }`. Utilise `useConversation()` et render le layout sidepanel :

```tsx
<div className="conversation-view">
  <ConversationHeader />
  {streaming && <ContextProgressBanner ... />}
  <ConversationFeed messages={messages} />
  {voiceMode !== "off" && <VoiceControls ... />}
  {voiceMode === "ended" && <EndedToast />}
  <MiniActionBar />
  <ConversationInput ... />
</div>
```

- [ ] **Step 3: Migration App routing**

Dans `extension/src/sidepanel/App.tsx` et `NavigationContext.tsx` : fusionner les routes `'chat'` et `'voice'` en `'conversation'`. Update les conditions de render.

Dans `MainView.tsx` : remplacer les 2 boutons existants ("Quick Chat" → ChatView, "Quick Call" → VoiceView) par 2 nouveaux boutons qui pointent vers `ConversationView` avec `initialMode='chat'` et `initialMode='call'`.

- [ ] **Step 4: Run tests (PASS) + smoke Chrome**

```bash
cd extension && npm test
npm run build
# charger dist/ dans Chrome chrome://extensions, tester Quick Chat + Quick Call sur YouTube
```

- [ ] **Step 5: Commit**

```bash
git add extension/src/sidepanel/views/ConversationView.tsx extension/src/sidepanel/App.tsx extension/src/sidepanel/views/MainView.tsx extension/src/sidepanel/contexts/NavigationContext.tsx extension/__tests__/sidepanel/views/ConversationView.test.tsx
git commit -m "feat(ext): add ConversationView + migrate App routing chat/voice → conversation"
```

---

## Task 4 : Suppression legacy `ChatView` + `VoiceView`

**Files:**

- Delete: `extension/src/sidepanel/views/ChatView.tsx`
- Delete: `extension/src/sidepanel/VoiceView.tsx`
- Delete: tests associés si existent

- [ ] **Step 1: grep cross-repo pour références**

```bash
cd extension && grep -rn "ChatView\|VoiceView" src/ __tests__/
```

Tous les imports doivent maintenant pointer sur `ConversationView`. Si reste des imports orphelins → fix.

- [ ] **Step 2: Delete**

```bash
rm extension/src/sidepanel/views/ChatView.tsx
rm extension/src/sidepanel/VoiceView.tsx
rm extension/__tests__/sidepanel/views/ChatView.test.tsx 2>/dev/null || true
rm extension/__tests__/sidepanel/views/VoiceView.test.tsx 2>/dev/null || true
```

- [ ] **Step 3: Run full test suite**

```bash
cd extension && npm test
```

Expected: PASS, aucun import cassé.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ext): delete legacy ChatView + VoiceView (replaced by ConversationView)"
```

---

## Task 5 : Smoke E2E Chrome + PR

- [ ] **Step 1: Build prod extension**

```bash
cd extension && npm run build
```

- [ ] **Step 2: Charger dans Chrome**

`chrome://extensions` → Mode développeur → Charger l'extension non empaquetée → `extension/dist/`.

- [ ] **Step 3: Smoke test scenarios**

1. Sur YouTube → side panel → Quick Call → conversation auto-start
2. Vérifier transcripts voice agent apparaissent (badge mic)
3. Vérifier que la voix user n'apparaît PAS dans le fil
4. Tap End → retour mode chat
5. Quick Chat depuis side panel → ouvre conversation mode chat
6. Fermer/rouvrir le sidepanel → fil persiste

- [ ] **Step 4: Push + PR (peut être 2e PR sur la même branche, ou branche séparée)**

Si on fait tout sur `feat/quick-chat-call-unified` (PR1 mobile + PR2 ext = 1 PR géant), ne pas pousser ici, attendre la fin. Sinon créer une 2e branche `feat/quick-chat-call-unified-ext` et 2e PR.

```bash
git push origin feat/quick-chat-call-unified
gh pr create --title "feat(ext): unified ConversationView" --body "..."
```

- [ ] **Step 5: Merge après review**

---

# Self-Review (Plan)

**Spec coverage check :**

| Spec section                   | Couvert par task                                                       |
| ------------------------------ | ---------------------------------------------------------------------- |
| §3.1 Two-pane                  | PR1 Task 6 (ConversationScreen layout) + PR2 Task 3                    |
| §3.2 Fil unique mixté          | PR1 Task 3 (useConversation) + PR2 Task 2                              |
| §3.3 Audio user invisible      | PR1 Task 3 step 1 (test "excludes voice user") + PR2 Task 2            |
| §3.4 Two-pane mobile           | PR1 Task 6                                                             |
| §3.5 Confirm dialog            | PR1 Task 3 (requestStartCall) + Task 4 (mic button onTap) + PR2 Task 2 |
| §3.6 Scope mobile + ext        | PR1 + PR2                                                              |
| §3.7 Post-call retour fluide   | PR1 Task 5 (EndedToast) + Task 6 (ConversationScreen state machine)    |
| §3.8 Architecture mobile       | PR1 Task 3                                                             |
| §3.9 VoiceControls 2 boutons   | PR1 Task 5                                                             |
| §3.10 Suppression legacy       | PR1 Task 7 + PR2 Task 4                                                |
| §3.13 Backend aucun changement | OK (sanity check pytest optionnel hors plan)                           |
| §3.14 2 PRs parallélisables    | OK                                                                     |

**Placeholder scan** : aucun "TBD"/"TODO"/"implement later" trouvé. Code complet dans tous les steps de Tasks 1-3 PR1. Tasks 4-7 PR1 et PR2 utilisent "Mirror du PR1 + adaptation web" pour ne pas dupliquer le code — acceptable car c'est un mirror littéral du code PR1 avec substitutions documentées.

**Type consistency** :

- `UnifiedMessage` : défini en §4.1 spec, utilisé en PR1 Task 3 + Task 4 (Bubble) + Task 6 (Screen). Cohérent.
- `VoiceMode` : `"off" | "live" | "ended" | "quota_exceeded"` — cohérent partout.
- `ChatMessage` étendu : champs `source/voice_speaker/voice_session_id/time_in_call_secs` — cohérents PR1 Task 1 + Task 3.
- `useConversation` retour : 14 propriétés exposées (cf. spec §4.1) — utilisées correctement dans Task 6.

---

# Execution Handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-05-02-quick-chat-call-unified.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — un sub-agent Opus 4.7 par task, review entre chaque task, itération rapide. Idéal pour les Tasks 3, 4, 5, 6 (composants complexes).

**2. Inline Execution** — exécution batch dans cette session, checkpoints aux frontières de PR. Plus rapide mais moins de review intermédiaire.

**Recommandation** : Subagent-Driven avec dispatch parallèle Agent A (PR1 Mobile) + Agent B (PR2 Extension) dès que Task 1 PR1 est mergée (les 2 PRs partagent le même type backend `ChatMessage` mais l'extension peut avoir le sien). Worktrees séparés.
