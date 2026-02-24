/**
 * UpgradeModal — Global modal triggered by 403/429 API errors
 * Listens to 'show-upgrade-modal' CustomEvent
 * Variants: feature_locked, quota_exceeded, video_too_long
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, BarChart3, Clock, X, Sparkles, ArrowRight } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

interface UpgradeModalData {
  type: 'feature_locked' | 'quota_exceeded' | 'video_too_long';
  feature_label?: string;
  required_plan?: string;
  required_plan_name?: string;
  required_plan_price?: number;
  message?: string;
  upgrade_url?: string;
  limit?: number;
  used?: number;
  video_duration_min?: number;
  max_duration_min?: number;
}

export const UpgradeModal: React.FC = () => {
  const [data, setData] = useState<UpgradeModalData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { language } = useTranslation();

  const tr = useCallback(
    (fr: string, en: string) => language === 'fr' ? fr : en,
    [language]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as UpgradeModalData;
      if (detail?.type) {
        setData(detail);
        setIsOpen(true);
      }
    };
    window.addEventListener('show-upgrade-modal', handler);
    return () => window.removeEventListener('show-upgrade-modal', handler);
  }, []);

  const close = () => {
    setIsOpen(false);
    setTimeout(() => setData(null), 300);
  };

  const handleUpgrade = () => {
    close();
    navigate('/upgrade');
  };

  if (!data) return null;

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
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-md bg-bg-secondary/95 backdrop-blur-xl border border-border-subtle rounded-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-bg-hover transition-colors text-text-tertiary hover:text-text-primary z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 pt-8">
              {/* === FEATURE LOCKED === */}
              {data.type === 'feature_locked' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary text-center mb-2">
                    {data.feature_label || tr('Fonctionnalité verrouillée', 'Feature locked')}
                  </h3>
                  <p className="text-text-secondary text-sm text-center mb-6">
                    {tr(
                      `Disponible dès le plan ${data.required_plan_name || 'supérieur'}`,
                      `Available from the ${data.required_plan_name || 'higher'} plan`
                    )}
                    {data.required_plan_price != null && (
                      <span className="block mt-1 text-accent-primary font-semibold">
                        {(data.required_plan_price / 100).toFixed(2)}/{tr('mois', 'mo')}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-primary to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" />
                    {tr(
                      `Passer à ${data.required_plan_name || 'un plan supérieur'}`,
                      `Upgrade to ${data.required_plan_name || 'a higher plan'}`
                    )}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* === QUOTA EXCEEDED === */}
              {data.type === 'quota_exceeded' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="w-8 h-8 text-red-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary text-center mb-2">
                    {tr('Quota atteint', 'Quota exceeded')}
                    {data.limit != null && data.used != null && (
                      <span className="text-text-tertiary text-sm font-normal ml-2">
                        ({data.used}/{data.limit})
                      </span>
                    )}
                  </h3>
                  {data.limit != null && (
                    <div className="mx-auto max-w-xs mb-4">
                      <div className="h-2 rounded-full bg-bg-hover overflow-hidden">
                        <div className="h-full rounded-full bg-red-500 w-full" />
                      </div>
                    </div>
                  )}
                  <p className="text-text-secondary text-sm text-center mb-6">
                    {data.message || tr(
                      'Vous avez atteint la limite de votre plan actuel.',
                      'You have reached the limit of your current plan.'
                    )}
                  </p>
                  <button
                    onClick={handleUpgrade}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-primary to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" />
                    {tr('Voir les plans', 'See plans')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* === VIDEO TOO LONG === */}
              {data.type === 'video_too_long' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary text-center mb-2">
                    {tr('Vidéo trop longue', 'Video too long')}
                  </h3>
                  <p className="text-text-secondary text-sm text-center mb-2">
                    {data.video_duration_min != null && data.max_duration_min != null
                      ? tr(
                          `Cette vidéo dure ${data.video_duration_min} min (max ${data.max_duration_min} min sur votre plan).`,
                          `This video is ${data.video_duration_min} min long (max ${data.max_duration_min} min on your plan).`
                        )
                      : data.message || tr(
                          'Cette vidéo dépasse la durée maximale de votre plan.',
                          'This video exceeds the maximum duration of your plan.'
                        )
                    }
                  </p>
                  <div className="text-xs text-text-tertiary text-center space-y-0.5 mb-6">
                    <p>Starter: 120 min &middot; Pro: 240 min &middot; {tr('Équipe', 'Team')}: {tr('Illimité', 'Unlimited')}</p>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-primary to-purple-600 text-white font-medium hover:opacity-90 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" />
                    {tr('Voir les plans', 'See plans')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Dismiss */}
              <button
                onClick={close}
                className="w-full mt-3 px-4 py-2.5 rounded-xl text-text-tertiary hover:text-text-secondary text-sm transition-colors"
              >
                {tr('Plus tard', 'Later')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpgradeModal;
