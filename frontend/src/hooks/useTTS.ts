/**
 * useTTS — Hook for ElevenLabs Text-to-Speech
 * v2 — Now delegates to TTSContext for shared state.
 * Kept for backward compatibility with AudioPlayerButton and other consumers.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { API_URL, getAccessToken } from '../services/api';

interface UseTTSReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  play: (text: string, voiceId?: string) => Promise<void>;
  stop: () => void;
}

export function useTTS(): UseTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsLoading(false);
  }, [cleanup]);

  const play = useCallback(async (text: string, voiceId?: string) => {
    if (isPlaying || isLoading) {
      stop();
      return;
    }

    if (!text || text.trim().length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = getAccessToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${API_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language: 'fr',
          gender: 'female',
          speed: 1.0,
          strip_questions: true,
          ...(voiceId && { voice_id: voiceId }),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const detail = data?.detail;
        if (response.status === 403 && detail?.error === 'feature_locked') {
          throw new Error(detail.message || 'Upgrade your plan for TTS');
        }
        throw new Error(
          typeof detail === 'string' ? detail : detail?.message || `TTS error (${response.status})`
        );
      }

      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Empty audio response');

      cleanup();

      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioRef.current = audio;

      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setError('Audio playback failed');
      };

      await audio.play();
      setIsPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS failed';
      setError(message);
      cleanup();
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, stop, cleanup]);

  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return { isPlaying, isLoading, error, play, stop };
}
