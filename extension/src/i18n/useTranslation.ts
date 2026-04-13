/**
 * DeepSight Extension — i18n hook
 * Simple translation system using chrome.storage.sync for language persistence.
 */

import { useState, useEffect, useCallback } from "react";
import fr from "./fr.json";
import en from "./en.json";

export type Language = "fr" | "en";
type Translations = typeof fr;

const TRANSLATIONS: Record<Language, Translations> = { fr, en };
const STORAGE_KEY = "ds_language";

export function useTranslation() {
  const [language, setLanguageState] = useState<Language>("fr");

  useEffect(() => {
    chrome.storage.sync.get([STORAGE_KEY]).then((data) => {
      const stored = data[STORAGE_KEY];
      if (stored === "en" || stored === "fr") {
        setLanguageState(stored);
      }
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    chrome.storage.sync.set({ [STORAGE_KEY]: lang });
  }, []);

  const t = TRANSLATIONS[language];

  return { t, language, setLanguage };
}
