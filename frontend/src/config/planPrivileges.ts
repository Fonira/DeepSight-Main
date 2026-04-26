// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers
// Migration Avril 2026 : 3 plans (Free / Plus 4.99€ / Pro 9.99€)

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanId = "free" | "plus" | "pro";

export const PLAN_HIERARCHY: PlanId[] = ["free", "plus", "pro"];

// ═══════════════════════════════════════════════════════════════════════════════
// LIMITES PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  monthlyAnalyses: number;
  /** Alias for monthlyAnalyses — historic name used by older UI code. */
  monthlyCredits: number;
  maxVideoLengthMin: number; // en minutes, -1 = illimité
  concurrentAnalyses: number;
  priorityQueue: boolean;

  chatQuestionsPerVideo: number; // -1 = illimité
  chatDailyLimit: number; // -1 = illimité

  flashcardsEnabled: boolean;
  mindmapEnabled: boolean;

  webSearchEnabled: boolean;
  webSearchMonthly: number; // 0 = désactivé, -1 = illimité

  playlistsEnabled: boolean;
  maxPlaylists: number;
  maxPlaylistVideos: number;

  exportFormats: string[];
  exportMarkdown: boolean;
  exportPdf: boolean;

  historyRetentionDays: number; // -1 = permanent

  allowedModels: string[];
  defaultModel: string;

  academicSearch: boolean;
  academicPapersPerAnalysis: number;
  bibliographyExport: boolean;

  voiceChatEnabled: boolean;
  voiceChatMonthlyMinutes: number;

  debateEnabled: boolean;
  debateMonthly: number;
  debateCreditsPerDebate: number;
  debateChatDaily: number;

  deepResearchEnabled: boolean;
  factcheckEnabled: boolean;
  ttsEnabled: boolean;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
    monthlyCredits: 5,
    maxVideoLengthMin: 15,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 5,
    chatDailyLimit: 10,
    flashcardsEnabled: true,
    mindmapEnabled: false,
    webSearchEnabled: false,
    webSearchMonthly: 0,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ["txt"],
    exportMarkdown: false,
    exportPdf: false,
    historyRetentionDays: 60,
    allowedModels: ["mistral-small-2603"],
    defaultModel: "mistral-small-2603",
    academicSearch: false,
    academicPapersPerAnalysis: 5,
    bibliographyExport: false,
    voiceChatEnabled: false,
    voiceChatMonthlyMinutes: 0,
    debateEnabled: false,
    debateMonthly: 0,
    debateCreditsPerDebate: 0,
    debateChatDaily: 0,
    deepResearchEnabled: false,
    factcheckEnabled: false,
    ttsEnabled: false,
  },

  plus: {
    monthlyAnalyses: 25,
    monthlyCredits: 25,
    maxVideoLengthMin: 60,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 25,
    chatDailyLimit: 50,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 20,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ["txt", "md", "pdf"],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ["mistral-small-2603", "mistral-medium-2508"],
    defaultModel: "mistral-medium-2508",
    academicSearch: true,
    academicPapersPerAnalysis: 15,
    bibliographyExport: true,
    voiceChatEnabled: false,
    voiceChatMonthlyMinutes: 0,
    debateEnabled: true,
    debateMonthly: 3,
    debateCreditsPerDebate: 6,
    debateChatDaily: 10,
    deepResearchEnabled: false,
    factcheckEnabled: true,
    ttsEnabled: false,
  },

  pro: {
    monthlyAnalyses: 100,
    monthlyCredits: 100,
    maxVideoLengthMin: 240,
    concurrentAnalyses: 3,
    priorityQueue: true,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 60,
    playlistsEnabled: true,
    maxPlaylists: 10,
    maxPlaylistVideos: 20,
    exportFormats: ["txt", "md", "pdf"],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: [
      "mistral-small-2603",
      "mistral-medium-2508",
      "mistral-large-2512",
    ],
    defaultModel: "mistral-large-2512",
    academicSearch: true,
    academicPapersPerAnalysis: 50,
    bibliographyExport: true,
    voiceChatEnabled: true,
    voiceChatMonthlyMinutes: 45,
    debateEnabled: true,
    debateMonthly: 20,
    debateCreditsPerDebate: 4,
    debateChatDaily: -1,
    deepResearchEnabled: true,
    factcheckEnabled: true,
    ttsEnabled: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURES PAR PLAN (boolean flags simplifiés)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanFeatures {
  flashcards: boolean;
  mindmap: boolean;
  webSearch: boolean;
  playlists: boolean;
  exportPdf: boolean;
  exportMarkdown: boolean;
  ttsAudio: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  academicSearch: boolean;
  bibliographyExport: boolean;
  voiceChat: boolean;
  debate: boolean;
  deepResearch: boolean;
  factcheck: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    flashcards: true,
    mindmap: false,
    webSearch: false,
    playlists: false,
    exportPdf: false,
    exportMarkdown: false,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    academicSearch: false,
    bibliographyExport: false,
    voiceChat: false,
    debate: false,
    deepResearch: false,
    factcheck: false,
  },
  plus: {
    flashcards: true,
    mindmap: true,
    webSearch: true,
    playlists: false,
    exportPdf: true,
    exportMarkdown: true,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    academicSearch: true,
    bibliographyExport: true,
    voiceChat: false,
    debate: true,
    deepResearch: false,
    factcheck: true,
  },
  pro: {
    flashcards: true,
    mindmap: true,
    webSearch: true,
    playlists: true,
    exportPdf: true,
    exportMarkdown: true,
    ttsAudio: true,
    apiAccess: false,
    prioritySupport: true,
    academicSearch: true,
    bibliographyExport: true,
    voiceChat: true,
    debate: true,
    deepResearch: true,
    factcheck: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INFORMATIONS DES PLANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanBadge {
  fr: string;
  en: string;
  color: string;
}

/** Localized string used in marketing UI */
export interface LocalizedString {
  fr: string;
  en: string;
}

export interface PlanInfo {
  id: PlanId;
  /** Localized display name. Use `name.fr` / `name.en` in UI. */
  name: LocalizedString;
  /** Plain English name (legacy compat). */
  nameEn: string;
  /** Localized description. */
  description: LocalizedString;
  /** Plain English description (legacy compat). */
  descriptionEn: string;
  priceMonthly: number; // en centimes
  /** Pre-formatted price (e.g. "4.99 €" / "$4.99"). */
  priceDisplay: LocalizedString;
  /** Hierarchy index — higher = more powerful plan. */
  order: number;
  color: string;
  /** Tailwind gradient classes (e.g. "from-blue-500 to-violet-500"). */
  gradient: string;
  icon: string;
  badge: PlanBadge | null;
  popular: boolean;
  /** Killer feature surfaced in upgrade prompts. */
  killerFeature: LocalizedString;
}

export const PLANS_INFO: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: { fr: "Gratuit", en: "Free" },
    nameEn: "Free",
    description: {
      fr: "Découvrez DeepSight gratuitement",
      en: "Discover DeepSight for free",
    },
    descriptionEn: "Discover DeepSight for free",
    priceMonthly: 0,
    priceDisplay: { fr: "0 €", en: "Free" },
    order: 0,
    color: "#6B7280",
    gradient: "from-gray-500 to-gray-600",
    icon: "Zap",
    badge: null,
    popular: false,
    killerFeature: {
      fr: "5 analyses gratuites par mois",
      en: "5 free analyses per month",
    },
  },

  plus: {
    id: "plus",
    name: { fr: "Plus", en: "Plus" },
    nameEn: "Plus",
    description: {
      fr: "L'essentiel pour apprendre mieux, plus vite",
      en: "Everything you need to learn better, faster",
    },
    descriptionEn: "Everything you need to learn better, faster",
    priceMonthly: 499,
    priceDisplay: { fr: "4,99 €/mois", en: "$4.99/mo" },
    order: 1,
    color: "#3B82F6",
    gradient: "from-blue-500 to-cyan-500",
    icon: "Star",
    badge: { fr: "Populaire", en: "Popular", color: "#3B82F6" },
    popular: true,
    killerFeature: {
      fr: "25 analyses + cartes mentales + recherche web",
      en: "25 analyses + mind maps + web search",
    },
  },

  pro: {
    id: "pro",
    name: { fr: "Pro", en: "Pro" },
    nameEn: "Pro",
    description: {
      fr: "Toute la puissance de DeepSight, sans limites",
      en: "The full power of DeepSight, unlimited",
    },
    descriptionEn: "The full power of DeepSight, unlimited",
    priceMonthly: 999,
    priceDisplay: { fr: "9,99 €/mois", en: "$9.99/mo" },
    order: 2,
    color: "#8B5CF6",
    gradient: "from-violet-500 to-fuchsia-500",
    icon: "Crown",
    badge: { fr: "Le + puissant", en: "Most powerful", color: "#8B5CF6" },
    popular: false,
    killerFeature: {
      fr: "Chat illimité + chat vocal + débats IA",
      en: "Unlimited chat + voice chat + AI debates",
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Feature key — accepts either a `PlanLimits` key or a `PlanFeatures` key.
 * `PlanFeatures` keys are looked up in PLAN_FEATURES first (boolean flags),
 * falling back to PLAN_LIMITS for numeric/array limits.
 */
export type FeatureKey = keyof PlanLimits | keyof PlanFeatures;

export function hasFeature(plan: PlanId, feature: FeatureKey): boolean {
  // Try boolean feature flag first
  const features = PLAN_FEATURES[plan] as unknown as Record<string, boolean>;
  if (feature in features) {
    return Boolean(features[feature as keyof PlanFeatures]);
  }
  const limits = PLAN_LIMITS[plan] as unknown as Record<string, unknown>;
  const value = limits[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0 || value === -1;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function getLimit(plan: PlanId, feature: FeatureKey): number {
  const limits = PLAN_LIMITS[plan] as unknown as Record<string, unknown>;
  const value = limits[feature];
  if (typeof value === "number") return value;
  return 0;
}

export function isUnlimited(plan: PlanId, feature: FeatureKey): boolean {
  return getLimit(plan, feature) === -1;
}

export function getPlanInfo(plan: PlanId): PlanInfo {
  return PLANS_INFO[plan];
}

export function isPlanHigher(a: PlanId, b: PlanId): boolean {
  return PLAN_HIERARCHY.indexOf(a) > PLAN_HIERARCHY.indexOf(b);
}

export function getMinPlanForFeature(feature: FeatureKey): PlanId {
  for (const plan of PLAN_HIERARCHY) {
    if (hasFeature(plan, feature)) {
      return plan;
    }
  }
  return "pro";
}

export function formatLimit(value: number, unit?: string): string {
  if (value === -1) return "\u221e";
  if (unit) return `${value} ${unit}`;
  return String(value);
}

/** Parametres de conversion free→paid */
export const CONVERSION_TRIGGERS = {
  freeAnalysisLimit: 5,
  freeAnalysisWarning: 3,
  trialEnabled: false,
  trialDays: 0,
  trialPlan: "plus" as PlanId,
};

/** Normalise les alias de plans (etudiant→plus, starter→plus, expert→pro, etc.) */
export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return "free";
  const lower = raw.toLowerCase().trim();
  const aliases: Record<string, PlanId> = {
    free: "free",
    gratuit: "free",
    // Anciens plans intermédiaires → plus
    student: "plus",
    etudiant: "plus",
    étudiant: "plus",
    starter: "plus",
    // Anciens plans premium → pro
    expert: "pro",
    team: "pro",
    equipe: "pro",
    équipe: "pro",
    unlimited: "pro",
    admin: "pro",
    // Plans actuels
    plus: "plus",
    pro: "pro",
  };
  return aliases[lower] ?? "free";
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFERENCIATEURS CONCURRENTIELS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Differentiator {
  icon: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  tag: { fr: string; en: string };
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: "🔍",
    title: { fr: "Fact-checking automatique", en: "Automatic fact-checking" },
    description: {
      fr: "Chaque affirmation est verifiee avec des sources web fiables. Reperer les erreurs, pas juste resumer.",
      en: "Every claim is verified against reliable web sources. Spot errors, not just summarize.",
    },
    tag: { fr: "Exclusif", en: "Exclusive" },
  },
  {
    icon: "⚔️",
    title: { fr: "Debat IA entre 2 videos", en: "AI Debate between 2 videos" },
    description: {
      fr: "Confrontez les arguments de 2 videos sur le meme sujet. Identifiez contradictions et points communs.",
      en: "Compare arguments from 2 videos on the same topic. Identify contradictions and common ground.",
    },
    tag: { fr: "Unique", en: "Unique" },
  },
  {
    icon: "📚",
    title: { fr: "Sources academiques", en: "Academic sources" },
    description: {
      fr: "Enrichissement automatique avec arXiv, Semantic Scholar, CrossRef et OpenAlex. Export bibliographique.",
      en: "Auto-enrichment from arXiv, Semantic Scholar, CrossRef and OpenAlex. Bibliography export.",
    },
    tag: { fr: "Exclusif", en: "Exclusive" },
  },
  {
    icon: "🇫🇷",
    title: { fr: "IA 100% europeenne", en: "100% European AI" },
    description: {
      fr: "Propulse par Mistral AI. Vos donnees restent en Europe. Conforme RGPD.",
      en: "Powered by Mistral AI. Your data stays in Europe. GDPR compliant.",
    },
    tag: { fr: "Confiance", en: "Trust" },
  },
  {
    icon: "🧠",
    title: {
      fr: "Revision scientifique (FSRS)",
      en: "Scientific review (FSRS)",
    },
    description: {
      fr: "Flashcards avec algorithme de repetition espacee FSRS v5 — le meme que Anki. Retenez 3x mieux.",
      en: "Flashcards with FSRS v5 spaced repetition — same as Anki. Retain 3x better.",
    },
    tag: { fr: "Science", en: "Science" },
  },
  {
    icon: "🎙️",
    title: { fr: "Chat vocal sur vos videos", en: "Voice chat on your videos" },
    description: {
      fr: "Discutez a voix haute avec l'IA sur le contenu de vos videos. Mains libres, contexte complet.",
      en: "Talk to AI about your video content. Hands-free, full context.",
    },
    tag: { fr: "Pro", en: "Pro" },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Testimonial {
  avatar: string;
  author: string;
  role: { fr: string; en: string };
  text: { fr: string; en: string };
  plan: PlanId;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    avatar: "🎓",
    author: "Marie L.",
    role: { fr: "Etudiante en medecine", en: "Medical student" },
    text: {
      fr: "Les flashcards automatiques ont transforme mes revisions. Je retiens 3x mieux.",
      en: "Auto flashcards transformed my study sessions. I retain 3x better.",
    },
    plan: "plus",
  },
  {
    avatar: "🎬",
    author: "Thomas D.",
    role: { fr: "Createur YouTube & TikTok", en: "YouTube & TikTok Creator" },
    text: {
      fr: "J'analyse les videos YouTube et TikTok de mes concurrents en quelques minutes. Un gain de temps fou.",
      en: "I analyze competitor YouTube and TikTok videos in minutes. Incredible time saver.",
    },
    plan: "pro",
  },
  {
    avatar: "📚",
    author: "Lucas R.",
    role: { fr: "Professeur d'histoire", en: "History Teacher" },
    text: {
      fr: "Je cree des supports de cours a partir de documentaires en un clic.",
      en: "I create course materials from documentaries in one click.",
    },
    plan: "plus",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES SUPPLEMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/** Alerte quand les credits sont bas */
export function shouldShowLowCreditsAlert(
  credits: number,
  plan: PlanId,
): boolean {
  const limits = PLAN_LIMITS[plan];
  const threshold = Math.ceil(limits.monthlyAnalyses * 0.1);
  return credits > 0 && credits <= Math.max(threshold, 1);
}

/** Calcule le temps economise pour marketing */
export function calculateTimeSaved(analysisCount: number): {
  hours: number;
  display: string;
} {
  const minutesPerVideo = 15;
  const totalMinutes = analysisCount * minutesPerVideo;
  const hours = Math.round(totalMinutes / 60);
  return {
    hours,
    display: hours > 0 ? `${hours}h` : `${totalMinutes} min`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PAR DEFAUT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  DIFFERENTIATORS,
  TESTIMONIALS,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  isPlanHigher,
  getMinPlanForFeature,
  formatLimit,
  normalizePlanId,
  shouldShowLowCreditsAlert,
  calculateTimeSaved,
};
