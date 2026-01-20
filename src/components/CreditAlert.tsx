/**
 * CreditAlert v1.0 - Alert component for low credits
 * Shows warning when credits are running low to encourage upgrades
 */

import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

interface CreditAlertProps {
  /** Credits threshold below which to show warning (default: 50) */
  warningThreshold?: number;
  /** Credits threshold below which to show critical alert (default: 10) */
  criticalThreshold?: number;
  /** Whether to show the alert (can be controlled externally) */
  show?: boolean;
  /** Callback when alert is dismissed */
  onDismiss?: () => void;
  /** Position of the alert */
  position?: 'top' | 'bottom' | 'inline';
  /** Compact mode for smaller displays */
  compact?: boolean;
}

export const CreditAlert: React.FC<CreditAlertProps> = ({
  warningThreshold = 50,
  criticalThreshold = 10,
  show = true,
  onDismiss,
  position = 'top',
  compact = false,
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const [lastDismissedCredits, setLastDismissedCredits] = useState<number | null>(null);

  const credits = user?.credits ?? 0;
  const plan = user?.plan || 'free';

  // Don't show for unlimited plans
  if (plan === 'unlimited' || plan === 'expert') {
    return null;
  }

  // Determine alert level
  const isCritical = credits <= criticalThreshold && credits > 0;
  const isWarning = credits <= warningThreshold && credits > criticalThreshold;
  const isEmpty = credits <= 0;

  // Don't show if credits are above threshold
  if (!isEmpty && !isCritical && !isWarning) {
    return null;
  }

  // Reset dismissed state if credits changed significantly
  useEffect(() => {
    if (lastDismissedCredits !== null && Math.abs(credits - lastDismissedCredits) > 10) {
      setDismissed(false);
    }
  }, [credits, lastDismissedCredits]);

  // Don't show if dismissed and not critical
  if (dismissed && !isEmpty && !isCritical) {
    return null;
  }

  // Don't show if externally controlled to hide
  if (!show) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setLastDismissedCredits(credits);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    navigate('/upgrade');
  };

  // Alert styles based on level
  const alertStyles = isEmpty
    ? {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        icon: 'text-red-400',
      }
    : isCritical
    ? {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        icon: 'text-orange-400',
      }
    : {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        icon: 'text-amber-400',
      };

  // Messages based on level and language
  const getMessage = () => {
    if (isEmpty) {
      return language === 'fr'
        ? "Plus de crédits ! Passez à un plan supérieur pour continuer."
        : "Out of credits! Upgrade to continue.";
    }
    if (isCritical) {
      return language === 'fr'
        ? `Il ne vous reste que ${credits} crédits. Rechargez vite !`
        : `Only ${credits} credits left. Recharge soon!`;
    }
    return language === 'fr'
      ? `${credits} crédits restants. Pensez à upgrader.`
      : `${credits} credits remaining. Consider upgrading.`;
  };

  // Position classes
  const positionClasses = {
    top: 'fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)]',
    bottom: 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-2rem)]',
    inline: 'w-full',
  };

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${alertStyles.bg} border ${alertStyles.border} ${positionClasses[position]}`}
      >
        <AlertTriangle className={`w-4 h-4 ${alertStyles.icon} flex-shrink-0`} />
        <span className={`text-xs ${alertStyles.text} flex-1 truncate`}>
          {getMessage()}
        </span>
        <button
          onClick={handleUpgrade}
          className="flex items-center gap-1 px-2 py-1 rounded bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
        >
          <Zap className="w-3 h-3" />
          {language === 'fr' ? 'Upgrade' : 'Upgrade'}
        </button>
        {!isEmpty && (
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className={`w-3 h-3 ${alertStyles.text}`} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${alertStyles.bg} border ${alertStyles.border} rounded-xl p-4 shadow-lg ${positionClasses[position]}`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${alertStyles.bg}`}>
          <AlertTriangle className={`w-5 h-5 ${alertStyles.icon}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold ${alertStyles.text} mb-1`}>
            {isEmpty
              ? language === 'fr' ? 'Crédits épuisés' : 'Credits depleted'
              : isCritical
              ? language === 'fr' ? 'Crédits presque épuisés' : 'Credits almost depleted'
              : language === 'fr' ? 'Crédits bas' : 'Low credits'}
          </h4>
          <p className="text-sm text-text-secondary mb-3">
            {getMessage()}
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleUpgrade}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-accent-primary to-accent-secondary text-white font-medium text-sm hover:opacity-90 transition-opacity"
            >
              <Zap className="w-4 h-4" />
              {language === 'fr' ? 'Voir les plans' : 'View plans'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {plan === 'free' && (
              <span className="text-xs text-text-tertiary">
                {language === 'fr'
                  ? 'Dès 2,99€/mois'
                  : 'From €2.99/mo'}
              </span>
            )}
          </div>
        </div>

        {!isEmpty && (
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
            title={language === 'fr' ? 'Fermer' : 'Close'}
          >
            <X className={`w-4 h-4 ${alertStyles.text}`} />
          </button>
        )}
      </div>

      {/* Progress bar showing remaining credits */}
      <div className="mt-4 bg-bg-tertiary rounded-full h-2 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            isEmpty
              ? 'bg-red-500'
              : isCritical
              ? 'bg-orange-500'
              : 'bg-amber-500'
          }`}
          style={{
            width: `${Math.min(100, (credits / warningThreshold) * 100)}%`,
          }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-text-tertiary">
        <span>{credits} {language === 'fr' ? 'restants' : 'remaining'}</span>
        <span>{warningThreshold} {language === 'fr' ? 'seuil' : 'threshold'}</span>
      </div>
    </div>
  );
};

export default CreditAlert;
