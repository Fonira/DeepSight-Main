/**
 * 🔍 FACT-CHECK LITE — Vérification heuristique des affirmations
 * ═══════════════════════════════════════════════════════════════════════════════
 * Composant disponible pour TOUS les plans (Free, Starter, Pro, Expert)
 * 
 * Analyse basée sur :
 * - Détection de patterns (statistiques, sources vagues, opinions)
 * - Score de confiance heuristique
 * - Suggestions de vérification
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Info, Search,
  ChevronDown, ChevronUp, ExternalLink, Sparkles,
  AlertCircle, HelpCircle, TrendingUp, Eye, Lock
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ClaimAnalysis {
  claim: string;
  claim_type: string;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
  verification_hint: string | null;
  suggested_search?: string | null;
}

interface FactCheckLiteData {
  overall_confidence: number;
  risk_summary: string;
  claims_analyzed: number;
  high_risk_claims: ClaimAnalysis[];
  medium_risk_claims: ClaimAnalysis[];
  verification_suggestions: string[];
  disclaimers: string[];
}

interface ReliabilityResult {
  freshness?: any;
  fact_check_lite?: FactCheckLiteData;
  analysis_type?: string;
  user_plan?: string;
  full_factcheck_available?: boolean;
}

interface FactCheckLiteProps {
  summaryId: number;
  /** Données pré-chargées (optionnel) */
  reliabilityData?: ReliabilityResult;
  /** Callback pour upgrade */
  onUpgrade?: () => void;
  /** Mode compact */
  compact?: boolean;
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIDENCE_CONFIG = {
  high: { min: 75, color: 'text-green-500', bgColor: 'bg-green-500', label: 'Bonne fiabilité' },
  medium: { min: 50, color: 'text-amber-500', bgColor: 'bg-amber-500', label: 'Fiabilité moyenne' },
  low: { min: 0, color: 'text-red-500', bgColor: 'bg-red-500', label: 'Prudence recommandée' }
};

const CLAIM_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  statistics: { label: 'Statistique', icon: <TrendingUp className="w-3 h-3" />, color: 'text-blue-400' },
  temporal: { label: 'Date/Période', icon: <Info className="w-3 h-3" />, color: 'text-cyan-400' },
  opinion_markers: { label: 'Opinion', icon: <HelpCircle className="w-3 h-3" />, color: 'text-purple-400' },
  predictions: { label: 'Prédiction', icon: <Eye className="w-3 h-3" />, color: 'text-indigo-400' },
  vague_sources: { label: 'Source vague', icon: <AlertCircle className="w-3 h-3" />, color: 'text-orange-400' },
  extraordinary: { label: 'Extraordinaire', icon: <AlertTriangle className="w-3 h-3" />, color: 'text-red-400' }
};

const RISK_COLORS = {
  high: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
  medium: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const FactCheckLite: React.FC<FactCheckLiteProps> = ({
  summaryId,
  reliabilityData: initialData,
  onUpgrade,
  compact = false,
  className = ''
}) => {
  const [data, setData] = useState<ReliabilityResult | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Fetch les données si pas fournies
  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }

    const fetchReliability = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const API_URL = import.meta.env.VITE_API_URL || 'https://api.deepsightsynthesis.com';
        
        const response = await fetch(`${API_URL}/api/videos/reliability/${summaryId}`, {
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
      fetchReliability();
    }
  }, [summaryId, initialData]);

  // Loading
  if (loading) {
    return (
      <div className={`animate-pulse bg-bg-tertiary rounded-xl ${compact ? 'h-16' : 'h-48'} ${className}`} />
    );
  }

  // Error
  if (error || !data) {
    return null;
  }

  const factCheck = data.fact_check_lite;

  if (!factCheck) {
    return (
      <div className={`animate-pulse bg-bg-tertiary rounded-xl ${compact ? 'h-16' : 'h-48'} ${className}`} />
    );
  }

  const confidenceLevel = getConfidenceLevel(factCheck.overall_confidence);
  const confidenceConfig = CONFIDENCE_CONFIG[confidenceLevel];

  // Mode compact (juste le score)
  if (compact) {
    return (
      <div 
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          ${RISK_COLORS[confidenceLevel === 'high' ? 'low' : confidenceLevel === 'low' ? 'high' : 'medium'].bg}
          ${RISK_COLORS[confidenceLevel === 'high' ? 'low' : confidenceLevel === 'low' ? 'high' : 'medium'].border}
          border ${className}
        `}
        title={factCheck.risk_summary}
      >
        <Shield className={`w-4 h-4 ${confidenceConfig.color}`} />
        <span className={`text-sm font-medium ${confidenceConfig.color}`}>
          {factCheck.overall_confidence}%
        </span>
        {factCheck.high_risk_claims.length > 0 && (
          <span className="text-xs text-text-tertiary">
            ({factCheck.high_risk_claims.length} à vérifier)
          </span>
        )}
      </div>
    );
  }

  // Mode complet
  return (
    <div className={`bg-bg-secondary border border-border-default rounded-xl overflow-hidden ${className}`}>
      {/* Header avec score global */}
      <div className="p-4 border-b border-border-subtle">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${confidenceConfig.bgColor}/20`}>
              <Shield className={`w-5 h-5 ${confidenceConfig.color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Fact-Check LITE
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-accent-primary/20 text-accent-primary rounded">
                  GRATUIT
                </span>
              </h3>
              <p className="text-xs text-text-tertiary">
                {factCheck.claims_analyzed} affirmations analysées
              </p>
            </div>
          </div>

          {/* Score circulaire */}
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-bg-tertiary"
              />
              <circle
                cx="18" cy="18" r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${factCheck.overall_confidence} 100`}
                className={confidenceConfig.color}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-bold ${confidenceConfig.color}`}>
                {factCheck.overall_confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* Résumé du risque */}
        <p className="mt-3 text-sm text-text-secondary">
          {factCheck.risk_summary}
        </p>
      </div>

      {/* Affirmations à risque */}
      {(factCheck.high_risk_claims.length > 0 || factCheck.medium_risk_claims.length > 0) && (
        <div className="p-4 space-y-3">
          {/* High risk claims */}
          {factCheck.high_risk_claims.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'high' ? null : 'high')}
                className="w-full flex items-center justify-between p-3 rounded-lg 
                         bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">
                    {factCheck.high_risk_claims.length} affirmation(s) à vérifier
                  </span>
                </div>
                {expandedSection === 'high' ? (
                  <ChevronUp className="w-4 h-4 text-red-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-red-400" />
                )}
              </button>

              {expandedSection === 'high' && (
                <div className="mt-2 space-y-2">
                  {factCheck.high_risk_claims.map((claim, i) => (
                    <ClaimCard key={i} claim={claim} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Medium risk claims */}
          {factCheck.medium_risk_claims.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === 'medium' ? null : 'medium')}
                className="w-full flex items-center justify-between p-3 rounded-lg 
                         bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">
                    {factCheck.medium_risk_claims.length} point(s) à surveiller
                  </span>
                </div>
                {expandedSection === 'medium' ? (
                  <ChevronUp className="w-4 h-4 text-amber-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-amber-400" />
                )}
              </button>

              {expandedSection === 'medium' && (
                <div className="mt-2 space-y-2">
                  {factCheck.medium_risk_claims.slice(0, 5).map((claim, i) => (
                    <ClaimCard key={i} claim={claim} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suggestions de vérification */}
      {factCheck.verification_suggestions.length > 0 && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg bg-bg-tertiary/50 border border-border-subtle">
            <p className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1.5">
              <Search className="w-3 h-3" />
              Suggestions de vérification
            </p>
            <ul className="space-y-1.5">
              {factCheck.verification_suggestions.map((suggestion, i) => (
                <li key={i} className="text-xs text-text-tertiary flex items-start gap-2">
                  <span className="text-accent-primary">→</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Upsell Pro */}
      {!data.full_factcheck_available && onUpgrade && (
        <div className="p-4 border-t border-border-subtle bg-gradient-to-r from-accent-primary/5 to-purple-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-primary/10">
              <Sparkles className="w-5 h-5 text-accent-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary">
                Fact-checking complet avec Perplexity
              </p>
              <p className="text-xs text-text-tertiary">
                Vérification en temps réel avec sources web
              </p>
            </div>
            <button
              onClick={onUpgrade}
              className="px-3 py-1.5 text-xs font-medium bg-accent-primary hover:bg-accent-primary/90 
                       text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Lock className="w-3 h-3" />
              Pro
            </button>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-text-muted text-center">
          Analyse heuristique • Scores indicatifs • Vérification humaine recommandée
        </p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 SOUS-COMPOSANT : Carte d'affirmation
// ═══════════════════════════════════════════════════════════════════════════════

const ClaimCard: React.FC<{ claim: ClaimAnalysis }> = ({ claim }) => {
  const typeConfig = CLAIM_TYPE_LABELS[claim.claim_type] || {
    label: claim.claim_type,
    icon: <Info className="w-3 h-3" />,
    color: 'text-text-tertiary'
  };
  const riskColors = RISK_COLORS[claim.risk_level];

  return (
    <div className={`p-3 rounded-lg border ${riskColors.bg} ${riskColors.border}`}>
      {/* Type de claim */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`flex items-center gap-1 text-xs ${typeConfig.color}`}>
          {typeConfig.icon}
          {typeConfig.label}
        </span>
        <span className="text-xs text-text-muted">•</span>
        <span className={`text-xs ${riskColors.text}`}>
          Confiance : {claim.confidence}%
        </span>
      </div>

      {/* Extrait */}
      <p className="text-xs text-text-secondary line-clamp-3 mb-2">
        "...{claim.claim}..."
      </p>

      {/* Hint de vérification */}
      {claim.verification_hint && (
        <p className="text-[11px] text-text-tertiary flex items-start gap-1.5">
          <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
          {claim.verification_hint}
        </p>
      )}

      {/* Suggestion de recherche */}
      {claim.suggested_search && (
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(claim.suggested_search)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent-primary hover:underline"
        >
          <Search className="w-3 h-3" />
          Rechercher
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛠️ UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📤 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default FactCheckLite;
export type { FactCheckLiteData, ReliabilityResult, FactCheckLiteProps };
