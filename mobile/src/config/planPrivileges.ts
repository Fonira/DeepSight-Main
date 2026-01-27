/**
 * Plan Privileges Configuration for DeepSight Mobile
 *
 * SYNCHRONIZED WITH: frontend/src/config/planPrivileges.ts
 *
 * Strategy:
 * - Free: Maximum friction for conversion
 * - Student: Education-focused with study tools (2.99/mo)
 * - Starter: Individual power users (5.99/mo)
 * - Pro: Creators & professionals (12.99/mo) - POPULAR
 * - Team: Enterprises & labs (29.99/mo)
 */

export type PlanId = 'free' | 'student' | 'starter' | 'pro' | 'team';

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN LIMITS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  monthlyAnalyses: number;        // -1 = unlimited
  monthlyCredits: number;
  maxVideoDuration: number;       // seconds, -1 = unlimited
  chatQuestionsPerVideo: number;  // -1 = unlimited
  chatDailyLimit: number;         // -1 = unlimited
  maxPlaylistVideos: number;      // 0 = disabled
  maxPlaylists: number;           // 0 = disabled, -1 = unlimited
  maxExportsPerDay: number;       // 0 = disabled, -1 = unlimited
  webSearchMonthly: number;       // 0 = disabled, -1 = unlimited
  historyDays: number;            // -1 = unlimited
  apiRequestsDaily: number;       // 0 = disabled, -1 = unlimited
  teamMembers: number;            // 1 = solo, -1 = unlimited
  studyQuizQuestions: number;
  studyMindmapDepth: number;
  studyCanGenerateMore: boolean;
  studyDailyLimit: number;        // -1 = unlimited
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 3,
    monthlyCredits: 150,
    maxVideoDuration: 600,        // 10 min max
    chatQuestionsPerVideo: 3,
    chatDailyLimit: 10,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 0,
    webSearchMonthly: 0,
    historyDays: 3,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 3,
    studyMindmapDepth: 2,
    studyCanGenerateMore: false,
    studyDailyLimit: 2,
  },
  student: {
    monthlyAnalyses: 40,
    monthlyCredits: 2000,
    maxVideoDuration: 7200,       // 2h max
    chatQuestionsPerVideo: 15,
    chatDailyLimit: 50,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 10,
    webSearchMonthly: 10,
    historyDays: 90,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 5,
    studyMindmapDepth: 3,
    studyCanGenerateMore: false,
    studyDailyLimit: 5,
  },
  starter: {
    monthlyAnalyses: 60,
    monthlyCredits: 3000,
    maxVideoDuration: 7200,
    chatQuestionsPerVideo: 20,
    chatDailyLimit: 100,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 20,
    webSearchMonthly: 20,
    historyDays: 60,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 7,
    studyMindmapDepth: 3,
    studyCanGenerateMore: true,
    studyDailyLimit: 10,
  },
  pro: {
    monthlyAnalyses: 300,
    monthlyCredits: 15000,
    maxVideoDuration: 14400,      // 4h max
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    maxPlaylistVideos: 20,
    maxPlaylists: 10,
    maxExportsPerDay: -1,
    webSearchMonthly: 100,
    historyDays: 180,
    apiRequestsDaily: 0,
    teamMembers: 1,
    studyQuizQuestions: 10,
    studyMindmapDepth: 4,
    studyCanGenerateMore: true,
    studyDailyLimit: 50,
  },
  team: {
    monthlyAnalyses: 1000,
    monthlyCredits: 50000,
    maxVideoDuration: -1,
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    maxPlaylistVideos: 100,
    maxPlaylists: -1,
    maxExportsPerDay: -1,
    webSearchMonthly: -1,
    historyDays: -1,
    apiRequestsDaily: 1000,
    teamMembers: 5,
    studyQuizQuestions: 15,
    studyMindmapDepth: 5,
    studyCanGenerateMore: true,
    studyDailyLimit: -1,
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
    flashcards: false,
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
  },
  student: {
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
    bibtexExport: true,      // Student killer feature
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    exportWatermark: false,
    ttsAudio: true,
    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,
  },
  starter: {
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
    bibtexExport: false,
    exportPdf: true,
    exportMarkdown: false,
    exportTxt: true,
    exportWatermark: false,
    ttsAudio: false,
    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,
  },
  pro: {
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
  },
  team: {
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
    corpus: true,
    flashcards: true,
    conceptMaps: true,
    citationExport: true,
    bibtexExport: true,
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    exportWatermark: false,
    ttsAudio: true,
    apiAccess: true,
    prioritySupport: true,
    sharedWorkspace: true,
    slackIntegration: true,
    teamsIntegration: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PLAN INFO
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanInfo {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;  // in cents
  priceDisplay: { fr: string; en: string };
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

export const PLANS_INFO: PlanInfo[] = [
  {
    id: 'free',
    name: { fr: 'Gratuit', en: 'Free' },
    description: { fr: 'Pour découvrir', en: 'To discover' },
    price: 0,
    priceDisplay: { fr: '0€', en: 'Free' },
    color: '#6B7280',
    icon: 'flash-outline',
    gradient: ['#6B7280', '#4B5563'],
    order: 0,
    targetAudience: { fr: 'Curieux', en: 'Curious' },
    killerFeature: { fr: '3 analyses gratuites', en: '3 free analyses' },
  },
  {
    id: 'student',
    name: { fr: 'Étudiant', en: 'Student' },
    description: { fr: 'Pour réviser efficacement', en: 'For effective studying' },
    price: 299,
    priceDisplay: { fr: '2,99€/mois', en: '€2.99/mo' },
    badge: { fr: 'Étudiants', en: 'Students' },
    color: '#10B981',
    icon: 'school-outline',
    gradient: ['#10B981', '#059669'],
    order: 1,
    targetAudience: { fr: 'Étudiants & Apprenants', en: 'Students & Learners' },
    killerFeature: { fr: 'Flashcards & Cartes mentales', en: 'Flashcards & Mind maps' },
  },
  {
    id: 'starter',
    name: { fr: 'Starter', en: 'Starter' },
    description: { fr: 'Pour les utilisateurs réguliers', en: 'For regular users' },
    price: 599,
    priceDisplay: { fr: '5,99€/mois', en: '€5.99/mo' },
    color: '#3B82F6',
    icon: 'flash-outline',
    gradient: ['#3B82F6', '#2563EB'],
    order: 2,
    targetAudience: { fr: 'Particuliers', en: 'Individuals' },
    killerFeature: { fr: '60 analyses/mois', en: '60 analyses/month' },
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro' },
    description: { fr: 'Pour les créateurs & professionnels', en: 'For creators & professionals' },
    price: 1299,
    priceDisplay: { fr: '12,99€/mois', en: '€12.99/mo' },
    badge: { fr: 'Populaire', en: 'Popular' },
    popular: true,
    color: '#8B5CF6',
    icon: 'star-outline',
    gradient: ['#8B5CF6', '#7C3AED'],
    order: 3,
    targetAudience: { fr: 'Créateurs & Profs', en: 'Creators & Teachers' },
    killerFeature: { fr: 'Playlists (20 vidéos)', en: 'Playlists (20 videos)' },
  },
  {
    id: 'team',
    name: { fr: 'Équipe', en: 'Team' },
    description: { fr: 'Pour les entreprises & laboratoires', en: 'For businesses & labs' },
    price: 2999,
    priceDisplay: { fr: '29,99€/mois', en: '€29.99/mo' },
    badge: { fr: 'Entreprises', en: 'Business' },
    recommended: true,
    color: '#F59E0B',
    icon: 'people-outline',
    gradient: ['#F59E0B', '#D97706'],
    order: 4,
    targetAudience: { fr: 'Entreprises & Labos', en: 'Businesses & Labs' },
    killerFeature: { fr: 'API + 5 utilisateurs', en: 'API + 5 users' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION TRIGGERS
// ═══════════════════════════════════════════════════════════════════════════════

export const CONVERSION_TRIGGERS = {
  freeAnalysisWarning: 2,
  freeAnalysisLimit: 3,
  lowCreditsWarningPercent: 20,
  lowCreditsCriticalPercent: 5,
  showTimeSaved: true,
  showEquivalentPages: true,
  trialEnabled: true,
  trialDays: 7,
  trialPlan: 'pro' as PlanId,
  trialRequiresCard: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize a plan name to a valid PlanId
 */
export function normalizePlanId(plan: string | undefined): PlanId {
  if (!plan) return 'free';

  const normalized = plan.toLowerCase().trim();

  const planMapping: Record<string, PlanId> = {
    'free': 'free',
    'gratuit': 'free',
    'découverte': 'free',
    'decouverte': 'free',
    'discovery': 'free',
    'student': 'student',
    'étudiant': 'student',
    'etudiant': 'student',
    'starter': 'starter',
    'pro': 'pro',
    'team': 'team',
    'équipe': 'team',
    'equipe': 'team',
    'expert': 'team',
  };

  return planMapping[normalized] || 'free';
}

/**
 * Check if a plan has access to a feature
 */
export function hasFeature(plan: PlanId | string | undefined, feature: keyof PlanFeatures): boolean {
  const planId = normalizePlanId(plan as string);
  return PLAN_FEATURES[planId]?.[feature] ?? false;
}

/**
 * Get a limit for a plan
 */
export function getLimit(plan: PlanId | string | undefined, limit: keyof PlanLimits): number {
  const planId = normalizePlanId(plan as string);
  return PLAN_LIMITS[planId]?.[limit] ?? 0;
}

/**
 * Check if a limit is unlimited (-1)
 */
export function isUnlimited(plan: PlanId | string | undefined, limit: keyof PlanLimits): boolean {
  return getLimit(plan, limit) === -1;
}

/**
 * Get plan info
 */
export function getPlanInfo(plan: PlanId | string | undefined): PlanInfo {
  const planId = normalizePlanId(plan as string);
  return PLANS_INFO.find(p => p.id === planId) || PLANS_INFO[0];
}

/**
 * Compare two plans (returns -1, 0, or 1)
 */
export function comparePlans(plan1: PlanId | string, plan2: PlanId | string): number {
  const order1 = getPlanInfo(plan1).order;
  const order2 = getPlanInfo(plan2).order;
  return order1 - order2;
}

/**
 * Check if a plan is higher than another
 */
export function isPlanHigher(currentPlan: PlanId | string, targetPlan: PlanId | string): boolean {
  return comparePlans(targetPlan, currentPlan) > 0;
}

/**
 * Get minimum plan required for a feature
 */
export function getMinPlanForFeature(feature: keyof PlanFeatures): PlanId {
  const planOrder: PlanId[] = ['free', 'student', 'starter', 'pro', 'team'];
  for (const plan of planOrder) {
    if (PLAN_FEATURES[plan][feature]) {
      return plan;
    }
  }
  return 'team';
}

/**
 * Check if user should see low credits alert
 */
export function shouldShowLowCreditsAlert(
  currentCredits: number,
  maxCredits: number
): 'none' | 'warning' | 'critical' {
  if (maxCredits <= 0) return 'none';
  const percent = (currentCredits / maxCredits) * 100;
  if (percent <= CONVERSION_TRIGGERS.lowCreditsCriticalPercent) return 'critical';
  if (percent <= CONVERSION_TRIGGERS.lowCreditsWarningPercent) return 'warning';
  return 'none';
}

/**
 * Check if free user should see upgrade prompt
 */
export function shouldShowUpgradePrompt(
  plan: PlanId | string,
  analysesUsed: number
): 'none' | 'warning' | 'blocked' {
  const planId = normalizePlanId(plan as string);
  if (planId !== 'free') return 'none';
  if (analysesUsed >= CONVERSION_TRIGGERS.freeAnalysisLimit) return 'blocked';
  if (analysesUsed >= CONVERSION_TRIGGERS.freeAnalysisWarning) return 'warning';
  return 'none';
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
    equivalent: pagesEquivalent > 0 ? `${pagesEquivalent} pages` : '1 page',
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
 * Get feature list for display (used in upgrade screens)
 */
export function getFeatureListForDisplay(plan: PlanId, language: 'fr' | 'en'): Array<{
  text: string;
  included: boolean;
  highlight?: boolean;
}> {
  const features = PLAN_FEATURES[plan];
  const limits = PLAN_LIMITS[plan];

  const analysesText = limits.monthlyAnalyses === -1
    ? (language === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses')
    : (language === 'fr' ? `${limits.monthlyAnalyses} analyses/mois` : `${limits.monthlyAnalyses} analyses/month`);

  const chatText = limits.chatQuestionsPerVideo === -1
    ? (language === 'fr' ? 'Chat illimité' : 'Unlimited chat')
    : (language === 'fr' ? `Chat (${limits.chatQuestionsPerVideo} questions/vidéo)` : `Chat (${limits.chatQuestionsPerVideo} questions/video)`);

  const webSearchText = limits.webSearchMonthly === 0
    ? (language === 'fr' ? 'Recherche web' : 'Web search')
    : limits.webSearchMonthly === -1
    ? (language === 'fr' ? 'Recherche web illimitée' : 'Unlimited web search')
    : (language === 'fr' ? `Recherche web (${limits.webSearchMonthly}/mois)` : `Web search (${limits.webSearchMonthly}/mo)`);

  const playlistText = limits.maxPlaylistVideos === 0
    ? (language === 'fr' ? 'Playlists' : 'Playlists')
    : (language === 'fr' ? `Playlists (${limits.maxPlaylistVideos} vidéos)` : `Playlists (${limits.maxPlaylistVideos} videos)`);

  return [
    { text: analysesText, included: true, highlight: limits.monthlyAnalyses === -1 },
    { text: chatText, included: features.chatBasic },
    { text: webSearchText, included: features.chatWebSearch, highlight: features.chatWebSearch },
    { text: language === 'fr' ? 'Flashcards & Cartes mentales' : 'Flashcards & Mind maps', included: features.flashcards, highlight: features.flashcards && plan === 'student' },
    { text: playlistText, included: features.playlists, highlight: features.playlists },
    { text: language === 'fr' ? 'Export PDF' : 'PDF export', included: features.exportPdf },
    { text: language === 'fr' ? 'Export Markdown' : 'Markdown export', included: features.exportMarkdown },
    { text: language === 'fr' ? 'Export BibTeX' : 'BibTeX export', included: features.bibtexExport },
    { text: language === 'fr' ? 'Lecture audio TTS' : 'TTS audio playback', included: features.ttsAudio },
    { text: language === 'fr' ? 'Accès API' : 'API access', included: features.apiAccess, highlight: features.apiAccess },
    { text: language === 'fr' ? `${limits.teamMembers} utilisateur${limits.teamMembers > 1 ? 's' : ''}` : `${limits.teamMembers} user${limits.teamMembers > 1 ? 's' : ''}`, included: limits.teamMembers > 1, highlight: limits.teamMembers > 1 },
  ].filter(f => f.included || plan !== 'free');
}

export default {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  comparePlans,
  isPlanHigher,
  getMinPlanForFeature,
  getFeatureListForDisplay,
  normalizePlanId,
  shouldShowLowCreditsAlert,
  shouldShowUpgradePrompt,
  calculateTimeSaved,
  getStudyToolsLimits,
};
