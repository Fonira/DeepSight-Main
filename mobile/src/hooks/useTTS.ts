/**
 * useTTS — Mobile TTS hook using expo-audio + expo-file-system (SDK 54)
 * v2 — Supports language, gender, speed params
 */

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { File, Paths } from "expo-file-system";
import { API_BASE_URL } from "../constants/config";
import { tokenStorage } from "../utils/storage";

interface UseTTSOptions {
  language?: "fr" | "en";
  gender?: "male" | "female";
  speed?: number;
}

interface UseTTSReturn {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
  play: (text: string, voiceId?: string) => Promise<void>;
  stop: () => void;
}

export function useTTS(options?: UseTTSOptions): UseTTSReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tempFileRef = useRef<File | null>(null);
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
        tempFileRef.current.delete();
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

  const play = useCallback(
    async (text: string, voiceId?: string) => {
      if (isPlaying || isLoading) {
        stop();
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        try {
          await setAudioModeAsync({ playsInSilentMode: true });
        } catch {
          // Ignore
        }

        const token = await tokenStorage.getAccessToken();
        if (!token) throw new Error("Authentication required");

        const response = await fetch(`${API_BASE_URL}/api/tts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            language: options?.language || "fr",
            gender: options?.gender || "female",
            speed: options?.speed || 1.0,
            strip_questions: true,
            ...(voiceId && { voice_id: voiceId }),
          }),
        });

        if (!response.ok) {
          try {
            const errorData = await response.json();
            const detail = errorData?.detail;
            if (detail?.error === "feature_locked") {
              throw new Error(detail.message || "Upgrade your plan for TTS");
            }
            throw new Error(
              typeof detail === "string"
                ? detail
                : detail?.message || `TTS error (${response.status})`,
            );
          } catch (parseErr) {
            if (
              parseErr instanceof Error &&
              !parseErr.message.startsWith("TTS error")
            ) {
              throw parseErr;
            }
            throw new Error(`TTS error (${response.status})`);
          }
        }

        const audioBlob = await response.blob();
        const reader = new FileReader();
        const base64Audio = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(audioBlob);
        });

        const tempFile = new File(Paths.cache, `tts_${Date.now()}.mp3`);
        tempFile.create({ overwrite: true });
        tempFile.write(base64Audio, { encoding: "base64" });

        if (!tempFile.exists || tempFile.size < 100) {
          throw new Error("Empty audio response");
        }

        await cleanup();
        tempFileRef.current = tempFile;

        player.replace({ uri: tempFile.uri });
        player.play();
      } catch (err) {
        const message = err instanceof Error ? err.message : "TTS failed";
        setError(message);
        await cleanup();
      } finally {
        setIsLoading(false);
      }
    },
    [
      isPlaying,
      isLoading,
      stop,
      cleanup,
      player,
      options?.language,
      options?.gender,
      options?.speed,
    ],
  );

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { isPlaying, isLoading, error, play, stop };
}
