import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants/config';
import { Colors } from '../constants/theme';
import type { ThemeMode } from '../types';

interface ThemeColors {
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgElevated: string;
  bgHover: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  accentPrimary: string;
  accentPrimaryLight: string;
  accentSecondary: string;
  accentSuccess: string;
  accentError: string;
  accentWarning: string;
  accentInfo: string;
  // Semantic aliases for convenience
  background: string;
  surface: string;
  surfaceSecondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
}

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const darkColors: ThemeColors = {
  bgPrimary: Colors.bgPrimary,
  bgSecondary: Colors.bgSecondary,
  bgTertiary: Colors.bgTertiary,
  bgElevated: Colors.bgElevated,
  bgHover: Colors.bgHover,
  bgCard: Colors.bgCard,
  textPrimary: Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  textTertiary: Colors.textTertiary,
  textMuted: Colors.textMuted,
  border: Colors.border,
  borderLight: Colors.borderLight,
  accentPrimary: Colors.accentPrimary,
  accentPrimaryLight: Colors.accentPrimaryLight,
  accentSecondary: Colors.accentSecondary,
  accentSuccess: Colors.accentSuccess,
  accentError: Colors.accentError,
  accentWarning: Colors.accentWarning,
  accentInfo: Colors.accentInfo,
  // Semantic aliases
  background: Colors.bgPrimary,
  surface: Colors.bgCard,
  surfaceSecondary: Colors.bgSecondary,
  success: Colors.accentSuccess,
  error: Colors.accentError,
  warning: Colors.accentWarning,
  info: Colors.accentInfo,
};

const lightColors: ThemeColors = {
  bgPrimary: Colors.light.bgPrimary,
  bgSecondary: Colors.light.bgSecondary,
  bgTertiary: Colors.light.bgTertiary,
  bgElevated: Colors.light.bgElevated,
  bgHover: Colors.light.bgHover,
  bgCard: Colors.light.bgCard,
  textPrimary: Colors.light.textPrimary,
  textSecondary: Colors.light.textSecondary,
  textTertiary: Colors.light.textTertiary,
  textMuted: Colors.light.textMuted,
  border: Colors.light.border,
  borderLight: Colors.light.borderLight,
  accentPrimary: Colors.light.accentPrimary,
  accentPrimaryLight: Colors.light.accentPrimaryLight,
  accentSecondary: Colors.light.accentSecondary,
  accentSuccess: Colors.light.accentSuccess,
  accentError: Colors.light.accentError,
  accentWarning: Colors.light.accentWarning,
  accentInfo: Colors.light.accentInfo,
  // Semantic aliases
  background: Colors.light.bgPrimary,
  surface: Colors.light.bgCard,
  surfaceSecondary: Colors.light.bgSecondary,
  success: Colors.light.accentSuccess,
  error: Colors.light.accentError,
  warning: Colors.light.accentWarning,
  info: Colors.light.accentInfo,
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>('system');

  // Calculate actual dark/light based on theme setting
  const isDark = theme === 'system'
    ? systemColorScheme === 'dark'
    : theme === 'dark';

  const colors = isDark ? darkColors : lightColors;

  // Load saved theme preference with timeout protection
  useEffect(() => {
    const loadTheme = async () => {
      try {
        // Timeout protection: 2 seconds max to prevent hanging on emulator
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
