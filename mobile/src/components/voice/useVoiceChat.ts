/**
 * useVoiceChat — Hook d'orchestration de conversation vocale (React Native)
 * Gère le cycle complet : permissions micro → API session → ElevenLabs → timer → cleanup
 * Adapté du hook web avec gestion AppState, expo-av, et haptics.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { voiceApi } from '../../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface UseVoiceChatOptions {
  summaryId: string;
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
  NETWORK: 'Vérifiez votre connexion internet et réessayez.',
  QUOTA_EXCEEDED: 'Quota vocal épuisé. Passez à un plan supérieur pour continuer.',
  SESSION_FAILED: 'Impossible de démarrer la session vocale. Réessayez.',
  SDK_LOAD_FAILED: 'Impossible de charger le module de conversation vocale.',
  SESSION_TIMEOUT: 'Session terminée : durée maximale atteinte.',
  APP_BACKGROUNDED: 'Session arrêtée car l\'application est passée en arrière-plan.',
  UNKNOWN: 'Une erreur inattendue est survenue. Réessayez.',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useVoiceChat({
  summaryId,
  onError,
}: UseVoiceChatOptions): UseVoiceChatReturn {
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
  const isMountedRef = useRef(true);
  const isActiveRef = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const reportError = useCallback(
    (msg: string) => {
      setError(msg);
      setStatus('error');
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
  // stop()
  // ─────────────────────────────────────────────────────────────────────────

  const stop = useCallback(async () => {
    stopTimer();
    isActiveRef.current = false;

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

    // Haptic feedback au stop
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {
      // Haptics non disponibles (simulateur)
    }

    if (isMountedRef.current) {
      setStatus('idle');
      setIsSpeaking(false);
      setIsMuted(false);
      setElapsedSeconds(0);
    }
  }, [stopTimer]);

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    // Empêcher les démarrages multiples
    if (
      status === 'connecting' ||
      status === 'listening' ||
      status === 'speaking'
    ) {
      return;
    }

    setError(null);
    setMessages([]);
    setElapsedSeconds(0);
    setStatus('connecting');

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

    // 2. Créer la session via notre API
    let sessionData: SessionResponse;
    try {
      const numericId = parseInt(summaryId, 10);
      if (isNaN(numericId)) {
        reportError(ERROR_MESSAGES.SESSION_FAILED);
        return;
      }

      sessionData = await voiceApi.createSession(numericId, 'fr');
      setRemainingMinutes(sessionData.quota_remaining_minutes);
      maxSecondsRef.current = sessionData.max_session_minutes * 60;
    } catch (err: unknown) {
      // Vérifier si c'est une erreur de quota (403/429)
      const apiError = err as { status?: number; message?: string };
      if (apiError.status === 403 || apiError.status === 429) {
        setStatus('quota_exceeded');
        setError(ERROR_MESSAGES.QUOTA_EXCEEDED);
        onError?.(ERROR_MESSAGES.QUOTA_EXCEEDED);
        return;
      }

      // Erreur réseau vs autre
      if (
        err instanceof TypeError ||
        (apiError.message && apiError.message.includes('network'))
      ) {
        reportError(ERROR_MESSAGES.NETWORK);
      } else {
        reportError(ERROR_MESSAGES.SESSION_FAILED);
      }
      return;
    }

    // 3. Charger le SDK ElevenLabs React Native et démarrer la session
    try {
      // TODO: Quand @elevenlabs/react-native sera installé, remplacer par :
      // import { Conversation } from '@elevenlabs/react-native';
      let Conversation: unknown;
      try {
        const elevenLabsModule = await import('@elevenlabs/react-native');
        Conversation = (elevenLabsModule as { Conversation: unknown }).Conversation;
      } catch {
        // Fallback : tenter le client web (certaines API sont compatibles RN)
        try {
          const clientModule = await import('@elevenlabs/client');
          Conversation = (clientModule as { Conversation: unknown }).Conversation;
        } catch {
          throw new Error('ElevenLabs SDK not available');
        }
      }

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
            isActiveRef.current = false;
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
            const msg =
              typeof err === 'string'
                ? err
                : err.message || ERROR_MESSAGES.UNKNOWN;
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
      reportError(ERROR_MESSAGES.SDK_LOAD_FAILED);
    }
  }, [status, summaryId, onError, reportError, stopTimer, stop]);

  // ─────────────────────────────────────────────────────────────────────────
  // toggleMute()
  // ─────────────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;

    const nextMuted = !isMuted;

    // Tenter de muter via le SDK ElevenLabs
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationRef.current as any;
      if (typeof conv.setVolume === 'function') {
        conv.setVolume({ inputVolume: nextMuted ? 0 : 1 });
      }
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
  }, [isMuted]);

  // ─────────────────────────────────────────────────────────────────────────
  // AppState — auto-stop quand l'app passe en background
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        nextAppState === 'background' ||
        nextAppState === 'inactive'
      ) {
        if (isActiveRef.current) {
          stop();
          if (isMountedRef.current) {
            setError(ERROR_MESSAGES.APP_BACKGROUNDED);
          }
        }
      }
    };

    const subscription = AppState.addEventListener(
      'change',
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
    status,
    isSpeaking,
    isMuted,
    messages,
    elapsedSeconds,
    remainingMinutes,
    error,
  };
}
