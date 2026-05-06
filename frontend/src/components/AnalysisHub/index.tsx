/**
 * DEEP SIGHT — AnalysisHub
 * Panel à onglets regroupant tous les outputs d'une analyse :
 * Synthèse | Quiz | Flashcards | Fiabilité
 */

import React, { useState, useEffect, useCallback } from "react";
import { BookOpen, Brain, BookMarked, Shield, Target, Eye } from "lucide-react";
import { SynthesisTab } from "./SynthesisTab";
import { QuizTab } from "./QuizTab";
import { FlashcardsTab } from "./FlashcardsTab";
import { ReliabilityTab } from "./ReliabilityTab";
import { GeoTab } from "./GeoTab";
import { VisualTab } from "./VisualTab";
import { studyApi } from "../../services/api";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
} from "../../services/api";
import type { QuizQuestionData } from "../Study";
import type { Flashcard } from "../Study";
import type { TimecodeInfo } from "../TimecodeRenderer";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabType =
  | "synthesis"
  | "quiz"
  | "flashcards"
  | "reliability"
  | "geo"
  | "visual";

interface AnalysisHubProps {
  selectedSummary: Summary;
  reliabilityData: ReliabilityResult | null;
  reliabilityLoading: boolean;
  user: { plan?: string; credits?: number };
  language: "fr" | "en";
  concepts: EnrichedConcept[];
  onTimecodeClick: (seconds: number, info?: TimecodeInfo) => void;
  onOpenChat: (prefillMessage?: string) => void;
  onNavigate: (path: string) => void;
  /** Which tabs to show. Defaults to all. */
  enabledTabs?: TabType[];
  /** Show Keywords button in SynthesisTab toolbar */
  showKeywords?: boolean;
  /** Show Study Tools button in SynthesisTab toolbar */
  showStudyTools?: boolean;
  /** Show Voice Chat button in SynthesisTab toolbar */
  showVoice?: boolean;
  /** Voice chat enabled for user's plan */
  voiceEnabled?: boolean;
  /** Callback to open voice modal (managed by parent) */
  onOpenVoice?: () => void;
  /**
   * Si fourni, le composant fonctionne en mode "controlled" : l'onglet actif
   * est piloté par le parent. Sinon, fallback au state local (rétrocompat
   * avec Dashboard existant).
   */
  activeTabExternal?: TabType;
  /** Setter externe — requis si `activeTabExternal` est fourni. */
  onTabChange?: (tab: TabType) => void;
  /** Si true, masque la tab bar interne (le parent affiche sa propre HubTabBar). */
  hideInternalTabBar?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 TAB STYLES (static classes — no dynamic Tailwind)
// ═══════════════════════════════════════════════════════════════════════════════

const TABS: {
  id: TabType;
  labelFr: string;
  labelEn: string;
  icon: typeof BookOpen;
  activeColor: string;
  activeBorder: string;
}[] = [
  {
    id: "synthesis",
    labelFr: "Synthèse",
    labelEn: "Summary",
    icon: BookOpen,
    activeColor: "text-blue-400",
    activeBorder: "border-blue-500",
  },
  {
    id: "quiz",
    labelFr: "Quiz",
    labelEn: "Quiz",
    icon: Brain,
    activeColor: "text-amber-400",
    activeBorder: "border-amber-500",
  },
  {
    id: "flashcards",
    labelFr: "Flashcards",
    labelEn: "Flashcards",
    icon: BookMarked,
    activeColor: "text-emerald-400",
    activeBorder: "border-emerald-500",
  },
  {
    id: "reliability",
    labelFr: "Fiabilité",
    labelEn: "Reliability",
    icon: Shield,
    activeColor: "text-violet-400",
    activeBorder: "border-violet-500",
  },
  {
    id: "geo",
    labelFr: "GEO",
    labelEn: "GEO",
    icon: Target,
    activeColor: "text-teal-400",
    activeBorder: "border-teal-500",
  },
  {
    id: "visual",
    labelFr: "Visuel",
    labelEn: "Visual",
    icon: Eye,
    activeColor: "text-indigo-400",
    activeBorder: "border-indigo-500",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const AnalysisHub: React.FC<AnalysisHubProps> = ({
  selectedSummary,
  reliabilityData,
  reliabilityLoading,
  user,
  language,
  concepts,
  onTimecodeClick,
  onOpenChat,
  onNavigate,
  enabledTabs,
  showKeywords,
  showStudyTools,
  showVoice,
  voiceEnabled,
  onOpenVoice,
  activeTabExternal,
  onTabChange,
  hideInternalTabBar,
}) => {
  const [activeTabInternal, setActiveTabInternal] =
    useState<TabType>("synthesis");
  const activeTab = activeTabExternal ?? activeTabInternal;
  const setActiveTab = onTabChange ?? setActiveTabInternal;

  // Quiz state (lazy)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestionData[] | null>(
    null,
  );
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);

  // Flashcards state (lazy)
  const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);

  // Reset quiz/flashcards when summary changes
  useEffect(() => {
    setQuizQuestions(null);
    setQuizLoading(false);
    setQuizError(null);
    setFlashcards(null);
    setFlashcardsLoading(false);
    setFlashcardsError(null);
    if (!activeTabExternal) {
      setActiveTab("synthesis");
    }
  }, [selectedSummary.id]);

  // Generate quiz
  const handleGenerateQuiz = useCallback(async () => {
    if (!selectedSummary?.id) return;
    setQuizLoading(true);
    setQuizError(null);
    try {
      const response = await studyApi.generateQuiz(selectedSummary.id);
      if (response.success && response.quiz?.length > 0) {
        const mapped: QuizQuestionData[] = response.quiz.map((q) => ({
          question: q.question,
          options: q.options,
          correct: q.correct_answer,
          explanation: q.explanation,
        }));
        setQuizQuestions(mapped);
      } else {
        setQuizError(
          language === "fr"
            ? "Impossible de générer le quiz."
            : "Failed to generate quiz.",
        );
      }
    } catch (err: any) {
      setQuizError(
        err?.message ||
          (language === "fr"
            ? "Erreur lors de la génération."
            : "Generation error."),
      );
    } finally {
      setQuizLoading(false);
    }
  }, [selectedSummary.id, language]);

  // Generate flashcards
  const handleGenerateFlashcards = useCallback(async () => {
    if (!selectedSummary?.id) return;
    setFlashcardsLoading(true);
    setFlashcardsError(null);
    try {
      const response = await studyApi.generateFlashcards(selectedSummary.id);
      if (response.success && response.flashcards?.length > 0) {
        const mapped: Flashcard[] = response.flashcards.map((fc, i) => ({
          front: fc.front,
          back: fc.back,
          id: i,
        }));
        setFlashcards(mapped);
      } else {
        setFlashcardsError(
          language === "fr"
            ? "Impossible de générer les flashcards."
            : "Failed to generate flashcards.",
        );
      }
    } catch (err: any) {
      setFlashcardsError(
        err?.message ||
          (language === "fr"
            ? "Erreur lors de la génération."
            : "Generation error."),
      );
    } finally {
      setFlashcardsLoading(false);
    }
  }, [selectedSummary.id, language]);

  // Badges
  const getTabBadge = (tabId: TabType): string | null => {
    if (tabId === "quiz" && quizQuestions) return `${quizQuestions.length}`;
    if (tabId === "flashcards" && flashcards) return `${flashcards.length}`;
    if (
      tabId === "reliability" &&
      reliabilityData?.fact_check_lite?.high_risk_claims?.length
    ) {
      return `${reliabilityData.fact_check_lite.high_risk_claims.length}`;
    }
    return null;
  };

  const visibleTabs = enabledTabs
    ? TABS.filter((t) => enabledTabs.includes(t.id))
    : TABS;

  return (
    <div className="card overflow-hidden">
      {/* Tab Bar — hidden if only one tab */}
      {!hideInternalTabBar && visibleTabs.length > 1 && (
        <div className="sticky top-0 z-10 flex border-b border-border-subtle overflow-x-auto scrollbar-hide bg-[#12121a]/95 backdrop-blur-sm">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const label = language === "fr" ? tab.labelFr : tab.labelEn;
            const badge = getTabBadge(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 text-sm font-medium
                border-b-2 transition-all duration-200 whitespace-nowrap flex-shrink-0
                ${
                  isActive
                    ? `${tab.activeBorder} ${tab.activeColor}`
                    : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-white/10"
                }
              `}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {badge && (
                  <span
                    className={`
                  text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center
                  ${tab.id === "reliability" ? "bg-red-500/20 text-red-400" : "bg-white/10 text-text-secondary"}
                `}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "synthesis" && (
        <SynthesisTab
          selectedSummary={selectedSummary}
          user={user}
          language={language}
          concepts={concepts}
          onTimecodeClick={onTimecodeClick}
          onNavigate={onNavigate}
          showKeywords={showKeywords}
          showStudyTools={showStudyTools}
          showVoice={showVoice}
          voiceEnabled={voiceEnabled}
          onOpenVoice={onOpenVoice}
        />
      )}

      {activeTab === "quiz" && (
        <QuizTab
          questions={quizQuestions}
          loading={quizLoading}
          error={quizError}
          onGenerate={handleGenerateQuiz}
          language={language}
        />
      )}

      {activeTab === "flashcards" && (
        <FlashcardsTab
          flashcards={flashcards}
          loading={flashcardsLoading}
          error={flashcardsError}
          onGenerate={handleGenerateFlashcards}
          language={language}
        />
      )}

      {activeTab === "reliability" && (
        <ReliabilityTab
          selectedSummary={selectedSummary}
          reliabilityData={reliabilityData}
          reliabilityLoading={reliabilityLoading}
          language={language}
          onOpenChat={onOpenChat}
          onNavigate={onNavigate}
        />
      )}

      {activeTab === "geo" && (
        <GeoTab
          selectedSummary={selectedSummary}
          user={user}
          language={language}
        />
      )}

      {activeTab === "visual" && (
        <VisualTab
          visualAnalysis={selectedSummary.visual_analysis}
          language={language}
        />
      )}
    </div>
  );
};
