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
};

const lightColors: ThemeColors = {
  bgPrimary: Colors.light.bgPrimary,
  bgSecondary: Colors.light.bgSecondary,
  bgTertiary: Colors.light.bgTertiary,
  bgElevated: '#FFFFFF',
  bgHover: '#F4F4F5',
  bgCard: '#FFFFFF',
  textPrimary: Colors.light.textPrimary,
  textSecondary: Colors.light.textSecondary,
  textTertiary: '#71717A',
  textMuted: '#A1A1AA',
  border: Colors.light.border,
  borderLight: '#D4D4D8',
  accentPrimary: Colors.accentPrimary,
  accentPrimaryLight: Colors.accentPrimaryLight,
  accentSecondary: Colors.accentSecondary,
  accentSuccess: Colors.accentSuccess,
  accentError: Colors.accentError,
  accentWarning: Colors.accentWarning,
  accentInfo: Colors.accentInfo,
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

  // Load saved theme preference
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await storage.getItem(STORAGE_KEYS.THEME);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme as ThemeMode);
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
