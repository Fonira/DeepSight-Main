/**
 * TTSContext v2 — Mobile TTS state with language, gender, speed, premium check
 * Persists all settings in AsyncStorage
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from '../utils/storage';
import { useAuth } from './AuthContext';
import { hasFeature } from '../config/planPrivileges';

// ═══════════════════════════════════════════════════════════════════════════════
// Storage keys
// ═══════════════════════════════════════════════════════════════════════════════

const KEYS = {
  autoplay: 'deepsight_tts_autoplay',
  lang: 'deepsight_tts_lang',
  gender: 'deepsight_tts_gender',
  speed: 'deepsight_tts_speed',
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

type TTSLanguage = 'fr' | 'en';
type TTSGender = 'male' | 'female';

interface TTSContextType {
  // Settings
  autoPlayEnabled: boolean;
  setAutoPlayEnabled: (v: boolean) => void;
  language: TTSLanguage;
  setLanguage: (l: TTSLanguage) => void;
  gender: TTSGender;
  setGender: (g: TTSGender) => void;
  speed: number;
  setSpeed: (s: number) => void;

  // Playback
  playText: (text: string) => Promise<void>;
  stopPlaying: () => void;
  isPlaying: boolean;
  isLoading: boolean;

  // Premium
  isPremium: boolean;
}

const TTSContext = createContext<TTSContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userPlan = user?.plan || 'free';
  const isPremium = hasFeature(userPlan, 'ttsAudio');

  // Settings
  const [autoPlayEnabled, setAutoPlayEnabledState] = useState(false);
  const [language, setLanguageState] = useState<TTSLanguage>('fr');
  const [gender, setGenderState] = useState<TTSGender>('female');
  const [speed, setSpeedState] = useState<number>(1);

  // Playback
  const [isLoading, setIsLoading] = useState(false);
  const tempFileRef = useRef<File | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  // Load settings from AsyncStorage
  useEffect(() => {
    const load = async () => {
      try {
        const [ap, la, ge, sp] = await Promise.all([
          AsyncStorage.getItem(KEYS.autoplay),
          AsyncStorage.getItem(KEYS.lang),
          AsyncStorage.getItem(KEYS.gender),
          AsyncStorage.getItem(KEYS.speed),
        ]);
        if (ap === 'true') setAutoPlayEnabledState(true);
        if (la === 'fr' || la === 'en') setLanguageState(la);
        if (ge === 'male' || ge === 'female') setGenderState(ge);
        if (sp) {
          const parsed = parseFloat(sp);
          if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 3) setSpeedState(parsed);
        }
      } catch {
        // Ignore
      }
    };
    load();
  }, []);

  // Setters with persistence
  const setAutoPlayEnabled = useCallback((v: boolean) => {
    setAutoPlayEnabledState(v);
    AsyncStorage.setItem(KEYS.autoplay, String(v)).catch(() => {});
  }, []);

  const setLanguage = useCallback((l: TTSLanguage) => {
    setLanguageState(l);
    AsyncStorage.setItem(KEYS.lang, l).catch(() => {});
  }, []);

  const setGender = useCallback((g: TTSGender) => {
    setGenderState(g);
    AsyncStorage.setItem(KEYS.gender, g).catch(() => {});
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    AsyncStorage.setItem(KEYS.speed, String(s)).catch(() => {});
  }, []);

  // Cleanup
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
        // Ignore
      }
      tempFileRef.current = null;
    }
  }, [player]);

  const stopPlaying = useCallback(() => {
    cleanup();
    setIsLoading(false);
  }, [cleanup]);

  const playText = useCallback(async (text: string) => {
    if (!text?.trim()) return;
    if (isPlaying || isLoading) {
      stopPlaying();
      return;
    }

    setIsLoading(true);

    try {
      // Configure for silent mode playback
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
      } catch {
        // Ignore
      }

      const token = await tokenStorage.getAccessToken();
      if (!token) throw new Error('Authentication required');

      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          language,
          gender,
          speed,
          strip_questions: true,
        }),
      });

      if (!response.ok) {
        try {
          const errorData = await response.json();
          const detail = errorData?.detail;
          if (detail?.error === 'feature_locked') {
            throw new Error(detail.message || 'Upgrade your plan for TTS');
          }
          throw new Error(typeof detail === 'string' ? detail : detail?.message || `TTS error (${response.status})`);
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message.includes('TTS')) throw parseErr;
          throw new Error(`TTS error (${response.status})`);
        }
      }

      // Write audio blob to temp file
      const audioBlob = await response.blob();
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const tempFile = new File(Paths.cache, `tts_${Date.now()}.mp3`);
      tempFile.create({ overwrite: true });
      tempFile.write(base64Audio, { encoding: 'base64' });

      if (!tempFile.exists || tempFile.size < 100) {
        throw new Error('Empty audio response');
      }

      await cleanup();
      tempFileRef.current = tempFile;

      // Play the audio file
      player.replace({ uri: tempFile.uri });

      // Set playback speed
      try {
        player.playbackRate = speed;
      } catch {
        // Fallback: rate not supported on all platforms
      }

      player.play();
    } catch (err) {
      if (__DEV__) console.warn('[TTS]', err);
      await cleanup();
    } finally {
      setIsLoading(false);
    }
  }, [isPlaying, isLoading, stopPlaying, cleanup, player, language, gender, speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanup(); };
  }, [cleanup]);

  return (
    <TTSContext.Provider value={{
      autoPlayEnabled, setAutoPlayEnabled,
      language, setLanguage,
      gender, setGender,
      speed, setSpeed,
      playText, stopPlaying,
      isPlaying, isLoading,
      isPremium,
    }}>
      {children}
    </TTSContext.Provider>
  );
};

export const useTTSContext = (): TTSContextType => {
  const ctx = useContext(TTSContext);
  if (!ctx) {
    throw new Error('useTTSContext must be used within a TTSProvider');
  }
  return ctx;
};
