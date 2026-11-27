/**
 * DEEP SIGHT — Study Tools Modal v2.0
 * Modal combinant fiches de révision et arbres pédagogiques
 *
 * FONCTIONNALITÉS:
 * - 🎓 Génération de fiches de révision avec nombre de questions configurable
 * - 🌳 Génération d'arbres pédagogiques avec profondeur variable
 * - 💰 Affichage des coûts en crédits
 * - 📊 Affichage des résultats
 * - 📥 Export des contenus
 */

import React, { useState, useEffect } from "react";
import {
  X,
  GraduationCap,
  GitBranch,
  Sparkles,
  AlertCircle,
  BookOpen,
  Brain,
  ChevronRight,
  Zap,
  Settings,
  Plus,
  Minus,
  Info,
  Lock,
  Crown,
} from "lucide-react";
import { DeepSightSpinner } from "./ui";
import { StudyCard } from "./StudyCard";
import { ConceptMap } from "./ConceptMap";
import { request } from "../services/api";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StudyToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryId: number;
  videoTitle: string;
  language?: "fr" | "en";
  userPlan?: string;
  userCredits?: number;
}

type ToolType = "card" | "mindmap" | "all";
type ViewMode = "select" | "options" | "loading" | "results";

// Coût réel débité par /api/videos/study/* (backend videos/router.py) :
// 1 crédit par outil, 2 pour le pack. Remboursé si la génération échoue.
const TOOL_COSTS: Record<ToolType, number> = { card: 1, mindmap: 1, all: 2 };

// Bornes des sélecteurs d'options (anciennes valeurs par défaut de l'UI)
const MAX_QUIZ_QUESTIONS = 15;
const MAX_MINDMAP_DEPTH = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 API — via request() (renouvellement du jeton sur 401)
// ═══════════════════════════════════════════════════════════════════════════════

interface StudyMaterials {
  study_card?: unknown;
  concept_map?: unknown;
  study_card_error?: string;
  concept_map_error?: string;
}

interface StudyToolResponse extends StudyMaterials {
  materials?: StudyMaterials;
  credits_remaining?: number;
}

const generateStudyCard = (summaryId: number, questionCount: number) =>
  request<StudyToolResponse>(`/api/videos/study/${summaryId}/card`, {
    method: "POST",
    body: { question_count: questionCount },
    timeout: 180000,
  });

const generateConceptMap = (
  summaryId: number,
  depthLevel: number,
  withDetails: boolean,
) =>
  request<StudyToolResponse>(`/api/videos/study/${summaryId}/mindmap`, {
    method: "POST",
    body: { depth_level: depthLevel, with_detailed_concepts: withDetails },
    timeout: 180000,
  });

const generateAllMaterials = (
  summaryId: number,
  questionCount: number,
  depthLevel: number,
  withDetails: boolean,
) =>
  request<StudyToolResponse>(`/api/videos/study/${summaryId}/all`, {
    method: "POST",
    body: {
      question_count: questionCount,
      depth_level: depthLevel,
      with_detailed_concepts: withDetails,
    },
    timeout: 180000,
  });

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyToolsModal: React.FC<StudyToolsModalProps> = ({
  isOpen,
  onClose,
  summaryId,
  videoTitle,
  language = "fr",
  userPlan = "free",
  userCredits,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("select");
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy study materials shape
  const [studyCardData, setStudyCardData] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy study materials shape
  const [conceptMapData, setConceptMapData] = useState<any>(null);
  const [activeResultTab, setActiveResultTab] = useState<"card" | "map">(
    "card",
  );

  // Options configurables
  const [questionCount, setQuestionCount] = useState(5);
  const [depthLevel, setDepthLevel] = useState(3);
  const [withDetails, setWithDetails] = useState(false);

  // Coût et crédits (coût fixe connu : pas d'appel de prévisualisation)
  // Solde inconnu (prop absente) : on n'affiche rien et on laisse le
  // serveur trancher (402 affiché en erreur) plutôt que de bloquer à tort.
  const [credits, setCredits] = useState<number | undefined>(userCredits);
  useEffect(() => {
    if (userCredits !== undefined) setCredits(userCredits);
  }, [userCredits]);
  const toolCost = selectedTool ? TOOL_COSTS[selectedTool] : 0;
  const canAfford = credits === undefined || credits >= toolCost;

  const handleSelectTool = (tool: ToolType) => {
    setSelectedTool(tool);
    setViewMode("options");
  };

  const handleGenerate = async () => {
    if (!selectedTool) return;

    setViewMode("loading");
    setLoading(true);
    setError(null);

    try {
      if (selectedTool === "card") {
        const result = await generateStudyCard(summaryId, questionCount);
        setStudyCardData(result.study_card);
        if (result.credits_remaining !== undefined)
          setCredits(result.credits_remaining);
        setActiveResultTab("card");
      } else if (selectedTool === "mindmap") {
        const result = await generateConceptMap(
          summaryId,
          depthLevel,
          withDetails,
        );
        setConceptMapData(result.concept_map);
        if (result.credits_remaining !== undefined)
          setCredits(result.credits_remaining);
        setActiveResultTab("map");
      } else if (selectedTool === "all") {
        const result = await generateAllMaterials(
          summaryId,
          questionCount,
          depthLevel,
          withDetails,
        );
        const materials = result.materials || result;
        if (materials.study_card) {
          setStudyCardData(materials.study_card);
        }
        if (materials.concept_map) {
          setConceptMapData(materials.concept_map);
        }
        if (result.credits_remaining !== undefined)
          setCredits(result.credits_remaining);
        // Vérifier qu'au moins un résultat a été généré
        if (!materials.study_card && !materials.concept_map) {
          throw new Error(
            materials.study_card_error ||
              materials.concept_map_error ||
              "Aucun contenu n'a pu être généré. Veuillez réessayer.",
          );
        }
        setActiveResultTab(materials.study_card ? "card" : "map");
      }
      setViewMode("results");
    } catch (err: unknown) {
      console.error("Generation error:", err);
      setError(
        (err as { message?: string } | null)?.message ||
          "Erreur lors de la génération",
      );
      setViewMode("options");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setViewMode("select");
    setSelectedTool(null);
    setStudyCardData(null);
    setConceptMapData(null);
    setError(null);
  };

  const texts = {
    fr: {
      title: "Outils d'étude",
      subtitle: "Générez des supports pédagogiques pour cette vidéo",
      selectTool: "Choisissez un outil",
      studyCard: "Fiche de révision",
      studyCardDesc:
        "Points clés, définitions, quiz interactif et questions de compréhension",
      conceptMap: "Arbre pédagogique",
      conceptMapDesc:
        "Visualisation des concepts et de leurs relations en mindmap",
      allTools: "Pack complet",
      allToolsDesc: "Fiche de révision + Arbre pédagogique",
      generating: "Génération en cours...",
      generatingCard: "Création de la fiche de révision...",
      generatingMap: "Construction de l'arbre pédagogique...",
      generatingAll: "Génération des outils d'étude...",
      backToSelect: "Générer autre chose",
      backToOptions: "Modifier les options",
      error: "Erreur",
      results: "Résultats",
      tabCard: "Fiche de révision",
      tabMap: "Arbre pédagogique",
      configureOptions: "Configurez vos options",
      questionCount: "Nombre de questions QCM",
      depthLevel: "Profondeur du mindmap",
      withDetails: "Descriptions détaillées",
      credit: "crédit",
      credits: "crédits",
      estimatedCost: "Coût estimé",
      generate: "Générer",
      insufficientCredits: "Crédits insuffisants",
      upgradeRequired: "Passez à un plan supérieur pour plus d'options",
      yourCredits: "Vos crédits",
    },
    en: {
      title: "Study Tools",
      subtitle: "Generate educational materials for this video",
      selectTool: "Choose a tool",
      studyCard: "Study Card",
      studyCardDesc:
        "Key points, definitions, interactive quiz and comprehension questions",
      conceptMap: "Concept Map",
      conceptMapDesc:
        "Visualization of concepts and their relationships as a mindmap",
      allTools: "Complete Pack",
      allToolsDesc: "Study Card + Concept Map",
      generating: "Generating...",
      generatingCard: "Creating study card...",
      generatingMap: "Building concept map...",
      generatingAll: "Generating study tools...",
      backToSelect: "Generate something else",
      backToOptions: "Modify options",
      error: "Error",
      results: "Results",
      tabCard: "Study Card",
      tabMap: "Concept Map",
      configureOptions: "Configure your options",
      questionCount: "Number of quiz questions",
      depthLevel: "Mindmap depth",
      withDetails: "Detailed descriptions",
      credit: "credit",
      credits: "credits",
      estimatedCost: "Estimated cost",
      generate: "Generate",
      insufficientCredits: "Insufficient credits",
      upgradeRequired: "Upgrade your plan for more options",
      yourCredits: "Your credits",
    },
  };

  const t = texts[language];
  const formatCost = (cost: number) =>
    `${cost} ${cost > 1 ? t.credits : t.credit}`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-bg-primary border border-border-default rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{t.title}</h2>
                <p className="text-purple-100 text-sm">{t.subtitle}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Video info */}
          <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded-lg">
            <p className="text-sm font-medium line-clamp-1">{videoTitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  {t.error}
                </p>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Selection View */}
          {viewMode === "select" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">
                  {t.selectTool}
                </h3>
                {credits !== undefined && (
                  <span className="text-sm text-text-secondary">
                    {t.yourCredits}:{" "}
                    <strong className="text-accent-primary">{credits}</strong>
                  </span>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Study Card */}
                <button
                  onClick={() => handleSelectTool("card")}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">
                    {t.studyCard}
                  </h4>
                  <p className="text-sm text-text-secondary mb-3">
                    {t.studyCardDesc}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Zap className="w-3 h-3" />
                      {formatCost(TOOL_COSTS.card)}
                    </span>
                  </div>
                </button>

                {/* Concept Map */}
                <button
                  onClick={() => handleSelectTool("mindmap")}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GitBranch className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">
                    {t.conceptMap}
                  </h4>
                  <p className="text-sm text-text-secondary mb-3">
                    {t.conceptMapDesc}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Zap className="w-3 h-3" />
                      {formatCost(TOOL_COSTS.mindmap)}
                    </span>
                  </div>
                </button>

                {/* All Tools */}
                <button
                  onClick={() => handleSelectTool("all")}
                  className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 border border-purple-200 dark:border-purple-800 hover:border-purple-400 rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                    {t.allTools}
                  </h4>
                  <p className="text-sm text-text-secondary mb-3">
                    {t.allToolsDesc}
                  </p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Zap className="w-3 h-3" />
                    {formatCost(TOOL_COSTS.all)}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Options View */}
          {viewMode === "options" && selectedTool && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {t.configureOptions}
                </h3>
                <button
                  onClick={handleReset}
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  ← {t.backToSelect}
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Quiz Questions (pour card et all) */}
                {(selectedTool === "card" || selectedTool === "all") && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      <Brain className="w-4 h-4 inline mr-2" />
                      {t.questionCount}
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          setQuestionCount(Math.max(3, questionCount - 1))
                        }
                        disabled={questionCount <= 3}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-2xl font-bold text-accent-primary w-12 text-center">
                        {questionCount}
                      </span>
                      <button
                        onClick={() =>
                          setQuestionCount(
                            Math.min(MAX_QUIZ_QUESTIONS, questionCount + 1),
                          )
                        }
                        disabled={questionCount >= MAX_QUIZ_QUESTIONS}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {questionCount >= MAX_QUIZ_QUESTIONS && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Max pour votre plan ({userPlan})
                      </p>
                    )}
                  </div>
                )}

                {/* Mindmap Depth (pour mindmap et all) */}
                {(selectedTool === "mindmap" || selectedTool === "all") && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      <GitBranch className="w-4 h-4 inline mr-2" />
                      {t.depthLevel}
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() =>
                          setDepthLevel(Math.max(2, depthLevel - 1))
                        }
                        disabled={depthLevel <= 2}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-2xl font-bold text-green-600 w-12 text-center">
                        {depthLevel}
                      </span>
                      <button
                        onClick={() =>
                          setDepthLevel(
                            Math.min(MAX_MINDMAP_DEPTH, depthLevel + 1),
                          )
                        }
                        disabled={depthLevel >= MAX_MINDMAP_DEPTH}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {depthLevel >= MAX_MINDMAP_DEPTH && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Max pour votre plan ({userPlan})
                      </p>
                    )}
                  </div>
                )}

                {/* Detailed Concepts (pour mindmap et all) */}
                {(selectedTool === "mindmap" || selectedTool === "all") && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        {t.withDetails}
                      </span>
                      <button
                        onClick={() => setWithDetails(!withDetails)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          withDetails ? "bg-accent-primary" : "bg-bg-tertiary"
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            withDetails ? "left-7" : "left-1"
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                )}
              </div>

              {/* Cost Preview */}
              <div className="p-4 bg-gradient-to-r from-accent-primary/10 to-purple-500/10 rounded-xl border border-accent-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">
                      {t.estimatedCost}
                    </p>
                    <p className="text-3xl font-bold text-accent-primary">
                      {toolCost}{" "}
                      <span className="text-base font-normal">
                        {toolCost > 1 ? t.credits : t.credit}
                      </span>
                    </p>
                  </div>
                  {credits !== undefined && (
                    <div className="text-right">
                      <p className="text-sm text-text-secondary">
                        {t.yourCredits}
                      </p>
                      <p
                        className={`text-2xl font-bold ${canAfford ? "text-green-600" : "text-red-500"}`}
                      >
                        {credits}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canAfford || loading}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
                  canAfford
                    ? "bg-accent-primary hover:bg-accent-primary-hover text-white"
                    : "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed"
                }`}
              >
                {canAfford ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {t.generate} ({formatCost(toolCost)})
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5" />
                    {t.insufficientCredits}
                  </>
                )}
              </button>

              {!canAfford && (
                <p className="text-center text-sm text-amber-600 flex items-center justify-center gap-2">
                  <Crown className="w-4 h-4" />
                  {t.upgradeRequired}
                </p>
              )}
            </div>
          )}

          {/* Loading View */}
          {viewMode === "loading" && (
            <div className="py-16 text-center">
              <div className="flex justify-center mb-6">
                <DeepSightSpinner size="lg" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {t.generating}
              </h3>
              <p className="text-text-secondary">
                {selectedTool === "card" && t.generatingCard}
                {selectedTool === "mindmap" && t.generatingMap}
                {selectedTool === "all" && t.generatingAll}
              </p>

              <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full bg-accent-primary animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-3 h-3 rounded-full bg-purple-500 animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <div
                    className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results View */}
          {viewMode === "results" && (
            <div>
              {/* Header with credits */}
              {credits !== undefined && (
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-text-secondary">
                    {t.yourCredits}:{" "}
                    <strong className="text-accent-primary">{credits}</strong>
                  </span>
                </div>
              )}

              {/* Tabs if both are available */}
              {studyCardData && conceptMapData && (
                <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg mb-6">
                  <button
                    onClick={() => setActiveResultTab("card")}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                      activeResultTab === "card"
                        ? "bg-bg-primary text-text-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    {t.tabCard}
                    <span className="text-xs text-text-muted">
                      ({studyCardData?.quiz?.length || 0} Q)
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveResultTab("map")}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                      activeResultTab === "map"
                        ? "bg-bg-primary text-text-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                    {t.tabMap}
                  </button>
                </div>
              )}

              {/* Study Card Results */}
              {activeResultTab === "card" && studyCardData && (
                <StudyCard data={studyCardData} language={language} />
              )}

              {/* Concept Map Results */}
              {activeResultTab === "map" && conceptMapData && (
                <ConceptMap data={conceptMapData} language={language} />
              )}

              {/* Back button */}
              <div className="mt-6 pt-4 border-t border-border-subtle flex gap-3">
                <button onClick={handleReset} className="btn btn-secondary">
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  {t.backToSelect}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudyToolsModal;
