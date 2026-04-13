/**
 * DEEP SIGHT — AnalysisHub / QuizTab
 * Onglet Quiz : génération lazy + QCM interactif
 */

import React, { useState, useCallback } from "react";
import { Brain, Sparkles } from "lucide-react";
import { DeepSightSpinner } from "../ui";
import { QuizQuestion, StudyProgress, ScoreCard } from "../Study";
import type { QuizQuestionData } from "../Study";

interface QuizTabProps {
  questions: QuizQuestionData[] | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  language: "fr" | "en";
}

export const QuizTab: React.FC<QuizTabProps> = ({
  questions,
  loading,
  error,
  onGenerate,
  language,
}) => {
  const [quizProgress, setQuizProgress] = useState({
    current: 0,
    total: 0,
    score: 0,
  });
  const [quizComplete, setQuizComplete] = useState(false);
  const [quizScore, setQuizScore] = useState({ correct: 0, incorrect: 0 });

  const handleQuizProgress = useCallback(
    (current: number, total: number, score: number) => {
      setQuizProgress({ current, total, score });
    },
    [],
  );

  const handleQuizComplete = useCallback((score: number, total: number) => {
    setQuizComplete(true);
    setQuizScore({ correct: score, incorrect: total - score });
  }, []);

  const handleRetry = () => {
    setQuizComplete(false);
    setQuizProgress({ current: 0, total: 0, score: 0 });
    setQuizScore({ correct: 0, incorrect: 0 });
    onGenerate();
  };

  // Not generated yet
  if (!questions && !loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-5">
          <Brain className="w-8 h-8 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {language === "fr" ? "Quiz de compréhension" : "Comprehension Quiz"}
        </h3>
        <p className="text-text-secondary text-sm text-center max-w-md mb-6">
          {language === "fr"
            ? "Testez votre compréhension de la vidéo avec un quiz interactif généré par IA."
            : "Test your understanding of the video with an AI-generated interactive quiz."}
        </p>
        <button
          onClick={onGenerate}
          className="btn btn-primary flex items-center gap-2 px-6 py-2.5"
        >
          <Sparkles className="w-4 h-4" />
          {language === "fr" ? "Générer le quiz" : "Generate quiz"}
        </button>
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <DeepSightSpinner />
        <p className="text-text-secondary text-sm mt-4">
          {language === "fr" ? "Génération du quiz..." : "Generating quiz..."}
        </p>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button onClick={onGenerate} className="btn btn-ghost text-sm">
          {language === "fr" ? "Réessayer" : "Retry"}
        </button>
      </div>
    );
  }

  // Quiz generated
  if (questions && questions.length > 0) {
    if (quizComplete) {
      return (
        <div className="p-4 sm:p-6">
          <ScoreCard
            score={Math.round((quizScore.correct / questions.length) * 100)}
            total={questions.length}
            correct={quizScore.correct}
            incorrect={quizScore.incorrect}
            mode="quiz"
            onRetry={handleRetry}
            language={language}
          />
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6">
        {quizProgress.total > 0 && (
          <div className="mb-6">
            <StudyProgress
              current={quizProgress.current}
              total={quizProgress.total}
              correct={quizProgress.score}
              incorrect={quizProgress.current - quizProgress.score}
              mode="quiz"
              language={language}
            />
          </div>
        )}
        <QuizQuestion
          questions={questions}
          onComplete={handleQuizComplete}
          onProgress={handleQuizProgress}
          language={language}
        />
      </div>
    );
  }

  return null;
};
