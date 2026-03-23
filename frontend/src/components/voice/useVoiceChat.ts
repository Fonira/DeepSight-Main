/**
 * useVoiceChat — Hook d'orchestration de conversation vocale
 * Gère le cycle complet : micro → API session → ElevenLabs SDK → timer → cleanup
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { API_URL, getAccessToken } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface UseVoiceChatOptions {
  summaryId: number;
  onError?: (error: string) => void;
}

type VoiceChatStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'quota_exceeded';

interface VoiceChatMessage {
  text: string;
  source: 'user' | 'ai';
}

interface SessionResponse {
  session_id: string;
  signed_url: string;
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
// Erreurs françaises
// ═══════════════════════════════════════════════════════════════════════════════

const ERROR_MESSAGES = {
  MICROPHONE_DENIED: 'Accès au microphone refusé. Veuillez autoriser le micro dans les paramètres de votre navigateur.',
  MICROPHONE_NOT_FOUND: 'Aucun microphone détecté. Veuillez brancher un micro et réessayer.',
  MICROPHONE_GENERIC: 'Impossible d\'accéder au microphone. Vérifiez vos permissions.',
  NETWORK: 'Erreur réseau. Vérifiez votre connexion internet et réessayez.',
  API_DOWN: 'Le serveur est temporairement indisponible. Réessayez dans quelques instants.',
  QUOTA_EXCEEDED: 'Quota de conversation vocale épuisé. Passez à un plan supérieur pour continuer.',
  SESSION_FAILED: 'Impossible de démarrer la session vocale. Réessayez.',
  SDK_LOAD_FAILED: 'Impossible de charger le module de conversation vocale.',
  SESSION_TIMEOUT: 'Session terminée : durée maximale atteinte.',
  UNKNOWN: 'Une erreur inattendue est survenue. Réessayez.',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useVoiceChat({ summaryId, onError }: UseVoiceChatOptions): UseVoiceChatReturn {
  const [status, setStatus] = useState<VoiceChatStatus>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs pour le cleanup
  const conversationRef = useRef<unknown>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxSecondsRef = useRef<number>(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      setStatus('error');
      onError?.(msg);
    },
    [onError]
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

  // ─────────────────────────────────────────────────────────────────────────
  // stop()
  // ─────────────────────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    stopTimer();

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
      setStatus('idle');
      setIsSpeaking(false);
      setIsMuted(false);
      setElapsedSeconds(0);
    }
  }, [stopTimer, releaseMediaStream]);

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    // Empêcher les démarrages multiples
    if (status === 'connecting' || status === 'listening' || status === 'speaking') {
      return;
    }

    setError(null);
    setMessages([]);
    setElapsedSeconds(0);
    setStatus('connecting');

    // 1. Demander l'accès micro
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
    } catch (err: unknown) {
      const mediaError = err as DOMException;
      if (mediaError.name === 'NotAllowedError' || mediaError.name === 'PermissionDeniedError') {
        reportError(ERROR_MESSAGES.MICROPHONE_DENIED);
      } else if (mediaError.name === 'NotFoundError' || mediaError.name === 'DevicesNotFoundError') {
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ summary_id: summaryId }),
        credentials: 'include',
      });

      if (response.status === 403 || response.status === 429) {
        releaseMediaStream();
        setStatus('quota_exceeded');
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
      const { Conversation } = await import('@elevenlabs/client');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conversation = await (Conversation as any).startSession({
        signedUrl: sessionData.signed_url,
        onConnect: () => {
          if (isMountedRef.current) {
            setStatus('listening');
          }
        },
        onDisconnect: () => {
          if (isMountedRef.current) {
            stopTimer();
            setStatus('idle');
            setIsSpeaking(false);
          }
        },
        onMessage: (message: { message: string; source: 'user' | 'ai' }) => {
          if (isMountedRef.current) {
            setMessages((prev) => [
              ...prev,
              { text: message.message, source: message.source },
            ]);
          }
        },
        onError: (err: Error | string) => {
          if (isMountedRef.current) {
            const msg = typeof err === 'string' ? err : err.message || ERROR_MESSAGES.UNKNOWN;
            reportError(msg);
          }
        },
        onStatusChange: (statusInfo: { status: string }) => {
          if (!isMountedRef.current) return;
          switch (statusInfo.status) {
            case 'speaking':
              setIsSpeaking(true);
              setStatus('speaking');
              break;
            case 'listening':
              setIsSpeaking(false);
              setStatus('listening');
              break;
            case 'thinking':
            case 'processing':
              setIsSpeaking(false);
              setStatus('thinking');
              break;
          }
        },
      });

      conversationRef.current = conversation;

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
      releaseMediaStream();
      reportError(ERROR_MESSAGES.SDK_LOAD_FAILED);
    }
  }, [status, summaryId, onError, reportError, releaseMediaStream, stopTimer, stop]);

  // ─────────────────────────────────────────────────────────────────────────
  // toggleMute()
  // ─────────────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;

    const nextMuted = !isMuted;

    // Mute/unmute via le SDK ElevenLabs
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationRef.current as any;
      if (typeof conv.setVolume === 'function') {
        // Certaines versions du SDK utilisent setVolume pour le micro input
        conv.setVolume({ inputVolume: nextMuted ? 0 : 1 });
      }
    } catch {
      // Fallback : mute via le MediaStream directement
    }

    // Fallback robuste : mute directement les tracks audio du micro
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    setIsMuted(nextMuted);
  }, [isMuted]);

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopTimer();
      releaseMediaStream();

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
  }, [stopTimer, releaseMediaStream]);

  return {
    start,
    stop,
    toggleMute,
    status,
    isSpeaking,
    isMuted,
    messages,
    elapsedSeconds,
    remainingMinutes,
    error,
  };
}
