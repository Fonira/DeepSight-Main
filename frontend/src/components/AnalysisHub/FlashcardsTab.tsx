/**
 * DEEP SIGHT — AnalysisHub / FlashcardsTab
 * Onglet Flashcards : génération lazy + cartes interactives
 */

import React, { useState, useCallback } from "react";
import { BookMarked, Sparkles } from "lucide-react";
import { DeepSightSpinner } from "../ui";
import { FlashcardDeck, StudyProgress, ScoreCard } from "../Study";
import type { Flashcard, FlashcardStats } from "../Study";

interface FlashcardsTabProps {
  flashcards: Flashcard[] | null;
  loading: boolean;
  error: string | null;
  onGenerate: () => void;
  language: "fr" | "en";
}

export const FlashcardsTab: React.FC<FlashcardsTabProps> = ({
  flashcards,
  loading,
  error,
  onGenerate,
  language,
}) => {
  const [fcProgress, setFcProgress] = useState({ current: 0, total: 0 });
  const [fcComplete, setFcComplete] = useState(false);
  const [fcStats, setFcStats] = useState<FlashcardStats>({
    known: 0,
    unknown: 0,
    total: 0,
    percentage: 0,
  });

  const handleFcProgress = useCallback(
    (_current: number, _total: number, stats: FlashcardStats) => {
      setFcProgress({
        current: stats.known + stats.unknown,
        total: stats.total,
      });
      setFcStats(stats);
    },
    [],
  );

  const handleFcComplete = useCallback((stats: FlashcardStats) => {
    setFcComplete(true);
    setFcStats(stats);
  }, []);

  const handleRetry = () => {
    setFcComplete(false);
    setFcProgress({ current: 0, total: 0 });
    setFcStats({ known: 0, unknown: 0, total: 0, percentage: 0 });
    onGenerate();
  };

  // Not generated yet
  if (!flashcards && !loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-5">
          <BookMarked className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          {language === "fr" ? "Flashcards de révision" : "Review Flashcards"}
        </h3>
        <p className="text-text-secondary text-sm text-center max-w-md mb-6">
          {language === "fr"
            ? "Révisez les concepts clés avec des cartes recto-verso générées par IA."
            : "Review key concepts with AI-generated flip cards."}
        </p>
        <button
          onClick={onGenerate}
          className="btn btn-primary flex items-center gap-2 px-6 py-2.5"
        >
          <Sparkles className="w-4 h-4" />
          {language === "fr" ? "Générer les flashcards" : "Generate flashcards"}
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
          {language === "fr"
            ? "Génération des flashcards..."
            : "Generating flashcards..."}
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

  // Flashcards generated
  if (flashcards && flashcards.length > 0) {
    if (fcComplete) {
      return (
        <div className="p-4 sm:p-6">
          <ScoreCard
            score={fcStats.percentage}
            total={fcStats.total}
            correct={fcStats.known}
            incorrect={fcStats.unknown}
            mode="flashcard"
            onRetry={handleRetry}
            language={language}
          />
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6">
        {fcProgress.total > 0 && (
          <div className="mb-6">
            <StudyProgress
              current={fcProgress.current}
              total={fcProgress.total}
              correct={fcStats.known}
              incorrect={fcStats.unknown}
              mode="flashcard"
              language={language}
            />
          </div>
        )}
        <FlashcardDeck
          flashcards={flashcards}
          onComplete={handleFcComplete}
          onProgress={handleFcProgress}
          language={language}
        />
      </div>
    );
  }

  return null;
};
