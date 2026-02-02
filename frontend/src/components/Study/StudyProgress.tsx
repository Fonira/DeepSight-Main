/**
 * DEEP SIGHT — StudyProgress Component
 * Barre de progression pour les outils d'étude
 * 
 * FONCTIONNALITÉS:
 * - 📊 Barre de progression animée
 * - 🎯 Indicateurs de performance
 * - ⏱️ Temps estimé restant
 * - 📈 Stats en temps réel
 */

import React from 'react';
import {
  CheckCircle, XCircle, Clock, Target, Zap,
  TrendingUp, Award
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StudyProgressProps {
  current: number;
  total: number;
  correct?: number;
  incorrect?: number;
  mode?: 'flashcard' | 'quiz';
  showStats?: boolean;
  estimatedTimeLeft?: number; // en secondes
  language?: 'fr' | 'en';
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyProgress: React.FC<StudyProgressProps> = ({
  current,
  total,
  correct = 0,
  incorrect = 0,
  mode = 'flashcard',
  showStats = true,
  estimatedTimeLeft,
  language = 'fr',
}) => {
  const t = {
    fr: {
      progress: 'Progression',
      correct: 'Correct',
      incorrect: 'À revoir',
      known: 'Maîtrisé',
      unknown: 'À revoir',
      remaining: 'restant',
      completed: 'Terminé !',
      accuracy: 'Précision',
    },
    en: {
      progress: 'Progress',
      correct: 'Correct',
      incorrect: 'Review',
      known: 'Known',
      unknown: 'Review',
      remaining: 'remaining',
      completed: 'Completed!',
      accuracy: 'Accuracy',
    },
  }[language];

  const progress = total > 0 ? Math.round((current / total) * 100) : 0;
  const answered = correct + incorrect;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const isComplete = current >= total;

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Get gradient color based on accuracy
  const getGradientColor = (): string => {
    if (accuracy >= 80) return 'from-emerald-500 to-emerald-400';
    if (accuracy >= 60) return 'from-amber-500 to-amber-400';
    if (accuracy >= 40) return 'from-orange-500 to-orange-400';
    return 'from-red-500 to-red-400';
  };

  return (
    <div className="glass-panel rounded-xl p-4">
      {/* Main progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-gray-300">{t.progress}</span>
          </div>
          <span className="text-sm text-gray-400">
            {isComplete ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <Award className="w-4 h-4" />
                {t.completed}
              </span>
            ) : (
              `${current}/${total}`
            )}
          </span>
        </div>
        
        <div className="relative h-3 bg-gray-700/50 rounded-full overflow-hidden">
          {/* Background segments */}
          <div className="absolute inset-0 flex">
            {Array.from({ length: total }).map((_, i) => (
              <div
                key={i}
                className="h-full border-r border-gray-600/30 last:border-r-0"
                style={{ width: `${100 / total}%` }}
              />
            ))}
          </div>
          
          {/* Progress fill */}
          <div
            className={`absolute inset-y-0 left-0 bg-gradient-to-r ${
              answered > 0 ? getGradientColor() : 'from-amber-500 to-amber-400'
            } transition-all duration-500 ease-out`}
            style={{ width: `${progress}%` }}
          />
          
          {/* Shimmer effect */}
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent
                      animate-shimmer"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      {showStats && (
        <div className="flex items-center justify-between gap-4">
          {/* Correct/Known */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/20">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-emerald-400">{correct}</p>
              <p className="text-xs text-gray-500">
                {mode === 'flashcard' ? t.known : t.correct}
              </p>
            </div>
          </div>

          {/* Accuracy indicator */}
          {answered > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/20">
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-400">{accuracy}%</p>
                <p className="text-xs text-gray-500">{t.accuracy}</p>
              </div>
            </div>
          )}

          {/* Time remaining */}
          {estimatedTimeLeft !== undefined && estimatedTimeLeft > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-400">
                  {formatTime(estimatedTimeLeft)}
                </p>
                <p className="text-xs text-gray-500">{t.remaining}</p>
              </div>
            </div>
          )}

          {/* Incorrect/Review */}
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/20">
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-400">{incorrect}</p>
              <p className="text-xs text-gray-500">
                {mode === 'flashcard' ? t.unknown : t.incorrect}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MINI VERSION
// ═══════════════════════════════════════════════════════════════════════════════

interface MiniProgressProps {
  current: number;
  total: number;
  correct?: number;
}

export const StudyProgressMini: React.FC<MiniProgressProps> = ({
  current,
  total,
  correct = 0,
}) => {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className="text-sm text-gray-400 tabular-nums">
        {current}/{total}
      </span>
      {correct > 0 && (
        <span className="text-sm text-emerald-400 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          {correct}
        </span>
      )}
    </div>
  );
};

export default StudyProgress;
