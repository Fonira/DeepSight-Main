import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/config';
import { darkColors, lightColors, ThemeColors } from '../theme/colors';
import type { ThemeMode } from '../types';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('system');

  const isDark = theme === 'system'
    ? systemColorScheme === 'dark'
    : theme === 'dark';

  const colors = isDark ? darkColors : lightColors;

  // Load saved theme preference with timeout protection
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Theme load timeout')), 2000)
        );
        const savedTheme = await Promise.race([
          storage.getItem(STORAGE_KEYS.THEME),
          timeoutPromise
        ]) as string | null;
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeState(savedTheme as ThemeMode);
        }
      } catch (e) {
        console.warn('Theme load failed/timeout, using default');
      }
    };
    loadTheme();
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    await storage.setItem(STORAGE_KEYS.THEME, newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = isDark ? 'light' : 'dark';
    setTheme(newTheme);
  }, [isDark, setTheme]);

  const value: ThemeContextType = {
    theme,
    isDark,
    colors,
    setTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
