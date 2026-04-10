/**
 * VoiceAddonModal — Purchase voice minute add-on packs via Stripe
 * Displays 3 pack tiers with one-click checkout
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, Sparkles, ArrowRight, Star, Zap } from 'lucide-react';
import { DeepSightSpinnerMicro } from '../ui/DeepSightSpinner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { voiceApi } from '../../services/api';

interface VoiceAddonModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlan: string;
  minutesRemaining: number;
}

interface VoicePack {
  id: string;
  name_fr: string;
  name_en: string;
  minutes: number;
  price: number; // in euros
  badge_fr?: string;
  badge_en?: string;
  badgeColor?: string;
}

const VOICE_PACKS: VoicePack[] = [
  {
    id: 'voice_10',
    name_fr: 'Pack Découverte',
    name_en: 'Discovery Pack',
    minutes: 10,
    price: 1.99,
  },
  {
    id: 'voice_30',
    name_fr: 'Pack Standard',
    name_en: 'Standard Pack',
    minutes: 30,
    price: 4.99,
    badge_fr: 'Populaire',
    badge_en: 'Popular',
    badgeColor: 'indigo',
  },
  {
    id: 'voice_60',
    name_fr: 'Pack Pro',
    name_en: 'Pro Pack',
    minutes: 60,
    price: 8.99,
    badge_fr: 'Meilleur rapport',
    badge_en: 'Best value',
    badgeColor: 'emerald',
  },
];

export const VoiceAddonModal: React.FC<VoiceAddonModalProps> = ({
  isOpen,
  onClose,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  currentPlan: _currentPlan,
  minutesRemaining,
}) => {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { language } = useTranslation();

  const tr = useCallback(
    (fr: string, en: string) => (language === 'fr' ? fr : en),
    [language]
  );

  const handlePurchase = async (pack: VoicePack) => {
    setLoadingPack(pack.id);
    setError(null);

    try {
      const data = await voiceApi.createAddonCheckout(pack.id);

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(tr('URL de paiement manquante', 'Missing checkout URL'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Erreur inattendue', 'Unexpected error'));
    } finally {
      setLoadingPack(null);
    }
  };

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={tr('Acheter des minutes vocales', 'Buy voice minutes')}
            className="relative w-full max-w-md bg-[#12121a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white z-10"
              aria-label={tr('Fermer', 'Close')}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 pt-8">
              {/* Header */}
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                <Mic className="w-7 h-7 text-indigo-400" />
              </div>

              <h2 className="text-lg font-semibold text-white text-center mb-1">
                {tr('Acheter des minutes vocales', 'Buy voice minutes')}
              </h2>

              <p className="text-white/50 text-sm text-center mb-6">
                {tr(
                  `Il vous reste ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} ce mois`,
                  `You have ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} remaining this month`
                )}
              </p>

              {/* Error */}
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Pack cards */}
              <div className="space-y-3">
                {VOICE_PACKS.map((pack) => {
                  const isPopular = pack.badgeColor === 'indigo';
                  const isBestValue = pack.badgeColor === 'emerald';
                  const isLoading = loadingPack === pack.id;

                  return (
                    <div
                      key={pack.id}
                      className={`
                        relative bg-white/5 rounded-xl p-4 transition-all duration-200
                        ${isPopular
                          ? 'border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/5'
                          : 'border border-white/10 hover:border-white/20'
                        }
                      `}
                    >
                      {/* Badge */}
                      {pack.badge_fr && (
                        <span
                          className={`
                            absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-xs font-medium
                            ${isPopular
                              ? 'bg-indigo-500 text-white'
                              : 'bg-emerald-500 text-white'
                            }
                          `}
                        >
                          {isBestValue ? (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              {tr(pack.badge_fr, pack.badge_en || '')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3" />
                              {tr(pack.badge_fr, pack.badge_en || '')}
                            </span>
                          )}
                        </span>
                      )}

                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm">
                            {tr(pack.name_fr, pack.name_en)}
                          </p>
                          <p className="text-2xl font-bold text-indigo-400 mt-0.5">
                            {pack.minutes} <span className="text-sm font-normal text-white/40">min</span>
                          </p>
                          <p className="text-lg text-white/70 font-medium">
                            {pack.price.toFixed(2)}&euro;
                          </p>
                        </div>

                        <button
                          onClick={() => handlePurchase(pack)}
                          disabled={loadingPack !== null}
                          className={`
                            flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200
                            ${isLoading
                              ? 'bg-indigo-500/50 text-white/70 cursor-wait'
                              : 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer active:scale-95'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                          aria-label={tr(
                            `Acheter ${pack.name_fr} - ${pack.minutes} minutes pour ${pack.price.toFixed(2)} euros`,
                            `Buy ${pack.name_en} - ${pack.minutes} minutes for ${pack.price.toFixed(2)} euros`
                          )}
                        >
                          {isLoading ? (
                            <DeepSightSpinnerMicro onLight />
                          ) : (
                            tr('Acheter', 'Buy')
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Upgrade link */}
              <button
                onClick={handleUpgrade}
                className="w-full mt-5 flex items-center justify-center gap-1.5 text-white/40 hover:text-indigo-400 text-xs transition-colors group"
              >
                <Sparkles className="w-3 h-3" />
                <span>
                  {tr(
                    'Ou passez au plan supérieur pour plus de minutes incluses',
                    'Or upgrade your plan for more included minutes'
                  )}
                </span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceAddonModal;
