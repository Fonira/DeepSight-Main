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
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BookOpen, Brain, ChevronLeft, Loader2, AlertCircle,
  BookMarked, HelpCircle, BarChart3, Trophy
} from 'lucide-react';
import { FlashcardDeck, QuizQuestion, StudyProgress, ScoreCard } from '../components/Study';
import type { Flashcard, FlashcardStats, QuizQuestionData } from '../components/Study';
import { useTranslation } from '../hooks/useTranslation';
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

const fetchStudyData = async (summaryId: string): Promise<StudyData> => {
  const response = await fetch(`${API_URL}/videos/study/${summaryId}/card`, {
    headers: getAuthHeaders(),
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch study data');
  }
  
  const data = await response.json();
  
  // Transform API data to our format
  return {
    flashcards: (data.flashcards || data.questions_answers || []).map((item: any) => ({
      front: item.question || item.front,
      back: item.answer || item.back,
    })),
    quiz: (data.quiz || []).map((q: any) => ({
      question: q.question,
      options: q.options,
      correct: q.correct_index ?? q.correct,
      explanation: q.explanation,
    })),
    videoTitle: data.source_video || data.title || 'Untitled',
    videoId: summaryId,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const StudyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  
  const summaryId = searchParams.get('id');
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

  // Fetch study data
  useEffect(() => {
    if (!summaryId) {
      setError(texts.noId);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchStudyData(summaryId);
        setStudyData(data);
        setFlashcardProgress({ current: 0, total: data.flashcards.length });
        setQuizProgress({ current: 0, total: data.quiz.length, score: 0 });
      } catch (err) {
        console.error('Error loading study data:', err);
        setError(texts.error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [summaryId]);

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
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <DoodleBackground />
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">{texts.loading}</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !studyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <DoodleBackground />
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
      <DoodleBackground />
      
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
