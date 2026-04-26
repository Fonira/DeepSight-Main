/**
 * useVoiceChat — Hook d'orchestration de conversation vocale (React Native)
 * Gère le cycle complet : permissions micro → API session → ElevenLabs RN SDK → timer → cleanup
 *
 * Utilise @elevenlabs/react-native (useConversation) pour la gestion native audio.
 * Le SDK gère automatiquement : WebSocket, audio input/output, VAD, etc.
 *
 * Spec #3 (Mobile Library + Study chat) :
 *   - `summaryId` optionnel : si absent → mode `companion` (chat libre).
 *   - `agentType` paramétrable : explorer (default si summaryId présent) /
 *     companion (default sinon) / debate_moderator.
 *   - `onMessage` callback étendu : capture les transcripts et les persiste
 *     via `voiceApi.appendTranscript` pour la timeline unifiée chat ↔ voix.
 *   - `sendUserMessage(text)` : injection texte → voix (l'utilisateur tape
 *     pendant que la conversation vocale tourne, l'agent répond à l'oral).
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useConversation } from "@elevenlabs/react-native";
import { voiceApi } from "../../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type VoiceAgentType = "explorer" | "companion" | "debate_moderator";

interface UseVoiceChatOptions {
  /**
   * ID de l'analyse vidéo (string car typé via expo-router params).
   * Optionnel : si absent, l'agent passe en mode `companion` (chat libre).
   */
  summaryId?: string;
  /**
   * Type d'agent backend. Default :
   *   - `explorer` si summaryId présent
   *   - `companion` sinon
   */
  agentType?: VoiceAgentType;
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
  agent_id: string;
  /** LiveKit JWT fourni par le backend pour le SDK @elevenlabs/react-native. */
  conversation_token?: string | null;
  expires_at: string;
  quota_remaining_minutes: number;
  max_session_minutes: number;
}

interface UseVoiceChatReturn {
  /** Démarrer la conversation */
  start: () => Promise<void>;
  /** Arrêter la conversation */
  stop: () => Promise<void>;
  /** Toggle mute micro */
  toggleMute: () => void;
  /**
   * Spec #3 — Injecte un message texte dans la conversation vocale en cours.
   * L'agent répond à l'oral. No-op si pas de session active.
   */
  sendUserMessage: (text: string) => void;
  /** Status de la connexion */
  status: VoiceChatStatus;
  /** L'IA est en train de parler */
  isSpeaking: boolean;
  /** Le micro est muted */
  isMuted: boolean;
  /** Messages de la conversation */
  messages: VoiceChatMessage[];
  /** Secondes écoulées dans la session */
  elapsedSeconds: number;
  /** Minutes restantes dans le quota */
  remainingMinutes: number;
  /** Erreur */
  error: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Erreurs françaises (adaptées mobile)
// ═══════════════════════════════════════════════════════════════════════════════

const ERROR_MESSAGES = {
  MICROPHONE_DENIED:
    "Autorisez l'accès au micro dans les réglages de votre appareil.",
  MICROPHONE_GENERIC:
    "Impossible d'accéder au microphone. Vérifiez vos permissions.",
  NETWORK: "Vérifiez votre connexion internet et réessayez.",
  QUOTA_EXCEEDED:
    "Quota vocal épuisé. Passez à un plan supérieur pour continuer.",
  SESSION_FAILED: "Impossible de démarrer la session vocale. Réessayez.",
  SDK_INIT_FAILED: "Impossible d'initialiser le module vocal.",
  SESSION_TIMEOUT: "Session terminée : durée maximale atteinte.",
  APP_BACKGROUNDED:
    "Session arrêtée car l'application est passée en arrière-plan.",
  UNKNOWN: "Une erreur inattendue est survenue. Réessayez.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useVoiceChat(
  options: UseVoiceChatOptions = {},
): UseVoiceChatReturn {
  const { summaryId, agentType, onError } = options;
  const [status, setStatus] = useState<VoiceChatStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs pour le cleanup
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSecondsRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  const isActiveRef = useRef(false);

  // Spec #3 — refs pour la persistence des transcripts
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number>(0);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback(
    (msg: string) => {
      if (!isMountedRef.current) return;
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

  // ─────────────────────────────────────────────────────────────────────────
  // ElevenLabs React Native SDK — useConversation
  // ─────────────────────────────────────────────────────────────────────────

  const conversation = useConversation({
    onConnect: () => {
      if (isMountedRef.current) {
        setStatus("listening");
      }
    },
    onDisconnect: () => {
      if (isMountedRef.current) {
        stopTimer();
        isActiveRef.current = false;
        setStatus("idle");
      }
    },
    onMessage: (message: { message: string; source: "user" | "ai" }) => {
      if (isMountedRef.current) {
        setMessages((prev) => [
          ...prev,
          { text: message.message, source: message.source },
        ]);
      }

      // Spec #3 — persiste le transcript pour la timeline unifiée chat ↔ voix.
      // Best-effort : fire-and-forget, on ne bloque pas la conversation si
      // l'API hoquette. Ne s'exécute que si une session est active.
      const sessionId = sessionIdRef.current;
      const startedAt = sessionStartedAtRef.current;
      if (sessionId && startedAt) {
        const timeInCallSecs = (Date.now() - startedAt) / 1000;
        voiceApi
          .appendTranscript({
            voice_session_id: sessionId,
            speaker: message.source === "user" ? "user" : "agent",
            content: message.message,
            time_in_call_secs: timeInCallSecs,
          })
          .catch(() => {
            // Silent fail — le webhook reconciliation backend récupérera
            // les transcripts manqués post-call (cf. Spec #1f).
          });
      }
    },
    onError: (err: Error | string) => {
      if (isMountedRef.current) {
        const msg =
          typeof err === "string" ? err : err.message || ERROR_MESSAGES.UNKNOWN;
        reportError(msg);
      }
    },
    onStatusChange: (statusInfo: { status: string }) => {
      if (!isMountedRef.current) return;
      switch (statusInfo.status) {
        case "speaking":
          setStatus("speaking");
          break;
        case "listening":
          setStatus("listening");
          break;
        case "thinking":
        case "processing":
          setStatus("thinking");
          break;
      }
    },
  });

  // ─────────────────────────────────────────────────────────────────────────
  // stop()
  // ─────────────────────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    stopTimer();
    isActiveRef.current = false;

    // End ElevenLabs session via RN SDK
    try {
      await conversation.endSession();
    } catch {
      // Ignorer les erreurs de fin de session
    }

    // Haptic feedback au stop
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Haptics non disponibles (simulateur)
    }

    if (isMountedRef.current) {
      setStatus("idle");
      setIsMuted(false);
      setElapsedSeconds(0);
    }

    // Spec #3 — purge les refs de session pour empêcher les transcripts
    // tardifs (post-stop) d'être attribués à la session précédente.
    sessionIdRef.current = null;
    sessionStartedAtRef.current = 0;
  }, [stopTimer, conversation]);

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

    // 1. Demander la permission micro via expo-av
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        reportError(ERROR_MESSAGES.MICROPHONE_DENIED);
        return;
      }

      // Configurer le mode audio pour l'enregistrement + lecture simultanée
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
    } catch {
      reportError(ERROR_MESSAGES.MICROPHONE_GENERIC);
      return;
    }

    // 2. Créer la session via notre API backend
    let sessionData: SessionResponse;
    try {
      // summaryId optionnel : présent → mode explorer, absent → mode companion
      let numericId: number | undefined;
      if (summaryId !== undefined && summaryId !== null && summaryId !== "") {
        numericId = parseInt(summaryId, 10);
        if (isNaN(numericId)) {
          reportError(ERROR_MESSAGES.SESSION_FAILED);
          return;
        }
      }

      const resolvedAgentType: VoiceAgentType =
        agentType ?? (numericId !== undefined ? "explorer" : "companion");

      sessionData = (await voiceApi.createSession({
        summary_id: numericId,
        agent_type: resolvedAgentType,
        language: "fr",
      })) as SessionResponse;
      setRemainingMinutes(sessionData.quota_remaining_minutes);
      maxSecondsRef.current = sessionData.max_session_minutes * 60;

      // Spec #3 — mémorise session_id et timestamp de démarrage pour
      // calculer time_in_call_secs lors de chaque appendTranscript.
      sessionIdRef.current = sessionData.session_id;
      sessionStartedAtRef.current = Date.now();
    } catch (err: unknown) {
      // Vérifier si c'est une erreur de quota (403/429)
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 403 || apiError.status === 429) {
        setStatus("quota_exceeded");
        setError(ERROR_MESSAGES.QUOTA_EXCEEDED);
        onError?.(ERROR_MESSAGES.QUOTA_EXCEEDED);
        return;
      }

      // Erreur réseau vs autre
      if (
        err instanceof TypeError ||
        (apiError.message && apiError.message.includes("network"))
      ) {
        reportError(ERROR_MESSAGES.NETWORK);
      } else {
        reportError(ERROR_MESSAGES.SESSION_FAILED);
      }
      return;
    }

    // 3. Démarrer la session ElevenLabs via le SDK React Native
    // Le SDK WebRTC (@elevenlabs/react-native) attend un conversationToken
    // LiveKit JWT. Le backend l'expose désormais dans la réponse /session ;
    // on retombe sur agentId seulement si le backend n'a pas pu le fournir.
    try {
      const conversationToken = sessionData.conversation_token || undefined;

      await conversation.startSession({
        ...(conversationToken
          ? { conversationToken }
          : { agentId: sessionData.agent_id }),
        overrides: {
          agent: {
            language: "fr",
          },
        },
      });

      isActiveRef.current = true;

      // Haptic feedback au start
      try {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
      } catch {
        // Haptics non disponibles (simulateur)
      }

      // 4. Démarrer le timer
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
      reportError(ERROR_MESSAGES.SDK_INIT_FAILED);
    }
  }, [status, summaryId, agentType, onError, reportError, stop, conversation]);

  // ─────────────────────────────────────────────────────────────────────────
  // sendUserMessage() — Spec #3 (sync chat texte → voix)
  // ─────────────────────────────────────────────────────────────────────────

  const sendUserMessage = useCallback(
    (text: string) => {
      if (!sessionIdRef.current) {
        // No-op silencieux : si le user tape avant qu'on ait démarré,
        // le caller doit gérer (start auto, ou fallback chat texte).
        return;
      }
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        // Le SDK ElevenLabs accepte sendUserMessage(text) pour injecter un
        // tour conversationnel (le LLM répond comme si l'utilisateur l'avait
        // dit à l'oral).
        const conv = conversation as unknown as {
          sendUserMessage?: (msg: string) => void;
        };
        conv.sendUserMessage?.(trimmed);
      } catch {
        // SDK pas prêt ou non supporté — silent fail.
      }
    },
    [conversation],
  );

  // ─────────────────────────────────────────────────────────────────────────
  // toggleMute()
  // ─────────────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;

    // Muter via le SDK RN ElevenLabs
    try {
      conversation.setMicMuted(nextMuted);
    } catch {
      // Ignorer — le mute est géré côté état
    }

    // Haptic feedback au toggle
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics non disponibles
    }

    setIsMuted(nextMuted);
  }, [isMuted, conversation]);

  // ─────────────────────────────────────────────────────────────────────────
  // AppState — auto-stop quand l'app passe en background
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background" || nextAppState === "inactive") {
        if (isActiveRef.current) {
          stop();
          if (isMountedRef.current) {
            setError(ERROR_MESSAGES.APP_BACKGROUNDED);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );

    return () => {
      subscription.remove();
    };
  }, [stop]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      isActiveRef.current = false;
      stopTimer();

      // Réinitialiser le mode audio
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      }).catch(() => {
        // Ignorer les erreurs de cleanup audio
      });
    };
  }, [stopTimer]);

  return {
    start,
    stop,
    toggleMute,
    sendUserMessage,
    status,
    isSpeaking: conversation.isSpeaking,
    isMuted,
    messages,
    elapsedSeconds,
    remainingMinutes,
    error,
  };
}
