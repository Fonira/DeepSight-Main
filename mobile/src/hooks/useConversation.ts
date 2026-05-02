/**
 * useConversation — Hook unifié pour ConversationScreen (Quick Chat + Quick Call).
 *
 * Orchestre `useChat` + `useVoiceChat` + `useStreamingVideoContext` pour exposer
 * une API unique au composant racine `ConversationScreen`. Centralise la règle
 * UX "audio user invisible" (filtrage côté UI uniquement, backend persiste tout).
 *
 * Spec : `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md` §4.1
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { useChat } from "./useChat";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { useStreamingVideoContext } from "../components/voice/useStreamingVideoContext";
import { useResolvedSummaryId } from "./useResolvedSummaryId";
import type { ChatMessage } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VoiceMode = "off" | "live" | "ended" | "quota_exceeded";

/**
 * UnifiedMessage — message normalisé pour le fil unifié chat + voice.
 * Aligné avec le schéma backend `ChatHistoryItem` : `source: "text"|"voice"`.
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

interface ConversationInput {
  /** ID d'une analyse existante. */
  summaryId?: string;
  /** URL vidéo fraîche → mode `explorer_streaming` (Quick Call V3). */
  videoUrl?: string;
  /** Mode initial : 'chat' (mic gris) ou 'call' (auto-start mic). */
  initialMode: "chat" | "call";
  /** Callback erreur (ex: pour afficher un toast). */
  onError?: (msg: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Map un ChatMessage backend vers le UnifiedMessage UI. */
function toUnified(m: ChatMessage): UnifiedMessage {
  // timestamp peut être ISO string ; getTime() = NaN si invalide → fallback 0
  let ts = 0;
  try {
    const parsed = new Date(m.timestamp).getTime();
    if (!Number.isNaN(parsed)) ts = parsed;
  } catch {
    /* fallback 0 */
  }
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    source: m.source ?? "text",
    timestamp: ts,
    voiceSpeaker: m.voice_speaker ?? null,
    voiceSessionId: m.voice_session_id ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useConversation(input: ConversationInput) {
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("off");
  const [endedToastVisible, setEndedToastVisible] = useState(false);

  // ─── 1. Voice instance (unique) ──────────────────────────────────────────
  // Une SEULE instance useVoiceChat partagée pour : (a) résolution summaryId
  // (mode explorer_streaming créant un Summary placeholder), (b) toutes les
  // commandes voice (start/stop/toggleMute/sendUserMessage). Évite la double
  // session SDK ElevenLabs.
  const voice = useVoiceChat({
    summaryId: input.summaryId,
    agentType: input.videoUrl ? "explorer_streaming" : undefined,
    onError: input.onError,
  });

  // ─── 2. Resolve summaryId (string) ───────────────────────────────────────
  const resolvedSummaryId = useResolvedSummaryId({
    summaryId: input.summaryId,
    videoUrl: input.videoUrl,
    voiceSummaryId: voice.summaryId,
  });

  // ─── 3. Chat texte (timeline mixte chat+voice depuis backend) ────────────
  // useChat.loadHistory() consomme GET /api/chat/history/{summary_id} qui
  // retourne la timeline complète (Spec #1 mergée 2026-04). Voice user/agent
  // sont déjà dans messages avec source='voice'.
  const chat = useChat(resolvedSummaryId ?? "");

  // ─── 4. Streaming context (actif si session voice live) ──────────────────
  const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

  // ─── 5. Fil unifié + filtre "audio user invisible" ───────────────────────
  // Règle UX DeepSight permanente : transcripts voice user JAMAIS affichés
  // dans le fil. Backend les persiste, UI les filtre.
  const messages = useMemo<UnifiedMessage[]>(() => {
    return chat.messages
      .filter((m) => {
        if (m.source === "voice" && m.voice_speaker === "user") return false;
        return true;
      })
      .map(toUnified)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [chat.messages]);

  // ─── 6. Auto-start si initialMode='call' (mount only) ────────────────────
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (input.initialMode === "call") {
      autoStartedRef.current = true;
      voice.start({ videoUrl: input.videoUrl });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // ─── 7. Sync voiceMode depuis voice.status ───────────────────────────────
  // Maintient un voiceMode UI dérivé du status SDK (idle/listening/etc.).
  // La transition 'live' → 'ended' (3s toast) → 'off' est gérée ici.
  const previousVoiceModeRef = useRef<VoiceMode>("off");
  useEffect(() => {
    const prev = previousVoiceModeRef.current;
    const status = voice.status;

    if (
      status === "connecting" ||
      status === "listening" ||
      status === "thinking" ||
      status === "speaking"
    ) {
      if (prev !== "live") {
        setVoiceMode("live");
        previousVoiceModeRef.current = "live";
      }
    } else if (status === "quota_exceeded") {
      setVoiceMode("quota_exceeded");
      previousVoiceModeRef.current = "quota_exceeded";
    } else if (status === "error") {
      setVoiceMode("off");
      previousVoiceModeRef.current = "off";
    } else if (status === "idle") {
      // Transition 'live' → 'ended' → 'off' (toast 3s)
      if (prev === "live") {
        setVoiceMode("ended");
        setEndedToastVisible(true);
        previousVoiceModeRef.current = "ended";
        const timer = setTimeout(() => {
          setVoiceMode("off");
          setEndedToastVisible(false);
          previousVoiceModeRef.current = "off";
        }, 3000);
        return () => clearTimeout(timer);
      } else if (prev !== "off" && prev !== "ended") {
        setVoiceMode("off");
        previousVoiceModeRef.current = "off";
      }
    }
  }, [voice.status]);

  // ─── 8. Confirm dialog avant start depuis chat mode ──────────────────────
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

  // ─── 9. Send (route selon voiceMode) ─────────────────────────────────────
  const sendMessage = useCallback(
    (text: string) => {
      if (voiceMode === "live") {
        // Pendant un call : injecte dans la conversation ElevenLabs
        // (l'agent répond à l'oral).
        voice.sendUserMessage(text);
      } else {
        // Hors call : chat normal (l'agent répond en texte).
        chat.sendMessage(text);
      }
    },
    [voiceMode, voice, chat],
  );

  // ─── 10. Charger l'historique au mount + quand resolvedSummaryId arrive ──
  const loadedSummaryIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedSummaryId && loadedSummaryIdRef.current !== resolvedSummaryId) {
      loadedSummaryIdRef.current = resolvedSummaryId;
      chat.loadHistory();
    }
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
    isSpeaking: voice.isSpeaking,
    elapsedSeconds: voice.elapsedSeconds,
    remainingMinutes: voice.remainingMinutes,
    isLoading: chat.isLoading,
    contextProgress: ctx.contextProgress,
    contextComplete: ctx.contextComplete,
    streaming: input.videoUrl !== undefined,
    error: voice.error,
  };
}
