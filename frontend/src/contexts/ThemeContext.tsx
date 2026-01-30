/**
 * DEEP SIGHT v7.1 — Theme Context
 * 🌗 Gestion du thème clair/sombre avec transitions fluides
 * 
 * Features:
 * - Détection automatique des préférences système
 * - Persistance localStorage
 * - Transitions CSS fluides
 * - Support "system" mode
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'deepsight-theme';
const TRANSITION_CLASS = 'theme-transitioning';

/**
 * Détecte la préférence système
 */
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * Résout le thème effectif
 */
const resolveTheme = (theme: Theme): ResolvedTheme => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialisation depuis localStorage ou préférence système
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      return saved;
    }
    // Par défaut: dark mode (design académique)
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  // Mise à jour du thème résolu quand le thème ou les préférences système changent
  useEffect(() => {
    const updateResolvedTheme = () => {
      setResolvedTheme(resolveTheme(theme));
    };

    updateResolvedTheme();

    // Écouter les changements de préférence système
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateResolvedTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  // Appliquer le thème au DOM avec transition fluide
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Ajouter classe de transition pour animer le changement
    html.classList.add(TRANSITION_CLASS);
    body.classList.add(TRANSITION_CLASS);
    
    // Appliquer le thème
    if (resolvedTheme === 'light') {
      body.classList.add('light');
      body.classList.remove('dark');
      html.setAttribute('data-theme', 'light');
    } else {
      body.classList.remove('light');
      body.classList.add('dark');
      html.setAttribute('data-theme', 'dark');
    }
    
    // Mettre à jour meta theme-color pour la barre de statut mobile
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        resolvedTheme === 'light' ? '#FAFAF9' : '#0A0A0B'
      );
    }
    
    // Persister le choix
    localStorage.setItem(STORAGE_KEY, theme);
    
    // Retirer la classe de transition après l'animation
    const timer = setTimeout(() => {
      html.classList.remove(TRANSITION_CLASS);
      body.classList.remove(TRANSITION_CLASS);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [resolvedTheme, theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => {
      // Cycle: dark → light → dark (pas de system pour simplifier)
      // Ou si vous voulez inclure system: dark → light → system → dark
      if (prev === 'dark') return 'light';
      return 'dark';
    });
  }, []);

  const isDark = resolvedTheme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export default ThemeContext;
