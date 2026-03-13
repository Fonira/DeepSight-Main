/**
 * 🧠 STUDY HUB PAGE v2.0 — Hub de révision centralisé
 *
 * Accessible depuis la sidebar → /study (sans summaryId)
 * Liste les analyses récentes avec accès direct aux flashcards/quiz.
 * Intègre Sidebar + DoodleBackground + même design que DashboardPage.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  Search,
  Clock,
  Sparkles,
  BookOpen,
  Brain,
  ArrowRight,
  Loader2,
  AlertCircle,
  Video,
  Layers,
  Zap,
} from 'lucide-react';
import { videoApi, Summary } from '../services/api';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { normalizePlanId, CONVERSION_TRIGGERS } from '../config/planPrivileges';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { ErrorBoundary } from '../components/ErrorBoundary';

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 STUDY HUB PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const StudyHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<Summary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const plan = normalizePlanId(user?.plan);
  const canStudy = plan !== 'free';

  // Textes localisés
  const texts = language === 'fr' ? {
    title: 'Révision',
    subtitle: 'Révisez vos analyses avec des flashcards et quiz interactifs',
    searchPlaceholder: 'Rechercher une analyse...',
    noAnalyses: 'Aucune analyse trouvée',
    noAnalysesDesc: 'Analysez une vidéo pour commencer à réviser',
    startAnalysis: 'Analyser une vidéo',
    study: 'Réviser',
    flashcards: 'Flashcards',
    quiz: 'Quiz',
    recentAnalyses: 'Vos analyses récentes',
    upgradeTitle: 'Débloquez la révision',
    upgradeDesc: 'Les flashcards et quiz sont disponibles à partir du plan Starter.',
    upgrade: 'Voir les plans',
    creditCost: '1 crédit par génération',
    studyModes: 'Modes d\'étude disponibles',
    flashcardsDesc: 'Mémorisez les concepts clés avec des cartes recto-verso',
    quizDesc: 'Testez vos connaissances avec des QCM interactifs',
  } : {
    title: 'Study',
    subtitle: 'Review your analyses with interactive flashcards and quizzes',
    searchPlaceholder: 'Search an analysis...',
    noAnalyses: 'No analyses found',
    noAnalysesDesc: 'Analyze a video to start studying',
    startAnalysis: 'Analyze a video',
    study: 'Study',
    flashcards: 'Flashcards',
    quiz: 'Quiz',
    recentAnalyses: 'Your recent analyses',
    upgradeTitle: 'Unlock Study Mode',
    upgradeDesc: 'Flashcards and quizzes are available from the Starter plan.',
    upgrade: 'View plans',
    creditCost: '1 credit per generation',
    studyModes: 'Available study modes',
    flashcardsDesc: 'Memorize key concepts with flip cards',
    quizDesc: 'Test your knowledge with interactive quizzes',
  };

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setIsLoading(true);
        const response = await videoApi.getHistory({ limit: 50, page: 1 });
        setAnalyses(response.items || []);
      } catch (err) {
        console.error('[StudyHub] Failed to fetch analyses:', err);
        setError(language === 'fr' ? 'Impossible de charger vos analyses' : 'Failed to load your analyses');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAnalyses();
  }, [language]);

  // Filtre de recherche
  const filteredAnalyses = analyses.filter(a =>
    a.video_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.video_channel?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.tags?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Formatage de la date relative
  const getRelativeTime = (dateStr: string): string => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 60) return `${diffMin}min`;
    if (diffH < 24) return `${diffH}h`;
    if (diffD < 7) return `${diffD}j`;
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const handleStudy = (summaryId: number) => {
    navigate(`/study/${summaryId}`);
  };

  // ── Upgrade CTA pour les utilisateurs gratuits ──
  if (!canStudy) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        <ErrorBoundary fallback={null}><DoodleBackground variant="academic" /></ErrorBoundary>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md text-center"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-accent-primary" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-3">{texts.upgradeTitle}</h1>
              <p className="text-text-secondary mb-6">{texts.upgradeDesc}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {CONVERSION_TRIGGERS.trialEnabled && (
                  <button
                    onClick={() => navigate('/upgrade?trial=true')}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {language === 'fr'
                      ? `Essayer gratuitement ${CONVERSION_TRIGGERS.trialDays} jours`
                      : `Try free for ${CONVERSION_TRIGGERS.trialDays} days`}
                  </button>
                )}
                <button
                  onClick={() => navigate('/upgrade')}
                  className="px-6 py-3 rounded-xl border border-border-subtle text-text-secondary font-medium hover:text-text-primary hover:bg-bg-hover transition-all"
                >
                  {texts.upgrade}
                </button>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <ErrorBoundary fallback={null}><DoodleBackground variant="academic" /></ErrorBoundary>

      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content */}
      <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-5xl mx-auto">

            {/* Header — avec pt-2 pour le hamburger mobile */}
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 pt-2 lg:pt-0"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-accent-primary" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{texts.title}</h1>
                  <p className="text-xs sm:text-sm text-text-secondary">{texts.subtitle}</p>
                </div>
              </div>
            </motion.header>

            {/* Study modes cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-bg-secondary/60 backdrop-blur-sm border border-border-subtle">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-4.5 h-4.5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{texts.flashcards}</p>
                  <p className="text-xs text-text-tertiary">{texts.flashcardsDesc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-bg-secondary/60 backdrop-blur-sm border border-border-subtle">
                <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4.5 h-4.5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{texts.quiz}</p>
                  <p className="text-xs text-text-tertiary">{texts.quizDesc}</p>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={texts.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-secondary/80 backdrop-blur-sm border border-border-subtle text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30 focus:border-accent-primary/50 transition-all"
              />
            </div>

            {/* Credit info */}
            <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-accent-primary/5 border border-accent-primary/10 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs text-text-secondary">{texts.creditCost}</span>
              {user?.credits !== undefined && (
                <span className="text-xs font-medium text-accent-primary ml-auto">
                  {user.credits.toLocaleString()} {language === 'fr' ? 'crédits restants' : 'credits left'}
                </span>
              )}
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6 backdrop-blur-sm">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !error && filteredAnalyses.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <BookOpen className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">{texts.noAnalyses}</h3>
                <p className="text-sm text-text-secondary mb-6">{texts.noAnalysesDesc}</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-5 py-2.5 rounded-xl bg-accent-primary text-white text-sm font-medium hover:bg-accent-primary-hover transition-colors"
                >
                  {texts.startAnalysis}
                </button>
              </motion.div>
            )}

            {/* Analyses grid */}
            {!isLoading && filteredAnalyses.length > 0 && (
              <>
                <h2 className="text-sm font-medium text-text-tertiary uppercase tracking-wider mb-4">
                  {texts.recentAnalyses} ({filteredAnalyses.length})
                </h2>
                <div className="grid gap-3">
                  {filteredAnalyses.map((analysis, index) => (
                    <motion.div
                      key={analysis.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-bg-secondary/60 backdrop-blur-sm border border-border-subtle hover:border-accent-primary/30 hover:bg-bg-secondary/90 transition-all cursor-pointer"
                      onClick={() => handleStudy(analysis.id)}
                    >
                      {/* Thumbnail */}
                      <div className="w-20 h-14 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0 relative">
                        {analysis.thumbnail_url ? (
                          <img
                            src={analysis.thumbnail_url}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="w-5 h-5 text-text-muted" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">
                          {analysis.video_title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-text-tertiary truncate">
                            {analysis.video_channel}
                          </span>
                          <span className="text-xs text-text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getRelativeTime(analysis.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Study button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStudy(analysis.id);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary/10 text-accent-primary text-xs font-medium hover:bg-accent-primary/20 transition-colors flex-shrink-0"
                      >
                        <Brain className="w-3.5 h-3.5" />
                        {texts.study}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default StudyHubPage;
