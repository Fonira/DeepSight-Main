// ── Content Script i18n ──
// Les content scripts n'ont pas accès au système React i18n.
// Ce module fournit un objet de traductions détecté via chrome.storage + navigator.language.

import Browser from "../utils/browser-polyfill";

type ContentLanguage = "fr" | "en";

interface ContentStrings {
  credits: string;
  analyzeButton: string;
  quickChatButton: string;
  logout: string;
  preparing: string;
  loading: string;
  startingAnalysis: string;
  askQuestion: string;
  webSearchUsed: string;
  backToResults: string;
  responding: string;
  chatError: string;
}

const strings: Record<ContentLanguage, ContentStrings> = {
  fr: {
    credits: "crédits",
    analyzeButton: "Analyser cette vidéo",
    quickChatButton: "Quick Chat IA",
    logout: "Déconnexion",
    preparing: "Préparation...",
    loading: "Chargement...",
    startingAnalysis: "Démarrage de l'analyse...",
    askQuestion: "Posez une question sur cette vidéo",
    webSearchUsed: "Recherche web utilisée",
    backToResults: "Retour aux résultats",
    responding: "En train de répondre...",
    chatError: "Erreur de chat",
  },
  en: {
    credits: "credits",
    analyzeButton: "Analyze this video",
    quickChatButton: "Quick AI Chat",
    logout: "Log out",
    preparing: "Preparing...",
    loading: "Loading...",
    startingAnalysis: "Starting analysis...",
    askQuestion: "Ask a question about this video",
    webSearchUsed: "Web search used",
    backToResults: "Back to results",
    responding: "Responding...",
    chatError: "Chat error",
  },
};

let currentLang: ContentLanguage = "fr";
let initialized = false;

function detectLanguage(): ContentLanguage {
  const browserLang = navigator.language.split("-")[0];
  return browserLang === "en" ? "en" : "fr";
}

async function loadLanguage(): Promise<void> {
  if (initialized) return;
  try {
    const data = await Browser.storage.sync.get(["ds_language"]);
    if (data.ds_language === "en" || data.ds_language === "fr") {
      currentLang = data.ds_language;
    } else {
      currentLang = detectLanguage();
    }
  } catch {
    currentLang = detectLanguage();
  }
  initialized = true;
}

/** Initialize i18n — call once at content script bootstrap. */
export async function initContentI18n(): Promise<void> {
  await loadLanguage();
}

/** Get the current content translations object. */
export function ct(): ContentStrings {
  return strings[currentLang];
}
