/**
 * AnalysisValueDisplay v1.0 - Shows the value/time saved after an analysis
 * Displays time saved and encourages users to see the benefit of the service
 */

import React, { useMemo } from 'react';
import { Clock, TrendingUp, Sparkles, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { PLANS_INFO } from '../config/planPrivileges';

interface AnalysisValueDisplayProps {
  /** Video duration in seconds */
  videoDuration: number;
  /** Number of key points extracted */
  keyPointsCount?: number;
  /** Number of concepts identified */
  conceptsCount?: number;
  /** Show upgrade CTA */
  showUpgradeCTA?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

export const AnalysisValueDisplay: React.FC<AnalysisValueDisplayProps> = ({
  videoDuration,
  keyPointsCount = 0,
  conceptsCount = 0,
  showUpgradeCTA = true,
  compact = false,
  className = '',
}) => {
  const { language } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const plan = user?.plan || 'free';
  const shouldShowUpgrade = showUpgradeCTA && (plan === 'free' || plan === 'student');

  // Calculate time saved
  const stats = useMemo(() => {
    // Analysis time is typically 30-60 seconds
    const analysisTime = 45; // seconds

    // Time saved = video duration - analysis time
    const timeSavedSeconds = Math.max(0, videoDuration - analysisTime);

    // Format time
    const formatTime = (seconds: number): string => {
      if (seconds < 60) {
        return `${Math.round(seconds)} ${language === 'fr' ? 'sec' : 'sec'}`;
      }
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;

      if (hours > 0) {
        return `${hours}h ${remainingMinutes}min`;
      }
      return `${minutes} min`;
    };

    // Percentage of time saved
    const percentageSaved = videoDuration > 0
      ? Math.round((timeSavedSeconds / videoDuration) * 100)
      : 0;

    return {
      originalTime: formatTime(videoDuration),
      timeSaved: formatTime(timeSavedSeconds),
      percentageSaved,
      analysisTime: formatTime(analysisTime),
    };
  }, [videoDuration, language]);

  if (compact) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20 ${className}`}>
        <div className="p-1.5 rounded-lg bg-green-500/20">
          <Clock className="w-4 h-4 text-green-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm text-green-400 font-medium">
            {language === 'fr'
              ? `~${stats.timeSaved} économisés`
              : `~${stats.timeSaved} saved`}
          </span>
          <span className="text-xs text-text-tertiary ml-2">
            ({stats.originalTime} {language === 'fr' ? 'de vidéo' : 'video'})
          </span>
        </div>
        {shouldShowUpgrade && (
          <button
            onClick={() => navigate('/upgrade')}
            className="text-xs text-accent-primary hover:underline"
          >
            {language === 'fr' ? 'Upgrade' : 'Upgrade'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/5 to-emerald-500/5 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-green-500/10 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-green-400" />
        <span className="font-medium text-text-primary text-sm">
          {language === 'fr' ? 'Valeur de cette analyse' : 'Analysis value'}
        </span>
      </div>

      {/* Stats */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          {/* Time saved */}
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400 mb-1">
              ~{stats.timeSaved}
            </div>
            <div className="text-xs text-text-tertiary">
              {language === 'fr' ? 'Temps économisé' : 'Time saved'}
            </div>
          </div>

          {/* Key points */}
          {keyPointsCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-accent-primary mb-1">
                {keyPointsCount}
              </div>
              <div className="text-xs text-text-tertiary">
                {language === 'fr' ? 'Points clés' : 'Key points'}
              </div>
            </div>
          )}

          {/* Concepts */}
          {conceptsCount > 0 && (
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {conceptsCount}
              </div>
              <div className="text-xs text-text-tertiary">
                {language === 'fr' ? 'Concepts' : 'Concepts'}
              </div>
            </div>
          )}
        </div>

        {/* Progress visualization */}
        <div className="relative h-8 bg-bg-tertiary rounded-lg overflow-hidden mb-3">
          <div
            className="absolute inset-y-0 left-0 bg-green-500/30 flex items-center justify-end pr-2"
            style={{ width: `${stats.percentageSaved}%` }}
          >
            <span className="text-xs font-medium text-green-400">
              {stats.percentageSaved}%
            </span>
          </div>
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
            <span className="text-text-tertiary">0</span>
            <span className="text-text-secondary font-medium">{stats.originalTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Check className="w-3 h-3 text-green-400" />
          <span>
            {language === 'fr'
              ? `Analysé en ~45 sec au lieu de ${stats.originalTime} de visionnage`
              : `Analyzed in ~45 sec instead of ${stats.originalTime} watching`}
          </span>
        </div>

        {/* Upgrade CTA */}
        {shouldShowUpgrade && (
          <div className="mt-4 pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-text-primary font-medium">
                  {language === 'fr'
                    ? 'Analysez plus de vidéos'
                    : 'Analyze more videos'}
                </p>
                <p className="text-xs text-text-tertiary">
                  {language === 'fr'
                    ? `Dès ${(PLANS_INFO.etudiant.priceMonthly / 100).toFixed(2).replace('.', ',')}€/mois pour les étudiants`
                    : `From €${(PLANS_INFO.etudiant.priceMonthly / 100).toFixed(2)}/mo for students`}
                </p>
              </div>
              <button
                onClick={() => navigate('/upgrade')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent-primary/20 text-accent-primary text-sm font-medium hover:bg-accent-primary/30 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                {language === 'fr' ? 'Voir les plans' : 'View plans'}
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisValueDisplay;
