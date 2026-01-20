/**
 * CreditCounter v1.0 - Persistent credit counter with visual alerts
 * Shows remaining credits with color-coded urgency levels
 */

import React, { useMemo } from 'react';
import { Coins, Zap, AlertTriangle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

interface CreditCounterProps {
  /** Display mode */
  variant?: 'default' | 'compact' | 'minimal';
  /** Show upgrade button */
  showUpgradeButton?: boolean;
  /** Custom class name */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

export const CreditCounter: React.FC<CreditCounterProps> = ({
  variant = 'default',
  showUpgradeButton = true,
  className = '',
  onClick,
}) => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();

  const credits = user?.credits ?? 0;
  const plan = user?.plan || 'free';

  // Calculate urgency level based on plan and credits
  const urgency = useMemo(() => {
    // Unlimited plans don't have urgency
    if (plan === 'unlimited' || plan === 'expert') {
      return { level: 'none', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    }

    // Define thresholds based on plan
    const thresholds = {
      free: { critical: 50, warning: 100 },
      student: { critical: 200, warning: 500 },
      starter: { critical: 500, warning: 1000 },
      pro: { critical: 2000, warning: 5000 },
    };

    const planThresholds = thresholds[plan as keyof typeof thresholds] || thresholds.free;

    if (credits <= 0) {
      return { level: 'empty', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' };
    }
    if (credits <= planThresholds.critical) {
      return { level: 'critical', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' };
    }
    if (credits <= planThresholds.warning) {
      return { level: 'warning', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' };
    }
    return { level: 'good', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
  }, [credits, plan]);

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

      {/* Upgrade button */}
      {showUpgradeButton && plan !== 'unlimited' && plan !== 'expert' && (
        <button
          onClick={handleUpgrade}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-accent-primary/20 to-accent-secondary/20 hover:from-accent-primary/30 hover:to-accent-secondary/30 text-accent-primary text-sm font-medium transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          {language === 'fr' ? 'Obtenir plus' : 'Get more'}
        </button>
      )}
    </div>
  );
};

export default CreditCounter;
