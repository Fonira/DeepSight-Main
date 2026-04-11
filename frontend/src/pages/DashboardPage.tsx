/**
 * DEEP SIGHT v5.1 — Dashboard Page
 * Interface d'analyse complète avec design académique sobre
 * 
 * 🆕 v5.1: Ajout estimation temps pour vidéos simples
 * 
 * FONCTIONNALITÉS CONSERVÉES:
 * - ▶️ Player YouTube intégré avec timecodes cliquables
 * - 🌻 Intégration Tournesol (scores éthiques)
 * - 💬 Chat contextuel avec recherche web
 * - 📊 Fact-checking
 * - 📥 Export (PDF, Markdown, Texte)
 * - 🎯 Détection automatique de catégorie
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ListVideo, BookOpen,
  Play, Video, ChevronDown, Clock, Timer,
  Sparkles,
  ExternalLink, MessageCircle, X,
  AlertCircle, Microscope, XCircle,
} from "lucide-react";
import { DeepSightSpinner } from "../components/ui";
import { videoApi, chatApi, reliabilityApi, ApiError } from "../services/api";
import type { Summary, TaskStatus, ChatQuota, DiscoveryResponse, VideoCandidate, ReliabilityResult, EnrichedConcept } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from '../hooks/useTranslation';
import { normalizePlanId } from '../config/planPrivileges';
import { VideoPlayer, VideoPlayerRef } from "../components/VideoPlayer";
import { createTimecodeMarkdownComponents, TimecodeInfo } from "../components/TimecodeRenderer";
import { TournesolWidget, TournesolMini } from "../components/TournesolWidget";
import { Sidebar } from "../components/layout/Sidebar";
import { ChatPanel } from "../components/ChatPanel";
import DoodleBackground from '../components/DoodleBackground';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { SEO } from '../components/SEO';
import SmartInputBar, { SmartInputValue } from "../components/SmartInputBar";
import { TournesolTrendingSection } from "../components/TournesolTrendingSection";
import { RecentAnalysesSection } from "../components/RecentAnalysesSection";
// "Le Saviez-Vous" — placements organiques
import { DashboardInsight } from "../components/DashboardInsight";
import { LoadingInsight } from "../components/LoadingInsight";
import VideoDiscoveryModal from "../components/VideoDiscoveryModal";
import { ThumbnailImage } from "../components/ThumbnailImage";
import { FreshnessIndicator } from "../components/FreshnessIndicator";
import { FactCheckLite } from "../components/FactCheckLite";
// 💰 Monetization components
import { CreditAlert } from "../components/CreditAlert";
import { UpgradePromptModal } from "../components/UpgradePromptModal";
import { FreeTrialLimitModal } from "../components/FreeTrialLimitModal";
// 🎨 Customization Panel v4
import { CustomizationPanel } from "../components/analysis/CustomizationPanel";
import { AnalysisCustomization, DEFAULT_CUSTOMIZATION, customizationToApiParams } from "../types/analysis";
// 📊 AnalysisHub — Panel intelligent à onglets
import { AnalysisHub } from "../components/AnalysisHub";
// 📥 Export & Share
import { ExportMenu } from "../components/analysis/ExportMenu";
import { AudioPlayer } from "../components/analysis/AudioPlayer";
import { ShareButton } from "../components/analysis/ShareButton";
import { AnalysisActionBar } from "../components/analysis/AnalysisActionBar";
import { sanitizeTitle } from "../utils/sanitize";
// 🎙️ Voice Chat
import VoiceButton from "../components/voice/VoiceButton";
import { VoiceModal } from "../components/voice/VoiceModal";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { OnboardingVoice } from "../components/voice/OnboardingVoice";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

// Catégories pour affichage résultat uniquement (sélection supprimée — auto-détection forcée)
const CATEGORY_DISPLAY: Record<string, { emoji: string; name: string }> = {
  auto: { emoji: '🎯', name: 'Auto-détection' },
  interview_podcast: { emoji: '🎙️', name: 'Interview/Podcast' },
  tech: { emoji: '💻', name: 'Technologie' },
  science: { emoji: '🔬', name: 'Science' },
  education: { emoji: '📚', name: 'Éducation' },
  finance: { emoji: '💰', name: 'Finance' },
  gaming: { emoji: '🎮', name: 'Gaming' },
  culture: { emoji: '🎨', name: 'Culture' },
  news: { emoji: '📰', name: 'Actualités' },
  health: { emoji: '🏥', name: 'Santé' },
};

// MODES supprimé — fusionné dans WritingTone (CustomizationPanel v4)

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatReadingTime = (wordCount: number): string => `${Math.ceil(wordCount / 200)} min`;

const getCategoryInfo = (cat: string) => CATEGORY_DISPLAY[cat] || { emoji: "📄", name: cat };

// 🆕 Helper pour détecter si une URL est une playlist
const isPlaylistUrl = (url: string): boolean => {
  if (!url) return false;
  // Playlist pure: youtube.com/playlist?list=XXX
  if (/youtube\.com\/playlist\?list=/i.test(url)) return true;
  // URL avec paramètre list mais SANS video_id (watch?list=XXX sans v=)
  if (/youtube\.com\/watch\?.*list=/i.test(url) && !/[?&]v=/i.test(url)) return true;
  // URL qui est UNIQUEMENT un paramètre list (pas de vidéo)
  if (/^https?:\/\/[^/]*youtube[^/]*\/.*[?&]list=[A-Za-z0-9_-]+$/i.test(url) && !/[?&]v=/i.test(url)) return true;
  return false;
};

export const DashboardPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { language } = useTranslation();
  const navigate = useNavigate();

  // États principaux
  const [, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  // mode dérivé de analysisCustomization.writingTone via customizationToApiParams
  
  // 🆕 États pour l'entrée intelligente
  const [smartInput, setSmartInput] = useState<SmartInputValue>({
    mode: 'search',
    searchLanguages: ['fr', 'en'],
  });
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  const [selectedVideoTitle, setSelectedVideoTitle] = useState<string | null>(null);
  
  // 🔬 Deep Research — toggle pour Pro+
  const [deepResearch, setDeepResearch] = useState(false);
  
  // 🎨 État pour la personnalisation avancée v2
  const [analysisCustomization, setAnalysisCustomization] = useState<AnalysisCustomization>(DEFAULT_CUSTOMIZATION);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  
  // États du chat
  const [chatOpen, setChatOpen] = useState(false);
  const [, setChatMinimized] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [chatQuota, setChatQuota] = useState<ChatQuota | null>(null);
  const [wsQuota, setWsQuota] = useState<{ used: number; limit: number; remaining: number } | undefined>(undefined);
  
  // 💰 Monetization states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLimitType] = useState<'credits' | 'chat' | 'analysis'>('credits');
  const [showFreeTrialModal, setShowFreeTrialModal] = useState(false);
  const [analysisCountThisMonth, setAnalysisCountThisMonth] = useState(0);
  const [lastAnalysisTimeSaved, setLastAnalysisTimeSaved] = useState(0);
  const [concepts, setConcepts] = useState<EnrichedConcept[]>([]);
  const [conceptsLoading, setConceptsLoading] = useState(false);
  const [conceptsProvider, setConceptsProvider] = useState<string>('none');
  const [conceptsCategories, setConceptsCategories] = useState<Record<string, { label: string; icon: string; count: number }>>({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showTournesolDetails, setShowTournesolDetails] = useState(false);

  // 🆕 État pour détection de playlist
  const [playlistDetected, setPlaylistDetected] = useState(false);

  // 📥 Audio Player
  const [audioPlayerUrl, setAudioPlayerUrl] = useState<string | null>(null);

  // 🎙️ Voice Chat
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const voiceChat = useVoiceChat({ summaryId: selectedSummary?.id ?? 0, language: language as 'fr' | 'en' });

  // 🎙️ Onboarding Voice — show for users who haven't dismissed it yet
  const [showOnboardingVoice, setShowOnboardingVoice] = useState(() => {
    try { return !window.sessionStorage?.getItem?.('ds_onboarding_voice_dismissed'); } catch { return true; }
  });
  const isNewUser = !selectedSummary && user?.credits !== undefined && (user.credits ?? 0) >= 4;

  // 🕐 États Freshness & Fact-Check LITE
  const [reliabilityData, setReliabilityData] = useState<ReliabilityResult | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  
  // Player YouTube
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerStartTime, setPlayerStartTime] = useState(0);
  const playerRef = useRef<VideoPlayerRef>(null);

  // 📍 Ref pour scroll automatique vers les résultats après analyse
  const resultsRef = useRef<HTMLDivElement>(null);

  const scrollToResults = useCallback(() => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }, []);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<boolean>(false);
  const currentTaskIdRef = useRef<string | null>(null);

  const normalizedPlan = normalizePlanId(user?.plan);
  const isProUser = normalizedPlan === 'pro';
  // Note: isStarterPlus réservé pour futures fonctionnalités
  const isExpertUser = normalizedPlan === 'pro'; // Pro est le plan le plus élevé
  const canDeepResearch = ['pro', 'expert', 'admin', 'unlimited'].includes(normalizedPlan);
  
  // SUGGESTED_QUESTIONS disponible pour le chat: language === 'fr' ? SUGGESTED_QUESTIONS_FR : SUGGESTED_QUESTIONS_EN

  // === SESSION ONLY: Ne plus persister la dernière analyse ===
  // L'analyse reste uniquement pour la session courante (pas de localStorage)
  // L'onglet Analyse est TOUJOURS vide quand on y arrive depuis un autre onglet.
  // Les synthèses de l'historique s'affichent désormais inline dans l'onglet Historique.

  // === 🕐 Charger les données de fiabilité quand un résumé est sélectionné ===
  
  useEffect(() => {
    const fetchReliability = async () => {
      if (!selectedSummary?.id) {
        setReliabilityData(null);
        return;
      }
      
      setReliabilityLoading(true);
      try {
        const data = await reliabilityApi.getReliability(selectedSummary.id);
        setReliabilityData(data);
      } catch {
        setReliabilityData(null);
      } finally {
        setReliabilityLoading(false);
      }
    };

    fetchReliability();
  }, [selectedSummary?.id]);

  // === 🏷️ Fonction pour charger les concepts enrichis ===
  
  const loadConcepts = async (summaryId: number) => {
    setConceptsLoading(true);
    try {
      // Utiliser l'endpoint enrichi (Mistral + Perplexity pour Pro/Expert)
      const data = await videoApi.getEnrichedConcepts(summaryId);
      setConcepts(data.concepts || []);
      setConceptsProvider(data.provider || 'none');
      setConceptsCategories(data.categories || {});
    } catch {
      setConcepts([]);
      setConceptsProvider('none');
      setConceptsCategories({});
    } finally {
      setConceptsLoading(false);
    }
  };

  // === Handlers timecodes ===
  
  const handleTimecodeClick = useCallback((seconds: number, _info?: TimecodeInfo) => {
    if (playerVisible && playerRef.current) {
      playerRef.current.seekTo(seconds);
    } else {
      setPlayerStartTime(seconds);
      setPlayerVisible(true);
    }
  }, [playerVisible]);

  const chatMarkdownComponents = useMemo(() => {
    return createTimecodeMarkdownComponents({
      mode: "embedded",
      onTimecodeClick: handleTimecodeClick,
      linkClassName: "text-accent-primary hover:underline cursor-pointer",
    });
  }, [handleTimecodeClick]);

  // === Charger quota chat ===
  
  useEffect(() => {
    if (selectedSummary?.id) {
      chatApi.getQuota(selectedSummary.id).then(setChatQuota).catch(console.error);
    }
  }, [selectedSummary?.id]);

  // === 🆕 Charger historique chat persistant ===
  
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!selectedSummary?.id) return;
      
      try {
        const history = await chatApi.getHistory(selectedSummary.id);
        
        // L'API retourne maintenant directement un tableau normalisé
        if (history && Array.isArray(history) && history.length > 0) {
          // Convertir l'historique du backend au format du frontend
          const formattedMessages: ChatMessage[] = history.map((msg: any, index: number) => ({
            id: msg.id?.toString() || `history-${index}-${Date.now()}`,
            role: msg.role as 'user' | 'assistant',
            // S'assurer que content est une string
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
            timestamp: msg.created_at ? new Date(msg.created_at) : undefined,
            sources: msg.sources || [],
            web_search_used: msg.web_search_used || false,
          }));
          
          setChatMessages(formattedMessages);
        } else {
          setChatMessages([]);
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
        // Pas d'erreur visible pour l'utilisateur, on commence avec un historique vide
        setChatMessages([]);
      }
    };
    
    loadChatHistory();
  }, [selectedSummary?.id]);

  // === Analyse vidéo ===

  // ? Quick Chat � Direct chat sans analyse
  const [quickChatLoading, setQuickChatLoading] = useState(false);
  
  const handleQuickChat = async (url?: string) => {
    if (smartInput.mode !== 'url' || !smartInput.url?.trim()) return;
    
    setQuickChatLoading(true);
    setError(null);
    
    try {
      const chatUrl = url || smartInput.url?.trim() || '';
      const response = await videoApi.quickChat(chatUrl, language);
      
      if (response.summary_id) {
        // Naviguer directement vers le chat avec ce summary_id
        navigate(`/chat?summary=${response.summary_id}`);
      }
    } catch (err: any) {
      setError(err?.message || (language === 'fr' 
        ? "Impossible de pr�parer le chat. Essayez l'analyse compl�te."
        : "Unable to prepare chat. Try full analysis."));
    } finally {
      setQuickChatLoading(false);
    }
  };

  // === HANDLER: Analyse d'images ===
  const handleImageAnalyze = async (
    images: Array<{ id: string; data: string; mimeType: string; preview: string; filename?: string; size: number }>,
    title?: string,
    context?: string,
  ) => {
    if (!images.length) return;
    setLoading(true);
    setError(null);
    setLoadingMessage(
      language === 'fr'
        ? `Analyse de ${images.length} image(s) en cours...`
        : `Analyzing ${images.length} image(s)...`
    );

    try {
      const imgApiParams = customizationToApiParams(analysisCustomization, language as 'fr' | 'en');
      const response = await videoApi.analyzeImages({
        images: images.map(img => ({
          data: img.data,
          mime_type: img.mimeType,
          filename: img.filename,
        })),
        title: title || undefined,
        context: context || undefined,
        mode: imgApiParams.mode,
        lang: imgApiParams.lang,
      });

      if (response.task_id) {
        pollingRef.current = true;
        await pollTaskStatus(response.task_id);
      }
    } catch (err) {
      console.error('[IMAGES] Error:', err);
      const message = err instanceof Error ? err.message : (language === 'fr' ? "Erreur lors de l'analyse des images" : "Image analysis error");
      setError(message);
    } finally {
      setLoading(false);
      pollingRef.current = false;
    }
  };

    const handleAnalyze = async () => {
    // Validation selon le mode
    if (smartInput.mode === 'url' && !smartInput.url?.trim()) return;
    if (smartInput.mode === 'text' && !smartInput.rawText?.trim()) return;
    if (smartInput.mode === 'search' && !smartInput.searchQuery?.trim()) return;
    if (smartInput.mode === 'library' && !smartInput.libraryQuery?.trim()) return;

    // Validation URL côté client — supporte YouTube + TikTok
    if (smartInput.mode === 'url' && smartInput.url?.trim()) {
      const YOUTUBE_PATTERNS = [
        /youtube\.com\/watch\?v=/i,
        /youtu\.be\//i,
        /youtube\.com\/embed\//i,
        /youtube\.com\/shorts\//i,
        /youtube\.com\/live\//i,
        /youtube\.com\/playlist\?list=/i,
        /youtube\.com\/watch\?.*list=/i,
        /[?&]list=[A-Za-z0-9_-]+/i,
      ];
      const TIKTOK_PATTERNS = [
        /tiktok\.com\/@[\w.-]+\/video\/\d+/i,
        /vm\.tiktok\.com\/[\w-]+/i,
        /m\.tiktok\.com\/v\/\d+/i,
        /tiktok\.com\/t\/[\w-]+/i,
        /tiktok\.com\/video\/\d+/i,
      ];
      const ALL_PATTERNS = [...YOUTUBE_PATTERNS, ...TIKTOK_PATTERNS];
      const isValidUrl = ALL_PATTERNS.some(p => p.test(smartInput.url!.trim()));
      if (!isValidUrl) {
        setError(language === 'fr'
          ? "URL invalide. Collez un lien YouTube ou TikTok."
          : "Invalid URL. Please paste a YouTube or TikTok link.");
        return;
      }
    }

    // 🆕 Détection de playlist - redirection vers page Playlists
    if (smartInput.mode === 'url' && isPlaylistUrl(smartInput.url || '')) {
      setPlaylistDetected(true);
      return;
    }

    setLoading(true);
    setError(null);
    setPlaylistDetected(false);
    setLoadingProgress(0);
    setChatMessages([]);
    setChatOpen(false);
    setSelectedVideoTitle(null);

    try {
      // === MODE LIBRARY: Recherche sémantique ===
      if (smartInput.mode === 'library') {
        setLoadingMessage(language === 'fr' ? "Recherche dans la bibliothèque..." : "Searching library...");

        const { searchApi } = await import('../services/api');
        const searchResult = await searchApi.semanticSearch(smartInput.libraryQuery!, 20);

        if (searchResult.results.length > 0) {
          // Convert to VideoCandidate format for the discovery modal
          const candidates: VideoCandidate[] = searchResult.results.map((r, idx) => ({
            video_id: r.video_id,
            title: r.video_title,
            channel: r.video_channel,
            thumbnail_url: r.thumbnail_url || `https://img.youtube.com/vi/${r.video_id}/mqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${r.video_id}`,
            quality_score: Math.round(r.score * 100),
            relevance_score: Math.round(r.score * 100),
            view_count: 0,
            duration_seconds: 0,
            published_at: '',
            language: '',
            description: r.text_preview,
          }));
          setDiscoveryResult({
            query: smartInput.libraryQuery!,
            videos: candidates,
            total_found: searchResult.total_results,
            search_metadata: { source: 'library', languages: [] },
          } as DiscoveryResponse);
          setShowDiscoveryModal(true);
        } else {
          setError(language === 'fr'
            ? "Aucun résultat trouvé dans la bibliothèque."
            : "No results found in the library.");
        }
        setLoading(false);
        return;
      }

      // === MODE SEARCH: Découverte intelligente ===
      if (smartInput.mode === 'search') {
        setLoadingMessage(language === 'fr' ? "Recherche intelligente..." : "Smart search...");

        const discovery = await videoApi.discover(
          smartInput.searchQuery!,
          {
            languages: smartInput.searchLanguages || [language, language === 'fr' ? 'en' : 'fr'],
            limit: 20,
            minQuality: 30,
            targetDuration: 'default'
          }
        );

        setDiscoveryResult(discovery);
        setShowDiscoveryModal(true);
        setLoading(false);
        return;
      }

      // === MODE URL: Analyse classique avec personnalisation v2 ===
      if (smartInput.mode === 'url') {
        setVideoUrl(smartInput.url || '');
        setLoadingMessage(language === 'fr' ? "Démarrage de l'analyse..." : "Starting analysis...");
        
        // 🎨 Utiliser l'API v2 avec personnalisation v4 (Focus + Ton + Langue)
        const apiParams = customizationToApiParams(analysisCustomization, language as 'fr' | 'en');
        const response = await videoApi.analyzeV2(
          smartInput.url!,
          {
            category: 'auto',
            mode: apiParams.mode,
            deepResearch,
            lang: apiParams.lang,
            userPrompt: apiParams.user_prompt,
            antiAIDetection: apiParams.anti_ai_detection,
            writingStyle: apiParams.writing_style,
            targetLength: apiParams.target_length,
          }
        );
        
        // Cas 1: Analyse déjà en cache (result.summary_id ou task_id format cached_<id>)
        if (response.status === "completed") {
          const cachedSummaryId = response.result?.summary_id
            || (response.task_id?.startsWith("cached_") ? parseInt(response.task_id.replace("cached_", "")) : null);

          if (cachedSummaryId) {
            setLoadingMessage(language === 'fr' ? "Chargement du résumé..." : "Loading summary...");
            setLoadingProgress(90);

            const fullSummary = await videoApi.getSummary(cachedSummaryId);
            setSelectedSummary(fullSummary);
            scrollToResults();
            setPlayerVisible(false);
            setLoadingProgress(100);
            await refreshUser(true);
            return;
          }
        }

        // Cas 2: Nouvelle analyse en cours (task asynchrone)
        if (response.task_id && response.status !== "completed") {
          pollingRef.current = true;
          await pollTaskStatus(response.task_id);
        }
        return;
      }
      
      // === MODE TEXT: Analyse de texte brut ===
      if (smartInput.mode === 'text') {
        setLoadingMessage(language === 'fr' ? "Analyse du texte..." : "Analyzing text...");

        const textApiParams = customizationToApiParams(analysisCustomization, language as 'fr' | 'en');
        const response = await videoApi.analyzeHybrid({
          inputType: 'raw_text',
          rawText: smartInput.rawText!,
          textTitle: smartInput.textTitle,
          textSource: smartInput.textSource,
          mode: textApiParams.mode,
          lang: textApiParams.lang,
          deepResearch,
        });

        if (response.task_id) {
          pollingRef.current = true;
          await pollTaskStatus(response.task_id);
        }
      }

    } catch (err) {
      console.error('❌ [ANALYZE] Error:', err);
      const message = err instanceof ApiError 
        ? err.message 
        : (err instanceof Error ? err.message : (language === 'fr' ? "Erreur lors de l'analyse" : "Analysis error"));
      setError(message);
    } finally {
      setLoading(false);
      pollingRef.current = false;
    }
  };
  
  // Handler pour sélection depuis la modal de découverte
  // → Peuple l'URL dans le SmartInput et laisse l'utilisateur configurer les options avant de lancer l'analyse
  const handleSelectDiscoveredVideo = (video: VideoCandidate) => {
    const url = `https://www.youtube.com/watch?v=${video.video_id}`;

    // 1. Fermer la modal
    setShowDiscoveryModal(false);

    // 2. Peupler le SmartInput en mode URL avec la vidéo sélectionnée
    setSmartInput({
      mode: 'url',
      url,
    });
    setVideoUrl(url);

    // 3. Ouvrir le panneau de personnalisation pour que l'utilisateur puisse configurer
    setShowCustomizationPanel(true);

    // 4. Reset des erreurs précédentes & afficher le titre sélectionné
    setError(null);
    setSelectedVideoTitle(video.title);
  };

  const handleCancelAnalysis = useCallback(async () => {
    const taskId = currentTaskIdRef.current;
    if (!taskId) return;

    try {
      pollingRef.current = false;
      await videoApi.cancelTask(taskId);
    } catch (err) {
      console.warn('[CANCEL] Error cancelling task:', err);
    } finally {
      setLoading(false);
      setLoadingProgress(0);
      setLoadingMessage('');
      currentTaskIdRef.current = null;
    }
  }, []);

  const pollTaskStatus = async (taskId: string) => {
    currentTaskIdRef.current = taskId;
    const fallbackMsgFr = ["Traitement en cours...", "Analyse du contenu...", "Génération du résumé...", "Finalisation..."];
    const fallbackMsgEn = ["Processing...", "Analyzing content...", "Generating summary...", "Finalizing..."];
    const fallbackMessages = language === 'fr' ? fallbackMsgFr : fallbackMsgEn;

    let attempts = 0;
    const maxAttempts = 180; // 9 minutes max


    while (attempts < maxAttempts && pollingRef.current) {
      try {
        const status: TaskStatus = await videoApi.getTaskStatus(taskId);

        // Handle cancelled status
        if (status.status === "cancelled") {
          setLoading(false);
          setLoadingProgress(0);
          setLoadingMessage('');
          currentTaskIdRef.current = null;
          return;
        }

        // Screenshot redirect: Mistral detected a YouTube/TikTok screenshot → follow new task
        if (status.status === "redirect" && status.result?.new_task_id) {
          const platform = status.result.platform || 'video';
          setLoadingMessage(
            language === 'fr'
              ? `Capture ${platform} détectée ! Analyse de la vidéo en cours...`
              : `${platform} screenshot detected! Analyzing video...`
          );
          setLoadingProgress(25);
          // Follow the redirected video analysis task
          await pollTaskStatus(status.result.new_task_id);
          return;
        }

        if (status.status === "completed" && status.result) {
          setLoadingProgress(95);
          setLoadingMessage(language === 'fr' ? 'Chargement du résumé...' : 'Loading summary...');

          const summaryId = status.result.summary_id;
          if (summaryId) {
            const fullSummary = await videoApi.getSummary(summaryId);
            setSelectedSummary(fullSummary);
            scrollToResults();
          } else {
            setSelectedSummary(status.result.summary ?? null);
            scrollToResults();
          }

          setPlayerVisible(false);
          setLoadingProgress(100);
          await refreshUser(true);

          // 💰 Show friction modal for free users after analysis
          if (user?.plan === 'free') {
            const newCount = analysisCountThisMonth + 1;
            setAnalysisCountThisMonth(newCount);
            // Calculate time saved (video duration - 45 seconds analysis time)
            const videoDuration = status.result.summary?.video_duration ?? 600;
            setLastAnalysisTimeSaved(Math.max(0, videoDuration - 45));
            // Show modal after 2nd analysis or later
            if (newCount >= 2) {
              setTimeout(() => setShowFreeTrialModal(true), 1500);
            }
          }
          return;
        } else if (status.status === "failed") {
          throw new Error(status.error || (language === 'fr' ? "L'analyse a échoué" : "Analysis failed"));
        }
        
        // 🆕 Utiliser les valeurs du backend si disponibles
        if (status.progress !== undefined && status.progress > 0) {
          setLoadingProgress(Math.max(30, Math.min(95, status.progress)));
        }
        
        if (status.message) {
          setLoadingMessage(status.message);
        } else {
          const idx = Math.min(Math.floor(attempts / 15), fallbackMessages.length - 1);
          setLoadingMessage(fallbackMessages[idx]);
        }
        
        await new Promise(r => setTimeout(r, 2000));  // 2s pour réactivité
        attempts++;
      } catch (err) {
        console.error(`❌ [POLL] Error:`, err);
        throw err;
      }
    }
    
    throw new Error(language === 'fr' ? "Timeout - l'analyse prend trop de temps" : "Timeout - analysis taking too long");
  };

  // === Chat ===
  
  const handleSendChat = async (customMessage?: string, options?: { useWebSearch?: boolean }) => {
    const message = customMessage || chatInput.trim();
    if (!message || !selectedSummary?.id) return;

    // Si options.useWebSearch est explicitement true (bouton "Approfondir"), forcer web search
    const forceWebSearch = options?.useWebSearch === true;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await chatApi.send(
        selectedSummary.id,
        message,
        forceWebSearch || (isProUser && webSearchEnabled)
      );
      
      
      // Vérifier que la réponse existe
      if (!response || !response.response) {
        throw new Error("Empty response from server");
      }
      
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        sources: response.sources || [],
        web_search_used: response.web_search_used || false,
      };
      
      setChatMessages(prev => [...prev, assistantMsg]);

      // Mettre à jour web search quota depuis la réponse
      if (response.quota_info) {
        const qi = response.quota_info;
        if (typeof qi.web_search_used === 'number' && typeof qi.web_search_limit === 'number') {
          setWsQuota({
            used: qi.web_search_used,
            limit: qi.web_search_limit,
            remaining: qi.web_search_remaining ?? Math.max(0, qi.web_search_limit - qi.web_search_used),
          });
        }
      }

      // Rafraîchir quota chat
      try {
        const newQuota = await chatApi.getQuota(selectedSummary.id);
        setChatQuota(newQuota);
      } catch {
        // Quota refresh failed silently
      }
    } catch (err) {
      console.error('❌ Chat error:', err);
      const errorContent = err instanceof Error ? err.message : 
        (language === 'fr' ? "Erreur lors de la réponse. Veuillez réessayer." : "Error responding. Please try again.");
      
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: errorContent,
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO title="Analyse" path="/dashboard" />
      <ErrorBoundary fallback={null}><DoodleBackground variant="analysis" /></ErrorBoundary>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

      {/* Main content - responsive margin */}
      <main className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? 'ml-[60px]' : 'ml-[240px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-5xl mx-auto">

            {/* Header - with top padding on mobile for hamburger button */}
            <header className="mb-6 lg:mb-8 pt-2 lg:pt-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="font-semibold text-xl sm:text-2xl mb-2 text-text-primary">
                    {language === 'fr' ? 'Analyse vidéo' : 'Video Analysis'}
                  </h1>
                  <p className="text-text-secondary text-xs sm:text-sm">
                    {language === 'fr'
                      ? 'URL YouTube / TikTok, texte brut, ou recherche intelligente de vidéos.'
                      : 'YouTube / TikTok URL, raw text, or intelligent video search.'}
                  </p>
                </div>
                {/* Platform logos */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <img src="/platforms/youtube-logo-white.png" alt="YouTube" className="h-5 sm:h-6 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-110" />
                  <div className="w-px h-5 bg-border-subtle" />
                  <img src="/platforms/tiktok-logo-white.png" alt="TikTok" className="h-5 sm:h-6 opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-110" />
                  <div className="w-px h-5 bg-border-subtle" />
                  <a href="https://tournesol.app" target="_blank" rel="noreferrer" className="opacity-60 hover:opacity-100 transition-all duration-300 hover:scale-110" title="Tournesol — Recommandations éthiques">
                    <img src="/platforms/tournesol-logo.png" alt="Tournesol" className="h-5 sm:h-6" />
                  </a>
                  <div className="w-px h-5 bg-border-subtle" />
                  <div className="flex items-center gap-1.5 opacity-50 hover:opacity-90 transition-all duration-300">
                    <img src="/platforms/mistral-logo-white.svg" alt="Mistral AI" className="h-4 sm:h-5" />
                  </div>
                </div>
              </div>
            </header>

            {/* 🆕 Smart Input Section */}
            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
              <SmartInputBar
                value={smartInput}
                onChange={setSmartInput}
                onSubmit={handleAnalyze}
                onImageSubmit={handleImageAnalyze}
                loading={loading}
                disabled={loading}
                userCredits={user?.credits || 0}
                language={language as 'fr' | 'en'}
                onQuickChat={handleQuickChat}
                isQuickChatting={quickChatLoading}
              />

              {/* Quota */}
              {user && (
                <div className="mt-3 pt-3 border-t border-border-subtle text-xs text-text-tertiary text-right">
                  {user.analysis_count}/{user.analysis_limit} {language === 'fr' ? 'analyses' : 'analyses'}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* 🎬 SELECTED VIDEO BANNER — Après sélection depuis Recherche YouTube */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {selectedVideoTitle && smartInput.mode === 'url' && smartInput.url && !loading && !selectedSummary && (
              <div className="card p-4 mb-4 sm:mb-6 animate-fadeIn border-accent-primary/30 bg-accent-primary/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                      <Video className="w-4 h-4 text-accent-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {selectedVideoTitle}
                      </p>
                      <p className="text-xs text-accent-primary">
                        {language === 'fr'
                          ? 'Configurez vos options ci-dessous puis lancez l\'analyse'
                          : 'Configure your options below then start the analysis'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVideoTitle(null);
                      setSmartInput({ mode: 'search', searchLanguages: ['fr', 'en'] });
                    }}
                    className="p-1.5 rounded-lg hover:bg-bg-hover text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                    title={language === 'fr' ? 'Annuler la sélection' : 'Cancel selection'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* 🎨 CUSTOMIZATION PANEL — Card SÉPARÉE pour éviter chevauchement dropdown */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
                <button
                  type="button"
                  onClick={() => setShowCustomizationPanel(!showCustomizationPanel)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-bg-tertiary hover:bg-bg-hover border border-border-default transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center transition-all
                      ${analysisCustomization.antiAIDetection
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-accent-primary/10 text-accent-primary'}
                    `}>
                      {analysisCustomization.antiAIDetection ? (
                        <Shield className="w-5 h-5" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                        {language === 'fr' ? 'Personnalisation avancée' : 'Advanced Customization'}
                        {analysisCustomization.antiAIDetection && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 font-semibold">
                            Anti-IA ✓
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-text-muted">
                        {analysisCustomization.userPrompt
                          ? (language === 'fr' ? 'Instructions personnalisées actives' : 'Custom instructions active')
                          : (language === 'fr' ? 'Focus, ton, longueur, langue...' : 'Focus, tone, length, language...')}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-text-muted transition-transform duration-200 ${showCustomizationPanel ? 'rotate-180' : ''}`} />
                </button>

                {/* Expandable panel */}
                <div className={`
                  overflow-hidden transition-all duration-300 ease-in-out
                  ${showCustomizationPanel ? 'max-h-[800px] opacity-100 mt-4' : 'max-h-0 opacity-0'}
                `}>
                  <CustomizationPanel
                    onCustomizationChange={setAnalysisCustomization}
                    initialCustomization={analysisCustomization}
                    language={language as 'fr' | 'en'}
                    disabled={loading}
                  />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* 🔬 DEEP RESEARCH TOGGLE — Pro+ only */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {canDeepResearch && (
              <div className="card p-4 mb-4 sm:mb-6 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`
                      w-10 h-10 rounded-lg flex items-center justify-center transition-all
                      ${deepResearch
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-bg-tertiary text-text-muted'}
                    `}>
                      <Microscope className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                        {language === 'fr' ? 'Recherche approfondie' : 'Deep Research'}
                        {deepResearch && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold">
                            +50 {language === 'fr' ? 'crédits' : 'credits'}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-text-muted block mt-0.5">
                        {language === 'fr'
                          ? 'Croise 40+ sources web pour vérifier et enrichir l\'analyse'
                          : 'Cross-references 40+ web sources to verify and enrich analysis'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeepResearch(!deepResearch)}
                    disabled={loading}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50
                      ${deepResearch ? 'bg-purple-500' : 'bg-bg-tertiary border border-border-default'}
                      ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    role="switch"
                    aria-checked={deepResearch}
                    aria-label={language === 'fr' ? 'Recherche approfondie' : 'Deep Research'}
                  >
                    <span className={`
                      inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
                      ${deepResearch ? 'translate-x-6' : 'translate-x-1'}
                    `} />
                  </button>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════ */}
            {/* 🆕 Loading State AMÉLIORÉ — Avec estimation de temps */}
            {/* ═══════════════════════════════════════════════════════════════ */}
            {loading && (
              <div className="card p-8 mb-6 animate-fadeIn">
                <div className="flex flex-col items-center text-center">
                  {/* ✨ DeepSight Spinner — Logo animé */}
                  <div className="mb-6">
                    <DeepSightSpinner size="lg" speed="normal" />
                  </div>
                  
                  {/* Message principal */}
                  <p className="text-text-primary font-semibold text-lg mb-2">{loadingMessage}</p>
                  
                  {/* 🆕 Estimation de temps */}
                  <p className="text-sm text-text-muted mb-4 flex items-center gap-1">
                    <Timer className="w-4 h-4" />
                    {language === 'fr' 
                      ? "Généralement quelques secondes à 1 minute" 
                      : "Usually a few seconds to 1 minute"}
                  </p>
                  
                  {/* Progress bar améliorée */}
                  <div className="w-full max-w-md mb-4">
                    <div className="h-3 rounded-full overflow-hidden bg-bg-tertiary relative">
                      {/* Fond animé */}
                      <div className="absolute inset-0 bg-gradient-to-r from-accent-primary/5 via-accent-primary/20 to-accent-primary/5 animate-pulse" />
                      {/* Barre de progression */}
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r from-accent-primary to-purple-500 relative overflow-hidden"
                        style={{ width: `${loadingProgress}%` }}
                      >
                        {/* Effet shimmer */}
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                          style={{ animation: 'shimmer 2s infinite' }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Pourcentage */}
                  <p className="text-sm font-medium text-text-tertiary tabular-nums">
                    {loadingProgress}%
                  </p>

                  {/* 💡 Knowledge Drip — Le Saviez-Vous pendant le chargement */}
                  <LoadingInsight />

                  {/* 🆕 Message informatif pour longues vidéos */}
                  {loadingProgress > 30 && loadingProgress < 90 && (
                    <p className="text-xs text-text-muted mt-3 max-w-sm">
                      {language === 'fr'
                        ? "💡 Les vidéos longues (>30min) peuvent prendre plus de temps."
                        : "💡 Long videos (>30min) may take longer."}
                    </p>
                  )}

                  {/* 🆕 Bouton Annuler l'analyse */}
                  <button
                    onClick={handleCancelAnalysis}
                    className="mt-5 px-5 py-2 text-sm text-text-muted hover:text-red-400 transition-all duration-200 flex items-center gap-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                  >
                    <XCircle className="w-4 h-4" />
                    {language === 'fr' ? 'Annuler l\'analyse' : 'Cancel analysis'}
                  </button>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="card p-4 mb-6 border-error/30 bg-error-muted animate-fadeIn">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-text-primary font-medium mb-1">
                      {language === 'fr' ? 'Erreur' : 'Error'}
                    </p>
                    <p className="text-text-secondary text-sm">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-text-tertiary hover:text-text-primary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 🆕 Playlist Detected Alert - Redirection vers page Playlists */}
            {playlistDetected && (
              <div className="card p-5 mb-6 border-violet-500/30 bg-violet-500/10 animate-fadeIn">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <ListVideo className="w-6 h-6 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold mb-1">
                      {language === 'fr' ? '📋 URL de playlist détectée' : '📋 Playlist URL detected'}
                    </h3>
                    <p className="text-text-secondary text-sm mb-4">
                      {language === 'fr'
                        ? "Cette URL correspond à une playlist YouTube. Essayez le Débat IA pour confronter deux vidéos de cette playlist !"
                        : "This URL corresponds to a YouTube playlist. Try AI Debate to compare two videos from this playlist!"}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => navigate('/debate')}
                        className="btn btn-primary"
                      >
                        <ListVideo className="w-4 h-4" />
                        {language === 'fr' ? 'Aller au Débat IA' : 'Go to AI Debate'}
                      </button>
                      <button
                        onClick={() => setPlaylistDetected(false)}
                        className="btn btn-secondary"
                      >
                        <X className="w-4 h-4" />
                        {language === 'fr' ? 'Fermer' : 'Close'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results */}
            {selectedSummary && !loading && (
              <div ref={resultsRef} className="space-y-6 animate-fadeInUp">
                {/* Video Info Card */}
                <div className="card overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Thumbnail / Player - responsive height */}
                    <div className="w-full lg:w-96 flex-shrink-0 relative bg-bg-tertiary max-h-[50vh] lg:max-h-none overflow-hidden">
                      {playerVisible ? (
                        <div className="relative aspect-video">
                          <VideoPlayer
                            ref={playerRef}
                            videoId={selectedSummary.video_id}
                            platform={selectedSummary.platform || 'youtube'}
                            initialTime={playerStartTime}
                            className="w-full h-full"
                          />
                          <button
                            onClick={() => setPlayerVisible(false)}
                            className="absolute top-2 right-2 w-10 h-10 sm:w-8 sm:h-8 rounded-lg bg-bg-primary/80 backdrop-blur flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <X className="w-5 h-5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="aspect-video relative cursor-pointer group"
                          onClick={() => setPlayerVisible(true)}
                        >
                          <ThumbnailImage
                            thumbnailUrl={selectedSummary.thumbnail_url}
                            videoId={selectedSummary.video_id}
                            title={selectedSummary.video_title}
                            category={selectedSummary.category}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                              <Play className="w-6 h-6 sm:w-7 sm:h-7 text-bg-primary ml-1" />
                            </div>
                          </div>
                          {/* Durée */}
                          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-medium">
                            {formatDuration(selectedSummary.video_duration || 0)}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Info - responsive padding */}
                    <div className="flex-1 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                        <h2 className="font-semibold text-lg sm:text-xl leading-tight text-text-primary line-clamp-2">
                          {sanitizeTitle(selectedSummary.video_title)}
                        </h2>
                        <a
                          href={`https://youtube.com/watch?v=${selectedSummary.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-text-tertiary hover:text-accent-primary transition-colors p-1"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </a>
                      </div>

                      <p className="text-text-secondary text-xs sm:text-sm mb-3 sm:mb-4">
                        {sanitizeTitle(selectedSummary.video_channel)}
                      </p>

                      {/* Badges - scrollable on mobile */}
                      <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                        <span className="badge">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(selectedSummary.video_duration || 0)}
                        </span>
                        {selectedSummary.category && (
                          <span className="badge badge-primary">
                            {getCategoryInfo(selectedSummary.category).emoji} {getCategoryInfo(selectedSummary.category).name}
                          </span>
                        )}
                        <span className="badge">
                          {selectedSummary.mode || 'standard'}
                        </span>
                        {selectedSummary.word_count && (
                          <span className="badge">
                            <BookOpen className="w-3.5 h-3.5" />
                            ~{formatReadingTime(selectedSummary.word_count)} lecture
                          </span>
                        )}
                        {/* 🕐 Badge fraîcheur compact */}
                        {reliabilityData?.freshness && (
                          <FreshnessIndicator
                            summaryId={selectedSummary.id}
                            freshnessData={reliabilityData.freshness}
                            compact={true}
                          />
                        )}
                        {/* 🔍 Badge fact-check compact */}
                        {reliabilityData?.fact_check_lite && (
                          <FactCheckLite
                            summaryId={selectedSummary.id}
                            reliabilityData={reliabilityData}
                            compact={true}
                          />
                        )}
                      </div>

                      {/* 🌻 Tournesol Integration */}
                      <div className="pt-3 border-t border-border-subtle">
                        <div onClick={() => setShowTournesolDetails(!showTournesolDetails)} className="cursor-pointer">
                          <TournesolMini
                            videoId={selectedSummary.video_id}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 📥 Action Bar v2 — Unified with hero Voice Agent CTA */}
                <AnalysisActionBar
                  summary={{
                    id: selectedSummary.id,
                    video_id: selectedSummary.video_id,
                    video_title: selectedSummary.video_title,
                    video_channel: selectedSummary.video_channel,
                    summary_content: selectedSummary.summary_content,
                  }}
                  language={language}
                  onOpenVoice={() => setIsVoiceModalOpen(true)}
                  onAudioReady={(url) => setAudioPlayerUrl(url)}
                  showStudyTools={false}
                  showCitation={false}
                  sticky={false}
                />

                {/* 💬 Bandeau Chat IA — Design glassmorphism premium */}
                {!chatOpen && (
                  <button
                    onClick={() => { setChatOpen(true); setChatMinimized(false); }}
                    className="w-full group cursor-pointer relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.005]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.08) 50%, rgba(139,92,246,0.08) 100%)',
                      border: '1px solid rgba(6,182,212,0.15)',
                    }}
                  >
                    {/* Gradient accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, #6366f1, #8b5cf6, transparent)' }} />
                    <div className="flex items-center gap-4 px-5 py-4">
                      <div className="relative flex-shrink-0">
                        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(99,102,241,0.15))' }}>
                          <MessageCircle className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
                          {language === 'fr' ? 'Poser une question à l\'IA' : 'Ask the AI a question'}
                        </span>
                        <p className="text-xs text-white/40 mt-0.5 leading-relaxed">
                          {language === 'fr'
                            ? 'L\'IA a analysé cette vidéo et peut approfondir n\'importe quel sujet abordé'
                            : 'The AI analyzed this video and can dig deeper into any topic covered'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.1] transition-all">
                        <ChevronDown className="w-4 h-4 text-white/40 -rotate-90 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </button>
                )}

                {/* Tournesol Details (expandable) */}
                {showTournesolDetails && (
                  <div className="card p-5 animate-fadeIn">
                    <TournesolWidget
                      videoId={selectedSummary.video_id}
                      variant="full"
                    />
                  </div>
                )}

                {/* 📊 AnalysisHub — Panel intelligent à onglets */}
                <AnalysisHub
                  selectedSummary={selectedSummary}
                  reliabilityData={reliabilityData}
                  reliabilityLoading={reliabilityLoading}
                  user={user!}
                  language={language as 'fr' | 'en'}
                  concepts={concepts}
                  onTimecodeClick={handleTimecodeClick}
                  onOpenChat={(msg) => {
                    setChatOpen(true);
                    setChatMinimized(false);
                    if (msg) setChatInput(msg);
                  }}
                  onNavigate={(path) => navigate(path)}
                />
              </div>
            )}

            {/* Empty State → Insight + Tournesol + Recent */}
            {!selectedSummary && (
              <div className={`animate-fadeIn transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                {/* 💡 Savoir du Jour — Bandeau citation */}
                <DashboardInsight />

                {/* Suggestions Tournesol */}
                <TournesolTrendingSection
                  language={language as 'fr' | 'en'}
                  onVideoSelect={(videoId) => {
                    setSmartInput({
                      mode: 'url',
                      url: `https://www.youtube.com/watch?v=${videoId}`,
                      searchLanguages: smartInput.searchLanguages || ['fr', 'en'],
                    });
                  }}
                />

                {/* Analyses récentes */}
                <RecentAnalysesSection
                  language={language as 'fr' | 'en'}
                  onVideoSelect={(videoId) => {
                    setSmartInput({
                      mode: 'url',
                      url: `https://www.youtube.com/watch?v=${videoId}`,
                      searchLanguages: smartInput.searchLanguages || ['fr', 'en'],
                    });
                  }}
                  onOpenAnalysis={(summaryId) => {
                    navigate(`/history?open=${summaryId}`);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FAB Chat IA supprimé — remplacé par bandeau sous la miniature */}

      {/* 💬 Chat Panel — Interface épurée latérale */}
      <ChatPanel
        isOpen={chatOpen && !!selectedSummary}
        onClose={() => setChatOpen(false)}
        videoTitle={selectedSummary?.video_title || ''}
        videoId={selectedSummary?.video_id || ''}
        thumbnailUrl={selectedSummary?.thumbnail_url}
        messages={chatMessages}
        isLoading={chatLoading}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={setWebSearchEnabled}
        onSendMessage={handleSendChat}
        language={language as 'fr' | 'en'}
        userPlan={normalizedPlan}
        webSearchQuota={wsQuota}
        onUpgrade={() => navigate('/pricing')}
      />

      {/* 🔍 Modal Découverte Intelligente */}
      <VideoDiscoveryModal
        isOpen={showDiscoveryModal}
        onClose={() => setShowDiscoveryModal(false)}
        discovery={discoveryResult}
        onSelectVideo={handleSelectDiscoveredVideo}
        loading={loading}
        userCredits={user?.credits || 0}
        language={language as 'fr' | 'en'}
      />

      {/* 💰 Credit Alert - Shows when credits are low */}
      <CreditAlert
        warningThreshold={50}
        criticalThreshold={10}
        position="top"
        compact={false}
      />

      {/* 💰 Upgrade Prompt Modal */}
      <UpgradePromptModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType={upgradeLimitType}
      />

      {/* 💰 Free Trial Limit Modal - Shows after free analyses */}
      <FreeTrialLimitModal
        isOpen={showFreeTrialModal}
        onClose={() => setShowFreeTrialModal(false)}
        analysisCount={analysisCountThisMonth}
        videoDurationSeconds={lastAnalysisTimeSaved}
      />

      {/* 🔊 Audio Player (fixed bottom bar) */}
      {audioPlayerUrl && (
        <AudioPlayer
          audioUrl={audioPlayerUrl}
          title={selectedSummary?.video_title || 'Analyse'}
          onClose={() => setAudioPlayerUrl(null)}
        />
      )}

      {/* CSS pour animations (shimmer) */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* 🎙️ Voice Chat (VoiceButton supprimé — intégré dans AnalysisActionBar) */}
      {selectedSummary && (
        <>
          <VoiceModal
            isOpen={isVoiceModalOpen}
            onClose={() => {
              setIsVoiceModalOpen(false);
              voiceChat.stop();
            }}
            videoTitle={selectedSummary.video_title}
            channelName={selectedSummary.video_channel}
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

      {/* 🎙️ Onboarding Voice — Guide interactif pour nouveaux utilisateurs */}
      {showOnboardingVoice && isNewUser && normalizedPlan !== 'free' && (
        <OnboardingVoice
          isNewUser={true}
          onDismiss={() => {
            setShowOnboardingVoice(false);
            try { window.sessionStorage?.setItem?.('ds_onboarding_voice_dismissed', '1'); } catch {}
          }}
          onStartSession={() => {
            setShowOnboardingVoice(false);
            try { window.sessionStorage?.setItem?.('ds_onboarding_voice_dismissed', '1'); } catch {}
            // Ouvrir le voice modal en mode onboarding
            setIsVoiceModalOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
