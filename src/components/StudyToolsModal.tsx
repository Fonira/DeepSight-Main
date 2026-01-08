/**
 * DEEP SIGHT — Study Tools Modal
 * Modal combinant fiches de révision et arbres pédagogiques
 * 
 * FONCTIONNALITÉS:
 * - 🎓 Génération de fiches de révision
 * - 🌳 Génération d'arbres pédagogiques
 * - 📊 Affichage des résultats
 * - 📥 Export des contenus
 */

import React, { useState } from 'react';
import {
  X, Loader2, GraduationCap, GitBranch, Sparkles,
  AlertCircle, BookOpen, Brain, Download, ChevronRight,
  Zap
} from 'lucide-react';
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
}

type ToolType = 'card' | 'mindmap' | 'all';
type ViewMode = 'select' | 'loading' | 'results';

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

const generateStudyCard = async (summaryId: number) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/card`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(error.detail || `Erreur ${response.status}`);
  }
  return response.json();
};

const generateConceptMap = async (summaryId: number) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/mindmap`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(error.detail || `Erreur ${response.status}`);
  }
  return response.json();
};

const generateAllMaterials = async (summaryId: number) => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/all`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
    throw new Error(error.detail || `Erreur ${response.status}`);
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
  language = 'fr'
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studyCardData, setStudyCardData] = useState<any>(null);
  const [conceptMapData, setConceptMapData] = useState<any>(null);
  const [activeResultTab, setActiveResultTab] = useState<'card' | 'map'>('card');

  const handleGenerate = async (tool: ToolType) => {
    setSelectedTool(tool);
    setViewMode('loading');
    setLoading(true);
    setError(null);

    try {
      if (tool === 'card') {
        const result = await generateStudyCard(summaryId);
        setStudyCardData(result.study_card);
        setActiveResultTab('card');
      } else if (tool === 'mindmap') {
        const result = await generateConceptMap(summaryId);
        setConceptMapData(result.concept_map);
        setActiveResultTab('map');
      } else if (tool === 'all') {
        const result = await generateAllMaterials(summaryId);
        if (result.materials.study_card) {
          setStudyCardData(result.materials.study_card);
        }
        if (result.materials.concept_map) {
          setConceptMapData(result.materials.concept_map);
        }
        setActiveResultTab('card');
      }
      setViewMode('results');
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Erreur lors de la génération');
      setViewMode('select');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setViewMode('select');
    setSelectedTool(null);
    setStudyCardData(null);
    setConceptMapData(null);
    setError(null);
  };

  const texts = {
    fr: {
      title: 'Outils d\'étude',
      subtitle: 'Générez des supports pédagogiques pour cette vidéo',
      selectTool: 'Choisissez un outil',
      studyCard: 'Fiche de révision',
      studyCardDesc: 'Points clés, définitions, quiz interactif et questions de compréhension',
      studyCardCost: '1 crédit',
      conceptMap: 'Arbre pédagogique',
      conceptMapDesc: 'Visualisation des concepts et de leurs relations en mindmap',
      conceptMapCost: '1 crédit',
      allTools: 'Pack complet',
      allToolsDesc: 'Fiche de révision + Arbre pédagogique en une génération',
      allToolsCost: '2 crédits',
      generating: 'Génération en cours...',
      generatingCard: 'Création de la fiche de révision...',
      generatingMap: 'Construction de l\'arbre pédagogique...',
      generatingAll: 'Génération des outils d\'étude...',
      backToSelect: 'Générer autre chose',
      error: 'Erreur',
      results: 'Résultats',
      tabCard: 'Fiche de révision',
      tabMap: 'Arbre pédagogique',
    },
    en: {
      title: 'Study Tools',
      subtitle: 'Generate educational materials for this video',
      selectTool: 'Choose a tool',
      studyCard: 'Study Card',
      studyCardDesc: 'Key points, definitions, interactive quiz and comprehension questions',
      studyCardCost: '1 credit',
      conceptMap: 'Concept Map',
      conceptMapDesc: 'Visualization of concepts and their relationships as a mindmap',
      conceptMapCost: '1 credit',
      allTools: 'Complete Pack',
      allToolsDesc: 'Study Card + Concept Map in one generation',
      allToolsCost: '2 credits',
      generating: 'Generating...',
      generatingCard: 'Creating study card...',
      generatingMap: 'Building concept map...',
      generatingAll: 'Generating study tools...',
      backToSelect: 'Generate something else',
      error: 'Error',
      results: 'Results',
      tabCard: 'Study Card',
      tabMap: 'Concept Map',
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
              <h3 className="text-lg font-semibold text-text-primary mb-4">{t.selectTool}</h3>
              
              <div className="grid gap-4 md:grid-cols-3">
                {/* Study Card */}
                <button
                  onClick={() => handleGenerate('card')}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">{t.studyCard}</h4>
                  <p className="text-sm text-text-secondary mb-3">{t.studyCardDesc}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Zap className="w-3 h-3" />
                    {t.studyCardCost}
                  </span>
                </button>

                {/* Concept Map */}
                <button
                  onClick={() => handleGenerate('mindmap')}
                  className="p-5 bg-bg-secondary hover:bg-bg-hover border border-border-subtle hover:border-accent-primary rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <GitBranch className="w-6 h-6 text-green-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1">{t.conceptMap}</h4>
                  <p className="text-sm text-text-secondary mb-3">{t.conceptMapDesc}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <Zap className="w-3 h-3" />
                    {t.conceptMapCost}
                  </span>
                </button>

                {/* All Tools */}
                <button
                  onClick={() => handleGenerate('all')}
                  className="p-5 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 border border-purple-200 dark:border-purple-800 hover:border-purple-400 rounded-xl text-left transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <h4 className="font-semibold text-text-primary mb-1 flex items-center gap-2">
                    {t.allTools}
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-600 text-white rounded">BEST</span>
                  </h4>
                  <p className="text-sm text-text-secondary mb-3">{t.allToolsDesc}</p>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <Zap className="w-3 h-3" />
                    {t.allToolsCost}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Loading View */}
          {viewMode === 'loading' && (
            <div className="py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-accent-primary-muted flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-accent-primary animate-spin" />
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
                <StudyCard data={studyCardData} language={language} />
              )}

              {/* Concept Map Results */}
              {activeResultTab === 'map' && conceptMapData && (
                <ConceptMap data={conceptMapData} language={language} />
              )}

              {/* Back button */}
              <div className="mt-6 pt-4 border-t border-border-subtle">
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
