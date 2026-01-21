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
import { normalizePlanId, PLANS_INFO, CONVERSION_TRIGGERS } from '../config/planPrivileges';

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

  // Icon mapping
  const iconMap: Record<string, React.ElementType> = {
    'free': Zap,
    'student': GraduationCap,
    'starter': Star,
    'pro': Crown,
    'team': Users,
  };

  // Recommended plan based on current plan and limit type
  const getRecommendedPlan = () => {
    // Playlist limit? Recommend Pro directly
    if (limitType === 'playlist') {
      const proInfo = PLANS_INFO.find(p => p.id === 'pro')!;
      return {
        id: 'pro',
        name: proInfo.name[language === 'fr' ? 'fr' : 'en'],
        price: '12,99€',
        icon: iconMap.pro,
        color: proInfo.gradient,
        highlight: proInfo.killerFeature[language === 'fr' ? 'fr' : 'en'],
        features: language === 'fr'
          ? ['300 analyses/mois', 'Playlists (20 vidéos)', 'Chat illimité', 'Support prioritaire']
          : ['300 analyses/mo', 'Playlists (20 videos)', 'Unlimited chat', 'Priority support'],
      };
    }

    // Default progression: free → student → starter → pro → team
    if (plan === 'free') {
      const studentInfo = PLANS_INFO.find(p => p.id === 'student')!;
      return {
        id: 'student',
        name: studentInfo.name[language === 'fr' ? 'fr' : 'en'],
        price: '2,99€',
        icon: iconMap.student,
        color: studentInfo.gradient,
        highlight: studentInfo.killerFeature[language === 'fr' ? 'fr' : 'en'],
        features: language === 'fr'
          ? ['40 analyses/mois', 'Flashcards & cartes mentales', 'Export PDF & BibTeX', 'Historique 90 jours']
          : ['40 analyses/mo', 'Flashcards & mind maps', 'PDF & BibTeX export', '90 days history'],
      };
    }
    if (plan === 'student') {
      const starterInfo = PLANS_INFO.find(p => p.id === 'starter')!;
      return {
        id: 'starter',
        name: starterInfo.name[language === 'fr' ? 'fr' : 'en'],
        price: '5,99€',
        icon: iconMap.starter,
        color: starterInfo.gradient,
        highlight: starterInfo.killerFeature[language === 'fr' ? 'fr' : 'en'],
        features: language === 'fr'
          ? ['60 analyses/mois', '3000 crédits', 'Recherche web (20/mois)', '20 exports/jour']
          : ['60 analyses/mo', '3000 credits', 'Web search (20/mo)', '20 exports/day'],
      };
    }
    if (plan === 'starter') {
      const proInfo = PLANS_INFO.find(p => p.id === 'pro')!;
      return {
        id: 'pro',
        name: proInfo.name[language === 'fr' ? 'fr' : 'en'],
        price: '12,99€',
        icon: iconMap.pro,
        color: proInfo.gradient,
        highlight: proInfo.killerFeature[language === 'fr' ? 'fr' : 'en'],
        features: language === 'fr'
          ? ['300 analyses/mois', 'Playlists (20 vidéos)', 'Chat illimité', 'Fact-check avancé']
          : ['300 analyses/mo', 'Playlists (20 videos)', 'Unlimited chat', 'Advanced fact-check'],
      };
    }
    // pro → team
    const teamInfo = PLANS_INFO.find(p => p.id === 'team')!;
    return {
      id: 'team',
      name: teamInfo.name[language === 'fr' ? 'fr' : 'en'],
      price: '29,99€',
      icon: iconMap.team,
      color: teamInfo.gradient,
      highlight: teamInfo.killerFeature[language === 'fr' ? 'fr' : 'en'],
      features: language === 'fr'
        ? ['1000 analyses/mois', 'Accès API REST', '5 utilisateurs', 'Intégrations Slack/Teams']
        : ['1000 analyses/mo', 'REST API access', '5 users', 'Slack/Teams integrations'],
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
