/**
 * DEEP SIGHT v5.0 — History Page
 * Historique complet avec chat intégré pour vidéos ET playlists
 * 
 * FONCTIONNALITÉS:
 * - 📹 Onglet Vidéos simples avec chat
 * - 📚 Onglet Playlists/Corpus avec chat corpus
 * - 🔍 Recherche et filtres
 * - 💬 Chat popup universel (vidéo ou playlist)
 * - 🌻 Scores Tournesol
 * - ⏱️ Timecodes cliquables
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Search, Trash2, Play, MessageCircle,
  ChevronRight, Clock, Video, Layers,
  Grid, List, RefreshCw, BarChart2,
  AlertCircle, X, ArrowLeft, BookOpen,
  Maximize2, ExternalLink, Share2, Mic,
  // 🆕 Toolbar icons
  Copy, Check, GraduationCap, Brain, Tags,
  Download, FileText, FileDown, ChevronDown
} from "lucide-react";
import { DeepSightSpinner, DeepSightSpinnerMicro } from "../components/ui";
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from "../hooks/useAuth";
import { Sidebar } from "../components/layout/Sidebar";
import { TournesolMini } from "../components/TournesolWidget";
import { createTimecodeMarkdownComponents } from "../components/TimecodeRenderer";
import { FloatingChatWindow } from "../components/FloatingChatWindow";
import DoodleBackground from '../components/DoodleBackground';
import { SEO } from '../components/SEO';
import { ThumbnailImage } from "../components/ThumbnailImage";
import { EnrichedMarkdown } from "../components/EnrichedMarkdown";
import { ConceptsGlossary } from "../components/ConceptsGlossary";
import { AcademicSourcesPanel } from "../components/academic";
import { YouTubePlayer, YouTubePlayerRef } from "../components/YouTubePlayer";
// 🆕 Toolbar components
import { CitationExport } from "../components/CitationExport";
import { StudyToolsModal } from "../components/StudyToolsModal";
import { KeywordsModal } from "../components/KeywordsModal";
import { AnalysisHub } from "../components/AnalysisHub";
import { videoApi, shareApi, reliabilityApi, chatApi } from "../services/api";
import type { Summary, ReliabilityResult, EnrichedConcept } from "../services/api";
import { normalizePlanId, PLAN_LIMITS } from "../config/planPrivileges";
import { VoiceModal } from "../components/voice/VoiceModal";
import { useVoiceChat } from "../components/voice/useVoiceChat";

// ═══════════════════════════════════════════════════════════════════════════════
// 🌐 API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const BASE_API_URL = import.meta.env.VITE_API_URL || "https://api.deepsightsynthesis.com";
const API_URL = BASE_API_URL.replace(/\/api\/?$/, '') + '/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Détecte la plateforme d'une vidéo.
 * Priorité : champ platform > heuristiques URL/ID
 */
function resolvePlatform(video: { platform?: string; video_id?: string }): 'youtube' | 'tiktok' | 'text' {
  if (video.platform === 'text') return 'text';
  if (video.platform === 'tiktok') return 'tiktok';
  const vid = video.video_id || '';
  if (!vid) return 'youtube';
  if (vid.startsWith('txt_')) return 'text';
  const isYouTubeId = /^[A-Za-z0-9_-]{11}$/.test(vid);
  return isYouTubeId ? 'youtube' : 'tiktok';
}

interface VideoSummary {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  category: string;
  mode: string;
  lang: string;
  word_count: number;
  reliability_score: number;
  is_favorite: boolean;
  has_transcript: boolean;
  created_at: string;
  summary_content?: string;
  transcript_context?: string;
  platform?: 'youtube' | 'tiktok' | 'text';
}

interface PlaylistSummary {
  playlist_id: string;
  playlist_title: string;
  playlist_url: string;
  num_videos: number;
  num_processed: number;
  total_duration: number;
  total_words: number;
  status: string;
  has_meta_analysis: boolean;
  created_at: string;
  completed_at: string;
  thumbnail_url?: string;
}

interface PlaylistVideo {
  id: number;
  video_id: string;
  video_title: string;
  video_channel: string;
  video_duration: number;
  thumbnail_url: string;
  category: string;
  word_count: number;
  playlist_position: number;
}

interface PlaylistVideoDetail extends PlaylistVideo {
  summary_content?: string;
  transcript_context?: string;
  mode?: string;
  lang?: string;
  reliability_score?: number;
}

interface PlaylistDetail {
  playlist_id: string;
  playlist_title: string;
  num_videos: number;
  num_processed: number;
  total_duration: number;
  total_words: number;
  status: string;
  meta_analysis?: string;
  videos: PlaylistVideo[];
}

interface HistoryStats {
  total_videos: number;
  total_playlists: number;
  total_words: number;
  total_duration_formatted: string;
  categories: Record<string, number>;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

type ChatTarget = { type: 'video'; id: number; title: string; videoId: string } | { type: 'playlist'; id: string; title: string } | null;

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const categoryEmoji: Record<string, string> = {
  interview_podcast: "🎙️", interview: "🎙️", podcast: "🎙️",
  vulgarisation: "🔬", science: "🔬", tutoriel: "🎓", tutorial: "🎓",
  cours: "📚", conference: "🎤", documentaire: "🎬", documentary: "🎬",
  debat: "⚖️", debate: "⚖️", journalisme: "📰", news: "📰",
  gaming: "🎮", finance: "💰", review: "⭐", lifestyle: "🏠",
  tech: "💻", health: "🏥", general: "📺", education: "📚", culture: "🎨",
};

const formatDuration = (seconds: number): string => {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatRelativeDate = (dateString: string, lang: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (lang === 'fr') {
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
    return date.toLocaleDateString("fr-FR");
  } else {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString("en-US");
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 API HOOK
// ═══════════════════════════════════════════════════════════════════════════════

const useHistoryApi = () => {
  const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return {
      "Content-Type": "application/json",
      Authorization: token ? `Bearer ${token}` : "",
    };
  };

  const fetchVideos = async (params: {
    page?: number;
    per_page?: number;
    category?: string;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.per_page) queryParams.set("per_page", params.per_page.toString());
    if (params.category && params.category !== "all") queryParams.set("category", params.category);
    if (params.search) queryParams.set("search", params.search);

    const response = await fetch(`${API_URL}/history/videos?${queryParams}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch videos");
    return response.json();
  };

  const fetchPlaylists = async (params: {
    page?: number;
    per_page?: number;
    search?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set("page", params.page.toString());
    if (params.per_page) queryParams.set("per_page", params.per_page.toString());
    if (params.search) queryParams.set("search", params.search);

    const response = await fetch(`${API_URL}/history/playlists?${queryParams}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch playlists");
    return response.json();
  };

  const fetchPlaylistDetail = async (playlistId: string): Promise<PlaylistDetail> => {
    const response = await fetch(`${API_URL}/history/playlists/${playlistId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch playlist detail");
    return response.json();
  };

  const fetchStats = async (): Promise<HistoryStats> => {
    const response = await fetch(`${API_URL}/history/stats`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch stats");
    return response.json();
  };

  const deleteVideo = async (videoId: number) => {
    const response = await fetch(`${API_URL}/history/videos/${videoId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete video");
  };

  const deletePlaylist = async (playlistId: string) => {
    const response = await fetch(`${API_URL}/history/playlists/${playlistId}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete playlist");
  };

  // 🗑️ Supprimer tout l'historique
  const clearAllHistory = async (type: 'all' | 'videos' | 'playlists' = 'all') => {
    const response = await fetch(`${API_URL}/history/clear?type=${type}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to clear history");
    return response.json();
  };

  // Chat API pour vidéos
  const chatWithVideo = async (summaryId: number, message: string, webSearch: boolean = false) => {
    const response = await fetch(`${API_URL}/chat/${summaryId}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, web_search: webSearch }),
    });
    if (!response.ok) throw new Error("Chat failed");
    return response.json();
  };

  // 🆕 Récupérer l'historique du chat vidéo
  const getChatHistoryVideo = async (summaryId: number): Promise<ChatMessage[]> => {
    try {
      const response = await fetch(`${API_URL}/chat/${summaryId}/history`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      // Le backend retourne { messages: [...], quota_info: {...} }
      const messages = data.messages || data || [];
      return messages.map((m: any, i: number) => ({
        id: m.id?.toString() || `history-${i}-${Date.now()}`,
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        web_search_used: m.web_search_used || false,
      }));
    } catch (err) {
      console.error(`❌ [History] Error loading chat history:`, err);
      return [];
    }
  };

  // Chat API pour playlists
  const chatWithPlaylist = async (playlistId: string, message: string, webSearch: boolean = false) => {
    const response = await fetch(`${API_URL}/playlists/${playlistId}/chat`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, web_search: webSearch }),
    });
    if (!response.ok) throw new Error("Chat failed");
    return response.json();
  };

  // 🆕 Récupérer l'historique du chat playlist/corpus
  const getChatHistoryPlaylist = async (playlistId: string): Promise<ChatMessage[]> => {
    try {
      const response = await fetch(`${API_URL}/playlists/${playlistId}/chat/history`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      // Le backend peut retourner { messages: [...] } ou directement [...]
      const messages = data.messages || data || [];
      return messages.map((m: any, i: number) => ({
        id: m.id?.toString() || `history-${i}-${Date.now()}`,
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        web_search_used: m.web_search_used || false,
      }));
    } catch (err) {
      console.error(`❌ [History] Error loading playlist chat history:`, err);
      return [];
    }
  };

  // Récupérer le détail d'une vidéo dans une playlist (avec résumé complet)
  const fetchPlaylistVideoDetail = async (playlistId: string, videoId: string): Promise<PlaylistVideoDetail> => {
    const response = await fetch(`${API_URL}/history/playlists/${playlistId}/videos/${videoId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to fetch video detail");
    return response.json();
  };

  return { 
    fetchVideos, fetchPlaylists, fetchPlaylistDetail, fetchPlaylistVideoDetail,
    fetchStats, deleteVideo, deletePlaylist, clearAllHistory,
    chatWithVideo, chatWithPlaylist,
    getChatHistoryVideo, getChatHistoryPlaylist  // 🆕 Historique du chat
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const History: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { language } = useTranslation();
  const { user } = useAuth();
  const api = useHistoryApi();

  // États
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"videos" | "playlists">("videos");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Données
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [stats, setStats] = useState<HistoryStats | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistDetail | null>(null);
  const [selectedPlaylistVideo, setSelectedPlaylistVideo] = useState<PlaylistVideoDetail | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);

  // Pagination & filtres
  const [videosPage, setVideosPage] = useState(1);
  const [playlistsPage, setPlaylistsPage] = useState(1);
  const [videosTotal, setVideosTotal] = useState(0);
  const [playlistsTotal, setPlaylistsTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const perPage = 12;

  // Chat
  const [chatTarget, setChatTarget] = useState<ChatTarget>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatWebSearch, setChatWebSearch] = useState(false);
  const [wsQuota, setWsQuota] = useState<{ used: number; limit: number; remaining: number } | undefined>(undefined);
  const [, setChatExpanded] = useState(true); // Étendu par défaut
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 🆕 Vue détaillée d'une vidéo inline (au lieu de naviguer vers /dashboard)
  const [selectedVideoDetail, setSelectedVideoDetail] = useState<Summary | null>(null);
  const [loadingVideoDetail, setLoadingVideoDetail] = useState(false);
  const [videoDetailReliability, setVideoDetailReliability] = useState<ReliabilityResult | null>(null);
  const [videoDetailPlayerVisible, setVideoDetailPlayerVisible] = useState(false);
  const [videoDetailPlayerStart, setVideoDetailPlayerStart] = useState(0);
  const videoDetailPlayerRef = useRef<YouTubePlayerRef>(null);
  const upgradeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Toolbar states pour vue détail vidéo
  const [detailCopied, setDetailCopied] = useState(false);
  const [detailShowExportMenu, setDetailShowExportMenu] = useState(false);
  const [detailExporting, setDetailExporting] = useState(false);
  const detailExportBtnRef = useRef<HTMLButtonElement>(null);
  const detailExportMenuRef = useRef<HTMLDivElement>(null);
  const [detailExportMenuPos, setDetailExportMenuPos] = useState({ top: 0, left: 0 });
  // Quick Chat Upgrade states
  const [upgradeMode, setUpgradeMode] = useState<string>('standard');
  const [upgradeDeepResearch, setUpgradeDeepResearch] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeTaskId, setUpgradeTaskId] = useState<string | null>(null);
  const [detailShowCitationModal, setDetailShowCitationModal] = useState(false);
  const [detailShowStudyToolsModal, setDetailShowStudyToolsModal] = useState(false);
  const [detailShowKeywordsModal, setDetailShowKeywordsModal] = useState(false);
  const [detailConcepts, setDetailConcepts] = useState<EnrichedConcept[]>([]);
  const [detailConceptsLoading, setDetailConceptsLoading] = useState(false);
  const [detailConceptsProvider, setDetailConceptsProvider] = useState<string>('none');
  const [detailConceptsCategories, setDetailConceptsCategories] = useState<Record<string, { label: string; icon: string; count: number }>>({});

  // 🎙️ Voice Chat
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const voiceChat = useVoiceChat({ summaryId: selectedVideoDetail?.id ?? 0, language: language as 'fr' | 'en' });
  const voiceEnabled = PLAN_LIMITS[normalizePlanId(user?.plan)].voiceChatEnabled;

  // 🗑️ Clear History Modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearType, setClearType] = useState<'all' | 'videos' | 'playlists'>('all');
  const [clearLoading, setClearLoading] = useState(false);

  const isProUser = normalizePlanId(user?.plan) === 'pro';

  // 📦 Portal Export Menu — position helper
  const calcExportMenuPos = useCallback((btnRef: React.RefObject<HTMLButtonElement | null>) => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      return { top: rect.bottom + 4, left: Math.max(8, rect.right - 176) };
    }
    return { top: 0, left: 0 };
  }, []);

  // 📦 Click-outside + scroll/resize handler for all 3 export menus
  useEffect(() => {
    const anyOpen = detailShowExportMenu || showExportMenu || metaShowExportMenu;
    if (!anyOpen) return;

    const closeAll = () => {
      setDetailShowExportMenu(false);
      setShowExportMenu(false);
      setMetaShowExportMenu(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const refs = [
        { btn: detailExportBtnRef, menu: detailExportMenuRef },
        { btn: exportBtnRef, menu: exportMenuRef },
        { btn: metaExportBtnRef, menu: metaExportMenuRef },
      ];
      for (const { btn, menu } of refs) {
        if (btn.current?.contains(target) || menu.current?.contains(target)) return;
      }
      closeAll();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', closeAll, true);
    window.addEventListener('resize', closeAll);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', closeAll, true);
      window.removeEventListener('resize', closeAll);
    };
  }, [detailShowExportMenu, showExportMenu, metaShowExportMenu]);

  // 🎯 Composants Markdown avec timecodes cliquables (ouvrent YouTube)
  const getTimecodeComponents = useCallback((videoId?: string) => {
    return createTimecodeMarkdownComponents({
      mode: "external",
      videoId: videoId,
      onTimecodeClick: (seconds) => {
        if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`, "_blank");
        }
      },
    });
  }, []);

  // Cleanup upgrade polling interval on unmount
  useEffect(() => {
    return () => {
      if (upgradeIntervalRef.current !== null) {
        clearInterval(upgradeIntervalRef.current);
      }
    };
  }, []);

  // URL params
  useEffect(() => {
    const playlistParam = searchParams.get('playlist');
    if (playlistParam) {
      setActiveTab('playlists');
      loadPlaylistDetail(playlistParam);
    }
  }, [searchParams]);

  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const videosRes = await api.fetchVideos({
        page: videosPage,
        per_page: perPage,
        category: selectedCategory,
        search: searchQuery,
      });

      setVideos(videosRes.items || videosRes);
      setVideosTotal(videosRes.total || videosRes.length);

      // Stats non-bloquantes : un échec n'empêche pas l'affichage
      try {
        const statsRes = await api.fetchStats();
        setStats(statsRes);
      } catch {
        // Stats indisponibles — on continue sans
      }

      // Charger les playlists pour tous les utilisateurs (affichage de l'historique)
      try {
        const playlistsRes = await api.fetchPlaylists({
          page: playlistsPage,
          per_page: perPage,
          search: searchQuery,
        });
        setPlaylists(playlistsRes.items || playlistsRes);
        setPlaylistsTotal(playlistsRes.total || playlistsRes.length);
      } catch {
        setPlaylists([]);
        setPlaylistsTotal(0);
      }
    } catch (err) {
      console.error("History load error:", err);
      setError(language === 'fr' ? "Erreur réseau — Impossible de charger l'historique" : "Network error — Unable to load history");
    } finally {
      setLoading(false);
    }
  }, [videosPage, playlistsPage, selectedCategory, searchQuery, language]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Charger détails playlist
  const loadPlaylistDetail = async (playlistId: string) => {
    try {
      setSelectedPlaylistVideo(null); // Reset vidéo sélectionnée
      const detail = await api.fetchPlaylistDetail(playlistId);
      setSelectedPlaylist(detail);
    } catch (err) {
      console.error("Playlist detail error:", err);
    }
  };

  // Charger détails d'une vidéo de playlist
  const loadPlaylistVideoDetail = async (playlistId: string, videoId: string) => {
    setLoadingVideo(true);
    try {
      const videoDetail = await api.fetchPlaylistVideoDetail(playlistId, videoId);
      setSelectedPlaylistVideo(videoDetail);
    } catch (err) {
      console.error("Video detail error:", err);
      setError(language === 'fr' ? "Erreur lors du chargement de la vidéo" : "Error loading video");
    } finally {
      setLoadingVideo(false);
    }
  };

  // Handlers — 🆕 Affichage inline au lieu de naviguer vers /dashboard
  const handleViewVideo = async (video: VideoSummary) => {
    setLoadingVideoDetail(true);
    setVideoDetailPlayerVisible(false);
    setVideoDetailReliability(null);
    try {
      const summary = await videoApi.getSummary(video.id);
      setSelectedVideoDetail(summary);
      // Charger reliability en arrière-plan
      reliabilityApi.getReliability(video.id).then(setVideoDetailReliability).catch(() => {});
    } catch (err) {
      console.error('Error loading video detail:', err);
      setError(language === 'fr' ? "Erreur lors du chargement de l'analyse" : "Error loading analysis");
    } finally {
      setLoadingVideoDetail(false);
    }
  };

  const handleBackFromVideoDetail = () => {
    setSelectedVideoDetail(null);
    setVideoDetailReliability(null);
    setVideoDetailPlayerVisible(false);
    setDetailCopied(false);
    setDetailConcepts([]);
  };

  const handleUpgradeQuickChat = async () => {
    if (!selectedVideoDetail) return;
    setUpgradeLoading(true);
    try {
      const response = await videoApi.upgradeQuickChat(
        selectedVideoDetail.id,
        upgradeMode,
        upgradeDeepResearch
      );
      setUpgradeTaskId(response.task_id);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await videoApi.getTaskStatus(response.task_id);
          if (status.status === 'completed' || status.status === 'done') {
            clearInterval(pollInterval);
            upgradeIntervalRef.current = null;
            // Reload the summary
            const updated = await videoApi.getSummary(selectedVideoDetail.id);
            setSelectedVideoDetail({...selectedVideoDetail, ...updated, summary_content: updated.summary_content});
            setUpgradeLoading(false);
            setUpgradeTaskId(null);
          } else if (status.status === 'error' || status.status === 'failed') {
            clearInterval(pollInterval);
            upgradeIntervalRef.current = null;
            setUpgradeLoading(false);
            setUpgradeTaskId(null);
          }
        } catch (e) {
          // Keep polling on transient network errors
        }
      }, 5000);
      upgradeIntervalRef.current = pollInterval;
    } catch (err: any) {
      setError(err?.message || 'Upgrade failed');
      setUpgradeLoading(false);
    }
  };

  const handleDetailTimecodeClick = useCallback((seconds: number) => {
    if (videoDetailPlayerVisible && videoDetailPlayerRef.current) {
      videoDetailPlayerRef.current.seekTo(seconds);
    } else {
      setVideoDetailPlayerStart(seconds);
      setVideoDetailPlayerVisible(true);
    }
  }, [videoDetailPlayerVisible]);

  const handleDetailCopy = async () => {
    if (!selectedVideoDetail?.summary_content) return;
    await navigator.clipboard.writeText(selectedVideoDetail.summary_content);
    setDetailCopied(true);
    setTimeout(() => setDetailCopied(false), 2000);
  };

  const handleDetailExport = async (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedVideoDetail?.id) return;
    setDetailExporting(true);
    setDetailShowExportMenu(false);
    const formatMap: Record<string, 'pdf' | 'markdown' | 'text'> = { pdf: 'pdf', md: 'markdown', txt: 'text' };
    try {
      const blob = await videoApi.exportSummary(selectedVideoDetail.id, formatMap[format]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedVideoDetail.video_title || 'analyse'}.${format === 'md' ? 'md' : format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setDetailExporting(false);
    }
  };

  const handleDetailOpenKeywords = () => {
    setDetailShowKeywordsModal(true);
    if (selectedVideoDetail?.id) {
      setDetailConceptsLoading(true);
      videoApi.getEnrichedConcepts(selectedVideoDetail.id).then(data => {
        setDetailConcepts(data.concepts || []);
        setDetailConceptsProvider(data.provider || 'none');
        setDetailConceptsCategories(data.categories || {});
      }).catch(() => {
        setDetailConcepts([]);
      }).finally(() => setDetailConceptsLoading(false));
    }
  };

  const handleOpenVideoChat = async (video: VideoSummary) => {
    setChatTarget({ type: 'video', id: video.id, title: video.video_title, videoId: video.video_id });
    setChatExpanded(true);
    // 🆕 Charger l'historique existant au lieu d'effacer
    setChatLoading(true);
    try {
      const history = await api.getChatHistoryVideo(video.id);
      setChatMessages(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenPlaylistVideoChat = async (video: PlaylistVideo | PlaylistVideoDetail) => {
    setChatTarget({ type: 'video', id: video.id, title: video.video_title, videoId: video.video_id });
    setChatExpanded(true);
    // 🆕 Charger l'historique existant au lieu d'effacer
    setChatLoading(true);
    try {
      const history = await api.getChatHistoryVideo(video.id);
      setChatMessages(history);
    } catch (err) {
      console.error('Error loading chat history:', err);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenPlaylistChat = (playlist: PlaylistSummary) => {
    // Naviguer vers PlaylistDetailPage avec l'onglet Chat actif
    // → UN SEUL endroit pour le Chat Corpus (pas de doublon)
    navigate(`/playlist/${playlist.playlist_id}?tab=chat`);
  };

  const handleViewPlaylist = (playlist: PlaylistSummary) => {
    loadPlaylistDetail(playlist.playlist_id);
  };

  const handleViewPlaylistVideo = (video: PlaylistVideo) => {
    if (selectedPlaylist) {
      loadPlaylistVideoDetail(selectedPlaylist.playlist_id, video.video_id);
    }
  };

  const handleBackToPlaylistVideos = () => {
    setSelectedPlaylistVideo(null);
  };

  const handleDeleteVideo = async (video: VideoSummary) => {
    if (!confirm(language === 'fr' ? 'Supprimer cette analyse ?' : 'Delete this analysis?')) return;
    try {
      await api.deleteVideo(video.id);
      setVideos(prev => prev.filter(v => v.id !== video.id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleShareVideo = async (video: VideoSummary) => {
    try {
      const { share_url } = await shareApi.createShareLink(video.video_id);
      if (navigator.share) {
        await navigator.share({
          title: `DeepSight — ${video.video_title}`,
          url: share_url,
        });
      } else {
        await navigator.clipboard.writeText(share_url);
        // Brief visual feedback handled by the button
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      try {
        const { share_url } = await shareApi.createShareLink(video.video_id);
        await navigator.clipboard.writeText(share_url);
      } catch {
        console.error("Share error");
      }
    }
  };

  const handleDeletePlaylist = async (playlist: PlaylistSummary) => {
    if (!confirm(language === 'fr' ? 'Supprimer cette playlist ?' : 'Delete this playlist?')) return;
    try {
      await api.deletePlaylist(playlist.playlist_id);
      setPlaylists(prev => prev.filter(p => p.playlist_id !== playlist.playlist_id));
      if (selectedPlaylist?.playlist_id === playlist.playlist_id) {
        setSelectedPlaylist(null);
        setSelectedPlaylistVideo(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // 🗑️ Clear All History Handler
  const handleClearHistory = async () => {
    setClearLoading(true);
    try {
      await api.clearAllHistory(clearType);
      
      // Reset les données selon le type
      if (clearType === 'all' || clearType === 'videos') {
        setVideos([]);
        setVideosTotal(0);
      }
      if (clearType === 'all' || clearType === 'playlists') {
        setPlaylists([]);
        setPlaylistsTotal(0);
        setSelectedPlaylist(null);
        setSelectedPlaylistVideo(null);
      }
      
      // Recharger les stats
      const newStats = await api.fetchStats();
      setStats(newStats);
      
      setShowClearModal(false);
    } catch (err) {
      console.error("Clear history error:", err);
      setError(language === 'fr' ? "Erreur lors de la suppression" : "Error clearing history");
    } finally {
      setClearLoading(false);
    }
  };

  // Chat handler - accepte un message en paramètre ou utilise chatInput
  const handleSendChat = async (messageParam?: string, options?: { useWebSearch?: boolean }) => {
    const message = messageParam || chatInput;
    if (!message.trim() || !chatTarget || chatLoading) return;

    const forceWebSearch = options?.useWebSearch === true;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: message,
    };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      let response;
      if (chatTarget.type === 'video') {
        response = await api.chatWithVideo(chatTarget.id, message, forceWebSearch || chatWebSearch);
      } else {
        response = await api.chatWithPlaylist(chatTarget.id, message, forceWebSearch || chatWebSearch);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response || response.message || "Pas de réponse",
        sources: response.sources,
        web_search_used: response.web_search_used,
      };
      setChatMessages(prev => [...prev, assistantMessage]);

      // Mettre à jour web search quota si disponible
      if (response.quota_info) {
        const qi = response.quota_info as Record<string, unknown>;
        if (typeof qi.web_search_used === 'number' && typeof qi.web_search_limit === 'number') {
          setWsQuota({
            used: qi.web_search_used as number,
            limit: qi.web_search_limit as number,
            remaining: (qi.web_search_remaining as number) ?? Math.max(0, (qi.web_search_limit as number) - (qi.web_search_used as number)),
          });
        }
      }
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ ${err.message || 'Erreur de chat'}`,
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO title="Historique" path="/history" />
      <DoodleBackground variant="video" />
      {/* Hamburger mobile */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      <main className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-8 pt-14 lg:pt-8">
          <div className="max-w-6xl mx-auto">
            
            {/* Header */}
            <header className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h1 className="font-semibold text-xl sm:text-2xl mb-2 text-text-primary">
                    {language === 'fr' ? 'Historique' : 'History'}
                  </h1>
                  <p className="text-text-secondary text-sm">
                    {language === 'fr' 
                      ? 'Retrouvez toutes vos analyses passées.'
                      : 'Find all your past analyses.'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowClearModal(true)}
                    className="btn btn-ghost text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title={language === 'fr' ? 'Supprimer l\'historique' : 'Clear history'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={loadData}
                    className="btn btn-ghost"
                    disabled={loading}
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent-primary-muted flex items-center justify-center">
                        <Video className="w-5 h-5 text-accent-primary" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-semibold text-text-primary">{stats.total_videos}</p>
                        <p className="text-xs text-text-tertiary">{language === 'fr' ? 'Vidéos' : 'Videos'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-semibold text-text-primary">{stats.total_playlists}</p>
                        <p className="text-xs text-text-tertiary">Playlists</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <BarChart2 className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-semibold text-text-primary">
                          {(stats.total_words / 1000).toFixed(0)}k
                        </p>
                        <p className="text-xs text-text-tertiary">{language === 'fr' ? 'Mots' : 'Words'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-lg sm:text-2xl font-semibold text-text-primary">
                          {stats.total_duration_formatted || '0h'}
                        </p>
                        <p className="text-xs text-text-tertiary">{language === 'fr' ? 'Durée' : 'Duration'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabs - Séparation claire Vidéos / Playlists */}
              <div className="flex items-center gap-2 border-b border-border-subtle">
                <button
                  onClick={() => { setActiveTab("videos"); setSelectedPlaylist(null); }}
                  className={`pb-3 px-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                    activeTab === "videos"
                      ? "border-blue-500 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    activeTab === "videos" 
                      ? "bg-blue-500 text-white" 
                      : "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  }`}>
                    <Video className="w-3.5 h-3.5" />
                  </div>
                  <span>{language === 'fr' ? 'Vidéos' : 'Videos'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === "videos"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      : "bg-bg-tertiary text-text-muted"
                  }`}>
                    {stats?.total_videos || 0}
                  </span>
                </button>
                {/* Onglet Playlists - Toujours visible */}
                <button
                  onClick={() => setActiveTab("playlists")}
                  className={`pb-3 px-4 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                    activeTab === "playlists"
                      ? "border-purple-500 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-text-tertiary hover:text-text-primary"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                    activeTab === "playlists"
                      ? "bg-purple-500 text-white"
                      : "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                  }`}>
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span>Playlists</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === "playlists"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                      : "bg-bg-tertiary text-text-muted"
                  }`}>
                    {stats?.total_playlists || 0}
                  </span>
                  {!isProUser && (
                    <span className="badge bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs border-0">Pro</span>
                  )}
                </button>
              </div>
            </header>

            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === 'fr' ? 'Rechercher...' : 'Search...'}
                  className="input pl-10 w-full"
                />
              </div>
              {activeTab === "videos" && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="input w-full sm:w-48"
                >
                  <option value="all">{language === 'fr' ? 'Toutes catégories' : 'All categories'}</option>
                  <option value="interview_podcast">🎙️ Interview/Podcast</option>
                  <option value="science">🔬 Science</option>
                  <option value="tech">💻 Tech</option>
                  <option value="education">📚 Education</option>
                  <option value="finance">💰 Finance</option>
                  <option value="culture">🎨 Culture</option>
                </select>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-accent-primary text-white" : "bg-bg-secondary text-text-tertiary"}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg ${viewMode === "list" ? "bg-accent-primary text-white" : "bg-bg-secondary text-text-tertiary"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error — affiché uniquement pour les vraies erreurs réseau/serveur */}
            {error && (
              <div className="card p-4 mb-6 border-error/30 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
                  <p className="text-text-primary flex-1">{error}</p>
                  <button
                    onClick={loadData}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 transition-colors text-sm font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {language === 'fr' ? 'Réessayer' : 'Retry'}
                  </button>
                  <button onClick={() => setError(null)} className="flex-shrink-0">
                    <X className="w-4 h-4 text-text-tertiary hover:text-text-primary" />
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            {loading || loadingVideoDetail ? (
              <div className="flex items-center justify-center py-20">
                <DeepSightSpinner size="md" />
              </div>
            ) : activeTab === "videos" && selectedVideoDetail ? (
              /* ═══ VUE DÉTAILLÉE VIDÉO INLINE ═══ */
              <section className="animate-fadeIn">
                {/* Bouton retour */}
                <button
                  onClick={handleBackFromVideoDetail}
                  className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">
                    {language === 'fr' ? 'Retour à l\'historique' : 'Back to history'}
                  </span>
                </button>

                <div className="space-y-6">
                  {/* Video Info Card */}
                  <div className="card overflow-hidden">
                    <div className="flex flex-col lg:flex-row">
                      {/* Thumbnail / Player */}
                      <div className="w-full lg:w-96 flex-shrink-0 relative bg-bg-tertiary">
                        {videoDetailPlayerVisible ? (
                          <div className="relative aspect-video">
                            <YouTubePlayer
                              ref={videoDetailPlayerRef}
                              videoId={selectedVideoDetail.video_id}
                              initialTime={videoDetailPlayerStart}
                              className="w-full h-full"
                            />
                            <button
                              onClick={() => setVideoDetailPlayerVisible(false)}
                              className="absolute top-2 right-2 w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-bg-primary/80 backdrop-blur flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                            >
                              <X className="w-5 h-5 sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="aspect-video relative cursor-pointer group"
                            onClick={() => setVideoDetailPlayerVisible(true)}
                          >
                            <ThumbnailImage
                              thumbnailUrl={selectedVideoDetail.thumbnail_url}
                              videoId={selectedVideoDetail.video_id}
                              title={selectedVideoDetail.video_title}
                              category={selectedVideoDetail.category}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                <Play className="w-6 h-6 sm:w-7 sm:h-7 text-bg-primary ml-1" />
                              </div>
                            </div>
                            <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                              {formatDuration(selectedVideoDetail.video_duration || 0)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h2 className="font-semibold text-lg sm:text-xl leading-tight text-text-primary line-clamp-2">
                            {selectedVideoDetail.video_title}
                          </h2>
                          <a
                            href={`https://youtube.com/watch?v=${selectedVideoDetail.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-text-tertiary hover:text-accent-primary transition-colors p-1"
                          >
                            <ExternalLink className="w-5 h-5" />
                          </a>
                        </div>
                        <p className="text-text-secondary text-xs sm:text-sm mb-3">
                          {selectedVideoDetail.video_channel}
                        </p>
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3">
                          <span className="badge">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(selectedVideoDetail.video_duration || 0)}
                          </span>
                          {selectedVideoDetail.category && (
                            <span className="badge badge-primary">
                              {categoryEmoji[selectedVideoDetail.category] || '📺'} {selectedVideoDetail.category}
                            </span>
                          )}
                          <span className="badge">{selectedVideoDetail.mode || 'standard'}</span>
                        </div>
                        <div className="pt-3 border-t border-border-subtle">
                          <TournesolMini videoId={selectedVideoDetail.video_id} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Content */}
                  {selectedVideoDetail.mode === 'quick_chat' && !selectedVideoDetail.summary_content ? (
                    /* Quick Chat Upgrade Panel */
                    <div className="card p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-text-primary">
                            {language === 'fr' ? 'Quick Chat — Pas encore d\'analyse' : 'Quick Chat — No analysis yet'}
                          </h3>
                          <p className="text-sm text-text-tertiary">
                            {language === 'fr' ? 'Vous pouvez generer une analyse complete pour cette video' : 'You can generate a full analysis for this video'}
                          </p>
                        </div>
                      </div>

                      {/* Mode selector */}
                      <div className="mb-4">
                        <label className="text-sm font-medium text-text-secondary mb-2 block">
                          {language === 'fr' ? 'Mode d\'analyse' : 'Analysis mode'}
                        </label>
                        <div className="flex gap-2">
                          {['accessible', 'standard', 'expert'].map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setUpgradeMode(m)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${upgradeMode === m ? 'bg-accent-primary text-white shadow-md' : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}`}
                            >
                              {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Deep Research toggle */}
                      <div className="mb-5 flex items-center justify-between p-3 rounded-lg bg-bg-secondary">
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {language === 'fr' ? 'Recherche approfondie' : 'Deep Research'}
                          </p>
                          <p className="text-xs text-text-tertiary">
                            {language === 'fr' ? 'Sources externes + fact-checking avance' : 'External sources + advanced fact-checking'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setUpgradeDeepResearch(!upgradeDeepResearch)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${upgradeDeepResearch ? 'bg-accent-primary' : 'bg-bg-tertiary'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${upgradeDeepResearch ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {/* Generate button */}
                      <button
                        type="button"
                        onClick={handleUpgradeQuickChat}
                        disabled={upgradeLoading}
                        className="w-full py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 bg-gradient-to-r from-accent-primary to-blue-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {upgradeLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {language === 'fr' ? 'Analyse en cours...' : 'Analyzing...'}
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            {language === 'fr' ? 'Generer l\'analyse complete (1 credit)' : 'Generate full analysis (1 credit)'}
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                  <AnalysisHub
                    selectedSummary={selectedVideoDetail as any}
                    reliabilityData={videoDetailReliability}
                    reliabilityLoading={false}
                    user={{ plan: user?.plan, credits: 0 }}
                    language={language as 'fr' | 'en'}
                    concepts={[]}
                    onTimecodeClick={handleDetailTimecodeClick}
                    onOpenChat={(msg) => handleOpenVideoChat({ id: selectedVideoDetail.id, video_id: selectedVideoDetail.video_id, video_title: selectedVideoDetail.video_title } as VideoSummary)}
                    onNavigate={navigate}
                    enabledTabs={['synthesis']}
                    showKeywords
                    showStudyTools
                    showVoice
                    voiceEnabled={voiceEnabled}
                    onOpenVoice={() => setIsVoiceModalOpen(true)}
                  />
                  )}
                </div>

                {/* Chat FAB pour la vue detail */}
                {!chatTarget && (
                  <button
                    onClick={() => handleOpenVideoChat({ id: selectedVideoDetail.id, video_id: selectedVideoDetail.video_id, video_title: selectedVideoDetail.video_title } as VideoSummary)}
                    aria-label={language === 'fr' ? 'Ouvrir le chat IA' : 'Open AI chat'}
                    className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] h-[52px] px-5 rounded-[26px] border-none cursor-pointer flex items-center gap-2 text-white font-bold text-sm bg-gradient-to-br from-[#00BCD4] to-[#00ACC1] shadow-lg hover:scale-105 transition-transform"
                  >
                    <MessageCircle size={20} />
                    <span>Chat IA</span>
                  </button>
                )}

                {/* Voice Modal pour la vue détail (géré par parent car state audio complexe) */}
                {selectedVideoDetail && (
                  <>
                    <VoiceModal
                      isOpen={isVoiceModalOpen}
                      onClose={() => {
                        setIsVoiceModalOpen(false);
                        voiceChat.stop();
                      }}
                      videoTitle={selectedVideoDetail.video_title || 'Vidéo'}
                      channelName={selectedVideoDetail.video_channel || ''}
                      voiceStatus={voiceChat.status}
                      isSpeaking={voiceChat.isSpeaking}
                      messages={voiceChat.messages}
                      elapsedSeconds={voiceChat.elapsedSeconds}
                      remainingMinutes={voiceChat.remainingMinutes}
                      onStart={voiceChat.start}
                      onStop={voiceChat.stop}
                      onMuteToggle={voiceChat.toggleMute}
                      isMuted={voiceChat.isMuted}
                      error={voiceChat.error ?? undefined}
                    />
                  </>
                )}
              </section>
            ) : activeTab === "videos" ? (
              <section>
                {/* Section Header Vidéos */}
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800/50">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Video className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-text-primary flex items-center gap-2">
                      {language === 'fr' ? 'Vidéos individuelles' : 'Individual Videos'}
                      <span className="text-sm font-normal text-blue-600 dark:text-blue-400">
                        ({videos.length} {language === 'fr' ? 'analyses' : 'analyses'})
                      </span>
                    </h2>
                    <p className="text-xs text-text-tertiary">
                      {language === 'fr'
                        ? 'Analyses de vidéos YouTube & TikTok • Synthèses avec timestamps'
                        : 'YouTube & TikTok video analyses • Summaries with timestamps'}
                    </p>
                  </div>
                </div>

                {videos.length === 0 ? (
                <div className="card p-12 text-center border-dashed border-2 border-blue-200 dark:border-blue-800/50 bg-blue-50/30 dark:bg-blue-900/10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                    <Video className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {language === 'fr' ? 'Aucune vidéo analysée' : 'No videos analyzed'}
                  </h3>
                  <p className="text-text-secondary text-sm mb-4">
                    {language === 'fr' ? 'Analysez votre première vidéo YouTube ou TikTok !' : 'Analyze your first YouTube or TikTok video!'}
                  </p>
                  <button onClick={() => navigate('/dashboard')} className="btn bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90">
                    <Video className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Analyser une vidéo' : 'Analyze a video'}
                  </button>
                </div>
              ) : (
                <div className={viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-3"
                }>
                  {videos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      viewMode={viewMode}
                      language={language}
                      onView={() => handleViewVideo(video)}
                      onChat={() => handleOpenVideoChat(video)}
                      onDelete={() => handleDeleteVideo(video)}
                      onShare={() => handleShareVideo(video)}
                    />
                  ))}
                </div>
              )}
              </section>
            ) : selectedPlaylist ? (
              <PlaylistDetailView
                playlist={selectedPlaylist}
                selectedVideo={selectedPlaylistVideo}
                loadingVideo={loadingVideo}
                language={language}
                onBack={() => { setSelectedPlaylist(null); setSelectedPlaylistVideo(null); }}
                onBackToVideos={handleBackToPlaylistVideos}
                onChat={() => handleOpenPlaylistChat({ ...selectedPlaylist, playlist_url: '', completed_at: '', thumbnail_url: '', has_meta_analysis: false, created_at: new Date().toISOString() })}
                onViewVideo={handleViewPlaylistVideo}
                onChatVideo={handleOpenPlaylistVideoChat}
              />
            ) : (
              <section>
                {/* Section Header Playlists */}
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800/50">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-semibold text-lg text-text-primary flex items-center gap-2">
                      {language === 'fr' ? 'Playlists & Corpus' : 'Playlists & Corpus'}
                      <span className="text-sm font-normal text-purple-600 dark:text-purple-400">
                        ({playlists.length} {language === 'fr' ? 'collections' : 'collections'})
                      </span>
                      <span className="badge bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs border-0">Pro</span>
                    </h2>
                    <p className="text-xs text-text-tertiary">
                      {language === 'fr' 
                        ? 'Collections de vidéos avec méta-analyse globale • Chat corpus intelligent' 
                        : 'Video collections with global meta-analysis • Intelligent corpus chat'}
                    </p>
                  </div>
                </div>

                {playlists.length === 0 ? (
                <div className="card p-12 text-center border-dashed border-2 border-purple-200 dark:border-purple-800/50 bg-purple-50/30 dark:bg-purple-900/10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/20">
                    <Layers className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    {language === 'fr' ? 'Aucune playlist analysée' : 'No playlists analyzed'}
                  </h3>
                  <p className="text-text-secondary text-sm mb-4">
                    {language === 'fr' ? 'Analysez votre première playlist YouTube pour une méta-analyse complète !' : 'Analyze your first YouTube playlist for a complete meta-analysis!'}
                  </p>
                  <button onClick={() => navigate('/debate')} className="btn bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
                    <Layers className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Lancer un Débat IA' : 'Start an AI Debate'}
                  </button>
                </div>
              ) : (
                <div className={viewMode === "grid" 
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" 
                  : "space-y-3"
                }>
                  {playlists.map((playlist) => (
                    <PlaylistCard
                      key={playlist.playlist_id}
                      playlist={playlist}
                      language={language}
                      onView={() => handleViewPlaylist(playlist)}
                      onChat={() => handleOpenPlaylistChat(playlist)}
                      onDelete={() => handleDeletePlaylist(playlist)}
                    />
                  ))}
                </div>
              )}
              </section>
            )}

            {/* Pagination */}
            {!selectedPlaylist && ((activeTab === "videos" && videosTotal > perPage) || (activeTab === "playlists" && playlistsTotal > perPage)) && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => activeTab === "videos" ? setVideosPage(p => Math.max(1, p - 1)) : setPlaylistsPage(p => Math.max(1, p - 1))}
                  disabled={(activeTab === "videos" ? videosPage : playlistsPage) === 1}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  {language === 'fr' ? 'Précédent' : 'Previous'}
                </button>
                <span className="text-text-tertiary text-sm">
                  Page {activeTab === "videos" ? videosPage : playlistsPage} / {Math.ceil((activeTab === "videos" ? videosTotal : playlistsTotal) / perPage)}
                </span>
                <button
                  onClick={() => activeTab === "videos" ? setVideosPage(p => p + 1) : setPlaylistsPage(p => p + 1)}
                  disabled={(activeTab === "videos" ? videosPage : playlistsPage) >= Math.ceil((activeTab === "videos" ? videosTotal : playlistsTotal) / perPage)}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  {language === 'fr' ? 'Suivant' : 'Next'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 🆕 Chat Popup Flottant - Draggable & Resizable */}
      {chatTarget && (
        <FloatingChatWindow
          isOpen={!!chatTarget}
          onClose={() => setChatTarget(null)}
          title={chatTarget.type === 'playlist' ? 'Chat Corpus' : 'Chat IA'}
          subtitle={chatTarget.title}
          type={chatTarget.type}
          messages={chatMessages}
          isLoading={chatLoading}
          webSearchEnabled={chatWebSearch}
          onToggleWebSearch={setChatWebSearch}
          onSendMessage={handleSendChat}
          markdownComponents={chatTarget?.type === 'video' ? getTimecodeComponents(chatTarget.videoId) : undefined}
          language={language as 'fr' | 'en'}
          storageKey={`history-chat-${chatTarget.type}`}
          userPlan={user?.plan || 'free'}
          webSearchQuota={wsQuota}
          onUpgrade={() => navigate('/pricing')}
        />
      )}

      {/* 🗑️ Modal de suppression de l'historique */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !clearLoading && setShowClearModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-bg-primary rounded-2xl shadow-2xl border border-border-subtle max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-text-primary">
                  {language === 'fr' ? 'Supprimer l\'historique' : 'Clear History'}
                </h3>
                <p className="text-sm text-text-tertiary">
                  {language === 'fr' ? 'Cette action est irréversible' : 'This action cannot be undone'}
                </p>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 mb-6">
              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                clearType === 'all' 
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20' 
                  : 'border-border-subtle hover:border-red-300 dark:hover:border-red-800'
              }`}>
                <input
                  type="radio"
                  name="clearType"
                  checked={clearType === 'all'}
                  onChange={() => setClearType('all')}
                  className="w-4 h-4 text-red-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">
                    {language === 'fr' ? 'Tout supprimer' : 'Delete everything'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {language === 'fr' 
                      ? `${stats?.total_videos || 0} vidéos + ${stats?.total_playlists || 0} playlists`
                      : `${stats?.total_videos || 0} videos + ${stats?.total_playlists || 0} playlists`}
                  </p>
                </div>
                <AlertCircle className="w-5 h-5 text-red-500" />
              </label>

              <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                clearType === 'videos' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                  : 'border-border-subtle hover:border-blue-300 dark:hover:border-blue-800'
              }`}>
                <input
                  type="radio"
                  name="clearType"
                  checked={clearType === 'videos'}
                  onChange={() => setClearType('videos')}
                  className="w-4 h-4 text-blue-500"
                />
                <div className="flex-1">
                  <p className="font-medium text-text-primary">
                    {language === 'fr' ? 'Vidéos uniquement' : 'Videos only'}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {stats?.total_videos || 0} {language === 'fr' ? 'vidéos' : 'videos'}
                  </p>
                </div>
                <Video className="w-5 h-5 text-blue-500" />
              </label>

              {isProUser && (
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  clearType === 'playlists' 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                    : 'border-border-subtle hover:border-purple-300 dark:hover:border-purple-800'
                }`}>
                  <input
                    type="radio"
                    name="clearType"
                    checked={clearType === 'playlists'}
                    onChange={() => setClearType('playlists')}
                    className="w-4 h-4 text-purple-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">
                      {language === 'fr' ? 'Playlists uniquement' : 'Playlists only'}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {stats?.total_playlists || 0} playlists
                    </p>
                  </div>
                  <Layers className="w-5 h-5 text-purple-500" />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearLoading}
                className="flex-1 btn btn-secondary"
              >
                {language === 'fr' ? 'Annuler' : 'Cancel'}
              </button>
              <button
                onClick={handleClearHistory}
                disabled={clearLoading}
                className="flex-1 btn bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {clearLoading ? (
                  <DeepSightSpinnerMicro />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Supprimer' : 'Delete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const VideoCard: React.FC<{
  video: VideoSummary;
  viewMode: "grid" | "list";
  language: string;
  onView: () => void;
  onChat: () => void;
  onDelete: () => void;
  onShare: () => void;
}> = ({ video, viewMode, language, onView, onChat, onDelete, onShare }) => {
  const emoji = categoryEmoji[video.category] || "📺";

  if (viewMode === "list") {
    return (
      <div className="card p-3 hover:border-accent-primary/30 transition-all group">
        <div className="flex items-center gap-4">
          <div 
            className="w-32 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-bg-tertiary relative cursor-pointer"
            onClick={onView}
          >
            <ThumbnailImage
              thumbnailUrl={video.thumbnail_url}
              videoId={video.video_id}
              title={video.video_title}
              category={video.category}
              className="w-full h-full object-cover"
            />
            {/* Platform badge */}
            <span className="absolute top-1 left-1 z-10">
              {resolvePlatform(video) === 'tiktok' ? (
                <img src="/platforms/tiktok-note-color.svg" alt="TikTok" className="w-4 h-4 drop-shadow-md" />
              ) : resolvePlatform(video) === 'text' ? (
                <span className="flex items-center justify-center w-4 h-4 rounded bg-gray-500/60 backdrop-blur-sm">
                  <FileText className="w-3 h-3 text-white" />
                </span>
              ) : (
                <img src="/platforms/youtube-icon-red.svg" alt="YouTube" className="w-4 h-4 drop-shadow-md" />
              )}
            </span>
            <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs">
              {formatDuration(video.video_duration)}
            </div>
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Play className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onView}>
            <h3 className="font-medium text-text-primary line-clamp-1 group-hover:text-accent-primary transition-colors">
              {video.video_title}
            </h3>
            <p className="text-sm text-text-tertiary">{video.video_channel}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-text-muted">{emoji} {video.category}</span>
              <span className="text-xs text-text-muted">• {formatRelativeDate(video.created_at, language)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TournesolMini videoId={video.video_id} />
            <button
              onClick={(e) => { e.stopPropagation(); onChat(); }}
              className="p-2 rounded-lg text-text-tertiary hover:text-accent-primary hover:bg-accent-primary-muted transition-colors"
              title={language === 'fr' ? 'Ouvrir le chat' : 'Open chat'}
            >
              <MessageCircle className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="p-2 rounded-lg text-text-tertiary hover:text-accent-primary hover:bg-accent-primary-muted transition-colors"
              title={language === 'fr' ? 'Partager' : 'Share'}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 rounded-lg text-text-tertiary hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden hover:border-accent-primary/30 transition-all group">
      <div className="relative aspect-video bg-bg-tertiary cursor-pointer" onClick={onView}>
        <ThumbnailImage
          thumbnailUrl={video.thumbnail_url}
          videoId={video.video_id}
          title={video.video_title}
          category={video.category}
          className="w-full h-full object-cover"
        />
        {/* Platform badge */}
        <span className="absolute top-2 left-2 z-10">
          {resolvePlatform(video) === 'tiktok' ? (
            <img src="/platforms/tiktok-note-color.svg" alt="TikTok" className="w-5 h-5 drop-shadow-md" />
          ) : resolvePlatform(video) === 'text' ? (
            <span className="flex items-center justify-center w-5 h-5 rounded bg-gray-500/60 backdrop-blur-sm">
              <FileText className="w-3.5 h-3.5 text-white" />
            </span>
          ) : (
            <img src="/platforms/youtube-icon-red.svg" alt="YouTube" className="w-5 h-5 drop-shadow-md" />
          )}
        </span>
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
          {formatDuration(video.video_duration)}
        </div>
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
            <Play className="w-5 h-5 text-bg-primary ml-0.5" />
          </div>
        </div>
      </div>
      <div className="p-4">
        <h3 
          className="font-medium text-text-primary line-clamp-2 text-sm mb-1 group-hover:text-accent-primary transition-colors cursor-pointer"
          onClick={onView}
        >
          {video.video_title}
        </h3>
        <p className="text-xs text-text-tertiary mb-2">{video.video_channel}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="badge text-xs">{emoji} {video.category}</span>
          </div>
          <TournesolMini videoId={video.video_id} />
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border-subtle">
          <span className="text-xs text-text-muted">{formatRelativeDate(video.created_at, language)}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onChat(); }}
              className="p-1.5 rounded text-text-tertiary hover:text-accent-primary hover:bg-accent-primary-muted transition-colors"
              title={language === 'fr' ? 'Ouvrir le chat' : 'Open chat'}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onShare(); }}
              className="p-1.5 rounded text-text-tertiary hover:text-accent-primary hover:bg-accent-primary-muted transition-colors"
              title={language === 'fr' ? 'Partager' : 'Share'}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1.5 rounded text-text-tertiary hover:text-error hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PlaylistCard: React.FC<{
  playlist: PlaylistSummary;
  language: string;
  onView: () => void;
  onChat: () => void;
  onDelete: () => void;
}> = ({ playlist, language, onView, onChat, onDelete }) => {
  const progressPercent = playlist.num_videos > 0
    ? Math.round((playlist.num_processed / playlist.num_videos) * 100)
    : 0;
  const isComplete = playlist.status === 'completed';
  const hasMetaAnalysis = playlist.has_meta_analysis;

  return (
    <div
      className="card overflow-hidden hover:border-purple-400/50 dark:hover:border-purple-500/50 transition-all cursor-pointer group hover:shadow-lg hover:shadow-purple-500/10"
      onClick={onView}
    >
      {/* Thumbnail ou gradient */}
      <div className="relative h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500">
        {playlist.thumbnail_url ? (
          <img
            src={playlist.thumbnail_url}
            alt={playlist.playlist_title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Layers className="w-12 h-12 text-white/30" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Stats badges en haut */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
          <span className="px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
            <Video className="w-3 h-3" />
            {playlist.num_videos}
          </span>
          {hasMetaAnalysis && (
            <span className="px-2 py-1 rounded-lg bg-purple-500/80 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1">
              <Brain className="w-3 h-3" />
              {language === 'fr' ? 'Méta' : 'Meta'}
            </span>
          )}
        </div>

        {/* Actions en haut à droite */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onChat(); }}
            className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-purple-500 transition-colors"
            title={language === 'fr' ? 'Chat Corpus IA' : 'AI Corpus Chat'}
          >
            <MessageCircle className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white hover:bg-red-500 transition-colors"
            title={language === 'fr' ? 'Supprimer' : 'Delete'}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Titre en bas de l'image */}
        <div className="absolute bottom-2 left-2 right-2">
          <h3 className="font-semibold text-white text-sm line-clamp-2 drop-shadow-lg">
            {playlist.playlist_title}
          </h3>
        </div>
      </div>

      {/* Contenu */}
      <div className="p-3">
        {/* Barre de progression */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-tertiary">
              {language === 'fr' ? 'Progression' : 'Progress'}
            </span>
            <span className={`font-medium ${isComplete ? 'text-green-600 dark:text-green-400' : 'text-purple-600 dark:text-purple-400'}`}>
              {playlist.num_processed}/{playlist.num_videos} ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isComplete
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stats en ligne */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 mb-3">
          <div className="text-center p-2 rounded-lg bg-bg-secondary">
            <div className="flex items-center justify-center gap-1 text-purple-600 dark:text-purple-400">
              <Clock className="w-3 h-3" />
            </div>
            <p className="text-xs font-medium text-text-primary mt-0.5">
              {formatDuration(playlist.total_duration)}
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-bg-secondary">
            <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400">
              <FileText className="w-3 h-3" />
            </div>
            <p className="text-xs font-medium text-text-primary mt-0.5">
              {(playlist.total_words / 1000).toFixed(0)}k
            </p>
          </div>
          <div className="text-center p-2 rounded-lg bg-bg-secondary">
            <div className="flex items-center justify-center gap-1 text-pink-600 dark:text-pink-400">
              <BarChart2 className="w-3 h-3" />
            </div>
            <p className="text-xs font-medium text-text-primary mt-0.5">
              {playlist.num_processed > 0
                ? Math.round(playlist.total_words / playlist.num_processed).toLocaleString()
                : 0
              }
            </p>
          </div>
        </div>

        {/* Footer avec status et date */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            isComplete
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
          }`}>
            {isComplete ? (
              <Check className="w-3 h-3" />
            ) : (
              <DeepSightSpinnerMicro />
            )}
            {isComplete
              ? (language === 'fr' ? 'Terminé' : 'Complete')
              : (language === 'fr' ? 'En cours' : 'Processing')
            }
          </span>
          <span className="text-xs text-text-muted">
            {formatRelativeDate(playlist.created_at, language)}
          </span>
        </div>
      </div>
    </div>
  );
};

const PlaylistDetailView: React.FC<{
  playlist: PlaylistDetail;
  selectedVideo: PlaylistVideoDetail | null;
  loadingVideo: boolean;
  language: string;
  onBack: () => void;
  onBackToVideos: () => void;
  onChat: () => void;
  onViewVideo: (video: PlaylistVideo) => void;
  onChatVideo: (video: PlaylistVideo | PlaylistVideoDetail) => void;
}> = ({ playlist, selectedVideo, loadingVideo, language, onBack, onBackToVideos, onChat, onViewVideo, onChatVideo }) => {
  const videos = playlist.videos || [];
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [metaExpanded, setMetaExpanded] = useState(false);  // 🆕 État pour expand méta-analyse

  // 🆕 États pour la toolbar vidéo (Copy, Cite, Study, Keywords, Listen, Export)
  const [copied, setCopied] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [showStudyToolsModal, setShowStudyToolsModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportMenuPos, setExportMenuPos] = useState({ top: 0, left: 0 });

  // 🆕 États pour la toolbar méta-analyse (tous les outils)
  const [metaCopied, setMetaCopied] = useState(false);
  const [metaShowExportMenu, setMetaShowExportMenu] = useState(false);
  const [metaExporting, setMetaExporting] = useState(false);
  const metaExportBtnRef = useRef<HTMLButtonElement>(null);
  const metaExportMenuRef = useRef<HTMLDivElement>(null);
  const [metaExportMenuPos, setMetaExportMenuPos] = useState({ top: 0, left: 0 });
  const [metaShowCitationModal, setMetaShowCitationModal] = useState(false);
  const [metaShowStudyToolsModal, setMetaShowStudyToolsModal] = useState(false);
  const [metaShowKeywordsModal, setMetaShowKeywordsModal] = useState(false);

  // 🆕 Handler: Copy vidéo
  const handleCopy = async () => {
    if (!selectedVideo?.summary_content) return;
    await navigator.clipboard.writeText(selectedVideo.summary_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 🆕 Handler: Copy méta-analyse
  const handleMetaCopy = async () => {
    if (!playlist.meta_analysis) return;
    await navigator.clipboard.writeText(playlist.meta_analysis);
    setMetaCopied(true);
    setTimeout(() => setMetaCopied(false), 2000);
  };

  // 🆕 Handler: Export méta-analyse
  const handleMetaExport = async (format: 'md' | 'txt') => {
    if (!playlist.meta_analysis) return;
    setMetaExporting(true);
    setMetaShowExportMenu(false);

    try {
      const content = playlist.meta_analysis;
      const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meta-analyse-${playlist.playlist_title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setMetaExporting(false);
    }
  };

  // 🆕 Handler: Export
  const handleExport = async (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedVideo?.id) return;
    setExporting(true);
    setShowExportMenu(false);

    const formatMap: Record<string, 'pdf' | 'markdown' | 'text'> = { pdf: 'pdf', md: 'markdown', txt: 'text' };
    try {
      const blob = await videoApi.exportSummary(selectedVideo.id, formatMap[format]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'md' ? 'md' : format;
      a.download = `${selectedVideo.video_title || 'analyse'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Timecode components pour les résumés
  const getTimecodeComponents = useCallback((videoId?: string) => {
    return createTimecodeMarkdownComponents({
      mode: "external",
      videoId: videoId,
      onTimecodeClick: (seconds) => {
        if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(seconds)}s`, "_blank");
        }
      },
    });
  }, []);
  
  // Si une vidéo est sélectionnée (mode détail complet), afficher son résumé
  if (loadingVideo) {
    return (
      <div className="flex items-center justify-center py-20">
        <DeepSightSpinner size="md" />
        <span className="ml-3 text-text-secondary">
          {language === 'fr' ? 'Chargement du résumé...' : 'Loading summary...'}
        </span>
      </div>
    );
  }

  if (selectedVideo) {
    return (
      <div className="space-y-6">
        {/* Navigation breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-tertiary">
          <button onClick={onBack} className="hover:text-text-primary transition-colors">
            {language === 'fr' ? 'Playlists' : 'Playlists'}
          </button>
          <ChevronRight className="w-4 h-4" />
          <button onClick={onBackToVideos} className="hover:text-text-primary transition-colors">
            {playlist.playlist_title}
          </button>
          <ChevronRight className="w-4 h-4" />
          <span className="text-text-primary truncate max-w-[200px]">{selectedVideo.video_title}</span>
        </div>

        {/* Video Header */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <button onClick={onBackToVideos} className="flex items-center gap-2 text-text-tertiary hover:text-text-primary">
              <ChevronRight className="w-4 h-4 rotate-180" />
              {language === 'fr' ? 'Retour à la playlist' : 'Back to playlist'}
            </button>
            <a
              href={`https://www.youtube.com/watch?v=${selectedVideo.video_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              <Play className="w-4 h-4" />
              {language === 'fr' ? 'Voir sur YouTube' : 'Watch on YouTube'}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex gap-6">
            {/* Thumbnail + YouTube link */}
            <div className="flex-shrink-0">
              <a 
                href={`https://www.youtube.com/watch?v=${selectedVideo.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative group"
              >
                <ThumbnailImage
                  thumbnailUrl={selectedVideo.thumbnail_url}
                  videoId={selectedVideo.video_id}
                  title={selectedVideo.video_title}
                  category={selectedVideo.category}
                  className="w-64 h-36 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                </div>
                {selectedVideo.video_duration > 0 && (
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/80 text-white text-xs font-medium">
                    {formatDuration(selectedVideo.video_duration)}
                  </div>
                )}
              </a>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-xl font-semibold font-semibold text-text-primary mb-2">
                {selectedVideo.video_title}
              </h1>
              <p className="text-text-secondary mb-3">{selectedVideo.video_channel}</p>
              <div className="flex flex-wrap gap-2">
                {selectedVideo.category && (
                  <span className="badge">
                    {categoryEmoji[selectedVideo.category] || '📺'} {selectedVideo.category}
                  </span>
                )}
                {selectedVideo.word_count > 0 && (
                  <span className="badge">
                    📝 {(selectedVideo.word_count / 1000).toFixed(1)}k {language === 'fr' ? 'mots' : 'words'}
                  </span>
                )}
                {selectedVideo.mode && (
                  <span className="badge">
                    🎯 {selectedVideo.mode}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Summary Content with Full Toolbar */}
        <div className="card">
          {/* 🆕 Toolbar avec toutes les fonctionnalités */}
          <div className="panel-header border-b border-border-subtle p-4">
            <h3 className="font-semibold text-text-primary flex items-center gap-2">
              📄 {language === 'fr' ? 'Analyse' : 'Analysis'}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Copy */}
              <button
                onClick={handleCopy}
                className="btn btn-ghost text-xs"
              >
                {copied ? <Check className="w-4 h-4 text-accent-success" /> : <Copy className="w-4 h-4" />}
                {copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
              </button>

              {/* 🎓 Citation académique */}
              <button
                onClick={() => setShowCitationModal(true)}
                className="btn btn-ghost text-xs"
                title={language === 'fr' ? 'Générer une citation académique' : 'Generate academic citation'}
              >
                <GraduationCap className="w-4 h-4" />
                {language === 'fr' ? 'Citer' : 'Cite'}
              </button>

              {/* 📚 Outils d'étude (fiches + mindmap) */}
              <button
                onClick={() => setShowStudyToolsModal(true)}
                className="btn btn-ghost text-xs"
                title={language === 'fr' ? 'Fiches de révision et arbre pédagogique' : 'Study cards and concept map'}
              >
                <Brain className="w-4 h-4" />
                {language === 'fr' ? 'Réviser' : 'Study'}
              </button>

              {/* 🏷️ Mots-clés */}
              <button
                onClick={() => setShowKeywordsModal(true)}
                className="btn btn-ghost text-xs"
                title={language === 'fr' ? 'Voir les mots-clés extraits' : 'View extracted keywords'}
              >
                <Tags className="w-4 h-4" />
                {language === 'fr' ? 'Mots-clés' : 'Keywords'}
              </button>

              {/* Export */}
              <div>
                <button
                  ref={exportBtnRef}
                  onClick={() => { const pos = calcExportMenuPos(exportBtnRef); setExportMenuPos(pos); setShowExportMenu(!showExportMenu); }}
                  className="btn btn-ghost text-xs"
                  disabled={exporting}
                >
                  {exporting ? <DeepSightSpinnerMicro /> : <Download className="w-4 h-4" />}
                  Export
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showExportMenu && createPortal(
                  <div ref={exportMenuRef} className="fixed w-44 bg-bg-elevated border border-border-default rounded-lg shadow-xl py-1 animate-fadeIn" style={{ top: exportMenuPos.top, left: exportMenuPos.left, zIndex: 9999 }}>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> PDF
                    </button>
                    <button
                      onClick={() => handleExport('md')}
                      className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" /> Markdown
                    </button>
                    <button
                      onClick={() => handleExport('txt')}
                      className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" /> Texte
                    </button>
                  </div>,
                  document.body
                )}
              </div>

              {/* Chat toggle */}
              <button
                onClick={() => onChatVideo(selectedVideo)}
                className="btn btn-secondary text-xs"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            </div>
          </div>

          {/* Summary Content */}
          <div className="p-6">
            {selectedVideo.summary_content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown components={getTimecodeComponents(selectedVideo.video_id)}>
                  {selectedVideo.summary_content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-text-tertiary italic">
                {language === 'fr' ? 'Aucun résumé disponible.' : 'No summary available.'}
              </p>
            )}
          </div>
        </div>

        {/* 🆕 Modals pour les outils */}
        {/* Citation Modal */}
        <CitationExport
          isOpen={showCitationModal}
          onClose={() => setShowCitationModal(false)}
          video={{
            title: selectedVideo.video_title,
            channel: selectedVideo.video_channel,
            videoId: selectedVideo.video_id,
            duration: selectedVideo.video_duration,
          }}
          language={language as 'fr' | 'en'}
        />

        {/* Study Tools Modal */}
        <StudyToolsModal
          isOpen={showStudyToolsModal}
          onClose={() => setShowStudyToolsModal(false)}
          summaryId={selectedVideo.id}
          videoTitle={selectedVideo.video_title}
          language={language as 'fr' | 'en'}
        />

        {/* Keywords Modal - Note: concepts to be loaded from API */}
        <KeywordsModal
          isOpen={showKeywordsModal}
          onClose={() => setShowKeywordsModal(false)}
          videoTitle={selectedVideo.video_title}
          tags={[]}
          concepts={[]}
          loading={false}
          language={language as 'fr' | 'en'}
        />

        {/* Navigation entre vidéos */}
        {(() => {
          const currentIndex = videos.findIndex(v => v.video_id === selectedVideo.video_id);
          const hasPrev = currentIndex > 0;
          const hasNext = currentIndex < videos.length - 1 && currentIndex >= 0;
          
          return (
            <div className="flex items-center justify-between">
              {hasPrev ? (
                <button
                  onClick={() => onViewVideo(videos[currentIndex - 1])}
                  className="btn btn-secondary"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  {language === 'fr' ? 'Vidéo précédente' : 'Previous video'}
                </button>
              ) : <div />}
              
              <span className="text-sm text-text-tertiary">
                {currentIndex >= 0 ? `${currentIndex + 1} / ${videos.length}` : ''}
              </span>
              
              {hasNext ? (
                <button
                  onClick={() => onViewVideo(videos[currentIndex + 1])}
                  className="btn btn-secondary"
                >
                  {language === 'fr' ? 'Vidéo suivante' : 'Next video'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : <div />}
            </div>
          );
        })()}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🆕 NOUVEL ORDRE : Vidéos individuelles EN HAUT, Méta-analyse EN BAS
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header compact */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <button onClick={onBack} className="flex items-center gap-2 text-text-tertiary hover:text-text-primary transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" />
            {language === 'fr' ? 'Retour' : 'Back'}
          </button>
          <button onClick={onChat} className="btn btn-primary">
            <MessageCircle className="w-4 h-4" />
            {language === 'fr' ? 'Chat Corpus' : 'Corpus Chat'}
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Layers className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-semibold text-text-primary">{playlist.playlist_title}</h1>
            <p className="text-text-secondary">
              {playlist.num_processed}/{playlist.num_videos} {language === 'fr' ? 'vidéos analysées' : 'videos analyzed'}
              {' • '}
              {formatDuration(playlist.total_duration)}
              {' • '}
              {(playlist.total_words / 1000).toFixed(0)}k {language === 'fr' ? 'mots' : 'words'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
       * 🎬 SECTION 1 : VIDÉOS INDIVIDUELLES (EN HAUT)
       * Accordéon interactif pour afficher les résumés sans changer de page
       * ═══════════════════════════════════════════════════════════════════════════════ */}
      <div className="card">
        <div className="p-4 border-b border-border-subtle flex items-center justify-between">
          <h2 className="font-semibold text-text-primary flex items-center gap-2">
            <Video className="w-5 h-5 text-accent-primary" />
            {language === 'fr' ? 'Vidéos de la playlist' : 'Playlist videos'}
            <span className="ml-2 text-sm font-normal text-text-tertiary">
              ({videos.length} {language === 'fr' ? 'vidéos' : 'videos'})
            </span>
          </h2>
          <p className="text-xs text-text-muted">
            {language === 'fr' ? 'Cliquez pour voir le résumé' : 'Click to view summary'}
          </p>
        </div>
        
        {videos.length === 0 ? (
          <div className="p-8 text-center">
            <Video className="w-12 h-12 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary">
              {language === 'fr' 
                ? 'Aucune vidéo analysée dans cette playlist.' 
                : 'No videos analyzed in this playlist.'}
            </p>
            <p className="text-sm text-text-tertiary mt-1">
              {language === 'fr' 
                ? 'Les vidéos apparaîtront ici une fois analysées.' 
                : 'Videos will appear here once analyzed.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {videos.map((video, index) => {
              const isExpanded = expandedVideoId === video.video_id;
              
              return (
                <div key={video.id} className="group">
                  {/* En-tête de la vidéo (toujours visible) */}
                  <div 
                    className={`p-4 cursor-pointer transition-all duration-200 flex items-center gap-4 ${
                      isExpanded 
                        ? 'bg-accent-primary-muted/50 border-l-4 border-accent-primary' 
                        : 'hover:bg-bg-hover'
                    }`}
                    onClick={() => setExpandedVideoId(isExpanded ? null : video.video_id)}
                  >
                    <span className={`text-sm w-8 text-center font-semibold transition-colors ${
                      isExpanded ? 'text-accent-primary' : 'text-text-muted'
                    }`}>
                      {index + 1}
                    </span>
                    
                    <div className="relative w-28 h-16 flex-shrink-0">
                      <ThumbnailImage
                        thumbnailUrl={video.thumbnail_url}
                        videoId={video.video_id}
                        title={video.video_title}
                        category={video.category}
                        className={`w-full h-full object-cover rounded transition-all ${
                          isExpanded ? 'ring-2 ring-accent-primary' : ''
                        }`}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                      {video.video_duration > 0 && (
                        <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/70 text-white text-xs">
                          {formatDuration(video.video_duration)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium line-clamp-1 transition-colors ${
                        isExpanded ? 'text-accent-primary' : 'text-text-primary group-hover:text-accent-primary'
                      }`}>
                        {video.video_title}
                      </h4>
                      <p className="text-sm text-text-tertiary">{video.video_channel}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {video.category && (
                          <span className="text-xs text-text-muted">
                            {categoryEmoji[video.category] || '📺'} {video.category}
                          </span>
                        )}
                        {video.word_count > 0 && (
                          <span className="text-xs text-text-muted">
                            • {(video.word_count / 1000).toFixed(1)}k {language === 'fr' ? 'mots' : 'words'}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Bouton Chat vidéo */}
                      <button
                        onClick={(e) => { e.stopPropagation(); onChatVideo(video); }}
                        className="p-2 rounded-lg text-text-tertiary hover:text-accent-primary hover:bg-accent-primary-muted transition-colors"
                        title={language === 'fr' ? 'Chat vidéo' : 'Video chat'}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      
                      {/* Bouton Ouvrir YouTube */}
                      <a
                        href={`https://www.youtube.com/watch?v=${video.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-lg text-text-tertiary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title={language === 'fr' ? 'Voir sur YouTube' : 'Watch on YouTube'}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      
                      {/* Indicateur d'expansion */}
                      <ChevronRight className={`w-5 h-5 text-text-muted transition-transform duration-200 ${
                        isExpanded ? 'rotate-90 text-accent-primary' : 'group-hover:text-accent-primary'
                      }`} />
                    </div>
                  </div>
                  
                  {/* Contenu expandable - Résumé de la vidéo */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-bg-secondary/50 border-l-4 border-accent-primary animate-fade-in">
                      <div className="ml-12 pl-4 border-l-2 border-border-subtle">
                        {/* Actions rapides */}
                        <div className="flex items-center gap-2 mb-4">
                          <button
                            onClick={() => onViewVideo(video)}
                            className="btn btn-secondary btn-sm"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            {language === 'fr' ? 'Vue détaillée' : 'Detailed view'}
                          </button>
                          <button
                            onClick={() => onChatVideo(video)}
                            className="btn btn-ghost btn-sm"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {language === 'fr' ? 'Poser une question' : 'Ask a question'}
                          </button>
                        </div>
                        
                        {/* Aperçu du résumé */}
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <h5 className="text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                            📄 {language === 'fr' ? 'Résumé' : 'Summary'}
                          </h5>
                          <p className="text-text-secondary text-sm italic">
                            {language === 'fr' 
                              ? 'Cliquez sur "Vue détaillée" pour voir le résumé complet avec timecodes cliquables.'
                              : 'Click "Detailed view" to see the full summary with clickable timestamps.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════════
       * 📊 SECTION 2 : MÉTA-ANALYSE (EN BAS) - EXPANDABLE
       * Design distinctif pour mettre en valeur l'analyse globale du corpus
       * ═══════════════════════════════════════════════════════════════════════════════ */}
      {playlist.meta_analysis && (
        <div className="card overflow-hidden">
          {/* Header de la méta-analyse avec design accentué - CLIQUABLE */}
          <div 
            className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 cursor-pointer hover:from-purple-500 hover:to-indigo-500 transition-colors"
            onClick={() => setMetaExpanded(!metaExpanded)}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold font-semibold text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <BarChart2 className="w-5 h-5 text-white" />
                </div>
                {language === 'fr' ? 'Méta-analyse' : 'Meta-analysis'}
              </h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-white text-xs font-medium">
                  {language === 'fr' ? 'Synthèse globale' : 'Global synthesis'}
                </span>
                {/* Bouton expand/collapse */}
                <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
                  <ChevronRight className={`w-5 h-5 text-white transition-transform duration-300 ${metaExpanded ? 'rotate-90' : 'rotate-0'}`} />
                </div>
              </div>
            </div>
            <p className="text-purple-100 text-sm mt-2 ml-[52px]">
              {language === 'fr' 
                ? `Analyse croisée des ${playlist.num_processed} vidéos du corpus`
                : `Cross-analysis of ${playlist.num_processed} videos in the corpus`}
              {' • '}
              <span className="text-white/80">
                {metaExpanded 
                  ? (language === 'fr' ? 'Cliquez pour réduire' : 'Click to collapse')
                  : (language === 'fr' ? 'Cliquez pour développer' : 'Click to expand')}
              </span>
            </p>
          </div>
          
          {/* 🆕 Toolbar Méta-analyse COMPLET - affiché quand expanded */}
          {metaExpanded && (
            <div className="p-4 border-b border-border-subtle flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                📄 {language === 'fr' ? 'Analyse' : 'Analysis'}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Copy */}
                <button
                  onClick={handleMetaCopy}
                  className="btn btn-ghost text-xs"
                >
                  {metaCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {metaCopied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}
                </button>

                {/* 🎓 Citation académique */}
                <button
                  onClick={() => setMetaShowCitationModal(true)}
                  className="btn btn-ghost text-xs"
                  title={language === 'fr' ? 'Générer une citation académique' : 'Generate academic citation'}
                >
                  <GraduationCap className="w-4 h-4" />
                  {language === 'fr' ? 'Citer' : 'Cite'}
                </button>

                {/* 📚 Outils d'étude */}
                <button
                  onClick={() => setMetaShowStudyToolsModal(true)}
                  className="btn btn-ghost text-xs"
                  title={language === 'fr' ? 'Fiches de révision et arbre pédagogique' : 'Study cards and concept map'}
                >
                  <Brain className="w-4 h-4" />
                  {language === 'fr' ? 'Réviser' : 'Study'}
                </button>

                {/* 🏷️ Mots-clés */}
                <button
                  onClick={() => setMetaShowKeywordsModal(true)}
                  className="btn btn-ghost text-xs"
                  title={language === 'fr' ? 'Voir les mots-clés extraits' : 'View extracted keywords'}
                >
                  <Tags className="w-4 h-4" />
                  {language === 'fr' ? 'Mots-clés' : 'Keywords'}
                </button>

                {/* Export */}
                <div>
                  <button
                    ref={metaExportBtnRef}
                    onClick={() => { const pos = calcExportMenuPos(metaExportBtnRef); setMetaExportMenuPos(pos); setMetaShowExportMenu(!metaShowExportMenu); }}
                    className="btn btn-ghost text-xs"
                  >
                    {metaExporting ? <DeepSightSpinnerMicro /> : <Download className="w-4 h-4" />}
                    Export
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {metaShowExportMenu && createPortal(
                    <div ref={metaExportMenuRef} className="fixed w-44 bg-bg-elevated border border-border-default rounded-lg shadow-xl py-1 animate-fadeIn" style={{ top: metaExportMenuPos.top, left: metaExportMenuPos.left, zIndex: 9999 }}>
                      <button
                        onClick={() => handleMetaExport('md')}
                        className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                      >
                        <FileDown className="w-4 h-4" /> Markdown
                      </button>
                      <button
                        onClick={() => handleMetaExport('txt')}
                        className="w-full px-3 py-2 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" /> Texte
                      </button>
                    </div>,
                    document.body
                  )}
                </div>

                {/* Chat Corpus */}
                <button
                  onClick={onChat}
                  className="btn btn-secondary text-xs"
                >
                  <MessageCircle className="w-4 h-4" />
                  Chat
                </button>
              </div>
            </div>
          )}

          {/* Contenu de la méta-analyse - EXPANDABLE */}
          <div
            className={`transition-all duration-500 ease-in-out overflow-hidden ${
              metaExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-40 opacity-90'
            }`}
          >
            <div className="p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-text-primary prose-p:text-text-secondary">
                <ReactMarkdown>{playlist.meta_analysis}</ReactMarkdown>
              </div>
            </div>
          </div>
          
          {/* Gradient overlay quand collapsed pour montrer qu'il y a plus */}
          {!metaExpanded && (
            <div 
              className="absolute bottom-16 left-0 right-0 h-20 bg-gradient-to-t from-bg-primary to-transparent pointer-events-none"
              style={{ position: 'relative', marginTop: '-80px', marginBottom: '0' }}
            />
          )}
          
          {/* Bouton Expand au milieu quand collapsed */}
          {!metaExpanded && (
            <div className="px-6 py-3 bg-bg-secondary/50 border-t border-border-subtle flex justify-center">
              <button 
                onClick={() => setMetaExpanded(true)}
                className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
              >
                <ChevronRight className="w-4 h-4 rotate-90" />
                {language === 'fr' ? 'Voir la méta-analyse complète' : 'View full meta-analysis'}
              </button>
            </div>
          )}
          
          {/* Footer avec CTA */}
          <div className="px-6 py-4 bg-bg-secondary border-t border-border-subtle flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {language === 'fr' 
                ? 'Posez des questions sur l\'ensemble du corpus'
                : 'Ask questions about the entire corpus'}
            </p>
            <button onClick={onChat} className="btn btn-primary btn-sm">
              <MessageCircle className="w-4 h-4" />
              {language === 'fr' ? 'Chat Corpus' : 'Corpus Chat'}
            </button>
          </div>
        </div>
      )}
      
      {/* Message si pas de méta-analyse */}
      {!playlist.meta_analysis && (
        <div className="card p-6 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-3">
            <BarChart2 className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-medium text-text-primary mb-1">
            {language === 'fr' ? 'Méta-analyse non disponible' : 'Meta-analysis not available'}
          </h3>
          <p className="text-sm text-text-tertiary">
            {language === 'fr'
              ? 'La méta-analyse sera générée une fois toutes les vidéos analysées.'
              : 'Meta-analysis will be generated once all videos are analyzed.'}
          </p>
        </div>
      )}

      {/* 🆕 Modals pour la méta-analyse */}
      {/* Citation Modal pour méta-analyse */}
      <CitationExport
        isOpen={metaShowCitationModal}
        onClose={() => setMetaShowCitationModal(false)}
        video={{
          title: `Méta-analyse: ${playlist.playlist_title}`,
          channel: 'Deep Sight - Corpus Analysis',
          videoId: playlist.playlist_id,
          duration: playlist.total_duration,
        }}
        language={language as 'fr' | 'en'}
      />

      {/* Study Tools Modal pour méta-analyse - utilise le premier video ID */}
      {videos.length > 0 && videos[0].id && (
        <StudyToolsModal
          isOpen={metaShowStudyToolsModal}
          onClose={() => setMetaShowStudyToolsModal(false)}
          summaryId={videos[0].id}
          videoTitle={`Méta-analyse: ${playlist.playlist_title}`}
          language={language as 'fr' | 'en'}
        />
      )}

      {/* Keywords Modal pour méta-analyse */}
      <KeywordsModal
        isOpen={metaShowKeywordsModal}
        onClose={() => setMetaShowKeywordsModal(false)}
        videoTitle={`Méta-analyse: ${playlist.playlist_title}`}
        tags={[]}
        concepts={[]}
        loading={false}
        language={language as 'fr' | 'en'}
      />
    </div>
  );
};

export default History;

