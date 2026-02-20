/**
 * DEEP SIGHT — Study Page
 * Page d'étude avec Flashcards et Quiz
 * 
 * FONCTIONNALITÉS:
 * - 📚 Tabs: Flashcards | Quiz
 * - 📊 Progression en temps réel
 * - 🏆 Score final
 * - 🔙 Navigation vers l'analyse
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import {
  BookOpen, Brain, ChevronLeft, Loader2, AlertCircle,
  BookMarked, HelpCircle
} from 'lucide-react';
import { FlashcardDeck, QuizQuestion, StudyProgress, ScoreCard } from '../components/Study';
import type { Flashcard, FlashcardStats, QuizQuestionData } from '../components/Study';
import { useTranslation } from '../hooks/useTranslation';
import { studyApi, videoApi } from '../services/api';
import DoodleBackground from '../components/DoodleBackground';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type TabType = 'flashcards' | 'quiz';

interface StudyData {
  flashcards: Flashcard[];
  quiz: QuizQuestionData[];
  videoTitle: string;
  videoId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 API (using studyApi service)
// ═══════════════════════════════════════════════════════════════════════════════

const fetchStudyData = async (summaryId: string, generateFlashcards: boolean, generateQuiz: boolean): Promise<StudyData> => {
  // First get the summary info for the title
  const summary = await videoApi.getSummary(parseInt(summaryId));
  
  let flashcards: Flashcard[] = [];
  let quiz: QuizQuestionData[] = [];

  // Generate flashcards if requested (costs 1 credit)
  if (generateFlashcards) {
    try {
      const flashcardsResponse = await studyApi.generateFlashcards(parseInt(summaryId));
      flashcards = (flashcardsResponse.flashcards || []).map((item) => ({
        front: item.front,
        back: item.back,
      }));
    } catch (err) {
      console.error('Error generating flashcards:', err);
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
        explanation: q.explanation || '',
      }));
    } catch (err) {
      console.error('Error generating quiz:', err);
    }
  }
  
  return {
    flashcards,
    quiz,
    videoTitle: summary.video_title || 'Untitled',
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
  const summaryId = paramSummaryId || searchParams.get('id');
  const initialTab = (searchParams.get('tab') as TabType) || 'flashcards';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [studyData, setStudyData] = useState<StudyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Progress tracking
  const [flashcardProgress, setFlashcardProgress] = useState({ current: 0, total: 0 });
  const [flashcardStats, setFlashcardStats] = useState<FlashcardStats | null>(null);
  const [quizProgress, setQuizProgress] = useState({ current: 0, total: 0, score: 0 });
  const [showResults, setShowResults] = useState(false);
  const [finalScore, setFinalScore] = useState({ correct: 0, incorrect: 0 });

  const texts = {
    fr: {
      title: 'Mode Étude',
      flashcards: 'Flashcards',
      quiz: 'Quiz',
      backToAnalysis: 'Retour à l\'analyse',
      loading: 'Chargement des données...',
      error: 'Impossible de charger les données',
      noData: 'Aucune donnée disponible',
      retry: 'Réessayer',
      noId: 'ID de résumé manquant',
    },
    en: {
      title: 'Study Mode',
      flashcards: 'Flashcards',
      quiz: 'Quiz',
      backToAnalysis: 'Back to analysis',
      loading: 'Loading data...',
      error: 'Failed to load data',
      noData: 'No data available',
      retry: 'Retry',
      noId: 'Missing summary ID',
    },
  }[language];

  // State for tracking if content has been generated
  const [hasGeneratedFlashcards, setHasGeneratedFlashcards] = useState(false);
  const [hasGeneratedQuiz, setHasGeneratedQuiz] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch study data based on selected tab
  useEffect(() => {
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
        const generateFlash = activeTab === 'flashcards' && !hasGeneratedFlashcards;
        const generateQ = activeTab === 'quiz' && !hasGeneratedQuiz;
        
        const data = await fetchStudyData(summaryId, generateFlash, generateQ);
        
        // Merge with existing data
        setStudyData(prev => ({
          flashcards: generateFlash ? data.flashcards : (prev?.flashcards || []),
          quiz: generateQ ? data.quiz : (prev?.quiz || []),
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
        console.error('Error loading study data:', err);
        if (err.status === 402) {
          setError(language === 'fr' ? 'Crédits insuffisants' : 'Insufficient credits');
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
      (activeTab === 'flashcards' && !hasGeneratedFlashcards) ||
      (activeTab === 'quiz' && !hasGeneratedQuiz);
    
    if (needsGeneration || !studyData) {
      loadData();
    }
  }, [summaryId, activeTab, hasGeneratedFlashcards, hasGeneratedQuiz]);

  // Handlers
  const handleFlashcardProgress = useCallback((current: number, total: number, stats: FlashcardStats) => {
    setFlashcardProgress({ current, total });
    setFlashcardStats(stats);
  }, []);

  const handleFlashcardComplete = useCallback((stats: FlashcardStats) => {
    setFlashcardStats(stats);
    setFinalScore({ correct: stats.known, incorrect: stats.unknown });
    setShowResults(true);
  }, []);

  const handleQuizProgress = useCallback((current: number, total: number, score: number) => {
    setQuizProgress({ current, total, score });
  }, []);

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

  // Loading state
  if (isLoading && !studyData) {
    const loadingMessage = isGenerating 
      ? (activeTab === 'flashcards' 
        ? (language === 'fr' ? 'Génération des flashcards...' : 'Generating flashcards...')
        : (language === 'fr' ? 'Génération du quiz...' : 'Generating quiz...'))
      : texts.loading;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Background handled by CSS design system v8.0 */}
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{loadingMessage}</p>
            <p className="text-gray-500 text-sm mt-2">
              {language === 'fr' ? 'Coût: 1 crédit' : 'Cost: 1 credit'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !studyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        {/* Background handled by CSS design system v8.0 */}
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center glass-panel rounded-2xl p-8 max-w-md">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">{texts.error}</h2>
            <p className="text-gray-400 mb-6">{error || texts.noData}</p>
            <button
              onClick={() => navigate('/dashboard')}
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

  const currentProgress = activeTab === 'flashcards' ? flashcardProgress : quizProgress;
  const hasFlashcards = studyData.flashcards.length > 0;
  const hasQuiz = studyData.quiz.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <DoodleBackground variant="academic" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">{texts.backToAnalysis}</span>
          </button>
          
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <h1 className="text-lg font-semibold text-white">{texts.title}</h1>
          </div>
          
          <div className="w-24" /> {/* Spacer */}
        </div>

        {/* Video title */}
        <h2 className="text-xl font-bold text-white text-center mb-6 line-clamp-2">
          {studyData.videoTitle}
        </h2>

        {/* Tabs */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => { setActiveTab('flashcards'); setShowResults(false); }}
            disabled={!hasFlashcards}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                      ${activeTab === 'flashcards'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                      } ${!hasFlashcards ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            onClick={() => { setActiveTab('quiz'); setShowResults(false); }}
            disabled={!hasQuiz}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all
                      ${activeTab === 'quiz'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
                      } ${!hasQuiz ? 'opacity-50 cursor-not-allowed' : ''}`}
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
              correct={activeTab === 'flashcards' ? flashcardStats?.known || 0 : quizProgress.score}
              incorrect={activeTab === 'flashcards' ? flashcardStats?.unknown || 0 : currentProgress.current - quizProgress.score}
              mode={activeTab === 'flashcards' ? 'flashcard' : 'quiz'}
              language={language}
            />
          </div>
        )}

        {/* Content */}
        <div className="glass-panel rounded-2xl p-6 min-h-[500px]">
          {showResults ? (
            <ScoreCard
              score={finalScore.correct}
              total={activeTab === 'flashcards' ? studyData.flashcards.length : studyData.quiz.length}
              correct={finalScore.correct}
              incorrect={finalScore.incorrect}
              mode={activeTab === 'flashcards' ? 'flashcard' : 'quiz'}
              onRetry={handleRetry}
              language={language}
            />
          ) : activeTab === 'flashcards' ? (
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
          ) : (
            hasQuiz ? (
              <QuizQuestion
                questions={studyData.quiz}
                onProgress={handleQuizProgress}
                onComplete={handleQuizComplete}
                language={language}
              />
            ) : (
              <EmptyState type="quiz" language={language} />
            )
          )}
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

interface EmptyStateProps {
  type: 'flashcards' | 'quiz';
  language: 'fr' | 'en';
}

const EmptyState: React.FC<EmptyStateProps> = ({ type, language }) => {
  const texts = {
    fr: {
      flashcards: {
        title: 'Aucune flashcard',
        message: 'Les flashcards ne sont pas encore générées pour cette vidéo.',
      },
      quiz: {
        title: 'Aucun quiz',
        message: 'Le quiz n\'est pas encore généré pour cette vidéo.',
      },
    },
    en: {
      flashcards: {
        title: 'No flashcards',
        message: 'Flashcards are not yet generated for this video.',
      },
      quiz: {
        title: 'No quiz',
        message: 'Quiz is not yet generated for this video.',
      },
    },
  }[language][type];

  return (
    <div className="flex flex-col items-center justify-center py-16">
      {type === 'flashcards' ? (
        <BookMarked className="w-16 h-16 text-gray-600 mb-4" />
      ) : (
        <Brain className="w-16 h-16 text-gray-600 mb-4" />
      )}
      <h3 className="text-xl font-semibold text-gray-400 mb-2">{texts.title}</h3>
      <p className="text-gray-500">{texts.message}</p>
    </div>
  );
};

export default StudyPage;
