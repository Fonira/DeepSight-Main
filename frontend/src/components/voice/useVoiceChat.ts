/**
 * useVoiceChat — Hook d'orchestration de conversation vocale
 * Gère le cycle complet : micro → API session → ElevenLabs SDK → timer → cleanup
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { API_URL, getAccessToken } from "../../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface UseVoiceChatOptions {
  summaryId: number;
  language?: "fr" | "en";
  onError?: (error: string) => void;
}

type VoiceChatStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "error"
  | "quota_exceeded";

interface VoiceChatMessage {
  text: string;
  source: "user" | "ai";
}

interface SessionResponse {
  session_id: string;
  signed_url: string;
  quota_remaining_minutes: number;
  max_session_minutes: number;
  input_mode: "ptt" | "vad";
  playback_rate: number;
}

interface UseVoiceChatReturn {
  /** Démarrer la conversation */
  start: () => Promise<void>;
  /** Arrêter la conversation */
  stop: () => Promise<void>;
  /** Toggle mute micro */
  toggleMute: () => void;
  /** PTT: appuyer pour parler */
  startTalking: () => void;
  /** PTT: relâcher pour que l'agent réponde */
  stopTalking: () => void;
  /** Status de la connexion */
  status: VoiceChatStatus;
  /** L'IA est en train de parler */
  isSpeaking: boolean;
  /** Le micro est muted */
  isMuted: boolean;
  /** PTT: l'utilisateur maintient le bouton */
  isTalking: boolean;
  /** Mode d'input actif */
  inputMode: "ptt" | "vad";
  /** Tool en cours d'exécution par l'agent */
  activeTool: string | null;
  /** Messages de la conversation */
  messages: VoiceChatMessage[];
  /** Secondes écoulées dans la session */
  elapsedSeconds: number;
  /** Minutes restantes dans le quota */
  remainingMinutes: number;
  /** Erreur */
  error: string | null;
  /** Playback rate actif pour l'affichage du badge */
  playbackRate: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Erreurs françaises
// ═══════════════════════════════════════════════════════════════════════════════

const ERROR_MESSAGES = {
  MICROPHONE_DENIED:
    "Accès au microphone refusé. Veuillez autoriser le micro dans les paramètres de votre navigateur.",
  MICROPHONE_NOT_FOUND:
    "Aucun microphone détecté. Veuillez brancher un micro et réessayer.",
  MICROPHONE_GENERIC:
    "Impossible d'accéder au microphone. Vérifiez vos permissions.",
  NETWORK: "Erreur réseau. Vérifiez votre connexion internet et réessayez.",
  API_DOWN:
    "Le serveur est temporairement indisponible. Réessayez dans quelques instants.",
  QUOTA_EXCEEDED:
    "Quota de conversation vocale épuisé. Passez à un plan supérieur pour continuer.",
  SESSION_FAILED: "Impossible de démarrer la session vocale. Réessayez.",
  SDK_LOAD_FAILED: "Impossible de charger le module de conversation vocale.",
  SESSION_TIMEOUT: "Session terminée : durée maximale atteinte.",
  UNKNOWN: "Une erreur inattendue est survenue. Réessayez.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useVoiceChat({
  summaryId,
  language = "fr",
  onError,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [inputMode, setInputMode] = useState<"ptt" | "vad">("ptt");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Refs pour le cleanup
  const conversationRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSecondsRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackObserverRef = useRef<MutationObserver | null>(null);
  const playbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputModeRef = useRef<"ptt" | "vad">("ptt");
  const isMountedRef = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      setStatus("error");
      onError?.(msg);
    },
    [onError],
  );

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const cleanupPlaybackObserver = useCallback(() => {
    if (playbackObserverRef.current) {
      playbackObserverRef.current.disconnect();
      playbackObserverRef.current = null;
    }
  }, []);

  const cleanupPlaybackPolling = useCallback(() => {
    if (playbackPollRef.current) {
      clearInterval(playbackPollRef.current);
      playbackPollRef.current = null;
    }
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  /** Mute le micro via SDK + fallback MediaStream */
  const setMicMuted = useCallback((muted: boolean) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationRef.current as any;
      if (conv && typeof conv.setMicMuted === "function") {
        conv.setMicMuted(muted);
      } else if (conv && typeof conv.setVolume === "function") {
        conv.setVolume({ inputVolume: muted ? 0 : 1 });
      }
    } catch {
      // SDK method unavailable
    }
    // Fallback robuste : mute directement les tracks audio
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // PTT: startTalking / stopTalking
  // ─────────────────────────────────────────────────────────────────────────

  const startTalking = useCallback(() => {
    if (!conversationRef.current || inputModeRef.current !== "ptt") return;
    setMicMuted(false);
    // Signal user activity to prevent agent timeout / interrupt agent speech
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationRef.current as any;
      if (typeof conv.sendUserActivity === "function") {
        conv.sendUserActivity();
      }
    } catch {
      // Method may not exist in this SDK version
    }
    setIsTalking(true);
  }, [setMicMuted]);

  const stopTalking = useCallback(() => {
    if (!conversationRef.current || inputModeRef.current !== "ptt") return;
    setMicMuted(true);
    setIsTalking(false);
  }, [setMicMuted]);

  /** Apply client-side playback rate to audio elements created by ElevenLabs SDK */
  const applyPlaybackRate = useCallback((rate: number) => {
    if (rate <= 1.0) return;

    let foundAudio = false;

    // Primary: MutationObserver watches for new audio elements
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLAudioElement) {
            foundAudio = true;
            node.playbackRate = rate;
            node.addEventListener("play", () => {
              node.playbackRate = rate;
            });
          }
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    playbackObserverRef.current = observer;

    // Also update any existing audio elements
    document.querySelectorAll("audio").forEach((el) => {
      foundAudio = true;
      el.playbackRate = rate;
    });

    // Fallback: if no audio found after 2s, poll every 500ms
    playbackTimeoutRef.current = setTimeout(() => {
      if (foundAudio) return;
      playbackPollRef.current = setInterval(() => {
        const audioElements = document.querySelectorAll("audio");
        if (audioElements.length > 0) {
          audioElements.forEach((el) => {
            el.playbackRate = rate;
            el.addEventListener("play", () => {
              el.playbackRate = rate;
            });
          });
          if (playbackPollRef.current) {
            clearInterval(playbackPollRef.current);
            playbackPollRef.current = null;
          }
        }
      }, 500);
    }, 2000);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // stop()
  // ─────────────────────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    stopTimer();
    cleanupPlaybackObserver();
    cleanupPlaybackPolling();

    // End ElevenLabs session
    if (conversationRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conversationRef.current as any).endSession();
      } catch {
        // Ignorer les erreurs de fin de session
      }
      conversationRef.current = null;
    }

    releaseMediaStream();

    if (isMountedRef.current) {
      setStatus("idle");
      setIsSpeaking(false);
      setIsMuted(false);
      setIsTalking(false);
      setActiveTool(null);
      setElapsedSeconds(0);
      setPlaybackRate(1.0);
    }
  }, [
    stopTimer,
    releaseMediaStream,
    cleanupPlaybackObserver,
    cleanupPlaybackPolling,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    // Empêcher les démarrages multiples
    if (
      status === "connecting" ||
      status === "listening" ||
      status === "speaking"
    ) {
      return;
    }

    setError(null);
    setMessages([]);
    setElapsedSeconds(0);
    setStatus("connecting");

    // 1. Demander l'accès micro
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err: unknown) {
      const mediaError = err as DOMException;
      if (
        mediaError.name === "NotAllowedError" ||
        mediaError.name === "PermissionDeniedError"
      ) {
        reportError(ERROR_MESSAGES.MICROPHONE_DENIED);
      } else if (
        mediaError.name === "NotFoundError" ||
        mediaError.name === "DevicesNotFoundError"
      ) {
        reportError(ERROR_MESSAGES.MICROPHONE_NOT_FOUND);
      } else {
        reportError(ERROR_MESSAGES.MICROPHONE_GENERIC);
      }
      return;
    }

    // 2. Créer la session via notre API
    let sessionData: SessionResponse;
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_URL}/api/voice/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ summary_id: summaryId, language }),
        credentials: "include",
      });

      if (response.status === 403 || response.status === 429) {
        releaseMediaStream();
        setStatus("quota_exceeded");
        setError(ERROR_MESSAGES.QUOTA_EXCEEDED);
        onError?.(ERROR_MESSAGES.QUOTA_EXCEEDED);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      sessionData = await response.json();
      setRemainingMinutes(sessionData.quota_remaining_minutes);
      maxSecondsRef.current = sessionData.max_session_minutes * 60;
      // Store input mode from session response
      const sessionInputMode = sessionData.input_mode || "ptt";
      inputModeRef.current = sessionInputMode;
      setInputMode(sessionInputMode);
    } catch (err) {
      releaseMediaStream();
      if (err instanceof TypeError) {
        // TypeError = network failure (fetch)
        reportError(ERROR_MESSAGES.NETWORK);
      } else {
        reportError(ERROR_MESSAGES.SESSION_FAILED);
      }
      return;
    }

    // 3. Charger le SDK ElevenLabs et démarrer la session
    try {
      const { Conversation } = await import("@elevenlabs/client");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversation = await (Conversation as any).startSession({
        signedUrl: sessionData.signed_url,
        onConnect: () => {
          if (isMountedRef.current) {
            setStatus("listening");
          }
        },
        onDisconnect: () => {
          if (isMountedRef.current) {
            stopTimer();
            setStatus("idle");
            setIsSpeaking(false);
          }
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onMessage: (
          message: {
            message: string;
            source: "user" | "ai";
            type?: string;
            tool_name?: string;
          } & Record<string, any>,
        ) => {
          if (!isMountedRef.current) return;
          // Detect tool calls for VoiceToolIndicator
          if (message.type === "tool_call" || message.tool_name) {
            setActiveTool(message.tool_name || "unknown");
          }
          setMessages((prev) => [
            ...prev,
            { text: message.message, source: message.source },
          ]);
        },
        onError: (err: Error | string) => {
          if (isMountedRef.current) {
            const msg =
              typeof err === "string"
                ? err
                : err.message || ERROR_MESSAGES.UNKNOWN;
            reportError(msg);
          }
        },
        onStatusChange: (statusInfo: { status: string }) => {
          if (!isMountedRef.current) return;
          switch (statusInfo.status) {
            case "speaking":
              setActiveTool(null); // Tool call finished, agent responding
              setIsSpeaking(true);
              setStatus("speaking");
              break;
            case "listening":
              setActiveTool(null);
              setIsSpeaking(false);
              setStatus("listening");
              break;
            case "thinking":
            case "processing":
              setIsSpeaking(false);
              setStatus("thinking");
              break;
          }
        },
      });

      conversationRef.current = conversation;

      // 4. PTT mode: start with mic muted (user must hold button to talk)
      if (sessionInputMode === "ptt") {
        setMicMuted(true);
      }

      // 5. Apply client-side playback rate if needed (Phase 2: speed control)
      if (sessionData.playback_rate) {
        setPlaybackRate(sessionData.playback_rate);
        if (sessionData.playback_rate > 1.0) {
          applyPlaybackRate(sessionData.playback_rate);
        }
      }

      // 6. Démarrer le timer
      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          // Auto-stop si durée max atteinte
          if (maxSecondsRef.current > 0 && next >= maxSecondsRef.current) {
            stop();
            setError(ERROR_MESSAGES.SESSION_TIMEOUT);
          }
          return next;
        });
      }, 1000);
    } catch {
      releaseMediaStream();
      reportError(ERROR_MESSAGES.SDK_LOAD_FAILED);
    }
  }, [
    status,
    summaryId,
    language,
    onError,
    reportError,
    releaseMediaStream,
    stopTimer,
    stop,
    setMicMuted,
    applyPlaybackRate,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // toggleMute()
  // ─────────────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;
    const nextMuted = !isMuted;
    setMicMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted, setMicMuted]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTimer();
      releaseMediaStream();
      cleanupPlaybackObserver();
      cleanupPlaybackPolling();

      // Fin de session ElevenLabs
      if (conversationRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (conversationRef.current as any).endSession();
        } catch {
          // Ignorer
        }
        conversationRef.current = null;
      }
    };
  }, [
    stopTimer,
    releaseMediaStream,
    cleanupPlaybackObserver,
    cleanupPlaybackPolling,
  ]);

  return {
    start,
    stop,
    toggleMute,
    startTalking,
    stopTalking,
    status,
    isSpeaking,
    isMuted,
    isTalking,
    inputMode,
    activeTool,
    messages,
    elapsedSeconds,
    remainingMinutes,
    error,
    playbackRate,
  };
}
