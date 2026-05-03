---
title: Mobile Hub Tab Unified — Design
date: 2026-05-04
type: spec
tags:
  - projet/deepsight
  - type/spec
  - platform/mobile
status: draft
extends:
  - docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md
related:
  - docs/superpowers/specs/2026-05-03-hub-nav-redesign-design.md (Hub WEB — pattern de référence)
  - docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md (backend explorer_streaming partagé)
---

# Mobile Hub Tab Unified — Design

**Date** : 2026-05-04
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Audit + brainstorm session 2026-05-04 (Opus 4.7, after /clear)
**Plateforme ciblée** : Mobile (Expo) uniquement
**Plateformes hors-scope** : Web (Hub web déjà refondu PR sprint 2026-05-03), Extension (PR2 unified mergée)

---

## 1. Contexte et problème

Trois symptômes user observés sur DeepSight Mobile (verbatim 2026-05-04) :

1. **Quick Call invisible** sur une vidéo : le bouton voice (FAB gold) n'est accessible que lorsqu'une analyse complète a été ouverte (`analysis/[id].tsx` ligne 698), donc impossible avant analyse, et noyé sous l'`ActionBar` + `TabBar` post-sprint UX 2026-05-03 (le calcul `bottomOffset` du `VoiceButton` n'utilise pas `useTabBarFootprint` introduit par PR #274 — risque de masquage visuel).
2. **Hub fantôme** : `mobile/app/(tabs)/hub.tsx` existe (proto mock avec `mobile/src/components/hub/*`) mais est caché de la TabBar (`href: null`) et utilise des données fixtures (`SAMPLE_CONVERSATIONS`/`SAMPLE_MESSAGES`). Aucun branchement backend.
3. **3 surfaces chat dispersées** : Quick Chat URL input sur Home (`mobile/app/(tabs)/index.tsx`) → push `analysis/[id]?quickChat=true` qui rend `ConversationScreen` Modal ; ChatView dans tab Chat de l'analyse ; FAB Voice qui ouvre `ConversationScreen` Modal en mode `call`. Aucune cohérence "une seule conversation, une seule UI" comme côté web.

**Vision cible** :

- **Hub = onglet stable** dans la TabBar mobile (déshider `href: null`).
- **Hub = `ConversationScreen` embedded** (réutilise tous les composants `mobile/src/components/conversation/*` créés par PR1 du sprint 2026-05-02) — chat + voice unifiés dans la même UI.
- **Drawer conversations à gauche** (`ConversationsDrawer`, déjà existant côté hub mock) pour switcher entre analyses.
- **Quick Chat Home** reste sur Home, mais navigue vers tab Hub au lieu de l'écran Analysis Modal.
- **ChatView du tab analyse** supprimé, redirige vers Hub.
- **Quick Call directement accessible** depuis l'`InputBar` du Hub via le toggle mic (Alert confirm avant consommation quota), en plus du fix du FAB sur l'écran analyse classique (cas legacy).

---

## 2. Objectifs

1. **Tab Hub stable** : `mobile/app/(tabs)/hub.tsx` apparaît dans `CustomTabBar` (6 onglets : Accueil · Historique · **Hub** · Étude · Abo · Profil — voir §3 décision #4 pour l'ordre).
2. **Une seule UI conversationnelle** : `ConversationContent.tsx` extrait du `ConversationScreen` Modal pour être réutilisable en tab. Modal devient un wrapper léger pour les call-sites legacy ; tab Hub rend `ConversationContent` directement.
3. **Quick Call accessible** : depuis le Hub (via mic toggle dans `ConversationInput`) ET depuis le FAB analyse classique (avec fix de `bottomOffset` pour utiliser `useTabBarFootprint`).
4. **Multi-conversation switch sans démontage** : `useConversation` accepte `summaryId` qui peut changer ; le drawer pilote ce changement.
5. **Suppression des duplications** : composants `mobile/src/components/hub/*` (Timeline mock, InputBar mock, CallModeFullBleed mock) → soit supprimés, soit migrés. ChatView du tab analyse → supprimé. `analysis/[id].tsx` mode `quickChat=true` (lignes 445-462) → supprimé (Quick Chat depuis Home pousse directement sur tab Hub).

---

## 3. Décisions verrouillées (brainstorm 2026-05-04)

| #   | Décision                                 | Choix retenu                                                                                                                                                                                                                                                                                                                      |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Hub = onglet stable                      | **OUI**, déshider `href: null`, ajouter à `TAB_META` de `CustomTabBar.tsx`                                                                                                                                                                                                                                                        |
| 2   | Hub UI                                   | **`ConversationContent` embedded** + `ConversationsDrawer` swipe-in left. Pas de "dashboard launchpad". L'user arrive sur la dernière conv ouverte (ou empty state).                                                                                                                                                              |
| 3   | Sort de `ConversationScreen` Modal       | **Conservé** comme wrapper Modal léger pour les call-sites qui doivent pop-up sans navigation tab (futur). Refactor : extrait `ConversationContent.tsx` avec tout le layout, `ConversationScreen.tsx` devient `<Modal><ConversationContent /></Modal>` (~30 lignes).                                                              |
| 4   | Quick Chat Home                          | **Reste sur Home** (`mobile/app/(tabs)/index.tsx` ligne 391-466). Au submit `videoApi.quickChat(url)` → `router.push('/(tabs)/hub?summaryId=X&initialMode=chat')` au lieu de `/analysis/[id]?quickChat=true`. Suppression du mode `quickChat` dans `analysis/[id].tsx`.                                                           |
| 5   | ChatView dans tab Chat analyse           | **Supprimé** (`mobile/src/components/analysis/ChatView.tsx` ❌). Tab "Chat" du PagerView remplacé par bouton "Continuer dans le Hub" qui push `/(tabs)/hub?summaryId=X&initialMode=chat`. Ou : tab Chat retiré complètement → 2 tabs (Résumé · Sources). Décision §13 #1 ouverte.                                                 |
| 6   | FAB Voice sur analyse                    | **Conservé** sur `analysis/[id].tsx` (entry point alternatif). Fix `bottomOffset` pour utiliser `useTabBarFootprint` (cohérence sprint 2026-05-03). Cible : `bottomOffset = useTabBarFootprint() + ACTION_BAR_HEIGHT + FAB_GAP`.                                                                                                  |
| 7   | Composants `mobile/src/components/hub/*` | **Audit + tri** : conserver `ConversationsDrawer`, `HubHeader` (refacto), `SummaryCollapsible`, `VideoPiPPlayer`, `SourcesShelf`. Supprimer `Timeline`, `InputBar`, `CallModeFullBleed`, `MessageBubble`, `VoiceBubble`, `VoiceWaveformBars`, `DeepSightLogo`, `sampleData.ts` (remplacés par leurs équivalents `conversation/`). |
| 8   | Audio user invisible                     | **Asymétrique** (règle UX permanente, mémoire `feedback_voice-fil-asymetrique.md` confirmée 2026-05-04). Audio agent affiché badge 🎙️, audio user JAMAIS affiché. Filtrage déjà appliqué dans `useConversation` ligne 116.                                                                                                        |
| 9   | Multi-conversation switch                | **`useConversation` accepte `summaryId` mutable** : le drawer change `selectedSummaryId` state du tab Hub, qui re-pass à `ConversationContent` qui lui-même re-pass à `useConversation`. Audit du hook nécessaire (gérer reset interne propre vs `key={summaryId}` remount).                                                      |
| 10  | Routing Expo Router                      | **`/(tabs)/hub`** index avec query params `?summaryId=X&initialMode=chat\|call&videoUrl=...`. Pas de route nested `/hub/[summaryId]` (over-engineered, l'écran reste single avec drawer).                                                                                                                                         |
| 11  | Empty state Hub                          | **`EmptyConversationSuggestions`** (existant `mobile/src/components/conversation/EmptyConversationSuggestions.tsx`, intégré PR #277) si pas de summary chargé. Suggestions chips pré-remplies + CTA "Coller un lien YouTube/TikTok" (réutilise URL input pattern Home).                                                           |
| 12  | Sub-agents implémentation                | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`)                                                                                                                                                                                                                                                                                  |
| 13  | Branche                                  | `feat/mobile-hub-tab-unified` depuis `origin/main`. Worktree `C:\Users\33667\DeepSight-mobile-hub-tab`.                                                                                                                                                                                                                           |
| 14  | Scope backend                            | **Aucun changement requis**. `videoApi.getHistory`, `chatApi.getHistory`, `useConversation` tous existants et fonctionnels. Possible micro-fix passthrough champs voice si non encore vérifié sur `mobile/src/services/api.ts` (cf. spec 2026-05-02 §11.1 sanity check).                                                          |

---

## 4. Architecture macro — Mobile

### 4.1 Layout général

```
┌─ TabBar globale (CustomTabBar — 6 onglets dont nouveau "Hub") ────┐
│ [🏠 Accueil] [⏱ Historique] [💬 HUB] [📚 Étude] [✨ Abo] [⚙ Profil] │
└────────────────────────────────────────────────────────────────────┘

Quand tab Hub actif :

┌─ /(tabs)/hub.tsx ──────────────────────────────────────────────────┐
│                                                                    │
│  state local : selectedSummaryId (depuis params route OU drawer)   │
│                                                                    │
│  if (!selectedSummaryId) :                                         │
│    <HubEmptyState onPickConv={..} onPasteUrl={..} />               │
│  else :                                                            │
│    <ConversationContent                                            │
│      summaryId={selectedSummaryId}                                 │
│      videoUrl={params.videoUrl}                                    │
│      initialMode={params.initialMode || 'chat'}                    │
│      onClose={() => setSelectedSummaryId(null)}                    │
│    />                                                              │
│                                                                    │
│  <ConversationsDrawer                                              │
│    open={drawerOpen}                                               │
│    onClose={..}                                                    │
│    activeSummaryId={selectedSummaryId}                             │
│    onSelect={(id) => setSelectedSummaryId(id)}                     │
│    onNewConv={() => setSelectedSummaryId(null)}                    │
│  />                                                                │
└────────────────────────────────────────────────────────────────────┘
```

### 4.2 `ConversationContent.tsx` (NEW — extracted from ConversationScreen)

**Fichier** : `mobile/src/components/conversation/ConversationContent.tsx`

Tout le layout actuel de `ConversationScreen.tsx` lignes 232-296 (le contenu intérieur du Modal) est extrait dans ce nouveau composant. Props identiques sauf suppression de `visible` et `onClose` qui restent côté wrapper Modal.

```typescript
export interface ConversationContentProps {
  summaryId?: string;
  videoUrl?: string;
  initialMode: "chat" | "call";
  videoTitle: string;
  channelName?: string;
  platform?: "youtube" | "tiktok" | "live";
  initialFavorite?: boolean;
  /** Bouton burger en haut-gauche (ouvrir ConversationsDrawer côté Hub).
   *  Si null/undefined : pas de burger affiché (mode Modal classique). */
  onMenuPress?: () => void;
  /** Bouton close en haut-droite (Modal mode). Si null : pas de close. */
  onClose?: () => void;
}

export const ConversationContent: React.FC<ConversationContentProps> = (
  props,
) => {
  const conv = useConversation({
    summaryId: props.summaryId,
    videoUrl: props.videoUrl,
    initialMode: props.initialMode,
  });
  // ... tout le rendu actuel ConversationScreen lignes 232-296
};
```

### 4.3 `ConversationScreen.tsx` (REFACTOR — wrapper Modal léger)

**Fichier** : `mobile/src/components/conversation/ConversationScreen.tsx`

Devient un wrapper d'environ 40 lignes :

```typescript
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
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View
        entering={FadeIn.duration(duration.slow)}
        style={[{ flex: 1, backgroundColor: colors.bgPrimary }]}
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
```

### 4.4 `mobile/app/(tabs)/hub.tsx` (REWRITE)

**Fichier** : `mobile/app/(tabs)/hub.tsx`

Remplacement complet de l'actuel proto mock :

```typescript
import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ConversationContent } from "@/components/conversation/ConversationContent";
import { ConversationsDrawer } from "@/components/hub/ConversationsDrawer";
import { HubEmptyState } from "@/components/hub/HubEmptyState";
import { historyApi } from "@/services/api";

export default function HubScreen() {
  const params = useLocalSearchParams<{
    summaryId?: string;
    videoUrl?: string;
    initialMode?: "chat" | "call";
  }>();
  const router = useRouter();

  // Source of truth = params (deep-link friendly). Drawer mutate via router.setParams.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const summaryId = params.summaryId ?? null;
  const initialMode = params.initialMode ?? "chat";

  // Last opened conv fallback : si pas de params, charger la dernière analyse
  const { data: lastConv } = useQuery({
    queryKey: ["history", "last-conv"],
    queryFn: async () => {
      const r = await historyApi.getHistory(1, 1);
      return r.items[0] ?? null;
    },
    enabled: !summaryId, // only when no explicit summaryId
  });

  // Auto-resolve : si pas summaryId mais lastConv existe → remplir params
  useEffect(() => {
    if (!summaryId && lastConv?.id) {
      router.setParams({ summaryId: String(lastConv.id), initialMode: "chat" });
    }
  }, [summaryId, lastConv, router]);

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

  return (
    <View style={styles.root}>
      {summaryId ? (
        <ConversationContent
          key={summaryId} // remount on switch — propre pour reset state useConversation
          summaryId={summaryId}
          initialMode={initialMode}
          videoTitle={lastConv?.title ?? "Conversation"} // refined via useQuery sur summary
          channelName={lastConv?.channel}
          platform={(lastConv?.platform as "youtube" | "tiktok") ?? "youtube"}
          initialFavorite={lastConv?.isFavorite}
          onMenuPress={() => setDrawerOpen(true)}
          // pas de onClose : on est en tab, pas en Modal
        />
      ) : (
        <HubEmptyState
          onPickConv={() => setDrawerOpen(true)}
          onPasteUrl={(url) => {
            // Inline quick-chat depuis Hub : appeler videoApi.quickChat puis setParams
            // (cf. logique handleQuickChat de Home, factoriser en hook useQuickChatNavigate)
          }}
        />
      )}

      <ConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeSummaryId={summaryId}
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

### 4.5 `CustomTabBar` — ajouter Hub

**Fichier** : `mobile/src/components/navigation/CustomTabBar.tsx`

Étendre `TAB_META` (ligne 39-60) avec :

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

Et `mobile/app/(tabs)/_layout.tsx` ligne 52-58 : retirer `href: null` du `Tabs.Screen name="hub"` :

```typescript
<Tabs.Screen
  name="hub"
  options={{
    title: "Hub",
  }}
/>
```

L'ordre dans le code source détermine l'ordre dans la TabBar (Expo Router). Ordre cible : `index`, `library`, `hub`, `study`, `subscription`, `profile` (Hub au centre = pouce-friendly, position d'honneur).

### 4.6 `HubEmptyState` (NEW)

**Fichier** : `mobile/src/components/hub/HubEmptyState.tsx`

Composant simple :

- Icône logo DeepSight
- Texte "Aucune conversation ouverte"
- 2 CTA :
  - "Coller un lien YouTube/TikTok" → opens inline URL input → `handleQuickChat` (réutilise pattern Home `handleQuickChat` lignes 76-111)
  - "Choisir une conversation" → `onPickConv()` → ouvre drawer
- Bonus : 3 chips suggestions (réutilise `EmptyConversationSuggestions`)

### 4.7 Migration des call-sites

**`mobile/app/(tabs)/index.tsx` (Home)** :

Modifier `handleQuickChat` ligne 76-111 :

```typescript
const handleQuickChat = useCallback(async () => {
  // ... validation URL identique
  setQuickChatLoading(true);
  try {
    const result = await videoApi.quickChat(url);
    setQuickChatUrl("");
    // CHANGEMENT : push vers tab Hub au lieu de analysis/[id]
    router.push({
      pathname: "/(tabs)/hub",
      params: {
        summaryId: String(result.summary_id),
        initialMode: "chat",
      },
    } as never);
  } catch (err: any) {
    /* identique */
  } finally {
    setQuickChatLoading(false);
  }
}, [quickChatUrl]);
```

**`mobile/app/(tabs)/analysis/[id].tsx`** :

- Supprimer le bloc Quick Chat mode lignes 442-462 (`if (isQuickChat && summary)` → `<ConversationScreen ... />`).
- Tab "Chat" du PagerView (ligne 420-425) → remplacé par soit :
  - **Variante A (recommandée)** : un placeholder card "Continuer la conversation" → bouton qui push `/(tabs)/hub?summaryId={id}&initialMode=chat`
  - **Variante B (clean)** : retirer complètement le tab Chat → 2 tabs au lieu de 3 (`Résumé`, `Sources`)
- Fix `VoiceButton` ligne 696-705 : passer `bottomOffset={useTabBarFootprint() + ACTION_BAR_HEIGHT + FAB_GAP}` à la place du calcul interne.

**Suppression** :

- `mobile/src/components/analysis/ChatView.tsx` ❌
- `mobile/src/components/analysis/ChatInput.tsx` ❌ (uniquement utilisé par ChatView)
- `mobile/src/components/analysis/ChatMarkdown.tsx` ❌ (idem si pas réutilisé ailleurs — à vérifier via grep)
- `mobile/src/components/hub/Timeline.tsx` ❌ (mock, remplacé par ConversationFeed)
- `mobile/src/components/hub/InputBar.tsx` ❌ (mock, remplacé par ConversationInput)
- `mobile/src/components/hub/CallModeFullBleed.tsx` ❌ (mock, remplacé par VoiceControls + EndedToast)
- `mobile/src/components/hub/MessageBubble.tsx` ❌ (mock, remplacé par ConversationFeedBubble)
- `mobile/src/components/hub/VoiceBubble.tsx` ❌ (mock, intégré dans ConversationFeedBubble)
- `mobile/src/components/hub/VoiceWaveformBars.tsx` ❌ (mock — sauf si réutilisé par VoiceControls, à grep)
- `mobile/src/components/hub/sampleData.ts` ❌
- `mobile/src/components/hub/types.ts` ❌ (sauf si réutilisé)
- `mobile/src/components/hub/__tests__/*` ❌ (tests des composants supprimés)

**Conservation** :

- `mobile/src/components/hub/HubHeader.tsx` (refacto pour accepter onMenuPress depuis Hub tab — déjà compatible)
- `mobile/src/components/hub/ConversationsDrawer.tsx` (réutilisé tel quel + brancher backend `historyApi.getHistory`)
- `mobile/src/components/hub/SummaryCollapsible.tsx` (intégrable dans ConversationContent si on veut afficher le summary collapsed au-dessus du fil — décision §13 #2 ouverte)
- `mobile/src/components/hub/VideoPiPPlayer.tsx` (intégrable dans ConversationContent header — décision §13 #2 ouverte)
- `mobile/src/components/hub/SourcesShelf.tsx` (intégrable dans ConversationContent footer — idem §13 #2)

### 4.8 États & flows clés

| État Hub                                | Ce qui s'affiche                                                                                              |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pas de summaryId, pas de last conv      | `<HubEmptyState />` (icone, CTAs, suggestions)                                                                |
| Pas de summaryId, last conv existe      | Auto-resolve : `setParams` → re-render avec `summaryId` (animation FadeIn `ConversationContent`)              |
| `summaryId` présent, `initialMode=chat` | `<ConversationContent />` mode chat, mic gris, fil chargé                                                     |
| `summaryId` présent, `initialMode=call` | `<ConversationContent />` mode call, auto-start mic via `useConversation` ligne 124-132                       |
| Switch conv via drawer                  | `setParams({summaryId: newId})` → `key={summaryId}` provoque remount `ConversationContent` propre             |
| Tab switch (vers Library, etc.)         | Hub démontage standard. Au retour : params persistés par Expo Router → reprend la conv où l'user s'est arrêté |

### 4.9 Edge cases

- **Voice live + tab switch** : si l'user est en voice live et change de tab → le Hub démontage → `useConversation` cleanup ferme la session voice (via `useEffect` cleanup `voice.stop()`). Pas idéal (perte UX), mais acceptable V1. Décision §13 #3 ouverte (KeepAlive ?).
- **Quick Chat depuis Home pendant call live dans Hub** : Home `router.push` vers Hub → `ConversationContent` remount avec nouveau `summaryId` → call précédent terminé. Ok.
- **Drawer ouvert + user tap conv** : `setParams` + close drawer en parallèle → `key={summaryId}` remount → animation visible (acceptable).
- **Push notification deep-link** vers `/(tabs)/hub?summaryId=X` : Expo Router gère, le tab Hub mount avec params → fonctionne.

---

## 5. Fix Quick Call invisible — root cause

**Symptôme** : "Je ne vois toujours pas le Quick Call sur une vidéo sur le site mobile."

**Diagnostic** :

1. **Cause principale** : Quick Call n'est exposé nulle part en tant que feature first-class. Le `VoiceButton` (FAB gold pulse) n'apparaît que sur `analysis/[id].tsx` ligne 696-705 quand `summary` est chargé. Sur Home, sur Library, sur Study : aucun entry voice.
2. **Cause secondaire** : sur `analysis/[id].tsx`, le FAB calcule son `bottomOffset` manuellement (`TAB_BAR_HEIGHT (56) + ACTION_BAR_HEIGHT (72) + FAB_GAP (16) + insets.bottom = ~144 + insets`). Depuis le sprint UX 2026-05-03 (PR #274), la TabBar globale utilise `useTabBarFootprint` qui inclut `Math.max(insets.bottom, sp.sm) + sp.md`. Le calcul du FAB peut sous-estimer la hauteur réelle si `insets.bottom < sp.sm`, masquant partiellement le bouton derrière la TabBar.
3. **Cause tertiaire** : quand l'user vient de Home via Quick Chat URL (Home ligne 94-102 → `/analysis/[id]?quickChat=true`), il atterrit directement sur `ConversationScreen` Modal (analysis ligne 445-462) qui n'expose **pas** le FAB voice — seulement le toggle mic dans l'`InputBar`, peu découvrable.

**Fix dans ce sprint** :

- **Hub tab** = exposition first-class de Quick Call accessible depuis le toggle mic dans le `ConversationInput` du Hub, ainsi que le bouton "Démarrer un appel" dans le `HubEmptyState` (proposé §13 #4).
- **VoiceButton bottomOffset** = utiliser `useTabBarFootprint()` au lieu de la constante hardcodée :

```typescript
// mobile/src/components/voice/VoiceButton.tsx
import { useTabBarFootprint } from "@/hooks/useTabBarFootprint";

const tabFootprint = useTabBarFootprint();
const computedBottom =
  bottomOffset ?? tabFootprint + ACTION_BAR_HEIGHT + FAB_GAP;
```

- **Suppression du mode `quickChat` dans analysis/[id].tsx** (lignes 442-462) puisque Quick Chat depuis Home navigue maintenant vers Hub.

---

## 6. Backend — aucun changement requis

Identique au constat de la spec 2026-05-02 §6 : la timeline chat + voice est déjà unifiée backend.

- `chatApi.getHistory(summary_id)` retourne tout (text + voice agent + voice user, le filtre user est UI-side).
- `videoApi.quickChat(url)` retourne `summary_id` (utilisé par Home + Hub `HubEmptyState`).
- `historyApi.getHistory(page, perPage)` pour `ConversationsDrawer`.
- `videoApi.upgradeQuickChat(summaryId, mode)` déjà câblé dans `MiniActionBar`.

Sanity check optionnel : grep `mobile/src/services/api.ts` pour confirmer que `chatApi.getHistory` mappe bien `source/voice_speaker/voice_session_id/time_in_call_secs` (sinon fix passthrough cf. spec 2026-05-02 §11.1).

---

## 7. Phasage — 1 PR (sub-agents séquentiels)

| Sub-agent | Scope                                                                                                                                                          | Effort  | Dépend de |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| Agent A   | **Foundation** : extract `ConversationContent` depuis `ConversationScreen` (refacto wrapper Modal) + tests Jest passants                                       | 0,5–1 j | —         |
| Agent B   | **Hub tab** : rewrite `mobile/app/(tabs)/hub.tsx` + `HubEmptyState` + déshider `href:null` + ajout `hub` à `TAB_META` + brancher `ConversationsDrawer` backend | 1–1,5 j | Agent A   |
| Agent C   | **Migration call-sites** : Home `handleQuickChat` push Hub + analysis `[id].tsx` cleanup quickChat mode + suppression ChatView + fix VoiceButton bottomOffset  | 0,5–1 j | Agent B   |
| Agent D   | **Cleanup + tests** : suppression composants `hub/*` mock + tests Jest mis à jour + smoke iOS/Android + EAS update preview                                     | 0,5–1 j | Agent C   |

**Total : 2,5–4,5 jours Opus 4.7 sub-agents séquentiels** (Agent A doit finir avant B, etc.).

**Variante parallèle** : Agent A solo, puis Agent B + Agent C en parallèle (B touche `hub.tsx` + `(tabs)/_layout.tsx`, C touche `index.tsx` + `analysis/[id].tsx` — pas de chevauchement). Agent D séquentiel après A+B+C. **Total : 2–3 jours**.

---

## 8. Risques et mitigations

| Risque                                                                                                              | Mitigation                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useConversation` ne supporte pas le change de `summaryId` à chaud (state interne pollué)                           | `key={summaryId}` sur `<ConversationContent />` force remount propre. Coût : animation visible au switch (acceptable). Alternative : refactor `useConversation` pour reset interne, plus risqué. |
| Voice live + tab switch perd la session sans warning                                                                | V1 : cleanup auto. V2 : ajouter Alert "Vous êtes en appel — quitter le Hub terminera la session. Continuer ?" si `voiceMode === 'live'` (décision §13 #3)                                        |
| `ConversationsDrawer` actuel utilise mock data — branchement backend non-trivial                                    | Audit du composant (Agent B Task 1) avant rewrite. Probable refactor : ajouter prop `conversations` (provenant de `historyApi.getHistory` côté tab Hub).                                         |
| Suppression `mobile/src/components/hub/Timeline.tsx` casse import dans `hub.tsx` proto                              | Le rewrite `hub.tsx` (Agent B) supprime tous les imports vers ces composants. Vérifier via grep avant delete (Agent D Task 1).                                                                   |
| `analysis/[id].tsx` mode `quickChat=true` (ligne 443-462) référencé par d'autres call-sites (Library long-press ?)  | grep `quickChat=true\|quickChat: "true"\|quickChat: 'true'` cross-repo. Migration tous les call-sites vers tab Hub. Estimé 2-3 occurrences max.                                                  |
| Régression sprint UX 2026-05-03 (DismissKeyboard, edge-to-edge, useTabBarFootprint)                                 | `ConversationContent` reprend tel quel le layout actuel `ConversationScreen` qui inclut déjà `DismissKeyboard`/edge-to-edge. Smoke test obligatoire (Agent D).                                   |
| Tab Hub apparaît mais les params `summaryId` ne s'auto-clean pas au tab switch → user revient et voit ancienne conv | Comportement souhaité (persistance UX). Si problème user : `useFocusEffect` clear params. Décision §13 #5 ouverte.                                                                               |
| `EmptyConversationSuggestions` (PR #277) hardcodé pour ChatView — refactor pour usage Hub empty state               | Adapter pour accepter `onSuggestionPress` callback générique. Déjà fait normalement (composant générique selon le code récent).                                                                  |
| `VoiceButton` fix `bottomOffset` casse les autres call-sites (Library/Study)                                        | `useTabBarFootprint` retourne aussi 0 si TabBar cachée (mode fullscreen). Vérifier que `bottomOffset` est `null`-safe sur Library/Study (qui passent leur propre offset).                        |

---

## 9. Métriques de succès (PostHog)

- `hub_tab_opened` (segmenté par source : tab_press, deep_link, home_quick_chat_redirect, library_select)
- `hub_conversation_switched` (drawer click)
- `hub_new_conv_started` (drawer "+ Nouvelle conversation" ou empty state CTA)
- `hub_voice_started_from_input_mic` (mic toggle dans ConversationInput Hub) — **KPI clé**
- `hub_chat_to_call_promoted_via_alert` (confirm Alert Démarrer l'appel) — KPI Quick Call discoverability
- `analysis_chat_tab_redirect_to_hub_clicked` (si variante A retenue §13 #1)
- `voice_button_visible_count` (quotidien, vérifie que le FAB n'est plus masqué) — sanity check Quick Call invisible fix
- **KPI primary** : taux de session Quick Call lancées par jour AVANT vs APRÈS sprint. Cible : ≥ 2x.

---

## 10. Tests

### 10.1 Mobile (Jest, Agent D)

- `mobile/__tests__/app/hub.test.tsx` (NEW) :
  - `renders HubEmptyState when no summaryId param`
  - `renders ConversationContent when summaryId param present`
  - `setParams on drawer select`
  - `setParams undefined on drawer new conv`
  - `auto-resolves last conv when no summaryId and history has items`
- `mobile/__tests__/components/hub/HubEmptyState.test.tsx` (NEW) :
  - `renders 3 suggestion chips`
  - `onPasteUrl called when URL pasted and submit`
  - `onPickConv called when "Choisir une conversation" tapped`
- `mobile/__tests__/components/conversation/ConversationContent.test.tsx` (REFACTOR — était `ConversationScreen.test.tsx`, déplacer la majorité des cases) :
  - mêmes 9 cases que spec 2026-05-02 §11.2, sans le wrapper Modal
- `mobile/__tests__/components/conversation/ConversationScreen.test.tsx` (NEW minimal — wrapper Modal) :
  - `renders Modal with visible=true`
  - `calls onClose on Modal onRequestClose`
  - `passes contentProps to ConversationContent`
- Mise à jour : suppression de `mobile/src/components/analysis/ChatView.tsx` → suppression `mobile/src/components/analysis/__tests__/ChatView.test.tsx` si existe.

### 10.2 Smoke E2E manuel (Agent D, post-build)

**iOS + Android** :

1. Open app → tap "Hub" tab → vérifier `HubEmptyState` apparaît (si pas de last conv) ou la dernière conv est chargée (si history ≥ 1)
2. Tap burger → `ConversationsDrawer` slide-in → sélectionner une conv → drawer ferme + `ConversationContent` re-render avec la conv sélectionnée
3. Sur Hub avec conv chargée → tap mic dans `ConversationInput` → Alert "Démarrer l'appel ?" → confirm → voice live → bulle agent 🎙️ apparaît
4. Tap End → toast 3s → retour mode chat → mic gris
5. Sur Home → coller URL YouTube → tap Quick Chat → vérifier navigation vers tab Hub avec `summaryId` correct + initialMode=chat
6. Sur tab Hub avec conv → tap "Bibliothèque" → tap "Hub" → vérifier que la même conv est restaurée (params persistés)
7. Sur `analysis/[id].tsx` (via Library tap card) → vérifier FAB Voice gold visible **et accessible** (pas masqué TabBar)
8. Sur `analysis/[id].tsx` → vérifier que tab "Chat" affiche soit le placeholder bouton "Continuer dans le Hub" (variante A §13 #1) soit n'existe plus (variante B)
9. EAS update preview → smoke même flow sur build prod

---

## 11. Critères d'acceptation

- [ ] Tab `Hub` visible dans la TabBar mobile (6 onglets dont Hub au centre)
- [ ] Tap tab Hub → `HubEmptyState` (si vide) ou `ConversationContent` (si last conv resolved)
- [ ] `ConversationsDrawer` swipe-in left, liste conversations depuis backend (`historyApi.getHistory`)
- [ ] Switch conv via drawer → re-render propre, pas de fuite état précédent
- [ ] Mic toggle dans `ConversationInput` du Hub → Alert confirm → voice live (Quick Call discoverable)
- [ ] Quick Chat URL Home → push tab Hub (pas analysis/[id]?quickChat)
- [ ] Tab "Chat" de `analysis/[id].tsx` → variante A (CTA Hub) OU variante B (tab supprimé) — selon décision §13 #1
- [ ] FAB Voice sur `analysis/[id].tsx` plus jamais masqué par TabBar (utilise `useTabBarFootprint`)
- [ ] Audio user invisible respecté (bulles agent voice 🎙️ visibles, bulles user voice non visibles)
- [ ] Suppression effective : `ChatView.tsx`, `Timeline.tsx` mock, `InputBar.tsx` mock, `CallModeFullBleed.tsx`, etc.
- [ ] Tests Jest verts (`useConversation`, `ConversationContent`, `Hub`, `HubEmptyState`)
- [ ] Smoke iOS + Android : tous les flows §10.2 OK
- [ ] EAS update preview live et testé

---

## 12. Décisions ouvertes (à valider en review user — 5 décisions)

| #   | Décision                                                                                                     | Défaut proposé                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tab "Chat" de `analysis/[id].tsx` : placeholder CTA vers Hub (variante A) OU suppression du tab (variante B) | **Variante A** (CTA "Continuer dans le Hub"). Maintient la découvrabilité du chat depuis l'analyse. Variante B casse l'habitude actuelle et oblige l'user à connaître le tab Hub.                 |
| 2   | Intégrer `SummaryCollapsible` + `VideoPiPPlayer` + `SourcesShelf` dans `ConversationContent` (pour Hub)      | **Pas dans ce sprint** (V1 minimal). Le Hub mobile garde le layout actuel `ConversationContent` (header + feed + voice + input). Intégration richer (résumé collapsible + PiP) en V2 spec dédiée. |
| 3   | Voice live + tab switch : warning Alert OU cleanup silencieux                                                | **Cleanup silencieux V1** (comportement Modal actuel). V2 si feedback user négatif → Alert "Quitter le Hub terminera l'appel ?".                                                                  |
| 4   | `HubEmptyState` : 1 ou 2 CTA (URL paste, pick conv, démarrer call vide)                                      | **2 CTA** : "Coller un lien YouTube/TikTok" + "Choisir une conversation". Pas de "démarrer un call sans vidéo" (mode `companion` non scope V1, déjà tranché spec 2026-04-27 §3 décision tacite).  |
| 5   | Persistance `?summaryId=` au tab switch                                                                      | **OUI** (Expo Router params persistent par défaut). Si pas souhaité → `useFocusEffect` clear params au unmount. Décision : laisser persister (UX = reprendre où on était).                        |

---

## 13. Méga-plan d'implémentation

Le découpage en sous-agents Opus 4.7 sera produit par invocation de la skill `writing-plans` après approbation de ce spec. Vue macro :

- **Agent A — Foundation** : extract `ConversationContent` depuis `ConversationScreen` (refacto wrapper Modal), tests Jest. Estimation : 0,5–1 jour.
- **Agent B — Hub tab** : rewrite `mobile/app/(tabs)/hub.tsx`, créer `HubEmptyState`, déshider `href:null`, ajout `hub` à `TAB_META`, brancher `ConversationsDrawer` backend. Estimation : 1–1,5 jour.
- **Agent C — Migration call-sites** : `index.tsx` push Hub, `analysis/[id].tsx` cleanup quickChat mode, suppression ChatView, fix VoiceButton bottomOffset. Estimation : 0,5–1 jour.
- **Agent D — Cleanup + tests** : suppression composants `hub/*` mock, tests Jest mis à jour, smoke iOS/Android, EAS update preview. Estimation : 0,5–1 jour.

Possibilité parallélisation B + C après A, voir §7. **Toutes les invocations Agent doivent utiliser `model: claude-opus-4-7[1m]`** (mémoire user perma).

---

## 14. Lien avec specs antérieures

- **Étend** : `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md` (refacto extract ConversationContent + ajout call-site Hub tab)
- **Réfère** : `docs/superpowers/specs/2026-05-03-hub-nav-redesign-design.md` (pattern Hub WEB — tab sticky + InputBar context-aware — mais NON appliqué tel quel mobile car layout Modal natif est différent du web sticky scrollable)
- **Réfère** : `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` (backend `explorer_streaming` partagé, déjà mergé)

---

_Spec produit en mode brainstorming Superpowers (Opus 4.7). À reviewer et committer sur `main` avant lancement de la writing-plans skill._
