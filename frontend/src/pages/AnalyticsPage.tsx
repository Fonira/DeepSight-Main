/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 ANALYTICS PAGE — Dashboard des statistiques d'utilisation                      ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  ✅ Nombre d'analyses ce mois                                                      ║
 * ║  ✅ Temps total de vidéos analysées                                                ║
 * ║  ✅ Crédits utilisés/restants                                                      ║
 * ║  ✅ Graphique d'activité (7 derniers jours)                                        ║
 * ║  ✅ Top catégories analysées                                                       ║
 * ║                                                                                    ║
 * ║  🆕 v2.0: Utilise les composants Recharts pour de vrais graphiques                ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Video,
  Clock,
  Zap,
  TrendingUp,
  Calendar,
  RefreshCw,
  ArrowRight,
  Brain,
  MessageSquare,
  History,
  Sparkles,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { StatCard, ActivityChart, UsageProgress, CategoryPieChart } from '../components/analytics';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

// Types
interface UsageStats {
  plan: string;
  plan_name: string;
  plan_color: string;
  credits_remaining: number;
  credits_monthly: number;
  credits_used_this_month: number;
  credits_percent_used: number;
  analyses_this_month: number;
  analyses_total: number;
  chat_daily_limit: number;
  chat_used_today: number;
  chat_remaining_today: number;
  web_search_enabled: boolean;
  member_since?: string;
}

interface DetailedUsage {
  period_days: number;
  totals: {
    analyses: number;
    duration_seconds: number;
    duration_formatted: string;
    words_generated: number;
    credits_used: number;
  };
  daily_analyses: { date: string; count: number }[];
  categories: Record<string, number>;
  models_used: Record<string, number>;
  averages: {
    analyses_per_day: number;
    credits_per_day: number;
  };
}

interface RecentAnalysis {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  category: string;
  created_at: string;
}

// API functions
const fetchUsageStats = async (): Promise<UsageStats> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch('/api/usage/stats', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch usage stats');
  return response.json();
};

const fetchDetailedUsage = async (days: number = 30): Promise<DetailedUsage> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`/api/usage/detailed?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch detailed usage');
  return response.json();
};

const fetchRecentAnalyses = async (limit: number = 5): Promise<RecentAnalysis[]> => {
  const token = localStorage.getItem('access_token');
  const response = await fetch(`/api/history/videos?page=1&per_page=${limit}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || data || [];
};

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();
  
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [detailedUsage, setDetailedUsage] = useState<DetailedUsage | null>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<RecentAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  const t = (fr: string, en: string) => language === 'fr' ? fr : en;

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    
    try {
      const [stats, detailed, recent] = await Promise.all([
        fetchUsageStats(),
        fetchDetailedUsage(30),
        fetchRecentAnalyses(5)
      ]);
      setUsageStats(stats);
      setDetailedUsage(detailed);
      setRecentAnalyses(recent);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(t(
        'Impossible de charger les statistiques. Veuillez réessayer.',
        'Unable to load statistics. Please try again.'
      ));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes} min`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="w-10 h-10 text-accent-primary animate-spin mx-auto mb-4" />
              <p className="text-text-secondary">
                {t('Chargement des statistiques...', 'Loading statistics...')}
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="card p-8 max-w-md text-center">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                {t('Erreur de chargement', 'Loading Error')}
              </h2>
              <p className="text-text-secondary mb-4">{error}</p>
              <button onClick={() => loadData()} className="btn btn-primary">
                <RefreshCw className="w-4 h-4" />
                {t('Réessayer', 'Try again')}
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-8 h-8 text-accent-primary" />
              <h1 className="text-2xl font-bold text-text-primary">
                {t('Analytics', 'Analytics')}
              </h1>
            </div>
            <p className="text-text-secondary">
              {t(
                'Visualisez votre utilisation et vos statistiques',
                'View your usage and statistics'
              )}
            </p>
          </div>
          
          <button
            onClick={() => loadData(true)}
            className="btn btn-secondary"
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('Actualiser', 'Refresh')}
          </button>
        </div>

        {/* Plan Banner */}
        {usageStats && (
          <div 
            className="card mb-8 p-6 border-l-4"
            style={{ borderLeftColor: usageStats.plan_color }}
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="text-sm text-text-tertiary mb-1">
                  {t('Plan actuel', 'Current plan')}
                </div>
                <div className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-5 h-5" style={{ color: usageStats.plan_color }} />
                  {usageStats.plan_name}
                </div>
                {usageStats.member_since && (
                  <p className="text-xs text-text-muted mt-1">
                    {t('Membre depuis', 'Member since')} {formatDate(usageStats.member_since)}
                  </p>
                )}
              </div>
              <button 
                onClick={() => navigate('/upgrade')}
                className="btn btn-primary"
              >
                {t('Gérer l\'abonnement', 'Manage subscription')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={Video}
            title={t('Analyses ce mois', 'Analyses this month')}
            value={usageStats?.analyses_this_month || 0}
            subtitle={`${usageStats?.analyses_total || 0} ${t('au total', 'total')}`}
            color="blue"
            trend={detailedUsage ? {
              value: Math.round((detailedUsage.averages.analyses_per_day || 0) * 10),
              label: t('par rapport à la moyenne', 'vs average')
            } : undefined}
          />
          
          <StatCard
            icon={Clock}
            title={t('Temps analysé', 'Time analyzed')}
            value={formatDuration(detailedUsage?.totals.duration_seconds || 0)}
            subtitle={t('de contenu vidéo', 'of video content')}
            color="purple"
          />
          
          <StatCard
            icon={Zap}
            title={t('Crédits utilisés', 'Credits used')}
            value={usageStats?.credits_used_this_month.toLocaleString() || 0}
            subtitle={`${usageStats?.credits_remaining.toLocaleString() || 0} ${t('restants', 'remaining')}`}
            color="amber"
            progress={usageStats ? {
              current: usageStats.credits_used_this_month,
              max: usageStats.credits_monthly
            } : undefined}
          />
          
          <StatCard
            icon={MessageSquare}
            title={t('Messages IA', 'AI Messages')}
            value={`${usageStats?.chat_used_today || 0}/${usageStats?.chat_daily_limit === -1 ? '∞' : usageStats?.chat_daily_limit}`}
            subtitle={t('utilisés aujourd\'hui', 'used today')}
            color="cyan"
          />
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Activity Chart - Takes 2 columns */}
          <div className="lg:col-span-2">
            <ActivityChart
              data={detailedUsage?.daily_analyses || []}
              language={language as 'fr' | 'en'}
            />
          </div>
          
          {/* Category Pie Chart */}
          <CategoryPieChart
            data={detailedUsage?.categories || {}}
            language={language as 'fr' | 'en'}
          />
        </div>

        {/* Row 3: Usage Progress & Additional Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Credits Usage */}
          <UsageProgress
            creditsUsed={usageStats?.credits_used_this_month || 0}
            creditsTotal={usageStats?.credits_monthly || 0}
            creditsRemaining={usageStats?.credits_remaining || 0}
            language={language as 'fr' | 'en'}
          />
          
          {/* Models Used */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-rose-500" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary">
                  {t('Modèles utilisés', 'Models used')}
                </h3>
                <p className="text-xs text-text-tertiary">
                  {t('Ce mois-ci', 'This month')}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {detailedUsage && Object.keys(detailedUsage.models_used).length > 0 ? (
                Object.entries(detailedUsage.models_used)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, count]) => {
                    const total = Object.values(detailedUsage.models_used).reduce((a, b) => a + b, 0);
                    const percent = (count / total) * 100;
                    
                    // Model display names
                    const modelNames: Record<string, { name: string; emoji: string }> = {
                      'mistral-small-latest': { name: 'Mistral Small', emoji: '⚡' },
                      'mistral-medium-latest': { name: 'Mistral Medium', emoji: '⚖️' },
                      'mistral-large-latest': { name: 'Mistral Large', emoji: '🚀' },
                    };
                    
                    const modelInfo = modelNames[model] || { name: model, emoji: '🤖' };
                    
                    return (
                      <div key={model}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-text-secondary flex items-center gap-1.5">
                            <span>{modelInfo.emoji}</span>
                            {modelInfo.name}
                          </span>
                          <span className="text-text-tertiary">
                            {count} ({Math.round(percent)}%)
                          </span>
                        </div>
                        <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p className="text-sm text-text-tertiary text-center py-4">
                  {t('Aucune donnée disponible', 'No data available')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Analyses */}
        {recentAnalyses.length > 0 && (
          <div className="card p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <History className="w-5 h-5 text-purple-500" />
                {t('Dernières analyses', 'Recent analyses')}
              </h3>
              <button
                onClick={() => navigate('/history')}
                className="text-sm text-accent-primary hover:underline flex items-center gap-1"
              >
                {t('Tout voir', 'View all')}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {recentAnalyses.map((analysis) => {
                const categoryEmoji: Record<string, string> = {
                  interview_podcast: "🎙️", science: "🔬", tech: "💻",
                  education: "📚", finance: "💰", gaming: "🎮",
                  culture: "🎨", news: "📰", health: "🏥", general: "📺",
                };
                
                const formatVideoDuration = (seconds: number): string => {
                  if (!seconds) return "0:00";
                  const h = Math.floor(seconds / 3600);
                  const m = Math.floor((seconds % 3600) / 60);
                  if (h > 0) return `${h}h ${m}m`;
                  return `${m} min`;
                };
                
                const formatRelativeDate = (dateString: string): string => {
                  const date = new Date(dateString);
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  
                  if (language === 'fr') {
                    if (diffDays === 0) return "Aujourd'hui";
                    if (diffDays === 1) return "Hier";
                    if (diffDays < 7) return `Il y a ${diffDays} jours`;
                    return date.toLocaleDateString("fr-FR");
                  } else {
                    if (diffDays === 0) return "Today";
                    if (diffDays === 1) return "Yesterday";
                    if (diffDays < 7) return `${diffDays} days ago`;
                    return date.toLocaleDateString("en-US");
                  }
                };
                
                return (
                  <div
                    key={analysis.id}
                    onClick={() => navigate(`/dashboard?id=${analysis.id}`)}
                    className="flex items-center gap-4 p-3 rounded-xl bg-bg-tertiary/50 hover:bg-bg-tertiary transition-all cursor-pointer group"
                  >
                    {/* Thumbnail */}
                    <div className="w-20 h-12 rounded-lg overflow-hidden bg-bg-secondary flex-shrink-0 relative">
                      {analysis.thumbnail_url ? (
                        <img 
                          src={analysis.thumbnail_url} 
                          alt={analysis.video_title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-text-tertiary" />
                        </div>
                      )}
                      {analysis.video_duration && (
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-medium">
                          {formatVideoDuration(analysis.video_duration)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">
                        {analysis.video_title}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-text-tertiary mt-1">
                        <span>{categoryEmoji[analysis.category || 'general'] || '📺'}</span>
                        <span className="truncate">{analysis.video_channel}</span>
                        <span>•</span>
                        <span>{formatRelativeDate(analysis.created_at)}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-accent-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card p-5">
          <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-accent-primary" />
            {t('Actions rapides', 'Quick actions')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-3 p-4 rounded-xl bg-bg-tertiary hover:bg-bg-hover transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">
                  {t('Nouvelle analyse', 'New analysis')}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t('Analyser une vidéo', 'Analyze a video')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary transition-colors" />
            </button>
            
            <button
              onClick={() => navigate('/history')}
              className="flex items-center gap-3 p-4 rounded-xl bg-bg-tertiary hover:bg-bg-hover transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <History className="w-5 h-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">
                  {t('Historique', 'History')}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t('Voir vos analyses', 'View your analyses')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary transition-colors" />
            </button>
            
            <button
              onClick={() => navigate('/account')}
              className="flex items-center gap-3 p-4 rounded-xl bg-bg-tertiary hover:bg-bg-hover transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-text-primary">
                  {t('Mon compte', 'My account')}
                </p>
                <p className="text-xs text-text-tertiary">
                  {t('Gérer votre profil', 'Manage your profile')}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-text-tertiary group-hover:text-text-secondary transition-colors" />
            </button>
          </div>
        </div>

        {/* Insights Section */}
        {detailedUsage && detailedUsage.totals.analyses > 0 && (
          <div className="mt-6 card p-5 bg-gradient-to-br from-accent-primary/5 to-purple-500/5 border-accent-primary/20">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-primary" />
              {t('Insights', 'Insights')}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-bg-primary/50">
                <p className="text-text-tertiary mb-1">{t('Moyenne quotidienne', 'Daily average')}</p>
                <p className="text-lg font-bold text-text-primary">
                  {detailedUsage.averages.analyses_per_day.toFixed(1)} {t('analyses', 'analyses')}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-bg-primary/50">
                <p className="text-text-tertiary mb-1">{t('Mots générés', 'Words generated')}</p>
                <p className="text-lg font-bold text-text-primary">
                  {(detailedUsage.totals.words_generated || 0).toLocaleString()}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-bg-primary/50">
                <p className="text-text-tertiary mb-1">{t('Temps économisé', 'Time saved')}</p>
                <p className="text-lg font-bold text-text-primary">
                  ~{Math.round((detailedUsage.totals.duration_seconds || 0) / 60 * 0.8)} min
                </p>
                <p className="text-xs text-text-muted">{t('(vs regarder les vidéos)', '(vs watching videos)')}</p>
              </div>
              
              <div className="p-3 rounded-lg bg-bg-primary/50">
                <p className="text-text-tertiary mb-1">{t('Catégorie favorite', 'Favorite category')}</p>
                <p className="text-lg font-bold text-text-primary">
                  {Object.keys(detailedUsage.categories).length > 0
                    ? Object.entries(detailedUsage.categories).sort(([,a], [,b]) => b - a)[0][0]
                    : '-'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
