// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers
// Migration Avril 2026 : 2 plans uniquement (Free + Pro 6.99€)

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanId = 'free' | 'pro';

export const PLAN_HIERARCHY: PlanId[] = ['free', 'pro'];

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
  maxPlaylists: number;
  maxPlaylistVideos: number;

  exportFormats: string[];
  exportMarkdown: boolean;
  exportPdf: boolean;

  historyRetentionDays: number;     // -1 = permanent

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
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
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
    exportFormats: ['txt'],
    exportMarkdown: false,
    exportPdf: false,
    historyRetentionDays: 60,
    allowedModels: ['mistral-small-2603'],
    defaultModel: 'mistral-small-2603',
    academicSearch: false,
    academicPapersPerAnalysis: 0,
    bibliographyExport: false,
    voiceChatEnabled: false,
    voiceChatMonthlyMinutes: 0,
    debateEnabled: false,
    debateMonthly: 0,
    debateCreditsPerDebate: 0,
    debateChatDaily: 0,
  },

  pro: {
    monthlyAnalyses: 50,
    maxVideoLengthMin: 240,
    concurrentAnalyses: 2,
    priorityQueue: true,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 30,
    playlistsEnabled: true,
    maxPlaylists: 5,
    maxPlaylistVideos: 10,
    exportFormats: ['txt', 'md', 'pdf'],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-2603', 'mistral-medium-2508', 'mistral-large-2512'],
    defaultModel: 'mistral-large-2512',
    academicSearch: true,
    academicPapersPerAnalysis: 30,
    bibliographyExport: true,
    voiceChatEnabled: true,
    voiceChatMonthlyMinutes: 15,
    debateEnabled: true,
    debateMonthly: -1,
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
  },
  pro: {
    flashcards: true,
    mindmap: true,
    webSearch: true,
    playlists: true,
    exportPdf: true,
    exportMarkdown: true,
    ttsAudio: true,
    apiAccess: true,
    prioritySupport: true,
    academicSearch: true,
    bibliographyExport: true,
    voiceChat: true,
    debate: true,
  },
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
    description: 'Toute la puissance de DeepSight, sans limites',
    descriptionEn: 'The full power of DeepSight, unlimited',
    priceMonthly: 699,
    color: '#6366F1',
    icon: 'Zap',
    badge: { text: 'Recommande', color: '#6366F1' },
    popular: true,
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
  return 'pro';
}

export function formatLimit(value: number, unit?: string): string {
  if (value === -1) return '\u221e';
  if (unit) return `${value} ${unit}`;
  return String(value);
}

/** Parametres de conversion free→paid */
export const CONVERSION_TRIGGERS = {
  freeAnalysisLimit: 5,
  freeAnalysisWarning: 3,
  trialEnabled: false,
  trialDays: 0,
  trialPlan: 'pro' as PlanId,
};

/** Normalise les alias de plans (etudiant→pro, starter→pro, expert→pro, etc.) */
export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return 'free';
  const lower = raw.toLowerCase().trim();
  const aliases: Record<string, PlanId> = {
    free: 'free',
    gratuit: 'free',
    // Anciens plans payants → tous mappés vers pro
    student: 'pro',
    etudiant: 'pro',
    'étudiant': 'pro',
    starter: 'pro',
    expert: 'pro',
    team: 'pro',
    equipe: 'pro',
    'équipe': 'pro',
    unlimited: 'pro',
    admin: 'pro',
    // Plan actuel
    pro: 'pro',
  };
  return aliases[lower] ?? 'free';
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
    icon: '🔍',
    title: { fr: 'Fact-checking automatique', en: 'Automatic fact-checking' },
    description: {
      fr: 'Chaque affirmation est verifiee avec des sources web fiables. Reperer les erreurs, pas juste resumer.',
      en: 'Every claim is verified against reliable web sources. Spot errors, not just summarize.',
    },
    tag: { fr: 'Exclusif', en: 'Exclusive' },
  },
  {
    icon: '⚔️',
    title: { fr: 'Debat IA entre 2 videos', en: 'AI Debate between 2 videos' },
    description: {
      fr: 'Confrontez les arguments de 2 videos sur le meme sujet. Identifiez contradictions et points communs.',
      en: 'Compare arguments from 2 videos on the same topic. Identify contradictions and common ground.',
    },
    tag: { fr: 'Unique', en: 'Unique' },
  },
  {
    icon: '📚',
    title: { fr: 'Sources academiques', en: 'Academic sources' },
    description: {
      fr: 'Enrichissement automatique avec arXiv, Semantic Scholar, CrossRef et OpenAlex. Export bibliographique.',
      en: 'Auto-enrichment from arXiv, Semantic Scholar, CrossRef and OpenAlex. Bibliography export.',
    },
    tag: { fr: 'Exclusif', en: 'Exclusive' },
  },
  {
    icon: '🇫🇷',
    title: { fr: 'IA 100% europeenne', en: '100% European AI' },
    description: {
      fr: 'Propulse par Mistral AI. Vos donnees restent en Europe. Conforme RGPD.',
      en: 'Powered by Mistral AI. Your data stays in Europe. GDPR compliant.',
    },
    tag: { fr: 'Confiance', en: 'Trust' },
  },
  {
    icon: '🧠',
    title: { fr: 'Revision scientifique (FSRS)', en: 'Scientific review (FSRS)' },
    description: {
      fr: 'Flashcards avec algorithme de repetition espacee FSRS v5 — le meme que Anki. Retenez 3x mieux.',
      en: 'Flashcards with FSRS v5 spaced repetition — same as Anki. Retain 3x better.',
    },
    tag: { fr: 'Science', en: 'Science' },
  },
  {
    icon: '🎙️',
    title: { fr: 'Chat vocal sur vos videos', en: 'Voice chat on your videos' },
    description: {
      fr: 'Discutez a voix haute avec l\'IA sur le contenu de vos videos. Mains libres, contexte complet.',
      en: 'Talk to AI about your video content. Hands-free, full context.',
    },
    tag: { fr: 'Pro', en: 'Pro' },
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
    role: { fr: 'Etudiante en medecine', en: 'Medical student' },
    text: {
      fr: 'Les flashcards automatiques ont transforme mes revisions. Je retiens 3x mieux.',
      en: 'Auto flashcards transformed my study sessions. I retain 3x better.',
    },
    plan: 'pro',
  },
  {
    avatar: '🎬',
    author: 'Thomas D.',
    role: { fr: 'Createur YouTube & TikTok', en: 'YouTube & TikTok Creator' },
    text: {
      fr: 'J\'analyse les videos YouTube et TikTok de mes concurrents en quelques minutes. Un gain de temps fou.',
      en: 'I analyze competitor YouTube and TikTok videos in minutes. Incredible time saver.',
    },
    plan: 'pro',
  },
  {
    avatar: '📚',
    author: 'Lucas R.',
    role: { fr: 'Professeur d\'histoire', en: 'History Teacher' },
    text: {
      fr: 'Je cree des supports de cours a partir de documentaires en un clic.',
      en: 'I create course materials from documentaries in one click.',
    },
    plan: 'pro',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES SUPPLEMENTAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/** Alerte quand les credits sont bas */
export function shouldShowLowCreditsAlert(credits: number, plan: PlanId): boolean {
  const limits = PLAN_LIMITS[plan];
  const threshold = Math.ceil(limits.monthlyAnalyses * 0.1);
  return credits > 0 && credits <= Math.max(threshold, 1);
}

/** Calcule le temps economise pour marketing */
export function calculateTimeSaved(analysisCount: number): { hours: number; display: string } {
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
