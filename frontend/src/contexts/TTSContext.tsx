/**
 * TTSContext v2 — Global TTS state with language, gender, speed, premium check
 * Persists all settings in localStorage
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useAuthContext } from './AuthContext';
import { API_URL, getAccessToken } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// Storage keys
// ═══════════════════════════════════════════════════════════════════════════════

const KEYS = {
  autoplay: 'deepsight_tts_autoplay',
  lang: 'deepsight_tts_lang',
  gender: 'deepsight_tts_gender',
  speed: 'deepsight_tts_speed',
} as const;

function loadSetting<T>(key: string, fallback: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val === null) return fallback;
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

function saveSetting(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Safari private mode
  }
}

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
  pauseResume: () => void;
  stop: () => void;
  stopPlaying: () => void;  // alias of stop for backward compat
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;

  // Premium
  isPremium: boolean;

  // Audio ref for AudioPlayer seek
  currentAudioRef: React.RefObject<HTMLAudioElement | null>;
}

const TTSContext = createContext<TTSContextType | null>(null);

// Audio cache: key = text+lang+gender+speed -> blobUrl (LRU, max 20 entries)
const MAX_CACHE = 20;
const audioCache = new Map<string, string>();

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function cacheKey(text: string, lang: string, gender: string, speed: number) {
  return `${lang}|${gender}|${speed}|${simpleHash(text)}`;
}

function setCacheEntry(key: string, blobUrl: string) {
  if (audioCache.size >= MAX_CACHE) {
    const firstKey = audioCache.keys().next().value;
    if (firstKey !== undefined) {
      const oldUrl = audioCache.get(firstKey);
      if (oldUrl) URL.revokeObjectURL(oldUrl);
      audioCache.delete(firstKey);
    }
  }
  audioCache.set(key, blobUrl);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provider
// ═══════════════════════════════════════════════════════════════════════════════

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuthContext();
  const plan = user?.plan || 'free';
  const isPremium = plan !== 'free' && plan !== 'decouverte';

  // Settings state
  const [autoPlayEnabled, setAutoPlayEnabledState] = useState(() => loadSetting(KEYS.autoplay, false));
  const [language, setLanguageState] = useState<TTSLanguage>(() => loadSetting(KEYS.lang, 'fr'));
  const [gender, setGenderState] = useState<TTSGender>(() => loadSetting(KEYS.gender, 'female'));
  const [speed, setSpeedState] = useState<number>(() => loadSetting(KEYS.speed, 1));

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Setters with persistence
  const setAutoPlayEnabled = useCallback((v: boolean) => {
    setAutoPlayEnabledState(v);
    saveSetting(KEYS.autoplay, v);
  }, []);

  const setLanguage = useCallback((l: TTSLanguage) => {
    setLanguageState(l);
    saveSetting(KEYS.lang, l);
  }, []);

  const setGender = useCallback((g: TTSGender) => {
    setGenderState(g);
    saveSetting(KEYS.gender, g);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    saveSetting(KEYS.speed, s);
    // Apply to current audio immediately
    if (audioRef.current) {
      audioRef.current.playbackRate = s;
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute('src');
      audioRef.current = null;
    }
    // Don't revoke cached URLs
    blobUrlRef.current = null;
  }, []);

  // Stop
  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setIsPaused(false);
    setIsLoading(false);
    setCurrentTime(0);
    setDuration(0);
  }, [cleanup]);

  // Pause/Resume — read state from audio element to avoid stale closures
  const pauseResume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play().catch(() => {});
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, []);

  // Play text
  const playText = useCallback(async (text: string) => {
    if (!text?.trim()) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    // Stop any current playback
    stop();
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const key = cacheKey(text, language, gender, speed);
      let blobUrl = audioCache.get(key);

      if (!blobUrl) {
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
            language,
            gender,
            speed,
            strip_questions: true,
          }),
          signal: controller.signal,
        });

        // Check if aborted during fetch
        if (controller.signal.aborted) return;

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

        // Check if aborted during blob read
        if (controller.signal.aborted) return;

        blobUrl = URL.createObjectURL(blob);
        setCacheEntry(key, blobUrl);
      }

      blobUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audio.playbackRate = speed;
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime);
      };

      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };

      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (err) {
      console.error('[TTS] Error:', err);
      cleanup();
    } finally {
      setIsLoading(false);
    }
  }, [language, gender, speed, stop, cleanup]);

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
      playText, pauseResume, stop, stopPlaying: stop,
      isPlaying, isPaused, isLoading,
      currentTime, duration,
      isPremium,
      currentAudioRef: audioRef,
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
