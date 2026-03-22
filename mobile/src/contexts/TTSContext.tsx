/**
 * TTSContext — Mobile TTS state with auto-play toggle
 * Persists autoPlayEnabled in AsyncStorage
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTTS } from '../hooks/useTTS';

const STORAGE_KEY = 'deepsight_tts_autoplay';

interface TTSContextType {
  autoPlayEnabled: boolean;
  setAutoPlayEnabled: (enabled: boolean) => void;
  playText: (text: string) => Promise<void>;
  stopPlaying: () => void;
  isPlaying: boolean;
  isLoading: boolean;
}

const TTSContext = createContext<TTSContextType | null>(null);

export const TTSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isPlaying, isLoading, play, stop } = useTTS();
  const [autoPlayEnabled, setAutoPlayEnabledState] = useState(false);

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'true') setAutoPlayEnabledState(true);
    }).catch(() => {});
  }, []);

  const setAutoPlayEnabled = useCallback((enabled: boolean) => {
    setAutoPlayEnabledState(enabled);
    AsyncStorage.setItem(STORAGE_KEY, String(enabled)).catch(() => {});
  }, []);

  const playText = useCallback(async (text: string) => {
    await play(text);
  }, [play]);

  const stopPlaying = useCallback(() => {
    stop();
  }, [stop]);

  return (
    <TTSContext.Provider value={{ autoPlayEnabled, setAutoPlayEnabled, playText, stopPlaying, isPlaying, isLoading }}>
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
