/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 USAGE PROGRESS — Barre de progression des crédits                              ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface UsageProgressProps {
  creditsUsed: number;
  creditsTotal: number;
  creditsRemaining: number;
  renewalDate?: string;
  language?: 'fr' | 'en';
  className?: string;
}

export const UsageProgress: React.FC<UsageProgressProps> = ({
  creditsUsed,
  creditsTotal,
  creditsRemaining,
  renewalDate,
  language = 'fr',
  className = ''
}) => {
  const percentUsed = creditsTotal > 0 ? (creditsUsed / creditsTotal) * 100 : 0;
  const percentRemaining = 100 - percentUsed;
  
  // Déterminer le niveau d'alerte
  const getAlertLevel = () => {
    if (percentRemaining <= 10) return 'critical';
    if (percentRemaining <= 25) return 'warning';
    return 'normal';
  };
  
  const alertLevel = getAlertLevel();
  
  const getProgressColor = () => {
    switch (alertLevel) {
      case 'critical': return 'bg-rose-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-emerald-500';
    }
  };
  
  const getAlertBg = () => {
    switch (alertLevel) {
      case 'critical': return 'bg-rose-500/10 border-rose-500/30';
      case 'warning': return 'bg-amber-500/10 border-amber-500/30';
      default: return '';
    }
  };
  
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  return (
    <div className={`card p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Zap className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">
              {language === 'fr' ? 'Crédits' : 'Credits'}
            </h3>
            <p className="text-xs text-text-tertiary">
              {language === 'fr' ? 'Ce mois-ci' : 'This month'}
            </p>
          </div>
        </div>
        
        {/* Status badge */}
        {alertLevel !== 'normal' && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getAlertBg()}`}>
            <AlertTriangle className={`w-3.5 h-3.5 ${alertLevel === 'critical' ? 'text-rose-500' : 'text-amber-500'}`} />
            <span className={alertLevel === 'critical' ? 'text-rose-500' : 'text-amber-500'}>
              {alertLevel === 'critical' 
                ? (language === 'fr' ? 'Bientôt épuisés' : 'Almost depleted')
                : (language === 'fr' ? 'Attention' : 'Low')
              }
            </span>
          </div>
        )}
      </div>
      
      {/* Main display */}
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-3xl font-bold text-text-primary tabular-nums">
            {formatNumber(creditsRemaining)}
          </p>
          <p className="text-sm text-text-secondary">
            {language === 'fr' ? 'crédits restants' : 'credits remaining'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-text-tertiary">
            <span className="text-text-secondary font-medium">{formatNumber(creditsUsed)}</span>
            {' '}{language === 'fr' ? 'utilisés' : 'used'}
          </p>
          <p className="text-xs text-text-muted">
            / {formatNumber(creditsTotal)} {language === 'fr' ? 'mensuels' : 'monthly'}
          </p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="relative h-3 bg-bg-tertiary rounded-full overflow-hidden mb-3">
        {/* Background gradient for visual appeal */}
        <div 
          className={`absolute inset-y-0 left-0 ${getProgressColor()} transition-all duration-700 ease-out`}
          style={{ width: `${percentUsed}%` }}
        />
        {/* Animated shimmer effect */}
        <div 
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          style={{ 
            transform: 'translateX(-100%)',
            animation: 'shimmer 2s infinite'
          }}
        />
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${getProgressColor()}`} />
            <span className="text-text-tertiary">
              {language === 'fr' ? 'Utilisés' : 'Used'} ({percentUsed.toFixed(0)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-bg-tertiary" />
            <span className="text-text-tertiary">
              {language === 'fr' ? 'Disponibles' : 'Available'} ({percentRemaining.toFixed(0)}%)
            </span>
          </div>
        </div>
        
        {renewalDate && (
          <span className="text-text-muted">
            {language === 'fr' ? 'Renouvellement:' : 'Renewal:'} {renewalDate}
          </span>
        )}
      </div>
      
      {/* Tip for low credits */}
      {alertLevel !== 'normal' && (
        <div className={`mt-4 p-3 rounded-lg border ${getAlertBg()}`}>
          <p className="text-xs text-text-secondary">
            💡 {language === 'fr' 
              ? 'Passez à un plan supérieur pour plus de crédits ou attendez le renouvellement.'
              : 'Upgrade to a higher plan for more credits or wait for renewal.'
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default UsageProgress;
