/**
 * FreeTrialLimitModal v1.0 - Modal shown after free analyses to encourage upgrade
 * Shows after user completes their 3rd free analysis
 */

import React, { useState, useEffect } from 'react';
import { X, Zap, GraduationCap, Star, Crown, Sparkles, ArrowRight, Check, Clock, BookOpen, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

interface FreeTrialLimitModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Number of analyses done this month */
  analysisCount: number;
  /** Maximum free analyses allowed */
  maxFreeAnalyses?: number;
  /** Time saved on this analysis (in seconds) */
  timeSavedSeconds?: number;
}

export const FreeTrialLimitModal: React.FC<FreeTrialLimitModalProps> = ({
  isOpen,
  onClose,
  analysisCount,
  maxFreeAnalyses = 4,
  timeSavedSeconds = 0,
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showTestimonial, setShowTestimonial] = useState(0);

  const plan = user?.plan || 'free';
  const isLastFreeAnalysis = analysisCount >= maxFreeAnalyses;
  const isAlmostOut = analysisCount >= maxFreeAnalyses - 1;

  // Testimonials rotation
  const testimonials = [
    {
      text: language === 'fr'
        ? "En tant qu'étudiant en médecine, Deep Sight m'a fait gagner 10h/semaine sur mes révisions."
        : "As a medical student, Deep Sight saves me 10h/week on my revision.",
      author: "Marie, L3 Médecine",
      avatar: "🎓"
    },
    {
      text: language === 'fr'
        ? "J'analyse les vidéos de mes concurrents en 2 min au lieu de 2h. Indispensable !"
        : "I analyze competitor videos in 2 min instead of 2h. Essential!",
      author: "Thomas, YouTuber",
      avatar: "🎬"
    },
    {
      text: language === 'fr'
        ? "Les fiches de révision automatiques ont transformé ma façon d'apprendre."
        : "Automatic study notes have transformed how I learn.",
      author: "Sophie, Prépa HEC",
      avatar: "📚"
    }
  ];

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setShowTestimonial((prev) => (prev + 1) % testimonials.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isOpen, testimonials.length]);

  if (!isOpen || plan !== 'free') return null;

  const formatTimeSaved = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)} sec`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}min`;
  };

  const handleUpgrade = () => {
    onClose();
    navigate('/upgrade');
  };

  const handleSelectStudent = () => {
    onClose();
    navigate('/upgrade?plan=student');
  };

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
        <div className="relative p-6 pb-4 text-center bg-gradient-to-br from-accent-primary/10 to-accent-secondary/10">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-accent-secondary/20 rounded-full blur-3xl" />
          </div>

          <div className="relative">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center shadow-lg">
              {isLastFreeAnalysis ? (
                <Zap className="w-10 h-10 text-white" />
              ) : (
                <Sparkles className="w-10 h-10 text-white" />
              )}
            </div>

            {/* Title */}
            <h2 className="text-2xl font-bold text-text-primary mb-2">
              {isLastFreeAnalysis
                ? language === 'fr' ? 'Dernière analyse gratuite !' : 'Last free analysis!'
                : language === 'fr' ? 'Analyse terminée !' : 'Analysis complete!'}
            </h2>

            {/* Subtitle with usage */}
            <p className="text-text-secondary">
              {language === 'fr'
                ? `Vous avez utilisé ${analysisCount}/${maxFreeAnalyses} analyses gratuites ce mois-ci`
                : `You've used ${analysisCount}/${maxFreeAnalyses} free analyses this month`}
            </p>

            {/* Progress bar */}
            <div className="mt-4 mx-auto max-w-xs">
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    isLastFreeAnalysis ? 'bg-red-500' : isAlmostOut ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${(analysisCount / maxFreeAnalyses) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Value proposition */}
        {timeSavedSeconds > 0 && (
          <div className="px-6 py-3 bg-green-500/10 border-y border-green-500/20">
            <div className="flex items-center justify-center gap-3">
              <Clock className="w-5 h-5 text-green-400" />
              <span className="text-green-400 font-medium">
                {language === 'fr'
                  ? `Cette analyse vous a fait économiser ~${formatTimeSaved(timeSavedSeconds)}`
                  : `This analysis saved you ~${formatTimeSaved(timeSavedSeconds)}`}
              </span>
            </div>
          </div>
        )}

        {/* Benefits grid */}
        <div className="px-6 py-4">
          <p className="text-xs text-text-tertiary uppercase tracking-wide mb-3 text-center">
            {language === 'fr' ? 'Passez à un plan payant pour' : 'Upgrade to get'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <Brain className="w-5 h-5 text-purple-400" />
              <span className="text-sm text-text-secondary">
                {language === 'fr' ? 'Analyses illimitées' : 'Unlimited analyses'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <BookOpen className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-text-secondary">
                {language === 'fr' ? 'Fiches de révision' : 'Study flashcards'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <Star className="w-5 h-5 text-yellow-400" />
              <span className="text-sm text-text-secondary">
                {language === 'fr' ? 'Chat IA avancé' : 'Advanced AI chat'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-bg-tertiary/50">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-sm text-text-secondary">
                {language === 'fr' ? 'Export PDF/Markdown' : 'PDF/Markdown export'}
              </span>
            </div>
          </div>
        </div>

        {/* Testimonial */}
        <div className="px-6 py-3">
          <div className="p-4 rounded-xl bg-bg-tertiary/30 border border-border-subtle">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{testimonials[showTestimonial].avatar}</div>
              <div>
                <p className="text-sm text-text-secondary italic mb-2">
                  "{testimonials[showTestimonial].text}"
                </p>
                <p className="text-xs text-text-tertiary">
                  — {testimonials[showTestimonial].author}
                </p>
              </div>
            </div>
            {/* Dots indicator */}
            <div className="flex justify-center gap-1 mt-3">
              {testimonials.map((_, idx) => (
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

        {/* Student plan highlight */}
        <div className="px-6 py-3">
          <div
            className="relative p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 cursor-pointer hover:scale-[1.02] transition-transform"
            onClick={handleSelectStudent}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-text-primary">
                      {language === 'fr' ? 'Plan Étudiant' : 'Student Plan'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                      {language === 'fr' ? 'Populaire' : 'Popular'}
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {language === 'fr' ? '40 analyses/mois • Fiches de révision' : '40 analyses/mo • Study flashcards'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">2,99€</p>
                <p className="text-xs text-text-tertiary">/{language === 'fr' ? 'mois' : 'mo'}</p>
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
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-text-secondary text-sm hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            {isLastFreeAnalysis
              ? language === 'fr' ? 'Continuer sans upgrader' : 'Continue without upgrading'
              : language === 'fr' ? 'Peut-être plus tard' : 'Maybe later'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 pb-4 text-center border-t border-border-subtle pt-4">
          <p className="text-xs text-text-tertiary">
            {language === 'fr'
              ? '✨ Annulez à tout moment • Paiement sécurisé par Stripe'
              : '✨ Cancel anytime • Secure payment via Stripe'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FreeTrialLimitModal;
