/**
 * useVoiceChat — Hook d'orchestration de conversation vocale
 * Gère le cycle complet : micro → API session → ElevenLabs SDK → timer → cleanup
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type RefObject,
} from "react";
import { API_URL, getAccessToken } from "../../services/api";
import {
  subscribeVoicePrefsEvents,
  emitVoicePrefsEvent,
} from "./voicePrefsBus";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface UseVoiceChatOptions {
  /** ID de l'analyse vidéo (agents explorer / tutor / quiz_coach). */
  summaryId?: number;
  /** ID du débat IA (agent debate_moderator). XOR avec summaryId. */
  debateId?: number;
  /** Type d'agent vocal. Défaut : "explorer". */
  agentType?:
    | "explorer"
    | "companion"
    | "tutor"
    | "knowledge_tutor"
    | "debate_moderator"
    | "quiz_coach"
    | "onboarding";
  language?: "fr" | "en";
  onError?: (error: string) => void;
  /**
   * COMPANION-only — fired when the agent invokes the `transfer_to_video`
   * tool. Receives the resolved target so the caller can navigate / re-mount
   * the overlay in EXPLORER mode on the new summary_id. The payload comes
   * from `GET /api/voice/companion-pending-transfer/{voice_session_id}`,
   * fetched by the hook right after the SDK signals the tool call.
   */
  onTransferRequest?: (payload: {
    summary_id: number;
    video_id: string | null;
    video_title: string;
    video_channel: string | null;
  }) => void;
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
  /** Touche clavier configurée pour le push-to-talk. */
  ptt_key?: string;
  playback_rate: number;
}

interface UseVoiceChatReturn {
  /** Démarrer la conversation */
  start: () => Promise<void>;
  /** Précharger le SDK ElevenLabs (appelé au mount du Hero pour réduire la latence) */
  prewarm: () => void;
  /** Arrêter la conversation */
  stop: () => Promise<void>;
  /** Toggle mute micro */
  toggleMute: () => void;
  /** PTT: appuyer pour parler */
  startTalking: () => void;
  /** PTT: relâcher pour que l'agent réponde */
  stopTalking: () => void;
  /**
   * Spec #5 — Inject un message texte dans la conversation ElevenLabs active.
   * Utilisé par le Chat IA pour le mode hybride (user tape un message texte
   * pendant que l'appel voice est actif). L'agent répond via onMessage.
   * No-op si pas de session active.
   */
  sendUserMessage: (text: string) => void;
  /**
   * Spec #5 — voice_session_id de la session ElevenLabs courante (depuis backend).
   * Utilisé pour persister les transcripts via /api/voice/transcripts/append.
   */
  voiceSessionId: string | null;
  /**
   * Spec #5 — timestamp (ms) auquel la session voice a démarré (onConnect).
   * Permet de calculer time_in_call_secs précis.
   */
  sessionStartedAt: number | null;
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
  /** Touche clavier active pour PTT (depuis les préférences user) */
  pttKey: string;
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
  /** Ref vers le MediaStream du micro (pour AudioContext/AnalyserNode). */
  micStream: RefObject<MediaStream | null>;
  /** Redémarre la session (stop + start) pour appliquer de nouvelles prefs. */
  restart: () => Promise<void>;
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
  debateId,
  agentType,
  language = "fr",
  onError,
  onTransferRequest,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [inputMode, setInputMode] = useState<"ptt" | "vad">("ptt");
  const [pttKey, setPttKey] = useState<string>(" ");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  // Spec #5 — exposition session info pour persistance Chat IA
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const voiceSessionIdRef = useRef<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);

  // Refs pour le cleanup
  const conversationRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSecondsRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const playbackObserverRef = useRef<MutationObserver | null>(null);
  const playbackPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputModeRef = useRef<"ptt" | "vad">("ptt");
  const pttKeyRef = useRef<string>(" ");
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
      // Spec #5 — reset session info
      setVoiceSessionId(null);
      voiceSessionIdRef.current = null;
      setSessionStartedAt(null);
    }
    emitVoicePrefsEvent({ type: "call_status_changed", active: false });
  }, [
    stopTimer,
    releaseMediaStream,
    cleanupPlaybackObserver,
    cleanupPlaybackPolling,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Spec #5 — sendUserMessage()
  // Inject un message texte dans la conversation ElevenLabs active.
  // ─────────────────────────────────────────────────────────────────────────

  const sendUserMessage = useCallback((text: string) => {
    if (!conversationRef.current || !text || !text.trim()) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationRef.current as any;
      if (typeof conv.sendUserMessage === "function") {
        conv.sendUserMessage(text);
      }
    } catch (err) {
      // SDK method unavailable — pas critique
      console.warn("[useVoiceChat] sendUserMessage failed:", err);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  // Prewarm: précharge le SDK ElevenLabs côté client pour économiser ~200-300ms au clic
  const prewarmedRef = useRef(false);
  // Guard contre les démarrages concurrents — closure-safe (les refs ne sont
  // jamais capturées de façon obsolète, contrairement à la valeur de `status`).
  const isStartingRef = useRef(false);
  const prewarm = useCallback(() => {
    if (prewarmedRef.current) return;
    prewarmedRef.current = true;
    // Fire-and-forget: le bundle sera dans le cache du navigateur au moment du start()
    import("@elevenlabs/client").catch(() => {
      prewarmedRef.current = false;
    });
  }, []);

  const start = useCallback(async () => {
    // Empêcher les démarrages multiples (ref-based pour éviter le closure trap :
    // une useCallback qui dépend de `status` capture une valeur obsolète quand
    // restart() relance start() depuis le bus listener).
    if (isStartingRef.current || conversationRef.current) {
      return;
    }
    isStartingRef.current = true;

    try {
      setError(null);
      setMessages([]);
      setElapsedSeconds(0);
      setStatus("connecting");

      // 1. Lancer en PARALLÈLE : accès micro + preload SDK ElevenLabs
      //    (sans attendre la session, économie de ~200-500ms vs exécution séquentielle)
      const sdkPromise = import("@elevenlabs/client").catch((e) => {
        console.warn("SDK preload failed:", e);
        return null;
      });
      const micPromise = navigator.mediaDevices
        .getUserMedia({ audio: true })
        .catch((err: unknown) => err as DOMException);

      let stream: MediaStream;
      const micResult = await micPromise;
      if (micResult instanceof MediaStream) {
        stream = micResult;
        mediaStreamRef.current = stream;
      } else {
        const mediaError = micResult as DOMException;
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
          body: JSON.stringify({
            ...(debateId != null
              ? { debate_id: debateId }
              : { summary_id: summaryId }),
            language,
            agent_type:
              agentType ?? (debateId != null ? "debate_moderator" : "explorer"),
          }),
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
        // Spec #5 — expose session_id pour la persistance des transcripts
        setVoiceSessionId(sessionData.session_id);
        voiceSessionIdRef.current = sessionData.session_id;
        // Store input mode from session response
        const sessionInputMode = sessionData.input_mode || "ptt";
        inputModeRef.current = sessionInputMode;
        setInputMode(sessionInputMode);
        const sessionPttKey = sessionData.ptt_key || " ";
        pttKeyRef.current = sessionPttKey;
        setPttKey(sessionPttKey);
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

      // 3. Charger le SDK ElevenLabs (déjà preloadé en parallèle) et démarrer la session
      try {
        const sdkModule = await sdkPromise;
        const { Conversation } =
          sdkModule ?? (await import("@elevenlabs/client"));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const conversation = await (Conversation as any).startSession({
          signedUrl: sessionData.signed_url,
          onConnect: () => {
            if (isMountedRef.current) {
              setStatus("listening");
              // Spec #5 — timestamp précis du démarrage pour time_in_call_secs
              setSessionStartedAt(Date.now());
            }
            emitVoicePrefsEvent({ type: "call_status_changed", active: true });
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
              // COMPANION transfer_to_video — fetch pending payload + bubble up
              if (
                message.tool_name === "transfer_to_video" &&
                onTransferRequest &&
                voiceSessionIdRef.current
              ) {
                const sessionId = voiceSessionIdRef.current;
                const token = getAccessToken();
                fetch(
                  `${API_URL}/api/voice/companion-pending-transfer/${sessionId}`,
                  {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                  },
                )
                  .then((r) => (r.ok ? r.json() : null))
                  .then((payload) => {
                    if (
                      payload &&
                      typeof payload.summary_id === "number" &&
                      isMountedRef.current
                    ) {
                      onTransferRequest({
                        summary_id: payload.summary_id,
                        video_id: payload.video_id ?? null,
                        video_title: payload.video_title ?? "ta vidéo",
                        video_channel: payload.video_channel ?? null,
                      });
                    }
                  })
                  .catch(() => {
                    /* silent — transfer is best-effort */
                  });
              }
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
        if (inputModeRef.current === "ptt") {
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
      } catch (err) {
        // Surface the real cause — SDK import vs startSession() vs unknown.
        // Without this the user only sees "SDK_LOAD_FAILED" and we lose all
        // diagnostic signal (Sentry is disabled in prod).
        // eslint-disable-next-line no-console
        console.error("[useVoiceChat] startSession failed:", err);
        releaseMediaStream();
        const message =
          err instanceof Error
            ? `${ERROR_MESSAGES.SDK_LOAD_FAILED} (${err.name}: ${err.message})`
            : ERROR_MESSAGES.SDK_LOAD_FAILED;
        reportError(message);
      }
    } finally {
      isStartingRef.current = false;
    }
  }, [
    summaryId,
    debateId,
    agentType,
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
  // restart() — stop + start for applying fresh prefs to a new agent
  // ─────────────────────────────────────────────────────────────────────────

  const restart = useCallback(async () => {
    await stop();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await start();
  }, [stop, start]);

  // ─────────────────────────────────────────────────────────────────────────
  // Live-apply playback_rate changes coming from VoiceSettings
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = subscribeVoicePrefsEvents((event) => {
      if (event.type !== "playback_rate_changed") return;
      if (!conversationRef.current) return;
      const rate = event.value;
      setPlaybackRate(rate);
      document.querySelectorAll("audio").forEach((el) => {
        el.playbackRate = rate;
      });
      cleanupPlaybackObserver();
      cleanupPlaybackPolling();
      if (rate > 1.0) {
        applyPlaybackRate(rate);
      }
    });
    return unsubscribe;
  }, [applyPlaybackRate, cleanupPlaybackObserver, cleanupPlaybackPolling]);

  // Live-restart when the staging provider applies a restart-required diff.
  useEffect(() => {
    const unsubscribe = subscribeVoicePrefsEvents((event) => {
      if (event.type !== "apply_with_restart") return;
      if (!conversationRef.current) return;
      void restart();
    });
    return unsubscribe;
  }, [restart]);

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
    prewarm,
    stop,
    restart,
    toggleMute,
    startTalking,
    stopTalking,
    sendUserMessage,
    status,
    isSpeaking,
    isMuted,
    isTalking,
    inputMode,
    pttKey,
    activeTool,
    messages,
    elapsedSeconds,
    remainingMinutes,
    error,
    playbackRate,
    micStream: mediaStreamRef,
    voiceSessionId,
    sessionStartedAt,
  };
}
