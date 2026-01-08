/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🎯 PLAN PRIVILEGES — Configuration centralisée des privilèges par plan            ║
 * ║  v2.0 — Système robuste et cohérent                                                ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 * 
 * Ce fichier est LA SOURCE DE VÉRITÉ pour tous les privilèges.
 * Toute modification des fonctionnalités doit être faite ICI.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'expert';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 LIMITES PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanLimits {
  // Analyses
  monthlyAnalyses: number;        // -1 = illimité
  
  // Chat
  chatQuestionsPerVideo: number;  // -1 = illimité
  chatDailyLimit: number;         // -1 = illimité
  
  // Playlists
  maxPlaylistVideos: number;      // 0 = désactivé
  maxPlaylists: number;           // 0 = désactivé
  
  // Export
  maxExportsPerDay: number;       // 0 = désactivé, -1 = illimité
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    monthlyAnalyses: 5,
    chatQuestionsPerVideo: 5,
    chatDailyLimit: 10,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 0,
  },
  starter: {
    monthlyAnalyses: 50,
    chatQuestionsPerVideo: 20,
    chatDailyLimit: 50,
    maxPlaylistVideos: 0,
    maxPlaylists: 0,
    maxExportsPerDay: 10,
  },
  pro: {
    monthlyAnalyses: 200,
    chatQuestionsPerVideo: -1,  // Illimité
    chatDailyLimit: -1,         // Illimité
    maxPlaylistVideos: 10,
    maxPlaylists: 20,
    maxExportsPerDay: -1,       // Illimité
  },
  expert: {
    monthlyAnalyses: -1,        // Illimité
    chatQuestionsPerVideo: -1,
    chatDailyLimit: -1,
    maxPlaylistVideos: 50,
    maxPlaylists: -1,           // Illimité
    maxExportsPerDay: -1,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ FONCTIONNALITÉS PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanFeatures {
  // Résumés
  summaryExpress: boolean;        // Synthèse express (30s)
  summaryDetailed: boolean;       // Analyse détaillée
  summaryTimestamps: boolean;     // Timestamps cliquables
  summaryConcepts: boolean;       // Glossaire des concepts
  
  // Chat
  chatBasic: boolean;             // Chat basique
  chatWebSearch: boolean;         // Recherche web dans le chat
  chatSuggestedQuestions: boolean; // Questions suggérées
  
  // Fact-checking
  factCheckBasic: boolean;        // Fact-check basique
  factCheckAdvanced: boolean;     // Fact-check avancé (Perplexity)
  
  // Recherche
  intelligentSearch: boolean;     // Recherche intelligente de vidéos
  
  // Playlists & Corpus
  playlists: boolean;             // Analyse de playlists
  corpus: boolean;                // Corpus personnalisés
  
  // Export
  exportPdf: boolean;
  exportMarkdown: boolean;
  exportTxt: boolean;
  
  // Audio
  ttsAudio: boolean;              // Lecture audio TTS
  
  // Avancé
  apiAccess: boolean;             // Accès API
  prioritySupport: boolean;       // Support prioritaire
  dedicatedSupport: boolean;      // Support dédié
  training: boolean;              // Formation incluse
}

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  free: {
    // Résumés
    summaryExpress: true,
    summaryDetailed: false,
    summaryTimestamps: true,
    summaryConcepts: false,
    
    // Chat
    chatBasic: true,
    chatWebSearch: false,
    chatSuggestedQuestions: false,
    
    // Fact-checking
    factCheckBasic: false,
    factCheckAdvanced: false,
    
    // Recherche
    intelligentSearch: false,
    
    // Playlists
    playlists: false,
    corpus: false,
    
    // Export
    exportPdf: false,
    exportMarkdown: false,
    exportTxt: false,
    
    // Audio
    ttsAudio: false,
    
    // Avancé
    apiAccess: false,
    prioritySupport: false,
    dedicatedSupport: false,
    training: false,
  },
  
  starter: {
    // Résumés
    summaryExpress: true,
    summaryDetailed: true,
    summaryTimestamps: true,
    summaryConcepts: true,
    
    // Chat
    chatBasic: true,
    chatWebSearch: false,
    chatSuggestedQuestions: true,
    
    // Fact-checking
    factCheckBasic: true,
    factCheckAdvanced: false,
    
    // Recherche
    intelligentSearch: true,
    
    // Playlists
    playlists: false,
    corpus: false,
    
    // Export
    exportPdf: true,
    exportMarkdown: false,
    exportTxt: false,
    
    // Audio
    ttsAudio: false,
    
    // Avancé
    apiAccess: false,
    prioritySupport: false,
    dedicatedSupport: false,
    training: false,
  },
  
  pro: {
    // Résumés
    summaryExpress: true,
    summaryDetailed: true,
    summaryTimestamps: true,
    summaryConcepts: true,
    
    // Chat
    chatBasic: true,
    chatWebSearch: true,
    chatSuggestedQuestions: true,
    
    // Fact-checking
    factCheckBasic: true,
    factCheckAdvanced: true,
    
    // Recherche
    intelligentSearch: true,
    
    // Playlists
    playlists: true,
    corpus: false,
    
    // Export
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    
    // Audio
    ttsAudio: true,
    
    // Avancé
    apiAccess: false,
    prioritySupport: true,
    dedicatedSupport: false,
    training: false,
  },
  
  expert: {
    // Résumés
    summaryExpress: true,
    summaryDetailed: true,
    summaryTimestamps: true,
    summaryConcepts: true,
    
    // Chat
    chatBasic: true,
    chatWebSearch: true,
    chatSuggestedQuestions: true,
    
    // Fact-checking
    factCheckBasic: true,
    factCheckAdvanced: true,
    
    // Recherche
    intelligentSearch: true,
    
    // Playlists
    playlists: true,
    corpus: true,
    
    // Export
    exportPdf: true,
    exportMarkdown: true,
    exportTxt: true,
    
    // Audio
    ttsAudio: true,
    
    // Avancé
    apiAccess: true,
    prioritySupport: true,
    dedicatedSupport: true,
    training: true,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 💰 PRIX ET INFORMATIONS DES PLANS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlanInfo {
  id: PlanId;
  name: { fr: string; en: string };
  description: { fr: string; en: string };
  price: number;  // en centimes (0 = gratuit)
  priceDisplay: { fr: string; en: string };
  badge?: { fr: string; en: string };
  popular?: boolean;
  order: number;  // Pour le tri
}

export const PLANS_INFO: PlanInfo[] = [
  {
    id: 'free',
    name: { fr: 'Découverte', en: 'Discovery' },
    description: { fr: 'Pour explorer', en: 'To explore' },
    price: 0,
    priceDisplay: { fr: '0 €/mois', en: '€0/month' },
    order: 0,
  },
  {
    id: 'starter',
    name: { fr: 'Starter', en: 'Starter' },
    description: { fr: 'Pour les réguliers', en: 'For regular users' },
    price: 499,
    priceDisplay: { fr: '4,99 €/mois', en: '€4.99/month' },
    order: 1,
  },
  {
    id: 'pro',
    name: { fr: 'Pro', en: 'Pro' },
    description: { fr: 'Pour les power users', en: 'For power users' },
    price: 999,
    priceDisplay: { fr: '9,99 €/mois', en: '€9.99/month' },
    badge: { fr: 'Recommandé', en: 'Recommended' },
    popular: true,
    order: 2,
  },
  {
    id: 'expert',
    name: { fr: 'Expert', en: 'Expert' },
    description: { fr: 'Pour les organisations', en: 'For organizations' },
    price: 1499,
    priceDisplay: { fr: '14,99 €/mois', en: '€14.99/month' },
    order: 3,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 FONCTIONS UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si un plan a accès à une fonctionnalité
 */
export function hasFeature(plan: PlanId | string | undefined, feature: keyof PlanFeatures): boolean {
  const planId = (plan || 'free').toLowerCase() as PlanId;
  return PLAN_FEATURES[planId]?.[feature] ?? false;
}

/**
 * Obtient une limite pour un plan
 */
export function getLimit(plan: PlanId | string | undefined, limit: keyof PlanLimits): number {
  const planId = (plan || 'free').toLowerCase() as PlanId;
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
  const planId = (plan || 'free').toLowerCase() as PlanId;
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
  const planOrder: PlanId[] = ['free', 'starter', 'pro', 'expert'];
  for (const plan of planOrder) {
    if (PLAN_FEATURES[plan][feature]) {
      return plan;
    }
  }
  return 'expert'; // Si aucun plan ne l'a, c'est expert
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
  
  return [
    { 
      text: analysesText, 
      included: true,
      highlight: limits.monthlyAnalyses === -1 
    },
    { 
      text: language === 'fr' ? 'Résumés structurés' : 'Structured summaries', 
      included: features.summaryExpress 
    },
    { 
      text: language === 'fr' ? 'Analyse détaillée' : 'Detailed analysis', 
      included: features.summaryDetailed 
    },
    { 
      text: chatText, 
      included: features.chatBasic 
    },
    { 
      text: language === 'fr' ? 'Recherche web (chat)' : 'Web search (chat)', 
      included: features.chatWebSearch,
      highlight: features.chatWebSearch
    },
    { 
      text: language === 'fr' ? 'Fact-checking' : 'Fact-checking', 
      included: features.factCheckBasic 
    },
    { 
      text: language === 'fr' ? 'Fact-checking avancé' : 'Advanced fact-checking', 
      included: features.factCheckAdvanced,
      highlight: features.factCheckAdvanced
    },
    { 
      text: language === 'fr' ? 'Recherche intelligente' : 'Intelligent search', 
      included: features.intelligentSearch 
    },
    { 
      text: language === 'fr' ? 'Playlists & corpus' : 'Playlists & corpus', 
      included: features.playlists,
      highlight: features.playlists
    },
    { 
      text: language === 'fr' ? 'Export PDF' : 'PDF export', 
      included: features.exportPdf 
    },
    { 
      text: language === 'fr' ? 'Export Markdown & TXT' : 'Markdown & TXT export', 
      included: features.exportMarkdown 
    },
    { 
      text: language === 'fr' ? 'Lecture audio TTS' : 'TTS audio playback', 
      included: features.ttsAudio 
    },
    { 
      text: language === 'fr' ? 'Accès API' : 'API access', 
      included: features.apiAccess,
      highlight: features.apiAccess
    },
    { 
      text: language === 'fr' ? 'Support prioritaire' : 'Priority support', 
      included: features.prioritySupport 
    },
    { 
      text: language === 'fr' ? 'Support dédié' : 'Dedicated support', 
      included: features.dedicatedSupport 
    },
  ].filter(f => f.included || plan !== 'free'); // Pour free, ne montrer que ce qui est inclus
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 EXPORT PAR DÉFAUT
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  PLAN_LIMITS,
  PLAN_FEATURES,
  PLANS_INFO,
  hasFeature,
  getLimit,
  isUnlimited,
  getPlanInfo,
  comparePlans,
  isPlanHigher,
  getMinPlanForFeature,
  getFeatureListForDisplay,
};
