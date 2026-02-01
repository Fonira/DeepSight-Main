/**
 * 📚 StudyPage — Flashcards & Quiz Interface
 * Page d'étude interactive avec modes flashcards et quiz
 * 
 * Route: /study/:summaryId
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers, Brain, ArrowLeft, Loader2, RefreshCw, AlertCircle,
  BookOpen, GraduationCap, Sparkles, Clock,
} from 'lucide-react';
import { studyApi, videoApi } from '../services/api';
import type { 
  StudyQuizQuestion, 
  StudyFlashcardItem, 
  QuizResponse, 
  FlashcardsResponse,
  Summary 
} from '../services/api';
import { FlashcardDeck, QuizQuestion, ProgressBar, ScoreCard } from '../components/study';
import { useAuth } from '../hooks/useAuth';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';

type StudyMode = 'flashcards' | 'quiz';
type StudyState = 'loading' | 'selecting' | 'studying' | 'completed' | 'error';

interface QuizAnswer {
  question: string;
  userAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  explanation?: string;
}

const StudyPage: React.FC = () => {
  const { summaryId } = useParams<{ summaryId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // State
  const [mode, setMode] = useState<StudyMode | null>(
    searchParams.get('mode') as StudyMode | null
  );
  const [state, setState] = useState<StudyState>('loading');
  const [error, setError] = useState<string | null>(null);
  
  // Data
  const [summary, setSummary] = useState<Summary | null>(null);
  const [flashcards, setFlashcards] = useState<StudyFlashcardItem[]>([]);
  const [quiz, setQuiz] = useState<StudyQuizQuestion[]>([]);
  const [title, setTitle] = useState<string>('');
  
  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStartTime, setQuizStartTime] = useState<Date | null>(null);
  const [quizEndTime, setQuizEndTime] = useState<Date | null>(null);

  // Load summary info
  useEffect(() => {
    const loadSummary = async () => {
      if (!summaryId) return;
      
      try {
        const data = await videoApi.getSummary(parseInt(summaryId));
        setSummary(data);
        setTitle(data.video_title || 'Étude');
        setState('selecting');
      } catch (err) {
        console.error('Failed to load summary:', err);
        setError('Impossible de charger le résumé');
        setState('error');
      }
    };

    loadSummary();
  }, [summaryId]);

  // Generate content when mode is selected
  const generateContent = async (selectedMode: StudyMode) => {
    if (!summaryId) return;

    setState('loading');
    setError(null);

    try {
      if (selectedMode === 'flashcards') {
        const response: FlashcardsResponse = await studyApi.generateFlashcards(parseInt(summaryId));
        setFlashcards(response.flashcards);
        setTitle(response.title);
      } else {
        const response: QuizResponse = await studyApi.generateQuiz(parseInt(summaryId));
        setQuiz(response.quiz);
        setTitle(response.title);
        setQuizStartTime(new Date());
      }
      
      setMode(selectedMode);
      setState('studying');
      
      // Refresh user credits
      refreshUser();
    } catch (err: any) {
      console.error('Failed to generate content:', err);
      if (err.status === 402) {
        setError('Crédits insuffisants. Veuillez recharger votre compte.');
      } else {
        setError(err.message || 'Erreur lors de la génération du contenu');
      }
      setState('error');
    }
  };

  // Quiz handlers
  const handleQuizAnswer = (selectedIndex: number, isCorrect: boolean) => {
    const currentQuestion = quiz[currentQuestionIndex];
    
    setQuizAnswers(prev => [...prev, {
      question: currentQuestion.question,
      userAnswer: selectedIndex,
      correctAnswer: currentQuestion.correct_index,
      isCorrect,
      explanation: currentQuestion.explanation,
    }]);

    if (isCorrect) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleQuizNext = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizEndTime(new Date());
      setState('completed');
    }
  };

  const handleQuizRestart = () => {
    setCurrentQuestionIndex(0);
    setQuizAnswers([]);
    setQuizScore(0);
    setQuizStartTime(new Date());
    setQuizEndTime(null);
    setState('studying');
  };

  // Flashcard completion handler
  const handleFlashcardComplete = (known: number, unknown: number) => {
    // Could save stats here
    console.log(`Flashcards completed: ${known} known, ${unknown} to review`);
  };

  // Calculate quiz time
  const quizTimeSpent = useMemo(() => {
    if (!quizStartTime || !quizEndTime) return undefined;
    return Math.round((quizEndTime.getTime() - quizStartTime.getTime()) / 1000);
  }, [quizStartTime, quizEndTime]);

  // Render mode selection
  const renderModeSelection = () => (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
          Mode d'étude
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {title}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Flashcards option */}
        <button
          onClick={() => generateContent('flashcards')}
          className="group p-6 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Layers className="text-white" size={28} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Flashcards
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Révisez les concepts clés avec des cartes à retourner. Swipez pour trier ce que vous connaissez.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">~5 min</span>
            <span className="text-gray-300 dark:text-gray-600 mx-2">•</span>
            <span className="text-blue-500 font-medium">1 crédit</span>
          </div>
        </button>

        {/* Quiz option */}
        <button
          onClick={() => generateContent('quiz')}
          className="group p-6 bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-400 transition-all text-left"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Brain className="text-white" size={28} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
            Quiz
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Testez votre compréhension avec des questions à choix multiples et des explications détaillées.
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Clock size={14} className="text-gray-400" />
            <span className="text-gray-500 dark:text-gray-400">~10 min</span>
            <span className="text-gray-300 dark:text-gray-600 mx-2">•</span>
            <span className="text-purple-500 font-medium">1 crédit</span>
          </div>
        </button>
      </div>

      {/* Credits info */}
      {user && (
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Crédits disponibles: <span className="font-semibold text-blue-500">{user.credits}</span>
        </div>
      )}
    </div>
  );

  // Render loading
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-6 animate-pulse">
        <Sparkles className="text-white" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
        Génération en cours...
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        {mode === 'flashcards' ? 'Création des flashcards' : 'Préparation du quiz'}
      </p>
      <Loader2 className="mt-4 animate-spin text-blue-500" size={24} />
    </div>
  );

  // Render error
  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
        <AlertCircle className="text-red-500" size={32} />
      </div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2 text-center">
        Une erreur est survenue
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
        {error}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => {
            setError(null);
            setState('selecting');
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <RefreshCw size={18} />
          Réessayer
        </button>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Retour
        </button>
      </div>
    </div>
  );

  // Render quiz
  const renderQuiz = () => {
    const currentQuestion = quiz[currentQuestionIndex];
    if (!currentQuestion) return null;

    return (
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <ProgressBar
            current={currentQuestionIndex + 1}
            total={quiz.length}
            variant="quiz"
          />
        </div>

        {/* Question */}
        <QuizQuestion
          question={currentQuestion}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={quiz.length}
          onAnswer={handleQuizAnswer}
          onNext={handleQuizNext}
        />
      </div>
    );
  };

  // Render quiz results
  const renderQuizResults = () => (
    <ScoreCard
      score={quizScore}
      total={quiz.length}
      title={title}
      timeSpent={quizTimeSpent}
      onRestart={handleQuizRestart}
      onContinue={() => navigate(`/summary/${summaryId}`)}
      answers={quizAnswers}
    />
  );

  // Render flashcards
  const renderFlashcards = () => (
    <FlashcardDeck
      flashcards={flashcards}
      title={title}
      onComplete={handleFlashcardComplete}
      onExit={() => navigate(`/summary/${summaryId}`)}
    />
  );

  // Main render
  const renderContent = () => {
    switch (state) {
      case 'loading':
        return renderLoading();
      case 'selecting':
        return renderModeSelection();
      case 'studying':
        return mode === 'quiz' ? renderQuiz() : renderFlashcards();
      case 'completed':
        return mode === 'quiz' ? renderQuizResults() : null;
      case 'error':
        return renderError();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      <Sidebar />
      
      <div className="flex-1 relative overflow-hidden">
        <DoodleBackground />
        
        <div className="relative z-10 p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="text-gray-600 dark:text-gray-400" size={20} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <GraduationCap className="text-blue-500" size={24} />
                Mode Étude
              </h1>
              {summary && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                  {summary.video_title}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyPage;
