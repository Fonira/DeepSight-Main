/**
 * 🎯 QuizQuestion — QCM Component with Feedback
 * Affiche une question à choix multiples avec feedback immédiat
 */

import React, { useState, useEffect } from 'react';
import { Check, X, Lightbulb, ArrowRight, ChevronRight } from 'lucide-react';
import type { StudyQuizQuestion } from '../../services/api';

interface QuizQuestionProps {
  question: StudyQuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (selectedIndex: number, isCorrect: boolean) => void;
  onNext: () => void;
  showFeedback?: boolean;
}

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onNext,
  showFeedback = true,
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const isCorrect = selectedAnswer === question.correct_index;

  // Reset state when question changes
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setShowExplanation(false);
  }, [question.question]);

  const handleSelectAnswer = (index: number) => {
    if (hasAnswered) return;
    
    setSelectedAnswer(index);
    setHasAnswered(true);
    
    const correct = index === question.correct_index;
    onAnswer(index, correct);
    
    // Auto-show explanation after a delay
    if (showFeedback && question.explanation) {
      setTimeout(() => setShowExplanation(true), 800);
    }
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered) {
      return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20';
    }
    
    if (index === question.correct_index) {
      return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 dark:border-emerald-400';
    }
    
    if (index === selectedAnswer && !isCorrect) {
      return 'bg-red-50 dark:bg-red-900/30 border-red-500 dark:border-red-400';
    }
    
    return 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 opacity-50';
  };

  const getOptionIcon = (index: number) => {
    if (!hasAnswered) return null;
    
    if (index === question.correct_index) {
      return <Check className="text-emerald-500" size={20} />;
    }
    
    if (index === selectedAnswer && !isCorrect) {
      return <X className="text-red-500" size={20} />;
    }
    
    return null;
  };

  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Question header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-blue-500">
            Question {questionNumber} / {totalQuestions}
          </span>
          {hasAnswered && (
            <span className={`text-sm font-semibold ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`}>
              {isCorrect ? '✓ Correct !' : '✗ Incorrect'}
            </span>
          )}
        </div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white leading-relaxed">
          {question.question}
        </h3>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelectAnswer(index)}
            disabled={hasAnswered}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${getOptionStyle(index)} ${
              !hasAnswered ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Letter badge */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                hasAnswered && index === question.correct_index
                  ? 'bg-emerald-500 text-white'
                  : hasAnswered && index === selectedAnswer && !isCorrect
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}>
                {letters[index]}
              </div>
              
              {/* Option text */}
              <span className={`flex-1 ${
                hasAnswered && index === question.correct_index
                  ? 'text-emerald-700 dark:text-emerald-300 font-medium'
                  : hasAnswered && index === selectedAnswer && !isCorrect
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-gray-700 dark:text-gray-300'
              }`}>
                {option}
              </span>
              
              {/* Result icon */}
              {getOptionIcon(index)}
            </div>
          </button>
        ))}
      </div>

      {/* Explanation */}
      {showFeedback && hasAnswered && question.explanation && (
        <div 
          className={`mb-6 p-4 rounded-xl transition-all duration-300 ${
            showExplanation ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          } ${
            isCorrect 
              ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' 
              : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
          }`}
        >
          <div className="flex items-start gap-3">
            <Lightbulb className={`flex-shrink-0 mt-0.5 ${
              isCorrect ? 'text-emerald-500' : 'text-amber-500'
            }`} size={20} />
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                Explication
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {question.explanation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Next button */}
      {hasAnswered && (
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          {questionNumber < totalQuestions ? (
            <>
              Question suivante
              <ArrowRight size={18} />
            </>
          ) : (
            <>
              Voir les résultats
              <ChevronRight size={18} />
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default QuizQuestion;
