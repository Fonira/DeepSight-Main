/**
 * 🎬 DEEP SIGHT v5.2 — Playlist Page avec PROGRESSION DYNAMIQUE + ESTIMATION TEMPS
 * 
 * ✨ FIX v5.2:
 * - Support de progress ET progress_percent
 * - Animation fluide du pourcentage
 * - Estimation du temps restant
 * - Messages d'étape dynamiques
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { Sidebar } from '../components/layout/Sidebar';
import DoodleBackground from '../components/DoodleBackground';
import SmartInputBar, { SmartInputValue } from '../components/SmartInputBar';
import VideoDiscoveryModal from '../components/VideoDiscoveryModal';
import { videoApi, playlistApi, PlaylistTaskStatus, ApiError } from '../services/api';
import type { DiscoveryResponse, VideoCandidate } from '../services/api';
import {
  ListVideo, Play, Loader2, AlertCircle, Clock, 
  ChevronRight, Zap, Crown, Lock, ExternalLink, CheckCircle,
  RefreshCw, History, Settings2, Search, Sparkles, X,
  ListPlus, GraduationCap, TrendingUp, FileText, Save, BarChart3,
  Timer
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface PlaylistHistoryItem {
  playlist_id: string;
  playlist_title: string;
  video_count: number;
  analyzed_count: number;
  created_at: string;
  thumbnail_url?: string;
}

// Type étendu pour la progression
interface ExtendedPlaylistTaskStatus extends PlaylistTaskStatus {
  progress_percent?: number;
  completed_videos?: number;
  current_step?: string;
  playlist_id?: string;
  playlist_title?: string;
  estimated_time_remaining?: string;
  result?: {
    playlist_id?: string;
    num_videos?: number;
    total_duration?: number;
    total_words?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

function getProgressPercent(status: ExtendedPlaylistTaskStatus | null): number {
  if (!status) return 0;
  return status.progress_percent ?? status.progress ?? 0;
}

function getCompletedVideos(status: ExtendedPlaylistTaskStatus | null): number {
  if (!status) return 0;
  return status.completed_videos ?? Math.max(0, (status.current_video ?? 1) - 1);
}

// Estimation du temps pour l'affichage initial
function estimatePlaylistTime(videoCount: number, language: string): string {
  // Estimation: ~1-3 min par vidéo (moyenne 2 min)
  const minMinutes = videoCount;
  const maxMinutes = videoCount * 3;
  
  if (language === 'fr') {
    if (videoCount <= 3) return "⏱️ Estimation : quelques minutes";
    if (videoCount <= 10) return `⏱️ Estimation : ${minMinutes}-${maxMinutes} minutes`;
    if (videoCount <= 20) return `⏱️ Estimation : ${minMinutes}-${maxMinutes} minutes (~${Math.round(maxMinutes/60*10)/10}h max)`;
    return `⏱️ Estimation : ${Math.round(minMinutes/60*10)/10}-${Math.round(maxMinutes/60*10)/10} heures`;
  } else {
    if (videoCount <= 3) return "⏱️ Estimate: a few minutes";
    if (videoCount <= 10) return `⏱️ Estimate: ${minMinutes}-${maxMinutes} minutes`;
    if (videoCount <= 20) return `⏱️ Estimate: ${minMinutes}-${maxMinutes} minutes (~${Math.round(maxMinutes/60*10)/10}h max)`;
    return `⏱️ Estimate: ${Math.round(minMinutes/60*10)/10}-${Math.round(maxMinutes/60*10)/10} hours`;
  }
}

function getStepIcon(step: string) {
  switch (step) {
    case 'fetching': return <Play className="w-4 h-4" />;
    case 'transcript': return <FileText className="w-4 h-4" />;
    case 'category': return <BarChart3 className="w-4 h-4" />;
    case 'summary': return <Sparkles className="w-4 h-4 animate-pulse" />;
    case 'saving': return <Save className="w-4 h-4" />;
    case 'meta': return <Sparkles className="w-4 h-4 animate-pulse" />;
    case 'done': return <CheckCircle className="w-4 h-4" />;
    default: return <Loader2 className="w-4 h-4 animate-spin" />;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const MODES = [
  { id: 'accessible', name: { fr: 'Accessible', en: 'Accessible' }, desc: { fr: 'Grand public', en: 'General' } },
  { id: 'standard', name: { fr: 'Standard', en: 'Standard' }, desc: { fr: 'Équilibré', en: 'Balanced' } },
  { id: 'expert', name: { fr: 'Expert', en: 'Expert' }, desc: { fr: 'Technique', en: 'Technical' } },
] as const;

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const PlaylistPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  
  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  // Input State
  const [smartInput, setSmartInput] = useState<SmartInputValue>({
    mode: 'url',
    searchLanguages: ['fr', 'en'],
  });
  
  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtendedPlaylistTaskStatus | null>(null);
  
  // Animation du pourcentage
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetPercent = getProgressPercent(progress);
  
  // Discovery State
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<VideoCandidate[]>([]);
  
  // History State
  const [history, setHistory] = useState<PlaylistHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Options
  const [videoCount, setVideoCount] = useState(5);
  const [maxVideos, setMaxVideos] = useState(10);
  const [mode, setMode] = useState<'accessible' | 'standard' | 'expert'>('standard');

  // User info
  const isProUser = user?.plan === 'pro' || user?.plan === 'expert' || user?.plan === 'unlimited';
  const userCredits = user?.credits || 0;
  
  // ═══════════════════════════════════════════════════════════════════
  // ANIMATION DU POURCENTAGE
  // ═══════════════════════════════════════════════════════════════════
  
  useEffect(() => {
    if (displayPercent < targetPercent) {
      const step = Math.max(1, Math.ceil((targetPercent - displayPercent) / 8));
      const timer = setTimeout(() => {
        setDisplayPercent(prev => Math.min(prev + step, targetPercent));
      }, 50);
      return () => clearTimeout(timer);
    } else if (displayPercent > targetPercent) {
      setDisplayPercent(targetPercent);
    }
  }, [targetPercent, displayPercent]);
  
  useEffect(() => {
    if (!progress) {
      setDisplayPercent(0);
    }
  }, [progress]);
  
  // ═══════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════
  
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const data = await playlistApi.getHistory({ limit: 10 });
      setHistory(data.items || []);
    } catch (err) {
      console.error('Error loading playlist history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);
  
  // Persistance
  useEffect(() => {
    if (progress && progress.status === 'completed') {
      try {
        localStorage.setItem('deepsight_last_playlist', JSON.stringify({
          ...progress,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save playlist result');
      }
    }
  }, [progress]);
  
  useEffect(() => {
    if (!analyzing && !progress) {
      try {
        const saved = localStorage.getItem('deepsight_last_playlist');
        if (saved) {
          const parsed = JSON.parse(saved);
          const isRecent = parsed.savedAt && (Date.now() - parsed.savedAt) < 24 * 60 * 60 * 1000;
          if (parsed && parsed.status === 'completed' && isRecent) {
            setProgress(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to restore playlist result');
      }
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  
  const handleSubmit = async () => {
    setError(null);
    setProgress(null);
    setDisplayPercent(0);
    
    if (smartInput.mode === 'search') {
      if (!smartInput.searchQuery?.trim()) return;
      
      setAnalyzing(true);
      
      try {
        const discovery = await videoApi.discover(
          smartInput.searchQuery,
          {
            languages: smartInput.searchLanguages || [language, language === 'fr' ? 'en' : 'fr'],
            limit: videoCount + 5,
            minQuality: 30,
            targetDuration: 'default'
          }
        );
        
        setDiscoveryResult(discovery);
        setShowDiscoveryModal(true);
        
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 
          (language === 'fr' ? "Erreur lors de la recherche" : "Search error");
        setError(message);
      } finally {
        setAnalyzing(false);
      }
      
      return;
    }
    
    if (smartInput.mode === 'url' && smartInput.url?.trim()) {
      const playlistId = extractPlaylistId(smartInput.url);
      if (!playlistId) {
        setError(language === 'fr' 
          ? "URL de playlist invalide. Format attendu: youtube.com/playlist?list=..."
          : "Invalid playlist URL. Expected format: youtube.com/playlist?list=...");
        return;
      }
      
      await analyzePlaylist(smartInput.url);
    }
  };
  
  const extractPlaylistId = (url: string): string | null => {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };
  
  const analyzePlaylist = async (url: string) => {
    setAnalyzing(true);
    setError(null);
    setProgress(null);
    setDisplayPercent(0);
    
    try {
      const task = await playlistApi.analyze(url, {
        maxVideos,
        mode,
        lang: language
      });
      
      await pollPlaylistTask(task.task_id);
      
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 
        (language === 'fr' ? "Erreur lors de l'analyse" : "Analysis error");
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };
  
  const handleSelectVideos = async (videos: VideoCandidate[]) => {
    setShowDiscoveryModal(false);
    setSelectedVideos(videos);
    
    if (videos.length === 0) return;
    
    setAnalyzing(true);
    setError(null);
    setProgress(null);
    setDisplayPercent(0);
    
    try {
      const urls = videos.map(v => `https://youtube.com/watch?v=${v.video_id}`);
      
      const corpusName = smartInput.searchQuery 
        ? `Corpus: ${smartInput.searchQuery.substring(0, 50)}`
        : (language === 'fr' ? 'Corpus personnalisé' : 'Custom Corpus');
      
      const task = await playlistApi.analyzeCorpus(urls, {
        name: corpusName,
        mode,
        lang: language
      });
      
      await pollPlaylistTask(task.task_id);
      
      localStorage.setItem('deepsight_last_corpus', JSON.stringify({
        name: corpusName,
        videoCount: videos.length,
        timestamp: Date.now()
      }));
      
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 
        (language === 'fr' ? "Erreur lors de l'analyse du corpus" : "Corpus analysis error");
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Polling plus fréquent (2s)
  const pollPlaylistTask = async (taskId: string) => {
    const maxAttempts = 180;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await playlistApi.getStatus(taskId) as ExtendedPlaylistTaskStatus;
        setProgress(status);
        
        if (status.status === 'completed') {
          await refreshUser(true);
          await loadHistory();
          return;
        }
        
        if (status.status === 'failed') {
          throw new Error(status.error || 'Analysis failed');
        }
        
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        
      } catch (err) {
        throw err;
      }
    }
    
    throw new Error('Timeout');
  };
  
  const navigateToAnalysis = (summaryId: number) => {
    navigate(`/dashboard?id=${summaryId}`);
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  
  const playlistId = smartInput.url ? extractPlaylistId(smartInput.url) : null;
  const completedVideos = getCompletedVideos(progress);
  const totalVideos = progress?.total_videos || 0;
  const currentStep = (progress as ExtendedPlaylistTaskStatus)?.current_step || '';
  const estimatedTime = (progress as ExtendedPlaylistTaskStatus)?.estimated_time_remaining;
  const isProcessing = progress?.status === 'processing' || progress?.status === 'pending';
  const isCompleted = progress?.status === 'completed';

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <DoodleBackground />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className="flex-1 overflow-x-hidden">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-text-primary">
                {language === 'fr' ? 'Analyse de corpus' : 'Corpus Analysis'}
              </h1>
            </div>
            <p className="text-text-secondary">
              {language === 'fr' 
                ? 'Playlist YouTube ou recherche intelligente de vidéos'
                : 'YouTube playlist or intelligent video search'}
            </p>
          </div>
          
          <div className="space-y-6">
            
            {/* INPUT BAR */}
            <div className="card p-6">
              <SmartInputBar
                value={smartInput}
                onChange={setSmartInput}
                onSubmit={handleSubmit}
                loading={analyzing}
                creditsRemaining={userCredits}
                placeholder={
                  smartInput.mode === 'url'
                    ? "https://www.youtube.com/playlist?list=..."
                    : (language === 'fr' ? "Rechercher des vidéos..." : "Search for videos...")
                }
              />
              
              {/* Options */}
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">MAX VIDÉOS</span>
                  <select 
                    value={maxVideos}
                    onChange={(e) => setMaxVideos(Number(e.target.value))}
                    className="bg-bg-tertiary border border-border-subtle rounded px-2 py-1 text-sm"
                  >
                    {[5, 10, 15, 20, 30, 50].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">MODE</span>
                  <div className="flex gap-1">
                    {MODES.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          mode === m.id 
                            ? 'bg-accent-primary text-white' 
                            : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary'
                        }`}
                      >
                        {m.name[language as 'fr' | 'en']}
                      </button>
                    ))}
                  </div>
                </div>
                
                {smartInput.mode === 'url' && playlistId && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Playlist: {playlistId.substring(0, 15)}...</span>
                  </div>
                )}
              </div>
              
              {/* 🆕 ESTIMATION DE TEMPS - Avant de lancer */}
              {smartInput.mode === 'url' && playlistId && !analyzing && !progress && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Timer className="w-4 h-4" />
                    <span>{estimatePlaylistTime(maxVideos, language)}</span>
                  </div>
                  <p className="text-xs text-text-muted mt-1">
                    {language === 'fr' 
                      ? "Les vidéos longues et les grandes playlists peuvent prendre plusieurs dizaines de minutes."
                      : "Long videos and large playlists may take several tens of minutes."}
                  </p>
                </div>
              )}
            </div>
            
            {/* ERROR */}
            {error && (
              <div className="card p-4 border-red-500/30 bg-red-500/10">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-400">{error}</p>
                  </div>
                  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* PROGRESS CARD AMÉLIORÉE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
            {progress && (
              <div className={`card p-6 transition-all duration-300 ${
                isCompleted ? 'border-green-500/30 bg-green-500/5' : 'border-violet-500/30'
              }`}>
                <div className="flex items-center gap-4 mb-4">
                  {/* Icône */}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-green-500/20' : 'bg-violet-500/20'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-7 h-7 text-green-400" />
                    ) : (
                      <Loader2 className="w-7 h-7 text-violet-400 animate-spin" />
                    )}
                  </div>
                  
                  {/* Titre et message */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">
                      {(progress as ExtendedPlaylistTaskStatus).playlist_title || 
                       (language === 'fr' ? 'Analyse en cours...' : 'Analyzing...')}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      {isProcessing && getStepIcon(currentStep)}
                      <span className="truncate">
                        {progress.message || `${completedVideos}/${totalVideos} vidéos`}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pourcentage */}
                  <div className="text-right">
                    <span className={`text-3xl font-bold tabular-nums transition-colors ${
                      isCompleted ? 'text-green-400' : 'text-violet-400'
                    }`}>
                      {displayPercent}%
                    </span>
                    {totalVideos > 0 && (
                      <p className="text-xs text-text-muted">
                        {completedVideos}/{totalVideos} {language === 'fr' ? 'vidéos' : 'videos'}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Barre de progression */}
                <div className="relative h-3 bg-bg-tertiary rounded-full overflow-hidden">
                  {isProcessing && (
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/20 to-violet-500/10 animate-pulse" />
                  )}
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden ${
                      isCompleted 
                        ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                        : 'bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600'
                    }`}
                    style={{ width: `${displayPercent}%` }}
                  >
                    {isProcessing && (
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ animation: 'shimmer 2s infinite' }}
                      />
                    )}
                  </div>
                </div>
                
                {/* 🆕 ESTIMATION TEMPS RESTANT */}
                {isProcessing && estimatedTime && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>
                      {language === 'fr' ? 'Temps restant estimé : ' : 'Estimated time remaining: '}
                      {estimatedTime}
                    </span>
                  </div>
                )}
                
                {/* 🆕 RAPPEL POUR LONGUES PLAYLISTS */}
                {isProcessing && totalVideos > 5 && displayPercent < 50 && (
                  <div className="mt-3 p-2 bg-amber-500/10 rounded text-xs text-amber-400">
                    {language === 'fr' 
                      ? "💡 Les playlists avec de longues vidéos peuvent prendre plusieurs minutes. Vous pouvez laisser cette page ouverte."
                      : "💡 Playlists with long videos may take several minutes. You can leave this page open."}
                  </div>
                )}
                
                {/* Actions après complétion */}
                {isCompleted && (
                  <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-3">
                    <button
                      onClick={() => {
                        const pid = (progress as ExtendedPlaylistTaskStatus).result?.playlist_id || 
                                   (progress as ExtendedPlaylistTaskStatus).playlist_id;
                        if (pid) {
                          navigate(`/history?playlist=${pid}`);
                        } else {
                          navigate('/history');
                        }
                      }}
                      className="btn btn-primary"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {language === 'fr' ? 'Voir les synthèses' : 'View summaries'}
                    </button>
                    <button
                      onClick={() => {
                        setProgress(null);
                        setDisplayPercent(0);
                        localStorage.removeItem('deepsight_last_playlist');
                      }}
                      className="btn btn-ghost text-text-muted"
                    >
                      <X className="w-4 h-4" />
                      {language === 'fr' ? 'Fermer' : 'Close'}
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* HISTORY */}
            {!analyzing && !progress && (
              <div className="card">
                <div className="p-4 border-b border-border-subtle flex items-center justify-between">
                  <h2 className="font-medium text-text-primary flex items-center gap-2">
                    <History className="w-4 h-4" />
                    {language === 'fr' ? 'Playlists récentes' : 'Recent playlists'}
                  </h2>
                  <button 
                    onClick={loadHistory}
                    className="text-text-muted hover:text-text-primary transition-colors"
                    disabled={loadingHistory}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                
                {loadingHistory ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-text-muted" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <ListVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{language === 'fr' ? 'Aucune playlist analysée' : 'No playlists analyzed'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {history.map((item) => (
                      <div 
                        key={item.playlist_id}
                        className="p-4 hover:bg-bg-secondary/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/history?playlist=${item.playlist_id}`)}
                      >
                        <div className="flex items-center gap-4">
                          {item.thumbnail_url ? (
                            <img 
                              src={item.thumbnail_url} 
                              alt="" 
                              className="w-16 h-10 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                              <ListVideo className="w-5 h-5 text-text-muted" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary truncate">
                              {item.playlist_title}
                            </h3>
                            <p className="text-sm text-text-secondary">
                              {item.analyzed_count}/{item.video_count} {language === 'fr' ? 'vidéos' : 'videos'}
                            </p>
                          </div>
                          
                          <ChevronRight className="w-4 h-4 text-text-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      </main>

      {/* DISCOVERY MODAL */}
      <VideoDiscoveryModal
        isOpen={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        discovery={discoveryResult}
        onSelectVideo={(video) => handleSelectVideos([video])}
        onSelectMultiple={handleSelectVideos}
        loading={analyzing}
        userCredits={userCredits}
        allowMultiple={true}
        maxSelection={videoCount}
        preSelectTop={videoCount}
        language={language as 'fr' | 'en'}
      />
      
      {/* CSS shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default PlaylistPage;
