/**
 * 🕐 FRESHNESS INDICATOR — Indicateur de fraîcheur vidéo
 * ═══════════════════════════════════════════════════════════════════════════════
 * Affiche un avertissement intelligent basé sur :
 * - L'âge de la vidéo
 * - Le type de sujet (tech, politique, finance = évolution rapide)
 * - Des recommandations de vérification
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { 
  Clock, AlertTriangle, Info, CheckCircle, 
  ChevronDown, ChevronUp, RefreshCw,
  TrendingUp, Zap
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FreshnessData {
  level: 'fresh' | 'recent' | 'aging' | 'old' | 'outdated';
  age_days: number;
  warning_message: string | null;
  warning_level: 'none' | 'info' | 'warning' | 'critical';
  is_fast_changing_topic: boolean;
  topic_category: string | null;
  recommendations: string[];
}

interface FreshnessIndicatorProps {
  summaryId: number;
  videoTitle?: string;
  /** Données pré-chargées (optionnel, sinon fetch automatique) */
  freshnessData?: FreshnessData;
  /** Callback quand on demande une vérification */
  onRequestVerification?: () => void;
  /** Mode compact pour la sidebar */
  compact?: boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION VISUELLE
// ═══════════════════════════════════════════════════════════════════════════════

const LEVEL_CONFIG = {
  fresh: {
    icon: CheckCircle,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    label: 'Récent',
    labelEn: 'Fresh'
  },
  recent: {
    icon: Clock,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    label: 'Assez récent',
    labelEn: 'Recent'
  },
  aging: {
    icon: Info,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    label: 'À surveiller',
    labelEn: 'Aging'
  },
  old: {
    icon: AlertTriangle,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
    label: 'Ancien',
    labelEn: 'Old'
  },
  outdated: {
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Obsolète',
    labelEn: 'Outdated'
  }
};

const WARNING_LEVEL_CONFIG = {
  none: { show: false },
  info: { 
    bgColor: 'bg-blue-500/10', 
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    icon: Info
  },
  warning: { 
    bgColor: 'bg-amber-500/10', 
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    icon: AlertTriangle
  },
  critical: { 
    bgColor: 'bg-red-500/10', 
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    icon: AlertTriangle
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  summaryId,
  videoTitle: _videoTitle,
  freshnessData: initialData,
  onRequestVerification,
  compact = false,
  className = ''
}) => {
  const [data, setData] = useState<FreshnessData | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Fetch les données si pas fournies
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }

    const fetchFreshness = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const API_URL = import.meta.env.VITE_API_URL || 'https://api.deepsightsynthesis.com';
        
        const response = await fetch(`${API_URL}/api/videos/freshness/${summaryId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Erreur de chargement');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur');
      } finally {
        setLoading(false);
      }
    };

    if (summaryId) {
      fetchFreshness();
    }
  }, [summaryId, initialData]);

  // Loading state
  if (loading) {
    return (
      <div className={`animate-pulse ${compact ? 'h-6' : 'h-12'} bg-bg-tertiary rounded-lg ${className}`} />
    );
  }

  // Error state
  if (error || !data) {
    return null; // Silencieux si erreur
  }

  // Pas d'avertissement nécessaire
  if (data.warning_level === 'none' && !compact) {
    return null;
  }

  const levelConfig = LEVEL_CONFIG[data.level];
  const warningConfig = WARNING_LEVEL_CONFIG[data.warning_level];
  const LevelIcon = levelConfig.icon;
  const WarningIcon = warningConfig && 'icon' in warningConfig ? warningConfig.icon : null;

  // Mode compact (badge simple)
  if (compact) {
    return (
      <div 
        className={`
          inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
          ${levelConfig.bgColor} ${levelConfig.color} ${levelConfig.borderColor} border
          ${className}
        `}
        title={data.warning_message || `Vidéo de ${data.age_days} jours`}
      >
        <LevelIcon className="w-3 h-3" />
        <span>{formatAge(data.age_days)}</span>
        {data.is_fast_changing_topic && (
          <Zap className="w-3 h-3 text-amber-400" />
        )}
      </div>
    );
  }

  // Mode complet
  return (
    <div className={`rounded-xl border ${className}`}>
      {/* Header avec avertissement */}
      {data.warning_message && WarningIcon && 'bgColor' in warningConfig && (
        <div
          className={`
            p-4 rounded-t-xl border-b
            ${warningConfig.bgColor} ${warningConfig.borderColor}
          `}
        >
          <div className="flex items-start gap-3">
            <WarningIcon className={`w-5 h-5 ${warningConfig.textColor} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
              <p className={`text-sm font-medium ${'textColor' in warningConfig ? warningConfig.textColor : ''}`}>
                {data.warning_message}
              </p>
              
              {data.is_fast_changing_topic && data.topic_category && (
                <div className="flex items-center gap-2 mt-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-text-secondary">
                    Sujet à évolution rapide : {data.topic_category}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contenu principal */}
      <div className={`p-4 bg-bg-secondary/50 ${data.warning_message ? 'rounded-b-xl' : 'rounded-xl'}`}>
        {/* Badge de fraîcheur */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${levelConfig.bgColor}`}>
              <LevelIcon className={`w-4 h-4 ${levelConfig.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">
                {levelConfig.label}
              </p>
              <p className="text-xs text-text-tertiary">
                Publié il y a {formatAge(data.age_days)}
              </p>
            </div>
          </div>

          {/* Bouton expansion */}
          {data.recommendations.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-bg-hover rounded-lg transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4 text-text-tertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-text-tertiary" />
              )}
            </button>
          )}
        </div>

        {/* Recommandations (expanded) */}
        {expanded && data.recommendations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <p className="text-xs font-medium text-text-secondary mb-2">
              💡 Recommandations
            </p>
            <ul className="space-y-2">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-text-tertiary">
                  <span className="text-accent-primary">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>

            {/* Bouton pour demander vérification */}
            {onRequestVerification && (
              <button
                onClick={onRequestVerification}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 
                         bg-accent-primary/10 hover:bg-accent-primary/20 
                         text-accent-primary text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Vérifier dans le chat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

function formatAge(days: number): string {
  if (days < 7) {
    return `${days} jour${days > 1 ? 's' : ''}`;
  } else if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} semaine${weeks > 1 ? 's' : ''}`;
  } else if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} mois`;
  } else {
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    if (remainingMonths > 0) {
      return `${years} an${years > 1 ? 's' : ''} et ${remainingMonths} mois`;
    }
    return `${years} an${years > 1 ? 's' : ''}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default FreshnessIndicator;

// Types exportés
export type { FreshnessData, FreshnessIndicatorProps };
