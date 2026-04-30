/**
 * Plan Privileges Configuration for DeepSight Mobile
 *
 * ⚠️ SYNCHRONIZED WITH:
 *   - backend/src/billing/plan_config.py  (SSOT)
 *   - frontend/src/config/planPrivileges.ts
 *
 * Architecture v2 (Avril 2026) : 3 plans — Free / Pro (8,99 €) / Expert (19,99 €)
 * Avec toggle mensuel/annuel −17 % et trial 7 j sans CB sur Pro et Expert.
 *
 * Migration v0 → v2 :
 *   - "plus" v0 (4,99 €) → "pro" v2 (8,99 €) + voice 30 min/mo
 *   - "pro" v0 (9,99 €) → "expert" v2 (19,99 €) + voice 120 min/mo
 *   Mappings via normalizePlanId (cf. backend normalize_plan_id et flag User.is_legacy_pricing).
 */

export type PlanId = "free" | "pro" | "expert";

export type BillingCycle = "monthly" | "yearly";

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  monthlyAnalyses: number; // -1 = unlimited
  monthlyCredits: number;
  maxVideoDuration: number; // seconds, -1 = unlimited
  chatQuestionsPerVideo: number; // -1 = unlimited
  chatDailyLimit: number; // -1 = unlimited
  maxPlaylistVideos: number; // 0 = disabled
  maxPlaylists: number; // 0 = disabled, -1 = unlimited
  maxExportsPerDay: number; // 0 = disabled, -1 = unlimited
  webSearchMonthly: number; // 0 = disabled, -1 = unlimited
  historyDays: number; // -1 = unlimited
  apiRequestsDaily: number; // 0 = disabled, -1 = unlimited
  teamMembers: number; // 1 = solo, -1 = unlimited
  studyQuizQuestions: number;
  studyMindmapDepth: number;
  studyCanGenerateMore: boolean;
  studyDailyLimit: number; // -1 = unlimited
  // Academic sources
  academicPapersPerAnalysis: number;
  // Voice chat
  voiceChatMonthlyMinutes: number; // 0 = disabled
  // Debate
  debateMonthly: number; // 0 = disabled, -1 = unlimited
}

// Type for numeric-only limits (excludes boolean properties)
export type NumericPlanLimits = {
  [K in keyof PlanLimits as PlanLimits[K] extends number
    ? K
    : never]: PlanLimits[K];
};

// ⚠️ SYNCED WITH: backend/src/billing/plan_config.py (SSOT)
export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
    monthlyCredits: 250,
    maxVideoDuration: 900, // 15 min
    chatQuestionsPerVideo: 5,
    chatDailyLimit: 10,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 0,
    webSearchMonthly: 0,
    historyDays: 60,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 3,
    studyMindmapDepth: 2,
    studyCanGenerateMore: false,
    studyDailyLimit: 2,
    academicPapersPerAnalysis: 5,
    voiceChatMonthlyMinutes: 0,
    debateMonthly: 0,
  },

  // Anciennement "plus" v0 (4,99 €) — devenu "pro" v2 (8,99 €) avec voice 30 min/mo
  pro: {
    monthlyAnalyses: 25,
    monthlyCredits: 3000,
    maxVideoDuration: 3600, // 1h
    chatQuestionsPerVideo: 25,
    chatDailyLimit: 50,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: -1,
    webSearchMonthly: 20,
    historyDays: -1,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 8,
    studyMindmapDepth: 3,
    studyCanGenerateMore: true,
    studyDailyLimit: 20,
    academicPapersPerAnalysis: 15,
    voiceChatMonthlyMinutes: 30, // ⚠ v2 H4 — Pro a maintenant la voice
    debateMonthly: 3,
  },

  // Anciennement "pro" v0 (9,99 €) — devenu "expert" v2 (19,99 €) avec voice 120 min/mo
  expert: {
    monthlyAnalyses: 100,
    monthlyCredits: 15000,
    maxVideoDuration: 14400, // 4h
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    maxPlaylistVideos: 20,
    maxPlaylists: 10,
    maxExportsPerDay: -1,
    webSearchMonthly: 60,
    historyDays: -1,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 10,
    studyMindmapDepth: 4,
    studyCanGenerateMore: true,
    studyDailyLimit: 50,
    academicPapersPerAnalysis: 50,
    voiceChatMonthlyMinutes: 120, // ⚠ v2 H4
    debateMonthly: 20,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanFeatures {
  summaryExpress: boolean;
  summaryDetailed: boolean;
  summaryTimestamps: boolean;
  summaryConcepts: boolean;
  chatBasic: boolean;
  chatWebSearch: boolean;
  chatSuggestedQuestions: boolean;
  factCheckBasic: boolean;
  factCheckAdvanced: boolean;
  intelligentSearch: boolean;
  playlists: boolean;
  corpus: boolean;
  flashcards: boolean;
  conceptMaps: boolean;
  citationExport: boolean;
  bibtexExport: boolean;
  exportPdf: boolean;
  exportMarkdown: boolean;
  exportTxt: boolean;
  exportWatermark: boolean;
  ttsAudio: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  sharedWorkspace: boolean;
  slackIntegration: boolean;
  teamsIntegration: boolean;
  academicSearch: boolean;
  bibliographyExport: boolean;
  academicFullText: boolean;
  voiceChat: boolean;
  debate: boolean;
  deepResearch: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    summaryExpress: true,
    summaryDetailed: false,
    summaryTimestamps: true,
    summaryConcepts: false,
    chatBasic: true,
    chatWebSearch: false,
    chatSuggestedQuestions: false,
    factCheckBasic: false,
    factCheckAdvanced: false,
    intelligentSearch: false,
    playlists: false,
    corpus: false,
    flashcards: true,
    conceptMaps: false,
    citationExport: false,
    bibtexExport: false,
    exportPdf: false,
    exportMarkdown: false,
    exportTxt: true,
    exportWatermark: true,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,
    academicSearch: true,
    bibliographyExport: false,
    academicFullText: false,
    voiceChat: false,
    debate: false,
    deepResearch: false,
  },

  // Anciennement "plus" v0
  pro: {
    summaryExpress: true,
    summaryDetailed: true,
    summaryTimestamps: true,
    summaryConcepts: true,
    chatBasic: true,
    chatWebSearch: true,
    chatSuggestedQuestions: true,
    factCheckBasic: true,
    factCheckAdvanced: false,
    intelligentSearch: true,
    playlists: false,
    corpus: false,
    flashcards: true,
    conceptMaps: true,
    citationExport: true,
    bibtexExport: true,
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    exportWatermark: false,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: false,
    voiceChat: true, // ⚠ v2 : Pro a la voice (avant Plus n'avait pas)
    debate: true,
    deepResearch: false,
  },

  // Anciennement "pro" v0
  expert: {
    summaryExpress: true,
    summaryDetailed: true,
    summaryTimestamps: true,
    summaryConcepts: true,
    chatBasic: true,
    chatWebSearch: true,
    chatSuggestedQuestions: true,
    factCheckBasic: true,
    factCheckAdvanced: true,
    intelligentSearch: true,
    playlists: true,
    corpus: false,
    flashcards: true,
    conceptMaps: true,
    citationExport: true,
    bibtexExport: true,
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    exportWatermark: false,
    ttsAudio: true,
    apiAccess: false,
    prioritySupport: true,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: true,
    voiceChat: true,
    debate: true,
    deepResearch: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN INFO
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanInfo {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number; // monthly price in cents (legacy alias for priceMonthlyCents)
  priceDisplay: { fr: string; en: string }; // monthly display string
  // Pricing v2 — toggle mensuel/annuel
  priceMonthlyCents: number;
  priceYearlyCents: number; // = priceMonthlyCents * 10 (≈ -17 %)
  priceYearlyDisplay: { fr: string; en: string };
  yearlyDiscountPct: number; // 17 par défaut
  badge?: { fr: string; en: string };
  popular?: boolean;
  recommended?: boolean;
  color: string;
  icon: string;
  gradient: [string, string];
  order: number;
  targetAudience: { fr: string; en: string };
  killerFeature: { fr: string; en: string };
}

const YEARLY_DISCOUNT_PCT = 17;

export const PLANS_INFO: PlanInfo[] = [
  {
    id: "free",
    name: { fr: "Gratuit", en: "Free" },
    description: {
      fr: "Découvrez DeepSight gratuitement",
      en: "Discover DeepSight for free",
    },
    price: 0,
    priceDisplay: { fr: "0€", en: "Free" },
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    priceYearlyDisplay: { fr: "0€/an", en: "Free" },
    yearlyDiscountPct: 0,
    color: "#6B7280",
    icon: "flash-outline",
    gradient: ["#6B7280", "#4B5563"],
    order: 0,
    targetAudience: { fr: "Curieux", en: "Curious" },
    killerFeature: { fr: "5 analyses gratuites", en: "5 free analyses" },
  },
  {
    // Anciennement "plus" v0 (4,99 €)
    id: "pro",
    name: { fr: "Pro", en: "Pro" },
    description: {
      fr: "L'essentiel pour apprendre mieux, plus vite",
      en: "Everything you need to learn better, faster",
    },
    price: 899,
    priceDisplay: { fr: "8,99€/mois", en: "€8.99/mo" },
    priceMonthlyCents: 899,
    priceYearlyCents: 8990, // 89,90 €/an (≈ -17 %)
    priceYearlyDisplay: { fr: "89,90€/an", en: "€89.90/yr" },
    yearlyDiscountPct: YEARLY_DISCOUNT_PCT,
    badge: { fr: "Populaire", en: "Popular" },
    popular: true,
    color: "#3B82F6",
    icon: "star-outline",
    gradient: ["#3B82F6", "#2563EB"],
    order: 1,
    targetAudience: { fr: "Étudiants & Curieux", en: "Students & Curious" },
    killerFeature: {
      fr: "25 analyses + Mind Maps + Voice 30 min",
      en: "25 analyses + Mind Maps + Voice 30 min",
    },
  },
  {
    // Anciennement "pro" v0 (9,99 €)
    id: "expert",
    name: { fr: "Expert", en: "Expert" },
    description: {
      fr: "Toute la puissance de DeepSight, sans limites",
      en: "All the power of DeepSight, unlimited",
    },
    price: 1999,
    priceDisplay: { fr: "19,99€/mois", en: "€19.99/mo" },
    priceMonthlyCents: 1999,
    priceYearlyCents: 19990, // 199,90 €/an (≈ -17 %)
    priceYearlyDisplay: { fr: "199,90€/an", en: "€199.90/yr" },
    yearlyDiscountPct: YEARLY_DISCOUNT_PCT,
    badge: { fr: "Le + puissant", en: "Most powerful" },
    color: "#8B5CF6",
    icon: "trophy-outline",
    gradient: ["#8B5CF6", "#7C3AED"],
    order: 2,
    targetAudience: { fr: "Pros & Chercheurs", en: "Pros & Researchers" },
    killerFeature: {
      fr: "100 analyses + Tout illimité + Voice 120 min",
      en: "100 analyses + Everything unlimited + Voice 120 min",
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════

export const CONVERSION_TRIGGERS = {
  freeAnalysisWarning: 3,
  freeAnalysisLimit: 5,
  lowCreditsWarningPercent: 20,
  lowCreditsCriticalPercent: 5,
  showTimeSaved: true,
  showEquivalentPages: true,
  // Pricing v2 H5 : trial 7 j sans CB activé sur Pro et Expert
  trialEnabled: true,
  trialDays: 7,
  trialPlan: "pro" as PlanId, // default trial CTA → Pro v2
  trialAvailableFor: ["pro", "expert"] as PlanId[],
  trialRequiresCard: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFERENCIATEURS CONCURRENTIELS — Ce que DeepSight fait et personne d'autre
// ═══════════════════════════════════════════════════════════════════════════════

export interface Differentiator {
  icon: string;
  ionicon: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  tag: { fr: string; en: string };
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: "🔍",
    ionicon: "search-outline",
    title: { fr: "Fact-checking automatique", en: "Automatic fact-checking" },
    description: {
      fr: "Chaque affirmation est vérifiée avec des sources web fiables. Repérer les erreurs, pas juste résumer.",
      en: "Every claim is verified against reliable web sources. Spot errors, not just summarize.",
    },
    tag: { fr: "Exclusif", en: "Exclusive" },
  },
  {
    icon: "⚔️",
    ionicon: "git-compare-outline",
    title: { fr: "Débat IA entre 2 vidéos", en: "AI Debate between 2 videos" },
    description: {
      fr: "Confrontez les arguments de 2 vidéos sur le même sujet. Identifiez contradictions et points communs.",
      en: "Compare arguments from 2 videos on the same topic. Identify contradictions and common ground.",
    },
    tag: { fr: "Unique", en: "Unique" },
  },
  {
    icon: "📚",
    ionicon: "library-outline",
    title: { fr: "Sources académiques", en: "Academic sources" },
    description: {
      fr: "Enrichissement automatique avec arXiv, Semantic Scholar, CrossRef et OpenAlex. Export bibliographique.",
      en: "Auto-enrichment from arXiv, Semantic Scholar, CrossRef and OpenAlex. Bibliography export.",
    },
    tag: { fr: "Exclusif", en: "Exclusive" },
  },
  {
    icon: "🇫🇷",
    ionicon: "shield-checkmark-outline",
    title: { fr: "IA 100% européenne", en: "100% European AI" },
    description: {
      fr: "Propulsé par Mistral AI. Vos données restent en Europe. Conforme RGPD.",
      en: "Powered by Mistral AI. Your data stays in Europe. GDPR compliant.",
    },
    tag: { fr: "Confiance", en: "Trust" },
  },
  {
    icon: "🧠",
    ionicon: "bulb-outline",
    title: {
      fr: "Révision scientifique (FSRS)",
      en: "Scientific review (FSRS)",
    },
    description: {
      fr: "Flashcards avec algorithme de répétition espacée FSRS v5 — le même que Anki. Retenez 3x mieux.",
      en: "Flashcards with FSRS v5 spaced repetition — same as Anki. Retain 3x better.",
    },
    tag: { fr: "Science", en: "Science" },
  },
  {
    icon: "🎙️",
    ionicon: "mic-outline",
    title: { fr: "Chat vocal sur vos vidéos", en: "Voice chat on your videos" },
    description: {
      fr: "Discutez à voix haute avec l'IA sur le contenu de vos vidéos. Mains libres, contexte complet.",
      en: "Talk to AI about your video content. Hands-free, full context.",
    },
    tag: { fr: "Pro", en: "Pro" },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TESTIMONIALS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Testimonial {
  id: string;
  name: string;
  role: { fr: string; en: string };
  avatar?: string;
  quote: { fr: string; en: string };
  plan: PlanId;
  rating: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "testimonial-1",
    name: "Marie L.",
    role: { fr: "Étudiante en Master", en: "Master's Student" },
    quote: {
      fr: "DeepSight m'a fait gagner des heures de prise de notes. Je peux maintenant me concentrer sur la compréhension plutôt que la transcription.",
      en: "DeepSight saved me hours of note-taking. I can now focus on understanding rather than transcribing.",
    },
    plan: "pro",
    rating: 5,
  },
  {
    id: "testimonial-4",
    name: "Alex K.",
    role: { fr: "Développeur freelance", en: "Freelance Developer" },
    quote: {
      fr: "Je peux parcourir des heures de tutoriels en quelques minutes. ROI incroyable pour 8,99€/mois.",
      en: "I can go through hours of tutorials in minutes. Incredible ROI for €8.99/month.",
    },
    plan: "pro",
    rating: 5,
  },
  {
    id: "testimonial-5",
    name: "Julie D.",
    role: { fr: "Professeure de lycée", en: "High School Teacher" },
    quote: {
      fr: "Les flashcards générées automatiquement m'aident à créer des supports de cours rapidement.",
      en: "Auto-generated flashcards help me create course materials quickly.",
    },
    plan: "pro",
    rating: 5,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// PRO BENEFITS (for upgrade modals)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProBenefit {
  icon: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
}

export const PRO_BENEFITS: ProBenefit[] = [
  {
    icon: "time-outline",
    title: { fr: "Gagnez du temps", en: "Save time" },
    description: {
      fr: "Analysez une vidéo de 4h en 30 secondes",
      en: "Analyze a 4h video in 30 seconds",
    },
  },
  {
    icon: "list-outline",
    title: { fr: "Playlists (Expert)", en: "Playlists (Expert)" },
    description: {
      fr: "Analysez jusqu'à 10 playlists de 20 vidéos avec Expert",
      en: "Analyze up to 10 playlists of 20 videos with Expert",
    },
  },
  {
    icon: "school-outline",
    title: { fr: "Outils d'étude", en: "Study tools" },
    description: {
      fr: "Flashcards, quiz, cartes mentales",
      en: "Flashcards, quizzes, mind maps",
    },
  },
  {
    icon: "shield-checkmark-outline",
    title: {
      fr: "Voice Chat + Deep Research",
      en: "Voice Chat + Deep Research",
    },
    description: {
      fr: "Voice ElevenLabs (Pro 30 min, Expert 120 min) et Deep Research (Expert)",
      en: "Voice ElevenLabs (Pro 30 min, Expert 120 min) and Deep Research (Expert)",
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const PLAN_ORDER: PlanId[] = ["free", "pro", "expert"];

/**
 * Normalize a plan name to a valid PlanId v2.
 *
 * Mappings legacy v0/v1 → v2 (cohérent avec backend normalize_plan_id) :
 *   - "plus" v0 (4,99 €) → "pro" v2 (8,99 €)
 *   - "pro" v0 (9,99 €) → mappé selon contexte (cf. flag User.is_legacy_pricing
 *     côté backend pour grandfathering). Côté mobile, on traite "pro" comme v2 par défaut.
 *   - "student" / "étudiant" / "starter" → "pro" (entry-tier paid v2)
 *   - "team" / "expert" / "unlimited" → "expert" v2
 */
export function normalizePlanId(plan: string | undefined): PlanId {
  if (!plan) return "free";

  const normalized = plan.toLowerCase().trim();

  const planMapping: Record<string, PlanId> = {
    free: "free",
    gratuit: "free",
    découverte: "free",
    decouverte: "free",
    discovery: "free",
    // Legacy intermédiaires → Pro v2 (anciennement plus 4,99 €)
    plus: "pro",
    student: "pro",
    étudiant: "pro",
    etudiant: "pro",
    starter: "pro",
    // Plans v2 canoniques
    pro: "pro",
    expert: "expert",
    // Legacy premium → Expert v2
    team: "expert",
    équipe: "expert",
    equipe: "expert",
    unlimited: "expert",
    admin: "expert",
  };

  return planMapping[normalized] || "free";
}

/**
 * Check if a plan has access to a feature
 */
export function hasFeature(
  plan: PlanId | string | undefined,
  feature: keyof PlanFeatures,
): boolean {
  const planId = normalizePlanId(plan as string);
  return PLAN_FEATURES[planId]?.[feature] ?? false;
}

/**
 * Get a limit for a plan
 */
export function getLimit(
  plan: PlanId | string | undefined,
  limit: keyof NumericPlanLimits,
): number {
  const planId = normalizePlanId(plan as string);
  return PLAN_LIMITS[planId]?.[limit] ?? 0;
}

/**
 * Check if a limit is unlimited (-1)
 */
export function isUnlimited(
  plan: PlanId | string | undefined,
  limit: keyof NumericPlanLimits,
): boolean {
  return getLimit(plan, limit) === -1;
}

/**
 * Get plan info
 */
export function getPlanInfo(plan: PlanId | string | undefined): PlanInfo {
  const planId = normalizePlanId(plan as string);
  return PLANS_INFO.find((p) => p.id === planId) || PLANS_INFO[0];
}

/**
 * Compare two plans (returns -1, 0, or 1)
 */
export function comparePlans(
  plan1: PlanId | string,
  plan2: PlanId | string,
): number {
  const order1 = getPlanInfo(plan1).order;
  const order2 = getPlanInfo(plan2).order;
  return order1 - order2;
}

/**
 * Check if a plan is higher than another
 */
export function isPlanHigher(
  currentPlan: PlanId | string,
  targetPlan: PlanId | string,
): boolean {
  return comparePlans(targetPlan, currentPlan) > 0;
}

/**
 * Get minimum plan required for a feature
 */
export function getMinPlanForFeature(feature: keyof PlanFeatures): PlanId {
  for (const plan of PLAN_ORDER) {
    if (PLAN_FEATURES[plan][feature]) {
      return plan;
    }
  }
  return "expert";
}

/**
 * Check if user should see low credits alert
 */
export function shouldShowLowCreditsAlert(
  currentCredits: number,
  maxCredits: number,
): "none" | "warning" | "critical" {
  if (maxCredits <= 0) return "none";
  const percent = (currentCredits / maxCredits) * 100;
  if (percent <= CONVERSION_TRIGGERS.lowCreditsCriticalPercent)
    return "critical";
  if (percent <= CONVERSION_TRIGGERS.lowCreditsWarningPercent) return "warning";
  return "none";
}

/**
 * Check if free user should see upgrade prompt
 */
export function shouldShowUpgradePrompt(
  plan: PlanId | string,
  analysesUsed: number,
): "none" | "warning" | "blocked" {
  const planId = normalizePlanId(plan as string);
  if (planId !== "free") return "none";
  if (analysesUsed >= CONVERSION_TRIGGERS.freeAnalysisLimit) return "blocked";
  if (analysesUsed >= CONVERSION_TRIGGERS.freeAnalysisWarning) return "warning";
  return "none";
}

/**
 * Calculate time saved by analysis (for display)
 */
export function calculateTimeSaved(videoDurationSeconds: number): {
  minutes: number;
  equivalent: string;
} {
  const minutesSaved = Math.round((videoDurationSeconds * 0.8) / 60);
  const pagesEquivalent = Math.round(videoDurationSeconds / 180);

  return {
    minutes: minutesSaved,
    equivalent: pagesEquivalent > 0 ? `${pagesEquivalent} pages` : "1 page",
  };
}

/**
 * Get study tools limits for a plan
 */
export function getStudyToolsLimits(plan: PlanId | string | undefined): {
  quizQuestions: number;
  mindmapDepth: number;
  canGenerateMore: boolean;
  dailyLimit: number;
} {
  const planId = normalizePlanId(plan as string);
  const limits = PLAN_LIMITS[planId];

  return {
    quizQuestions: limits.studyQuizQuestions,
    mindmapDepth: limits.studyMindmapDepth,
    canGenerateMore: limits.studyCanGenerateMore,
    dailyLimit: limits.studyDailyLimit,
  };
}

/**
 * Compute the displayed price for a given plan and billing cycle.
 * Used by upgrade.tsx + subscription.tsx for the BillingToggle.
 */
export function getPriceDisplay(
  plan: PlanId | string,
  cycle: BillingCycle,
  language: "fr" | "en" = "fr",
): string {
  const info = getPlanInfo(plan);
  if (cycle === "yearly") {
    return info.priceYearlyDisplay[language];
  }
  return info.priceDisplay[language];
}

/**
 * Get feature list for display (used in upgrade screens)
 */
export function getFeatureListForDisplay(
  plan: PlanId,
  language: "fr" | "en",
): Array<{
  text: string;
  included: boolean;
  highlight?: boolean;
}> {
  const features = PLAN_FEATURES[plan];
  const limits = PLAN_LIMITS[plan];

  const analysesText =
    limits.monthlyAnalyses === -1
      ? language === "fr"
        ? "Analyses illimitées"
        : "Unlimited analyses"
      : language === "fr"
        ? `${limits.monthlyAnalyses} analyses/mois`
        : `${limits.monthlyAnalyses} analyses/month`;

  const chatText =
    limits.chatQuestionsPerVideo === -1
      ? language === "fr"
        ? "Chat illimité"
        : "Unlimited chat"
      : language === "fr"
        ? `Chat (${limits.chatQuestionsPerVideo} questions/vidéo)`
        : `Chat (${limits.chatQuestionsPerVideo} questions/video)`;

  const webSearchText =
    limits.webSearchMonthly === 0
      ? language === "fr"
        ? "Recherche web"
        : "Web search"
      : limits.webSearchMonthly === -1
        ? language === "fr"
          ? "Recherche web illimitée"
          : "Unlimited web search"
        : language === "fr"
          ? `Recherche web (${limits.webSearchMonthly}/mois)`
          : `Web search (${limits.webSearchMonthly}/mo)`;

  const playlistText =
    limits.maxPlaylistVideos === 0
      ? language === "fr"
        ? "Playlists"
        : "Playlists"
      : language === "fr"
        ? `Playlists (${limits.maxPlaylistVideos} vidéos)`
        : `Playlists (${limits.maxPlaylistVideos} videos)`;

  const voiceText =
    limits.voiceChatMonthlyMinutes === 0
      ? language === "fr"
        ? "Chat vocal"
        : "Voice chat"
      : language === "fr"
        ? `Chat vocal (${limits.voiceChatMonthlyMinutes} min/mois)`
        : `Voice chat (${limits.voiceChatMonthlyMinutes} min/mo)`;

  return [
    {
      text: analysesText,
      included: true,
      highlight: limits.monthlyAnalyses >= 100,
    },
    { text: chatText, included: features.chatBasic },
    {
      text: webSearchText,
      included: features.chatWebSearch,
      highlight: features.chatWebSearch,
    },
    {
      text:
        language === "fr"
          ? "Flashcards & Cartes mentales"
          : "Flashcards & Mind maps",
      included: features.flashcards && features.conceptMaps,
      highlight: plan !== "free",
    },
    {
      text: playlistText,
      included: features.playlists,
      highlight: features.playlists,
    },
    {
      text: language === "fr" ? "Export PDF" : "PDF export",
      included: features.exportPdf,
    },
    {
      text: language === "fr" ? "Export Markdown" : "Markdown export",
      included: features.exportMarkdown,
    },
    {
      text: language === "fr" ? "Export BibTeX" : "BibTeX export",
      included: features.bibtexExport,
    },
    {
      text: language === "fr" ? "Lecture audio TTS" : "TTS audio playback",
      included: features.ttsAudio,
    },
    {
      text: language === "fr" ? "Deep Research" : "Deep Research",
      included: features.deepResearch,
      highlight: features.deepResearch,
    },
    {
      text: voiceText,
      included: features.voiceChat,
      highlight: features.voiceChat,
    },
  ].filter((f) => f.included || plan === "free");
}

export default {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  DIFFERENTIATORS,
  TESTIMONIALS,
  PRO_BENEFITS,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  comparePlans,
  isPlanHigher,
  getMinPlanForFeature,
  getFeatureListForDisplay,
  getPriceDisplay,
  normalizePlanId,
  shouldShowLowCreditsAlert,
  shouldShowUpgradePrompt,
  calculateTimeSaved,
  getStudyToolsLimits,
};
