/**
 * useTTS — Mobile TTS hook using expo-audio + expo-file-system
 * Downloads audio from backend /api/tts, writes to temp file, plays via AudioPlayer
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, AudioModule } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from '../utils/storage';

interface UseTTSReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  play: (text: string, voiceId?: string) => Promise<void>;
  stop: () => void;
}

export function useTTS(): UseTTSReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tempFileRef = useRef<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const isPlaying = status.playing;

  const cleanup = useCallback(async () => {
    try {
      player.pause();
      player.replace(null);
    } catch {
      // Ignore
    }
    if (tempFileRef.current) {
      try {
        await FileSystem.deleteAsync(tempFileRef.current, { idempotent: true });
      } catch {
        // Ignore cleanup errors
      }
      tempFileRef.current = null;
    }
  }, [player]);

  const stop = useCallback(() => {
    cleanup();
    setIsLoading(false);
  }, [cleanup]);

  const play = useCallback(async (text: string, voiceId?: string) => {
    if (isPlaying || isLoading) {
      stop();
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Configure for silent mode playback
      try {
        await AudioModule.setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        // Ignore if not supported
      }

      const token = await tokenStorage.getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      // Download audio from backend
      const tempPath = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;

      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE_URL}/api/tts`,
        tempPath,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          httpMethod: 'POST',
          body: JSON.stringify({
            text,
            ...(voiceId && { voice_id: voiceId }),
          }),
        }
      );

      if (downloadResult.status !== 200) {
        // Try to read error
        try {
          const errorContent = await FileSystem.readAsStringAsync(tempPath);
          const errorData = JSON.parse(errorContent);
          const detail = errorData?.detail;
          if (detail?.error === 'feature_locked') {
            throw new Error(detail.message || 'Upgrade your plan for TTS');
          }
          throw new Error(typeof detail === 'string' ? detail : detail?.message || `TTS error (${downloadResult.status})`);
        } catch (parseErr) {
          if (parseErr instanceof Error && !parseErr.message.startsWith('TTS error')) {
            throw parseErr;
          }
          throw new Error(`TTS error (${downloadResult.status})`);
        }
      }

      // Check file has content
      const fileInfo = await FileSystem.getInfoAsync(tempPath);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size < 100)) {
        throw new Error('Empty audio response');
      }

      await cleanup();
      tempFileRef.current = tempPath;

      // Play the audio file
      player.replace({ uri: tempPath });
      player.play();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS failed';
      setError(message);
      await cleanup();
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, stop, cleanup, player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { isPlaying, isLoading, error, play, stop };
}
