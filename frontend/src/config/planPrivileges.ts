// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanId = 'free' | 'pro' | 'expert';

export const PLAN_HIERARCHY: PlanId[] = ['free', 'pro', 'expert'];

// ═══════════════════════════════════════════════════════════════════════════════
// LIMITES PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  monthlyAnalyses: number;
  maxVideoLengthMin: number;        // en minutes, -1 = illimité
  concurrentAnalyses: number;
  priorityQueue: boolean;

  chatQuestionsPerVideo: number;    // -1 = illimité
  chatDailyLimit: number;           // -1 = illimité

  flashcardsEnabled: boolean;
  mindmapEnabled: boolean;

  webSearchEnabled: boolean;
  webSearchMonthly: number;         // 0 = désactivé, -1 = illimité

  playlistsEnabled: boolean;
  maxPlaylists: number;             // 0 = désactivé, -1 = illimité
  maxPlaylistVideos: number;        // 0 = désactivé, -1 = illimité

  exportFormats: string[];
  exportMarkdown: boolean;
  exportPdf: boolean;

  historyRetentionDays: number;     // -1 = permanent

  allowedModels: string[];
  defaultModel: string;

  // Sources académiques (Semantic Scholar, OpenAlex, arXiv)
  academicSearch: boolean;          // Recherche de sources académiques
  academicPapersPerAnalysis: number; // Nombre max de papiers (backend contrôle aussi)
  bibliographyExport: boolean;      // Export bibliographie (BibTeX, APA, etc.)

  // Voice Chat
  voiceChatEnabled: boolean;        // Activer le chat vocal
  voiceChatMonthlyMinutes: number;  // Minutes mensuelles, 0 = désactivé

  // Débat IA (confrontation de 2 vidéos)
  debateEnabled: boolean;           // Feature activée
  debateMonthly: number;            // Débats par mois (0 = désactivé, -1 = illimité)
  debateCreditsPerDebate: number;   // Crédits consommés par débat
  debateChatDaily: number;          // Chat débat par jour (-1 = illimité)
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
    maxVideoLengthMin: 15,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 5,
    chatDailyLimit: 10,
    flashcardsEnabled: true,         // ✅ Gratuit désormais
    mindmapEnabled: false,
    webSearchEnabled: false,
    webSearchMonthly: 0,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ['txt'],
    exportMarkdown: false,
    exportPdf: false,
    historyRetentionDays: 60,
    allowedModels: ['mistral-small-2603'],
    defaultModel: 'mistral-small-2603',
    academicSearch: true,
    academicPapersPerAnalysis: 3,
    bibliographyExport: false,
    voiceChatEnabled: false,
    voiceChatMonthlyMinutes: 0,
    debateEnabled: true,
    debateMonthly: 1,
    debateCreditsPerDebate: 10,
    debateChatDaily: 3,
  },

  pro: {
    monthlyAnalyses: 30,
    maxVideoLengthMin: 120,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 25,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 20,
    playlistsEnabled: true,
    maxPlaylists: 3,
    maxPlaylistVideos: 5,
    exportFormats: ['txt', 'md', 'pdf'],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-2603', 'mistral-medium-2508'],
    defaultModel: 'mistral-medium-2508',
    academicSearch: true,
    academicPapersPerAnalysis: 15,
    bibliographyExport: true,
    voiceChatEnabled: true,
    voiceChatMonthlyMinutes: 10,
    debateEnabled: true,
    debateMonthly: 10,
    debateCreditsPerDebate: 6,
    debateChatDaily: 15,
  },

  expert: {
    monthlyAnalyses: 100,
    maxVideoLengthMin: 240,
    concurrentAnalyses: 2,
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
    exportFormats: ['txt', 'md', 'pdf'],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-2603', 'mistral-medium-2508', 'mistral-large-2512'],
    defaultModel: 'mistral-large-2512',
    academicSearch: true,
    academicPapersPerAnalysis: 50,
    bibliographyExport: true,
    voiceChatEnabled: true,
    voiceChatMonthlyMinutes: 20,
    debateEnabled: true,
    debateMonthly: 50,
    debateCreditsPerDebate: 4,
    debateChatDaily: -1,
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
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free:   { flashcards: true, mindmap: false, webSearch: false, playlists: false, exportPdf: false, exportMarkdown: false, ttsAudio: false, apiAccess: false, prioritySupport: false, academicSearch: true, bibliographyExport: false, voiceChat: false, debate: true },
  pro:    { flashcards: true, mindmap: true, webSearch: true, playlists: true, exportPdf: true, exportMarkdown: true, ttsAudio: true, apiAccess: false, prioritySupport: false, academicSearch: true, bibliographyExport: true, voiceChat: true, debate: true },
  expert: { flashcards: true, mindmap: true, webSearch: true, playlists: true, exportPdf: true, exportMarkdown: true, ttsAudio: true, apiAccess: false, prioritySupport: true, academicSearch: true, bibliographyExport: true, voiceChat: true, debate: true },
};

// ═══════════════════════════════════════════════════════════════════════════════
// INFORMATIONS DES PLANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanBadge {
  text: string;
  color: string;
}

export interface PlanInfo {
  id: PlanId;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  priceMonthly: number;     // en centimes
  color: string;
  icon: string;
  badge: PlanBadge | null;
  popular: boolean;
}

export const PLANS_INFO: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Gratuit',
    nameEn: 'Free',
    description: 'Analysez, chattez et revisez — sans engagement',
    descriptionEn: 'Analyze, chat and study — no commitment',
    priceMonthly: 0,
    color: '#6B7280',
    icon: 'Zap',
    badge: null,
    popular: false,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    description: 'Fact-checking, cartes mentales et recherche web',
    descriptionEn: 'Fact-checking, mind maps and web search',
    priceMonthly: 599,
    color: '#3B82F6',
    icon: '⭐',
    badge: { text: 'Le plus populaire', color: '#3B82F6' },
    popular: true,
  },

  expert: {
    id: 'expert',
    name: 'Expert',
    nameEn: 'Expert',
    description: 'Recherche approfondie, debats IA et priorite',
    descriptionEn: 'Deep research, AI debates and priority queue',
    priceMonthly: 1499,
    color: '#F59E0B',
    icon: 'Crown',
    badge: null,
    popular: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

export function hasFeature(plan: PlanId, feature: keyof PlanLimits): boolean {
  const value = PLAN_LIMITS[plan][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0 || value === -1;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function getLimit(plan: PlanId, feature: keyof PlanLimits): number {
  const value = PLAN_LIMITS[plan][feature];
  if (typeof value === 'number') return value;
  return 0;
}

export function isUnlimited(plan: PlanId, feature: keyof PlanLimits): boolean {
  return getLimit(plan, feature) === -1;
}

export function getPlanInfo(plan: PlanId): PlanInfo {
  return PLANS_INFO[plan];
}

export function isPlanHigher(a: PlanId, b: PlanId): boolean {
  return PLAN_HIERARCHY.indexOf(a) > PLAN_HIERARCHY.indexOf(b);
}

export function getMinPlanForFeature(feature: keyof PlanLimits): PlanId {
  for (const plan of PLAN_HIERARCHY) {
    if (hasFeature(plan, feature)) {
      return plan;
    }
  }
  return 'expert';
}

export function formatLimit(value: number, unit?: string): string {
  if (value === -1) return '\u221e';
  if (unit) return `${value} ${unit}`;
  return String(value);
}

/** Paramètres de conversion free→paid */
export const CONVERSION_TRIGGERS = {
  freeAnalysisLimit: 5,
  freeAnalysisWarning: 3,
  trialEnabled: true,
  trialDays: 7,
  trialPlan: 'pro' as PlanId,
};

/** Normalise les alias de plans (etudiant→pro, starter→pro, etc.) */
export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return 'free';
  const lower = raw.toLowerCase().trim();
  const aliases: Record<string, PlanId> = {
    free: 'free',
    gratuit: 'free',
    // Anciens plans → pro
    student: 'pro',
    etudiant: 'pro',
    'étudiant': 'pro',
    starter: 'pro',
    // Nouveaux plans
    pro: 'pro',
    expert: 'expert',
    // Legacy aliases
    team: 'expert',
    equipe: 'expert',
    'équipe': 'expert',
    unlimited: 'expert',
    admin: 'expert',
  };
  return aliases[lower] ?? 'free';
}

// ═══════════════════════════════════════════════════════════════════════════════
// DIFFERENCIATEURS CONCURRENTIELS — Ce que DeepSight fait et personne d'autre
// ═══════════════════════════════════════════════════════════════════════════════

export interface Differentiator {
  icon: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  tag: { fr: string; en: string };
}

export const DIFFERENTIATORS: Differentiator[] = [
  {
    icon: '🔍',
    title: { fr: 'Fact-checking automatique', en: 'Automatic fact-checking' },
    description: {
      fr: 'Chaque affirmation est vérifiée avec des sources web fiables. Repérer les erreurs, pas juste résumer.',
      en: 'Every claim is verified against reliable web sources. Spot errors, not just summarize.',
    },
    tag: { fr: 'Exclusif', en: 'Exclusive' },
  },
  {
    icon: '⚔️',
    title: { fr: 'Débat IA entre 2 vidéos', en: 'AI Debate between 2 videos' },
    description: {
      fr: 'Confrontez les arguments de 2 vidéos sur le même sujet. Identifiez contradictions et points communs.',
      en: 'Compare arguments from 2 videos on the same topic. Identify contradictions and common ground.',
    },
    tag: { fr: 'Unique', en: 'Unique' },
  },
  {
    icon: '📚',
    title: { fr: 'Sources académiques', en: 'Academic sources' },
    description: {
      fr: 'Enrichissement automatique avec arXiv, Semantic Scholar, CrossRef et OpenAlex. Export bibliographique.',
      en: 'Auto-enrichment from arXiv, Semantic Scholar, CrossRef and OpenAlex. Bibliography export.',
    },
    tag: { fr: 'Exclusif', en: 'Exclusive' },
  },
  {
    icon: '🇫🇷',
    title: { fr: 'IA 100% européenne', en: '100% European AI' },
    description: {
      fr: 'Propulsé par Mistral AI. Vos données restent en Europe. Conforme RGPD.',
      en: 'Powered by Mistral AI. Your data stays in Europe. GDPR compliant.',
    },
    tag: { fr: 'Confiance', en: 'Trust' },
  },
  {
    icon: '🧠',
    title: { fr: 'Révision scientifique (FSRS)', en: 'Scientific review (FSRS)' },
    description: {
      fr: 'Flashcards avec algorithme de répétition espacée FSRS v5 — le même que Anki. Retenez 3x mieux.',
      en: 'Flashcards with FSRS v5 spaced repetition — same as Anki. Retain 3x better.',
    },
    tag: { fr: 'Science', en: 'Science' },
  },
  {
    icon: '🎙️',
    title: { fr: 'Chat vocal sur vos vidéos', en: 'Voice chat on your videos' },
    description: {
      fr: 'Discutez à voix haute avec l\'IA sur le contenu de vos vidéos. Mains libres, contexte complet.',
      en: 'Talk to AI about your video content. Hands-free, full context.',
    },
    tag: { fr: 'Pro', en: 'Pro' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CREDIT PACKS — Achats à la carte
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreditPack {
  id: string;
  name: { fr: string; en: string };
  credits: number;
  priceCents: number;
  priceDisplay: string;
  description: { fr: string; en: string };
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'discovery',
    name: { fr: 'Pack Découverte', en: 'Discovery Pack' },
    credits: 500,
    priceCents: 199,
    priceDisplay: '1,99',
    description: { fr: '~4 analyses supplémentaires', en: '~4 additional analyses' },
  },
  {
    id: 'standard',
    name: { fr: 'Pack Standard', en: 'Standard Pack' },
    credits: 2000,
    priceCents: 599,
    priceDisplay: '5,99',
    description: { fr: '~16 analyses supplémentaires', en: '~16 additional analyses' },
  },
  {
    id: 'intensive',
    name: { fr: 'Pack Intensif', en: 'Intensive Pack' },
    credits: 5000,
    priceCents: 1199,
    priceDisplay: '11,99',
    description: { fr: '~40 analyses supplémentaires', en: '~40 additional analyses' },
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
    avatar: '🎓',
    author: 'Marie L.',
    role: { fr: 'Étudiante en médecine', en: 'Medical student' },
    text: {
      fr: 'Les flashcards automatiques ont transformé mes révisions. Je retiens 3x mieux.',
      en: 'Auto flashcards transformed my study sessions. I retain 3x better.',
    },
    plan: 'pro',
  },
  {
    avatar: '🎬',
    author: 'Thomas D.',
    role: { fr: 'Créateur YouTube & TikTok', en: 'YouTube & TikTok Creator' },
    text: {
      fr: 'J\'analyse les vidéos YouTube et TikTok de mes concurrents en quelques minutes. Un gain de temps fou.',
      en: 'I analyze competitor YouTube and TikTok videos in minutes. Incredible time saver.',
    },
    plan: 'expert',
  },
  {
    avatar: '📚',
    author: 'Lucas R.',
    role: { fr: 'Professeur d\'histoire', en: 'History Teacher' },
    text: {
      fr: 'Je crée des supports de cours à partir de documentaires en un clic.',
      en: 'I create course materials from documentaries in one click.',
    },
    plan: 'pro',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES SUPPLÉMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/** Alerte quand les crédits sont bas */
export function shouldShowLowCreditsAlert(credits: number, plan: PlanId): boolean {
  const limits = PLAN_LIMITS[plan];
  const threshold = Math.ceil(limits.monthlyAnalyses * 0.1);
  return credits > 0 && credits <= Math.max(threshold, 1);
}

/** Calcule le temps économisé pour marketing */
export function calculateTimeSaved(analysisCount: number): { hours: number; display: string } {
  const minutesPerVideo = 15; // temps moyen pour résumer manuellement
  const totalMinutes = analysisCount * minutesPerVideo;
  const hours = Math.round(totalMinutes / 60);
  return {
    hours,
    display: hours > 0 ? `${hours}h` : `${totalMinutes} min`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  DIFFERENTIATORS,
  CREDIT_PACKS,
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
