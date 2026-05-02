---
title: Quick Chat + Quick Call Unified Design (Mobile + Extension)
date: 2026-05-02
type: spec
tags:
  - projet/deepsight
  - type/spec
  - platform/mobile
  - platform/extension
status: draft
supersedes:
  - docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md (UI portion only)
---

# Quick Chat + Quick Call Unified — Design

**Date** : 2026-05-02
**Auteur** : Maxime Le Parc (DeepSight)
**Statut** : Draft — en attente de revue
**Source** : Brainstorm session 2026-05-02 (Opus 4.7, après /clear)
**Plateformes ciblées** : Mobile (Expo) + Extension Chrome
**Plateforme web** : hors-scope (statu quo Quick Chat actuel)

---

## 1. Contexte et problème

Aujourd'hui, sur DeepSight Mobile et Extension :

- **Quick Chat** est un écran/drawer **dédié** (full-screen sur mobile via `QuickChatScreen.tsx`, drawer sur extension via `ChatDrawer.tsx`).
- **Quick Voice Call** (V1 extension PR #149 mergée 2026-04-27, V3 mobile partiellement implémentée) ouvre un **autre écran** modal (`VoiceScreen.tsx`) avec contrôles voice + transcript séparé.
- Après hangup voice : navigation vers un **3e écran** `PostCallScreen.tsx` (mobile) avec récapitulatif et CTAs.

L'utilisateur expérimente donc **3 surfaces UI distinctes** pour ce qui devrait être une **seule conversation**. Chaque transition coûte un loading state et fragmente l'historique.

**Vision cible** : une **seule UI conversationnelle** où :

- Quick Chat = entrer dans cette UI **sans démarrer le micro** (mode chat texte).
- Quick Call = entrer dans cette UI **avec auto-start du micro** (mode voice + texte cohabitent).
- Pendant un call, l'user peut **taper du texte** (envoyé à l'agent vocal qui répond à l'oral).
- Pendant un chat texte, l'user peut **toggle le micro ON** pour lancer un call sans changer d'écran (avec confirmation quota).
- **Après un hangup**, retour fluide au mode chat dans la même UI (pas de PostCallScreen).

---

## 2. Objectifs

1. **Une seule conversation, une seule UI** : fusionner Quick Chat + Quick Call + PostCallScreen en un unique `ConversationScreen` (mobile) / `ConversationDrawer` (extension).
2. **Fil unique mixté** : messages chat texte ET transcripts voice agent dans la même liste, triés chronologiquement, avec badge `🎙️` distinctif pour les bulles voice.
3. **Asymétrie audio respectée** : audio user (parole captée par le mic) JAMAIS affiché dans le fil. Audio agent ElevenLabs (transcript) TOUJOURS affiché. Texte écrit clavier (user et agent) TOUJOURS affiché. Cf. règle UX permanente DeepSight (cross-platform).
4. **Two-pane mobile** : zone chat scrollable en haut, zone voice contrôles en bas. Layout statique, pas de bascule d'écran.
5. **Confirmation explicite avant consommation quota voice** : toggle mic OFF→ON depuis chat = `Alert.alert("Démarrer l'appel ? (X min restantes)")` puis start.
6. **Scope mobile + extension** : web hors-scope. La PR #149 V1 extension étant déjà mergée, la PR3 extension est une simple refonte (pas une livraison V1).
7. **Réutilisation maximale des hooks existants** : `useChat`, `useVoiceChat`, `useStreamingVideoContext`. Pas de refactor backend du chat ou de la persistance transcripts (juste 1 endpoint de lecture à ajouter).

---

## 3. Décisions verrouillées (brainstorm 2026-05-02)

| #   | Décision                                       | Choix retenu                                                                                                                                                                                                                     |
| --- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Modèle UI                                      | **Two-pane** : chat haut (FlatList inverted) + zone voice bas (controls)                                                                                                                                                         |
| 2   | Timeline                                       | **Fil unique mixté** : `UnifiedMessage[]` = chat texte + transcripts voice agent triés par timestamp                                                                                                                             |
| 3   | Audio user dans fil                            | **Jamais affiché** (règle UX product DeepSight, applicable à toutes futures features voice)                                                                                                                                      |
| 4   | Audio agent ElevenLabs                         | **Affiché** dans le fil avec badge `🎙️` à côté de la bulle                                                                                                                                                                       |
| 5   | Toggle mic OFF→ON depuis chat                  | **Confirm dialog** natif (`Alert.alert`) avant `voice.start()`                                                                                                                                                                   |
| 6   | Scope plateformes                              | **Mobile + Extension**, web hors-scope                                                                                                                                                                                           |
| 7   | Post-call UX                                   | **Retour fluide** à l'UI unifiée (PostCallScreen supprimé). Toast "✅ Appel terminé · X:XX min" + mini action bar avec CTA "Voir l'analyse complète"                                                                             |
| 8   | Architecture mobile                            | **Nouveau `ConversationScreen.tsx`** + hook unifié `useConversation` qui orchestre `useChat` + `useVoiceChat` + `useStreamingVideoContext`                                                                                       |
| 9   | VoiceControls layout (état 'live')             | **2 boutons** : Mute + End. End = hangup ET focus auto sur l'input texte (concept "Mode chat" implicite)                                                                                                                         |
| 10  | QuickChatScreen + VoiceScreen + PostCallScreen | **Supprimés** en fin de PR mobile (callsites migrés). Pas conservés en legacy.                                                                                                                                                   |
| 11  | Sous-agents implémentation                     | **Opus 4.7 obligatoire** (`claude-opus-4-7[1m]`)                                                                                                                                                                                 |
| 12  | Branche                                        | `feat/quick-chat-call-unified` depuis `origin/main`                                                                                                                                                                              |
| 13  | Scope backend                                  | **Aucun changement nécessaire** — la timeline chat+voice est déjà unifiée backend (Spec #1 mergée 2026-04). `GET /api/chat/history/{summary_id}` retourne déjà tout. Filtrage "audio user invisible" appliqué uniquement côté UI |
| 14  | Phasage final                                  | **2 PRs parallélisables** : PR1 Mobile (Agent A, 3-4j) + PR2 Extension (Agent B, 2-3j). Aucune dépendance backend bloquante                                                                                                      |

---

## 4. Architecture macro — Mobile

```
┌─ ConversationScreen.tsx (NEW) ────────────────────────────────────────┐
│                                                                        │
│  Props: {                                                              │
│    summaryId?: string,        // analyse existante                     │
│    videoUrl?: string,         // mode vidéo fraîche (clipboard/share)  │
│    initialMode: 'chat' | 'call',                                       │
│    onClose: () => void,                                                │
│  }                                                                     │
│                                                                        │
│  ┌── <ConversationHeader />                                            │
│  │   - title (videoTitle)                                              │
│  │   - platform badge YT/TikTok                                        │
│  │   - <VoiceQuotaBadge />                                             │
│  │   - settings button (bottom sheet existant)                         │
│  │   - close button                                                    │
│  └──                                                                   │
│                                                                        │
│  ┌── <ContextProgressBanner />  (visible si voice.streaming === true)  │
│  │   - "🎙️ J'écoute la vidéo · X%" + progress bar                     │
│  │   - "✓ Contexte vidéo complet" si contextComplete                   │
│  └──                                                                   │
│                                                                        │
│  ┌── <ConversationFeed /> (FlatList inverted)                          │
│  │   data = unifiedMessages (chat + voice agent triés)                 │
│  │   - bulle user texte (right, indigo bg)                             │
│  │   - bulle agent texte (left, card bg, markdown, [ask:] follow-ups)  │
│  │   - bulle agent voice (left, card bg, badge 🎙️ + label "voix")     │
│  │   - timestamp relatif "à l'instant" / "il y a X min"                │
│  │   - empty state : suggestions chips si messages.length === 0        │
│  └──                                                                   │
│                                                                        │
│  ┌── <VoiceControls />  (zone bas, hauteur fixe ~100dp)                │
│  │   3 états selon `voiceMode` :                                       │
│  │                                                                     │
│  │   voiceMode='off' :                                                 │
│  │     ┌────────────────────────────────┐                              │
│  │     │ 🎙️ Appel non démarré          │                              │
│  │     │ [Tap pour démarrer un appel]   │                              │
│  │     └────────────────────────────────┘                              │
│  │                                                                     │
│  │   voiceMode='live' :                                                │
│  │     ┌────────────────────────────────┐                              │
│  │     │ ◉ ●●●●●●●  0:34 • 28min       │                              │
│  │     │  [🔇 Mute]    [⏹ End]         │                              │
│  │     └────────────────────────────────┘                              │
│  │                                                                     │
│  │   voiceMode='ended' (transient ~3s puis 'off') :                    │
│  │     ┌────────────────────────────────┐                              │
│  │     │ ✅ Appel terminé · 4:32 min   │                              │
│  │     └────────────────────────────────┘                              │
│  │                                                                     │
│  │   voiceMode='quota_exceeded' :                                      │
│  │     ┌────────────────────────────────┐                              │
│  │     │ ⚠ Quota voice épuisé           │                              │
│  │     │ [Acheter des minutes]          │                              │
│  │     └────────────────────────────────┘                              │
│  └──                                                                   │
│                                                                        │
│  ┌── <MiniActionBar />  (au-dessus de l'input, sticky)                 │
│  │   - 📊 "Voir l'analyse complète" (CTA principal, indigo)            │
│  │   - ⭐ Favori (toggle)                                               │
│  │   - ↗ Partager                                                      │
│  └──                                                                   │
│                                                                        │
│  ┌── <ConversationInput />                                             │
│  │   - TextInput multiline (placeholder dynamique selon voiceMode)    │
│  │   - 📤 Send button                                                  │
│  │   - 🎙️ Mic toggle :                                                │
│  │       voiceMode='off' → tap = Alert.alert confirm + start()        │
│  │       voiceMode='live' → tap = toggleMute()                         │
│  │   - quota label ("5/15 questions" si chat / "12 min restantes")    │
│  └──                                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Hook `useConversation` (NEW)

**Fichier** : `mobile/src/hooks/useConversation.ts`

```typescript
import { useState, useEffect, useMemo, useCallback } from "react";
import { Alert } from "react-native";
import { useChat } from "./useChat";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { useStreamingVideoContext } from "../components/voice/useStreamingVideoContext";
import { useResolvedSummaryId } from "./useResolvedSummaryId";
import type { ChatMessage } from "../types";

interface ConversationInput {
  summaryId?: string;
  videoUrl?: string;
  initialMode: "chat" | "call";
  onError?: (msg: string) => void;
}

export type VoiceMode = "off" | "live" | "ended" | "quota_exceeded";

/**
 * UnifiedMessage = aligned avec le schéma backend `ChatHistoryItem` :
 * `source: "text"|"voice"` (PAS "chat", aligner avec backend).
 */
export interface UnifiedMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice";
  timestamp: number;
  voiceSpeaker?: "user" | "agent" | null;
  voiceSessionId?: string | null;
}

export function useConversation(input: ConversationInput) {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("off");
  const [endedToastVisible, setEndedToastVisible] = useState(false);

  // 1. Resolve summaryId : si videoUrl fourni, attendre que voice.start crée
  //    un Summary placeholder côté backend, puis utiliser voice.summaryId.
  const voiceForResolve = useVoiceChatSummaryProbe(input);
  const resolvedSummaryId = useResolvedSummaryId({
    summaryId: input.summaryId,
    videoUrl: input.videoUrl,
    voiceSummaryId: voiceForResolve.summaryId,
  });

  // 2. Hook chat texte (existant) — retourne déjà la timeline mixte
  //    chat texte + voice transcripts (toutes sources, tous speakers)
  //    grâce à GET /api/chat/history/{summary_id} étendu Spec #1.
  const chat = useChat(resolvedSummaryId ?? "");

  // 3. Hook voice (existant) — instance partagée avec celle utilisée
  //    pour le probe (résolution summary_id). Pas de double session.
  const voice = voiceForResolve;

  // 4. Streaming context (existant) — actif uniquement quand session voice live
  const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

  // 5. Fil unifié — RÈGLE FILTRAGE : audio user EXCLU
  //    Les transcripts voice sont DÉJÀ dans chat.messages (backend renvoie
  //    tout via /api/chat/history). On filtre juste les voice user pour
  //    appliquer la règle UX.
  const messages = useMemo<UnifiedMessage[]>(() => {
    return chat.messages
      .filter((m) => {
        // Filtrer les transcripts audio user (règle UX DeepSight)
        if (m.source === "voice" && m.voice_speaker === "user") return false;
        return true;
      })
      .map(toUnified)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chat.messages]);

  // 6. Auto-start si initialMode='call' (une seule fois au mount)
  useEffect(() => {
    if (input.initialMode === "call" && voiceMode === "off") {
      voice.start({ videoUrl: input.videoUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // 7. Sync voiceMode depuis voice.status
  useEffect(() => {
    switch (voice.status) {
      case "idle":
        if (voiceMode === "live") {
          setVoiceMode("ended");
          setEndedToastVisible(true);
          setTimeout(() => {
            setVoiceMode("off");
            setEndedToastVisible(false);
          }, 3000);
        }
        break;
      case "connecting":
      case "listening":
      case "thinking":
      case "speaking":
        setVoiceMode("live");
        break;
      case "quota_exceeded":
        setVoiceMode("quota_exceeded");
        break;
      case "error":
        setVoiceMode("off");
        input.onError?.(voice.error ?? "Erreur voice");
        break;
    }
  }, [voice.status, voice.error, voiceMode, input]);

  // 8. Confirm dialog avant start depuis chat mode
  const requestStartCall = useCallback(() => {
    Alert.alert(
      "Démarrer l'appel vocal ?",
      `Cela consomme votre quota voice (${voice.remainingMinutes.toFixed(0)} min restantes ce mois).`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Démarrer",
          onPress: () => voice.start({ videoUrl: input.videoUrl }),
        },
      ],
    );
  }, [voice, input.videoUrl]);

  // 9. Send (route selon voiceMode)
  const sendMessage = useCallback(
    (text: string) => {
      if (voiceMode === "live") {
        // Pendant un call : injecte dans la conversation ElevenLabs (agent répond à l'oral)
        voice.sendUserMessage(text);
      } else {
        // Hors call : chat normal (agent répond en texte)
        chat.sendMessage(text);
      }
    },
    [voiceMode, voice, chat],
  );

  // 10. Charger l'historique au mount (rehydratation timeline mixte)
  useEffect(() => {
    if (resolvedSummaryId) chat.loadHistory();
  }, [resolvedSummaryId, chat]);

  return {
    messages,
    voiceMode,
    endedToastVisible,
    summaryId: resolvedSummaryId,
    sendMessage,
    requestStartCall,
    endCall: voice.stop,
    toggleMute: voice.toggleMute,
    isMuted: voice.isMuted,
    elapsedSeconds: voice.elapsedSeconds,
    remainingMinutes: voice.remainingMinutes,
    isLoading: chat.isLoading,
    contextProgress: ctx.contextProgress,
    contextComplete: ctx.contextComplete,
    streaming: input.videoUrl !== undefined,
  };
}

// Helper : map le ChatMessage backend vers UnifiedMessage UI
function toUnified(m: ChatMessage): UnifiedMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    source: m.source ?? "text",
    timestamp: new Date(m.timestamp).getTime(),
    voiceSpeaker: m.voice_speaker ?? null,
    voiceSessionId: m.voice_session_id ?? null,
  };
}

// Petit wrapper qui réutilise la même instance useVoiceChat pour
// (a) probe summaryId si videoUrl fourni, (b) être l'instance principale
// du hook useConversation. Évite la double session.
function useVoiceChatSummaryProbe(input: ConversationInput) {
  return useVoiceChat({
    summaryId: input.summaryId,
    agentType: input.videoUrl ? "explorer_streaming" : undefined,
  });
}
```

### 4.2 Hook `useResolvedSummaryId` (NEW, helper)

**Fichier** : `mobile/src/hooks/useResolvedSummaryId.ts`

```typescript
import { useState, useEffect } from "react";
import type { useVoiceChat } from "../components/voice/useVoiceChat";

interface ResolveInput {
  summaryId?: string;
  videoUrl?: string;
  voiceSummaryId?: number | null; // exposé par useVoiceChat après ack backend
}

/**
 * Retourne le summaryId (string) à utiliser pour les hooks downstream
 * (useChat). Convertit number → string puisque useChat attend string
 * (typé via expo-router params).
 *
 * - Si input.summaryId fourni : retour direct.
 * - Si input.videoUrl fourni : retourne null tant que voice.summaryId
 *   n'est pas ack par le backend (mode explorer_streaming). Une fois
 *   ack, retourne String(voice.summaryId).
 * - Sinon : null → useChat no-op.
 */
export function useResolvedSummaryId(input: ResolveInput): string | null {
  if (input.summaryId) return input.summaryId;
  if (input.voiceSummaryId != null) return String(input.voiceSummaryId);
  return null;
}
```

Note : la conversion `number → string` est nécessaire car `useChat` attend un `string` (typé `string` car les params expo-router le sont) tandis que `voice.summaryId` est exposé en `number | null` par `useVoiceChat` (cf. ligne 112-114 de `useVoiceChat.ts`). Cette conversion est faite UNE seule fois ici pour éviter la duplication.

Ce hook est nécessaire pour le mode Quick Call depuis Home (vidéo fraîche). Pour Quick Chat sur vidéo fraîche → cf. §4.5 edge cases (défaut V3 = force Quick Call).

### 4.3 Composants enfants

| Composant                    | Rôle                                               | Notes                                                                         |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| `<ConversationHeader />`     | Title + plateforme + quotaBadge + settings + close | Réutilise `<VoiceQuotaBadge />`, `<VoiceSettings />` (bottom sheet) existants |
| `<ConversationFeed />`       | FlatList inverted des `UnifiedMessage[]`           | Refactor de `messageRenderer` actuel de QuickChatScreen + bulle voice         |
| `<ConversationFeedBubble />` | Une bulle (user texte / agent texte / agent voice) | Distingue source via badge `🎙️` (Ionicons mic-outline + label "voix")         |
| `<VoiceControls />`          | Zone voice bas (off/live/ended/quota_exceeded)     | Extraction depuis `VoiceScreen`                                               |
| `<ContextProgressBanner />`  | Barre progress 0-100 + label "J'écoute…"           | Code déjà dans VoiceScreen, à extraire en composant                           |
| `<MiniActionBar />`          | 3 actions (Analyse complète, Favori, Partager)     | Refactor de `miniActionBar` actuel de QuickChatScreen                         |
| `<ConversationInput />`      | TextInput + Send + Mic toggle + quota label        | Nouveau, fusion ChatInput + bouton mic VoiceScreen                            |
| `<EndedToast />`             | Toast "✅ Appel terminé · X:XX"                    | Nouveau, animé via Reanimated FadeIn/FadeOut, auto-dismiss 3s                 |

### 4.4 Composants supprimés

À la fin de la PR mobile :

- `mobile/src/components/analysis/QuickChatScreen.tsx` ❌
- `mobile/src/components/voice/VoiceScreen.tsx` ❌
- `mobile/src/components/voice/PostCallScreen.tsx` ❌
- `mobile/src/components/voice/__tests__/PostCallScreen.test.tsx` ❌

Tous les call sites migrent vers `ConversationScreen` :

- `mobile/app/(tabs)/index.tsx` — bouton "Voice Call" sur Home → `ConversationScreen` avec `videoUrl + initialMode='call'`
- Bouton "Quick Chat" sur Home (à ajouter) → `ConversationScreen` avec `videoUrl + initialMode='chat'`
- `mobile/app/(tabs)/analysis/[id].tsx` — bouton Quick Chat existant → `ConversationScreen` avec `summaryId + initialMode='chat'`
- Library long-press → `ConversationScreen` avec `summaryId + initialMode='chat'`

### 4.5 États & comportements précis

**Quick Chat (initialMode='chat')** :

- Mount avec `voiceMode='off'`
- Empty state : suggestions chips (3 questions pré-définies)
- L'user tape un message → `chat.sendMessage()` → POST `/api/chat/ask` → réponse texte (`🤖`)
- L'user tape sur 🎙️ Mic dans l'input → `Alert.alert("Démarrer l'appel ?")` → si confirm → `voice.start()` → `voiceMode='live'`

**Quick Call (initialMode='call')** :

- Mount avec `voiceMode='off'` puis auto-trigger `voice.start()` après mount → `voiceMode='live'`
- Si `videoUrl` fourni : `voice.start({videoUrl})` déclenche mode `explorer_streaming` (Summary placeholder + SSE streaming)
- ContextProgressBanner visible si streaming
- Audio agent transcripts (`source='ai'`) → ajoutés au fil avec badge 🎙️
- Audio user (`source='user'`) → reçu côté SDK ElevenLabs, persisté backend mais **PAS affiché** dans le fil (filter)
- L'user peut taper un message texte pendant le call → `voice.sendUserMessage(text)` → injecté dans la conversation ElevenLabs (l'agent répond à l'oral)
- L'user tape sur 🔇 Mute → `voice.toggleMute()`, call continue
- L'user tape sur ⏹ End → `voice.stop()` → `voiceMode='ended'` (toast 3s) → `voiceMode='off'` → focus auto sur l'input texte

**Edge cases** :

- L'user dicte oralement et l'agent répond oralement : le fil affiche uniquement la bulle agent (`🤖 🎙️`), aucune bulle user. **Asymétrie volontaire**.
- L'user backgrounde l'app pendant un call : `useVoiceChat` AppState listener auto-stop existant (ligne 498-518), `voiceMode → 'ended'` puis `'off'`.
- L'user rouvre une analyse plus tard : `messages` charge chat history + transcripts agent persistés via `voiceApi.fetchAgentTranscripts(summaryId)`. Le fil unifié remontre la conversation passée (chat + voice agent mixés).
- Quota voice épuisé en cours de call : `voiceMode='quota_exceeded'`, `<VoiceControls />` affiche CTA "Acheter des minutes" → ouvre `VoiceAddonModal` existant.
- Quick Chat avec `videoUrl` mais pas de `summaryId` (mode "chat sur vidéo fraîche") :

  **Défaut V3 (cette spec)** = **force Quick Call**. Si l'user choisit "Quick Chat" depuis Home avec un `videoUrl` (sans `summaryId`), on affiche une `Alert.alert` : "Cette vidéo n'est pas encore analysée. Lancer un appel vocal pour commencer ? L'analyse arrivera en streaming pendant l'appel." → confirm bascule vers Quick Call (`initialMode='call'`). Cancel ferme l'écran.

  **V3.1 (futur)** : implémenter le mode "chat sur vidéo fraîche en streaming" = overlay loading "Création de la session..." pendant que `voiceApi.createSession({video_url, agent_type: 'explorer_streaming'})` crée le Summary placeholder SANS démarrer le SDK ElevenLabs → une fois ack, l'user peut commencer à chatter pendant que le contexte streaming continue à arriver côté backend. Hors-scope V3 (cf. §12 décision #1).

---

## 5. Architecture macro — Extension Chrome

### 5.1 Réutilisation V1

La PR #149 (V1 extension Voice Call) est **mergée 2026-04-27**. Elle a livré :

- `extension/src/sidepanel/VoiceView.tsx` — vue voice avec contrôles + transcript (équivalent ext de VoiceScreen mobile)
- Backend `agent_type='explorer_streaming'` côté API (partagé avec mobile)
- Bouton 🎙️ Voice Call sur le panel YouTube (équivalent ext du bouton Voice Call mobile)

La refonte unifiée extension consiste à fusionner `ChatView` (Quick Chat ext existant) + `VoiceView` (V1) en un seul `ConversationView`.

### 5.2 Différences vs mobile

| Aspect                  | Mobile                                             | Extension                                                                       |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Container               | `ConversationScreen` (Modal full-screen)           | `ConversationView` (intégré dans le sidepanel Chrome 114+)                      |
| Layout                  | Two-pane (chat haut + voice bas)                   | Two-pane vertical (sidepanel = colonne ~400px)                                  |
| Hook unifié             | `useConversation` (TS RN)                          | Idem TS web — partage 80% du code, différences minimes (Audio API, persistance) |
| Filtrage audio user     | `voice.messages.filter(m => m.source === 'ai')`    | Idem (SDK `@elevenlabs/react`)                                                  |
| Persistance transcripts | Backend `/api/voice/transcripts` (à ajouter PR1)   | Idem (endpoint partagé)                                                         |
| Storage local           | Pas de cache local (DB backend = source de vérité) | Pas de cache local non plus                                                     |

### 5.3 Composants extension (NEW + supprimés)

**NEW** :

- `extension/src/sidepanel/views/ConversationView.tsx` — équivalent `ConversationScreen` mobile
- `extension/src/sidepanel/hooks/useConversation.ts` — hook unifié (mirror du mobile)
- `extension/src/sidepanel/components/ConversationFeed.tsx`
- `extension/src/sidepanel/components/VoiceControls.tsx`
- `extension/src/sidepanel/components/ConversationInput.tsx`
- `extension/src/sidepanel/components/EndedToast.tsx`

**Supprimés** :

- `extension/src/sidepanel/views/ChatView.tsx` ❌ (remplacé par ConversationView mode 'chat')
- `extension/src/sidepanel/VoiceView.tsx` ❌ (remplacé par ConversationView mode 'call')

**Modifiés** :

- `extension/src/sidepanel/App.tsx` — routing vers `ConversationView` au lieu de `ChatView` / `VoiceView`
- `extension/src/sidepanel/views/MainView.tsx` — boutons "Quick Chat" et "Quick Call" pointent sur `ConversationView` avec `initialMode` adapté
- `extension/src/sidepanel/contexts/NavigationContext.tsx` — route 'chat' et 'voice' fusionnées en 'conversation'

---

## 6. Backend — aucun changement requis (timeline déjà unifiée)

**Constat** : la timeline chat + voice est **DÉJÀ unifiée côté backend** depuis Spec #1 mergée 2026-04. Plus précisément :

- **Table `chat_messages`** (`backend/src/db/database.py` ~ligne 815+) : colonnes existantes `source: "text"|"voice"`, `voice_speaker: "user"|"agent"`, `voice_session_id`, `time_in_call_secs`. Toute persistance voice transcript passe par cette table avec `source='voice'`.
- **Endpoint `GET /api/chat/history/{summary_id}`** (`backend/src/chat/router.py:397`) : retourne déjà toute la timeline mixte (texte + voice agent + voice user) ordonnée par `created_at`. Le schéma de réponse `ChatHistoryItem` (`backend/src/chat/schemas.py:106-110`) expose `source`, `voice_speaker`, `voice_session_id`.
- **Endpoint `POST /api/voice/transcripts/append`** (`backend/src/voice/router.py:1927`) : persiste UN tour voice dans `chat_messages` avec `source='voice'`. Dedup 60s, rate limit 60/min, IDOR check.

**Conclusion** : aucun nouvel endpoint, aucune migration, aucun nouveau schéma Pydantic backend. La règle UX "audio user invisible" est appliquée **uniquement côté UI** (filtre `m.source === 'voice' && m.voice_speaker === 'user'` dans `useConversation`).

**Vérification recommandée (sanity check, optionnelle, ~5 lignes pytest)** : confirmer que `/api/chat/history/{summary_id}` inclut bien les champs `source/voice_speaker/voice_session_id` quand des voice transcripts sont présents. À ajouter dans `backend/tests/chat/test_history_includes_voice_fields.py` si pas déjà couvert.

---

## 7. Spec Mobile / Extension — extension du type `ChatMessage`

**Fichier** : `mobile/src/types/index.ts` (ou équivalent où `ChatMessage` est défini) + `extension/src/sidepanel/types.ts`

Le type `ChatMessage` mobile actuel n'expose que `id, role, content, timestamp`. Il doit être étendu pour mapper les champs backend qui existent déjà dans la réponse `/api/chat/history/{summary_id}` :

```typescript
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string; // existant
  source?: "text" | "voice"; // NEW — défaut "text"
  voice_speaker?: "user" | "agent" | null; // NEW
  voice_session_id?: string | null; // NEW
  time_in_call_secs?: number | null; // NEW
}
```

**Fichier** : `mobile/src/services/api.ts` — `chatApi.getHistory()` doit déjà retourner ces champs (le backend les envoie). Vérifier que la fonction de mapping ne les drop pas. Si elle les drop → corriger pour passthrough.

Mirror dans `extension/src/sidepanel/api.ts` (ou équivalent).

Aucune nouvelle fonction `voiceApi.fetchAgentTranscripts` à créer — `chatApi.getHistory` suffit.

---

## 8. Phasage — 2 PRs (parallélisables)

| PR  | Scope                                                                                                                                                                                                                                                                | Effort | Bloque | Sub-agent |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | --------- |
| PR1 | Mobile : extension type `ChatMessage` + `ConversationScreen` + `useConversation` + `useResolvedSummaryId` + 8 composants enfants + migration callsites Home + Analysis + suppression QuickChatScreen + VoiceScreen + PostCallScreen + tests Jest + smoke iOS+Android | 3–4 j  | —      | Agent A   |
| PR2 | Extension : extension type `ChatMessage` + `ConversationView` + `useConversation` ext + 7 composants enfants + suppression `ChatView` + `VoiceView` + migration App routing + tests Jest + smoke Chrome                                                              | 2–3 j  | —      | Agent B   |

**Total** : 5–7 j Opus 4.7.

### Parallélisme

- **PR1 et PR2 peuvent être développées en parallèle dès le départ** (aucune dépendance backend bloquante puisque la timeline est déjà unifiée). Sub-agents A et B dans des worktrees séparés.
- Convention worktree :
  - `C:\Users\33667\DeepSight-conversation-mobile` (PR1)
  - `C:\Users\33667\DeepSight-conversation-ext` (PR2)
- Le sanity check backend (test pytest §11.1, optionnel) peut être mergé séparément ou inclus dans PR1.
- Mémoire utilisateur : "Multi-Claude parallel workflow" + "Opus 4.7 partout pour les sous-agents"

---

## 9. Risques et mitigations

| Risque                                                                                                                   | Mitigation                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Beaucoup de tests existants (`QuickChatScreen.test.tsx`, `VoiceScreen.test.tsx`, `PostCallScreen.test.tsx`) à réécrire   | Plan de migration des tests inclus dans PR1 : nouveaux tests pour `ConversationScreen` couvrent les mêmes scenarios + nouveaux liés au fil unifié                                                 |
| `chatApi.getHistory` mobile/extension drop-t-il les nouveaux champs `source/voice_speaker/voice_session_id` ?            | Vérifier le mapping dans `mobile/src/services/api.ts` et `extension/src/sidepanel/api.ts`. Si drop, ajuster pour passthrough. Test unitaire de mapping ajouté à PR1 et PR2.                       |
| Audio user reçu via `chat.messages` (avec `source='voice'` et `voice_speaker='user'`) leak dans le fil par erreur        | Filtre strict dans `useConversation` : `m.source === 'voice' && m.voice_speaker === 'user'` exclut. Test unitaire dédié : `chat.messages` contient un voice user → `messages` ne le contient pas. |
| Transition Quick Chat → Quick Call inline (start session voice) consomme du quota sans que l'user soit sûr               | `Alert.alert` confirme avec affichage explicite des minutes restantes. Décision verrouillée brainstorm 2026-05-02                                                                                 |
| `ConversationScreen` plein écran sur mobile alors que l'analyse `[id].tsx` a 4 tabs : conflit de navigation              | `ConversationScreen` ouvert via Modal (animationType='none'), pas via `router.push`. L'analyse reste en arrière-plan                                                                              |
| Streaming context `[CTX UPDATE]` arrive pendant un call mais l'agent les répète à l'oral                                 | Risque déjà présent en V1 ext (mergée). Tests E2E qualitatifs nécessaires. Fallback : si récurrent, switcher de mécanisme `[CTX UPDATE]` → tool custom (V4)                                       |
| PR2 extension touche `App.tsx` + `MainView.tsx` qui sont en cours d'édition (vu git status : feat/tri-platform-redesign) | Coordination temporelle : PR2 démarre après que `feat/tri-platform-redesign` soit mergée OU PR2 part d'une branche basée sur `feat/tri-platform-redesign`                                         |
| L'user dicte oralement et est perdu (pas de bulle correspondante)                                                        | UX assumée volontairement (règle "audio user invisible"). Pas de mitigation tech, juste éducation user via l'usage                                                                                |
| Suppression `PostCallScreen.tsx` casse des références imports ailleurs                                                   | grep cross-repo `PostCallScreen` avant suppression. Mise à jour `index.ts` voice. Tests Jest red → fix imports                                                                                    |
| `useVoiceChat` est appelé 2 fois par accident (probe + main) si on n'utilise pas l'instance partagée                     | `useConversation` factorise via `useVoiceChatSummaryProbe` qui retourne L'INSTANCE et la réutilise. Test unitaire : 1 seule session voice créée même quand `videoUrl` est fourni                  |

---

## 10. Métriques de succès (PostHog)

- `conversation_opened` (segmenté par `initialMode='chat'\|'call'`, plateforme=mobile|extension, source=home|analysis|library|share)
- `conversation_chat_to_call_promoted` (toggle mic OFF→ON depuis chat, après confirm dialog) — KPI clé
- `conversation_chat_to_call_cancelled` (cancel sur le confirm dialog)
- `conversation_call_to_chat_dropped` (End pendant un call, retour fluide vers mode chat)
- `conversation_message_sent_text` (segmenté par voiceMode au moment de l'envoi)
- `conversation_message_received_voice_agent` (transcript ElevenLabs ajouté au fil)
- `conversation_post_call_cta_clicked` (CTA "Voir l'analyse complète" dans MiniActionBar après hangup)
- **KPI primary** : taux de conversion `conversation_opened` (initialMode='chat') → `conversation_chat_to_call_promoted` dans la même session. Si > 30%, la fusion est validée.

---

## 11. Tests

### 11.1 Backend (pytest, optionnel sanity check)

- `backend/tests/chat/test_history_includes_voice_fields.py` (NEW, ~10 lignes) :
  - Vérifie que `GET /api/chat/history/{summary_id}` retourne bien `source/voice_speaker/voice_session_id` quand des transcripts voice ont été persistés via `POST /api/voice/transcripts/append`. Sanity check pour empêcher une régression silencieuse côté backend.

### 11.2 Mobile (Jest, PR1)

- `mobile/__tests__/hooks/useConversation.test.ts` :
  - `unifies chat + voice agent messages in chronological order`
  - `excludes voice user messages (audio user invisible rule)`
  - `routes sendMessage to chat.sendMessage when voiceMode='off'`
  - `routes sendMessage to voice.sendUserMessage when voiceMode='live'`
  - `auto-starts voice when initialMode='call'`
  - `does NOT auto-start voice when initialMode='chat'`
  - `transitions voiceMode 'live' → 'ended' → 'off' on hangup with 3s toast`
  - `requestStartCall opens Alert.alert with quota info`
  - `loadHistory called once on resolvedSummaryId resolution`
- `mobile/__tests__/components/conversation/ConversationScreen.test.tsx` :
  - `renders empty state with suggestion chips when messages.length === 0`
  - `renders chat bubbles with user/assistant differentiation`
  - `renders voice agent bubble with 🎙️ badge`
  - `does NOT render voice user bubble`
  - `renders VoiceControls in 'off' state by default`
  - `renders VoiceControls in 'live' state when voice.start succeeded`
  - `renders EndedToast on hangup, auto-dismiss 3s`
  - `mic button in input opens confirm dialog when voiceMode='off'`
  - `mic button toggles mute when voiceMode='live'`
- `mobile/__tests__/components/conversation/ConversationFeedBubble.test.tsx` :
  - `user text bubble`
  - `assistant text bubble with markdown`
  - `assistant voice bubble with 🎙️ badge`

### 11.3 Extension (Jest, PR2)

- Mirror des tests mobile, adapté au contexte sidepanel et SDK `@elevenlabs/react` (vs `@elevenlabs/react-native`) :
  - `extension/__tests__/sidepanel/views/ConversationView.test.tsx`
  - `extension/__tests__/sidepanel/hooks/useConversation.test.ts`

### 11.4 Smoke E2E manuel

**Mobile (iOS + Android)** :

1. Home → tap "Quick Chat" → ConversationScreen ouvre, mode chat, mic gris
2. Tape un message → réponse texte agent dans le fil
3. Tap mic → Alert "Démarrer l'appel ? (X min)" → confirm → voice live
4. Parle au mic → audio agent répond → bulle 🎙️ apparaît dans le fil → vérifier qu'AUCUNE bulle user voice n'apparaît
5. Tape un message texte pendant le call → injecté dans la conversation, réponse à l'oral
6. Tap End → toast "✅ Appel terminé" 3s → retour mode chat → mic gris
7. Bulle voice agent toujours dans le fil (persistée)
8. Tap "Voir l'analyse complète" → navigation vers `/analysis/[id]`
9. Re-ouvrir la même analyse → ConversationScreen recharge le fil avec messages chat + transcripts voice agent

**Extension Chrome** :

1. Sur YouTube → side panel ouvre → bouton "Quick Call" → conversation auto-start
2. Idem 4-7 mobile
3. Tap "Quick Chat" sur side panel → conversation s'ouvre mode chat
4. Vérifier persistance entre fermetures/réouvertures du sidepanel

---

## 12. Décisions ouvertes (à valider en review)

| #   | Décision                                                                                         | Défaut proposé                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Quick Chat avec `videoUrl` mais pas de `summaryId` (vidéo fraîche, pas d'analyse) — comportement | **Force Quick Call** : pour V3, on propose Quick Call à la place avec confirmation. Implémenter "Quick Chat sur vidéo fraîche" en V3.1.                                                                                                                                     |
| 2   | Style visuel du badge `🎙️` dans la bulle agent voice                                             | **Petit badge inline** à droite du timestamp ("à l'instant · 🎙️ voix"). Alternative : icône à côté de l'avatar agent. À tester en design review.                                                                                                                            |
| 3   | Transition `voiceMode='ended'` durée toast                                                       | **3 secondes** (Reanimated FadeOut). Rapide pour ne pas bloquer l'UX, assez visible.                                                                                                                                                                                        |
| 4   | Persistance transcripts user en DB (continue ou stop ?)                                          | **Continue** (déjà le cas, table `chat_messages` source='voice' speaker='user'). Filtre appliqué côté UI uniquement (pas de paramètre `?speaker=` à passer puisque l'endpoint chat existant ne le propose pas). Si confidentialité critique → opt-out user à ajouter en V4. |
| 5   | "Mode chat" comme bouton explicite ou implicite (End = retour chat)                              | **Implicite** (End = retour chat, focus auto sur input). Bouton "Mode chat" supprimé du layout.                                                                                                                                                                             |
| 6   | Web : appliquer la même refonte plus tard ?                                                      | **Hors-scope V3 unifié**. Si décidé en V4, créer une nouvelle spec basée sur celle-ci.                                                                                                                                                                                      |
| 7   | Header platform badge si `videoUrl` non encore résolu en summary (cas Quick Call streaming)      | **"Live"** placeholder + badge actualisé une fois le Summary placeholder créé.                                                                                                                                                                                              |

---

## 13. Méga-plan d'implémentation

Le découpage en sous-agents Opus 4.7 sera produit par invocation de la skill `writing-plans` après approbation de ce spec. Vue macro :

- **Agent A — PR1 Mobile** : extension type `ChatMessage` + `ConversationScreen` + `useConversation` + `useResolvedSummaryId` + 8 composants enfants + migration callsites Home + Analysis + suppression `QuickChatScreen` + `VoiceScreen` + `PostCallScreen` + tests Jest (~20 cases) + smoke iOS+Android. Estimation : 3–4 jours Opus 4.7.
- **Agent B — PR2 Extension** : extension type `ChatMessage` + `ConversationView` + `useConversation` web + 7 composants enfants + migration App routing + suppression `ChatView` + `VoiceView` + tests Jest + smoke Chrome. Estimation : 2–3 jours Opus 4.7.

**Aucune dépendance backend bloquante** : le sanity check pytest §11.1 est optionnel et peut être inclus dans PR1 ou en commit séparé. Les 2 agents A et B travaillent EN PARALLÈLE dès le départ dans des worktrees séparés.

**Toutes les invocations Agent doivent utiliser `model: claude-opus-4-7[1m]`** (mémoire user perma).

---

## 14. Lien avec specs antérieures

- **Supersedes (UI portion)** : `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` — la partie backend (`explorer_streaming` agent, `streaming_orchestrator`, SSE `/voice/context/stream`) reste valide. La partie mobile UI (Home 2 CTA séparés, VoiceScreen variante streaming, PostCallScreen) est REMPLACÉE par cette spec.
- **Étend** : `docs/superpowers/specs/2026-04-26-quick-voice-call-design.md` (V1 extension, mergée PR #149)
- **Cohérent avec** : `docs/superpowers/specs/2026-04-29-merge-voice-chat-context-design.md` (Agent context bidirectionnel — la persistance unifiée chat+voice s'aligne avec ce design)

---

_Spec produit en mode brainstorming Superpowers (Opus 4.7). À reviewer et committer sur `main` avant lancement de la writing-plans skill._
