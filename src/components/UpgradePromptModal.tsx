/**
 * UpgradePromptModal v1.0 - Modal that appears when user reaches their limit
 * Encourages upgrade with clear value proposition
 */

import React from 'react';
import { X, Zap, GraduationCap, Star, Crown, Sparkles, ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

interface UpgradePromptModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Type of limit reached */
  limitType?: 'credits' | 'chat' | 'analysis' | 'playlist' | 'export';
  /** Current usage count */
  currentUsage?: number;
  /** Maximum allowed */
  maxAllowed?: number;
}

export const UpgradePromptModal: React.FC<UpgradePromptModalProps> = ({
  isOpen,
  onClose,
  limitType = 'credits',
  currentUsage = 0,
  maxAllowed = 0,
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const plan = user?.plan || 'free';

  if (!isOpen) return null;

  // Get appropriate messaging based on limit type
  const getLimitMessage = () => {
    const messages: Record<string, { fr: string; en: string }> = {
      credits: {
        fr: "Vous avez utilisé tous vos crédits ce mois-ci",
        en: "You've used all your credits this month",
      },
      chat: {
        fr: "Vous avez atteint la limite de questions pour cette vidéo",
        en: "You've reached the question limit for this video",
      },
      analysis: {
        fr: "Vous avez atteint votre limite d'analyses",
        en: "You've reached your analysis limit",
      },
      playlist: {
        fr: "L'analyse de playlists nécessite un plan supérieur",
        en: "Playlist analysis requires a higher plan",
      },
      export: {
        fr: "L'export est réservé aux abonnés",
        en: "Export is reserved for subscribers",
      },
    };
    return messages[limitType][language === 'fr' ? 'fr' : 'en'];
  };

  // Recommended plan based on current plan
  const getRecommendedPlan = () => {
    if (plan === 'free') {
      return {
        id: 'student',
        name: language === 'fr' ? 'Étudiant' : 'Student',
        price: '2,99€',
        icon: GraduationCap,
        color: 'from-green-500 to-emerald-600',
        features: language === 'fr'
          ? ['40 analyses/mois', 'Flashcards & cartes mentales', 'Export PDF', 'TTS audio']
          : ['40 analyses/mo', 'Flashcards & mind maps', 'PDF export', 'TTS audio'],
      };
    }
    if (plan === 'student') {
      return {
        id: 'starter',
        name: 'Starter',
        price: '4,99€',
        icon: Star,
        color: 'from-blue-500 to-blue-600',
        features: language === 'fr'
          ? ['50 analyses/mois', 'Recherche web', '20 questions/vidéo', 'Historique 60 jours']
          : ['50 analyses/mo', 'Web search', '20 questions/video', '60 days history'],
      };
    }
    if (plan === 'starter') {
      return {
        id: 'pro',
        name: 'Pro',
        price: '9,99€',
        icon: Crown,
        color: 'from-violet-500 to-purple-600',
        features: language === 'fr'
          ? ['200 analyses/mois', 'Chat illimité', 'Playlists (10 vidéos)', 'Export Markdown']
          : ['200 analyses/mo', 'Unlimited chat', 'Playlists (10 videos)', 'Markdown export'],
      };
    }
    return {
      id: 'expert',
      name: 'Expert',
      price: '14,99€',
      icon: Sparkles,
      color: 'from-amber-500 to-orange-500',
      features: language === 'fr'
        ? ['Analyses illimitées', 'Playlists (50 vidéos)', 'API REST', 'Support prioritaire']
        : ['Unlimited analyses', 'Playlists (50 videos)', 'REST API', 'Priority support'],
    };
  };

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
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 flex items-center justify-center">
            <Zap className="w-8 h-8 text-accent-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">
            {language === 'fr' ? 'Limite atteinte' : 'Limit reached'}
          </h2>
          <p className="text-text-secondary text-sm">
            {getLimitMessage()}
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

        {/* Recommended plan */}
        <div className="px-6 pb-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3">
            {language === 'fr' ? 'Recommandé pour vous' : 'Recommended for you'}
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
                      {recommended.price}/{language === 'fr' ? 'mois' : 'mo'}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-white/70" />
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
            {language === 'fr' ? 'Voir tous les plans' : 'View all plans'}
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-text-secondary text-sm hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {language === 'fr' ? 'Peut-être plus tard' : 'Maybe later'}
          </button>
        </div>

        {/* Footer hint */}
        <div className="px-6 pb-4 text-center">
          <p className="text-xs text-text-tertiary">
            {language === 'fr'
              ? 'Annulez à tout moment. Paiement sécurisé par Stripe.'
              : 'Cancel anytime. Secure payment via Stripe.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePromptModal;
