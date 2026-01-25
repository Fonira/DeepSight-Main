import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/config';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';

type Language = 'fr' | 'en';

type TranslationsType = typeof fr;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: TranslationsType;
  tr: (frText: string, enText: string) => string;
  isLoading: boolean;
}

const translations: Record<Language, TranslationsType> = { fr, en };

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('fr');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
        if (saved === 'fr' || saved === 'en') {
          setLanguageState(saved);
        }
      } catch (error) {
        console.error('Failed to load language preference:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
    } catch (error) {
      console.error('Failed to save language preference:', error);
    }
  };

  // Get translations object for current language
  const t = translations[language];

  // Helper for inline translations
  const tr = useCallback(
    (frText: string, enText: string) => (language === 'fr' ? frText : enText),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tr, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
