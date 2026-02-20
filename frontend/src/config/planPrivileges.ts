// ⚠️ MIROIR de backend/src/billing/plan_config.py — Synchroniser les deux fichiers

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PlanId = 'free' | 'etudiant' | 'starter' | 'pro' | 'equipe';

export const PLAN_HIERARCHY: PlanId[] = ['free', 'etudiant', 'starter', 'pro', 'equipe'];

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
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 3,
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
  },

  equipe: {
    monthlyAnalyses: 1000,
    maxVideoLengthMin: -1,
    concurrentAnalyses: 5,
    priorityQueue: true,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    flashcardsEnabled: true,
    mindmapEnabled: true,
    webSearchEnabled: true,
    webSearchMonthly: -1,
    playlistsEnabled: true,
    maxPlaylists: -1,
    maxPlaylistVideos: 100,
    exportFormats: ['txt', 'md', 'pdf'],
    exportMarkdown: true,
    exportPdf: true,
    historyRetentionDays: -1,
    allowedModels: ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest'],
    defaultModel: 'mistral-medium-latest',
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
    description: 'Pour découvrir DeepSight',
    descriptionEn: 'Discover DeepSight',
    priceMonthly: 0,
    color: '#6B7280',
    icon: 'Zap',
    badge: null,
    popular: false,
  },

  etudiant: {
    id: 'etudiant',
    name: 'Étudiant',
    nameEn: 'Student',
    description: 'Pour réviser efficacement',
    descriptionEn: 'Study smarter',
    priceMonthly: 299,
    color: '#10B981',
    icon: 'GraduationCap',
    badge: { text: 'Étudiants', color: '#10B981' },
    popular: false,
  },

  starter: {
    id: 'starter',
    name: 'Starter',
    nameEn: 'Starter',
    description: 'Pour les utilisateurs réguliers',
    descriptionEn: 'For regular users',
    priceMonthly: 599,
    color: '#3B82F6',
    icon: 'Zap',
    badge: null,
    popular: false,
  },

  pro: {
    id: 'pro',
    name: 'Pro',
    nameEn: 'Pro',
    description: 'Pour les créateurs et professionnels',
    descriptionEn: 'For creators & professionals',
    priceMonthly: 1299,
    color: '#8B5CF6',
    icon: 'Crown',
    badge: { text: 'Populaire', color: '#8B5CF6' },
    popular: true,
  },

  equipe: {
    id: 'equipe',
    name: 'Équipe',
    nameEn: 'Team',
    description: 'Pour les entreprises et laboratoires',
    descriptionEn: 'For businesses & labs',
    priceMonthly: 2999,
    color: '#F59E0B',
    icon: 'Users',
    badge: { text: 'Entreprises', color: '#F59E0B' },
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
  return 'equipe';
}

export function formatLimit(value: number, unit?: string): string {
  if (value === -1) return '\u221e';
  if (unit) return `${value} ${unit}`;
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_HIERARCHY,
  PLAN_LIMITS,
  PLANS_INFO,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  isPlanHigher,
  getMinPlanForFeature,
  formatLimit,
};
