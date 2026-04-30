/**
 * 🎬 DEEP SIGHT v5.3 — Playlist Page avec PROGRESSION DYNAMIQUE + LIMITE 50 VIDÉOS
 *
 * ✨ FIX v5.3:
 * - Support jusqu'à 50 vidéos par playlist
 * - Estimation du temps plus précise pour les longues playlists
 * - Barre de progression animée et engageante
 * - Messages d'encouragement pour les longues analyses
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "../hooks/useTranslation";
import {
  normalizePlanId,
  getMinPlanForFeature,
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  hasFeature,
} from "../config/planPrivileges";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import SmartInputBar, { SmartInputValue } from "../components/SmartInputBar";
import VideoDiscoveryModal from "../components/VideoDiscoveryModal";
import {
  videoApi,
  playlistApi,
  PlaylistTaskStatus,
  ApiError,
} from "../services/api";
import type { DiscoveryResponse, VideoCandidate } from "../services/api";
import {
  ListVideo,
  Play,
  AlertCircle,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  RefreshCw,
  History,
  Sparkles,
  X,
  FileText,
  Save,
  BarChart3,
  Timer,
  Coffee,
  Rocket,
  Trash2,
} from "lucide-react";
import {
  DeepSightSpinner,
  DeepSightSpinnerMicro,
  DeepSightSpinnerSmall,
} from "../components/ui";
import { SEO } from "../components/SEO";

// ═══════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════

interface PlaylistHistoryItem {
  id: number;
  playlist_id: string;
  playlist_title: string;
  playlist_url?: string;
  num_videos: number;
  num_processed: number;
  total_duration?: number;
  total_words?: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

// Type étendu pour la progression v5.0
interface ExtendedPlaylistTaskStatus extends PlaylistTaskStatus {
  progress_percent?: number;
  completed_videos?: number;
  current_step?: string;
  playlist_id?: string;
  playlist_title?: string;
  estimated_time_remaining?: string;
  // 🆕 v5.0: Pipeline chunked
  current_video_title?: string;
  current_chunk?: number;
  total_chunks?: number;
  skipped_videos?: Array<{ video_id?: string; url?: string; reason: string }>;
  result?: {
    playlist_id?: string;
    num_videos?: number;
    total_duration?: number;
    total_words?: number;
    num_skipped?: number;
    processing_time?: number;
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
  return (
    status.completed_videos ?? Math.max(0, (status.current_video ?? 1) - 1)
  );
}

// 🆕 Estimation du temps pour l'affichage initial (améliorée pour 50 vidéos)
function estimatePlaylistTime(videoCount: number, language: string): string {
  // Estimation: ~1-3 min par vidéo (moyenne 2 min)
  const minMinutes = videoCount;
  const maxMinutes = videoCount * 3;

  if (language === "fr") {
    if (videoCount <= 3) return "⏱️ Estimation : quelques minutes";
    if (videoCount <= 10)
      return `⏱️ Estimation : ${minMinutes}-${maxMinutes} minutes`;
    if (videoCount <= 25)
      return `⏱️ Estimation : ${minMinutes}-${maxMinutes} minutes (~${Math.round((maxMinutes / 60) * 10) / 10}h max)`;
    if (videoCount <= 50)
      return `⏱️ Estimation : ${Math.round((minMinutes / 60) * 10) / 10}-${Math.round((maxMinutes / 60) * 10) / 10} heures`;
    return `⏱️ Estimation : ${Math.round((minMinutes / 60) * 10) / 10}-${Math.round((maxMinutes / 60) * 10) / 10} heures`;
  } else {
    if (videoCount <= 3) return "⏱️ Estimate: a few minutes";
    if (videoCount <= 10)
      return `⏱️ Estimate: ${minMinutes}-${maxMinutes} minutes`;
    if (videoCount <= 25)
      return `⏱️ Estimate: ${minMinutes}-${maxMinutes} minutes (~${Math.round((maxMinutes / 60) * 10) / 10}h max)`;
    if (videoCount <= 50)
      return `⏱️ Estimate: ${Math.round((minMinutes / 60) * 10) / 10}-${Math.round((maxMinutes / 60) * 10) / 10} hours`;
    return `⏱️ Estimate: ${Math.round((minMinutes / 60) * 10) / 10}-${Math.round((maxMinutes / 60) * 10) / 10} hours`;
  }
}

// 🆕 Messages d'encouragement pendant les longues analyses
function getEncouragementMessage(
  percent: number,
  videoCount: number,
  language: string,
): string | null {
  if (videoCount < 10) return null;

  const messages_fr = [
    { threshold: 10, msg: "☕ C'est parti ! Prenez un café en attendant..." },
    {
      threshold: 25,
      msg: "🚀 L'analyse progresse bien ! L'IA travaille dur...",
    },
    {
      threshold: 50,
      msg: "⭐ Déjà à mi-chemin ! Les synthèses arrivent bientôt...",
    },
    { threshold: 75, msg: "🎯 Presque terminé ! Plus que quelques vidéos..." },
    {
      threshold: 90,
      msg: "✨ Finalisation en cours... Merci de votre patience !",
    },
  ];

  const messages_en = [
    { threshold: 10, msg: "☕ Here we go! Grab a coffee while you wait..." },
    { threshold: 25, msg: "🚀 Analysis is progressing! AI is working hard..." },
    { threshold: 50, msg: "⭐ Halfway there! Summaries coming soon..." },
    { threshold: 75, msg: "🎯 Almost done! Just a few more videos..." },
    { threshold: 90, msg: "✨ Finalizing... Thanks for your patience!" },
  ];

  const messages = language === "fr" ? messages_fr : messages_en;

  // Trouver le message correspondant au pourcentage actuel
  for (let i = messages.length - 1; i >= 0; i--) {
    if (percent >= messages[i].threshold) {
      return messages[i].msg;
    }
  }
  return null;
}

function getStepIcon(step: string) {
  switch (step) {
    case "fetching":
      return <Play className="w-4 h-4" />;
    case "transcript":
      return <FileText className="w-4 h-4" />;
    case "category":
      return <BarChart3 className="w-4 h-4" />;
    case "summary":
      return <Sparkles className="w-4 h-4 animate-pulse" />;
    case "saving":
      return <Save className="w-4 h-4" />;
    case "meta":
      return <Sparkles className="w-4 h-4 animate-pulse" />;
    case "done":
      return <CheckCircle className="w-4 h-4" />;
    default:
      return <DeepSightSpinnerMicro />;
  }
}

// ═══════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════

const MODES = [
  {
    id: "accessible",
    name: { fr: "Accessible", en: "Accessible" },
    desc: { fr: "Grand public", en: "General" },
  },
  {
    id: "standard",
    name: { fr: "Standard", en: "Standard" },
    desc: { fr: "Équilibré", en: "Balanced" },
  },
  {
    id: "expert",
    name: { fr: "Expert", en: "Expert" },
    desc: { fr: "Technique", en: "Technical" },
  },
] as const;

// 🆕 Options de nombre de vidéos (jusqu'à 50)
const MAX_VIDEOS_OPTIONS = [5, 10, 15, 20, 30, 40, 50];

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export const PlaylistPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();

  // UI State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Input State
  const [smartInput, setSmartInput] = useState<SmartInputValue>({
    mode: "url",
    searchLanguages: ["fr", "en"],
  });

  // Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExtendedPlaylistTaskStatus | null>(
    null,
  );

  // Animation du pourcentage
  const [displayPercent, setDisplayPercent] = useState(0);
  const targetPercent = getProgressPercent(progress);

  // Discovery State
  const [discoveryResult, setDiscoveryResult] =
    useState<DiscoveryResponse | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [, setSelectedVideos] = useState<VideoCandidate[]>([]);

  // History State
  const [history, setHistory] = useState<PlaylistHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [deletingPlaylistId, setDeletingPlaylistId] = useState<string | null>(
    null,
  );

  // Options - 🆕 Limite par défaut à 10, max 50
  const [videoCount] = useState(5);
  const [maxVideos, setMaxVideos] = useState(10);
  const [mode, setMode] = useState<"accessible" | "standard" | "expert">(
    "accessible",
  );

  // User info
  const userCredits = user?.credits || 0;
  const normalizedPlan = normalizePlanId(user?.plan);
  // Plan-gate: vérifie accès playlists via planPrivileges (source unique de vérité)
  const minPlanForPlaylists = getMinPlanForFeature("playlistsEnabled");
  const minPlanName = PLANS_INFO[minPlanForPlaylists].name;

  if (!hasFeature(normalizedPlan, "playlistsEnabled")) {
    return (
      <div className="flex min-h-screen bg-bg-primary">
        <DoodleBackground variant="video" />
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <main className={`flex-1 overflow-x-hidden`}>
          <div className="container max-w-lg mx-auto px-4 py-16 pb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-violet-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-3">
              {language === "fr"
                ? "Fonctionnalité réservée aux abonnés"
                : "Subscribers only feature"}
            </h2>
            <p className="text-text-secondary text-sm sm:text-base mb-6 max-w-sm mx-auto">
              {language === "fr"
                ? `L'analyse de playlists est disponible à partir du plan ${minPlanName}. Passez au plan ${minPlanName} pour débloquer cette fonctionnalité.`
                : `Playlist analysis is available from the ${minPlanName} plan. Upgrade to the ${minPlanName} plan to unlock this feature.`}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {CONVERSION_TRIGGERS.trialEnabled && (
                <Link
                  to="/upgrade?trial=true"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/25"
                >
                  <Sparkles className="w-4 h-4" />
                  {language === "fr"
                    ? `Essayer gratuitement ${CONVERSION_TRIGGERS.trialDays} jours`
                    : `Try free for ${CONVERSION_TRIGGERS.trialDays} days`}
                </Link>
              )}
              <Link
                to="/upgrade"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border-subtle text-text-secondary font-medium hover:text-text-primary hover:bg-bg-hover transition-all"
              >
                {language === "fr" ? "Voir les plans" : "View plans"}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANIMATION DU POURCENTAGE
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (displayPercent < targetPercent) {
      const step = Math.max(1, Math.ceil((targetPercent - displayPercent) / 8));
      const timer = setTimeout(() => {
        setDisplayPercent((prev) => Math.min(prev + step, targetPercent));
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
      const data = await playlistApi.getAll();
      setHistory(data as unknown as PlaylistHistoryItem[]);
    } catch (err) {
      console.error("Error loading playlist history:", err);
      // 🆕 Ne pas afficher d'erreur si l'endpoint n'existe pas encore
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user, loadHistory]);

  const handleDeleteFromHistory = async (
    e: React.MouseEvent,
    playlistId: string,
  ) => {
    e.stopPropagation(); // Ne pas naviguer vers la playlist
    if (deletingPlaylistId) return;
    setDeletingPlaylistId(playlistId);
    try {
      await playlistApi.delete(playlistId);
      setHistory((prev) => prev.filter((p) => p.playlist_id !== playlistId));
    } catch (err) {
      console.error("Error deleting playlist:", err);
    } finally {
      setDeletingPlaylistId(null);
    }
  };

  // Persistance
  useEffect(() => {
    if (progress && progress.status === "completed") {
      try {
        localStorage.setItem(
          "deepsight_last_playlist",
          JSON.stringify({
            ...progress,
            savedAt: Date.now(),
          }),
        );
      } catch {
        // Failed to save playlist result to localStorage
      }
    }
  }, [progress]);

  useEffect(() => {
    if (!analyzing && !progress) {
      try {
        const saved = localStorage.getItem("deepsight_last_playlist");
        if (saved) {
          const parsed = JSON.parse(saved);
          const isRecent =
            parsed.savedAt && Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000;
          if (parsed && parsed.status === "completed" && isRecent) {
            setProgress(parsed);
          }
        }
      } catch {
        // Failed to restore playlist result from localStorage
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

    if (smartInput.mode === "search") {
      if (!smartInput.searchQuery?.trim()) return;

      setAnalyzing(true);

      try {
        const discovery = await videoApi.discover(smartInput.searchQuery, {
          languages: smartInput.searchLanguages || [
            language,
            language === "fr" ? "en" : "fr",
          ],
          limit: videoCount + 5,
          minQuality: 30,
          targetDuration: "default",
        });

        setDiscoveryResult(discovery);
        setShowDiscoveryModal(true);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : language === "fr"
              ? "Erreur lors de la recherche"
              : "Search error";
        setError(message);
      } finally {
        setAnalyzing(false);
      }

      return;
    }

    if (smartInput.mode === "url" && smartInput.url?.trim()) {
      const playlistId = extractPlaylistId(smartInput.url);
      if (!playlistId) {
        setError(
          language === "fr"
            ? "URL de playlist invalide. Format attendu: youtube.com/playlist?list=..."
            : "Invalid playlist URL. Expected format: youtube.com/playlist?list=...",
        );
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
        maxVideos, // 🆕 Peut maintenant aller jusqu'à 50
        mode,
        lang: language,
      });

      await pollPlaylistTask(task.task_id);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : language === "fr"
            ? "Erreur lors de l'analyse"
            : "Analysis error";
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
      const urls = videos.map(
        (v) => `https://youtube.com/watch?v=${v.video_id}`,
      );

      const corpusName = smartInput.searchQuery
        ? `Corpus: ${smartInput.searchQuery.substring(0, 50)}`
        : language === "fr"
          ? "Corpus personnalisé"
          : "Custom Corpus";

      const task = await playlistApi.analyzeCorpus(urls, {
        name: corpusName,
        mode,
        lang: language,
      });

      await pollPlaylistTask(task.task_id);

      localStorage.setItem(
        "deepsight_last_corpus",
        JSON.stringify({
          name: corpusName,
          videoCount: videos.length,
          timestamp: Date.now(),
        }),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : language === "fr"
            ? "Erreur lors de l'analyse du corpus"
            : "Corpus analysis error";
      setError(message);
    } finally {
      setAnalyzing(false);
    }
  };

  // 🆕 Polling plus fréquent (1.5s) pour des mises à jour plus fluides
  const pollPlaylistTask = async (taskId: string) => {
    const maxAttempts = 300; // 🆕 Augmenté pour supporter 50 vidéos (7.5 min max)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = (await playlistApi.getStatus(
          taskId,
        )) as ExtendedPlaylistTaskStatus;
        setProgress(status);

        if (status.status === "completed") {
          await refreshUser(true);
          await loadHistory();
          return;
        }

        if (status.status === "failed") {
          throw new Error(status.error || "Analysis failed");
        }

        await new Promise((r) => setTimeout(r, 1500)); // 🆕 1.5s au lieu de 2s
        attempts++;
      } catch (err) {
        throw err;
      }
    }

    throw new Error("Timeout");
  };

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  const playlistId = smartInput.url ? extractPlaylistId(smartInput.url) : null;
  const completedVideos = getCompletedVideos(progress);
  const totalVideos = progress?.total_videos || 0;
  const currentStep =
    (progress as ExtendedPlaylistTaskStatus)?.current_step || "";
  const estimatedTime = (progress as ExtendedPlaylistTaskStatus)
    ?.estimated_time_remaining;
  const isProcessing =
    progress?.status === "processing" || progress?.status === "pending";
  const isCompleted = progress?.status === "completed";
  // 🆕 v5.0: Infos pipeline chunked
  const currentVideoTitle =
    (progress as ExtendedPlaylistTaskStatus)?.current_video_title || "";
  const currentChunk =
    (progress as ExtendedPlaylistTaskStatus)?.current_chunk || 0;
  const totalChunks =
    (progress as ExtendedPlaylistTaskStatus)?.total_chunks || 0;
  const _skippedVideos =
    (progress as ExtendedPlaylistTaskStatus)?.skipped_videos || [];
  void _skippedVideos;

  // 🆕 Message d'encouragement
  const encouragementMsg = isProcessing
    ? getEncouragementMessage(displayPercent, totalVideos, language)
    : null;

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <SEO title="Playlists" path="/playlists" />
      <DoodleBackground variant="video" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className={`flex-1 overflow-x-hidden`}>
        <div className="container max-w-4xl mx-auto px-4 py-6 sm:py-8 pb-8">
          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-primary">
                {language === "fr" ? "Playlists" : "Playlists"}
              </h1>
            </div>
            <p className="text-text-secondary">
              {language === "fr"
                ? "Playlist YouTube / TikTok ou recherche intelligente de vidéos"
                : "YouTube / TikTok playlist or intelligent video search"}
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
                userCredits={userCredits}
                placeholder={
                  smartInput.mode === "url"
                    ? "https://www.youtube.com/playlist?list=..."
                    : language === "fr"
                      ? "Rechercher des vidéos..."
                      : "Search for videos..."
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
                    {/* 🆕 Options jusqu'à 50 vidéos */}
                    {MAX_VIDEOS_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">MODE</span>
                  <div className="flex gap-1">
                    {MODES.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          mode === m.id
                            ? "bg-accent-primary text-gray-900"
                            : "bg-bg-tertiary text-text-secondary hover:bg-bg-secondary"
                        }`}
                      >
                        {m.name[language as "fr" | "en"]}
                      </button>
                    ))}
                  </div>
                </div>

                {smartInput.mode === "url" && playlistId && (
                  <div className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Playlist: {playlistId.substring(0, 15)}...</span>
                  </div>
                )}
              </div>

              {/* 🆕 ESTIMATION DE TEMPS AMÉLIORÉE - Avant de lancer */}
              {smartInput.mode === "url" &&
                playlistId &&
                !analyzing &&
                !progress && (
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-400 text-sm">
                      <Timer className="w-4 h-4" />
                      <span>{estimatePlaylistTime(maxVideos, language)}</span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {language === "fr"
                        ? maxVideos > 20
                          ? "⚠️ Les grandes playlists (20+ vidéos) peuvent prendre une heure ou plus. Vous pouvez laisser cette page ouverte."
                          : "Les vidéos longues et les grandes playlists peuvent prendre plusieurs dizaines de minutes."
                        : maxVideos > 20
                          ? "⚠️ Large playlists (20+ videos) may take an hour or more. You can leave this page open."
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
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* 🆕 PROGRESS CARD AMÉLIORÉE AVEC MESSAGES D'ENCOURAGEMENT */}
            {/* ═══════════════════════════════════════════════════════════════ */}

            {progress && (
              <div
                className={`card p-6 transition-all duration-300 ${
                  isCompleted
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-violet-500/30"
                }`}
              >
                <div className="flex items-center gap-4 mb-4">
                  {/* Icône */}
                  <div
                    className={`flex items-center justify-center transition-all`}
                  >
                    {isCompleted ? (
                      <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                        <CheckCircle className="w-7 h-7 text-green-400" />
                      </div>
                    ) : (
                      <DeepSightSpinner size="md" speed="normal" />
                    )}
                  </div>

                  {/* Titre et message */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text-primary truncate">
                      {(progress as ExtendedPlaylistTaskStatus)
                        .playlist_title ||
                        (language === "fr"
                          ? "Analyse en cours..."
                          : "Analyzing...")}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-text-secondary">
                      {isProcessing && getStepIcon(currentStep)}
                      <span className="truncate">
                        {progress.message ||
                          `${completedVideos}/${totalVideos} vidéos`}
                      </span>
                    </div>
                  </div>

                  {/* Pourcentage */}
                  <div className="text-right">
                    <span
                      className={`text-3xl font-bold tabular-nums transition-colors ${
                        isCompleted ? "text-green-400" : "text-violet-400"
                      }`}
                    >
                      {displayPercent}%
                    </span>
                    {totalVideos > 0 && (
                      <p className="text-xs text-text-muted">
                        {completedVideos}/{totalVideos}{" "}
                        {language === "fr" ? "vidéos" : "videos"}
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
                        ? "bg-gradient-to-r from-green-500 to-emerald-400"
                        : "bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600"
                    }`}
                    style={{ width: `${displayPercent}%` }}
                  >
                    {isProcessing && (
                      <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        style={{ animation: "shimmer 2s infinite" }}
                      />
                    )}
                  </div>
                </div>

                {/* 🆕 v5.0: Détails vidéo en cours + chunking */}
                {isProcessing && currentVideoTitle && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    <span
                      className="truncate max-w-[300px]"
                      title={currentVideoTitle}
                    >
                      🎬 {currentVideoTitle}
                    </span>
                    {totalChunks > 1 && (
                      <span className="whitespace-nowrap text-violet-400/70">
                        ({currentChunk}/{totalChunks} segments)
                      </span>
                    )}
                  </div>
                )}

                {/* 🆕 MESSAGE D'ENCOURAGEMENT */}
                {isProcessing && encouragementMsg && (
                  <div className="mt-2 text-center text-sm text-violet-300">
                    {encouragementMsg}
                  </div>
                )}

                {/* ESTIMATION TEMPS RESTANT */}
                {isProcessing && estimatedTime && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>
                      {language === "fr"
                        ? "Temps restant estimé : "
                        : "Estimated time remaining: "}
                      {estimatedTime}
                    </span>
                  </div>
                )}

                {/* 🆕 RAPPEL POUR LONGUES PLAYLISTS (adapté aux 50 vidéos) */}
                {isProcessing && totalVideos > 10 && displayPercent < 50 && (
                  <div className="mt-3 p-2 bg-amber-500/10 rounded text-xs text-amber-400 flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    <span>
                      {language === "fr"
                        ? `Analyse de ${totalVideos} vidéos en cours. Vous pouvez laisser cette page ouverte et revenir plus tard !`
                        : `Analyzing ${totalVideos} videos. You can leave this page open and come back later!`}
                    </span>
                  </div>
                )}

                {/* Actions après complétion */}
                {isCompleted && (
                  <div className="mt-4 pt-4 border-t border-border-subtle">
                    {/* Message de succès */}
                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-green-400 text-sm">
                        {language === "fr"
                          ? `✅ Analyse terminée ! ${(progress as ExtendedPlaylistTaskStatus).result?.num_videos || totalVideos} vidéos analysées avec succès.`
                          : `✅ Analysis complete! ${(progress as ExtendedPlaylistTaskStatus).result?.num_videos || totalVideos} videos analyzed successfully.`}
                      </p>
                      {(progress as ExtendedPlaylistTaskStatus).result
                        ?.num_skipped ? (
                        <p className="text-amber-400/70 text-xs mt-1">
                          {language === "fr"
                            ? `⚠️ ${(progress as ExtendedPlaylistTaskStatus).result?.num_skipped} vidéo(s) ignorée(s) (transcript indisponible)`
                            : `⚠️ ${(progress as ExtendedPlaylistTaskStatus).result?.num_skipped} video(s) skipped (transcript unavailable)`}
                        </p>
                      ) : null}
                      {(progress as ExtendedPlaylistTaskStatus).result
                        ?.processing_time ? (
                        <p className="text-text-muted text-xs mt-1">
                          {language === "fr"
                            ? `Temps de traitement : ${Math.round((progress as ExtendedPlaylistTaskStatus).result!.processing_time!)}s`
                            : `Processing time: ${Math.round((progress as ExtendedPlaylistTaskStatus).result!.processing_time!)}s`}
                        </p>
                      ) : null}
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => {
                          const pid =
                            (progress as ExtendedPlaylistTaskStatus).result
                              ?.playlist_id ||
                            (progress as ExtendedPlaylistTaskStatus)
                              .playlist_id;
                          if (pid) {
                            navigate(`/playlist/${pid}`);
                          } else {
                            navigate("/history");
                          }
                        }}
                        className="btn btn-primary"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {language === "fr"
                          ? "Voir les détails & outils"
                          : "View details & tools"}
                      </button>
                      <button
                        onClick={() => {
                          setProgress(null);
                          setDisplayPercent(0);
                          setSmartInput({
                            mode: "url",
                            searchLanguages: ["fr", "en"],
                          });
                          localStorage.removeItem("deepsight_last_playlist");
                        }}
                        className="btn btn-secondary"
                      >
                        <Rocket className="w-4 h-4" />
                        {language === "fr"
                          ? "Nouvelle analyse"
                          : "New analysis"}
                      </button>
                    </div>
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
                    {language === "fr"
                      ? "Playlists récentes"
                      : "Recent playlists"}
                  </h2>
                  <button
                    onClick={loadHistory}
                    className="text-text-muted hover:text-text-primary transition-colors"
                    disabled={loadingHistory}
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${loadingHistory ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="p-8 flex justify-center">
                    <DeepSightSpinnerSmall />
                  </div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <ListVideo className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>
                      {language === "fr"
                        ? "Aucune playlist analysée"
                        : "No playlists analyzed"}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {history.map((item) => (
                      <div
                        key={item.playlist_id}
                        className="p-4 hover:bg-bg-secondary/50 transition-colors cursor-pointer group"
                        onClick={() =>
                          navigate(`/playlist/${item.playlist_id}`)
                        }
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-10 bg-bg-tertiary rounded flex items-center justify-center">
                            <ListVideo className="w-5 h-5 text-text-muted" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary truncate">
                              {item.playlist_title}
                            </h3>
                            <p className="text-sm text-text-secondary">
                              {item.num_processed}/{item.num_videos}{" "}
                              {language === "fr" ? "vidéos" : "videos"}
                            </p>
                          </div>

                          <button
                            onClick={(e) =>
                              handleDeleteFromHistory(e, item.playlist_id)
                            }
                            disabled={deletingPlaylistId === item.playlist_id}
                            className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title={language === "fr" ? "Supprimer" : "Delete"}
                          >
                            {deletingPlaylistId === item.playlist_id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
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
        language={language as "fr" | "en"}
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
