/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  💎 UPGRADE PAGE v4.0 — NOUVELLE STRATÉGIE DE MONÉTISATION                         ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 *
 * 🎯 Plans:
 * - Gratuit (0€): Maximum friction
 * - Étudiant (2.99€): Focus outils d'étude
 * - Starter (5.99€): Particuliers
 * - Pro (12.99€): Créateurs & Professionnels (POPULAIRE)
 * - Équipe (29.99€): Entreprises & Laboratoires
 */

import React, { useState, useEffect } from 'react';

import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import {
  Check, X, Sparkles, Zap, Crown,
  ArrowUp, ArrowDown, AlertCircle, RefreshCw,
  BookOpen, ChevronDown, ChevronUp, Key,
  Infinity, ListVideo, Headphones, GraduationCap,
  Gift, Clock, Shield, Users, Brain, FileText,
  Star, Lightbulb, TrendingUp
} from 'lucide-react';
import { DeepSightSpinnerMicro } from '../components/ui';
import { billingApi } from '../services/api';
import { SEO } from '../components/SEO';
import {
  PLANS_INFO,
  PLAN_LIMITS,
  PLAN_FEATURES,
  TESTIMONIALS,
  normalizePlanId,
  type PlanId,
} from '../config/planPrivileges';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ICÔNES PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

const getPlanIcon = (planId: PlanId) => {
  switch (planId) {
    case 'free': return Zap;
    case 'student': return GraduationCap;
    case 'starter': return Star;
    case 'pro': return Crown;
    case 'team': return Users;
    default: return Zap;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 MATRICE DE COMPARAISON
// ═══════════════════════════════════════════════════════════════════════════════

interface ComparisonRow {
  category: string;
  feature: { fr: string; en: string };
  free: string | boolean;
  student: string | boolean;
  starter: string | boolean;
  pro: string | boolean;
  team: string | boolean;
  highlight?: PlanId;
}

const COMPARISON_MATRIX: ComparisonRow[] = [
  // Limites
  { category: '📊 Limites', feature: { fr: 'Analyses/mois', en: 'Analyses/month' }, free: '3', student: '40', starter: '60', pro: '300', team: '1000', highlight: 'team' },
  { category: '📊 Limites', feature: { fr: 'Durée max vidéo', en: 'Max video length' }, free: '10 min', student: '2h', starter: '2h', pro: '4h', team: '∞', highlight: 'team' },
  { category: '📊 Limites', feature: { fr: 'Questions chat/vidéo', en: 'Chat questions/video' }, free: '3', student: '15', starter: '20', pro: '∞', team: '∞' },
  { category: '📊 Limites', feature: { fr: 'Historique', en: 'History' }, free: '3 jours', student: '90 jours', starter: '60 jours', pro: '180 jours', team: '∞', highlight: 'team' },

  // Outils d'étude
  { category: '🎓 Outils d\'étude', feature: { fr: 'Flashcards automatiques', en: 'Auto flashcards' }, free: false, student: true, starter: true, pro: true, team: true, highlight: 'student' },
  { category: '🎓 Outils d\'étude', feature: { fr: 'Cartes mentales', en: 'Mind maps' }, free: false, student: true, starter: true, pro: true, team: true, highlight: 'student' },
  { category: '🎓 Outils d\'étude', feature: { fr: 'Citations académiques', en: 'Academic citations' }, free: false, student: true, starter: true, pro: true, team: true, highlight: 'student' },
  { category: '🎓 Outils d\'étude', feature: { fr: 'Export BibTeX', en: 'BibTeX export' }, free: false, student: true, starter: false, pro: true, team: true, highlight: 'student' },

  // Chat & Recherche
  { category: '💬 Chat & Recherche', feature: { fr: 'Chat IA', en: 'AI Chat' }, free: true, student: true, starter: true, pro: true, team: true },
  { category: '💬 Chat & Recherche', feature: { fr: 'Questions suggérées', en: 'Suggested questions' }, free: false, student: true, starter: true, pro: true, team: true },
  { category: '💬 Chat & Recherche', feature: { fr: 'Recherche web (Perplexity)', en: 'Web search (Perplexity)' }, free: false, student: '10/mois', starter: '20/mois', pro: '100/mois', team: '∞', highlight: 'pro' },

  // Playlists
  { category: '📚 Playlists', feature: { fr: 'Analyse de playlists', en: 'Playlist analysis' }, free: false, student: false, starter: false, pro: '20 vidéos', team: '100 vidéos', highlight: 'pro' },
  { category: '📚 Playlists', feature: { fr: 'Nombre de playlists', en: 'Number of playlists' }, free: false, student: false, starter: false, pro: '10', team: '∞', highlight: 'pro' },

  // Export
  { category: '📄 Export', feature: { fr: 'Export PDF', en: 'PDF export' }, free: false, student: true, starter: true, pro: true, team: true },
  { category: '📄 Export', feature: { fr: 'Export Markdown', en: 'Markdown export' }, free: false, student: true, starter: false, pro: true, team: true, highlight: 'student' },
  { category: '📄 Export', feature: { fr: 'Watermark', en: 'Watermark' }, free: true, student: false, starter: false, pro: false, team: false },

  // Audio
  { category: '🎧 Audio', feature: { fr: 'Lecture audio TTS', en: 'TTS audio' }, free: false, student: true, starter: false, pro: true, team: true, highlight: 'student' },

  // API & Équipe
  { category: '🔌 API & Équipe', feature: { fr: 'Accès API REST', en: 'REST API access' }, free: false, student: false, starter: false, pro: false, team: '1000 req/jour', highlight: 'team' },
  { category: '🔌 API & Équipe', feature: { fr: 'Multi-utilisateurs', en: 'Multi-users' }, free: false, student: false, starter: false, pro: false, team: '5 utilisateurs', highlight: 'team' },
  { category: '🔌 API & Équipe', feature: { fr: 'Workspace partagé', en: 'Shared workspace' }, free: false, student: false, starter: false, pro: false, team: true, highlight: 'team' },

  // Support
  { category: '🛟 Support', feature: { fr: 'Support email', en: 'Email support' }, free: true, student: true, starter: true, pro: true, team: true },
  { category: '🛟 Support', feature: { fr: 'Support prioritaire', en: 'Priority support' }, free: false, student: false, starter: false, pro: true, team: true, highlight: 'pro' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🌟 AVANTAGES EXCLUSIFS PAR PLAN
// ═══════════════════════════════════════════════════════════════════════════════

interface ExclusiveFeature {
  icon: React.ElementType;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  badge?: { fr: string; en: string };
}

const STUDENT_EXCLUSIVES: ExclusiveFeature[] = [
  {
    icon: Brain,
    title: { fr: 'Flashcards automatiques', en: 'Auto Flashcards' },
    description: { fr: 'Générez des fiches de révision en un clic', en: 'Generate study cards in one click' },
    badge: { fr: 'KILLER FEATURE', en: 'KILLER FEATURE' },
  },
  {
    icon: Lightbulb,
    title: { fr: 'Cartes mentales', en: 'Mind Maps' },
    description: { fr: 'Visualisez les concepts et leurs liens', en: 'Visualize concepts and their connections' },
  },
  {
    icon: FileText,
    title: { fr: 'Citations académiques', en: 'Academic Citations' },
    description: { fr: 'Export BibTeX pour vos dissertations', en: 'BibTeX export for your papers' },
  },
  {
    icon: Headphones,
    title: { fr: 'Lecture audio TTS', en: 'TTS Audio' },
    description: { fr: 'Révisez en écoutant vos résumés', en: 'Review by listening to your summaries' },
  },
];

const PRO_EXCLUSIVES: ExclusiveFeature[] = [
  {
    icon: ListVideo,
    title: { fr: 'Playlists (20 vidéos)', en: 'Playlists (20 videos)' },
    description: { fr: 'Analysez des séries de vidéos d\'un coup', en: 'Analyze video series at once' },
    badge: { fr: 'EXCLUSIF', en: 'EXCLUSIVE' },
  },
  {
    icon: Infinity,
    title: { fr: 'Chat illimité', en: 'Unlimited Chat' },
    description: { fr: 'Posez autant de questions que vous voulez', en: 'Ask as many questions as you want' },
  },
  {
    icon: TrendingUp,
    title: { fr: '100 recherches web/mois', en: '100 Web searches/mo' },
    description: { fr: 'Recherche Perplexity intégrée', en: 'Integrated Perplexity search' },
  },
  {
    icon: Shield,
    title: { fr: 'Support prioritaire', en: 'Priority Support' },
    description: { fr: 'Réponse rapide par email', en: 'Fast email response' },
  },
];

const TEAM_EXCLUSIVES: ExclusiveFeature[] = [
  {
    icon: Key,
    title: { fr: 'Accès API REST', en: 'REST API Access' },
    description: { fr: '1000 requêtes/jour pour vos intégrations', en: '1000 requests/day for your integrations' },
    badge: { fr: 'NOUVEAU', en: 'NEW' },
  },
  {
    icon: Users,
    title: { fr: '5 utilisateurs', en: '5 Users' },
    description: { fr: 'Collaborez en équipe', en: 'Collaborate as a team' },
  },
  {
    icon: ListVideo,
    title: { fr: 'Playlists (100 vidéos)', en: 'Playlists (100 videos)' },
    description: { fr: '5x plus que Pro', en: '5x more than Pro' },
  },
  {
    icon: Infinity,
    title: { fr: 'Recherche web illimitée', en: 'Unlimited Web Search' },
    description: { fr: 'Aucune limite mensuelle', en: 'No monthly limit' },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

interface SubscriptionStatus {
  plan: string;
  has_subscription: boolean;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
}

export const UpgradePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { language } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{ plan: PlanId; action: 'upgrade' | 'downgrade' } | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['📊 Limites', '🎓 Outils d\'étude', '🔌 API & Équipe']);
  const [trialEligible, setTrialEligible] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);

  const currentPlan = normalizePlanId(user?.plan);
  const currentPlanConfig = PLANS_INFO.find(p => p.id === currentPlan) || PLANS_INFO[0];
  const lang = language as 'fr' | 'en';

  useEffect(() => {
    const loadData = async () => {
      try {
        await refreshUser(true);
        const status = await billingApi.getSubscriptionStatus();
        setSubscriptionStatus(status);

        try {
          const eligibility = await billingApi.checkTrialEligibility();
          setTrialEligible(eligibility.eligible);
        } catch {
          // Trial eligibility check not available
        }
      } catch (err) {
        console.error('Error loading data:', err);
      }
    };
    loadData();
  }, []);

  const categories = [...new Set(COMPARISON_MATRIX.map(r => r.category))];

  const handleStartTrial = async () => {
    setTrialLoading(true);
    setError(null);
    try {
      const result = await billingApi.startProTrial();
      if (result.checkout_url) {
        window.location.href = result.checkout_url;
      }
    } catch (err: any) {
      setError(err?.message || (language === 'fr' ? 'Erreur lors du démarrage de l\'essai' : 'Error starting trial'));
    } finally {
      setTrialLoading(false);
    }
  };

  const handleChangePlan = async (newPlanId: PlanId) => {
    if (newPlanId === currentPlan) return;

    const newPlanConfig = PLANS_INFO.find(p => p.id === newPlanId)!;
    const isUpgrade = newPlanConfig.order > currentPlanConfig.order;

    if (!isUpgrade && currentPlan !== 'free') {
      setShowConfirmModal({ plan: newPlanId, action: 'downgrade' });
      return;
    }

    await executeChangePlan(newPlanId, isUpgrade ? 'upgrade' : 'downgrade');
  };

  const executeChangePlan = async (newPlanId: PlanId, action: 'upgrade' | 'downgrade') => {
    setLoading(newPlanId);
    setError(null);
    setSuccess(null);
    setShowConfirmModal(null);

    try {
      if (action === 'upgrade' || (currentPlan === 'free' && newPlanId !== 'free')) {
        const result = await billingApi.createCheckout(newPlanId);
        if (result.checkout_url) {
          window.location.href = result.checkout_url;
          return;
        }
      } else {
        const result = await billingApi.changePlan(newPlanId);
        if (result.success) {
          setSuccess(language === 'fr'
            ? 'Plan modifié ! Changement effectif au prochain renouvellement.'
            : 'Plan changed! Takes effect at next renewal.');
          await refreshUser(true);
          const status = await billingApi.getSubscriptionStatus();
          setSubscriptionStatus(status);
        }
      }
    } catch (err: any) {
      setError(err?.message || (language === 'fr' ? 'Erreur lors du changement' : 'Error changing plan'));
    } finally {
      setLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm(language === 'fr'
      ? 'Êtes-vous sûr de vouloir annuler ? Vous garderez vos avantages jusqu\'à la fin de la période payée.'
      : 'Are you sure? You\'ll keep benefits until paid period ends.')) return;

    setLoading('cancel');
    try {
      await billingApi.cancelSubscription();
      setSuccess(language === 'fr'
        ? 'Abonnement annulé. Accès maintenu jusqu\'à la fin de la période.'
        : 'Subscription cancelled. Access kept until period end.');
      const status = await billingApi.getSubscriptionStatus();
      setSubscriptionStatus(status);
    } catch (err: any) {
      setError(err?.message || 'Error');
    } finally {
      setLoading(null);
    }
  };

  const renderValue = (value: string | boolean, highlight?: PlanId, currentCol?: PlanId) => {
    const isHighlighted = highlight === currentCol;
    if (value === true) return <Check className={`w-5 h-5 ${isHighlighted ? 'text-green-400' : 'text-green-400'}`} />;
    if (value === false) return <X className="w-5 h-5 text-gray-500" />;
    if (value === '∞') return <Infinity className={`w-5 h-5 ${isHighlighted ? 'text-amber-400' : 'text-violet-400'}`} />;
    return <span className={`text-sm ${isHighlighted ? 'text-amber-300 font-medium' : 'text-text-secondary'}`}>{value}</span>;
  };

  // Récupérer les features pour chaque plan
  const getFeatures = (planId: PlanId) => {
    const limits = PLAN_LIMITS[planId];
    const features = PLAN_FEATURES[planId];

    const result = [
      {
        text: limits.monthlyAnalyses === -1
          ? (lang === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses')
          : (lang === 'fr' ? `${limits.monthlyAnalyses} analyses/mois` : `${limits.monthlyAnalyses} analyses/mo`),
        included: true,
        highlight: limits.monthlyAnalyses >= 300
      },
      {
        text: limits.chatQuestionsPerVideo === -1
          ? (lang === 'fr' ? 'Chat illimité' : 'Unlimited chat')
          : (lang === 'fr' ? `Chat (${limits.chatQuestionsPerVideo} q/vidéo)` : `Chat (${limits.chatQuestionsPerVideo} q/video)`),
        included: true
      },
    ];

    if (features.flashcards) {
      result.push({
        text: lang === 'fr' ? 'Flashcards & Cartes mentales' : 'Flashcards & Mind maps',
        included: true,
        highlight: planId === 'student'
      });
    }

    if (features.playlists) {
      result.push({
        text: lang === 'fr' ? `Playlists (${limits.maxPlaylistVideos} vidéos)` : `Playlists (${limits.maxPlaylistVideos} videos)`,
        included: true,
        highlight: true
      });
    }

    if (limits.webSearchMonthly > 0 || limits.webSearchMonthly === -1) {
      result.push({
        text: limits.webSearchMonthly === -1
          ? (lang === 'fr' ? 'Recherche web illimitée' : 'Unlimited web search')
          : (lang === 'fr' ? `Recherche web (${limits.webSearchMonthly}/mois)` : `Web search (${limits.webSearchMonthly}/mo)`),
        included: true,
        highlight: limits.webSearchMonthly >= 100
      });
    }

    if (features.exportPdf) {
      result.push({ text: lang === 'fr' ? 'Export PDF' : 'PDF export', included: true });
    }

    if (features.ttsAudio) {
      result.push({ text: lang === 'fr' ? 'Lecture audio TTS' : 'TTS audio', included: true });
    }

    if (features.apiAccess) {
      result.push({
        text: lang === 'fr' ? `API (${limits.apiRequestsDaily} req/jour)` : `API (${limits.apiRequestsDaily} req/day)`,
        included: true,
        highlight: true
      });
    }

    if (limits.teamMembers > 1) {
      result.push({
        text: lang === 'fr' ? `${limits.teamMembers} utilisateurs` : `${limits.teamMembers} users`,
        included: true,
        highlight: true
      });
    }

    // Ajouter les features non incluses pour free
    if (planId === 'free') {
      result.push({ text: lang === 'fr' ? 'Historique 3 jours' : '3 days history', included: true });
      result.push({ text: lang === 'fr' ? 'Outils d\'étude' : 'Study tools', included: false });
      result.push({ text: 'Export', included: false });
    }

    return result;
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Tarifs"
        description="Découvrez les plans Deep Sight : Gratuit, Étudiant, Starter, Pro et Équipe. Analysez vos vidéos YouTube avec l'IA."
        path="/upgrade"
      />
      <DoodleBackground variant="creative" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <div className="max-w-7xl mx-auto">

            {/* Header */}
            <header className="text-center mb-8 sm:mb-10">
              <h1 className="font-semibold text-2xl sm:text-3xl md:text-4xl font-bold text-text-primary mb-2 sm:mb-3 px-2">
                {language === 'fr' ? 'Choisissez votre plan' : 'Choose your plan'}
              </h1>
              <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto px-4">
                {language === 'fr'
                  ? 'Débloquez des fonctionnalités puissantes pour analyser le contenu vidéo.'
                  : 'Unlock powerful features to analyze video content.'}
              </p>
            </header>

            {/* Alerts */}
            {subscriptionStatus?.cancel_at_period_end && (
              <div className="card p-3 sm:p-4 mb-4 sm:mb-6 border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 flex-shrink-0" />
                  <span className="text-amber-300 text-xs sm:text-sm">
                    {language === 'fr'
                      ? `Abonnement annulé. Accès jusqu'au ${new Date(subscriptionStatus.current_period_end!).toLocaleDateString()}`
                      : `Subscription cancelled. Access until ${new Date(subscriptionStatus.current_period_end!).toLocaleDateString()}`}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await billingApi.reactivateSubscription();
                    const status = await billingApi.getSubscriptionStatus();
                    setSubscriptionStatus(status);
                  }}
                  className="text-xs sm:text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg bg-amber-500/10 active:scale-95 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  {language === 'fr' ? 'Réactiver' : 'Reactivate'}
                </button>
              </div>
            )}

            {error && (
              <div className="card p-3 sm:p-4 mb-4 sm:mb-6 border-red-500/30 bg-red-500/10 text-red-300 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {success && (
              <div className="card p-3 sm:p-4 mb-4 sm:mb-6 border-green-500/30 bg-green-500/10 text-green-300 text-xs sm:text-sm flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" /> {success}
              </div>
            )}

            {/* 🆓 Pro Trial Banner */}
            {trialEligible && currentPlan === 'free' && (
              <div className="card p-4 sm:p-6 mb-6 sm:mb-8 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-500/30 overflow-hidden relative">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl hidden sm:block" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-fuchsia-500/20 rounded-full blur-3xl hidden sm:block" />

                <div className="relative flex flex-col items-center gap-4 sm:gap-6 md:flex-row">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
                      <Gift className="w-7 h-7 sm:w-10 sm:h-10 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 text-center md:text-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 text-violet-400 text-xs font-semibold mb-2">
                      <Sparkles className="w-3 h-3" />
                      {language === 'fr' ? 'Offre limitée' : 'Limited offer'}
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold text-text-primary mb-2">
                      {language === 'fr' ? 'Essayez Pro gratuitement pendant 7 jours' : 'Try Pro free for 7 days'}
                    </h2>
                    <p className="text-text-secondary text-xs sm:text-base mb-4 max-w-xl">
                      {language === 'fr'
                        ? 'Accédez à toutes les fonctionnalités Pro : 300 analyses/mois, chat illimité, playlists, et bien plus. Sans engagement.'
                        : 'Access all Pro features: 300 analyses/month, unlimited chat, playlists, and more. No commitment.'}
                    </p>

                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4 justify-center md:justify-start">
                      {[
                        { icon: Crown, text: language === 'fr' ? '300 analyses' : '300 analyses' },
                        { icon: Infinity, text: language === 'fr' ? 'Chat illimité' : 'Unlimited chat' },
                        { icon: ListVideo, text: language === 'fr' ? 'Playlists' : 'Playlists' },
                        { icon: Clock, text: language === 'fr' ? '7 jours gratuits' : '7 days free' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-bg-tertiary/50 text-text-secondary text-[10px] sm:text-xs">
                          <item.icon className="w-3 h-3 text-violet-400" />
                          {item.text}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-shrink-0 w-full md:w-auto">
                    <button
                      onClick={handleStartTrial}
                      disabled={trialLoading}
                      className="w-full md:w-auto px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm sm:text-lg shadow-xl shadow-violet-500/30 hover:opacity-90 transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-95"
                    >
                      {trialLoading ? (
                        <DeepSightSpinnerMicro />
                      ) : (
                        <>
                          <Gift className="w-4 h-4 sm:w-5 sm:h-5" />
                          {language === 'fr' ? 'Commencer l\'essai' : 'Start free trial'}
                        </>
                      )}
                    </button>
                    <p className="text-xs text-text-tertiary mt-2 text-center">
                      {language === 'fr' ? 'Annulez à tout moment' : 'Cancel anytime'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* View Toggle */}
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="inline-flex bg-bg-tertiary rounded-xl p-1">
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[44px] active:scale-95 ${viewMode === 'cards'
                    ? 'bg-accent-primary text-white shadow-lg'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {language === 'fr' ? '🃏 Cartes' : '🃏 Cards'}
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[44px] active:scale-95 hidden sm:block ${viewMode === 'table'
                    ? 'bg-accent-primary text-white shadow-lg'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  {language === 'fr' ? '📊 Comparaison' : '📊 Comparison'}
                </button>
              </div>
            </div>

            {/* Cards View */}
            {viewMode === 'cards' && (
              <>
                {/* Plan Cards - 5 colonnes on desktop, 1 on mobile, 2 on tablet */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8 sm:mb-12">
                  {PLANS_INFO.map((plan) => {
                    const Icon = getPlanIcon(plan.id);
                    const isCurrent = plan.id === currentPlan;
                    const isHigher = plan.order > currentPlanConfig.order;
                    const isLower = plan.order < currentPlanConfig.order;
                    const features = getFeatures(plan.id);

                    return (
                      <div
                        key={plan.id}
                        className={`card relative overflow-hidden transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${isCurrent ? 'ring-2 ring-green-500/50' : ''
                          } ${plan.popular ? 'ring-2 ring-violet-500/50 shadow-xl shadow-violet-500/10' : ''
                          } ${plan.recommended ? 'ring-2 ring-amber-500/50 shadow-xl shadow-amber-500/10' : ''}`}
                      >
                        {/* Badge */}
                        {plan.badge && !isCurrent && (
                          <div className="absolute -top-0 -right-0">
                            <div className={`${plan.popular ? 'bg-violet-500' : plan.recommended ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-emerald-500'
                              } text-white text-[10px] font-bold px-2 py-1 rounded-bl-xl`}>
                              {plan.badge[lang]}
                            </div>
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute top-2 left-2">
                            <div className="bg-green-500/20 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              {language === 'fr' ? 'Actuel' : 'Current'}
                            </div>
                          </div>
                        )}

                        <div className="p-3 sm:p-4 pt-7 sm:pt-8">
                          {/* Icon & Name */}
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-3 sm:mb-4 shadow-lg`}>
                            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                          </div>

                          <h3 className="text-lg sm:text-xl font-bold text-text-primary mb-0.5">{plan.name[lang]}</h3>
                          <p className="text-xs text-text-tertiary mb-2 sm:mb-3">{plan.description[lang]}</p>

                          {/* Price */}
                          <div className="mb-3 sm:mb-4">
                            <span className="text-2xl sm:text-3xl font-semibold font-bold text-text-primary">
                              {plan.price === 0 ? '0' : (plan.price / 100).toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-text-tertiary text-xs sm:text-sm ml-1">€/{language === 'fr' ? 'mois' : 'mo'}</span>
                          </div>

                          {/* Key Features */}
                          <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4 min-h-[120px] sm:min-h-[140px]">
                            {features.slice(0, 6).map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px] sm:text-xs">
                                <div className={`w-4 h-4 rounded-full ${feature.included
                                  ? feature.highlight
                                    ? 'bg-amber-500/20'
                                    : 'bg-green-500/20'
                                  : 'bg-gray-500/20'
                                  } flex items-center justify-center flex-shrink-0`}>
                                  {feature.included
                                    ? <Check className={`w-2.5 h-2.5 ${feature.highlight ? 'text-amber-400' : 'text-green-400'}`} />
                                    : <X className="w-2.5 h-2.5 text-gray-500" />}
                                </div>
                                <span className={`${feature.included ? 'text-text-secondary' : 'text-text-muted line-through'} ${feature.highlight ? 'font-medium text-amber-300' : ''}`}>
                                  {feature.text}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* CTA */}
                          {trialEligible && plan.id === 'pro' && currentPlan === 'free' ? (
                            <button
                              onClick={handleStartTrial}
                              disabled={trialLoading}
                              className="w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:opacity-90 shadow-lg min-h-[44px] active:scale-95"
                            >
                              {trialLoading ? (
                                <DeepSightSpinnerMicro />
                              ) : (
                                <>
                                  <Gift className="w-4 h-4" />
                                  {language === 'fr' ? '7 jours gratuits' : '7-day free trial'}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleChangePlan(plan.id)}
                              disabled={isCurrent || loading === plan.id || plan.id === 'free'}
                              className={`w-full py-2.5 sm:py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 min-h-[44px] active:scale-95 ${isCurrent
                                ? 'bg-green-500/20 text-green-400 cursor-default'
                                : isHigher
                                  ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-lg`
                                  : isLower
                                    ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                                    : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
                                }`}
                            >
                              {loading === plan.id ? (
                                <DeepSightSpinnerMicro />
                              ) : isCurrent ? (
                                <><Check className="w-4 h-4" /> {language === 'fr' ? 'Actuel' : 'Current'}</>
                              ) : isHigher ? (
                                <><ArrowUp className="w-4 h-4" /> {language === 'fr' ? 'Choisir' : 'Select'}</>
                              ) : isLower ? (
                                <><ArrowDown className="w-4 h-4" /> {language === 'fr' ? 'Rétrograder' : 'Downgrade'}</>
                              ) : (
                                language === 'fr' ? 'Gratuit' : 'Free'
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section Étudiant */}
                {currentPlan === 'free' && (
                  <div className="card p-4 sm:p-8 mb-6 sm:mb-8 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/30">
                    <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-8">
                      <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs sm:text-sm font-medium mb-3 sm:mb-4">
                          <GraduationCap className="w-4 h-4" />
                          {language === 'fr' ? 'Spécial Étudiants' : 'Student Special'}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2 sm:mb-3">
                          {language === 'fr' ? 'Révisez 10x plus vite' : 'Study 10x faster'}
                        </h2>
                        <p className="text-text-secondary text-sm sm:text-base mb-4">
                          {language === 'fr'
                            ? 'Transformez n\'importe quelle vidéo éducative en fiches de révision, cartes mentales et flashcards.'
                            : 'Transform any educational video into study notes, mind maps and flashcards.'}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 sm:mb-6">
                          {STUDENT_EXCLUSIVES.map((feature, idx) => {
                            const Icon = feature.icon;
                            return (
                              <div key={idx} className="flex items-start gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                  <Icon className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs sm:text-sm font-medium text-text-primary">{feature.title[lang]}</p>
                                  <p className="text-[10px] sm:text-xs text-text-tertiary">{feature.description[lang]}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => handleChangePlan('student')}
                          disabled={loading === 'student'}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-opacity min-h-[44px] active:scale-95"
                        >
                          {loading === 'student' ? (
                            <DeepSightSpinnerMicro />
                          ) : (
                            <>
                              <GraduationCap className="w-5 h-5" />
                              {language === 'fr' ? 'Commencer à 2,99€/mois' : 'Start at €2.99/month'}
                            </>
                          )}
                        </button>
                      </div>
                      <div className="hidden md:block">
                        <div className="w-40 h-40 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                          <GraduationCap className="w-20 h-20 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section Pro */}
                {(currentPlan === 'free' || currentPlan === 'student' || currentPlan === 'starter') && (
                  <div className="card p-4 sm:p-8 mb-6 sm:mb-8 bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30">
                    <div className="text-center mb-6 sm:mb-8">
                      <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-violet-500/20 text-violet-400 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
                        <Crown className="w-4 h-4" />
                        {language === 'fr' ? 'Le plus populaire' : 'Most Popular'}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
                        {language === 'fr' ? 'Pourquoi choisir Pro ?' : 'Why choose Pro?'}
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                      {PRO_EXCLUSIVES.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                          <div key={idx} className="p-3 sm:p-4 rounded-xl bg-bg-secondary/50 border border-border-subtle hover:border-violet-500/30 transition-colors active:scale-[0.98]">
                            <div className="flex items-start justify-between mb-2 sm:mb-3">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-violet-400" />
                              </div>
                              {feature.badge && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-400">
                                  {feature.badge[lang]}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-text-primary mb-1 text-xs sm:text-sm">{feature.title[lang]}</h3>
                            <p className="text-[10px] sm:text-xs text-text-tertiary">{feature.description[lang]}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center">
                      <button
                        onClick={() => handleChangePlan('pro')}
                        disabled={loading === 'pro'}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-sm shadow-lg shadow-violet-500/25 hover:opacity-90 transition-opacity min-h-[44px] active:scale-95"
                      >
                        {loading === 'pro' ? (
                          <DeepSightSpinnerMicro />
                        ) : (
                          <>
                            <Crown className="w-5 h-5" />
                            {language === 'fr' ? 'Passer à Pro — 12,99€/mois' : 'Upgrade to Pro — €12.99/mo'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Section Équipe */}
                {currentPlan !== 'team' && (
                  <div className="card p-4 sm:p-8 mb-6 sm:mb-8 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
                    <div className="text-center mb-6 sm:mb-8">
                      <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-amber-500/20 text-amber-400 text-xs sm:text-sm font-semibold mb-3 sm:mb-4">
                        <Users className="w-4 h-4" />
                        {language === 'fr' ? 'Pour les équipes' : 'For Teams'}
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
                        {language === 'fr' ? 'Besoin de plus ?' : 'Need more?'}
                      </h2>
                      <p className="text-text-secondary text-sm sm:text-base max-w-2xl mx-auto px-2">
                        {language === 'fr'
                          ? 'Le plan Équipe offre l\'API, le multi-utilisateurs et des limites étendues.'
                          : 'The Team plan offers API access, multi-users and extended limits.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                      {TEAM_EXCLUSIVES.map((feature, idx) => {
                        const Icon = feature.icon;
                        return (
                          <div key={idx} className="p-3 sm:p-4 rounded-xl bg-bg-secondary/50 border border-border-subtle hover:border-amber-500/30 transition-colors active:scale-[0.98]">
                            <div className="flex items-start justify-between mb-2 sm:mb-3">
                              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                                <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                              </div>
                              {feature.badge && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                  {feature.badge[lang]}
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-text-primary mb-1 text-xs sm:text-sm">{feature.title[lang]}</h3>
                            <p className="text-[10px] sm:text-xs text-text-tertiary">{feature.description[lang]}</p>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-center">
                      <button
                        onClick={() => handleChangePlan('team')}
                        disabled={loading === 'team'}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-lg shadow-amber-500/25 hover:opacity-90 transition-opacity min-h-[44px] active:scale-95"
                      >
                        {loading === 'team' ? (
                          <DeepSightSpinnerMicro />
                        ) : (
                          <>
                            <Users className="w-5 h-5" />
                            {language === 'fr' ? 'Passer à Équipe — 29,99€/mois' : 'Upgrade to Team — €29.99/mo'}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Témoignages */}
                <div className="mb-8 sm:mb-12">
                  <div className="text-center mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
                      {language === 'fr' ? 'Ils nous font confiance' : 'They trust us'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {TESTIMONIALS.map((testimonial, idx) => {
                      const planConfig = PLANS_INFO.find(p => p.id === testimonial.plan);
                      return (
                        <div
                          key={idx}
                          className="card p-4 sm:p-6 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer"
                          onClick={() => handleChangePlan(testimonial.plan)}
                        >
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="text-3xl sm:text-4xl flex-shrink-0">{testimonial.avatar}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-text-secondary italic mb-2 sm:mb-3 text-xs sm:text-sm">
                                "{testimonial.text[lang]}"
                              </p>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-text-primary text-xs sm:text-sm">{testimonial.author}</p>
                                  <p className="text-[10px] sm:text-xs text-text-tertiary">{testimonial.role[lang]}</p>
                                </div>
                                {planConfig && (
                                  <div className={`px-2 sm:px-3 py-1 rounded-full bg-gradient-to-r ${planConfig.gradient} text-white text-[10px] sm:text-xs font-medium self-start sm:self-auto`}>
                                    {planConfig.name[lang]}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
              <div className="card overflow-hidden mb-12 overflow-x-auto">
                {/* Header */}
                <div className="grid grid-cols-6 gap-2 p-4 bg-bg-secondary border-b border-border-primary min-w-[900px]">
                  <div className="font-semibold text-text-secondary text-sm">
                    {language === 'fr' ? 'Fonctionnalités' : 'Features'}
                  </div>
                  {PLANS_INFO.map((plan) => {
                    const Icon = getPlanIcon(plan.id);
                    const isCurrent = plan.id === currentPlan;
                    return (
                      <div key={plan.id} className={`text-center ${plan.popular ? 'bg-violet-500/5 -mx-1 px-1 py-2 rounded-lg' : ''} ${plan.recommended ? 'bg-amber-500/5 -mx-1 px-1 py-2 rounded-lg' : ''}`}>
                        <div className={`inline-flex w-8 h-8 rounded-lg bg-gradient-to-br ${plan.gradient} items-center justify-center mb-1 shadow-lg`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="font-bold text-text-primary text-xs">{plan.name[lang]}</div>
                        <div className="text-[10px] text-text-tertiary">{plan.price === 0 ? '0€' : `${(plan.price / 100).toFixed(2).replace('.', ',')}€`}</div>
                        {isCurrent && (
                          <div className="text-[10px] text-green-400 mt-1 flex items-center justify-center gap-1">
                            <Check className="w-2.5 h-2.5" /> {language === 'fr' ? 'Actuel' : 'Current'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Features by category */}
                {categories.map((category) => (
                  <div key={category} className="border-b border-border-primary last:border-b-0 min-w-[900px]">
                    <button
                      onClick={() => setExpandedCategories(prev =>
                        prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
                      )}
                      className="w-full grid grid-cols-6 gap-2 p-3 bg-bg-tertiary/50 hover:bg-bg-tertiary transition-colors"
                    >
                      <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
                        {category}
                        {expandedCategories.includes(category)
                          ? <ChevronUp className="w-4 h-4 text-text-tertiary" />
                          : <ChevronDown className="w-4 h-4 text-text-tertiary" />
                        }
                      </div>
                    </button>

                    {expandedCategories.includes(category) && (
                      <div className="divide-y divide-border-primary/30">
                        {COMPARISON_MATRIX.filter(f => f.category === category).map((row, idx) => (
                          <div key={idx} className="grid grid-cols-6 gap-2 p-3 hover:bg-bg-tertiary/30 transition-colors">
                            <div className="text-xs text-text-secondary">{row.feature[lang]}</div>
                            {(['free', 'student', 'starter', 'pro', 'team'] as PlanId[]).map((planId) => (
                              <div key={planId} className={`flex justify-center ${row.highlight === planId ? 'bg-amber-500/10 -mx-1 px-1 rounded' : ''}`}>
                                {renderValue(row[planId], row.highlight, planId)}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* CTA Row */}
                <div className="grid grid-cols-6 gap-2 p-4 bg-bg-secondary min-w-[900px]">
                  <div />
                  {PLANS_INFO.map((plan) => {
                    const isCurrent = plan.id === currentPlan;
                    const isHigher = plan.order > currentPlanConfig.order;
                    return (
                      <div key={plan.id} className="flex justify-center">
                        <button
                          onClick={() => handleChangePlan(plan.id)}
                          disabled={isCurrent || loading === plan.id || plan.id === 'free'}
                          className={`px-3 py-1.5 rounded-lg font-medium text-[10px] transition-all ${isCurrent ? 'bg-green-500/20 text-green-400'
                            : isHigher ? `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-lg`
                              : 'bg-bg-tertiary text-text-muted'
                            }`}
                        >
                          {loading === plan.id ? <DeepSightSpinnerMicro />
                            : isCurrent ? (language === 'fr' ? 'Actuel' : 'Current')
                              : isHigher ? (language === 'fr' ? 'Choisir' : 'Select')
                                : '-'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cancel */}
            {currentPlan !== 'free' && !subscriptionStatus?.cancel_at_period_end && (
              <div className="text-center mb-6 sm:mb-8">
                <button
                  onClick={handleCancelSubscription}
                  disabled={loading === 'cancel'}
                  className="text-xs sm:text-sm text-text-tertiary hover:text-red-400 transition-colors flex items-center gap-2 mx-auto min-h-[44px] px-4 py-2 active:scale-95"
                >
                  {loading === 'cancel' && <DeepSightSpinnerMicro />}
                  {language === 'fr' ? 'Annuler mon abonnement' : 'Cancel subscription'}
                </button>
              </div>
            )}

            {/* FAQ */}
            <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
              <h3 className="font-bold text-base sm:text-lg text-text-primary mb-4 sm:mb-5 flex items-center gap-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-accent-primary" />
                {language === 'fr' ? 'Questions fréquentes' : 'FAQ'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? "Comment fonctionne l'essai gratuit ?" : 'How does the free trial work?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? '7 jours Pro gratuits, sans carte bancaire. Annulez à tout moment.' : '7 days Pro free, no credit card. Cancel anytime.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? "Comment fonctionne l'upgrade ?" : 'How does upgrade work?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Vous êtes facturé la différence au prorata. Nouveaux avantages instantanés.' : 'You pay the prorated difference. New benefits are instant.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? 'Puis-je annuler ?' : 'Can I cancel?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Oui, à tout moment. Accès maintenu jusqu\'à fin de période payée.' : 'Yes, anytime. Access kept until paid period ends.'}</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-text-primary">{language === 'fr' ? 'Moyens de paiement ?' : 'Payment methods?'}</p>
                  <p className="text-text-secondary">{language === 'fr' ? 'Toutes cartes bancaires via Stripe. Paiements sécurisés.' : 'All cards via Stripe. Secure payments.'}</p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="text-center text-xs sm:text-sm text-text-tertiary pb-4">
              {language === 'fr' ? 'Questions ? ' : 'Questions? '}
              <a href="mailto:contact@deepsightsynthesis.com" className="text-accent-primary hover:underline">
                contact@deepsightsynthesis.com
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="card p-4 sm:p-6 w-full sm:max-w-md shadow-2xl rounded-t-2xl sm:rounded-2xl">
            <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2 sm:mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              {language === 'fr' ? 'Confirmer le changement' : 'Confirm change'}
            </h3>
            <p className="text-text-secondary text-xs sm:text-sm mb-4 sm:mb-5">
              {language === 'fr'
                ? `Passer au plan ${PLANS_INFO.find(p => p.id === showConfirmModal.plan)?.name[lang]} ? Vos avantages actuels restent actifs jusqu'à la fin de la période.`
                : `Switch to ${PLANS_INFO.find(p => p.id === showConfirmModal.plan)?.name[lang]}? Current benefits stay active until period end.`}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end">
              <button onClick={() => setShowConfirmModal(null)} className="btn-secondary min-h-[44px] active:scale-95">
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={() => executeChangePlan(showConfirmModal.plan, showConfirmModal.action)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-medium transition-colors min-h-[44px] active:scale-95"
              >
                {language === 'fr' ? 'Confirmer' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpgradePage;
