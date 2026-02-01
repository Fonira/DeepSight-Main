/**
 * 🏆 ScoreCard — Quiz Results Display
 * Affiche le score final avec animations et détails
 */

import React, { useEffect, useState } from 'react';
import { Trophy, Star, RotateCcw, ArrowRight, CheckCircle, XCircle, Sparkles } from 'lucide-react';

interface ScoreCardProps {
  score: number;
  total: number;
  title: string;
  timeSpent?: number; // in seconds
  onRestart?: () => void;
  onContinue?: () => void;
  answers?: {
    question: string;
    userAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    explanation?: string;
  }[];
}

const getGrade = (percentage: number): { label: string; emoji: string; color: string } => {
  if (percentage >= 90) return { label: 'Excellent !', emoji: '🏆', color: 'text-yellow-500' };
  if (percentage >= 80) return { label: 'Très bien !', emoji: '⭐', color: 'text-emerald-500' };
  if (percentage >= 70) return { label: 'Bien !', emoji: '👍', color: 'text-blue-500' };
  if (percentage >= 60) return { label: 'Pas mal', emoji: '📚', color: 'text-indigo-500' };
  if (percentage >= 50) return { label: 'À revoir', emoji: '📖', color: 'text-orange-500' };
  return { label: 'Continue !', emoji: '💪', color: 'text-red-500' };
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

export const ScoreCard: React.FC<ScoreCardProps> = ({
  score,
  total,
  title,
  timeSpent,
  onRestart,
  onContinue,
  answers,
}) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = getGrade(percentage);

  // Animate score counter
  useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const increment = score / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [score]);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Main Score Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header with gradient */}
        <div className={`p-6 bg-gradient-to-br ${
          percentage >= 70 
            ? 'from-emerald-500 to-green-600' 
            : percentage >= 50 
              ? 'from-blue-500 to-indigo-600'
              : 'from-orange-500 to-red-500'
        } text-white`}>
          <div className="text-center">
            <div className="text-5xl mb-2">{grade.emoji}</div>
            <h2 className="text-2xl font-bold mb-1">{grade.label}</h2>
            <p className="text-white/80 text-sm truncate">{title}</p>
          </div>
        </div>

        {/* Score Display */}
        <div className="p-6 text-center">
          <div className="relative inline-flex items-center justify-center">
            {/* Circular Progress */}
            <svg className="w-32 h-32 transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-gray-200 dark:text-gray-700"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={351.86}
                strokeDashoffset={351.86 * (1 - percentage / 100)}
                className={`${
                  percentage >= 70 
                    ? 'text-emerald-500' 
                    : percentage >= 50 
                      ? 'text-blue-500'
                      : 'text-orange-500'
                } transition-all duration-1000 ease-out`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold text-gray-800 dark:text-white">
                {animatedScore}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">/ {total}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex justify-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800 dark:text-white">{percentage}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Score</div>
            </div>
            {timeSpent && (
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800 dark:text-white">{formatTime(timeSpent)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Temps</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-500">{score}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Bonnes</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          {onRestart && (
            <button
              onClick={onRestart}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <RotateCcw size={18} />
              Recommencer
            </button>
          )}
          {onContinue && (
            <button
              onClick={onContinue}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              Continuer
              <ArrowRight size={18} />
            </button>
          )}
        </div>

        {/* Show/Hide Details */}
        {answers && answers.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full px-6 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors flex items-center justify-center gap-2"
            >
              {showDetails ? 'Masquer' : 'Voir'} les détails
              <Sparkles size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Answer Details */}
      {showDetails && answers && (
        <div className="mt-4 space-y-3">
          {answers.map((answer, index) => (
            <div
              key={index}
              className={`p-4 rounded-xl border ${
                answer.isCorrect
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start gap-3">
                {answer.isCorrect ? (
                  <CheckCircle className="text-emerald-500 flex-shrink-0 mt-0.5" size={20} />
                ) : (
                  <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                    {answer.question}
                  </p>
                  {answer.explanation && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {answer.explanation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoreCard;
