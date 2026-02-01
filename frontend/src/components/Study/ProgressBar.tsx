/**
 * 📊 ProgressBar — Study Progress Indicator
 * Barre de progression animée pour flashcards et quiz
 */

import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  variant?: 'default' | 'success' | 'quiz';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  variant = 'default',
  showLabel = true,
  size = 'md',
  className = '',
}) => {
  const progress = total > 0 ? Math.round((current / total) * 100) : 0;

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const variantClasses = {
    default: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    success: 'bg-gradient-to-r from-emerald-500 to-green-600',
    quiz: 'bg-gradient-to-r from-purple-500 to-pink-600',
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {current} / {total}
          </span>
          <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
            {progress}%
          </span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${heightClasses[size]}`}>
        <div
          className={`${heightClasses[size]} ${variantClasses[variant]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
