/**
 * DEEP SIGHT — Study Page
 * Page d'étude avec Flashcards, Quiz et Mode Session FSRS
 *
 * FONCTIONNALITÉS:
 * - 📚 Tabs: Flashcards | Quiz (génération initiale)
 * - 🧠 Mode Session FSRS: flip 3D + ConfidenceButtons (1-4) + XP
 * - ⌨️ Raccourcis clavier: Espace = flip, 1-4 = rating
 * - 📊 Progression en temps réel
 * - 🏆 Score final / SessionResults
 * - 🔙 Navigation vers l'analyse
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Brain,
  ChevronLeft,
  AlertCircle,
  BookMarked,
  HelpCircle,
  Star,
  Zap,
} from "lucide-react";
import {
  DeepSightSpinner,
  DeepSightSpinnerMicro,
} from "../components/ui/DeepSightSpinner";
import {
  FlashcardDeck,
  QuizQuestion,
  StudyProgress,
  ScoreCard,
  ConfidenceButtons,
  SessionResults,
} from "../components/Study";
import type {
  Flashcard,
  FlashcardStats,
  QuizQuestionData,
} from "../components/Study";
import { useTranslation } from "../hooks/useTranslation";
import { studyApi, videoApi } from "../services/api";
import { useStudyStore } from "../store/studyStore";
import type { SessionEndResult } from "../types/gamification";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";
import { StudyWarmUp } from "../components/StudyWarmUp";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabType = "flashcards" | "quiz";

interface StudyData {
  flashcards: Flashcard[];
  quiz: QuizQuestionData[];
  videoTitle: string;
  videoId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 API (using studyApi service)
// ═══════════════════════════════════════════════════════════════════════════════

const fetchStudyData = async (
  summaryId: string,
  generateFlashcards: boolean,
  generateQuiz: boolean,
): Promise<StudyData> => {
  // First get the summary info for the title
  const summary = await videoApi.getSummary(parseInt(summaryId));

  let flashcards: Flashcard[] = [];
  let quiz: QuizQuestionData[] = [];

  // Generate flashcards if requested (costs 1 credit)
  if (generateFlashcards) {
    try {
      const flashcardsResponse = await studyApi.generateFlashcards(
        parseInt(summaryId),
      );
      flashcards = (flashcardsResponse.flashcards || []).map((item) => ({
        front: item.front,
        back: item.back,
      }));
    } catch (err) {
      console.error("Error generating flashcards:", err);
    }
  }

  // Generate quiz if requested (costs 1 credit)
  if (generateQuiz) {
    try {
      const quizResponse = await studyApi.generateQuiz(parseInt(summaryId));
      quiz = (quizResponse.quiz || []).map((q) => ({
        question: q.question,
        options: q.options,
        correct: q.correct_index,
        explanation: q.explanation || "",
      }));
    } catch (err) {
      console.error("Error generating quiz:", err);
    }
  }

  return {
    flashcards,
    quiz,
    videoTitle: summary.video_title || "Untitled",
    videoId: summaryId,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { summaryId: paramSummaryId } = useParams<{ summaryId: string }>();
  const navigate = useNavigate();
  const { language } = useTranslation();

  // Support both route param and query param for backwards compatibility
  const summaryId = paramSummaryId || searchParams.get("id");
  const initialTab = (searchParams.get("tab") as TabType) || "flashcards";
  const autoSession = searchParams.get("session") === "true";

  // ── Existing state ──
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Progress tracking
  const [flashcardProgress, setFlashcardProgress] = useState({
    current: 0,
    total: 0,
  });
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats | null>(
    null,
  );
  const [quizProgress, setQuizProgress] = useState({
    current: 0,
    total: 0,
    score: 0,
  });
  const [showResults, setShowResults] = useState(false);
  const [finalScore, setFinalScore] = useState({ correct: 0, incorrect: 0 });

  // State for tracking if content has been generated
  const [hasGeneratedFlashcards, setHasGeneratedFlashcards] = useState(false);
  const [hasGeneratedQuiz, setHasGeneratedQuiz] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Session FSRS state ──
  const [isSessionMode, setIsSessionMode] = useState(false);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [sessionEndResult, setSessionEndResult] =
    useState<SessionEndResult | null>(null);
  const [showWarmUp, setShowWarmUp] = useState(true);
  const autoStartRef = useRef(false);

  // ── Store access ──
  const {
    dueCards,
    loading: storeLoading,
    sessionXP,
    sessionCards: sessionCardCount,
    sessionCorrect,
    fetchDueCards,
    startSession,
    submitReview,
    endSession,
    resetSession,
  } = useStudyStore();

  // ── Derived session data ──
  const allSessionCards = useMemo(() => {
    if (!dueCards) return [];
    return [...(dueCards.due_cards || []), ...(dueCards.new_cards || [])];
  }, [dueCards]);

  const currentCard = allSessionCards[sessionIndex] ?? null;
  const hasDueCards = allSessionCards.length > 0;

  // ── Localized texts ──
  const texts = {
    fr: {
      title: "Mode Étude",
      flashcards: "Flashcards",
      quiz: "Quiz",
      backToAnalysis: "Retour à l'analyse",
      loading: "Chargement des données...",
      error: "Impossible de charger les données",
      noData: "Aucune donnée disponible",
      retry: "Réessayer",
      noId: "ID de résumé manquant",
    },
    en: {
      title: "Study Mode",
      flashcards: "Flashcards",
      quiz: "Quiz",
      backToAnalysis: "Back to analysis",
      loading: "Loading data...",
      error: "Failed to load data",
      noData: "No data available",
      retry: "Retry",
      noId: "Missing summary ID",
    },
  }[language];

  // ═════════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═════════════════════════════════════════════════════════════════════════════

  // ── FSRS-first flow: fetch due cards, auto-start session ──
  useEffect(() => {
    if (summaryId) {
      fetchDueCards(parseInt(summaryId));
    }
  }, [summaryId]);

  // Auto-start FSRS session if ?session=true
  useEffect(() => {
    if (
      autoSession &&
      !autoStartRef.current &&
      dueCards &&
      !storeLoading &&
      allSessionCards.length > 0 &&
      summaryId
    ) {
      autoStartRef.current = true;
      resetSession();
      startSession(parseInt(summaryId), "flashcards");
      setIsSessionMode(true);
      setIsLoading(false);
    }
    // If autoSession but no cards after loading, exit loading state
    if (
      autoSession &&
      dueCards &&
      !storeLoading &&
      allSessionCards.length === 0
    ) {
      setIsLoading(false);
    }
  }, [autoSession, dueCards, storeLoading, allSessionCards.length, summaryId]);

  // ── Tab-based generation (only when NOT in autoSession mode) ──
  useEffect(() => {
    // Skip expensive tab-based generation when entering via session mode
    if (autoSession) {
      // Still fetch video title for display
      if (summaryId && !studyData) {
        videoApi
          .getSummary(parseInt(summaryId))
          .then((summary) => {
            setStudyData({
              flashcards: [],
              quiz: [],
              videoTitle: summary.video_title || "Untitled",
              videoId: summaryId,
            });
          })
          .catch(() => {});
      }
      return;
    }

    if (!summaryId) {
      setError(texts.noId);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setIsGenerating(true);
      setError(null);

      try {
        // Generate content for the active tab
        const generateFlash =
          activeTab === "flashcards" && !hasGeneratedFlashcards;
        const generateQ = activeTab === "quiz" && !hasGeneratedQuiz;

        const data = await fetchStudyData(summaryId, generateFlash, generateQ);

        // Merge with existing data
        setStudyData((prev) => ({
          flashcards: generateFlash ? data.flashcards : prev?.flashcards || [],
          quiz: generateQ ? data.quiz : prev?.quiz || [],
          videoTitle: data.videoTitle,
          videoId: data.videoId,
        }));

        if (generateFlash) {
          setHasGeneratedFlashcards(true);
          setFlashcardProgress({ current: 0, total: data.flashcards.length });
        }
        if (generateQ) {
          setHasGeneratedQuiz(true);
          setQuizProgress({ current: 0, total: data.quiz.length, score: 0 });
        }
      } catch (err: any) {
        console.error("Error loading study data:", err);
        if (err.status === 402) {
          setError(
            language === "fr" ? "Crédits insuffisants" : "Insufficient credits",
          );
        } else {
          setError(texts.error);
        }
      } finally {
        setIsLoading(false);
        setIsGenerating(false);
      }
    };

    // Only load if we need to generate content for the active tab
    const needsGeneration =
      (activeTab === "flashcards" && !hasGeneratedFlashcards) ||
      (activeTab === "quiz" && !hasGeneratedQuiz);

    if (needsGeneration || !studyData) {
      loadData();
    }
  }, [
    summaryId,
    activeTab,
    hasGeneratedFlashcards,
    hasGeneratedQuiz,
    autoSession,
  ]);

  // ── Keyboard shortcuts for session mode ──
  useEffect(() => {
    if (!isSessionMode || sessionEndResult) return;

    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      }
      if (isFlipped && !isRating && e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        handleRate(parseInt(e.key) as 1 | 2 | 3 | 4);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSessionMode, isFlipped, isRating, sessionEndResult]);

  // ═════════════════════════════════════════════════════════════════════════════
  // HANDLERS (existing)
  // ═════════════════════════════════════════════════════════════════════════════

  const handleFlashcardProgress = useCallback(
    (current: number, total: number, stats: FlashcardStats) => {
      setFlashcardProgress({ current, total });
      setFlashcardStats(stats);
    },
    [],
  );

  const handleFlashcardComplete = useCallback((stats: FlashcardStats) => {
    setFlashcardStats(stats);
    setFinalScore({ correct: stats.known, incorrect: stats.unknown });
    setShowResults(true);
  }, []);

  const handleQuizProgress = useCallback(
    (current: number, total: number, score: number) => {
      setQuizProgress({ current, total, score });
    },
    [],
  );

  const handleQuizComplete = useCallback((score: number, total: number) => {
    setFinalScore({ correct: score, incorrect: total - score });
    setShowResults(true);
  }, []);

  const handleRetry = useCallback(() => {
    setShowResults(false);
    setFinalScore({ correct: 0, incorrect: 0 });
  }, []);

  const handleBack = () => {
    navigate(`/dashboard?id=${summaryId}`);
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // HANDLERS (session FSRS)
  // ═════════════════════════════════════════════════════════════════════════════

  const handleStartSession = useCallback(async () => {
    if (!summaryId) return;
    setIsStartingSession(true);
    setSessionIndex(0);
    setIsFlipped(false);
    setSessionEndResult(null);
    resetSession();
    await fetchDueCards(parseInt(summaryId));
    await startSession(parseInt(summaryId), "flashcards");
    setIsStartingSession(false);
    setIsSessionMode(true);
  }, [summaryId, fetchDueCards, startSession, resetSession]);

  const handleRate = useCallback(
    async (rating: 1 | 2 | 3 | 4) => {
      if (!summaryId || !currentCard || isRating) return;
      setIsRating(true);
      try {
        await submitReview(
          parseInt(summaryId),
          currentCard.card_index,
          currentCard.front,
          rating,
        );
        setIsFlipped(false);
        const next = sessionIndex + 1;
        if (next >= allSessionCards.length) {
          const result = await endSession();
          setSessionEndResult(result);
        } else {
          setSessionIndex(next);
        }
      } finally {
        setIsRating(false);
      }
    },
    [
      summaryId,
      currentCard,
      sessionIndex,
      allSessionCards.length,
      submitReview,
      endSession,
      isRating,
    ],
  );

  const handleExitSession = useCallback(() => {
    setIsSessionMode(false);
    setSessionEndResult(null);
    setSessionIndex(0);
    setIsFlipped(false);
    resetSession();
  }, [resetSession]);

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER — Loading state
  // ═════════════════════════════════════════════════════════════════════════════

  if (
    (isLoading || (autoSession && storeLoading)) &&
    !studyData &&
    !isSessionMode
  ) {
    const loadingMessage = autoSession
      ? language === "fr"
        ? "Préparation de la session de révision..."
        : "Preparing study session..."
      : isGenerating
        ? activeTab === "flashcards"
          ? language === "fr"
            ? "Génération des flashcards..."
            : "Generating flashcards..."
          : language === "fr"
            ? "Génération du quiz..."
            : "Generating quiz..."
        : texts.loading;

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <DeepSightSpinner size="lg" />
            </div>
            <p className="text-gray-400">{loadingMessage}</p>
            {!autoSession && (
              <p className="text-gray-500 text-sm mt-2">
                {language === "fr" ? "Coût: 1 crédit" : "Cost: 1 credit"}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER — Error state
  // ═════════════════════════════════════════════════════════════════════════════

  if ((error || !studyData) && !isSessionMode && !autoSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center glass-panel rounded-2xl p-8 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">{texts.error}</h2>
            <p className="text-gray-400 mb-6">{error || texts.noData}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30
                       text-amber-400 rounded-lg transition-colors mx-auto"
            >
              <ChevronLeft className="w-4 h-4" />
              {texts.backToAnalysis}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // After this point, in non-session/auto modes, studyData is guaranteed.
  // In session modes a separate render path runs first; we still need a guard
  // for the type-checker.
  if (!studyData) {
    return null;
  }

  const currentProgress =
    activeTab === "flashcards" ? flashcardProgress : quizProgress;
  const hasFlashcards = studyData.flashcards.length > 0;
  const hasQuiz = studyData.quiz.length > 0;

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER — Main
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <SEO title="Révision" path="/study" />
      <DoodleBackground variant="academic" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={isSessionMode ? handleExitSession : handleBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">
              {isSessionMode
                ? language === "fr"
                  ? "Quitter la session"
                  : "Exit session"
                : texts.backToAnalysis}
            </span>
          </button>
          <div className="flex items-center gap-2">
            {isSessionMode ? (
              <>
                <Star className="w-5 h-5 text-amber-400" />
                <span className="text-lg font-semibold text-amber-400">
                  +{sessionXP} XP
                </span>
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h1 className="text-lg font-semibold text-white">
                  {texts.title}
                </h1>
              </>
            )}
          </div>
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Video title */}
        <h2 className="text-xl font-bold text-white text-center mb-6 line-clamp-2">
          {studyData.videoTitle}
        </h2>

        {/* 💡 Warm-Up Card — avant le début de l'étude */}
        {showWarmUp && !isSessionMode && !showResults && (
          <AnimatePresence>
            <StudyWarmUp
              category={
                (studyData.flashcards[0] as { tags?: string[] })?.tags?.[0]
              }
              onStart={() => setShowWarmUp(false)}
            />
          </AnimatePresence>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SESSION FSRS MODE                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {showWarmUp && !isSessionMode && !showResults ? null : isSessionMode ? (
          <div className="max-w-xl mx-auto">
            {/* Session Results */}
            {sessionEndResult ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <SessionResults
                  cardsReviewed={sessionCardCount}
                  xpEarned={sessionEndResult.xp_earned}
                  accuracy={
                    sessionCardCount > 0
                      ? Math.round((sessionCorrect / sessionCardCount) * 100)
                      : 0
                  }
                  newBadges={sessionEndResult.new_badges}
                  onClose={handleExitSession}
                />
              </motion.div>
            ) : currentCard ? (
              <>
                {/* Progress header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-400">
                    {sessionIndex + 1} / {allSessionCards.length}
                  </span>
                  <span className="text-xs text-gray-500">
                    {language === "fr" ? "Session FSRS" : "FSRS Session"}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full bg-white/5 mb-8 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(sessionIndex / allSessionCards.length) * 100}%`,
                    }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>

                {/* 3D Flip Card */}
                <div style={{ perspective: 1000 }} className="mb-6">
                  <motion.div
                    key={sessionIndex}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="relative w-full cursor-pointer"
                      style={{
                        minHeight: 260,
                        transformStyle: "preserve-3d",
                        transform: isFlipped ? "rotateY(180deg)" : "rotateY(0)",
                        transition:
                          "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                      }}
                    >
                      {/* FRONT */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-br from-indigo-500/[0.08] to-violet-500/[0.04] border border-indigo-500/20"
                        style={{ backfaceVisibility: "hidden" }}
                      >
                        <span className="text-[10px] font-semibold tracking-widest text-indigo-400 uppercase mb-4">
                          Question
                        </span>
                        <p className="text-lg text-white text-center leading-relaxed font-medium">
                          {currentCard.front}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-6">
                          {language === "fr"
                            ? "Cliquer ou Espace pour révéler"
                            : "Click or Space to reveal"}
                        </p>
                      </div>

                      {/* BACK */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-br from-emerald-500/[0.08] to-cyan-500/[0.04] border border-emerald-500/20"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                      >
                        <span className="text-[10px] font-semibold tracking-widest text-emerald-400 uppercase mb-4">
                          {language === "fr" ? "Réponse" : "Answer"}
                        </span>
                        <p className="text-base text-gray-200 text-center leading-relaxed">
                          {currentCard.back}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Confidence Buttons (only when flipped) */}
                <AnimatePresence>
                  {isFlipped && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ConfidenceButtons
                        onRate={handleRate}
                        disabled={isRating}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Keyboard hint */}
                <p className="text-center text-[11px] text-gray-600 mt-6">
                  {language === "fr"
                    ? "Espace = retourner · 1-4 = noter la difficulté"
                    : "Space = flip · 1-4 = rate difficulty"}
                </p>
              </>
            ) : (
              /* Loading cards */
              <div className="text-center py-16">
                <div className="flex justify-center mb-4">
                  <DeepSightSpinner size="lg" />
                </div>
                <p className="text-gray-400">
                  {language === "fr"
                    ? "Chargement des cartes..."
                    : "Loading cards..."}
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════════════ */}
            {/* MODE SESSION BUTTON (visible when not in session)             */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {hasDueCards && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mb-4"
              >
                <button
                  onClick={handleStartSession}
                  disabled={isStartingSession}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm
                           bg-gradient-to-r from-indigo-500/20 to-violet-500/20
                           text-indigo-400 border border-indigo-500/30
                           hover:from-indigo-500/30 hover:to-violet-500/30
                           disabled:opacity-50 transition-all"
                >
                  {isStartingSession ? (
                    <DeepSightSpinnerMicro onLight />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {language === "fr" ? "Mode Session" : "Session Mode"}
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-500/20 text-[11px]">
                    {allSessionCards.length}{" "}
                    {language === "fr" ? "dues" : "due"}
                  </span>
                </button>
              </motion.div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* EXISTING TABS + CONTENT                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}

            {/* Tabs */}
            <div className="flex justify-center gap-2 mb-6">
              <button
                onClick={() => {
                  setActiveTab("flashcards");
                  setShowResults(false);
                }}
                disabled={!hasFlashcards}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                          ${
                            activeTab === "flashcards"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                              : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
                          } ${!hasFlashcards ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <BookMarked className="w-5 h-5" />
                {texts.flashcards}
                {hasFlashcards && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-700 text-xs">
                    {studyData.flashcards.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setActiveTab("quiz");
                  setShowResults(false);
                }}
                disabled={!hasQuiz}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                          ${
                            activeTab === "quiz"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                              : "bg-gray-800/50 text-gray-400 hover:bg-gray-700/50"
                          } ${!hasQuiz ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <HelpCircle className="w-5 h-5" />
                {texts.quiz}
                {hasQuiz && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-gray-700 text-xs">
                    {studyData.quiz.length}
                  </span>
                )}
              </button>
            </div>

            {/* Progress bar (when not showing results) */}
            {!showResults && currentProgress.total > 0 && (
              <div className="mb-6">
                <StudyProgress
                  current={currentProgress.current}
                  total={currentProgress.total}
                  correct={
                    activeTab === "flashcards"
                      ? flashcardStats?.known || 0
                      : quizProgress.score
                  }
                  incorrect={
                    activeTab === "flashcards"
                      ? flashcardStats?.unknown || 0
                      : currentProgress.current - quizProgress.score
                  }
                  mode={activeTab === "flashcards" ? "flashcard" : "quiz"}
                  language={language}
                />
              </div>
            )}

            {/* Content */}
            <div className="glass-panel rounded-2xl p-6 min-h-[500px]">
              {showResults ? (
                <ScoreCard
                  score={finalScore.correct}
                  total={
                    activeTab === "flashcards"
                      ? studyData.flashcards.length
                      : studyData.quiz.length
                  }
                  correct={finalScore.correct}
                  incorrect={finalScore.incorrect}
                  mode={activeTab === "flashcards" ? "flashcard" : "quiz"}
                  onRetry={handleRetry}
                  language={language}
                />
              ) : activeTab === "flashcards" ? (
                hasFlashcards ? (
                  <FlashcardDeck
                    flashcards={studyData.flashcards}
                    onProgress={handleFlashcardProgress}
                    onComplete={handleFlashcardComplete}
                    language={language}
                  />
                ) : (
                  <EmptyState type="flashcards" language={language} />
                )
              ) : hasQuiz ? (
                <QuizQuestion
                  questions={studyData.quiz}
                  onProgress={handleQuizProgress}
                  onComplete={handleQuizComplete}
                  language={language}
                />
              ) : (
                <EmptyState type="quiz" language={language} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  type: "flashcards" | "quiz";
  language: "fr" | "en";
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, language }) => {
  const texts = {
    fr: {
      flashcards: {
        title: "Aucune flashcard",
        message: "Les flashcards ne sont pas encore générées pour cette vidéo.",
      },
      quiz: {
        title: "Aucun quiz",
        message: "Le quiz n'est pas encore généré pour cette vidéo.",
      },
    },
    en: {
      flashcards: {
        title: "No flashcards",
        message: "Flashcards are not yet generated for this video.",
      },
      quiz: {
        title: "No quiz",
        message: "Quiz is not yet generated for this video.",
      },
    },
  }[language][type];

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {type === "flashcards" ? (
        <BookMarked className="w-16 h-16 text-gray-600 mb-4" />
      ) : (
        <Brain className="w-16 h-16 text-gray-600 mb-4" />
      )}
      <h3 className="text-xl font-semibold text-gray-400 mb-2">
        {texts.title}
      </h3>
      <p className="text-gray-500">{texts.message}</p>
    </div>
  );
};

export default StudyPage;
