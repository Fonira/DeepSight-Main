/**
 * FreeTrialLimitModal v2.0 - Modal shown after free analyses to encourage upgrade
 * Shows after user completes their analyses (warning at 2, block at 3)
 *
 * Aligned with new pricing strategy:
 * - Maximum friction for free users (3 analyses/month)
 * - Student plan highlighted as best entry point (2.99€)
 * - Pro trial option available (7 days)
 */

import React, { useState, useEffect } from 'react';
import { X, Zap, GraduationCap, Star, Crown, Sparkles, ArrowRight, Check, Clock, BookOpen, Brain, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import {
  normalizePlanId,
  CONVERSION_TRIGGERS,
  TESTIMONIALS,
  PLANS_INFO,
  calculateTimeSaved
} from '../config/planPrivileges';

interface FreeTrialLimitModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Number of analyses done this month */
  analysisCount: number;
  /** Video duration in seconds (for time saved calculation) */
  videoDurationSeconds?: number;
}

export const FreeTrialLimitModal: React.FC<FreeTrialLimitModalProps> = ({
  isOpen,
  onClose,
  analysisCount,
  videoDurationSeconds = 0,
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showTestimonial, setShowTestimonial] = useState(0);

  const plan = normalizePlanId(user?.plan);
  const maxFreeAnalyses = CONVERSION_TRIGGERS.freeAnalysisLimit;
  const warningThreshold = CONVERSION_TRIGGERS.freeAnalysisWarning;

  const isBlocked = analysisCount >= maxFreeAnalyses;
  const isWarning = analysisCount >= warningThreshold && !isBlocked;
  const remainingAnalyses = Math.max(0, maxFreeAnalyses - analysisCount);

  // Calculate time saved
  const timeSaved = videoDurationSeconds > 0 ? calculateTimeSaved(videoDurationSeconds) : null;

  const t = (fr: string, en: string) => language === 'fr' ? fr : en;

  // Get testimonials for display
  const displayTestimonials = TESTIMONIALS.filter(t => t.plan === 'student' || t.plan === 'pro').slice(0, 3);

  useEffect(() => {
    if (isOpen && displayTestimonials.length > 0) {
      const interval = setInterval(() => {
        setShowTestimonial((prev) => (prev + 1) % displayTestimonials.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, displayTestimonials.length]);

  if (!isOpen || plan !== 'free') return null;

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  const handleSelectStudent = () => {
    onClose();
    navigate('/upgrade?plan=student');
  };

  const handleStartTrial = () => {
    onClose();
    navigate('/upgrade?trial=true');
  };

  // Get student plan info
  const studentPlan = PLANS_INFO.find(p => p.id === 'student')!;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="card max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-bg-tertiary rounded-lg transition-colors z-10"
        >
          <X className="w-5 h-5 text-text-tertiary" />
        </button>

        {/* Header with gradient */}
        <div className={`relative p-6 pb-4 text-center bg-gradient-to-br ${isBlocked ? 'from-red-500/10 to-orange-500/10' : 'from-accent-primary/10 to-accent-secondary/10'}`}>
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute -top-10 -right-10 w-40 h-40 ${isBlocked ? 'bg-red-500/20' : 'bg-accent-primary/20'} rounded-full blur-3xl`} />
            <div className={`absolute -bottom-10 -left-10 w-40 h-40 ${isBlocked ? 'bg-orange-500/20' : 'bg-accent-secondary/20'} rounded-full blur-3xl`} />
          </div>

          <div className="relative">
            {/* Icon */}
            <div className={`w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${isBlocked ? 'from-red-500 to-orange-500' : 'from-accent-primary to-accent-secondary'} flex items-center justify-center shadow-lg`}>
              {isBlocked ? (
                <Zap className="w-10 h-10 text-white" />
              ) : (
                <Sparkles className="w-10 h-10 text-white" />
              )}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {isBlocked
                ? t('Limite atteinte !', 'Limit reached!')
                : isWarning
                ? t('Plus qu\'une analyse !', 'One analysis left!')
                : t('Analyse terminée !', 'Analysis complete!')}
            </h2>

            {/* Subtitle with usage */}
            <p className="text-text-secondary">
              {isBlocked
                ? t(
                    `Vous avez utilisé vos ${maxFreeAnalyses} analyses gratuites ce mois`,
                    `You've used all ${maxFreeAnalyses} free analyses this month`
                  )
                : t(
                    `${analysisCount}/${maxFreeAnalyses} analyses utilisées - ${remainingAnalyses} restante${remainingAnalyses > 1 ? 's' : ''}`,
                    `${analysisCount}/${maxFreeAnalyses} analyses used - ${remainingAnalyses} remaining`
                  )}
            </p>

            {/* Progress bar */}
            <div className="mt-4 mx-auto max-w-xs">
              <div className="h-2.5 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isBlocked ? 'bg-red-500' : isWarning ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min((analysisCount / maxFreeAnalyses) * 100, 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-text-tertiary">
                <span>0</span>
                <span>{maxFreeAnalyses}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time saved value proposition */}
        {timeSaved && timeSaved.minutes > 0 && (
          <div className="px-6 py-3 bg-green-500/10 border-y border-green-500/20">
            <div className="flex items-center justify-center gap-3">
              <Clock className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">
                {t(
                  `Cette analyse vous a fait économiser ~${timeSaved.minutes} min (${timeSaved.equivalent} de notes)`,
                  `This analysis saved you ~${timeSaved.minutes} min (${timeSaved.equivalent} of notes)`
                )}
              </span>
            </div>
          </div>
        )}

        {/* Trial banner for blocked users */}
        {isBlocked && CONVERSION_TRIGGERS.trialEnabled && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Crown className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-text-primary">
                  {t('Essai Pro gratuit', 'Free Pro trial')}
                </p>
                <p className="text-xs text-text-secondary">
                  {t(
                    `${CONVERSION_TRIGGERS.trialDays} jours • 300 analyses • Playlists`,
                    `${CONVERSION_TRIGGERS.trialDays} days • 300 analyses • Playlists`
                  )}
                </p>
              </div>
              <button
                onClick={handleStartTrial}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold hover:opacity-90 transition-opacity"
              >
                {t('Essayer', 'Try it')}
              </button>
            </div>
          </div>
        )}

        {/* Benefits grid - what they're missing */}
        <div className="px-6 py-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3 text-center">
            {t('Ce que vous débloquez', 'What you unlock')}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-sm text-text-secondary">
                {t('40+ analyses/mois', '40+ analyses/mo')}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-text-secondary">
                {t('Flashcards auto', 'Auto flashcards')}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-text-secondary">
                {t('Cartes mentales', 'Mind maps')}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <Star className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-text-secondary">
                {t('Export PDF/BibTeX', 'PDF/BibTeX export')}
              </span>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        {displayTestimonials.length > 0 && (
          <div className="px-6 py-3">
            <div className="p-4 rounded-xl bg-bg-tertiary/30 border border-border-subtle">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{displayTestimonials[showTestimonial]?.avatar || '🎓'}</div>
                <div>
                  <p className="text-sm text-text-secondary italic mb-2">
                    "{displayTestimonials[showTestimonial]?.text[language === 'fr' ? 'fr' : 'en']}"
                  </p>
                  <p className="text-xs text-text-tertiary">
                    — {displayTestimonials[showTestimonial]?.author}, {displayTestimonials[showTestimonial]?.role[language === 'fr' ? 'fr' : 'en']}
                  </p>
                </div>
              </div>
              {/* Dots indicator */}
              <div className="flex justify-center gap-1 mt-3">
                {displayTestimonials.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      idx === showTestimonial ? 'bg-accent-primary' : 'bg-bg-tertiary'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Student plan highlight - best value entry */}
        <div className="px-6 py-3">
          <div
            className={`relative p-4 rounded-xl bg-gradient-to-br ${studentPlan.gradient} bg-opacity-10 border border-emerald-500/30 cursor-pointer hover:scale-[1.02] transition-transform`}
            onClick={handleSelectStudent}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/5 rounded-xl" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-text-primary">
                      {studentPlan.name[language === 'fr' ? 'fr' : 'en']}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      {studentPlan.badge?.[language === 'fr' ? 'fr' : 'en'] || t('Étudiants', 'Students')}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {studentPlan.killerFeature[language === 'fr' ? 'fr' : 'en']}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-400">
                  {(studentPlan.price / 100).toFixed(2).replace('.', ',')}€
                </p>
                <p className="text-xs text-text-tertiary">/{t('mois', 'mo')}</p>
              </div>
            </div>

            {/* Features list */}
            <div className="relative mt-3 grid grid-cols-2 gap-2">
              {[
                t('40 analyses/mois', '40 analyses/mo'),
                t('Flashcards & mind maps', 'Flashcards & mind maps'),
                t('Export PDF & BibTeX', 'PDF & BibTeX export'),
                t('TTS audio', 'TTS audio'),
              ].map((feature, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span>{feature}</span>
                </div>
              ))}
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
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-text-secondary text-sm hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {isBlocked
              ? t('Attendre le mois prochain', 'Wait until next month')
              : t('Peut-être plus tard', 'Maybe later')}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 text-center border-t border-border-subtle pt-4">
          <p className="text-xs text-text-tertiary">
            {t(
              'Annulez à tout moment • Paiement sécurisé par Stripe',
              'Cancel anytime • Secure payment via Stripe'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FreeTrialLimitModal;
