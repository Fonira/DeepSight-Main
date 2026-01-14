/**
 * 🎬 DEEP SIGHT v5.0 — Playlist Page
 * Création de playlists intelligentes par URL ou recherche
 * 
 * ✨ FONCTIONNALITÉS:
 * - 🔗 URL YouTube Playlist → Analyse multiple
 * - 🔍 Recherche intelligente → Création de corpus personnalisé
 * - 📊 Slider 2-20 vidéos pour le mode recherche
 * - 🌻 Scoring qualité + Tournesol
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  ListPlus, GraduationCap, TrendingUp
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
  const [progress, setProgress] = useState<PlaylistTaskStatus | null>(null);
  
  // Discovery State (for search mode)
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<VideoCandidate[]>([]);
  
  // History State
  const [history, setHistory] = useState<PlaylistHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Options
  const [videoCount, setVideoCount] = useState(5); // For search mode: 2-20
  const [maxVideos, setMaxVideos] = useState(10);  // For URL mode
  const [mode, setMode] = useState<'accessible' | 'standard' | 'expert'>('standard');

  // User info
  const isProUser = user?.plan === 'pro' || user?.plan === 'expert' || user?.plan === 'unlimited';
  const userCredits = user?.credits || 0;
  
  // ═══════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════
  
  // Load history
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

  // Charger l'historique pour TOUS les utilisateurs authentifiés
  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);
  
  // === PERSISTANCE: Sauvegarder le dernier résultat de playlist ===
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
  
  // === PERSISTANCE: Restaurer le dernier résultat au démarrage ===
  useEffect(() => {
    // Ne restaurer que si pas déjà en analyse et pas de résultat
    if (!analyzing && !progress) {
      try {
        const saved = localStorage.getItem('deepsight_last_playlist');
        if (saved) {
          const parsed = JSON.parse(saved);
          // Vérifier que c'est un résultat valide et pas trop vieux (< 24h)
          const isRecent = parsed.savedAt && (Date.now() - parsed.savedAt) < 24 * 60 * 60 * 1000;
          if (parsed && parsed.status === 'completed' && isRecent) {
            setProgress(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to restore playlist result');
      }
    }
  }, []); // Seulement au montage
  
  // ═══════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════
  
  // Main submit handler
  const handleSubmit = async () => {
    setError(null);
    setProgress(null);
    
    // SEARCH MODE: Launch discovery
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
    
    // URL MODE: Direct playlist analysis
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
  
  // Extract playlist ID from URL
  const extractPlaylistId = (url: string): string | null => {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };
  
  // Analyze playlist by URL
  const analyzePlaylist = async (url: string) => {
    setAnalyzing(true);
    setError(null);
    setProgress(null);
    
    try {
      const task = await playlistApi.analyze(url, {
        maxVideos,
        mode,
        lang: language
      });
      
      // Start polling
      await pollPlaylistTask(task.task_id);
      
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 
        (language === 'fr' ? "Erreur lors de l'analyse" : "Analysis error");
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };
  
  // Analyze selected videos from discovery - CRÉER UN CORPUS
  const handleSelectVideos = async (videos: VideoCandidate[]) => {
    setShowDiscoveryModal(false);
    setSelectedVideos(videos);
    
    if (videos.length === 0) return;
    
    setAnalyzing(true);
    setError(null);
    setProgress(null);
    
    try {
      // Construire les URLs des vidéos sélectionnées
      const urls = videos.map(v => `https://youtube.com/watch?v=${v.video_id}`);
      
      // Créer un nom de corpus basé sur la recherche
      const corpusName = smartInput.searchQuery 
        ? `Corpus: ${smartInput.searchQuery.substring(0, 50)}`
        : (language === 'fr' ? 'Corpus personnalisé' : 'Custom Corpus');
      
      
      // Lancer l'analyse du corpus via l'API
      const task = await playlistApi.analyzeCorpus(urls, {
        name: corpusName,
        mode,
        lang: language
      });
      
      // Suivre la progression
      await pollPlaylistTask(task.task_id);
      
      // Sauvegarder le dernier corpus analysé
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
  
  // Poll playlist task status
  const pollPlaylistTask = async (taskId: string) => {
    const maxAttempts = 120;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await playlistApi.getStatus(taskId);
        setProgress(status);
        
        if (status.status === 'completed') {
          await refreshUser(true);
          await loadHistory();
          return;
        }
        
        if (status.status === 'failed') {
          throw new Error(status.error || 'Analysis failed');
        }
        
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        
      } catch (err) {
        throw err;
      }
    }
    
    throw new Error('Timeout');
  };
  
  // Navigate to video analysis
  const navigateToAnalysis = (summaryId: number) => {
    navigate(`/dashboard?id=${summaryId}`);
  };
  
  // ═══════════════════════════════════════════════════════════════════
  // COMPUTED
  // ═══════════════════════════════════════════════════════════════════
  
  const isSearchMode = smartInput.mode === 'search';
  const isUrlMode = smartInput.mode === 'url';
  const playlistId = smartInput.url ? extractPlaylistId(smartInput.url) : null;
  
  // Credit estimation
  const estimatedCredits = isSearchMode ? videoCount : maxVideos;
  const hasEnoughCredits = userCredits >= estimatedCredits;
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER: Non-Pro users
  // ═══════════════════════════════════════════════════════════════════
  
  if (!isProUser) {
    return (
      <div className="min-h-screen bg-bg-primary relative">
        <DoodleBackground variant="default" density={50} />
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
        
        <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
          <div className="min-h-screen flex items-center justify-center p-6">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 flex items-center justify-center mx-auto mb-6">
                <Lock className="w-10 h-10 text-amber-500" />
              </div>
              <h2 className="font-display text-2xl text-text-primary mb-3">
                {language === 'fr' ? 'Fonctionnalité Pro' : 'Pro Feature'}
              </h2>
              <p className="text-text-secondary mb-6">
                {language === 'fr'
                  ? 'L\'analyse de playlists et la création de corpus sont réservées aux utilisateurs Pro et Expert.'
                  : 'Playlist analysis and corpus creation are reserved for Pro and Expert users.'}
              </p>
              <button
                onClick={() => navigate('/upgrade')}
                className="btn btn-accent px-8 py-3"
              >
                <Crown className="w-5 h-5" />
                {language === 'fr' ? 'Passer à Pro' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════
  // RENDER: Main
  // ═══════════════════════════════════════════════════════════════════
  
  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <main className={`transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
            
            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HEADER */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
            <header className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <ListVideo className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-2xl text-text-primary">
                    {language === 'fr' ? 'Analyse de corpus' : 'Corpus Analysis'}
                  </h1>
                  <p className="text-text-secondary text-sm">
                    {language === 'fr' 
                      ? 'Playlist YouTube ou recherche intelligente de vidéos'
                      : 'YouTube playlist or intelligent video search'}
                  </p>
                </div>
              </div>
            </header>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* SMART INPUT */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
            <div className="card p-6 mb-6">
              <SmartInputBar
                value={smartInput}
                onChange={setSmartInput}
                onSubmit={handleSubmit}
                loading={analyzing}
                disabled={analyzing}
                userCredits={userCredits}
                language={language as 'fr' | 'en'}
                showLanguageSelector={true}
              />
              
              {/* Options Panel */}
              <div className="mt-4 pt-4 border-t border-border-subtle">
                
                {/* Search Mode: Video Count Slider */}
                {isSearchMode && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-text-primary flex items-center gap-2">
                        <ListPlus className="w-4 h-4 text-violet-400" />
                        {language === 'fr' ? 'Nombre de vidéos à analyser' : 'Number of videos to analyze'}
                      </label>
                      <span className="text-lg font-bold text-violet-400">{videoCount}</span>
                    </div>
                    
                    <div className="relative">
                      <input
                        type="range"
                        min="2"
                        max="20"
                        value={videoCount}
                        onChange={(e) => setVideoCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-bg-tertiary rounded-lg appearance-none cursor-pointer accent-violet-500"
                        style={{
                          background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${((videoCount - 2) / 18) * 100}%, rgb(55, 65, 81) ${((videoCount - 2) / 18) * 100}%, rgb(55, 65, 81) 100%)`
                        }}
                      />
                      {/* All numbers from 2 to 20 */}
                      <div className="flex justify-between text-xs text-text-muted mt-1 px-0.5">
                        {Array.from({ length: 19 }, (_, i) => i + 2).map((n) => (
                          <span 
                            key={n} 
                            className={`cursor-pointer hover:text-violet-400 transition-colors ${n === videoCount ? 'text-violet-400 font-bold' : ''}`}
                            onClick={() => setVideoCount(n)}
                          >
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Credit estimation */}
                    <div className={`flex items-center gap-2 text-sm ${hasEnoughCredits ? 'text-text-secondary' : 'text-red-400'}`}>
                      <Zap className="w-4 h-4" />
                      <span>
                        {language === 'fr' 
                          ? `Coût estimé: ${videoCount} crédits`
                          : `Estimated cost: ${videoCount} credits`}
                      </span>
                      {!hasEnoughCredits && (
                        <span className="text-red-400">
                          ({language === 'fr' ? 'crédits insuffisants' : 'insufficient credits'})
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* URL Mode: Max Videos Selector */}
                {isUrlMode && (
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Max Videos */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">
                        {language === 'fr' ? 'Max vidéos' : 'Max videos'}
                      </span>
                      <select
                        value={maxVideos}
                        onChange={(e) => setMaxVideos(parseInt(e.target.value))}
                        className="bg-bg-tertiary border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary cursor-pointer"
                      >
                        {[5, 10, 15, 20, 30, 50].map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Mode */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Mode</span>
                      <div className="flex rounded-lg bg-bg-tertiary p-1">
                        {MODES.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => setMode(m.id)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                              mode === m.id
                                ? 'bg-bg-elevated text-text-primary shadow-sm'
                                : 'text-text-tertiary hover:text-text-secondary'
                            }`}
                            title={m.desc[language]}
                          >
                            {m.name[language]}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* URL Validation */}
                    {smartInput.url && (
                      <div className={`flex items-center gap-2 text-sm ${playlistId ? 'text-green-500' : 'text-amber-500'}`}>
                        {playlistId ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Playlist: {playlistId.substring(0, 15)}...</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-4 h-4" />
                            <span>{language === 'fr' ? 'URL playlist invalide' : 'Invalid playlist URL'}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* ERROR MESSAGE */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
            {error && (
              <div className="card p-4 mb-6 border-red-500/30 bg-red-500/10">
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
            {/* PROGRESS */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
            {progress && (
              <div className="card p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                  {progress.status === 'completed' ? (
                    <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-400" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">
                      {progress.playlist_title || (language === 'fr' ? 'Analyse en cours...' : 'Analyzing...')}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {progress.current_video || `${progress.completed_videos || 0}/${progress.total_videos || 0} vidéos`}
                    </p>
                  </div>
                  
                  <span className="text-2xl font-bold text-violet-400">
                    {progress.progress_percent || 0}%
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-2 bg-bg-tertiary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${progress.progress_percent || 0}%` }}
                  />
                </div>
                
                {progress.status === 'completed' && (
                  <div className="mt-4 pt-4 border-t border-border-subtle flex items-center gap-3">
                    <button
                      onClick={() => {
                        // Naviguer vers les résultats de la playlist
                        const playlistId = progress.result?.playlist_id || progress.playlist_id;
                        if (playlistId) {
                          navigate(`/history?playlist=${playlistId}`);
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

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* HISTORY */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DISCOVERY MODAL */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      
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
        preSelectTop={videoCount}  // 🆕 Pre-select top videos automatically
        language={language as 'fr' | 'en'}
      />
    </div>
  );
};

export default PlaylistPage;
