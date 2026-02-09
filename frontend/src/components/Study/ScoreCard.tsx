/**
 * DEEP SIGHT — ScoreCard Component
 * Affichage du score final avec animations
 * 
 * FONCTIONNALITÉS:
 * - 🏆 Score animé avec confetti
 * - 📊 Statistiques détaillées
 * - 🎯 Message personnalisé selon performance
 * - 📤 Actions de partage/export
 */

import React, { useEffect, useState } from 'react';
import {
  Trophy, Target, Clock, Share2,
  Download, RotateCcw, CheckCircle, XCircle,
  Medal, Crown, TrendingUp
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ScoreCardProps {
  score: number;
  total: number;
  correct: number;
  incorrect: number;
  mode: 'flashcard' | 'quiz';
  timeSpent?: number; // en secondes
  onRetry?: () => void;
  onShare?: () => void;
  onExport?: () => void;
  language?: 'fr' | 'en';
}

interface PerformanceLevel {
  icon: React.ReactNode;
  title: string;
  message: string;
  color: string;
  bgColor: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const ScoreCard: React.FC<ScoreCardProps> = ({
  total,
  correct,
  incorrect,
  mode,
  timeSpent,
  onRetry,
  onShare,
  onExport,
  language = 'fr',
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);

  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  const t = {
    fr: {
      completed: mode === 'flashcard' ? 'Révision terminée !' : 'Quiz terminé !',
      score: 'Score',
      correct: 'Correct',
      incorrect: 'À revoir',
      known: 'Maîtrisé',
      unknown: 'À revoir',
      timeSpent: 'Temps',
      avgTime: 'Moyenne',
      perCard: 'par carte',
      perQuestion: 'par question',
      retry: 'Recommencer',
      share: 'Partager',
      export: 'Exporter',
      excellent: { title: 'Excellent !', message: 'Vous maîtrisez parfaitement ce sujet.' },
      good: { title: 'Très bien !', message: 'Vous avez une bonne compréhension.' },
      average: { title: 'Pas mal !', message: 'Continuez vos efforts, vous progressez.' },
      needsWork: { title: 'À améliorer', message: 'Revoyez le contenu et réessayez.' },
    },
    en: {
      completed: mode === 'flashcard' ? 'Review completed!' : 'Quiz completed!',
      score: 'Score',
      correct: 'Correct',
      incorrect: 'Review',
      known: 'Known',
      unknown: 'Review',
      timeSpent: 'Time',
      avgTime: 'Average',
      perCard: 'per card',
      perQuestion: 'per question',
      retry: 'Try again',
      share: 'Share',
      export: 'Export',
      excellent: { title: 'Excellent!', message: 'You have mastered this topic.' },
      good: { title: 'Great!', message: 'You have a good understanding.' },
      average: { title: 'Not bad!', message: 'Keep going, you are improving.' },
      needsWork: { title: 'Needs work', message: 'Review the content and try again.' },
    },
  }[language];

  // Animate score on mount
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = percentage / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= percentage) {
        setDisplayScore(percentage);
        clearInterval(timer);
        if (percentage >= 80) {
          setShowConfetti(true);
        }
      } else {
        setDisplayScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentage]);

  // Get performance level
  const getPerformanceLevel = (): PerformanceLevel => {
    if (percentage >= 90) {
      return {
        icon: <Crown className="w-12 h-12" />,
        title: t.excellent.title,
        message: t.excellent.message,
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
      };
    } else if (percentage >= 70) {
      return {
        icon: <Trophy className="w-12 h-12" />,
        title: t.good.title,
        message: t.good.message,
        color: 'text-emerald-400',
        bgColor: 'bg-emerald-500/20',
      };
    } else if (percentage >= 50) {
      return {
        icon: <Medal className="w-12 h-12" />,
        title: t.average.title,
        message: t.average.message,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
      };
    } else {
      return {
        icon: <Target className="w-12 h-12" />,
        title: t.needsWork.title,
        message: t.needsWork.message,
        color: 'text-orange-400',
        bgColor: 'bg-orange-500/20',
      };
    }
  };

  const performance = getPerformanceLevel();

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const avgTime = timeSpent && total > 0 ? Math.round(timeSpent / total) : null;

  return (
    <div className="relative">
      {/* Confetti effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                backgroundColor: ['#fbbf24', '#34d399', '#60a5fa', '#f472b6'][
                  Math.floor(Math.random() * 4)
                ],
              }}
            />
          ))}
        </div>
      )}

      <div className="glass-panel rounded-2xl p-8 max-w-lg mx-auto text-center relative z-10">
        {/* Header */}
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full 
                        ${performance.bgColor} ${performance.color} mb-4 animate-bounce-in`}>
          {performance.icon}
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">{t.completed}</h2>
        <h3 className={`text-xl font-semibold ${performance.color} mb-2`}>
          {performance.title}
        </h3>
        <p className="text-gray-400 mb-6">{performance.message}</p>

        {/* Score circle */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          {/* Background circle */}
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-gray-700"
            />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="url(#scoreGradient)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${displayScore * 4.4} 440`}
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{displayScore}%</span>
            <span className="text-sm text-gray-400">{t.score}</span>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-panel rounded-xl p-3">
            <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xl font-bold">{correct}</span>
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'flashcard' ? t.known : t.correct}
            </p>
          </div>

          <div className="glass-panel rounded-xl p-3">
            <div className="flex items-center justify-center gap-1 text-red-400 mb-1">
              <XCircle className="w-4 h-4" />
              <span className="text-xl font-bold">{incorrect}</span>
            </div>
            <p className="text-xs text-gray-500">
              {mode === 'flashcard' ? t.unknown : t.incorrect}
            </p>
          </div>

          {timeSpent !== undefined && (
            <div className="glass-panel rounded-xl p-3">
              <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xl font-bold">{formatTime(timeSpent)}</span>
              </div>
              <p className="text-xs text-gray-500">{t.timeSpent}</p>
            </div>
          )}
        </div>

        {/* Average time per item */}
        {avgTime !== null && (
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm mb-6">
            <TrendingUp className="w-4 h-4" />
            <span>
              {t.avgTime}: {avgTime}s {mode === 'flashcard' ? t.perCard : t.perQuestion}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 
                       text-amber-400 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              {t.retry}
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 
                       text-blue-400 rounded-xl transition-colors"
            >
              <Share2 className="w-4 h-4" />
              {t.share}
            </button>
          )}

          {onExport && (
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 
                       text-emerald-400 rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              {t.export}
            </button>
          )}
        </div>
      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
        
        @keyframes bounce-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        
        .animate-confetti {
          width: 10px;
          height: 10px;
          animation: confetti 2s ease-out forwards;
        }
        
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default ScoreCard;
