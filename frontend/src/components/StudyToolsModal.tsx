/**
 * DEEP SIGHT — Study Tools Modal v2.0
 * Modal combinant fiches de révision et arbres pédagogiques
 *
 * FONCTIONNALITÉS:
 * - 🎓 Génération de fiches de révision avec nombre de questions configurable
 * - 🌳 Génération d'arbres pédagogiques avec profondeur variable
 * - 💰 Affichage des coûts en crédits
 * - 🎯 Génération de questions supplémentaires
 * - 📊 Affichage des résultats
 * - 📥 Export des contenus
 */

import React, { useState, useEffect } from 'react';
import {
  X, GraduationCap, GitBranch, Sparkles,
  AlertCircle, BookOpen, Brain, Download, ChevronRight,
  Zap, Settings, Plus, Minus, Info, Lock, Crown
} from 'lucide-react';
import { DeepSightSpinner, DeepSightSpinnerMicro, DeepSightSpinnerSmall } from './ui';
import { StudyCard } from './StudyCard';
import { ConceptMap } from './ConceptMap';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface StudyToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryId: number;
  videoTitle: string;
  language?: 'fr' | 'en';
  userPlan?: string;
  userCredits?: number;
}

interface StudyLimits {
  quiz_questions: number;
  mindmap_depth: number;
  can_generate_more: boolean;
  daily_limit: number;
}

interface CostPreview {
  total: number;
  breakdown: Record<string, number>;
}

type ToolType = 'card' | 'mindmap' | 'all';
type ViewMode = 'select' | 'options' | 'loading' | 'results';

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 API
// ═══════════════════════════════════════════════════════════════════════════════

const API_URL = (import.meta.env.VITE_API_URL || 'https://deep-sight-backend-v3-production.up.railway.app').replace(/\/api\/?$/, '') + '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// Récupérer les limites du plan
const fetchStudyLimits = async (): Promise<{ limits: StudyLimits }> => {
  const response = await fetch(`${API_URL}/videos/study/limits`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Erreur lors de la récupération des limites');
  }
  return response.json();
};

// Prévisualiser le coût
const fetchCostPreview = async (
  tool: string,
  questionCount: number,
  depthLevel: number,
  withDetails: boolean
): Promise<{ cost: CostPreview; can_afford: boolean }> => {
  const params = new URLSearchParams({
    tool,
    question_count: questionCount.toString(),
    depth_level: depthLevel.toString(),
    with_detailed_concepts: withDetails.toString(),
  });
  const response = await fetch(`${API_URL}/videos/study/cost-preview?${params}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error('Erreur lors du calcul du coût');
  }
  return response.json();
};

const generateStudyCard = async (summaryId: number, questionCount: number) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/card`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ question_count: questionCount }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `Erreur ${response.status}`);
  }
  return response.json();
};

const generateConceptMap = async (summaryId: number, depthLevel: number, withDetails: boolean) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/mindmap`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ depth_level: depthLevel, with_detailed_concepts: withDetails }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `Erreur ${response.status}`);
  }
  return response.json();
};

const generateAllMaterials = async (
  summaryId: number,
  questionCount: number,
  depthLevel: number,
  withDetails: boolean
) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/all`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      question_count: questionCount,
      depth_level: depthLevel,
      with_detailed_concepts: withDetails,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `Erreur ${response.status}`);
  }
  return response.json();
};

const generateAdditionalQuestions = async (
  summaryId: number,
  existingQuestions: any[],
  count: number
) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/additional-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ existing_questions: existingQuestions, count }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(typeof error.detail === 'string' ? error.detail : error.detail?.message || `Erreur ${response.status}`);
  }
  return response.json();
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyToolsModal: React.FC<StudyToolsModalProps> = ({
  isOpen,
  onClose,
  summaryId,
  videoTitle,
  language = 'fr',
  userPlan = 'free',
  userCredits = 0
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyCardData, setStudyCardData] = useState<any>(null);
  const [conceptMapData, setConceptMapData] = useState<any>(null);
  const [activeResultTab, setActiveResultTab] = useState<'card' | 'map'>('card');

  // Options configurables
  const [questionCount, setQuestionCount] = useState(5);
  const [depthLevel, setDepthLevel] = useState(3);
  const [withDetails, setWithDetails] = useState(false);

  // Limites et coûts
  const [limits, setLimits] = useState<StudyLimits | null>(null);
  const [costPreview, setCostPreview] = useState<CostPreview | null>(null);
  const [canAfford, setCanAfford] = useState(true);
  const [credits, setCredits] = useState(userCredits);

  // Charger les limites au montage
  useEffect(() => {
    if (isOpen) {
      fetchStudyLimits()
        .then((data) => {
          setLimits(data.limits);
          // Ajuster les valeurs par défaut selon les limites
          setQuestionCount(Math.min(5, data.limits.quiz_questions));
          setDepthLevel(Math.min(3, data.limits.mindmap_depth));
        })
        .catch((err) => console.error('Error fetching limits:', err));
    }
  }, [isOpen]);

  // Mettre à jour le coût quand les options changent
  useEffect(() => {
    if (selectedTool && viewMode === 'options') {
      const toolParam = selectedTool === 'card' ? 'study_card' : selectedTool === 'mindmap' ? 'concept_map' : 'study_all';
      fetchCostPreview(toolParam, questionCount, depthLevel, withDetails)
        .then((data) => {
          setCostPreview(data.cost);
          setCanAfford(data.can_afford);
        })
        .catch((err) => console.error('Error fetching cost:', err));
    }
  }, [selectedTool, questionCount, depthLevel, withDetails, viewMode]);

  const handleSelectTool = (tool: ToolType) => {
    setSelectedTool(tool);
    setViewMode('options');
  };

  const handleGenerate = async () => {
    if (!selectedTool) return;

    setViewMode('loading');
    setLoading(true);
    setError(null);

    try {
      if (selectedTool === 'card') {
        const result = await generateStudyCard(summaryId, questionCount);
        setStudyCardData(result.study_card);
        setCredits(result.credits_remaining);
        setActiveResultTab('card');
      } else if (selectedTool === 'mindmap') {
        const result = await generateConceptMap(summaryId, depthLevel, withDetails);
        setConceptMapData(result.concept_map);
        setCredits(result.credits_remaining);
        setActiveResultTab('map');
      } else if (selectedTool === 'all') {
        const result = await generateAllMaterials(summaryId, questionCount, depthLevel, withDetails);
        if (result.materials.study_card) {
          setStudyCardData(result.materials.study_card);
        }
        if (result.materials.concept_map) {
          setConceptMapData(result.materials.concept_map);
        }
        setCredits(result.credits_remaining);
        setActiveResultTab('card');
      }
      setViewMode('results');
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Erreur lors de la génération');
      setViewMode('options');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMoreQuestions = async () => {
    if (!studyCardData?.quiz || !limits?.can_generate_more) return;

    setLoading(true);
    setError(null);

    try {
      const result = await generateAdditionalQuestions(summaryId, studyCardData.quiz, 5);
      // Ajouter les nouvelles questions au quiz existant
      setStudyCardData({
        ...studyCardData,
        quiz: [...studyCardData.quiz, ...result.new_questions],
      });
      setCredits(result.credits_remaining);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la génération');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setViewMode('select');
    setSelectedTool(null);
    setStudyCardData(null);
    setConceptMapData(null);
    setCostPreview(null);
    setError(null);
  };

  const handleBackToOptions = () => {
    setViewMode('options');
  };

  const texts = {
    fr: {
      title: 'Outils d\'étude',
      subtitle: 'Générez des supports pédagogiques pour cette vidéo',
      selectTool: 'Choisissez un outil',
      studyCard: 'Fiche de révision',
      studyCardDesc: 'Points clés, définitions, quiz interactif et questions de compréhension',
      conceptMap: 'Arbre pédagogique',
      conceptMapDesc: 'Visualisation des concepts et de leurs relations en mindmap',
      allTools: 'Pack complet',
      allToolsDesc: 'Fiche de révision + Arbre pédagogique (réduction 15%)',
      generating: 'Génération en cours...',
      generatingCard: 'Création de la fiche de révision...',
      generatingMap: 'Construction de l\'arbre pédagogique...',
      generatingAll: 'Génération des outils d\'étude...',
      backToSelect: 'Générer autre chose',
      backToOptions: 'Modifier les options',
      error: 'Erreur',
      results: 'Résultats',
      tabCard: 'Fiche de révision',
      tabMap: 'Arbre pédagogique',
      configureOptions: 'Configurez vos options',
      questionCount: 'Nombre de questions QCM',
      depthLevel: 'Profondeur du mindmap',
      withDetails: 'Descriptions détaillées',
      credits: 'crédits',
      estimatedCost: 'Coût estimé',
      generate: 'Générer',
      insufficientCredits: 'Crédits insuffisants',
      upgradeRequired: 'Passez à un plan supérieur pour plus d\'options',
      generateMore: 'Générer 5 questions de plus',
      moreQuestionsLocked: 'Disponible à partir du plan Starter',
      discount: 'réduction',
      yourCredits: 'Vos crédits',
    },
    en: {
      title: 'Study Tools',
      subtitle: 'Generate educational materials for this video',
      selectTool: 'Choose a tool',
      studyCard: 'Study Card',
      studyCardDesc: 'Key points, definitions, interactive quiz and comprehension questions',
      conceptMap: 'Concept Map',
      conceptMapDesc: 'Visualization of concepts and their relationships as a mindmap',
      allTools: 'Complete Pack',
      allToolsDesc: 'Study Card + Concept Map (15% discount)',
      generating: 'Generating...',
      generatingCard: 'Creating study card...',
      generatingMap: 'Building concept map...',
      generatingAll: 'Generating study tools...',
      backToSelect: 'Generate something else',
      backToOptions: 'Modify options',
      error: 'Error',
      results: 'Results',
      tabCard: 'Study Card',
      tabMap: 'Concept Map',
      configureOptions: 'Configure your options',
      questionCount: 'Number of quiz questions',
      depthLevel: 'Mindmap depth',
      withDetails: 'Detailed descriptions',
      credits: 'credits',
      estimatedCost: 'Estimated cost',
      generate: 'Generate',
      insufficientCredits: 'Insufficient credits',
      upgradeRequired: 'Upgrade your plan for more options',
      generateMore: 'Generate 5 more questions',
      moreQuestionsLocked: 'Available from Starter plan',
      discount: 'discount',
      yourCredits: 'Your credits',
    }
  };

  const t = texts[language];

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
                <h2 className="text-xl font-display font-semibold">{t.title}</h2>
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
                <p className="font-medium text-red-700 dark:text-red-400">{t.error}</p>
                <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* Selection View */}
          {viewMode === 'select' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-text-primary">{t.selectTool}</h3>
                <span className="text-sm text-text-secondary">
                  {t.yourCredits}: <strong className="text-accent-primary">{credits}</strong>
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {/* Study Card */}
                <button
                  onClick={() => handleSelectTool('card')}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">{t.studyCard}</h4>
                  <p className="text-sm text-text-secondary mb-3">{t.studyCardDesc}</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      <Zap className="w-3 h-3" />
                      20+ {t.credits}
                    </span>
                    <span className="text-xs text-text-muted">
                      max {limits?.quiz_questions || 5} questions
                    </span>
                  </div>
                </button>

                {/* Concept Map */}
                <button
                  onClick={() => handleSelectTool('mindmap')}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GitBranch className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">{t.conceptMap}</h4>
                  <p className="text-sm text-text-secondary mb-3">{t.conceptMapDesc}</p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Zap className="w-3 h-3" />
                      25+ {t.credits}
                    </span>
                    <span className="text-xs text-text-muted">
                      max {limits?.mindmap_depth || 3} niveaux
                    </span>
                  </div>
                </button>

                {/* All Tools */}
                <button
                  onClick={() => handleSelectTool('all')}
                  className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 border border-purple-200 dark:border-purple-800 hover:border-purple-400 rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                    {t.allTools}
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded">-15%</span>
                  </h4>
                  <p className="text-sm text-text-secondary mb-3">{t.allToolsDesc}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Zap className="w-3 h-3" />
                    38+ {t.credits}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Options View */}
          {viewMode === 'options' && selectedTool && (
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
                {(selectedTool === 'card' || selectedTool === 'all') && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      <Brain className="w-4 h-4 inline mr-2" />
                      {t.questionCount}
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQuestionCount(Math.max(3, questionCount - 1))}
                        disabled={questionCount <= 3}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-2xl font-bold text-accent-primary w-12 text-center">
                        {questionCount}
                      </span>
                      <button
                        onClick={() => setQuestionCount(Math.min(limits?.quiz_questions || 15, questionCount + 1))}
                        disabled={questionCount >= (limits?.quiz_questions || 15)}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {questionCount >= (limits?.quiz_questions || 15) && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Max pour votre plan ({userPlan})
                      </p>
                    )}
                  </div>
                )}

                {/* Mindmap Depth (pour mindmap et all) */}
                {(selectedTool === 'mindmap' || selectedTool === 'all') && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="block text-sm font-medium text-text-primary mb-3">
                      <GitBranch className="w-4 h-4 inline mr-2" />
                      {t.depthLevel}
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setDepthLevel(Math.max(2, depthLevel - 1))}
                        disabled={depthLevel <= 2}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-2xl font-bold text-green-600 w-12 text-center">
                        {depthLevel}
                      </span>
                      <button
                        onClick={() => setDepthLevel(Math.min(limits?.mindmap_depth || 5, depthLevel + 1))}
                        disabled={depthLevel >= (limits?.mindmap_depth || 5)}
                        className="p-2 rounded-lg bg-bg-tertiary hover:bg-bg-hover disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    {depthLevel >= (limits?.mindmap_depth || 5) && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Max pour votre plan ({userPlan})
                      </p>
                    )}
                  </div>
                )}

                {/* Detailed Concepts (pour mindmap et all) */}
                {(selectedTool === 'mindmap' || selectedTool === 'all') && (
                  <div className="p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        {t.withDetails}
                      </span>
                      <button
                        onClick={() => setWithDetails(!withDetails)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          withDetails ? 'bg-accent-primary' : 'bg-bg-tertiary'
                        }`}
                      >
                        <span
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            withDetails ? 'left-7' : 'left-1'
                          }`}
                        />
                      </button>
                    </label>
                    <p className="text-xs text-text-muted mt-2">
                      +15 crédits pour des descriptions détaillées
                    </p>
                  </div>
                )}
              </div>

              {/* Cost Preview */}
              <div className="p-4 bg-gradient-to-r from-accent-primary/10 to-purple-500/10 rounded-xl border border-accent-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-secondary">{t.estimatedCost}</p>
                    <p className="text-3xl font-bold text-accent-primary">
                      {costPreview?.total || '...'} <span className="text-base font-normal">{t.credits}</span>
                    </p>
                    {selectedTool === 'all' && costPreview?.breakdown?.discount && (
                      <p className="text-xs text-green-600">
                        -{costPreview.breakdown.discount} crédits (15% {t.discount})
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text-secondary">{t.yourCredits}</p>
                    <p className={`text-2xl font-bold ${canAfford ? 'text-green-600' : 'text-red-500'}`}>
                      {credits}
                    </p>
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canAfford || loading}
                className={`w-full py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${
                  canAfford
                    ? 'bg-accent-primary hover:bg-accent-primary-hover text-white'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                {canAfford ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    {t.generate} ({costPreview?.total || '...'} {t.credits})
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
          {viewMode === 'loading' && (
            <div className="py-16 text-center">
              <div className="flex justify-center mb-6">
                <DeepSightSpinner size="lg" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">{t.generating}</h3>
              <p className="text-text-secondary">
                {selectedTool === 'card' && t.generatingCard}
                {selectedTool === 'mindmap' && t.generatingMap}
                {selectedTool === 'all' && t.generatingAll}
              </p>
              
              <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-3 h-3 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          {/* Results View */}
          {viewMode === 'results' && (
            <div>
              {/* Header with credits */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-text-secondary">
                  {t.yourCredits}: <strong className="text-accent-primary">{credits}</strong>
                </span>
              </div>

              {/* Tabs if both are available */}
              {studyCardData && conceptMapData && (
                <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg mb-6">
                  <button
                    onClick={() => setActiveResultTab('card')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                      activeResultTab === 'card'
                        ? 'bg-bg-primary text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    {t.tabCard}
                    <span className="text-xs text-text-muted">({studyCardData?.quiz?.length || 0} Q)</span>
                  </button>
                  <button
                    onClick={() => setActiveResultTab('map')}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                      activeResultTab === 'map'
                        ? 'bg-bg-primary text-text-primary shadow-sm'
                        : 'text-text-tertiary hover:text-text-primary'
                    }`}
                  >
                    <GitBranch className="w-4 h-4" />
                    {t.tabMap}
                  </button>
                </div>
              )}

              {/* Study Card Results */}
              {activeResultTab === 'card' && studyCardData && (
                <>
                  <StudyCard
                    data={studyCardData}
                    language={language}
                    onGenerateMore={handleGenerateMoreQuestions}
                    canGenerateMore={limits?.can_generate_more ?? false}
                    isGenerating={loading}
                  />

                  {/* Generate More Questions Button */}
                  {limits?.can_generate_more ? (
                    <div className="mt-4 p-4 bg-bg-secondary rounded-xl border border-border-subtle">
                      <button
                        onClick={handleGenerateMoreQuestions}
                        disabled={loading || credits < 30}
                        className="w-full py-3 rounded-lg bg-accent-primary hover:bg-accent-primary-hover text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <DeepSightSpinnerMicro />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        {t.generateMore}
                        <span className="text-xs opacity-75">(30 {t.credits})</span>
                      </button>
                      <p className="text-xs text-text-muted text-center mt-2">
                        Total actuel: {studyCardData?.quiz?.length || 0} questions
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {t.moreQuestionsLocked}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Concept Map Results */}
              {activeResultTab === 'map' && conceptMapData && (
                <ConceptMap data={conceptMapData} language={language} />
              )}

              {/* Back button */}
              <div className="mt-6 pt-4 border-t border-border-subtle flex gap-3">
                <button
                  onClick={handleReset}
                  className="btn btn-secondary"
                >
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
