/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 STAT CARD — Carte de statistique avec icône et valeur                          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'rose' | 'cyan';
  trend?: {
    value: number;
    label?: string;
  };
  progress?: {
    current: number;
    max: number;
  };
  className?: string;
}

const colorClasses: Record<string, { bg: string; icon: string; progress: string; trend: string }> = {
  blue: { 
    bg: 'bg-blue-500/10', 
    icon: 'text-blue-500', 
    progress: 'bg-blue-500',
    trend: 'text-blue-500'
  },
  green: { 
    bg: 'bg-emerald-500/10', 
    icon: 'text-emerald-500', 
    progress: 'bg-emerald-500',
    trend: 'text-emerald-500'
  },
  purple: { 
    bg: 'bg-purple-500/10', 
    icon: 'text-purple-500', 
    progress: 'bg-purple-500',
    trend: 'text-purple-500'
  },
  amber: { 
    bg: 'bg-amber-500/10', 
    icon: 'text-amber-500', 
    progress: 'bg-amber-500',
    trend: 'text-amber-500'
  },
  rose: { 
    bg: 'bg-rose-500/10', 
    icon: 'text-rose-500', 
    progress: 'bg-rose-500',
    trend: 'text-rose-500'
  },
  cyan: { 
    bg: 'bg-cyan-500/10', 
    icon: 'text-cyan-500', 
    progress: 'bg-cyan-500',
    trend: 'text-cyan-500'
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color = 'blue',
  trend,
  progress,
  className = ''
}) => {
  const colors = colorClasses[color] || colorClasses.blue;
  
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="w-3.5 h-3.5" />;
    if (trend.value < 0) return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };
  
  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-emerald-500';
    if (trend.value < 0) return 'text-rose-500';
    return 'text-text-tertiary';
  };

  return (
    <div className={`card p-5 hover:shadow-lg transition-shadow ${className}`}>
      {/* Header avec icône */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        
        {/* Trend indicator */}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${getTrendColor()}`}>
            {getTrendIcon()}
            <span>{trend.value > 0 ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
      
      {/* Title */}
      <h3 className="text-sm text-text-secondary mb-1 font-medium">{title}</h3>
      
      {/* Value */}
      <div className="text-2xl font-bold text-text-primary tabular-nums">
        {value}
      </div>
      
      {/* Subtitle ou Trend label */}
      {(subtitle || trend?.label) && (
        <p className="text-xs text-text-tertiary mt-1">
          {subtitle || trend?.label}
        </p>
      )}
      
      {/* Progress bar */}
      {progress && progress.max > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-text-tertiary mb-1">
            <span>{progress.current.toLocaleString()}</span>
            <span>/ {progress.max.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
            <div 
              className={`h-full ${colors.progress} transition-all duration-500 ease-out`} 
              style={{ width: `${Math.min(100, (progress.current / progress.max) * 100)}%` }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StatCard;
