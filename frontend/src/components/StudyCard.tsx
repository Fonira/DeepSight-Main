/**
 * DEEP SIGHT — Study Card Component
 * Affichage des fiches de révision générées par l'IA
 *
 * FONCTIONNALITÉS:
 * - 📋 Points clés avec niveaux d'importance
 * - 📖 Définitions interactives
 * - ❓ Questions/Réponses avec reveal
 * - 🎯 Quiz QCM interactif
 * - 📥 Export PDF/Markdown
 */

import React, { useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Lightbulb,
  HelpCircle,
  CheckCircle,
  XCircle,
  Download,
  Printer,
  Star,
  Clock,
  Brain,
  Target,
  Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface KeyPoint {
  point: string;
  explanation: string;
  importance:
    | "essentiel"
    | "important"
    | "complementaire"
    | "essential"
    | "complementary";
}

interface Definition {
  term: string;
  definition: string;
  example?: string;
}

interface QuestionAnswer {
  question: string;
  answer: string;
  type:
    | "comprehension"
    | "application"
    | "analyse"
    | "synthese"
    | "analysis"
    | "synthesis";
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface StudyCardData {
  title: string;
  difficulty:
    | "debutant"
    | "intermediaire"
    | "avance"
    | "beginner"
    | "intermediate"
    | "advanced";
  duration_to_study: string;
  key_points: KeyPoint[];
  definitions: Definition[];
  questions_answers: QuestionAnswer[];
  quiz: QuizQuestion[];
  summary_sentence: string;
  related_topics: string[];
  study_tips: string[];
  generated_at?: string;
  source_video?: string;
  source_channel?: string;
}

interface StudyCardProps {
  data: StudyCardData;
  language?: "fr" | "en";
  onExport?: (format: "pdf" | "md") => void;
  onGenerateMore?: () => void;
  canGenerateMore?: boolean;
  isGenerating?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getDifficultyConfig = (difficulty: string) => {
  const configs: Record<
    string,
    { label: string; color: string; icon: React.ReactNode }
  > = {
    debutant: {
      label: "Débutant",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      icon: <Star className="w-3 h-3" />,
    },
    beginner: {
      label: "Beginner",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      icon: <Star className="w-3 h-3" />,
    },
    intermediaire: {
      label: "Intermédiaire",
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      icon: (
        <>
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
        </>
      ),
    },
    intermediate: {
      label: "Intermediate",
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      icon: (
        <>
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
        </>
      ),
    },
    avance: {
      label: "Avancé",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: (
        <>
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
        </>
      ),
    },
    advanced: {
      label: "Advanced",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      icon: (
        <>
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
          <Star className="w-3 h-3" />
        </>
      ),
    },
  };
  return configs[difficulty] || configs.intermediaire;
};

const getImportanceConfig = (importance: string) => {
  const configs: Record<string, { label: string; color: string }> = {
    essentiel: {
      label: "⭐ Essentiel",
      color: "border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20",
    },
    essential: {
      label: "⭐ Essential",
      color: "border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20",
    },
    important: {
      label: "📌 Important",
      color: "border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20",
    },
    complementaire: {
      label: "💡 Complémentaire",
      color: "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20",
    },
    complementary: {
      label: "💡 Complementary",
      color: "border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20",
    },
  };
  return configs[importance] || configs.important;
};

const getQuestionTypeLabel = (type: string, lang: string) => {
  const labels: Record<string, Record<string, string>> = {
    comprehension: { fr: "🔍 Compréhension", en: "🔍 Comprehension" },
    application: { fr: "🛠️ Application", en: "🛠️ Application" },
    analyse: { fr: "🔬 Analyse", en: "🔬 Analysis" },
    analysis: { fr: "🔬 Analyse", en: "🔬 Analysis" },
    synthese: { fr: "🎯 Synthèse", en: "🎯 Synthesis" },
    synthesis: { fr: "🎯 Synthèse", en: "🎯 Synthesis" },
  };
  return labels[type]?.[lang] || type;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyCard: React.FC<StudyCardProps> = ({
  data,
  language = "fr",
  onExport,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["key_points", "quiz"]),
  );
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(
    new Set(),
  );
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // ── Données défensives (évite les crashes si le backend retourne un format partiel) ──
  const safeData = {
    title: data?.title || "Fiche de révision",
    difficulty: data?.difficulty || "intermediaire",
    duration_to_study: data?.duration_to_study || "",
    key_points: Array.isArray(data?.key_points) ? data.key_points : [],
    definitions: Array.isArray(data?.definitions) ? data.definitions : [],
    questions_answers: Array.isArray(data?.questions_answers)
      ? data.questions_answers
      : [],
    quiz: Array.isArray(data?.quiz) ? data.quiz : [],
    summary_sentence: data?.summary_sentence || "",
    related_topics: Array.isArray(data?.related_topics)
      ? data.related_topics
      : [],
    study_tips: Array.isArray(data?.study_tips) ? data.study_tips : [],
    generated_at: data?.generated_at,
    source_video: data?.source_video,
    source_channel: data?.source_channel,
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const toggleAnswer = (index: number) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleQuizAnswer = (questionIndex: number, optionIndex: number) => {
    if (quizSubmitted) return;
    setQuizAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const submitQuiz = () => {
    setQuizSubmitted(true);
  };

  const resetQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted(false);
  };

  const calculateScore = () => {
    let correct = 0;
    safeData.quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correct_index) correct++;
    });
    return { correct, total: safeData.quiz.length };
  };

  const difficultyConfig = getDifficultyConfig(safeData.difficulty);

  const texts = {
    fr: {
      keyPoints: "Points clés à retenir",
      definitions: "Vocabulaire & Définitions",
      questionsAnswers: "Questions de compréhension",
      quiz: "Quiz d'auto-évaluation",
      showAnswer: "Voir la réponse",
      hideAnswer: "Masquer",
      submitQuiz: "Valider mes réponses",
      resetQuiz: "Recommencer",
      score: "Score",
      studyTips: "Conseils d'apprentissage",
      relatedTopics: "Sujets connexes",
      summary: "En une phrase",
      duration: "Temps d'étude estimé",
      exportPdf: "Exporter PDF",
      exportMd: "Markdown",
    },
    en: {
      keyPoints: "Key points to remember",
      definitions: "Vocabulary & Definitions",
      questionsAnswers: "Comprehension questions",
      quiz: "Self-assessment quiz",
      showAnswer: "Show answer",
      hideAnswer: "Hide",
      submitQuiz: "Submit answers",
      resetQuiz: "Try again",
      score: "Score",
      studyTips: "Study tips",
      relatedTopics: "Related topics",
      summary: "In one sentence",
      duration: "Estimated study time",
      exportPdf: "Export PDF",
      exportMd: "Markdown",
    },
  };

  const t = texts[language];

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${difficultyConfig.color}`}
          >
            {difficultyConfig.icon}
            {difficultyConfig.label}
          </span>
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-bg-secondary text-text-secondary">
            <Clock className="w-3 h-3" />
            {safeData.duration_to_study}
          </span>
        </div>
        {onExport && (
          <div className="flex gap-2">
            <button
              onClick={() => onExport("pdf")}
              className="btn btn-ghost btn-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              {t.exportPdf}
            </button>
            <button
              onClick={() => onExport("md")}
              className="btn btn-ghost btn-sm"
            >
              <Download className="w-3.5 h-3.5" />
              {t.exportMd}
            </button>
          </div>
        )}
      </div>

      {/* Summary sentence */}
      <div className="p-4 bg-gradient-to-r from-accent-primary/10 to-purple-500/10 rounded-xl border border-accent-primary/20">
        <p className="text-sm font-medium text-text-primary flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-accent-primary flex-shrink-0 mt-0.5" />
          <span>
            <strong>{t.summary}:</strong> {safeData.summary_sentence}
          </span>
        </p>
      </div>

      {/* Key Points */}
      <Section
        title={t.keyPoints}
        icon={<Target className="w-5 h-5" />}
        count={safeData.key_points.length}
        expanded={expandedSections.has("key_points")}
        onToggle={() => toggleSection("key_points")}
      >
        <div className="space-y-3">
          {safeData.key_points.map((point, index) => {
            const importanceConfig = getImportanceConfig(point.importance);
            return (
              <div
                key={index}
                className={`p-3 rounded-lg ${importanceConfig.color}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-text-primary">
                      {point.point}
                    </p>
                    <p className="text-sm text-text-secondary mt-1">
                      {point.explanation}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted whitespace-nowrap">
                    {importanceConfig.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Definitions */}
      <Section
        title={t.definitions}
        icon={<BookOpen className="w-5 h-5" />}
        count={safeData.definitions.length}
        expanded={expandedSections.has("definitions")}
        onToggle={() => toggleSection("definitions")}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {safeData.definitions.map((def, index) => (
            <div key={index} className="p-3 bg-bg-secondary rounded-lg">
              <p className="font-semibold text-accent-primary text-sm">
                {def.term}
              </p>
              <p className="text-sm text-text-secondary mt-1">
                {def.definition}
              </p>
              {def.example && (
                <p className="text-xs text-text-muted mt-2 italic">
                  💡 Ex: {def.example}
                </p>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Questions & Answers */}
      <Section
        title={t.questionsAnswers}
        icon={<HelpCircle className="w-5 h-5" />}
        count={safeData.questions_answers.length}
        expanded={expandedSections.has("qa")}
        onToggle={() => toggleSection("qa")}
      >
        <div className="space-y-3">
          {safeData.questions_answers.map((qa, index) => (
            <div key={index} className="p-3 bg-bg-secondary rounded-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-text-primary text-sm">
                  {qa.question}
                </p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
                  {getQuestionTypeLabel(qa.type, language)}
                </span>
              </div>

              <button
                onClick={() => toggleAnswer(index)}
                className="mt-2 text-xs text-accent-primary hover:underline flex items-center gap-1"
              >
                {revealedAnswers.has(index) ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    {t.hideAnswer}
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3 h-3" />
                    {t.showAnswer}
                  </>
                )}
              </button>

              {revealedAnswers.has(index) && (
                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border-l-2 border-green-500 animate-fade-in">
                  <p className="text-sm text-text-secondary">{qa.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Quiz */}
      <Section
        title={t.quiz}
        icon={<Brain className="w-5 h-5" />}
        count={safeData.quiz.length}
        expanded={expandedSections.has("quiz")}
        onToggle={() => toggleSection("quiz")}
        badge={
          quizSubmitted
            ? `${t.score}: ${calculateScore().correct}/${calculateScore().total}`
            : undefined
        }
      >
        <div className="space-y-4">
          {safeData.quiz.map((question, qIndex) => (
            <div key={qIndex} className="p-4 bg-bg-secondary rounded-xl">
              <p className="font-medium text-text-primary mb-3">
                {qIndex + 1}. {question.question}
              </p>
              <div className="space-y-2">
                {question.options.map((option, oIndex) => {
                  const isSelected = quizAnswers[qIndex] === oIndex;
                  const isCorrect = question.correct_index === oIndex;
                  const showResult = quizSubmitted;

                  let optionClass =
                    "bg-bg-primary hover:bg-bg-hover border-border-subtle";
                  if (showResult) {
                    if (isCorrect) {
                      optionClass =
                        "bg-green-100 dark:bg-green-900/30 border-green-500";
                    } else if (isSelected && !isCorrect) {
                      optionClass =
                        "bg-red-100 dark:bg-red-900/30 border-red-500";
                    }
                  } else if (isSelected) {
                    optionClass =
                      "bg-accent-primary-muted border-accent-primary";
                  }

                  return (
                    <button
                      key={oIndex}
                      onClick={() => handleQuizAnswer(qIndex, oIndex)}
                      disabled={quizSubmitted}
                      className={`w-full p-3 text-left text-sm rounded-lg border transition-all flex items-center gap-2 ${optionClass}`}
                    >
                      <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium">
                        {String.fromCharCode(65 + oIndex)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {showResult && isCorrect && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {showResult && isSelected && !isCorrect && (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                    </button>
                  );
                })}
              </div>

              {quizSubmitted && (
                <div
                  className={`mt-3 p-2 rounded text-sm ${
                    quizAnswers[qIndex] === question.correct_index
                      ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                      : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  💡 {question.explanation}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3 justify-center pt-2">
            {!quizSubmitted ? (
              <button
                onClick={submitQuiz}
                disabled={
                  Object.keys(quizAnswers).length !== safeData.quiz.length
                }
                className="btn btn-primary"
              >
                <Check className="w-4 h-4" />
                {t.submitQuiz}
              </button>
            ) : (
              <button onClick={resetQuiz} className="btn btn-secondary">
                <X className="w-4 h-4" />
                {t.resetQuiz}
              </button>
            )}
          </div>
        </div>
      </Section>

      {/* Study Tips */}
      {safeData.study_tips.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
          <h4 className="font-medium text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            {t.studyTips}
          </h4>
          <ul className="space-y-1">
            {safeData.study_tips.map((tip, index) => (
              <li
                key={index}
                className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2"
              >
                <span>•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Topics */}
      {safeData.related_topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-text-muted">{t.relatedTopics}:</span>
          {safeData.related_topics.map((topic, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs rounded-full bg-bg-secondary text-text-secondary"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, icon, count, expanded, onToggle, badge, children }) => (
  <div className="border border-border-subtle rounded-xl overflow-hidden">
    <button
      onClick={onToggle}
      className="w-full p-4 flex items-center justify-between bg-bg-secondary hover:bg-bg-hover transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-accent-primary">{icon}</span>
        <span className="font-medium text-text-primary">{title}</span>
        <span className="px-2 py-0.5 text-xs rounded-full bg-bg-tertiary text-text-muted">
          {count}
        </span>
        {badge && (
          <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {badge}
          </span>
        )}
      </div>
      <ChevronDown
        className={`w-5 h-5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
      />
    </button>
    {expanded && (
      <div className="p-4 border-t border-border-subtle animate-fade-in">
        {children}
      </div>
    )}
  </div>
);

export default StudyCard;
