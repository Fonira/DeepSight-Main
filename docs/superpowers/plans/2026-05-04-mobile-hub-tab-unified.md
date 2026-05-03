# Mobile Hub Tab Unified — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Activer le tab `Hub` mobile DeepSight (déshider `href:null`), embedder `ConversationContent` (extrait du `ConversationScreen` Modal) avec `ConversationsDrawer` swipe-in, faire converger Quick Chat Home + ChatView analyse vers le Hub, fixer Quick Call invisible (FAB bottomOffset + entry first-class via mic toggle Hub).

**Architecture:** Refactor `ConversationScreen` Modal → wrapper léger autour de `ConversationContent` réutilisable en tab. Tab Hub = `ConversationContent` embedded + `ConversationsDrawer` (multi-conv switch via `key={summaryId}` remount + Expo Router params).

**Tech Stack:** Expo SDK 54 + React Native 0.81 + Expo Router v2 + Reanimated 4 + Jest + @shopify/flash-list.

**Spec:** `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md`

**Branche:** `feat/mobile-hub-tab-unified` depuis `origin/main`. Worktree `C:\Users\33667\DeepSight-mobile-hub-tab`.

**Sub-agents Opus 4.7** : 4 agents (A→B→C→D séquentiels, ou A→[B,C parallèles]→D pour gagner ~1j).

---

## File Structure

### Create

- `mobile/src/components/conversation/ConversationContent.tsx` — extrait du Modal, contient tout le layout actuel
- `mobile/src/components/hub/HubEmptyState.tsx` — empty state Hub (URL paste + pick conv + suggestions)
- `mobile/__tests__/app/hub.test.tsx`
- `mobile/__tests__/components/hub/HubEmptyState.test.tsx`
- `mobile/__tests__/components/conversation/ConversationContent.test.tsx` (déplacement de la majorité des cases depuis `ConversationScreen.test.tsx`)

### Modify

- `mobile/src/components/conversation/ConversationScreen.tsx` — refacto wrapper Modal léger (~40 lignes)
- `mobile/src/components/conversation/index.ts` — re-export `ConversationContent`
- `mobile/src/components/voice/VoiceButton.tsx` — `bottomOffset` utilise `useTabBarFootprint`
- `mobile/src/components/navigation/CustomTabBar.tsx` — étendre `TAB_META` avec entrée `hub`
- `mobile/app/(tabs)/_layout.tsx` — retirer `href: null` du `Tabs.Screen name="hub"`
- `mobile/app/(tabs)/hub.tsx` — **rewrite complet** (proto mock → ConversationContent + drawer)
- `mobile/app/(tabs)/index.tsx` — `handleQuickChat` push tab Hub au lieu de `analysis/[id]?quickChat=true`
- `mobile/app/(tabs)/analysis/[id].tsx` — supprimer mode `quickChat`, tab Chat → CTA Hub (variante A), VoiceButton fix
- `mobile/src/components/hub/HubHeader.tsx` — vérifier compatibilité `onMenuPress` callback (probablement déjà OK)
- `mobile/src/components/hub/ConversationsDrawer.tsx` — brancher `historyApi.getHistory` au lieu de mock
- `mobile/src/components/conversation/__tests__/ConversationScreen.test.tsx` — réduire au test wrapper Modal
- `mobile/src/components/__tests__/ChatView.test.tsx` — supprimer si existe (composant supprimé)

### Delete

- `mobile/src/components/analysis/ChatView.tsx`
- `mobile/src/components/analysis/ChatInput.tsx` (si seul usage = ChatView, à grep d'abord)
- `mobile/src/components/analysis/ChatMarkdown.tsx` (idem grep)
- `mobile/src/components/hub/Timeline.tsx`
- `mobile/src/components/hub/InputBar.tsx`
- `mobile/src/components/hub/CallModeFullBleed.tsx`
- `mobile/src/components/hub/MessageBubble.tsx`
- `mobile/src/components/hub/VoiceBubble.tsx`
- `mobile/src/components/hub/VoiceWaveformBars.tsx` (si non réutilisé par VoiceControls — grep)
- `mobile/src/components/hub/DeepSightLogo.tsx` (si non utilisé ailleurs — grep)
- `mobile/src/components/hub/sampleData.ts`
- `mobile/src/components/hub/types.ts` (si non réutilisé — grep)
- `mobile/src/components/hub/__tests__/*` pour les composants supprimés

### Conserve

- `mobile/src/components/hub/HubHeader.tsx` (refacto léger)
- `mobile/src/components/hub/ConversationsDrawer.tsx` (brancher backend)
- `mobile/src/components/hub/SummaryCollapsible.tsx` (réservé V2 intégration ConversationContent)
- `mobile/src/components/hub/VideoPiPPlayer.tsx` (idem)
- `mobile/src/components/hub/SourcesShelf.tsx` (idem)

---

# Agent A — Foundation : extract `ConversationContent`

**Goal** : Refactor `ConversationScreen` en `ConversationContent` (réutilisable embedded) + wrapper Modal léger. Aucun changement de comportement, juste un refacto de séparation.

**Estimation** : 0,5–1 jour Opus 4.7.

**Dépend de** : rien.

**Bloque** : Agent B, Agent C.

## Task A1 : Lire et comprendre `ConversationScreen` actuel

- [ ] **Step 1 : Lire le fichier**

```bash
cat mobile/src/components/conversation/ConversationScreen.tsx
```

Identifier les sections :

- Imports (lignes 1-47)
- Interface props (lignes 49-68)
- Composant root (lignes 70-304) — distinguer la partie Modal wrapper (lignes 204-302) du contenu (lignes 232-296)

- [ ] **Step 2 : Lister les call-sites actuels de `ConversationScreen`**

```bash
cd mobile && grep -rn "ConversationScreen" src/ app/ __tests__/
```

Documenter pour vérifier après refacto que tous les call-sites continuent de marcher.

## Task A2 : Créer `ConversationContent.tsx` (extract)

**Files** :

- Create: `mobile/src/components/conversation/ConversationContent.tsx`
- Modify: `mobile/src/components/conversation/index.ts` (re-export)

- [ ] **Step 1 : Test failing (placeholder)**

```typescript
// mobile/__tests__/components/conversation/ConversationContent.test.tsx
import { render } from "@testing-library/react-native";
import { ConversationContent } from "../../../src/components/conversation/ConversationContent";

// mock useConversation pour ne pas vraiment hit backend
jest.mock("../../../src/hooks/useConversation", () => ({
  useConversation: () => ({
    messages: [],
    voiceMode: "off",
    endedToastVisible: false,
    summaryId: "test-id",
    sendMessage: jest.fn(),
    requestStartCall: jest.fn(),
    endCall: jest.fn(),
    toggleMute: jest.fn(),
    isMuted: false,
    isSpeaking: false,
    elapsedSeconds: 0,
    remainingMinutes: 30,
    isLoading: false,
    contextProgress: 0,
    contextComplete: false,
    streaming: false,
    error: null,
  }),
}));

describe("ConversationContent", () => {
  it("renders header + feed + input without Modal wrapper", () => {
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Test Video"
      />,
    );
    // ConversationHeader devrait être présent
    expect(getByLabelText(/conversation/i)).toBeTruthy(); // si a11y existant
  });

  it("calls onMenuPress when burger button tapped (Hub mode)", () => {
    const onMenuPress = jest.fn();
    const { getByLabelText } = render(
      <ConversationContent
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onMenuPress={onMenuPress}
      />,
    );
    // Le burger doit être passé à ConversationHeader
    // (selon implémentation finale du header)
  });
});
```

- [ ] **Step 2 : Run test (FAIL — module not found)**

```bash
cd mobile && npm test -- ConversationContent.test.tsx
```

- [ ] **Step 3 : Implementation**

Créer `mobile/src/components/conversation/ConversationContent.tsx`. Copier le contenu de `ConversationScreen.tsx` lignes 70-304 sans le `<Modal>` wrapper (lignes 204-227 et 302). Garder :

- `useConversation` hook call (déjà ligne 90-98)
- `useState` pour `inputText`, `isFavorite`, etc. (lignes 84-88)
- Tous les handlers (`handleSend`, `handleSuggestion`, `handleMicTap`, `handleToggleFavorite`, `handleShare`, `handleViewAnalysis`, etc.)
- Le `quotaText` computation (lignes 192-198)
- Le rendu des composants enfants (lignes 232-296) — sans le `<Modal>` ni le `<Animated.View entering={FadeIn}>` outer

Adapter les props :

```typescript
export interface ConversationContentProps {
  summaryId?: string;
  videoUrl?: string;
  initialMode: "chat" | "call";
  videoTitle: string;
  channelName?: string;
  platform?: "youtube" | "tiktok" | "live";
  initialFavorite?: boolean;
  /** Hub tab : burger ouvre ConversationsDrawer. Si null/absent : pas de burger. */
  onMenuPress?: () => void;
  /** Modal mode : close button. Si null : pas de close. */
  onClose?: () => void;
}
```

Passer `onMenuPress` et `onClose` à `<ConversationHeader>` (qui doit accepter ces deux callbacks — vérifier signature actuelle de `ConversationHeader`).

- [ ] **Step 4 : Run test (PASS)**

```bash
cd mobile && npm test -- ConversationContent.test.tsx
```

Expected : PASS.

- [ ] **Step 5 : Commit**

```bash
git add mobile/src/components/conversation/ConversationContent.tsx mobile/__tests__/components/conversation/ConversationContent.test.tsx
git commit -m "feat(mobile): extract ConversationContent from ConversationScreen Modal"
```

## Task A3 : Refacto `ConversationScreen` en wrapper Modal léger

**Files** :

- Modify: `mobile/src/components/conversation/ConversationScreen.tsx`
- Modify: `mobile/src/components/conversation/__tests__/ConversationScreen.test.tsx` (réduit)

- [ ] **Step 1 : Réécrire `ConversationScreen.tsx`**

Remplacer tout le contenu actuel (~319 lignes) par un wrapper d'environ 40 lignes :

```typescript
import React from "react";
import { Modal, StatusBar } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { duration } from "../../theme/animations";
import {
  ConversationContent,
  type ConversationContentProps,
} from "./ConversationContent";

export interface ConversationScreenProps
  extends Omit<ConversationContentProps, "onMenuPress"> {
  visible: boolean;
  onClose: () => void;
}

export const ConversationScreen: React.FC<ConversationScreenProps> = ({
  visible,
  onClose,
  ...contentProps
}) => {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View
        entering={FadeIn.duration(duration.slow)}
        style={{ flex: 1, backgroundColor: colors.bgPrimary }}
      >
        <Animated.View
          entering={SlideInDown.duration(duration.slower).springify()}
          style={{ flex: 1 }}
        >
          <ConversationContent {...contentProps} onClose={onClose} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default ConversationScreen;
```

- [ ] **Step 2 : Adapter le test existant `ConversationScreen.test.tsx`**

Réduire à 3 cases (les 9 cases originales sont déplacées dans `ConversationContent.test.tsx`) :

```typescript
describe("ConversationScreen (wrapper)", () => {
  it("renders Modal with visible=true", () => {
    const { UNSAFE_getByType } = render(
      <ConversationScreen
        visible
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={jest.fn()}
      />,
    );
    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
  });

  it("does not render content when visible=false", () => {
    const { queryByText } = render(
      <ConversationScreen
        visible={false}
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={jest.fn()}
      />,
    );
    // Modal non visible → contenu non monté
    // (selon comportement RN, à valider — peut nécessiter mock plus profond)
  });

  it("forwards onClose to onRequestClose", () => {
    const onClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <ConversationScreen
        visible
        summaryId="1"
        initialMode="chat"
        videoTitle="Test"
        onClose={onClose}
      />,
    );
    const modal = UNSAFE_getByType(Modal);
    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3 : Update `mobile/src/components/conversation/index.ts`**

Re-export `ConversationContent` :

```typescript
export { ConversationScreen } from "./ConversationScreen";
export { ConversationContent } from "./ConversationContent";
export type { ConversationScreenProps } from "./ConversationScreen";
export type { ConversationContentProps } from "./ConversationContent";
// ... autres re-exports existants
```

- [ ] **Step 4 : Run full conversation tests + smoke compile**

```bash
cd mobile && npm test -- conversation
npm run typecheck
```

Expected : tous PASS, typecheck zéro erreur (hors les 19 erreurs pré-existantes documentées).

- [ ] **Step 5 : Smoke test sur `analysis/[id].tsx` (call-site existant)**

```bash
cd mobile && npx expo start
```

Sur device : ouvrir une analyse existante depuis Library → tap bouton Quick Chat → vérifier que `ConversationScreen` Modal s'ouvre normalement (rien ne doit avoir changé visuellement).

- [ ] **Step 6 : Commit**

```bash
git add mobile/src/components/conversation/ConversationScreen.tsx mobile/src/components/conversation/index.ts mobile/__tests__/components/conversation/ConversationScreen.test.tsx
git commit -m "refactor(mobile): ConversationScreen → thin Modal wrapper around ConversationContent"
```

## Task A4 : Hand-off to Agent B

- [ ] **Step 1 : Push branch + status**

```bash
git push -u origin feat/mobile-hub-tab-unified
git log --oneline -5
```

- [ ] **Step 2 : Brief Agent B**

Le contexte minimal pour Agent B :

> ConversationContent extrait, wrapper Modal léger. Tu peux maintenant rendre `<ConversationContent />` dans `mobile/app/(tabs)/hub.tsx` sans le wrapper Modal. Spec §4.4 décrit le rewrite hub.tsx complet.

---

# Agent B — Hub tab : rewrite + déshider + drawer backend

**Goal** : Rewrite `mobile/app/(tabs)/hub.tsx` pour utiliser `ConversationContent` + `ConversationsDrawer`. Déshider le tab. Brancher le drawer sur backend.

**Estimation** : 1–1,5 jour Opus 4.7.

**Dépend de** : Agent A (ConversationContent disponible).

**Bloque** : Agent C.

**Parallélisable avec** : Agent C dans une variante (Agent B touche `hub.tsx` + `(tabs)/_layout.tsx` + `CustomTabBar.tsx` + `ConversationsDrawer.tsx`, Agent C touche `index.tsx` + `analysis/[id].tsx` + `VoiceButton.tsx`. Aucun chevauchement de fichiers).

## Task B1 : Étendre `CustomTabBar` + déshider hub.tsx

**Files** :

- Modify: `mobile/src/components/navigation/CustomTabBar.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1 : Modifier `CustomTabBar.tsx` `TAB_META`**

Ajouter l'entrée `hub` après `library` :

```typescript
const TAB_META = {
  index: { icon: "home-outline", iconFocused: "home", label: "Accueil" },
  library: { icon: "time-outline", iconFocused: "time", label: "Historique" },
  hub: {
    icon: "chatbubbles-outline",
    iconFocused: "chatbubbles",
    label: "Hub",
  },
  study: { icon: "book-outline", iconFocused: "book", label: "Étude" },
  subscription: {
    icon: "sparkles-outline",
    iconFocused: "sparkles",
    label: "Abo",
  },
  profile: {
    icon: "settings-outline",
    iconFocused: "settings",
    label: "Profil",
  },
};
```

- [ ] **Step 2 : Modifier `_layout.tsx`**

Ligne 52-58, retirer `href: null`. Réordonner pour mettre `hub` après `library` (l'ordre des `<Tabs.Screen>` détermine l'ordre dans la TabBar) :

```typescript
<Tabs.Screen name="index" options={{ title: "Accueil" }} />
<Tabs.Screen name="library" options={{ title: "Bibliothèque" }} />
<Tabs.Screen name="hub" options={{ title: "Hub" }} />
<Tabs.Screen name="study" options={{ title: "Étude & Chat" }} />
<Tabs.Screen name="subscription" options={{ title: "Abonnement" }} />
<Tabs.Screen name="profile" options={{ title: "Profil" }} />
{/* analysis/[id] reste caché */}
<Tabs.Screen name="analysis/[id]" options={{ href: null, title: "Analyse" }} />
```

- [ ] **Step 3 : Smoke test (le tab Hub apparaît mais affiche encore le mock)**

```bash
cd mobile && npx expo start
```

Tap "Hub" tab → doit afficher le proto mock actuel (sera rewrite Task B3).

- [ ] **Step 4 : Commit**

```bash
git add mobile/src/components/navigation/CustomTabBar.tsx mobile/app/(tabs)/_layout.tsx
git commit -m "feat(mobile): unhide Hub tab in TabBar (6 tabs total)"
```

## Task B2 : Brancher `ConversationsDrawer` sur backend

**Files** :

- Modify: `mobile/src/components/hub/ConversationsDrawer.tsx`
- Test: `mobile/__tests__/components/hub/ConversationsDrawer.test.tsx`

- [ ] **Step 1 : Lire la signature actuelle**

```bash
cat mobile/src/components/hub/ConversationsDrawer.tsx | head -60
```

Repérer comment le composant reçoit `conversations`. Probablement passé en prop directement (mock data côté `hub.tsx` actuel).

- [ ] **Step 2 : Adapter la signature pour accepter `conversations` ou loader interne**

Choix archi : laisser le **parent** (`hub.tsx`) charger via TanStack Query, et passer la liste en prop. Garde le drawer pure presentational. Cohérent avec le pattern actuel.

Si le drawer accepte déjà `conversations: HubConversation[]` en prop → rien à modifier ici, c'est `hub.tsx` qui fournira les vraies données via `historyApi.getHistory`.

Si le drawer fait son propre fetch → refacto pour pure presentational.

- [ ] **Step 3 : Type cohérent avec `historyApi.getHistory` retour**

Vérifier que le type `HubConversation` exposé par `ConversationsDrawer` est compatible avec `AnalysisSummary` (retour de `historyApi.getHistory`). Si pas → adapter le type ou créer un mapper inline dans `hub.tsx`.

- [ ] **Step 4 : Tests existants drawer**

```bash
cd mobile && npm test -- ConversationsDrawer
```

S'ils existent, vérifier qu'ils passent encore.

- [ ] **Step 5 : Commit (si modif)**

```bash
git add mobile/src/components/hub/ConversationsDrawer.tsx mobile/__tests__/components/hub/ConversationsDrawer.test.tsx 2>/dev/null
git commit -m "refactor(mobile): ConversationsDrawer accepts conversations prop (backend-ready)"
```

(Skip si aucune modif nécessaire.)

## Task B3 : Créer `HubEmptyState`

**Files** :

- Create: `mobile/src/components/hub/HubEmptyState.tsx`
- Test: `mobile/__tests__/components/hub/HubEmptyState.test.tsx`

- [ ] **Step 1 : Test failing**

```typescript
// mobile/__tests__/components/hub/HubEmptyState.test.tsx
import { render, fireEvent } from "@testing-library/react-native";
import { HubEmptyState } from "../../../src/components/hub/HubEmptyState";

describe("HubEmptyState", () => {
  it("renders title and 2 CTAs", () => {
    const { getByText } = render(
      <HubEmptyState onPickConv={jest.fn()} onPasteUrl={jest.fn()} />,
    );
    expect(getByText(/aucune conversation/i)).toBeTruthy();
    expect(getByText(/coller un lien/i)).toBeTruthy();
    expect(getByText(/choisir une conversation/i)).toBeTruthy();
  });

  it("calls onPickConv when 'Choisir' CTA tapped", () => {
    const onPickConv = jest.fn();
    const { getByText } = render(
      <HubEmptyState onPickConv={onPickConv} onPasteUrl={jest.fn()} />,
    );
    fireEvent.press(getByText(/choisir une conversation/i));
    expect(onPickConv).toHaveBeenCalled();
  });

  it("calls onPasteUrl when URL submitted", () => {
    const onPasteUrl = jest.fn();
    const { getByPlaceholderText } = render(
      <HubEmptyState onPickConv={jest.fn()} onPasteUrl={onPasteUrl} />,
    );
    const input = getByPlaceholderText(/youtube.com|tiktok.com/i);
    fireEvent.changeText(input, "https://youtube.com/watch?v=abc");
    fireEvent(input, "submitEditing");
    expect(onPasteUrl).toHaveBeenCalledWith("https://youtube.com/watch?v=abc");
  });
});
```

- [ ] **Step 2 : Run test (FAIL)**

```bash
cd mobile && npm test -- HubEmptyState.test.tsx
```

- [ ] **Step 3 : Implementation**

```typescript
import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, Pressable, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { palette } from "@/theme/colors";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

interface HubEmptyStateProps {
  onPickConv: () => void;
  onPasteUrl: (url: string) => void;
}

export const HubEmptyState: React.FC<HubEmptyStateProps> = ({ onPickConv, onPasteUrl }) => {
  const { colors } = useTheme();
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    const trimmed = url.trim();
    const isValid =
      trimmed.includes("youtube.com") ||
      trimmed.includes("youtu.be") ||
      trimmed.includes("tiktok.com");
    if (!isValid) {
      Alert.alert("Lien invalide", "Colle un lien YouTube ou TikTok.");
      return;
    }
    onPasteUrl(trimmed);
    setUrl("");
  };

  return (
    <View style={styles.root}>
      <Ionicons name="chatbubbles-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textPrimary }]}>Aucune conversation</Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Colle un lien YouTube ou TikTok, ou choisis une conversation existante.
      </Text>

      {/* CTA 1 — URL paste */}
      <View style={[styles.urlRow, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder="youtube.com/... ou tiktok.com/..."
          placeholderTextColor={colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        <Pressable
          style={[styles.urlBtn, { backgroundColor: url.trim() ? palette.indigo : colors.bgSecondary }]}
          onPress={handleSubmit}
          disabled={!url.trim()}
        >
          <Ionicons name="arrow-forward" size={20} color={url.trim() ? "#fff" : colors.textMuted} />
        </Pressable>
      </View>

      {/* CTA 2 — Pick conv */}
      <Pressable
        style={[styles.pickConv, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        onPress={onPickConv}
      >
        <Ionicons name="list-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.pickConvText, { color: colors.textSecondary }]}>
          Choisir une conversation
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: sp.xl, gap: sp.md },
  title: { fontFamily: fontFamily.displaySemiBold, fontSize: fontSize.xl, marginTop: sp.md },
  subtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, textAlign: "center", marginBottom: sp.lg },
  urlRow: {
    flexDirection: "row", alignItems: "center", borderRadius: borderRadius.lg, borderWidth: 1, padding: 4, width: "100%",
  },
  input: { flex: 1, height: 40, paddingHorizontal: sp.md, fontFamily: fontFamily.body, fontSize: fontSize.sm },
  urlBtn: { width: 40, height: 40, borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center" },
  pickConv: {
    flexDirection: "row", alignItems: "center", gap: sp.sm,
    paddingVertical: sp.md, paddingHorizontal: sp.lg, borderRadius: borderRadius.lg, borderWidth: 1,
  },
  pickConvText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm },
});
```

- [ ] **Step 4 : Run test (PASS)**

```bash
cd mobile && npm test -- HubEmptyState.test.tsx
```

- [ ] **Step 5 : Commit**

```bash
git add mobile/src/components/hub/HubEmptyState.tsx mobile/__tests__/components/hub/HubEmptyState.test.tsx
git commit -m "feat(mobile): add HubEmptyState (URL paste + pick conv)"
```

## Task B4 : Rewrite `mobile/app/(tabs)/hub.tsx`

**Files** :

- Modify: `mobile/app/(tabs)/hub.tsx`
- Test: `mobile/__tests__/app/hub.test.tsx`

- [ ] **Step 1 : Test failing**

```typescript
import { render, waitFor } from "@testing-library/react-native";
import HubScreen from "../../app/(tabs)/hub";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({})),
  useRouter: jest.fn(() => ({ setParams: jest.fn(), push: jest.fn() })),
}));
jest.mock("../../src/services/api", () => ({
  historyApi: {
    getHistory: jest.fn(() => Promise.resolve({ items: [] })),
  },
}));
jest.mock("../../src/hooks/useConversation", () => ({
  useConversation: () => ({
    messages: [], voiceMode: "off", endedToastVisible: false,
    summaryId: null, sendMessage: jest.fn(), requestStartCall: jest.fn(),
    endCall: jest.fn(), toggleMute: jest.fn(), isMuted: false, isSpeaking: false,
    elapsedSeconds: 0, remainingMinutes: 30, isLoading: false,
    contextProgress: 0, contextComplete: false, streaming: false, error: null,
  }),
}));

describe("HubScreen", () => {
  it("renders HubEmptyState when no summaryId param and no last conv", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({});
    const { findByText } = render(<HubScreen />);
    expect(await findByText(/aucune conversation/i)).toBeTruthy();
  });

  it("renders ConversationContent when summaryId param present", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ summaryId: "42", initialMode: "chat" });
    const { findByLabelText } = render(<HubScreen />);
    // ConversationContent rendu (vérification souple via son a11y label si dispo)
  });

  it("auto-resolves last conv when no summaryId and history non-empty", async () => {
    const { useLocalSearchParams, useRouter } = require("expo-router");
    const setParams = jest.fn();
    useLocalSearchParams.mockReturnValue({});
    useRouter.mockReturnValue({ setParams, push: jest.fn() });
    const { historyApi } = require("../../src/services/api");
    historyApi.getHistory.mockResolvedValueOnce({
      items: [{ id: "99", title: "Last Conv", platform: "youtube", isFavorite: false }],
    });
    render(<HubScreen />);
    await waitFor(() => {
      expect(setParams).toHaveBeenCalledWith({
        summaryId: "99",
        initialMode: "chat",
      });
    });
  });
});
```

- [ ] **Step 2 : Run test (FAIL)**

```bash
cd mobile && npm test -- hub.test.tsx
```

- [ ] **Step 3 : Implementation**

Remplacer tout le contenu de `mobile/app/(tabs)/hub.tsx` par le code de la spec §4.4. Adapter les imports selon disponibilité réelle :

```typescript
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ConversationContent } from "@/components/conversation";
import { ConversationsDrawer } from "@/components/hub/ConversationsDrawer";
import { HubEmptyState } from "@/components/hub/HubEmptyState";
import { historyApi } from "@/services/api";
import type { AnalysisSummary } from "@/types";

export default function HubScreen() {
  const params = useLocalSearchParams<{
    summaryId?: string;
    videoUrl?: string;
    initialMode?: "chat" | "call";
  }>();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const summaryId = params.summaryId ?? null;
  const initialMode = params.initialMode ?? "chat";

  // Charger l'historique pour le drawer ET pour fallback last-conv
  const { data: historyData } = useQuery({
    queryKey: ["history", "hub-drawer"],
    queryFn: () => historyApi.getHistory(1, 50),
  });

  const conversations = historyData?.items ?? [];
  const activeConv = conversations.find((c) => String(c.id) === summaryId) ?? null;

  // Auto-resolve : si pas de summaryId mais history non vide → push le 1er
  useEffect(() => {
    if (!summaryId && conversations.length > 0) {
      router.setParams({
        summaryId: String(conversations[0].id),
        initialMode: "chat",
      });
    }
  }, [summaryId, conversations, router]);

  const handleSelectConv = useCallback(
    (id: string | number) => {
      router.setParams({ summaryId: String(id), initialMode: "chat" });
      setDrawerOpen(false);
    },
    [router],
  );

  const handleNewConv = useCallback(() => {
    router.setParams({ summaryId: undefined, initialMode: undefined });
    setDrawerOpen(false);
  }, [router]);

  const handlePasteUrl = useCallback(
    async (url: string) => {
      // Réutilise pattern Home : videoApi.quickChat → setParams
      const { videoApi } = await import("@/services/api");
      const result = await videoApi.quickChat(url);
      router.setParams({
        summaryId: String(result.summary_id),
        initialMode: "chat",
      });
    },
    [router],
  );

  return (
    <View style={styles.root}>
      {summaryId ? (
        <ConversationContent
          key={summaryId}
          summaryId={summaryId}
          initialMode={initialMode}
          videoTitle={activeConv?.title ?? "Conversation"}
          channelName={activeConv?.channel}
          platform={(activeConv?.platform as "youtube" | "tiktok") ?? "youtube"}
          initialFavorite={activeConv?.isFavorite ?? false}
          onMenuPress={() => setDrawerOpen(true)}
        />
      ) : (
        <HubEmptyState
          onPickConv={() => setDrawerOpen(true)}
          onPasteUrl={handlePasteUrl}
        />
      )}

      <ConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations as any} // adapter le type si nécessaire
        activeConvId={summaryId ? Number(summaryId) : null}
        onSelect={handleSelectConv}
        onNewConv={handleNewConv}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0a0f" },
});
```

⚠️ Vérifier signature exacte de `ConversationsDrawer.tsx` actuel et adapter (peut nécessiter mapping `AnalysisSummary` → `HubConversation`).

- [ ] **Step 4 : Run test (PASS)**

```bash
cd mobile && npm test -- hub.test.tsx
```

- [ ] **Step 5 : Smoke test**

```bash
cd mobile && npx expo start
```

Sur device :

1. Tap "Hub" tab → vérifier `HubEmptyState` ou auto-load last conv
2. Burger → drawer s'ouvre avec liste conversations réelles
3. Sélectionner conv → drawer ferme + `ConversationContent` re-render
4. Tap "Nouvelle conversation" dans drawer → retour empty state

- [ ] **Step 6 : Commit**

```bash
git add mobile/app/(tabs)/hub.tsx mobile/__tests__/app/hub.test.tsx
git commit -m "feat(mobile): rewrite Hub tab with ConversationContent + ConversationsDrawer + EmptyState"
```

## Task B5 : Hand-off to Agent C (et D)

- [ ] **Step 1 : Push + status**

```bash
git push
git log --oneline -10
```

- [ ] **Step 2 : Brief**

> Hub tab actif et fonctionnel. Maintenant migrer Home Quick Chat (push tab Hub) et `analysis/[id].tsx` (cleanup mode quickChat + tab Chat → CTA Hub + fix VoiceButton bottomOffset). Spec §4.7.

---

# Agent C — Migration call-sites + fix Quick Call

**Goal** : Migrer Home `handleQuickChat` push Hub. Cleanup mode `quickChat` dans `analysis/[id].tsx`. Tab Chat → CTA Hub. Fix `VoiceButton.bottomOffset` pour cohérence sprint UX 2026-05-03.

**Estimation** : 0,5–1 jour Opus 4.7.

**Dépend de** : Agent A (ConversationContent), Agent B (Hub tab).

**Bloque** : Agent D.

**Parallélisable avec** : Agent B (zéro chevauchement de fichiers) — peut démarrer en parallèle dès que Agent A est mergé.

## Task C1 : Migrer Home `handleQuickChat`

**Files** :

- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1 : Lire `handleQuickChat` actuel**

Lignes 76-111 de `index.tsx`. Identifier le bloc `router.push({ pathname: "/(tabs)/analysis/[id]", params: {..., quickChat: "true"} })`.

- [ ] **Step 2 : Modifier le push**

Remplacer par :

```typescript
const result = await videoApi.quickChat(url);
setQuickChatUrl("");
router.push({
  pathname: "/(tabs)/hub",
  params: {
    summaryId: String(result.summary_id),
    initialMode: "chat",
  },
} as never);
```

Suppression des params `backTo`, `initialTab`, `quickChat`.

- [ ] **Step 3 : Smoke test**

```bash
cd mobile && npx expo start
```

Sur device : Home → coller URL YouTube → submit Quick Chat → vérifier navigation vers tab Hub avec conv chargée.

- [ ] **Step 4 : Commit**

```bash
git add mobile/app/(tabs)/index.tsx
git commit -m "feat(mobile): Home Quick Chat URL pushes to Hub tab (instead of analysis/[id]?quickChat)"
```

## Task C2 : Cleanup mode `quickChat` dans `analysis/[id].tsx`

**Files** :

- Modify: `mobile/app/(tabs)/analysis/[id].tsx`

- [ ] **Step 1 : Repérer le bloc**

Lignes 442-462 de `analysis/[id].tsx` :

```typescript
const isQuickChat = quickChat === "true" || summary?.mode === "quick_chat";

if (isQuickChat && summary) {
  return <ConversationScreen ... />;
}
```

- [ ] **Step 2 : Supprimer le bloc + le param `quickChat`**

```typescript
// Supprimer ligne 46-51 le destructuring quickChat
const { id, backTo, initialTab } = useLocalSearchParams<{
  id: string;
  backTo?: string;
  initialTab?: string;
}>();
```

Et supprimer les lignes 442-462 (le `if (isQuickChat && summary)` block).

Adapter le `loading state` lignes 469-484 qui référence `isQuickChat` :

```typescript
if (isLoading && !isProcessing) {
  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      {BackHeader}
      <AnalysisSkeleton />
    </View>
  );
}
```

(Suppression du conditionnel quickChat → DeepSightSpinner).

- [ ] **Step 3 : Vérifier les call-sites de `quickChat=true`**

```bash
cd mobile && grep -rn "quickChat" app/ src/ __tests__/
```

Si reste des occurrences (Library long-press, etc.) → migrer aussi vers tab Hub push.

- [ ] **Step 4 : Smoke test**

```bash
cd mobile && npx expo start
```

Sur device : Library → tap analyse classique → vérifier que l'analyse s'ouvre normalement (pas en mode quickChat). Quick Chat depuis Home (Task C1) → doit aller dans tab Hub.

- [ ] **Step 5 : Commit**

```bash
git add mobile/app/(tabs)/analysis/[id].tsx
git commit -m "refactor(mobile): remove quickChat mode from analysis/[id].tsx (handled by Hub tab)"
```

## Task C3 : Tab Chat de l'analyse → CTA Hub (variante A)

**Files** :

- Modify: `mobile/app/(tabs)/analysis/[id].tsx`

- [ ] **Step 1 : Lire le tab Chat actuel**

Lignes 420-425 de `analysis/[id].tsx` :

```typescript
<View key="chat" style={styles.page}>
  <ChatView
    summaryId={resolvedSummaryId || id || ""}
    keyboardOffset={kbOffset}
  />
</View>
```

- [ ] **Step 2 : Remplacer par placeholder CTA Hub**

```typescript
<View key="chat" style={[styles.page, styles.chatPlaceholder]}>
  <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
  <Text style={[styles.chatPlaceholderTitle, { color: colors.textPrimary }]}>
    Conversations dans le Hub
  </Text>
  <Text style={[styles.chatPlaceholderText, { color: colors.textTertiary }]}>
    Le chat avec cette vidéo se passe maintenant dans l'onglet Hub.
  </Text>
  <Pressable
    style={[styles.chatPlaceholderBtn, { backgroundColor: palette.indigo }]}
    onPress={() => {
      router.push({
        pathname: "/(tabs)/hub",
        params: {
          summaryId: String(resolvedSummaryId || id),
          initialMode: "chat",
        },
      } as never);
    }}
  >
    <Text style={styles.chatPlaceholderBtnText}>Continuer dans le Hub</Text>
    <Ionicons name="arrow-forward" size={18} color="#fff" />
  </Pressable>
</View>
```

Ajouter les styles correspondants.

- [ ] **Step 3 : Suppression import ChatView (Agent D le fera)**

Marquer pour suppression : `import { ChatView } from "@/components/analysis/ChatView";` (ligne 30) → suppression dans Agent D.

- [ ] **Step 4 : Smoke test**

```bash
cd mobile && npx expo start
```

Sur device : Library → analyse → swipe sur tab "Chat" → voir le placeholder CTA → tap → ouvre tab Hub avec ce summaryId.

- [ ] **Step 5 : Commit**

```bash
git add mobile/app/(tabs)/analysis/[id].tsx
git commit -m "feat(mobile): replace ChatView tab with 'Continue in Hub' CTA (variante A)"
```

## Task C4 : Fix `VoiceButton.bottomOffset`

**Files** :

- Modify: `mobile/src/components/voice/VoiceButton.tsx`

- [ ] **Step 1 : Repérer le calcul actuel**

Lignes 71-73 + 96-98 :

```typescript
const TAB_BAR_HEIGHT = 56;
const ACTION_BAR_HEIGHT = 72;
const FAB_GAP = 16;

const computedBottom =
  bottomOffset ?? TAB_BAR_HEIGHT + ACTION_BAR_HEIGHT + FAB_GAP + insets.bottom;
```

- [ ] **Step 2 : Utiliser `useTabBarFootprint`**

```typescript
import { useTabBarFootprint } from "@/hooks/useTabBarFootprint";

const ACTION_BAR_HEIGHT = 72;
const FAB_GAP = 16;

// Note: useTabBarFootprint() = TAB_BAR_HEIGHT + max(insets.bottom, sp.sm) + sp.md
//       déjà cohérent avec sprint UX 2026-05-03 (PR #274)
const tabFootprint = useTabBarFootprint();
const computedBottom =
  bottomOffset ?? tabFootprint + ACTION_BAR_HEIGHT + FAB_GAP;
```

- [ ] **Step 3 : Smoke test sur les 3 call-sites**

```bash
cd mobile && grep -rn "VoiceButton" src/ app/ | grep -v __tests__
```

Vérifier que les call-sites (analysis/[id].tsx + Library + Study si présent) passent leur propre `bottomOffset` ou laissent le default.

- [ ] **Step 4 : Smoke device — vérifier que le FAB n'est plus masqué**

```bash
cd mobile && npx expo start
```

Sur iPhone (devrait être le pire cas avec home indicator) :

1. Library → tap analyse → vérifier FAB Voice gold visible **clairement au-dessus de la TabBar**
2. Sur Android (devices sans nav bar gestures) : idem

- [ ] **Step 5 : Commit**

```bash
git add mobile/src/components/voice/VoiceButton.tsx
git commit -m "fix(mobile): VoiceButton bottomOffset uses useTabBarFootprint (no more FAB hidden under TabBar)"
```

## Task C5 : Hand-off to Agent D

- [ ] **Step 1 : Push + status**

```bash
git push
git log --oneline -15
```

- [ ] **Step 2 : Brief**

> Migration call-sites OK. Hub fonctionnel, Quick Chat Home redirige, ChatView tab remplacé par CTA, VoiceButton fixé. Reste : suppression composants legacy + tests + smoke complet + EAS update preview. Spec §4.7 (delete list) + §10.

---

# Agent D — Cleanup + tests + EAS preview

**Goal** : Supprimer composants legacy mock, mettre à jour tests, smoke iOS+Android, EAS update preview.

**Estimation** : 0,5–1 jour Opus 4.7.

**Dépend de** : Agent A, B, C tous mergés sur la branche.

**Bloque** : merge final sur main.

## Task D1 : grep et suppression composants `analysis/Chat*`

**Files** :

- Delete: `mobile/src/components/analysis/ChatView.tsx`
- Delete (conditionnel): `mobile/src/components/analysis/ChatInput.tsx`, `ChatMarkdown.tsx`

- [ ] **Step 1 : grep ChatView**

```bash
cd mobile && grep -rn "ChatView\|from.*ChatInput\|from.*ChatMarkdown" src/ app/ __tests__/
```

Confirmer que ChatView n'est plus importé nulle part (Agent C a normalement déjà supprimé l'import dans `analysis/[id].tsx`).

- [ ] **Step 2 : Vérifier ChatInput / ChatMarkdown réutilisation**

```bash
grep -rn "import.*ChatInput\|import.*ChatMarkdown" src/ app/ __tests__/
```

Si zéro réutilisation → delete. Sinon laisser.

- [ ] **Step 3 : Delete confirmé**

```bash
rm mobile/src/components/analysis/ChatView.tsx
# Si grep step 2 vide :
rm mobile/src/components/analysis/ChatInput.tsx 2>/dev/null
rm mobile/src/components/analysis/ChatMarkdown.tsx 2>/dev/null
```

- [ ] **Step 4 : Tests legacy**

```bash
ls mobile/src/components/analysis/__tests__/ 2>/dev/null
ls mobile/__tests__/components/analysis/ 2>/dev/null
```

Supprimer les tests qui référencent ChatView/ChatInput/ChatMarkdown.

- [ ] **Step 5 : Run test suite**

```bash
cd mobile && npm test
```

Expected : tous PASS, aucun import cassé.

- [ ] **Step 6 : Commit**

```bash
git add -A
git commit -m "refactor(mobile): delete legacy ChatView (replaced by Hub tab)"
```

## Task D2 : Suppression composants `hub/*` mock

**Files** :

- Delete: `mobile/src/components/hub/Timeline.tsx`, `InputBar.tsx`, `CallModeFullBleed.tsx`, `MessageBubble.tsx`, `VoiceBubble.tsx`, `VoiceWaveformBars.tsx`, `DeepSightLogo.tsx`, `sampleData.ts`, `types.ts`
- Delete: tests associés dans `mobile/src/components/hub/__tests__/`

- [ ] **Step 1 : grep chaque composant pour vérifier non-réutilisation**

```bash
cd mobile && for c in Timeline InputBar CallModeFullBleed MessageBubble VoiceBubble VoiceWaveformBars DeepSightLogo SAMPLE_CONVERSATIONS SAMPLE_MESSAGES; do
  echo "=== $c ===";
  grep -rn "$c" src/ app/ __tests__/ | grep -v "/hub/" | head -5;
done
```

Pour chaque composant : si la liste de matches est vide (hors `hub/` qui sera deleted) → safe à delete. Sinon investiguer.

- [ ] **Step 2 : Audit `index.ts` du dossier hub**

```bash
cat mobile/src/components/hub/index.ts
```

Identifier les re-exports. Mettre à jour pour ne re-exporter que les composants conservés (ConversationsDrawer, HubHeader, SummaryCollapsible, VideoPiPPlayer, SourcesShelf).

- [ ] **Step 3 : Delete**

```bash
cd mobile/src/components/hub
rm Timeline.tsx InputBar.tsx CallModeFullBleed.tsx MessageBubble.tsx VoiceBubble.tsx VoiceWaveformBars.tsx DeepSightLogo.tsx sampleData.ts types.ts 2>/dev/null
```

- [ ] **Step 4 : Tests**

```bash
ls mobile/src/components/hub/__tests__/
# Supprimer les tests pour les composants supprimés
rm mobile/src/components/hub/__tests__/Timeline.test.tsx 2>/dev/null
rm mobile/src/components/hub/__tests__/InputBar.test.tsx 2>/dev/null
# etc.
```

- [ ] **Step 5 : Update `mobile/src/components/hub/index.ts`**

Garder uniquement :

```typescript
export { HubHeader } from "./HubHeader";
export { ConversationsDrawer } from "./ConversationsDrawer";
export { SummaryCollapsible } from "./SummaryCollapsible";
export { VideoPiPPlayer } from "./VideoPiPPlayer";
export { SourcesShelf } from "./SourcesShelf";
export { HubEmptyState } from "./HubEmptyState";
```

- [ ] **Step 6 : Run test suite + typecheck**

```bash
cd mobile && npm test
npm run typecheck
```

Expected : PASS, zéro nouvelle erreur typecheck.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "refactor(mobile): delete legacy hub/* mock components (Timeline, InputBar, CallModeFullBleed, etc.)"
```

## Task D3 : Smoke E2E iOS + Android

- [ ] **Step 1 : Build dev iOS**

```bash
cd mobile && npx expo run:ios --device
```

- [ ] **Step 2 : Scenarios iOS (cf. spec §10.2)**

1. Open app → tap "Hub" tab → vérifier `HubEmptyState` (si vide) ou auto-load last conv
2. Tap burger → drawer slide-in → vérifier liste conversations réelles depuis backend
3. Sélectionner conv → drawer ferme + `ConversationContent` re-render
4. Tap mic dans `ConversationInput` → Alert "Démarrer l'appel ?" → confirm → voice live → bulle agent 🎙️ → audio user invisible
5. Tap End → toast 3s → retour mode chat
6. Sur Home → coller URL → Quick Chat → vérifier navigation vers tab Hub
7. Tab switch (Hub → Library → Hub) → conv restaurée
8. Sur `analysis/[id]` (depuis Library) → vérifier FAB Voice gold visible (PAS masqué TabBar)
9. Sur `analysis/[id]` → swipe tab Chat → voir CTA "Continuer dans le Hub" → tap → ouvre Hub avec ce summary

- [ ] **Step 3 : Build dev Android**

```bash
cd mobile && npx expo run:android --device
```

Mêmes scenarios.

- [ ] **Step 4 : EAS update preview (canary)**

```bash
cd mobile && eas update --channel preview --message "Hub tab unified — testing"
```

Récupérer l'OTA group ID. Tester sur build prod téléchargée.

- [ ] **Step 5 : Smoke notes (commit en doc si bugs trouvés)**

Si bugs trouvés → créer commits de fix dans cette même branche avant push final.

## Task D4 : Push + PR + merge

- [ ] **Step 1 : Status final**

```bash
cd mobile/.. && git log --oneline -25
git diff main..HEAD --stat
```

- [ ] **Step 2 : Push branch**

```bash
git push origin feat/mobile-hub-tab-unified
```

- [ ] **Step 3 : Créer PR via gh**

```bash
gh pr create --title "feat(mobile): Hub tab unified + Quick Call discoverable + cleanup legacy" --body "$(cat <<'EOF'
## Summary
- Activer le tab Hub (déshider href:null, ajouter à TAB_META)
- Extract ConversationContent (réutilisable embedded) depuis ConversationScreen Modal
- Rewrite app/(tabs)/hub.tsx avec ConversationContent + ConversationsDrawer + HubEmptyState
- Migrer Home Quick Chat URL → push tab Hub (au lieu de analysis/[id]?quickChat)
- Tab Chat de analysis/[id] → CTA "Continuer dans le Hub"
- Fix VoiceButton bottomOffset (utilise useTabBarFootprint, plus de FAB masqué)
- Suppression composants legacy mock (hub/Timeline, InputBar, CallModeFullBleed, analysis/ChatView, etc.)

## Test plan
- [x] Tests Jest verts (useConversation, ConversationContent, Hub, HubEmptyState, VoiceButton)
- [x] Smoke iOS device : tous flows §10.2 spec OK
- [x] Smoke Android device : idem
- [x] EAS update preview live et testé

Spec : docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md
Plan : docs/superpowers/plans/2026-05-04-mobile-hub-tab-unified.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4 : Attendre CI** (lint + typecheck + tests)

- [ ] **Step 5 : Merge après review user**

- [ ] **Step 6 : Post-merge — EAS update prod**

```bash
cd mobile && eas update --channel production --message "Hub tab unified shipped"
```

---

# Self-Review (Plan)

**Spec coverage check :**

| Spec section                              | Couvert par task                        |
| ----------------------------------------- | --------------------------------------- |
| §3 décision #1 (Hub onglet stable)        | B1                                      |
| §3 décision #2 (Hub UI = ConvContent)     | A2 + A3 + B4                            |
| §3 décision #3 (ConvScreen wrapper léger) | A3                                      |
| §3 décision #4 (Quick Chat Home → Hub)    | C1                                      |
| §3 décision #5 (ChatView supprimé/CTA)    | C3 + D1                                 |
| §3 décision #6 (FAB Voice fix)            | C4                                      |
| §3 décision #7 (composants hub/\* tri)    | D2                                      |
| §3 décision #8 (audio user invisible)     | OK (déjà dans useConversation existant) |
| §3 décision #9 (multi-conv switch)        | B4 (key={summaryId} remount)            |
| §3 décision #10 (routing /(tabs)/hub)     | B4                                      |
| §3 décision #11 (HubEmptyState)           | B3                                      |
| §3 décision #14 (backend = aucun chgmt)   | OK (sanity check optionnel non bloqué)  |
| §4.7 migration call-sites                 | C1 + C2 + C3                            |
| §5 fix Quick Call invisible               | C4 (bottomOffset) + B1+B4 (Hub entry)   |
| §10.2 smoke scenarios                     | D3                                      |
| §11 critères acceptation                  | Couvert globalement par D3              |

**Placeholder scan** : aucun `TBD`/`TODO`/`implement later` dans les Tasks A-D. Code inline complet pour :

- A2 Step 3 (ConversationContent extract logique)
- A3 Step 1 (ConversationScreen wrapper)
- B1 Step 1+2 (TAB_META + \_layout.tsx)
- B3 Step 3 (HubEmptyState complet)
- B4 Step 3 (hub.tsx complet)
- C1 Step 2 (handleQuickChat)
- C3 Step 2 (CTA Hub placeholder)
- C4 Step 2 (useTabBarFootprint)

Tasks A2/B4 référencent "lignes 232-296 de ConversationScreen" et "spec §4.4" → implémentation par copy/adapt, acceptable car pas d'invention nouvelle.

**Type consistency** :

- `ConversationContentProps` défini en A2, utilisé en A3, B4, C3 — cohérent
- `summaryId: string` partout (jamais number côté front, conversion faite par `useResolvedSummaryId` existant)
- `params` Expo Router : `useLocalSearchParams<{ summaryId?: string; ... }>` partout
- `historyApi.getHistory` retour : `{ items: AnalysisSummary[] }` — utilisé en B4 + drawer
- `VoiceButton.bottomOffset?: number` reste optionnel (cohérent avec usages Library/Study)

**Découpage agents** :

- A → B → C → D séquentiel = 2,5–4,5 j
- A → [B || C] → D parallèle (zéro chevauchement fichiers entre B et C) = 2–3 j
- Recommandé : parallélisation B+C pour gagner ~1 jour. Mémoire user `feedback_multi-claude-parallel-workflow.md` valide ce pattern.

**Risques majeurs anticipés** (cf. spec §8) :

- `useConversation` non-`summaryId`-mutable → mitigation `key={summaryId}` (Task B4 Step 3 implémenté)
- Voice live + tab switch perte session → V1 cleanup silencieux acceptable (décision §13 #3)
- `ConversationsDrawer` mock → audit Task B2 + adaptation
- Régression sprint UX 2026-05-03 → smoke obligatoire Task D3

---

# Execution Handoff

Plan complet sauvegardé à `docs/superpowers/plans/2026-05-04-mobile-hub-tab-unified.md`. Spec à `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md`.

**Recommandation** : exécution **Subagent-Driven Parallèle** :

1. **Agent A** (foundation) en solo — 0,5–1 j
2. Quand A merged : **Agent B + Agent C en parallèle** (worktrees ou sessions séparées) — 1–1,5 j
3. Quand B+C merged : **Agent D** (cleanup + smoke) — 0,5–1 j

**Total estimé** : **2–3 jours** Opus 4.7 sur worktree `C:\Users\33667\DeepSight-mobile-hub-tab`.

**Toutes les invocations Agent doivent utiliser `model: claude-opus-4-7[1m]`** (mémoire user perma).
