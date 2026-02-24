/**
 * UpgradePromptModal v2.0 - Modal that appears when user reaches their limit
 * Encourages upgrade with clear value proposition
 *
 * Aligned with new pricing strategy:
 * - Free: 0€ - Maximum friction (3 analyses)
 * - Student: 2.99€ - Focus apprentissage
 * - Starter: 5.99€ - Particuliers
 * - Pro: 12.99€ - Créateurs & Pros (POPULAIRE)
 * - Team: 29.99€ - Entreprises
 */

import React from 'react';
import { X, Zap, GraduationCap, Star, Crown, Users, Sparkles, ArrowRight, Check, Clock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { normalizePlanId, PLANS_INFO, PLAN_LIMITS, CONVERSION_TRIGGERS } from '../config/planPrivileges';

interface UpgradePromptModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Type of limit reached */
  limitType?: 'credits' | 'chat' | 'analysis' | 'playlist' | 'export' | 'video_duration' | 'history';
  /** Current usage count */
  currentUsage?: number;
  /** Maximum allowed */
  maxAllowed?: number;
  /** Show trial option */
  showTrialOption?: boolean;
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  isOpen,
  onClose,
  limitType = 'credits',
  currentUsage = 0,
  maxAllowed = 0,
  showTrialOption = true,
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const plan = normalizePlanId(user?.plan);

  if (!isOpen) return null;

  const t = (fr: string, en: string) => language === 'fr' ? fr : en;

  // Get appropriate messaging based on limit type
  const getLimitInfo = () => {
    const info: Record<string, { title: { fr: string; en: string }; message: { fr: string; en: string }; icon: React.ReactNode }> = {
      credits: {
        title: { fr: 'Crédits épuisés', en: 'Credits depleted' },
        message: { fr: "Vous avez utilisé tous vos crédits ce mois-ci", en: "You've used all your credits this month" },
        icon: <Zap className="w-8 h-8 text-red-400" />,
      },
      chat: {
        title: { fr: 'Limite de chat atteinte', en: 'Chat limit reached' },
        message: { fr: "Vous avez atteint la limite de questions pour cette vidéo", en: "You've reached the question limit for this video" },
        icon: <AlertTriangle className="w-8 h-8 text-amber-400" />,
      },
      analysis: {
        title: { fr: 'Limite d\'analyses atteinte', en: 'Analysis limit reached' },
        message: {
          fr: plan === 'free'
            ? `Vous avez utilisé vos ${CONVERSION_TRIGGERS.freeAnalysisLimit} analyses gratuites ce mois`
            : "Vous avez atteint votre limite d'analyses",
          en: plan === 'free'
            ? `You've used your ${CONVERSION_TRIGGERS.freeAnalysisLimit} free analyses this month`
            : "You've reached your analysis limit",
        },
        icon: <Clock className="w-8 h-8 text-orange-400" />,
      },
      playlist: {
        title: { fr: 'Playlists réservées aux Pro', en: 'Playlists are Pro only' },
        message: { fr: "L'analyse de playlists est une fonctionnalité Pro", en: "Playlist analysis is a Pro feature" },
        icon: <Crown className="w-8 h-8 text-violet-400" />,
      },
      export: {
        title: { fr: 'Export réservé aux abonnés', en: 'Export for subscribers' },
        message: { fr: "L'export est réservé aux abonnés", en: "Export is reserved for subscribers" },
        icon: <Sparkles className="w-8 h-8 text-blue-400" />,
      },
      video_duration: {
        title: { fr: 'Vidéo trop longue', en: 'Video too long' },
        message: { fr: "Cette vidéo dépasse la durée maximale de votre plan", en: "This video exceeds your plan's maximum duration" },
        icon: <Clock className="w-8 h-8 text-amber-400" />,
      },
      history: {
        title: { fr: 'Historique limité', en: 'Limited history' },
        message: { fr: "Votre historique est limité à 3 jours avec le plan gratuit", en: "Your history is limited to 3 days on the free plan" },
        icon: <Clock className="w-8 h-8 text-amber-400" />,
      },
    };
    return info[limitType] || info.credits;
  };

  // Icon mapping — aligné sur PlanId (planPrivileges.ts)
  const iconMap: Record<string, React.ElementType> = {
    'free': Zap,
    'etudiant': GraduationCap,
    'starter': Star,
    'pro': Crown,
    'equipe': Users,
  };

  // Gradient mapping
  const gradientMap: Record<string, string> = {
    'free': 'from-gray-500 to-gray-600',
    'etudiant': 'from-emerald-500 to-green-600',
    'starter': 'from-blue-500 to-blue-600',
    'pro': 'from-violet-500 to-purple-600',
    'equipe': 'from-amber-500 to-orange-500',
  };

  const lang = language === 'fr' ? 'fr' : 'en';
  const formatPrice = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')}€`;

  // Recommended plan based on current plan and limit type
  const getRecommendedPlan = () => {
    // Playlist limit? Recommend Pro directly
    if (limitType === 'playlist') {
      const info = PLANS_INFO.pro;
      const limits = PLAN_LIMITS.pro;
      return {
        id: 'pro',
        name: lang === 'fr' ? info.name : info.nameEn,
        price: formatPrice(info.priceMonthly),
        icon: iconMap.pro,
        color: gradientMap.pro,
        highlight: lang === 'fr' ? `${limits.monthlyAnalyses} analyses/mois` : `${limits.monthlyAnalyses} analyses/mo`,
        features: lang === 'fr'
          ? [`${limits.monthlyAnalyses} analyses/mois`, `Playlists (${limits.maxPlaylistVideos} vidéos)`, 'Chat illimité', 'Support prioritaire']
          : [`${limits.monthlyAnalyses} analyses/mo`, `Playlists (${limits.maxPlaylistVideos} videos)`, 'Unlimited chat', 'Priority support'],
      };
    }

    // Default progression: free → etudiant → starter → pro → equipe
    if (plan === 'free') {
      const info = PLANS_INFO.etudiant;
      const limits = PLAN_LIMITS.etudiant;
      return {
        id: 'etudiant',
        name: lang === 'fr' ? info.name : info.nameEn,
        price: formatPrice(info.priceMonthly),
        icon: iconMap.etudiant,
        color: gradientMap.etudiant,
        highlight: lang === 'fr' ? 'Flashcards & Cartes mentales' : 'Flashcards & Mind maps',
        features: lang === 'fr'
          ? [`${limits.monthlyAnalyses} analyses/mois`, 'Flashcards & cartes mentales', 'Export Markdown', 'Historique permanent']
          : [`${limits.monthlyAnalyses} analyses/mo`, 'Flashcards & mind maps', 'Markdown export', 'Permanent history'],
      };
    }
    if (plan === 'etudiant') {
      const info = PLANS_INFO.starter;
      const limits = PLAN_LIMITS.starter;
      return {
        id: 'starter',
        name: lang === 'fr' ? info.name : info.nameEn,
        price: formatPrice(info.priceMonthly),
        icon: iconMap.starter,
        color: gradientMap.starter,
        highlight: lang === 'fr' ? `Recherche web (${limits.webSearchMonthly}/mois)` : `Web search (${limits.webSearchMonthly}/mo)`,
        features: lang === 'fr'
          ? [`${limits.monthlyAnalyses} analyses/mois`, `Recherche web (${limits.webSearchMonthly}/mois)`, 'Flashcards & cartes mentales', 'Vidéos jusqu\'à 2h']
          : [`${limits.monthlyAnalyses} analyses/mo`, `Web search (${limits.webSearchMonthly}/mo)`, 'Flashcards & mind maps', 'Videos up to 2h'],
      };
    }
    if (plan === 'starter') {
      const info = PLANS_INFO.pro;
      const limits = PLAN_LIMITS.pro;
      return {
        id: 'pro',
        name: lang === 'fr' ? info.name : info.nameEn,
        price: formatPrice(info.priceMonthly),
        icon: iconMap.pro,
        color: gradientMap.pro,
        highlight: lang === 'fr' ? `Playlists (${limits.maxPlaylistVideos} vidéos)` : `Playlists (${limits.maxPlaylistVideos} videos)`,
        features: lang === 'fr'
          ? [`${limits.monthlyAnalyses} analyses/mois`, `Playlists (${limits.maxPlaylistVideos} vidéos)`, 'Chat illimité', 'Export PDF']
          : [`${limits.monthlyAnalyses} analyses/mo`, `Playlists (${limits.maxPlaylistVideos} videos)`, 'Unlimited chat', 'PDF export'],
      };
    }
    // pro → equipe
    const info = PLANS_INFO.equipe;
    const limits = PLAN_LIMITS.equipe;
    return {
      id: 'equipe',
      name: lang === 'fr' ? info.name : info.nameEn,
      price: formatPrice(info.priceMonthly),
      icon: iconMap.equipe,
      color: gradientMap.equipe,
      highlight: lang === 'fr' ? `${limits.monthlyAnalyses} analyses/mois` : `${limits.monthlyAnalyses} analyses/mo`,
      features: lang === 'fr'
        ? [`${limits.monthlyAnalyses} analyses/mois`, 'Accès API REST', 'Recherche web illimitée', 'Export PDF & Markdown']
        : [`${limits.monthlyAnalyses} analyses/mo`, 'REST API access', 'Unlimited web search', 'PDF & Markdown export'],
    };
  };

  const limitInfo = getLimitInfo();
  const recommended = getRecommendedPlan();
  const RecommendedIcon = recommended.icon;

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  const handleSelectPlan = (planId: string) => {
    onClose();
    navigate(`/upgrade?plan=${planId}`);
  };

  const handleStartTrial = () => {
    onClose();
    navigate('/upgrade?trial=true');
  };

  // Check if user is eligible for trial
  const canTrial = CONVERSION_TRIGGERS.trialEnabled && plan === 'free' && showTrialOption;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="card max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-text-tertiary" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center">
            {limitInfo.icon}
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            {limitInfo.title[language === 'fr' ? 'fr' : 'en']}
          </h2>
          <p className="text-text-secondary text-sm">
            {limitInfo.message[language === 'fr' ? 'fr' : 'en']}
          </p>

          {currentUsage > 0 && maxAllowed > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="h-2 w-32 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500"
                  style={{ width: '100%' }}
                />
              </div>
              <span className="text-xs text-text-tertiary">
                {currentUsage}/{maxAllowed}
              </span>
            </div>
          )}
        </div>

        {/* Trial banner for free users */}
        {canTrial && (
          <div className="mx-6 mb-4 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">
                  {t('Essai gratuit Pro', 'Free Pro trial')}
                </p>
                <p className="text-xs text-text-secondary">
                  {t(`${CONVERSION_TRIGGERS.trialDays} jours sans engagement`, `${CONVERSION_TRIGGERS.trialDays} days no commitment`)}
                </p>
              </div>
              <button
                onClick={handleStartTrial}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('Essayer', 'Try it')}
              </button>
            </div>
          </div>
        )}

        {/* Recommended plan */}
        <div className="px-6 pb-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3">
            {t('Recommandé pour vous', 'Recommended for you')}
          </p>

          <div
            className={`relative p-4 rounded-xl bg-gradient-to-br ${recommended.color} bg-opacity-10 border border-white/10 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
            onClick={() => handleSelectPlan(recommended.id)}
          >
            {/* Background glow */}
            <div className={`absolute inset-0 bg-gradient-to-br ${recommended.color} opacity-10`} />

            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${recommended.color} flex items-center justify-center shadow-lg`}>
                    <RecommendedIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{recommended.name}</h3>
                    <p className="text-xs text-white/70">
                      {recommended.price}/{t('mois', 'mo')}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70" />
              </div>

              {/* Highlight feature */}
              <div className="mb-3 px-2 py-1 rounded-full bg-white/10 inline-block">
                <span className="text-xs text-white font-medium">
                  {recommended.highlight}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {recommended.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs text-white/90">
                    <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={handleUpgrade}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" />
            {t('Voir tous les plans', 'View all plans')}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-text-secondary text-sm hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {t('Peut-être plus tard', 'Maybe later')}
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-text-tertiary">
            {t(
              'Annulez à tout moment. Paiement sécurisé par Stripe.',
              'Cancel anytime. Secure payment via Stripe.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePromptModal;
