// extension/src/sidepanel/hooks/useConversation.ts
//
// Hook unifié orchestrant chat texte + voice call dans la même conversation.
// Mirror du hook mobile `useConversation` (PR1) adapté au contexte web :
//   - `Alert.alert`            → `window.confirm`
//   - `useChat` (RN)            → fetch via `chrome.runtime.sendMessage`
//   - `useVoiceChat` (RN)       → `useExtensionVoiceChat` (déjà en place)
//   - `useStreamingVideoContext` (mobile) → idem (hooks/useStreamingVideoContext.ts)
//
// Le hook retourne un fil unifié `messages: UnifiedMessage[]` qui mixe :
//   - les messages chat texte (POST /api/chat/ask)
//   - les transcripts agent voice (ElevenLabs SDK + persistance backend)
// et exclut systématiquement les transcripts user voice (règle UX
// "audio user invisible" — spec 2026-05-02 §3 décision #3).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Browser from "../../utils/browser-polyfill";
import type { ChatMessage, MessageResponse } from "../../types";
import {
  useExtensionVoiceChat,
  VoiceQuotaError,
} from "../useExtensionVoiceChat";
import type {
  VoicePanelContext,
  VoiceSessionStatus,
  VoiceTranscript,
} from "../types";
import { useStreamingVideoContext } from "./useStreamingVideoContext";

// ── Types publics ──────────────────────────────────────────────────

export type ConversationInitialMode = "chat" | "call";

export type VoiceMode = "off" | "live" | "ended" | "quota_exceeded";

/**
 * UnifiedMessage = ligne du fil rendue par ConversationFeed. Source de
 * vérité unique pour la liste affichée (chat texte ET transcript agent
 * voice mixés). Les transcripts user voice ne sont jamais transformés
 * en UnifiedMessage (filter en amont).
 */
export interface UnifiedMessage {
  /** Identifiant stable. Backend = ChatHistoryItem.id, voice transient = `voice-${ts}`. */
  id: string;
  role: "user" | "assistant";
  content: string;
  source: "text" | "voice";
  /** ms epoch — utilisé pour le tri chronologique du fil. */
  timestamp: number;
  voiceSpeaker?: "user" | "agent" | null;
  voiceSessionId?: string | null;
  /** True quand l'agent a marqué la réponse comme enrichie via web search. */
  webSearchUsed?: boolean;
}

export interface UseConversationInput {
  /**
   * Identifiant Summary backend (analyse existante). Optionnel :
   * - mode chat : doit être fourni (sinon pas de history, pas de chat).
   * - mode call (Quick Voice Call) : peut être null/undefined si on lance
   *   un appel sur une vidéo fraîche — le backend crée alors un Summary
   *   placeholder en mode explorer_streaming et useConversation utilise
   *   voice.summaryId une fois ack.
   */
  summaryId?: number | null;
  /** Titre de la vidéo affiché dans le header. */
  videoTitle: string;
  /** Plateforme vidéo (info pour l'agent voice). */
  platform?: "youtube" | "tiktok" | null;
  /** Identifiant vidéo (YouTube/TikTok) — utile au mode call. */
  videoId?: string | null;
  /** Mode initial à l'entrée dans la vue. */
  initialMode: ConversationInitialMode;
  /** Plan utilisateur (impact UI : web search toggle, voice quota). */
  userPlan?: string;
  /** Callback erreur global remontée par voice ou chat. */
  onError?: (msg: string) => void;
  /** Callback quand la session backend est expirée (401). */
  onSessionExpired?: () => void;
}

export interface UseConversationResult {
  /** Fil unifié filtré (audio user exclu). */
  messages: UnifiedMessage[];
  /** Phase voice : off/live/ended/quota_exceeded. */
  voiceMode: VoiceMode;
  /** True pendant les 3s du toast post-hangup. */
  endedToastVisible: boolean;
  /** Durée du dernier appel (mémorisée à hangup) en secondes. */
  lastCallDurationSec: number;
  /** Status bas niveau du SDK ElevenLabs (idle/connecting/listening/...). */
  voiceStatus: VoiceSessionStatus;
  /** Compteur live d'écoulement de l'appel en secondes. */
  elapsedSec: number;
  /** True quand le micro est mute côté SDK. */
  isMuted: boolean;
  /** True quand on charge l'historique chat initial. */
  loadingHistory: boolean;
  /** True quand on attend la réponse texte assistant. */
  loading: boolean;
  /** True quand le clear all a échoué et qu'on doit reconnecter. */
  sessionExpired: boolean;
  /** Toggle web search (chat texte uniquement). */
  webSearchEnabled: boolean;
  setWebSearchEnabled: (v: boolean) => void;
  /** Progrès streaming context backend (0-100, voice call only). */
  contextProgress: number;
  contextComplete: boolean;
  /** True si l'extension est connectée à un agent ElevenLabs. */
  voiceConversationActive: boolean;
  /** Summary id résolu (input.summaryId ou voice.summaryId post-ack). */
  resolvedSummaryId: number | null;

  // ── Actions ──
  /** Envoie un message — route vers chat texte ou agent voice selon voiceMode. */
  sendMessage: (text: string) => Promise<void>;
  /** Demande la confirmation puis démarre l'appel (mic OFF→ON). */
  requestStartCall: () => void;
  /** Hangup explicite (bouton End). */
  endCall: () => Promise<void>;
  /** Toggle mute pendant un appel. */
  toggleMute: () => void;
  /** Clear chat history (mixed text + voice transcripts) avec confirm. */
  clearHistory: () => Promise<void>;
}

// ── Implémentation ────────────────────────────────────────────────

export function useConversation(
  input: UseConversationInput,
): UseConversationResult {
  const { summaryId, videoTitle, videoId, initialMode, onError } = input;

  // ── State chat ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);

  // ── State voice ──
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("off");
  const [endedToastVisible, setEndedToastVisible] = useState<boolean>(false);
  const [lastCallDurationSec, setLastCallDurationSec] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  // Contexte voice (pour pickAgentType — explorer/companion)
  const voiceContext = useMemo<VoicePanelContext>(
    () => ({
      summaryId: typeof summaryId === "number" ? summaryId : null,
      videoId: videoId ?? null,
      videoTitle: videoTitle ?? null,
      platform: input.platform ?? null,
    }),
    [summaryId, videoId, videoTitle, input.platform],
  );

  const voice = useExtensionVoiceChat({ context: voiceContext });

  // ── Streaming context (only when call active) ──
  const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

  // resolvedSummaryId : prefer input.summaryId, fall back to voice.summaryId
  // une fois que le backend a créé le Summary placeholder (mode call sans
  // analyse pré-existante).
  const resolvedSummaryId: number | null =
    typeof summaryId === "number"
      ? summaryId
      : typeof voice.summaryId === "number"
        ? voice.summaryId
        : null;

  // ── Charge l'historique chat unifié (avec transcripts voice persistés) ──
  useEffect(() => {
    if (resolvedSummaryId === null) {
      // Pas encore de summary → on garde loadingHistory true (le call vient
      // de démarrer et le backend n'a pas encore créé le placeholder).
      setLoadingHistory(true);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    void (async () => {
      try {
        const response = await Browser.runtime.sendMessage<
          unknown,
          MessageResponse
        >({
          action: "GET_CHAT_HISTORY",
          data: { summaryId: resolvedSummaryId },
        });
        if (cancelled) return;
        if (response.success && Array.isArray(response.result)) {
          setChatMessages(response.result as ChatMessage[]);
        }
      } catch {
        // silently fall back to empty (matches ChatView v1 behaviour)
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedSummaryId]);

  // ── Rebuild fil unifié à partir de chatMessages + transcripts live ──
  // Règle clé : audio user (source='voice', voice_speaker='user') filtré.
  const messages = useMemo<UnifiedMessage[]>(() => {
    const fromHistory: UnifiedMessage[] = chatMessages
      .filter((m) => {
        // Filtre "audio user invisible" : on exclut les transcripts user voice.
        if (m.source === "voice" && m.voice_speaker === "user") return false;
        return true;
      })
      .map((m, i) => toUnified(m, i));

    // Transcripts live ElevenLabs : append les bulles agent (les user en
    // sont déjà filtrés ici aussi). Évite la double-affichage : si un
    // transcript live a un `id` qui apparaît déjà dans fromHistory, on
    // le saute (le backend persiste via VOICE_APPEND_TRANSCRIPT et
    // l'historique l'a déjà ramené au prochain reload). Pour l'instant
    // les transcripts live n'ont pas d'id stable donc on les ajoute en
    // queue avec un id transient.
    const liveAgentBubbles: UnifiedMessage[] = voice.transcripts
      .filter((t) => t.speaker === "agent")
      .map<UnifiedMessage>((t) => fromVoiceTranscript(t, voice.sessionId));

    // Dédupe simple : si le contenu d'une bulle live agent est déjà dans
    // fromHistory au même `voiceSessionId` et avec un timestamp proche
    // (≤ 5s), on skip. Ça évite la double-affichage quand le SDK pousse
    // le transcript ET qu'un poll d'history le récupère ensuite.
    const dedupedLive = liveAgentBubbles.filter((live) => {
      return !fromHistory.some(
        (h) =>
          h.source === "voice" &&
          h.voiceSpeaker === "agent" &&
          h.voiceSessionId === live.voiceSessionId &&
          h.content.trim() === live.content.trim() &&
          Math.abs(h.timestamp - live.timestamp) < 5000,
      );
    });

    return [...fromHistory, ...dedupedLive].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
  }, [chatMessages, voice.transcripts, voice.sessionId]);

  // ── Auto-start call si initialMode='call' ──
  const autoStartedRef = useRef<boolean>(false);
  useEffect(() => {
    if (initialMode !== "call") return;
    if (autoStartedRef.current) return;
    if (!videoId) return; // pas de videoId = pas de call possible
    autoStartedRef.current = true;
    void voice
      .startSession({
        videoId,
        videoTitle: videoTitle ?? undefined,
        agentType: "explorer_streaming",
        isStreaming: true,
      })
      .catch((err: unknown) => {
        if (err instanceof VoiceQuotaError) {
          setVoiceMode("quota_exceeded");
        } else {
          onError?.((err as Error)?.message ?? "Voice start error");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode, videoId]);

  // ── Sync voiceMode depuis voice.status ──
  useEffect(() => {
    switch (voice.status) {
      case "idle":
      case "ended":
        if (voiceMode === "live") {
          setVoiceMode("ended");
          setEndedToastVisible(true);
          const duration = elapsedSec;
          setLastCallDurationSec(duration);
          const t = setTimeout(() => {
            setVoiceMode("off");
            setEndedToastVisible(false);
          }, 3000);
          return () => clearTimeout(t);
        }
        break;
      case "requesting":
      case "connecting":
      case "listening":
        setVoiceMode("live");
        break;
      case "error":
        // Une error VoiceQuota a déjà set 'quota_exceeded'. Pour les
        // autres erreurs on retombe en off pour ne pas bloquer l'UI.
        if (voiceMode !== "quota_exceeded") {
          setVoiceMode("off");
          if (voice.error) onError?.(voice.error);
        }
        break;
      case "ending":
        // transitionne vers ended naturellement
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.status, voice.error]);

  // ── Elapsed timer ──
  useEffect(() => {
    if (voiceMode !== "live") {
      setElapsedSec(0);
      return;
    }
    const startedAt = Date.now();
    const t = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [voiceMode]);

  // ── Actions ──

  const sendChatMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      if (resolvedSummaryId === null) {
        onError?.("Pas de session de chat active.");
        return;
      }
      setChatMessages((prev) => [
        ...prev,
        { role: "user", content: trimmed },
      ]);
      setLoading(true);
      try {
        const response = await Browser.runtime.sendMessage<
          unknown,
          MessageResponse
        >({
          action: "ASK_QUESTION",
          data: {
            summaryId: resolvedSummaryId,
            question: trimmed,
            options: webSearchEnabled ? { use_web_search: true } : {},
          },
        });
        if (response.success) {
          const result = response.result as {
            response: string;
            web_search_used: boolean;
          };
          setChatMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: result.response,
              web_search_used: result.web_search_used,
            },
          ]);
        } else {
          const errorMsg = response.error || "";
          if (errorMsg.includes("SESSION_EXPIRED")) {
            setSessionExpired(true);
          } else {
            onError?.(errorMsg || "Chat unavailable");
          }
        }
      } catch (e) {
        const errorMsg = (e as Error).message || "";
        if (errorMsg.includes("SESSION_EXPIRED")) {
          setSessionExpired(true);
        } else {
          onError?.(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    },
    [loading, resolvedSummaryId, webSearchEnabled, onError],
  );

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (voiceMode === "live" && voice.conversation) {
        // Pendant un appel, le texte est injecté dans la conversation
        // ElevenLabs (l'agent répond à l'oral) ET appended côté
        // transcripts pour apparaître dans le fil.
        voice.conversation.sendUserMessage(trimmed);
        await voice.appendTranscript("user", trimmed);
        return;
      }
      await sendChatMessage(trimmed);
    },
    [voiceMode, voice, sendChatMessage],
  );

  const requestStartCall = useCallback((): void => {
    if (voiceMode !== "off") return;
    const remaining = "";
    const confirmed = window.confirm(
      `Demarrer l'appel vocal ?${remaining}\nCela consomme votre quota voice.`,
    );
    if (!confirmed) return;
    if (!videoId) {
      onError?.("Pas de video active pour demarrer l'appel.");
      return;
    }
    void voice
      .startSession({
        videoId,
        videoTitle: videoTitle ?? undefined,
        agentType: "explorer_streaming",
        isStreaming: true,
      })
      .catch((err: unknown) => {
        if (err instanceof VoiceQuotaError) {
          setVoiceMode("quota_exceeded");
        } else {
          onError?.((err as Error)?.message ?? "Voice start error");
        }
      });
  }, [voiceMode, videoId, videoTitle, voice, onError]);

  const endCall = useCallback(async (): Promise<void> => {
    setLastCallDurationSec(elapsedSec);
    await voice.endSession();
    setVoiceMode("ended");
    setEndedToastVisible(true);
    setTimeout(() => {
      setVoiceMode("off");
      setEndedToastVisible(false);
    }, 3000);
  }, [elapsedSec, voice]);

  const clearHistory = useCallback(async (): Promise<void> => {
    if (resolvedSummaryId === null) return;
    const confirmed = window.confirm(
      "Effacer l'historique chat + voice ?\nCette action supprime aussi les transcripts du dernier appel.",
    );
    if (!confirmed) return;
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "CLEAR_CHAT_HISTORY",
        data: { summaryId: resolvedSummaryId, includeVoice: true },
      });
      if (response.success) {
        setChatMessages([]);
      } else {
        const errorMsg = response.error || "";
        if (errorMsg.includes("SESSION_EXPIRED")) {
          setSessionExpired(true);
        } else {
          onError?.(errorMsg || "Clear failed");
        }
      }
    } catch (e) {
      onError?.((e as Error).message || "Clear failed");
    }
  }, [resolvedSummaryId, onError]);

  return {
    messages,
    voiceMode,
    endedToastVisible,
    lastCallDurationSec,
    voiceStatus: voice.status,
    elapsedSec,
    isMuted: voice.isMuted,
    loadingHistory,
    loading,
    sessionExpired,
    webSearchEnabled,
    setWebSearchEnabled,
    contextProgress: ctx.contextProgress,
    contextComplete: ctx.contextComplete,
    voiceConversationActive: voice.conversation !== null,
    /** Summary id résolu (input.summaryId ou voice.summaryId post-ack). */
    resolvedSummaryId,
    sendMessage,
    requestStartCall,
    endCall,
    toggleMute: voice.toggleMute,
    clearHistory,
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function toUnified(m: ChatMessage, fallbackIndex: number): UnifiedMessage {
  const ts = m.timestamp ? Date.parse(m.timestamp) : NaN;
  return {
    id: m.id ?? `chat-${fallbackIndex}`,
    role: m.role,
    content: m.content,
    source: m.source ?? "text",
    timestamp: Number.isFinite(ts) ? ts : Date.now() + fallbackIndex,
    voiceSpeaker: m.voice_speaker ?? null,
    voiceSessionId: m.voice_session_id ?? null,
    webSearchUsed: m.web_search_used,
  };
}

function fromVoiceTranscript(
  t: VoiceTranscript,
  sessionId: string | null,
): UnifiedMessage {
  return {
    id: `voice-${t.ts}`,
    role: "assistant", // n'arrive ici que pour speaker='agent' (cf. filter en amont)
    content: t.content,
    source: "voice",
    timestamp: t.ts,
    voiceSpeaker: "agent",
    voiceSessionId: sessionId,
  };
}
