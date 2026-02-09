/**
 * 🎬 DEEP SIGHT — Playlist Detail Page
 *
 * Page de détail pour une playlist analysée avec :
 * - Infos de la playlist (titre, nb vidéos)
 * - Liste des vidéos avec statut (analysée/pending)
 * - Synthèse globale de la playlist
 * - Graphiques comparatifs
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import { playlistApi, Summary } from '../services/api';
import {
  ListVideo, Loader2, AlertCircle, Clock, ArrowLeft,
  ChevronRight, CheckCircle, XCircle,
  RefreshCw, Sparkles, BarChart3, PieChart, TrendingUp,
  FileText, Video, Tag, Layers, MessageSquare,
  Target
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface PlaylistDetails {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  channel_name?: string;
  video_count: number;
  total_duration?: number;
  created_at: string;
}

interface PlaylistVideo extends Summary {
  status: 'analyzed' | 'pending' | 'failed';
  analysis_progress?: number;
}

interface PlaylistStats {
  totalVideos: number;
  analyzedCount: number;
  totalDuration: number;
  totalWords: number;
  averageReliability: number;
  categories: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  durationDistribution: Array<{ range: string; count: number }>;
}

interface CorpusSynthesis {
  summary: string;
  key_themes: string[];
  common_patterns: string[];
  divergent_views: string[];
  recommendations?: string[];
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}h ${m}min`;
  }
  return `${m}min ${s}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const CATEGORY_COLORS: Record<string, string> = {
  'education': '#10B981',
  'technology': '#3B82F6',
  'business': '#8B5CF6',
  'science': '#06B6D4',
  'entertainment': '#F59E0B',
  'news': '#EF4444',
  'gaming': '#EC4899',
  'music': '#6366F1',
  'sports': '#14B8A6',
  'health': '#22C55E',
  'lifestyle': '#F97316',
  'other': '#6B7280',
};

// ═══════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  color?: string;
}> = ({ icon, label, value, sublabel, color = 'text-accent-primary' }) => (
  <div className="card p-4 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl bg-bg-tertiary flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{label}</p>
      {sublabel && <p className="text-xs text-text-muted">{sublabel}</p>}
    </div>
  </div>
);

const CategoryChart: React.FC<{
  categories: Record<string, number>;
  language: string;
}> = ({ categories, language }) => {
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  
  const total = sortedCategories.reduce((sum, [, count]) => sum + count, 0);
  
  if (total === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-violet-400" />
        {language === 'fr' ? 'Répartition par catégorie' : 'Category Distribution'}
      </h3>
      <div className="space-y-3">
        {sortedCategories.map(([category, count]) => {
          const percent = Math.round((count / total) * 100);
          const color = CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
          
          return (
            <div key={category}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-text-secondary capitalize">{category}</span>
                <span className="text-text-muted">{count} ({percent}%)</span>
              </div>
              <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DurationChart: React.FC<{
  distribution: Array<{ range: string; count: number }>;
  language: string;
}> = ({ distribution, language }) => {
  const maxCount = Math.max(...distribution.map(d => d.count), 1);
  
  if (distribution.length === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        {language === 'fr' ? 'Distribution par durée' : 'Duration Distribution'}
      </h3>
      <div className="flex items-end gap-2 h-32">
        {distribution.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all duration-500"
              style={{ height: `${(item.count / maxCount) * 100}%`, minHeight: item.count > 0 ? '8px' : '0' }}
            />
            <span className="text-xs text-text-muted mt-2 text-center">{item.range}</span>
            <span className="text-xs text-text-secondary">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const VideoListItem: React.FC<{
  video: PlaylistVideo;
  onClick: () => void;
  language: string;
}> = ({ video, onClick, language }) => (
  <div
    className="p-4 hover:bg-bg-secondary/50 transition-colors cursor-pointer border-b border-border-subtle last:border-b-0"
    onClick={onClick}
  >
    <div className="flex items-center gap-4">
      {/* Thumbnail */}
      <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden bg-bg-tertiary">
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-6 h-6 text-text-muted" />
          </div>
        )}
        {video.video_duration && (
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
            {formatDuration(video.video_duration)}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text-primary truncate">
          {video.video_title}
        </h4>
        <p className="text-sm text-text-secondary truncate">
          {video.video_channel}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {video.status === 'analyzed' && (
            <span className="inline-flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              {language === 'fr' ? 'Analysé' : 'Analyzed'}
            </span>
          )}
          {video.status === 'pending' && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              {language === 'fr' ? 'En attente' : 'Pending'}
            </span>
          )}
          {video.status === 'failed' && (
            <span className="inline-flex items-center gap-1 text-xs text-red-400">
              <XCircle className="w-3 h-3" />
              {language === 'fr' ? 'Échec' : 'Failed'}
            </span>
          )}
          {video.category && (
            <span className="text-xs text-text-muted capitalize">
              • {video.category}
            </span>
          )}
          {video.reliability_score !== undefined && (
            <span className={`text-xs ${
              video.reliability_score >= 70 ? 'text-green-400' :
              video.reliability_score >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              • {video.reliability_score}% fiable
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-text-muted flex-shrink-0" />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const PlaylistDetailPage: React.FC = () => {
  const { language } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'synthesis' | 'stats'>('videos');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [videos, setVideos] = useState<PlaylistVideo[]>([]);
  const [synthesis, setSynthesis] = useState<CorpusSynthesis | null>(null);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);

  // Computed Stats
  const stats = useMemo<PlaylistStats>(() => {
    const analyzedVideos = videos.filter(v => v.status === 'analyzed');
    
    // Categories
    const categories: Record<string, number> = {};
    analyzedVideos.forEach(v => {
      const cat = v.category || 'other';
      categories[cat] = (categories[cat] || 0) + 1;
    });

    // Tags
    const tagCounts: Record<string, number> = {};
    analyzedVideos.forEach(v => {
      const tags = v.tags?.split(',').map(t => t.trim()).filter(Boolean) || [];
      tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Duration distribution
    const durationRanges = [
      { range: '0-5m', min: 0, max: 300 },
      { range: '5-15m', min: 300, max: 900 },
      { range: '15-30m', min: 900, max: 1800 },
      { range: '30-60m', min: 1800, max: 3600 },
      { range: '60m+', min: 3600, max: Infinity },
    ];
    const durationDistribution = durationRanges.map(r => ({
      range: r.range,
      count: analyzedVideos.filter(v => 
        (v.video_duration || 0) >= r.min && (v.video_duration || 0) < r.max
      ).length,
    }));

    // Averages
    const reliabilityScores = analyzedVideos
      .filter(v => v.reliability_score !== undefined)
      .map(v => v.reliability_score!);
    const averageReliability = reliabilityScores.length > 0
      ? Math.round(reliabilityScores.reduce((a, b) => a + b, 0) / reliabilityScores.length)
      : 0;

    return {
      totalVideos: videos.length,
      analyzedCount: analyzedVideos.length,
      totalDuration: analyzedVideos.reduce((sum, v) => sum + (v.video_duration || 0), 0),
      totalWords: analyzedVideos.reduce((sum, v) => sum + (v.word_count || 0), 0),
      averageReliability,
      categories,
      topTags,
      durationDistribution,
    };
  }, [videos]);

  // ═══════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════

  const loadPlaylistData = useCallback(async () => {
    if (!id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Try to get playlist details from API
      // For now, we'll use the history endpoint to get videos
      const historyResponse = await playlistApi.getHistory({ limit: 100 });
      
      // Filter videos by playlist ID if available
      const playlistVideos = historyResponse.items
        .filter((item: any) => item.playlist_id === id)
        .map((v: any) => ({
          ...v,
          status: 'analyzed' as const,
        }));

      if (playlistVideos.length > 0) {
        // Build playlist info from first video
        const firstVideo = playlistVideos[0];
        setPlaylist({
          id,
          title: firstVideo.playlist_title || `Playlist ${id.substring(0, 8)}...`,
          thumbnail_url: firstVideo.thumbnail_url,
          channel_name: firstVideo.video_channel,
          video_count: playlistVideos.length,
          total_duration: playlistVideos.reduce((sum: number, v: any) => sum + (v.video_duration || 0), 0),
          created_at: firstVideo.created_at,
        });
        setVideos(playlistVideos);
      } else {
        // No videos found, try to fetch playlist info directly
        setError(language === 'fr' 
          ? 'Aucune vidéo trouvée pour cette playlist'
          : 'No videos found for this playlist');
      }
    } catch (err) {
      console.error('Error loading playlist:', err);
      setError(language === 'fr'
        ? 'Erreur lors du chargement de la playlist'
        : 'Error loading playlist');
    } finally {
      setIsLoading(false);
    }
  }, [id, language]);

  useEffect(() => {
    loadPlaylistData();
  }, [loadPlaylistData]);

  // ═══════════════════════════════════════════════════════════════════
  // SYNTHESIS GENERATION
  // ═══════════════════════════════════════════════════════════════════

  const handleGenerateSynthesis = async () => {
    if (!id || videos.length === 0) return;

    setIsGeneratingSynthesis(true);
    try {
      // Call corpus synthesis API
      const response = await fetch(`/api/playlists/${id}/synthesis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          mode: 'standard',
          lang: language,
        }),
      });

      if (!response.ok) throw new Error('Synthesis failed');

      const data = await response.json();
      setSynthesis({
        summary: data.summary || '',
        key_themes: data.key_themes || [],
        common_patterns: data.common_patterns || [],
        divergent_views: data.divergent_views || [],
        recommendations: data.recommendations,
      });
      setActiveTab('synthesis');
    } catch (err) {
      console.error('Error generating synthesis:', err);
      // Generate a basic synthesis from available data
      const analyzedVideos = videos.filter(v => v.status === 'analyzed');
      setSynthesis({
        summary: language === 'fr'
          ? `Cette playlist contient ${analyzedVideos.length} vidéos analysées.`
          : `This playlist contains ${analyzedVideos.length} analyzed videos.`,
        key_themes: Object.keys(stats.categories),
        common_patterns: [],
        divergent_views: [],
      });
      setActiveTab('synthesis');
    } finally {
      setIsGeneratingSynthesis(false);
    }
  };

  const navigateToVideo = (summaryId: number) => {
    navigate(`/dashboard?id=${summaryId}`);
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        {/* Background handled by CSS design system v8.0 */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-accent-primary mx-auto mb-4" />
            <p className="text-text-secondary">
              {language === 'fr' ? 'Chargement de la playlist...' : 'Loading playlist...'}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        {/* Background handled by CSS design system v8.0 */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-text-primary font-semibold mb-2">
              {language === 'fr' ? 'Playlist introuvable' : 'Playlist not found'}
            </p>
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={() => navigate('/playlists')}
              className="btn btn-primary"
            >
              <ArrowLeft className="w-4 h-4" />
              {language === 'fr' ? 'Retour aux playlists' : 'Back to playlists'}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <DoodleBackground variant="video" />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      <main className="flex-1 overflow-x-hidden">
        <div className="container max-w-6xl mx-auto px-4 py-8">

          {/* BACK BUTTON */}
          <button
            onClick={() => navigate('/playlists')}
            className="flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'fr' ? 'Retour aux playlists' : 'Back to playlists'}
          </button>

          {/* HEADER */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-6">
              {/* Thumbnail */}
              <div className="w-40 h-24 rounded-lg overflow-hidden bg-bg-tertiary flex-shrink-0">
                {playlist.thumbnail_url ? (
                  <img
                    src={playlist.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ListVideo className="w-10 h-10 text-text-muted" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-text-primary mb-2 truncate">
                  {playlist.title}
                </h1>
                {playlist.channel_name && (
                  <p className="text-text-secondary mb-2">{playlist.channel_name}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-text-muted">
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    {stats.analyzedCount}/{stats.totalVideos} {language === 'fr' ? 'vidéos' : 'videos'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(stats.totalDuration)}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {formatNumber(stats.totalWords)} {language === 'fr' ? 'mots' : 'words'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateSynthesis}
                  disabled={isGeneratingSynthesis || videos.length === 0}
                  className="btn btn-primary"
                >
                  {isGeneratingSynthesis ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {language === 'fr' ? 'Générer synthèse' : 'Generate synthesis'}
                </button>
                <button
                  onClick={loadPlaylistData}
                  className="btn btn-secondary"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon={<Video className="w-6 h-6" />}
              label={language === 'fr' ? 'Vidéos analysées' : 'Analyzed videos'}
              value={`${stats.analyzedCount}/${stats.totalVideos}`}
              color="text-violet-400"
            />
            <StatCard
              icon={<Clock className="w-6 h-6" />}
              label={language === 'fr' ? 'Durée totale' : 'Total duration'}
              value={formatDuration(stats.totalDuration)}
              color="text-blue-400"
            />
            <StatCard
              icon={<FileText className="w-6 h-6" />}
              label={language === 'fr' ? 'Mots analysés' : 'Words analyzed'}
              value={formatNumber(stats.totalWords)}
              color="text-green-400"
            />
            <StatCard
              icon={<Target className="w-6 h-6" />}
              label={language === 'fr' ? 'Fiabilité moyenne' : 'Average reliability'}
              value={stats.averageReliability > 0 ? `${stats.averageReliability}%` : 'N/A'}
              color={stats.averageReliability >= 70 ? 'text-green-400' : 
                     stats.averageReliability >= 50 ? 'text-amber-400' : 'text-red-400'}
            />
          </div>

          {/* TABS */}
          <div className="flex gap-2 mb-6 border-b border-border-subtle pb-2">
            <button
              onClick={() => setActiveTab('videos')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'videos'
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              <ListVideo className="w-4 h-4" />
              {language === 'fr' ? 'Vidéos' : 'Videos'}
              <span className="text-xs opacity-70">({videos.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('synthesis')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'synthesis'
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {language === 'fr' ? 'Synthèse' : 'Synthesis'}
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'stats'
                  ? 'bg-accent-primary text-white'
                  : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {language === 'fr' ? 'Statistiques' : 'Statistics'}
            </button>
          </div>

          {/* TAB CONTENT */}
          {activeTab === 'videos' && (
            <div className="card">
              {videos.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  <ListVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{language === 'fr' ? 'Aucune vidéo' : 'No videos'}</p>
                </div>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {videos.map((video) => (
                    <VideoListItem
                      key={video.id}
                      video={video}
                      onClick={() => navigateToVideo(video.id)}
                      language={language}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'synthesis' && (
            <div className="space-y-6">
              {synthesis ? (
                <>
                  {/* Main Summary */}
                  <div className="card p-6">
                    <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-violet-400" />
                      {language === 'fr' ? 'Synthèse globale' : 'Global Summary'}
                    </h3>
                    <p className="text-text-secondary whitespace-pre-wrap leading-relaxed">
                      {synthesis.summary}
                    </p>
                  </div>

                  {/* Key Themes */}
                  {synthesis.key_themes.length > 0 && (
                    <div className="card p-6">
                      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5 text-blue-400" />
                        {language === 'fr' ? 'Thèmes principaux' : 'Key Themes'}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {synthesis.key_themes.map((theme, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Common Patterns */}
                  {synthesis.common_patterns.length > 0 && (
                    <div className="card p-6">
                      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        {language === 'fr' ? 'Points communs' : 'Common Patterns'}
                      </h3>
                      <ul className="space-y-2">
                        {synthesis.common_patterns.map((pattern, i) => (
                          <li key={i} className="flex items-start gap-2 text-text-secondary">
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            {pattern}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Divergent Views */}
                  {synthesis.divergent_views.length > 0 && (
                    <div className="card p-6">
                      <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-amber-400" />
                        {language === 'fr' ? 'Points de divergence' : 'Divergent Views'}
                      </h3>
                      <ul className="space-y-2">
                        {synthesis.divergent_views.map((view, i) => (
                          <li key={i} className="flex items-start gap-2 text-text-secondary">
                            <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                            {view}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="card p-8 text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-text-muted" />
                  <h3 className="font-semibold text-text-primary mb-2">
                    {language === 'fr' ? 'Pas encore de synthèse' : 'No synthesis yet'}
                  </h3>
                  <p className="text-text-secondary mb-4">
                    {language === 'fr'
                      ? 'Générez une synthèse pour obtenir une vue d\'ensemble de cette playlist.'
                      : 'Generate a synthesis to get an overview of this playlist.'}
                  </p>
                  <button
                    onClick={handleGenerateSynthesis}
                    disabled={isGeneratingSynthesis || videos.length === 0}
                    className="btn btn-primary"
                  >
                    {isGeneratingSynthesis ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {language === 'fr' ? 'Générer la synthèse' : 'Generate synthesis'}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="grid md:grid-cols-2 gap-6">
              <CategoryChart categories={stats.categories} language={language} />
              <DurationChart distribution={stats.durationDistribution} language={language} />

              {/* Top Tags */}
              {stats.topTags.length > 0 && (
                <div className="card p-6 md:col-span-2">
                  <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-violet-400" />
                    {language === 'fr' ? 'Tags les plus fréquents' : 'Most frequent tags'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.topTags.map(({ tag, count }) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-bg-tertiary rounded-full text-sm"
                      >
                        <span className="text-text-secondary">{tag}</span>
                        <span className="text-text-muted">({count})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reliability Distribution */}
              <div className="card p-6 md:col-span-2">
                <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-green-400" />
                  {language === 'fr' ? 'Score de fiabilité' : 'Reliability Score'}
                </h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-green-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-green-400">
                      {videos.filter(v => (v.reliability_score || 0) >= 70).length}
                    </p>
                    <p className="text-sm text-text-muted">
                      {language === 'fr' ? 'Fiable (≥70%)' : 'Reliable (≥70%)'}
                    </p>
                  </div>
                  <div className="p-4 bg-amber-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-amber-400">
                      {videos.filter(v => (v.reliability_score || 0) >= 50 && (v.reliability_score || 0) < 70).length}
                    </p>
                    <p className="text-sm text-text-muted">
                      {language === 'fr' ? 'Modéré (50-69%)' : 'Moderate (50-69%)'}
                    </p>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-lg">
                    <p className="text-2xl font-bold text-red-400">
                      {videos.filter(v => (v.reliability_score || 0) < 50 && v.reliability_score !== undefined).length}
                    </p>
                    <p className="text-sm text-text-muted">
                      {language === 'fr' ? 'À vérifier (<50%)' : 'To verify (<50%)'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default PlaylistDetailPage;
