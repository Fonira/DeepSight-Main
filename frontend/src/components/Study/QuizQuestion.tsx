/**
 * DEEP SIGHT — QuizQuestion Component
 * Questions à choix multiples interactives
 * 
 * FONCTIONNALITÉS:
 * - 🎯 QCM avec feedback visuel
 * - 💡 Explication après réponse
 * - 🔄 Animation de validation
 * - 📊 Suivi du score
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  CheckCircle, XCircle, ChevronRight, Lightbulb,
  Trophy, RotateCcw, HelpCircle, Brain
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QuizQuestionData {
  question: string;
  options: string[];
  correct: number;
  explanation?: string;
}

interface QuizQuestionProps {
  questions: QuizQuestionData[];
  onComplete?: (score: number, total: number, answers: QuizAnswer[]) => void;
  onProgress?: (current: number, total: number, score: number) => void;
  isLoading?: boolean;
  language?: 'fr' | 'en';
}

interface QuizAnswer {
  questionIndex: number;
  selected: number;
  isCorrect: boolean;
}

interface QuizState {
  currentIndex: number;
  selectedAnswer: number | null;
  showResult: boolean;
  answers: QuizAnswer[];
  isComplete: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const QuizQuestion: React.FC<QuizQuestionProps> = ({
  questions,
  onComplete,
  onProgress,
  isLoading = false,
  language = 'fr',
}) => {
  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    selectedAnswer: null,
    showResult: false,
    answers: [],
    isComplete: false,
  });

  const [shake, setShake] = useState(false);
  const [pulse, setPulse] = useState(false);

  const t = {
    fr: {
      question: 'Question',
      validate: 'Valider',
      nextQuestion: 'Question suivante',
      seeResults: 'Voir les résultats',
      explanation: 'Explication',
      completed: 'Quiz terminé !',
      score: 'Votre score',
      correctAnswers: 'bonnes réponses',
      excellent: '🎉 Excellent travail !',
      good: '👍 Bien joué !',
      keepGoing: '💪 Continuez vos efforts !',
      reviewContent: '📚 Revoyez le contenu',
      retry: 'Recommencer',
      reviewAnswers: 'Revoir les réponses',
      loading: 'Génération du quiz...',
      empty: 'Aucune question disponible',
      selectAnswer: 'Sélectionnez une réponse',
    },
    en: {
      question: 'Question',
      validate: 'Validate',
      nextQuestion: 'Next question',
      seeResults: 'See results',
      explanation: 'Explanation',
      completed: 'Quiz completed!',
      score: 'Your score',
      correctAnswers: 'correct answers',
      excellent: '🎉 Excellent work!',
      good: '👍 Well done!',
      keepGoing: '💪 Keep going!',
      reviewContent: '📚 Review the content',
      retry: 'Try again',
      reviewAnswers: 'Review answers',
      loading: 'Generating quiz...',
      empty: 'No questions available',
      selectAnswer: 'Select an answer',
    },
  }[language];

  const score = state.answers.filter((a) => a.isCorrect).length;
  const currentQuestion = questions[state.currentIndex];

  // Report progress
  useEffect(() => {
    onProgress?.(state.currentIndex + 1, questions.length, score);
  }, [state.currentIndex, questions.length, score, onProgress]);

  const handleSelectAnswer = useCallback((index: number) => {
    if (state.showResult) return;
    setState((prev) => ({ ...prev, selectedAnswer: index }));
  }, [state.showResult]);

  const handleValidate = useCallback(() => {
    if (state.selectedAnswer === null) return;

    const isCorrect = state.selectedAnswer === currentQuestion.correct;

    // Trigger animation
    if (isCorrect) {
      setPulse(true);
      setTimeout(() => setPulse(false), 300);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }

    setState((prev) => ({
      ...prev,
      showResult: true,
      answers: [
        ...prev.answers,
        {
          questionIndex: prev.currentIndex,
          selected: prev.selectedAnswer!,
          isCorrect,
        },
      ],
    }));
  }, [state.selectedAnswer, state.currentIndex, currentQuestion?.correct]);

  const handleNext = useCallback(() => {
    if (state.currentIndex + 1 >= questions.length) {
      const finalScore = state.answers.filter((a) => a.isCorrect).length;
      setState((prev) => ({ ...prev, isComplete: true }));
      onComplete?.(finalScore, questions.length, state.answers);
    } else {
      setState((prev) => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        selectedAnswer: null,
        showResult: false,
      }));
    }
  }, [state.currentIndex, state.answers, questions.length, onComplete]);

  const handleRetry = useCallback(() => {
    setState({
      currentIndex: 0,
      selectedAnswer: null,
      showResult: false,
      answers: [],
      isComplete: false,
    });
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mb-4" />
        <p className="text-gray-400">{t.loading}</p>
      </div>
    );
  }

  // Empty state
  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <HelpCircle className="w-12 h-12 text-gray-500 mb-4" />
        <p className="text-gray-400">{t.empty}</p>
      </div>
    );
  }

  // Results screen
  if (state.isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const message =
      percentage >= 80 ? t.excellent :
      percentage >= 60 ? t.good :
      percentage >= 40 ? t.keepGoing : t.reviewContent;

    return (
      <div className="py-8">
        <div className="glass-panel rounded-2xl p-8 max-w-2xl mx-auto text-center">
          <Trophy className={`w-20 h-20 mx-auto mb-4 ${
            percentage >= 60 ? 'text-amber-400' : 'text-blue-400'
          }`} />
          
          <h3 className="text-2xl font-bold text-white mb-2">{t.completed}</h3>
          
          <div className="text-5xl font-bold text-amber-400 my-6">
            {score}/{questions.length}
          </div>
          
          <p className="text-xl text-gray-300 mb-2">
            {percentage}% {t.correctAnswers}
          </p>
          
          <p className="text-lg text-gray-400 mb-8">{message}</p>

          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-6 py-3 bg-amber-500/20 hover:bg-amber-500/30 
                     text-amber-400 rounded-lg transition-colors mx-auto"
          >
            <RotateCcw className="w-5 h-5" />
            {t.retry}
          </button>
        </div>

        {/* Review answers */}
        <div className="mt-8 max-w-2xl mx-auto">
          <h4 className="text-lg font-semibold text-white mb-4">{t.reviewAnswers}</h4>
          <div className="space-y-3">
            {state.answers.map((answer, idx) => (
              <div
                key={idx}
                className={`glass-panel rounded-xl p-4 border-l-4 ${
                  answer.isCorrect ? 'border-emerald-500' : 'border-red-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {answer.isCorrect ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <p className="text-gray-300 text-sm line-clamp-2">
                    {questions[answer.questionIndex].question}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const progress = ((state.currentIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">
            {t.question} {state.currentIndex + 1}/{questions.length}
          </span>
          <span className="text-sm text-amber-400">
            {score} / {state.answers.length} ✓
          </span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className={`glass-panel rounded-xl p-6 mb-6 ${shake ? 'animate-shake' : ''} ${pulse ? 'animate-pulse' : ''}`}>
        <div className="flex items-start gap-3">
          <Brain className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
          <p className="text-lg text-white font-medium leading-relaxed">
            {currentQuestion.question}
          </p>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = state.selectedAnswer === index;
          const isCorrect = state.showResult && index === currentQuestion.correct;
          const isWrong = state.showResult && isSelected && index !== currentQuestion.correct;

          let bgClass = 'bg-gray-800/50 border-gray-600 hover:border-amber-500/50';
          let textClass = 'text-gray-300';

          if (isCorrect) {
            bgClass = 'bg-emerald-500/20 border-emerald-500';
            textClass = 'text-emerald-300';
          } else if (isWrong) {
            bgClass = 'bg-red-500/20 border-red-500';
            textClass = 'text-red-300';
          } else if (isSelected && !state.showResult) {
            bgClass = 'bg-amber-500/20 border-amber-500';
            textClass = 'text-amber-300';
          }

          return (
            <button
              key={index}
              onClick={() => handleSelectAnswer(index)}
              disabled={state.showResult}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 
                        transition-all duration-200 text-left
                        ${bgClass} ${state.showResult ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center 
                            font-semibold text-sm ${
                              isCorrect ? 'bg-emerald-500 text-white' :
                              isWrong ? 'bg-red-500 text-white' :
                              isSelected ? 'bg-amber-500 text-white' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                {String.fromCharCode(65 + index)}
              </div>
              <span className={`flex-1 ${textClass}`}>{option}</span>
              {state.showResult && isCorrect && (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              )}
              {state.showResult && isWrong && (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {state.showResult && currentQuestion.explanation && (
        <div className="glass-panel rounded-xl p-4 mb-6 border-l-4 border-amber-500 animate-fadeIn">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400 mb-1">{t.explanation}</p>
              <p className="text-sm text-gray-300">{currentQuestion.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="flex justify-center">
        {!state.showResult ? (
          <button
            onClick={handleValidate}
            disabled={state.selectedAnswer === null}
            className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 
                     text-gray-900 font-semibold rounded-xl transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t.validate}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 
                     text-gray-900 font-semibold rounded-xl transition-colors"
          >
            {state.currentIndex + 1 >= questions.length ? t.seeResults : t.nextQuestion}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default QuizQuestion;
