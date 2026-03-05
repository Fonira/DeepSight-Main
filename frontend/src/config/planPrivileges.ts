// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanId = 'free' | 'etudiant' | 'starter' | 'pro';

export const PLAN_HIERARCHY: PlanId[] = ['free', 'etudiant', 'starter', 'pro'];

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
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
    maxVideoLengthMin: 15,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 5,
    chatDailyLimit: 10,
    flashcardsEnabled: false,
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
    allowedModels: ['mistral-small-latest'],
    defaultModel: 'mistral-small-latest',
    academicSearch: true,
    academicPapersPerAnalysis: 3,
    bibliographyExport: false,
  },

  etudiant: {
    monthlyAnalyses: 20,
    maxVideoLengthMin: 45,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 15,
    chatDailyLimit: 40,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: false,
    webSearchMonthly: 0,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ['txt', 'md'],
    exportMarkdown: true,
    exportPdf: false,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-latest'],
    defaultModel: 'mistral-small-latest',
    academicSearch: true,
    academicPapersPerAnalysis: 10,
    bibliographyExport: true,
  },

  starter: {
    monthlyAnalyses: 50,
    maxVideoLengthMin: 120,
    concurrentAnalyses: 1,
    priorityQueue: false,
    chatQuestionsPerVideo: 25,
    chatDailyLimit: 80,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 20,
    playlistsEnabled: false,
    maxPlaylists: 0,
    maxPlaylistVideos: 0,
    exportFormats: ['txt', 'md'],
    exportMarkdown: true,
    exportPdf: false,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-latest', 'mistral-medium-latest'],
    defaultModel: 'mistral-small-latest',
    academicSearch: true,
    academicPapersPerAnalysis: 20,
    bibliographyExport: true,
  },

  pro: {
    monthlyAnalyses: 200,
    maxVideoLengthMin: 240,
    concurrentAnalyses: 2,
    priorityQueue: true,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: 100,
    playlistsEnabled: true,
    maxPlaylists: 10,
    maxPlaylistVideos: 20,
    exportFormats: ['txt', 'md', 'pdf'],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    defaultModel: 'mistral-medium-latest',
    academicSearch: true,
    academicPapersPerAnalysis: 50,
    bibliographyExport: true,
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
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: { flashcards: false, mindmap: false, webSearch: false, playlists: false, exportPdf: false, exportMarkdown: false, ttsAudio: false, apiAccess: false, prioritySupport: false, academicSearch: true, bibliographyExport: false },
  etudiant: { flashcards: true, mindmap: true, webSearch: false, playlists: false, exportPdf: false, exportMarkdown: true, ttsAudio: true, apiAccess: false, prioritySupport: false, academicSearch: true, bibliographyExport: true },
  starter: { flashcards: true, mindmap: true, webSearch: true, playlists: false, exportPdf: false, exportMarkdown: true, ttsAudio: false, apiAccess: false, prioritySupport: false, academicSearch: true, bibliographyExport: true },
  pro: { flashcards: true, mindmap: true, webSearch: true, playlists: true, exportPdf: true, exportMarkdown: true, ttsAudio: true, apiAccess: false, prioritySupport: true, academicSearch: true, bibliographyExport: true },
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
    description: 'Pour découvrir DeepSight — YouTube & TikTok',
    descriptionEn: 'Discover DeepSight — YouTube & TikTok',
    priceMonthly: 0,
    color: '#6B7280',
    icon: 'Zap',
    badge: null,
    popular: false,
  },

  etudiant: {
    id: 'etudiant',
    name: 'Starter',
    nameEn: 'Starter',
    description: 'YouTube & TikTok — Découvrez les essentiels',
    descriptionEn: 'YouTube & TikTok — Discover the essentials',
    priceMonthly: 299,
    color: '#10B981',
    icon: '⭐',
    badge: null,
    popular: false,
  },

  starter: {
    id: 'starter',
    name: 'Standard',
    nameEn: 'Standard',
    description: 'YouTube & TikTok — Pour les utilisateurs réguliers',
    descriptionEn: 'YouTube & TikTok — For regular users',
    priceMonthly: 599,
    color: '#3B82F6',
    icon: '⭐',
    badge: { text: 'Populaire étudiants', color: '#10B981' },
    popular: false,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    description: 'YouTube & TikTok — Créateurs & professionnels',
    descriptionEn: 'YouTube & TikTok — Creators & professionals',
    priceMonthly: 1299,
    color: '#8B5CF6',
    icon: 'Crown',
    badge: { text: 'Populaire', color: '#8B5CF6' },
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

/** Paramètres de conversion free→paid */
export const CONVERSION_TRIGGERS = {
  freeAnalysisLimit: 5,
  freeAnalysisWarning: 3,
  trialEnabled: true,
  trialDays: 7,
  trialPlan: 'pro' as PlanId,
};

/** Normalise les alias de plans (student→etudiant, team→pro, etc.) */
export function normalizePlanId(raw: string | undefined | null): PlanId {
  if (!raw) return 'free';
  const lower = raw.toLowerCase().trim();
  const aliases: Record<string, PlanId> = {
    free: 'free',
    gratuit: 'free',
    student: 'etudiant',
    etudiant: 'etudiant',
    'étudiant': 'etudiant',
    starter: 'starter',
    pro: 'pro',
    team: 'pro',
    equipe: 'pro',
    'équipe': 'pro',
  };
  return aliases[lower] ?? 'free';
}

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
    plan: 'etudiant',
  },
  {
    avatar: '🎬',
    author: 'Thomas D.',
    role: { fr: 'Créateur YouTube & TikTok', en: 'YouTube & TikTok Creator' },
    text: {
      fr: 'J\'analyse les vidéos YouTube et TikTok de mes concurrents en quelques minutes. Un gain de temps fou.',
      en: 'I analyze competitor YouTube and TikTok videos in minutes. Incredible time saver.',
    },
    plan: 'pro',
  },
  {
    avatar: '📚',
    author: 'Lucas R.',
    role: { fr: 'Professeur d\'histoire', en: 'History Teacher' },
    text: {
      fr: 'Je crée des supports de cours à partir de documentaires en un clic.',
      en: 'I create course materials from documentaries in one click.',
    },
    plan: 'starter',  // Standard plan
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
