/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎯 PLAN PRIVILEGES — v4.0 NOUVELLE STRATÉGIE DE MONÉTISATION                      ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 *
 * 🎯 STRATÉGIE DE CONVERSION:
 * - Free: Maximum friction (3 analyses, 3 jours historique)
 * - Étudiant: Prix attractif 2.99€, focus outils d'étude
 * - Starter: Équilibré pour particuliers 5.99€
 * - Pro: Créateurs & professionnels 12.99€ (POPULAIRE)
 * - Équipe: Entreprises & laboratoires 29.99€
 *
 * ⚠️ SYNCHRONISÉ AVEC: backend/src/core/config.py
 */

export type PlanId = 'free' | 'student' | 'starter' | 'pro' | 'team';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 LIMITES PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  // Analyses
  monthlyAnalyses: number;        // -1 = illimité
  monthlyCredits: number;
  maxVideoDuration: number;       // en secondes, -1 = illimité

  // Chat
  chatQuestionsPerVideo: number;  // -1 = illimité
  chatDailyLimit: number;         // -1 = illimité

  // Playlists
  maxPlaylistVideos: number;      // 0 = désactivé
  maxPlaylists: number;           // 0 = désactivé, -1 = illimité

  // Export
  maxExportsPerDay: number;       // 0 = désactivé, -1 = illimité

  // Web Search
  webSearchMonthly: number;       // 0 = désactivé, -1 = illimité

  // Historique
  historyDays: number;            // -1 = illimité

  // API
  apiRequestsDaily: number;       // 0 = désactivé, -1 = illimité

  // Équipe
  teamMembers: number;            // 1 = solo, -1 = illimité

  // 📚 Outils d'étude (Quiz & Mindmaps)
  studyQuizQuestions: number;     // Max questions par quiz
  studyMindmapDepth: number;      // Max profondeur mindmap
  studyCanGenerateMore: boolean;  // Peut générer des questions supplémentaires
  studyDailyLimit: number;        // Générations par jour, -1 = illimité

  // 🎓 Sources académiques
  academicPapersPerAnalysis: number;  // Max papers per analysis
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🆓 FREE — Maximum friction pour conversion
  // ═══════════════════════════════════════════════════════════════════════════
  free: {
    monthlyAnalyses: 3,           // Seulement 3 analyses !
    monthlyCredits: 150,
    maxVideoDuration: 600,        // 10 min max
    chatQuestionsPerVideo: 3,
    chatDailyLimit: 10,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 0,
    webSearchMonthly: 0,
    historyDays: 3,               // Seulement 3 jours !
    apiRequestsDaily: 0,
    teamMembers: 1,
    // Outils d'étude
    studyQuizQuestions: 3,
    studyMindmapDepth: 2,
    studyCanGenerateMore: false,
    studyDailyLimit: 2,
    // Sources académiques
    academicPapersPerAnalysis: 3,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎓 ÉTUDIANT — 2.99€/mois - Focus apprentissage
  // ═══════════════════════════════════════════════════════════════════════════
  student: {
    monthlyAnalyses: 40,
    monthlyCredits: 2000,
    maxVideoDuration: 7200,       // 2h max
    chatQuestionsPerVideo: 15,
    chatDailyLimit: 50,
    maxPlaylistVideos: 0,         // Pas de playlists (différenciateur Pro)
    maxPlaylists: 0,
    maxExportsPerDay: 10,
    webSearchMonthly: 10,
    historyDays: 90,              // 3 mois
    apiRequestsDaily: 0,
    teamMembers: 1,
    // Outils d'étude - KILLER FEATURE
    studyQuizQuestions: 5,
    studyMindmapDepth: 3,
    studyCanGenerateMore: false,
    studyDailyLimit: 5,
    // Sources académiques
    academicPapersPerAnalysis: 10,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ STARTER — 5.99€/mois - Particuliers
  // ═══════════════════════════════════════════════════════════════════════════
  starter: {
    monthlyAnalyses: 60,
    monthlyCredits: 3000,
    maxVideoDuration: 7200,       // 2h max
    chatQuestionsPerVideo: 20,
    chatDailyLimit: 100,
    maxPlaylistVideos: 0,         // Pas de playlists (différenciateur Pro)
    maxPlaylists: 0,
    maxExportsPerDay: 20,
    webSearchMonthly: 20,
    historyDays: 60,
    apiRequestsDaily: 0,
    teamMembers: 1,
    // Outils d'étude
    studyQuizQuestions: 7,
    studyMindmapDepth: 3,
    studyCanGenerateMore: true,   // ⭐ Peut générer plus de questions
    studyDailyLimit: 10,
    // Sources académiques
    academicPapersPerAnalysis: 15,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ PRO — 12.99€/mois - Créateurs & Professionnels (POPULAIRE)
  // ═══════════════════════════════════════════════════════════════════════════
  pro: {
    monthlyAnalyses: 300,
    monthlyCredits: 15000,
    maxVideoDuration: 14400,      // 4h max
    chatQuestionsPerVideo: -1,    // Illimité
    chatDailyLimit: -1,           // Illimité
    maxPlaylistVideos: 20,        // ⭐ Playlists activées
    maxPlaylists: 10,
    maxExportsPerDay: -1,         // Illimité
    webSearchMonthly: 100,
    historyDays: 180,             // 6 mois
    apiRequestsDaily: 0,          // Pas d'API (différenciateur Équipe)
    teamMembers: 1,
    // Outils d'étude
    studyQuizQuestions: 10,
    studyMindmapDepth: 4,
    studyCanGenerateMore: true,
    studyDailyLimit: 50,
    // Sources académiques
    academicPapersPerAnalysis: 30,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 👥 ÉQUIPE — 29.99€/mois - Entreprises & Laboratoires
  // ═══════════════════════════════════════════════════════════════════════════
  team: {
    monthlyAnalyses: 1000,
    monthlyCredits: 50000,
    maxVideoDuration: -1,         // Illimité
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    maxPlaylistVideos: 100,
    maxPlaylists: -1,             // Illimité
    maxExportsPerDay: -1,
    webSearchMonthly: -1,         // Illimité
    historyDays: -1,              // Illimité
    apiRequestsDaily: 1000,       // ⭐ API activée
    teamMembers: 5,               // ⭐ Multi-utilisateurs
    // Outils d'étude - ILLIMITÉ
    studyQuizQuestions: 15,
    studyMindmapDepth: 5,
    studyCanGenerateMore: true,
    studyDailyLimit: -1,          // Illimité
    // Sources académiques
    academicPapersPerAnalysis: 50,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ FONCTIONNALITÉS PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanFeatures {
  // Résumés
  summaryExpress: boolean;
  summaryDetailed: boolean;
  summaryTimestamps: boolean;
  summaryConcepts: boolean;

  // Chat
  chatBasic: boolean;
  chatWebSearch: boolean;
  chatSuggestedQuestions: boolean;

  // Fact-checking
  factCheckBasic: boolean;
  factCheckAdvanced: boolean;

  // Recherche
  intelligentSearch: boolean;

  // Playlists & Corpus
  playlists: boolean;
  corpus: boolean;

  // Outils d'étude (⭐ KILLER FEATURE Étudiant)
  flashcards: boolean;
  conceptMaps: boolean;
  citationExport: boolean;
  bibtexExport: boolean;

  // Export
  exportPdf: boolean;
  exportMarkdown: boolean;
  exportTxt: boolean;
  exportWatermark: boolean;  // true = watermark ajouté

  // Audio
  ttsAudio: boolean;

  // Avancé
  apiAccess: boolean;
  prioritySupport: boolean;
  sharedWorkspace: boolean;
  slackIntegration: boolean;
  teamsIntegration: boolean;

  // 🎓 Sources académiques
  academicSearch: boolean;
  bibliographyExport: boolean;
  academicFullText: boolean;
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // 🆓 FREE — Minimum pour tester
  // ═══════════════════════════════════════════════════════════════════════════
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
    exportWatermark: true,  // Watermark sur exports

    ttsAudio: false,

    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,

    // Sources académiques
    academicSearch: true,
    bibliographyExport: false,
    academicFullText: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎓 ÉTUDIANT — Focus outils d'apprentissage
  // ═══════════════════════════════════════════════════════════════════════════
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

    playlists: false,           // Différenciateur Pro
    corpus: false,

    // ⭐ KILLER FEATURES ÉTUDIANT
    flashcards: true,
    conceptMaps: true,
    citationExport: true,
    bibtexExport: true,

    exportPdf: true,
    exportMarkdown: true,       // Pour Notion/Obsidian
    exportTxt: true,
    exportWatermark: false,

    ttsAudio: true,             // Pour réviser en écoutant

    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,

    // Sources académiques - KILLER FEATURE ÉTUDIANT
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ STARTER — Pour les particuliers
  // ═══════════════════════════════════════════════════════════════════════════
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

    playlists: false,           // Différenciateur Pro
    corpus: false,

    flashcards: true,
    conceptMaps: true,
    citationExport: true,
    bibtexExport: false,        // Différenciateur Étudiant

    exportPdf: true,
    exportMarkdown: false,      // Différenciateur Pro
    exportTxt: true,
    exportWatermark: false,

    ttsAudio: false,            // Différenciateur Pro

    apiAccess: false,
    prioritySupport: false,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,

    // Sources académiques
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ PRO — Pour créateurs et professionnels
  // ═══════════════════════════════════════════════════════════════════════════
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

    // ⭐ PLAYLISTS ACTIVÉES
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

    apiAccess: false,           // Différenciateur Équipe
    prioritySupport: true,
    sharedWorkspace: false,
    slackIntegration: false,
    teamsIntegration: false,

    // Sources académiques - Accès texte complet
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 👥 ÉQUIPE — Pour entreprises et laboratoires
  // ═══════════════════════════════════════════════════════════════════════════
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

    // ⭐ FEATURES ÉQUIPE
    apiAccess: true,
    prioritySupport: true,
    sharedWorkspace: true,
    slackIntegration: true,
    teamsIntegration: true,

    // Sources académiques - Accès complet
    academicSearch: true,
    bibliographyExport: true,
    academicFullText: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 PRIX ET INFORMATIONS DES PLANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanInfo {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;  // en centimes
  priceDisplay: { fr: string; en: string };
  badge?: { fr: string; en: string };
  popular?: boolean;
  recommended?: boolean;
  color: string;
  icon: string;
  gradient: string;
  order: number;
  // Pour la conversion
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
    icon: 'Zap',
    gradient: 'from-gray-500 to-gray-600',
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
    badge: { fr: '🎓 Étudiants', en: '🎓 Students' },
    color: '#10B981',
    icon: 'GraduationCap',
    gradient: 'from-emerald-500 to-green-600',
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
    icon: 'Zap',
    gradient: 'from-blue-500 to-blue-600',
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
    badge: { fr: '⭐ Populaire', en: '⭐ Popular' },
    popular: true,
    color: '#8B5CF6',
    icon: 'Crown',
    gradient: 'from-violet-500 to-purple-600',
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
    badge: { fr: '🏢 Entreprises', en: '🏢 Business' },
    recommended: true,
    color: '#F59E0B',
    icon: 'Users',
    gradient: 'from-amber-500 to-orange-500',
    order: 4,
    targetAudience: { fr: 'Entreprises & Labos', en: 'Businesses & Labs' },
    killerFeature: { fr: 'API + 5 utilisateurs', en: 'API + 5 users' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 TRIGGERS DE CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

export const CONVERSION_TRIGGERS = {
  // Pop-up après X analyses gratuites
  freeAnalysisWarning: 2,      // Avertissement à 2 analyses
  freeAnalysisLimit: 3,        // Blocage à 3 analyses

  // Pop-up quand crédits bas
  lowCreditsWarningPercent: 20,
  lowCreditsCriticalPercent: 5,

  // Valeur affichée après analyse
  showTimeSaved: true,
  showEquivalentPages: true,

  // Essai gratuit
  trialEnabled: true,
  trialDays: 7,
  trialPlan: 'pro' as PlanId,
  trialRequiresCard: false,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💬 TÉMOIGNAGES PAR PERSONA
// ═══════════════════════════════════════════════════════════════════════════════

export interface Testimonial {
  text: { fr: string; en: string };
  author: string;
  role: { fr: string; en: string };
  avatar: string;
  plan: PlanId;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    text: {
      fr: "En tant qu'étudiant en médecine, Deep Sight m'a fait gagner 10h/semaine sur mes révisions. Les fiches automatiques sont incroyables !",
      en: "As a medical student, Deep Sight saves me 10h/week on revision. The automatic flashcards are incredible!"
    },
    author: "Marie L.",
    role: { fr: "L3 Médecine", en: "Medical Student" },
    avatar: "🎓",
    plan: 'student'
  },
  {
    text: {
      fr: "Les cartes mentales automatiques ont transformé ma façon de prendre des notes. Je recommande à tous les étudiants !",
      en: "The automatic mind maps have transformed how I take notes. I recommend it to all students!"
    },
    author: "Lucas D.",
    role: { fr: "Prépa HEC", en: "Business School Prep" },
    avatar: "📚",
    plan: 'student'
  },
  {
    text: {
      fr: "J'analyse les vidéos de mes concurrents en 2 min au lieu de 2h. Indispensable pour ma veille !",
      en: "I analyze competitor videos in 2 min instead of 2h. Essential for my research!"
    },
    author: "Thomas B.",
    role: { fr: "YouTuber, 150k abonnés", en: "YouTuber, 150k subscribers" },
    avatar: "🎬",
    plan: 'pro'
  },
  {
    text: {
      fr: "L'API m'a permis d'intégrer l'analyse vidéo dans notre workflow de formation. ROI immédiat.",
      en: "The API let me integrate video analysis into our training workflow. Immediate ROI."
    },
    author: "Sophie M.",
    role: { fr: "Responsable Formation, CAC 40", en: "Training Manager, Fortune 500" },
    avatar: "💼",
    plan: 'team'
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalise un nom de plan vers un PlanId valide
 */
export function normalizePlanId(plan: string | undefined): PlanId {
  if (!plan) return 'free';

  const normalized = plan.toLowerCase().trim();

  // Mapping des anciens plans vers les nouveaux
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
    'expert': 'team',  // Expert → Team
  };

  return planMapping[normalized] || 'free';
}

/**
 * Vérifie si un plan a accès à une fonctionnalité
 */
export function hasFeature(plan: PlanId | string | undefined, feature: keyof PlanFeatures): boolean {
  const planId = normalizePlanId(plan as string);
  return PLAN_FEATURES[planId]?.[feature] ?? false;
}

/**
 * Obtient une limite pour un plan
 */
export function getLimit(plan: PlanId | string | undefined, limit: keyof PlanLimits): number {
  const planId = normalizePlanId(plan as string);
  return PLAN_LIMITS[planId]?.[limit] ?? 0;
}

/**
 * Vérifie si une limite est illimitée (-1)
 */
export function isUnlimited(plan: PlanId | string | undefined, limit: keyof PlanLimits): boolean {
  return getLimit(plan, limit) === -1;
}

/**
 * Obtient les infos d'un plan
 */
export function getPlanInfo(plan: PlanId | string | undefined): PlanInfo {
  const planId = normalizePlanId(plan as string);
  return PLANS_INFO.find(p => p.id === planId) || PLANS_INFO[0];
}

/**
 * Compare deux plans (retourne -1, 0, ou 1)
 */
export function comparePlans(plan1: PlanId | string, plan2: PlanId | string): number {
  const order1 = getPlanInfo(plan1).order;
  const order2 = getPlanInfo(plan2).order;
  return order1 - order2;
}

/**
 * Vérifie si un plan est supérieur à un autre
 */
export function isPlanHigher(currentPlan: PlanId | string, targetPlan: PlanId | string): boolean {
  return comparePlans(targetPlan, currentPlan) > 0;
}

/**
 * Obtient le plan minimum requis pour une fonctionnalité
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
 * Vérifie si l'utilisateur doit voir une alerte de crédits bas
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
 * Vérifie si l'utilisateur free a atteint la limite d'analyses
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
 * Calcule le temps économisé par l'analyse (pour affichage)
 */
export function calculateTimeSaved(videoDurationSeconds: number): {
  minutes: number;
  equivalent: string;
} {
  // On estime que l'utilisateur économise ~80% du temps de visionnage
  const minutesSaved = Math.round((videoDurationSeconds * 0.8) / 60);
  const pagesEquivalent = Math.round(videoDurationSeconds / 180); // ~3 min de vidéo = 1 page de notes

  return {
    minutes: minutesSaved,
    equivalent: pagesEquivalent > 0 ? `${pagesEquivalent} pages` : '1 page',
  };
}

/**
 * Obtient les limites des outils d'étude pour un plan
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
 * Génère la liste des fonctionnalités pour l'affichage
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
    { text: language === 'fr' ? 'Lecture audio TTS' : 'TTS audio playback', included: features.ttsAudio },
    { text: language === 'fr' ? 'Accès API' : 'API access', included: features.apiAccess, highlight: features.apiAccess },
    { text: language === 'fr' ? `${limits.teamMembers} utilisateur${limits.teamMembers > 1 ? 's' : ''}` : `${limits.teamMembers} user${limits.teamMembers > 1 ? 's' : ''}`, included: limits.teamMembers > 1, highlight: limits.teamMembers > 1 },
  ].filter(f => f.included || plan !== 'free');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  TESTIMONIALS,
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
