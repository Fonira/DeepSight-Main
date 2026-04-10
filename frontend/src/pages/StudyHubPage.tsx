/**
 * 🧠 STUDY HUB PAGE v3.0 — Hub de révision gamifié
 *
 * Point d'entrée /study (sans summaryId)
 * 3 tabs: Vue d'ensemble | Mes vidéos | Badges
 * Composants gamification + store Zustand
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, Star, Brain, Target, Clock,
  ChevronRight, BookOpen, Sparkles,
} from 'lucide-react';
import { DeepSightSpinnerSmall } from '../components/ui/DeepSightSpinner';
import { useStudyStore } from '../store/studyStore';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { normalizePlanId, CONVERSION_TRIGGERS } from '../config/planPrivileges';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  XPBar, HeatMap, StreakCounter, DailySessionCard,
  VideoMasteryRow, BadgeGrid, BadgeCard,
} from '../components/Study';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

type HubTab = 'overview' | 'videos' | 'badges';

const TAB_LABELS: Record<HubTab, { fr: string; en: string }> = {
  overview: { fr: 'Vue d\'ensemble', en: 'Overview' },
  videos: { fr: 'Mes vidéos', en: 'My videos' },
  badges: { fr: 'Badges', en: 'Badges' },
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h${rm}m` : `${h}h`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 STUDY HUB PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const StudyHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useTranslation();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const {
    stats, heatMap, badges, videoMastery,
    loading, activeTab, setActiveTab, fetchAll,
  } = useStudyStore();

  const plan = normalizePlanId(user?.plan);
  const canStudy = plan !== 'free';
  const fr = language === 'fr';

  // Fetch all gamification data on mount
  useEffect(() => {
    if (canStudy) fetchAll();
  }, [canStudy]);

  // Auto-switch to 'videos' tab when overview is empty but videos exist
  useEffect(() => {
    if (
      activeTab === 'overview' &&
      stats &&
      (stats.total_cards_reviewed ?? 0) === 0 &&
      videoMastery?.videos &&
      videoMastery.videos.length > 0
    ) {
      setActiveTab('videos');
    }
  }, [stats, videoMastery, activeTab]);

  // ── Derived data ──
  const totalDue = useMemo(
    () => videoMastery?.videos.reduce((s, v) => s + (v.due_cards ?? 0), 0) ?? 0,
    [videoMastery],
  );
  const totalVideos = videoMastery?.videos.length ?? 0;
  const estimatedMinutes = Math.max(1, Math.ceil(totalVideos * 2));

  const accuracy = useMemo(() => {
    if (!stats || stats.total_cards_reviewed === 0) return 0;
    return Math.round((stats.total_cards_mastered / stats.total_cards_reviewed) * 100);
  }, [stats]);

  const recentBadges = useMemo(
    () => (badges?.earned ?? []).slice(-4).reverse(),
    [badges],
  );

  const badgeCount = badges?.earned?.length ?? 0;
  const badgeTotal = badges?.total_count ?? (badgeCount + (badges?.locked?.length ?? 0));

  // ── Navigation handlers ──
  const handleStartSession = () => {
    // Prioritize videos with due cards, fallback to first video
    const firstDue = videoMastery?.videos.find(v => (v.due_cards ?? 0) > 0);
    const target = firstDue ?? videoMastery?.videos?.[0];
    if (target) {
      navigate(`/study/${target.summary_id}?session=true`);
    }
  };

  const handleVideoStart = (summaryId: number) => {
    navigate(`/study/${summaryId}?session=true`);
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // Upgrade CTA (free users)
  // ═════════════════════════════════════════════════════════════════════════════
  if (!canStudy) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        <ErrorBoundary fallback={null}><DoodleBackground variant="academic" /></ErrorBoundary>
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
          <div className="min-h-screen flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
                <GraduationCap className="w-8 h-8 text-accent-primary" />
              </div>
              <h1 className="text-2xl font-bold text-text-primary mb-3">
                {fr ? 'Débloquez la révision' : 'Unlock Study Mode'}
              </h1>
              <p className="text-text-secondary mb-6">
                {fr ? 'Les flashcards et quiz sont disponibles à partir du plan Starter.' : 'Flashcards and quizzes are available from the Starter plan.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {CONVERSION_TRIGGERS.trialEnabled && (
                  <button
                    onClick={() => navigate('/upgrade?trial=true')}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    {fr
                      ? `Essayer gratuitement ${CONVERSION_TRIGGERS.trialDays} jours`
                      : `Try free for ${CONVERSION_TRIGGERS.trialDays} days`}
                  </button>
                )}
                <button
                  onClick={() => navigate('/upgrade')}
                  className="px-6 py-3 rounded-xl border border-border-subtle text-text-secondary font-medium hover:text-text-primary hover:bg-bg-hover transition-all"
                >
                  {fr ? 'Voir les plans' : 'View plans'}
                </button>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // Main Hub
  // ═════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-bg-primary relative">
      <ErrorBoundary fallback={null}><DoodleBackground variant="academic" /></ErrorBoundary>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className={`transition-all duration-200 ease-out relative z-10 ${sidebarCollapsed ? 'lg:ml-[60px]' : 'lg:ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-5xl mx-auto">

            {/* ── Header ── */}
            <motion.header
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 pt-2 lg:pt-0"
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">
                      {fr ? 'Révision' : 'Study'}
                    </h1>
                    <p className="text-xs sm:text-sm text-white/40">
                      {fr ? 'Révisez avec la répétition espacée' : 'Study with spaced repetition'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <StreakCounter
                    streak={stats?.current_streak ?? 0}
                    longestStreak={stats?.longest_streak}
                  />
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Star className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-amber-400">
                      {stats?.total_xp?.toLocaleString() ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </motion.header>

            {/* ── XP Level Bar ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-6 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
            >
              <XPBar
                currentXP={stats?.xp_progress ?? 0}
                maxXP={stats?.xp_for_next_level ?? 500}
                level={stats?.level ?? 1}
              />
            </motion.div>

            {/* ── Tabs ── */}
            <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06]">
              {(['overview', 'videos', 'badges'] as HubTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-indigo-400'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {TAB_LABELS[tab][language]}
                  {tab === 'badges' && badgeTotal > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300">
                      {badgeCount}/{badgeTotal}
                    </span>
                  )}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="hubTabIndicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── Loading ── */}
            {loading && !stats && (
              <div className="flex items-center justify-center py-20">
                <DeepSightSpinnerSmall />
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* TAB CONTENT                                                   */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {(!loading || stats) && (
              <AnimatePresence mode="wait">

                {/* ── Vue d'ensemble ── */}
                {activeTab === 'overview' && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Daily Session CTA */}
                    <div className="mb-6">
                      <DailySessionCard
                        totalDue={totalDue}
                        totalNew={totalVideos}
                        estimatedMinutes={estimatedMinutes}
                        onStart={handleStartSession}
                      />
                    </div>

                    {/* 3 Stat Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                          <Brain className="w-4 h-4 text-violet-400" />
                          <span className="text-xs text-white/40">
                            {fr ? 'Cartes maîtrisées' : 'Cards mastered'}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {stats?.total_cards_mastered ?? 0}
                        </p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs text-white/40">
                            {fr ? 'Précision moyenne' : 'Average accuracy'}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-white">{accuracy}%</p>
                      </div>

                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-amber-400" />
                          <span className="text-xs text-white/40">
                            {fr ? 'Temps de révision' : 'Study time'}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                          {formatTime(stats?.total_time_seconds ?? 0)}
                        </p>
                      </div>
                    </div>

                    {/* HeatMap + Recent Badges row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* HeatMap */}
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <h3 className="text-sm font-medium text-white/50 mb-3">
                          {fr ? 'Activité' : 'Activity'}
                        </h3>
                        <HeatMap activities={heatMap?.activities ?? heatMap?.days ?? []} />
                      </div>

                      {/* Recent Badges */}
                      <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium text-white/50">
                            {fr ? 'Derniers badges' : 'Recent badges'}
                          </h3>
                          {badgeCount > 4 && (
                            <button
                              onClick={() => setActiveTab('badges')}
                              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                            >
                              {fr ? 'Voir tous' : 'View all'}
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {recentBadges.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {recentBadges.map((b) => (
                              <BadgeCard key={b.code} badge={b} isEarned />
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <BookOpen className="w-8 h-8 text-white/10 mb-2" />
                            <p className="text-xs text-white/30">
                              {fr ? 'Aucun badge encore' : 'No badges yet'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Mes vidéos ── */}
                {activeTab === 'videos' && (
                  <motion.div
                    key="videos"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {videoMastery?.videos && videoMastery.videos.length > 0 ? (
                      <div className="space-y-2" role="list">
                        {videoMastery.videos.map((video) => (
                          <VideoMasteryRow
                            key={video.summary_id}
                            video={video}
                            onStart={handleVideoStart}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <BookOpen className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white/60 mb-2">
                          {fr ? 'Aucune vidéo révisée' : 'No videos studied'}
                        </h3>
                        <p className="text-sm text-white/30 mb-6">
                          {fr
                            ? 'Analysez une vidéo puis générez des flashcards pour commencer.'
                            : 'Analyze a video and generate flashcards to start.'}
                        </p>
                        <button
                          onClick={() => navigate('/dashboard')}
                          className="px-5 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
                        >
                          {fr ? 'Analyser une vidéo' : 'Analyze a video'}
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* ── Badges ── */}
                {activeTab === 'badges' && (
                  <motion.div
                    key="badges"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm text-white/50">
                        {badgeCount}/{badgeTotal} {fr ? 'badges débloqués' : 'badges unlocked'}
                      </span>
                    </div>
                    <BadgeGrid
                      earned={badges?.earned ?? []}
                      locked={badges?.locked ?? []}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default StudyHubPage;
