/**
 * 🤿 DEEP SIGHT CONSTANTS v3.2
 * ═══════════════════════════════════════════════════════════════════════════════
 * Constantes et configuration alignées avec l'app Streamlit
 * Inclut: catégories, modes, sujets volatils, plans
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// 🏷️ CATÉGORIES (12 catégories avec prompts spécialisés)
// ═══════════════════════════════════════════════════════════════════════════════

export const CATEGORIES = [
  { id: "auto", name_fr: "Auto-détection", name_en: "Auto-detect", emoji: "🎯", description_fr: "Détection automatique", description_en: "Automatic detection" },
  { id: "interview_podcast", name_fr: "Interview/Podcast", name_en: "Interview/Podcast", emoji: "🎙️", description_fr: "Entretiens et discussions", description_en: "Interviews and discussions" },
  { id: "tech", name_fr: "Technologie", name_en: "Technology", emoji: "💻", description_fr: "Tech, développement, gadgets", description_en: "Tech, development, gadgets" },
  { id: "science", name_fr: "Science", name_en: "Science", emoji: "🔬", description_fr: "Recherche scientifique", description_en: "Scientific research" },
  { id: "education", name_fr: "Éducation", name_en: "Education", emoji: "📚", description_fr: "Tutoriels et formations", description_en: "Tutorials and training" },
  { id: "finance", name_fr: "Finance", name_en: "Finance", emoji: "💰", description_fr: "Investissement, économie", description_en: "Investment, economy" },
  { id: "gaming", name_fr: "Gaming", name_en: "Gaming", emoji: "🎮", description_fr: "Jeux vidéo, esport", description_en: "Video games, esport" },
  { id: "culture", name_fr: "Culture", name_en: "Culture", emoji: "🎨", description_fr: "Art, musique, cinéma", description_en: "Art, music, cinema" },
  { id: "news", name_fr: "Actualités", name_en: "News", emoji: "📰", description_fr: "Actualités et reportages", description_en: "News and reports" },
  { id: "health", name_fr: "Santé", name_en: "Health", emoji: "🏥", description_fr: "Médecine, bien-être", description_en: "Medicine, wellness" },
  { id: "sport", name_fr: "Sport", name_en: "Sport", emoji: "⚽", description_fr: "Football, tennis, etc.", description_en: "Football, tennis, etc." },
  { id: "crypto", name_fr: "Crypto", name_en: "Crypto", emoji: "₿", description_fr: "Cryptomonnaies, blockchain", description_en: "Cryptocurrencies, blockchain" },
  { id: "geopolitics", name_fr: "Géopolitique", name_en: "Geopolitics", emoji: "🌍", description_fr: "Relations internationales", description_en: "International relations" },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];

export const getCategoryInfo = (categoryId: string, lang: 'fr' | 'en' = 'fr') => {
  const cat = CATEGORIES.find(c => c.id === categoryId);
  if (!cat) return { id: categoryId, name: categoryId, emoji: "📄", description: "" };
  return {
    id: cat.id,
    name: lang === 'fr' ? cat.name_fr : cat.name_en,
    emoji: cat.emoji,
    description: lang === 'fr' ? cat.description_fr : cat.description_en,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎚️ MODES D'ANALYSE (3 modes avec styles différents)
// ═══════════════════════════════════════════════════════════════════════════════

export const ANALYSIS_MODES = [
  {
    id: "accessible",
    name_fr: "Accessible",
    name_en: "Accessible",
    icon: "👤",
    description_fr: "Langage simple, zéro jargon",
    description_en: "Simple language, no jargon",
    style_fr: "Professeur passionné : langage simple et imagé, explique chaque terme technique, ton pédagogique et engageant, analogies du quotidien",
    style_en: "Passionate teacher: simple and vivid language, explains every technical term, engaging pedagogical tone, everyday analogies",
    color: "#4ecdc4",
  },
  {
    id: "standard",
    name_fr: "Standard",
    name_en: "Standard",
    icon: "⚖️",
    description_fr: "Équilibré, termes expliqués si besoin",
    description_en: "Balanced, terms explained when needed",
    style_fr: "Analyste équilibré : vocabulaire courant avec termes techniques expliqués si nécessaire, distingue fait et opinion, évalue la crédibilité des sources",
    style_en: "Balanced analyst: common vocabulary with technical terms explained when needed, distinguishes fact from opinion, evaluates source credibility",
    color: "#ffd700",
  },
  {
    id: "expert",
    name_fr: "Expert",
    name_en: "Expert",
    icon: "🔬",
    description_fr: "Jargon pro, analyse critique poussée",
    description_en: "Professional jargon, deep critical analysis",
    style_fr: "Analyste méthodique : jargon professionnel assumé, identifie sophismes et biais cognitifs, rigueur méthodologique, croise les sources, analyse critique approfondie",
    style_en: "Methodical analyst: professional jargon, identifies fallacies and cognitive biases, methodological rigor, cross-references sources, in-depth critical analysis",
    color: "#ff00ff",
  },
] as const;

export type AnalysisMode = typeof ANALYSIS_MODES[number]['id'];

// ═══════════════════════════════════════════════════════════════════════════════
// 🤖 MODÈLES IA
// ═══════════════════════════════════════════════════════════════════════════════

export const AI_MODELS = [
  { id: "auto", name: "Auto", description_fr: "Sélection automatique", description_en: "Automatic selection" },
  { id: "mistral-small-2603", name: "Mistral Small 3.1", description_fr: "Rapide et intelligent (128K contexte)", description_en: "Fast and smart (128K context)" },
  { id: "mistral-large-2512", name: "Mistral Large 3", description_fr: "Maximum de qualité (262K contexte)", description_en: "Maximum quality (262K context)" },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 SUJETS VOLATILS (changent fréquemment - nécessitent vérification)
// ═══════════════════════════════════════════════════════════════════════════════

export type VolatilityLevel = 'low' | 'medium' | 'high' | 'very_high';

export interface VolatileTopic {
  id: string;
  keywords_fr: string[];
  keywords_en: string[];
  categories: string[];
  volatility: VolatilityLevel;
  disclaimer_fr: string;
  disclaimer_en: string;
}

export const VOLATILE_TOPICS: Record<string, VolatileTopic> = {
  sport: {
    id: "sport",
    keywords_fr: ["joueur", "effectif", "transfert", "équipe", "club", "entraîneur", "mercato", "classement", "match", "blessure", "titulaire"],
    keywords_en: ["player", "roster", "transfer", "team", "club", "coach", "signing", "standings", "match", "injury", "starter"],
    categories: ["sport"],
    volatility: "very_high",
    disclaimer_fr: "⚠️ **Attention** : Les effectifs sportifs changent fréquemment (transferts, blessures). Ces informations peuvent être obsolètes.",
    disclaimer_en: "⚠️ **Note**: Sports rosters change frequently (transfers, injuries). This information may be outdated.",
  },
  business: {
    id: "business",
    keywords_fr: ["PDG", "CEO", "directeur", "démission", "nomination", "rachat", "fusion", "valorisation", "levée de fonds", "licenciement"],
    keywords_en: ["CEO", "director", "resignation", "appointment", "acquisition", "merger", "valuation", "funding", "layoff"],
    categories: ["business", "finance", "tech"],
    volatility: "high",
    disclaimer_fr: "⚠️ **Attention** : Les positions de direction et la situation des entreprises évoluent. Vérifiez les informations actuelles.",
    disclaimer_en: "⚠️ **Note**: Executive positions and company situations evolve. Verify current information.",
  },
  politics: {
    id: "politics",
    keywords_fr: ["ministre", "député", "gouvernement", "élection", "vote", "loi", "réforme", "premier ministre"],
    keywords_en: ["minister", "congressman", "government", "election", "vote", "bill", "reform", "prime minister"],
    categories: ["politics", "news"],
    volatility: "high",
    disclaimer_fr: "⚠️ **Attention** : La situation politique évolue rapidement. Ces informations peuvent ne plus être actuelles.",
    disclaimer_en: "⚠️ **Note**: Political situations evolve rapidly. This information may no longer be current.",
  },
  crypto_finance: {
    id: "crypto_finance",
    keywords_fr: ["prix", "cours", "capitalisation", "bitcoin", "ethereum", "crypto", "bourse", "action", "taux", "inflation"],
    keywords_en: ["price", "rate", "market cap", "bitcoin", "ethereum", "crypto", "stock", "share", "inflation"],
    categories: ["crypto", "finance"],
    volatility: "very_high",
    disclaimer_fr: "⚠️ **Attention** : Les prix et données financières changent en temps réel. Ces chiffres datent de la vidéo.",
    disclaimer_en: "⚠️ **Note**: Prices and financial data change in real-time. These figures are from the video.",
  },
  tech_products: {
    id: "tech_products",
    keywords_fr: ["version", "mise à jour", "sortie", "lancement", "nouveau", "iOS", "Android", "iPhone", "GPU", "processeur"],
    keywords_en: ["version", "update", "release", "launch", "new", "iOS", "Android", "iPhone", "GPU", "processor"],
    categories: ["tech"],
    volatility: "high",
    disclaimer_fr: "⚠️ **Attention** : Les produits tech évoluent rapidement. De nouvelles versions peuvent être disponibles.",
    disclaimer_en: "⚠️ **Note**: Tech products evolve quickly. Newer versions may be available.",
  },
  ai_ml: {
    id: "ai_ml",
    keywords_fr: ["GPT", "Claude", "Gemini", "LLM", "intelligence artificielle", "IA", "ChatGPT", "Mistral", "benchmark"],
    keywords_en: ["GPT", "Claude", "Gemini", "LLM", "artificial intelligence", "AI", "ChatGPT", "Mistral", "benchmark"],
    categories: ["tech", "science"],
    volatility: "very_high",
    disclaimer_fr: "⚠️ **Attention** : Le domaine de l'IA évolue extrêmement vite. De nouveaux modèles apparaissent chaque mois.",
    disclaimer_en: "⚠️ **Note**: The AI field evolves extremely fast. New models appear every month.",
  },
  geopolitics: {
    id: "geopolitics",
    keywords_fr: ["guerre", "conflit", "invasion", "cessez-le-feu", "sanctions", "Ukraine", "Russie", "Gaza", "Israël", "OTAN"],
    keywords_en: ["war", "conflict", "invasion", "ceasefire", "sanctions", "Ukraine", "Russia", "Gaza", "Israel", "NATO"],
    categories: ["news", "politics"],
    volatility: "very_high",
    disclaimer_fr: "⚠️ **Attention** : Les situations géopolitiques évoluent très rapidement. Ces informations peuvent être obsolètes en quelques heures.",
    disclaimer_en: "⚠️ **Note**: Geopolitical situations evolve very rapidly. This information may be outdated within hours.",
  },
  health_medicine: {
    id: "health_medicine",
    keywords_fr: ["traitement", "médicament", "vaccin", "diagnostic", "maladie", "OMS", "protocole"],
    keywords_en: ["treatment", "medication", "vaccine", "diagnosis", "disease", "WHO", "protocol"],
    categories: ["health", "science"],
    volatility: "high",
    disclaimer_fr: "⚠️ **Attention** : Les recommandations médicales évoluent. Consultez un professionnel de santé.",
    disclaimer_en: "⚠️ **Note**: Medical recommendations evolve. Consult a healthcare professional.",
  },
};

/**
 * Détecte si un texte contient des sujets volatils
 */
export const detectVolatileTopics = (
  text: string, 
  category: string = '', 
  lang: 'fr' | 'en' = 'fr'
): { isVolatile: boolean; topics: string[]; disclaimers: string[] } => {
  const textLower = text.toLowerCase();
  const detectedTopics: string[] = [];
  const disclaimers: string[] = [];

  for (const [topicId, topic] of Object.entries(VOLATILE_TOPICS)) {
    const keywords = lang === 'fr' ? topic.keywords_fr : topic.keywords_en;
    const categoryMatch = topic.categories.includes(category);
    const keywordMatch = keywords.some(kw => textLower.includes(kw.toLowerCase()));

    if (categoryMatch || keywordMatch) {
      detectedTopics.push(topicId);
      const disclaimer = lang === 'fr' ? topic.disclaimer_fr : topic.disclaimer_en;
      if (!disclaimers.includes(disclaimer)) {
        disclaimers.push(disclaimer);
      }
    }
  }

  return {
    isVolatile: detectedTopics.length > 0,
    topics: detectedTopics,
    disclaimers: disclaimers.slice(0, 2), // Max 2 disclaimers
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💳 PLANS & LIMITES
// ⚠️ DÉPRÉCIÉ — Utiliser config/planPrivileges.ts comme source de vérité unique
// Ce bloc est conservé pour rétrocompatibilité mais NE DOIT PAS être modifié.
// Toute nouvelle feature doit importer depuis config/planPrivileges.ts
// ═══════════════════════════════════════════════════════════════════════════════

/** @deprecated Use PlanId from config/planPrivileges.ts — 3 plans: free/plus/pro */
export type PlanType = 'free' | 'plus' | 'pro' | 'expert' | 'etudiant' | 'starter' | 'student' | 'unlimited' | 'team'; // Aliases pour rétrocompat

/** @deprecated Use PLAN_LIMITS + PLANS_INFO from config/planPrivileges.ts */
export interface PlanConfig {
  id: PlanType;
  name_fr: string;
  name_en: string;
  icon: string;
  color: string;
  price: number; // centimes
  monthly_credits: number;
  chat_daily_limit: number; // -1 = illimité
  chat_per_video_limit: number;
  web_search_monthly: number; // Perplexity searches
  web_search_enabled: boolean;
  can_use_playlists: boolean;
  max_playlist_videos: number;
  history_days: number; // -1 = permanent
  models: string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  free: {
    id: "free",
    name_fr: "Découverte",
    name_en: "Discovery",
    icon: "🆓",
    color: "#888888",
    price: 0,
    monthly_credits: 4,
    chat_daily_limit: 10,
    chat_per_video_limit: 3,
    web_search_monthly: 0,
    web_search_enabled: false,
    can_use_playlists: false,
    max_playlist_videos: 0,
    history_days: 3,
    models: ["mistral-small-2603"],
  },
  plus: {
    id: "plus",
    name_fr: "Plus",
    name_en: "Plus",
    icon: "⭐",
    color: "#3B82F6",
    price: 499, // 4.99€
    monthly_credits: 25,
    chat_daily_limit: -1,
    chat_per_video_limit: 20,
    web_search_monthly: 10,
    web_search_enabled: true,
    can_use_playlists: false,
    max_playlist_videos: 0,
    history_days: -1,
    models: ["mistral-medium-2508"],
  },
  /** @deprecated Alias → plus */
  student: {
    id: "student",
    name_fr: "Plus",
    name_en: "Plus",
    icon: "⭐",
    color: "#3B82F6",
    price: 599,
    monthly_credits: 30,
    chat_daily_limit: -1,
    chat_per_video_limit: 25,
    web_search_monthly: 20,
    web_search_enabled: true,
    can_use_playlists: true,
    max_playlist_videos: 5,
    history_days: -1,
    models: ["mistral-small-2603"],
  },
  /** @deprecated Alias → plus */
  starter: {
    id: "starter",
    name_fr: "Plus",
    name_en: "Plus",
    icon: "⭐",
    color: "#3B82F6",
    price: 499,
    monthly_credits: 25,
    chat_daily_limit: -1,
    chat_per_video_limit: 20,
    web_search_monthly: 10,
    web_search_enabled: true,
    can_use_playlists: false,
    max_playlist_videos: 0,
    history_days: -1,
    models: ["mistral-medium-2508"],
  },
  pro: {
    id: "pro",
    name_fr: "Pro",
    name_en: "Pro",
    icon: "👑",
    color: "#8B5CF6",
    price: 999, // 9.99€
    monthly_credits: 100,
    chat_daily_limit: -1,
    chat_per_video_limit: -1, // illimité
    web_search_monthly: 60,
    web_search_enabled: true,
    can_use_playlists: true,
    max_playlist_videos: 20,
    history_days: -1, // permanent
    models: ["mistral-large-2512"],
  },
  /** @deprecated Alias → pro */
  expert: {
    id: "expert",
    name_fr: "Pro",
    name_en: "Pro",
    icon: "👑",
    color: "#8B5CF6",
    price: 999,
    monthly_credits: 100,
    chat_daily_limit: -1,
    chat_per_video_limit: -1,
    web_search_monthly: 60,
    web_search_enabled: true,
    can_use_playlists: true,
    max_playlist_videos: 20,
    history_days: -1,
    models: ["mistral-large-2512"],
  },
  unlimited: {
    id: "unlimited",
    name_fr: "Illimité",
    name_en: "Unlimited",
    icon: "👑",
    color: "#ffd700",
    price: 0,
    monthly_credits: 999999,
    chat_daily_limit: -1,
    chat_per_video_limit: -1,
    web_search_monthly: -1,
    web_search_enabled: true,
    can_use_playlists: true,
    max_playlist_videos: 200,
    history_days: -1,
    models: ["mistral-large-2512"],
  },
};

/** @deprecated Use getPlanInfo() from config/planPrivileges.ts */
export const getPlanConfig = (plan: PlanType): PlanConfig => {
  return PLAN_CONFIGS[plan] || PLAN_CONFIGS.free;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 QUESTIONS SUGGÉRÉES (par langue et catégorie)
// ═══════════════════════════════════════════════════════════════════════════════

export const SUGGESTED_QUESTIONS = {
  fr: {
    default: [
      "Quels sont les points principaux ?",
      "Résume en 3 bullet points",
      "Quelles sont les sources citées ?",
      "Y a-t-il des biais dans cette vidéo ?",
      "Quels sont les arguments controversés ?",
    ],
    interview_podcast: [
      "Quelle est la thèse principale de l'invité ?",
      "Quelles sont les citations les plus marquantes ?",
      "Sur quels points les intervenants sont-ils en désaccord ?",
    ],
    tech: [
      "Quelles technologies sont mentionnées ?",
      "Quels sont les avantages et inconvénients présentés ?",
      "Y a-t-il des alternatives mentionnées ?",
    ],
    finance: [
      "Quels sont les risques mentionnés ?",
      "Quelles sont les recommandations d'investissement ?",
      "Les données sont-elles toujours d'actualité ?",
    ],
    science: [
      "Quelle est la méthodologie utilisée ?",
      "Les résultats sont-ils répliqués ?",
      "Quelles sont les limites de l'étude ?",
    ],
  },
  en: {
    default: [
      "What are the main points?",
      "Summarize in 3 bullet points",
      "What sources are cited?",
      "Are there any biases in this video?",
      "What are the controversial arguments?",
    ],
    interview_podcast: [
      "What is the guest's main thesis?",
      "What are the most striking quotes?",
      "On which points do the speakers disagree?",
    ],
    tech: [
      "What technologies are mentioned?",
      "What are the pros and cons presented?",
      "Are any alternatives mentioned?",
    ],
    finance: [
      "What risks are mentioned?",
      "What investment recommendations are made?",
      "Is the data still current?",
    ],
    science: [
      "What methodology was used?",
      "Have the results been replicated?",
      "What are the study's limitations?",
    ],
  },
};

export const getSuggestedQuestions = (lang: 'fr' | 'en', category: string = 'default'): string[] => {
  const langQuestions = SUGGESTED_QUESTIONS[lang];
  return langQuestions[category as keyof typeof langQuestions] || langQuestions.default;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 FORMATS D'EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const EXPORT_FORMATS = [
  { id: 'txt', name: 'Texte', icon: '📄', mime: 'text/plain' },
  { id: 'md', name: 'Markdown', icon: '📝', mime: 'text/markdown' },
  { id: 'docx', name: 'Word', icon: '📘', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { id: 'pdf', name: 'PDF', icon: '📕', mime: 'application/pdf' },
  { id: 'json', name: 'JSON', icon: '🔧', mime: 'application/json' },
] as const;

export type ExportFormat = typeof EXPORT_FORMATS[number]['id'];

// ═══════════════════════════════════════════════════════════════════════════════
// 🌊 CUTOFF DATE (pour détection vidéos récentes)
// ═══════════════════════════════════════════════════════════════════════════════

export const MISTRAL_KNOWLEDGE_CUTOFF = "2024-07-01"; // 1er juillet 2024
export const RECENT_VIDEO_MONTHS = 6;

export const isVideoRecent = (uploadDate: string): { isRecent: boolean; isAfterCutoff: boolean; daysOld: number } => {
  if (!uploadDate) return { isRecent: false, isAfterCutoff: false, daysOld: 0 };
  
  try {
    const date = new Date(uploadDate);
    const now = new Date();
    const daysOld = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const cutoffDate = new Date(MISTRAL_KNOWLEDGE_CUTOFF);
    
    return {
      isRecent: daysOld < RECENT_VIDEO_MONTHS * 30,
      isAfterCutoff: date > cutoffDate,
      daysOld,
    };
  } catch {
    return { isRecent: false, isAfterCutoff: false, daysOld: 0 };
  }
};
