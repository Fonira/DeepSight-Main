/**
 * CreditCounter v2.0 - Persistent credit counter with visual alerts
 * Shows remaining credits with color-coded urgency levels
 *
 * Aligned with new pricing strategy:
 * - Free: 150 credits, 3 analyses
 * - Student: 2000 credits
 * - Starter: 3000 credits
 * - Pro: 15000 credits
 * - Team: 50000 credits
 */

import React, { useMemo } from 'react';
import { Coins, Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import {
  normalizePlanId,
  PLAN_LIMITS,
  shouldShowLowCreditsAlert
} from '../config/planPrivileges';

interface CreditCounterProps {
  /** Display mode */
  variant?: 'default' | 'compact' | 'minimal';
  /** Show upgrade button */
  showUpgradeButton?: boolean;
  /** Custom class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
  /** Show analyses count too */
  showAnalyses?: boolean;
  /** Current month's analyses used */
  analysesUsed?: number;
}

export const CreditCounter: React.FC<CreditCounterProps> = ({
  variant = 'default',
  showUpgradeButton = true,
  className = '',
  onClick,
  showAnalyses = false,
  analysesUsed = 0,
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();

  const credits = user?.credits ?? 0;
  const plan = normalizePlanId(user?.plan);
  const planLimits = PLAN_LIMITS[plan];
  const maxCredits = planLimits.monthlyCredits;
  const maxAnalyses = planLimits.monthlyAnalyses;

  // Calculate urgency level based on plan and credits
  const urgency = useMemo(() => {
    // Team plan with huge limits - check if still good
    if (plan === 'team' && maxCredits >= 50000) {
      const alertLevel = shouldShowLowCreditsAlert(credits, maxCredits);
      if (alertLevel === 'critical') {
        return { level: 'critical', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
      }
      if (alertLevel === 'warning') {
        return { level: 'warning', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
      }
      return { level: 'none', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    }

    // Use conversion triggers thresholds (percentage-based)
    const alertLevel = shouldShowLowCreditsAlert(credits, maxCredits);

    if (credits <= 0) {
      return { level: 'empty', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    }
    if (alertLevel === 'critical') {
      return { level: 'critical', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    }
    if (alertLevel === 'warning') {
      return { level: 'warning', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    }
    return { level: 'good', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  }, [credits, plan, maxCredits]);

  const handleUpgrade = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/upgrade');
  };

  const formatCredits = (value: number): string => {
    if (value >= 999999) return '∞';
    if (value >= 10000) return `${Math.floor(value / 1000)}k`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toLocaleString();
  };

  // Minimal variant - just the number
  if (variant === 'minimal') {
    return (
      <div
        className={`flex items-center gap-1.5 ${urgency.color} ${className}`}
        onClick={onClick}
      >
        <Coins className="w-4 h-4" />
        <span className="font-medium tabular-nums">{formatCredits(credits)}</span>
      </div>
    );
  }

  // Compact variant - small badge
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${urgency.bg} border ${urgency.border} ${className}`}
        onClick={onClick}
      >
        {urgency.level === 'empty' || urgency.level === 'critical' ? (
          <AlertTriangle className={`w-4 h-4 ${urgency.color}`} />
        ) : (
          <Coins className={`w-4 h-4 ${urgency.color}`} />
        )}
        <span className={`font-medium tabular-nums ${urgency.color}`}>
          {formatCredits(credits)}
        </span>
        {showUpgradeButton && (urgency.level === 'empty' || urgency.level === 'critical') && (
          <button
            onClick={handleUpgrade}
            className="ml-1 p-1 rounded bg-accent-primary/20 hover:bg-accent-primary/30 transition-colors"
          >
            <Zap className="w-3 h-3 text-accent-primary" />
          </button>
        )}
      </div>
    );
  }

  // Default variant - full display
  return (
    <div
      className={`p-3 rounded-xl ${urgency.bg} border ${urgency.border} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {urgency.level === 'empty' || urgency.level === 'critical' ? (
            <AlertTriangle className={`w-5 h-5 ${urgency.color}`} />
          ) : (
            <Coins className={`w-5 h-5 ${urgency.color}`} />
          )}
          <span className="text-sm font-medium text-text-primary">
            {language === 'fr' ? 'Crédits' : 'Credits'}
          </span>
        </div>
        <span className={`text-xl font-bold tabular-nums ${urgency.color}`}>
          {formatCredits(credits)}
        </span>
      </div>

      {/* Message based on urgency */}
      {urgency.level !== 'none' && urgency.level !== 'good' && (
        <p className={`text-xs ${urgency.color} mb-2`}>
          {urgency.level === 'empty'
            ? language === 'fr' ? '⚠️ Plus de crédits !' : '⚠️ Out of credits!'
            : urgency.level === 'critical'
            ? language === 'fr' ? '🔴 Crédits presque épuisés' : '🔴 Credits almost depleted'
            : language === 'fr' ? '🟡 Pensez à recharger' : '🟡 Consider recharging'}
        </p>
      )}

      {/* Analyses count for free users */}
      {showAnalyses && plan === 'free' && maxAnalyses > 0 && (
        <div className="mb-2 p-2 rounded-lg bg-bg-tertiary/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {language === 'fr' ? 'Analyses' : 'Analyses'}
            </span>
            <span className={analysesUsed >= maxAnalyses ? 'text-red-400 font-medium' : 'text-text-primary'}>
              {analysesUsed}/{maxAnalyses}
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${analysesUsed >= maxAnalyses ? 'bg-red-500' : analysesUsed >= maxAnalyses - 1 ? 'bg-amber-500' : 'bg-green-500'}`}
              style={{ width: `${Math.min((analysesUsed / maxAnalyses) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Credits progress bar */}
      {maxCredits > 0 && urgency.level !== 'none' && (
        <div className="mb-2">
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${urgency.color.replace('text-', 'bg-')}`}
              style={{ width: `${Math.min((credits / maxCredits) * 100, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-text-tertiary">
            <span>{formatCredits(credits)}</span>
            <span>{formatCredits(maxCredits)}</span>
          </div>
        </div>
      )}

      {/* Upgrade button */}
      {showUpgradeButton && plan !== 'team' && (
        <button
          onClick={handleUpgrade}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 hover:from-accent-primary/30 hover:to-accent-secondary/30 text-accent-primary text-sm font-medium transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          {urgency.level === 'empty' || urgency.level === 'critical'
            ? (language === 'fr' ? 'Recharger maintenant' : 'Recharge now')
            : (language === 'fr' ? 'Obtenir plus' : 'Get more')}
        </button>
      )}
    </div>
  );
};

export default CreditCounter;
