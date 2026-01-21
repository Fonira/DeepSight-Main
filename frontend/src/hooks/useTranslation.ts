/**
 * 🌐 useTranslation Hook — Accès centralisé aux traductions
 */

import { useLanguage } from '../contexts/LanguageContext';
import fr from '../i18n/fr.json';
import en from '../i18n/en.json';

type Language = 'fr' | 'en';
const translations = { fr, en } as const;

export function useTranslation() {
  const { language, setLanguage } = useLanguage();
  const lang = (language as Language) || 'fr';
  const t = translations[lang];
  
  return { t, language: lang, setLanguage };
}

export function formatDate(date: string | Date, language: Language, options?: Intl.DateTimeFormatOptions): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return new Date(date).toLocaleDateString(locale, options || { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatNumber(num: number, language: Language): string {
  return num.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US');
}

export function formatPrice(price: number, language: Language): string {
  return new Intl.NumberFormat(language === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' }).format(price);
}

export default useTranslation;
