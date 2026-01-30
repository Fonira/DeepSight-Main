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
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ListVideo,
  Play, Video, Send, ChevronDown, Clock, Timer,
  Star, Download, Globe, Sparkles, BookOpen, Shield,
  ExternalLink, Copy, Check, MessageCircle, X, Bot,
  AlertCircle, Minimize2, Maximize2, RefreshCw, Pause,
  Zap, FileText, FileDown, ChevronUp, Minus, GraduationCap, Brain,
  ChevronRight, Tags
} from "lucide-react";
import { DeepSightSpinner, DeepSightSpinnerMicro } from "../components/ui";
import { EnrichedMarkdown } from "../components/EnrichedMarkdown";
import { ConceptsGlossary } from "../components/ConceptsGlossary";
import { videoApi, chatApi, reliabilityApi, ApiError } from "../services/api";
import type { Summary, TaskStatus, ChatQuota, DiscoveryResponse, VideoCandidate, ReliabilityResult, EnrichedConcept, EnrichedConceptsResponse } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from '../hooks/useTranslation';
import { YouTubePlayer, YouTubePlayerRef } from "../components/YouTubePlayer";
import { createTimecodeMarkdownComponents, TimecodeInfo } from "../components/TimecodeRenderer";
import { TournesolWidget, TournesolMini } from "../components/TournesolWidget";
import { Sidebar } from "../components/layout/Sidebar";
import { FloatingChatWindow } from "../components/FloatingChatWindow";
import { CitationExport } from "../components/CitationExport";
import { StudyToolsModal } from "../components/StudyToolsModal";
import { KeywordsModal } from "../components/KeywordsModal";
import DoodleBackground from "../components/DoodleBackground";
import SmartInputBar, { SmartInputValue } from "../components/SmartInputBar";
import { AcademicSourcesPanel } from "../components/academic";
// LoadingWordWidget désormais global dans App.tsx
import VideoDiscoveryModal from "../components/VideoDiscoveryModal";
import { ThumbnailImage } from "../components/ThumbnailImage";
// 🕐 Freshness & Fact-Check LITE
import { FreshnessIndicator } from "../components/FreshnessIndicator";
import { FactCheckLite } from "../components/FactCheckLite";
// 💰 Monetization components
import { CreditAlert } from "../components/CreditAlert";
import { AnalysisValueDisplay } from "../components/AnalysisValueDisplay";
import { UpgradePromptModal } from "../components/UpgradePromptModal";
import { FreeTrialLimitModal } from "../components/FreeTrialLimitModal";
// 🎨 Customization Panel v2
import { CustomizationPanel } from "../components/analysis/CustomizationPanel";
import { AnalysisCustomization, DEFAULT_CUSTOMIZATION } from "../types/analysis";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
  web_search_used?: boolean;
}

const CATEGORIES = [
  { id: "auto", name: "Auto-détection", emoji: "🎯" },
  { id: "interview_podcast", name: "Interview/Podcast", emoji: "🎙️" },
  { id: "tech", name: "Technologie", emoji: "💻" },
  { id: "science", name: "Science", emoji: "🔬" },
  { id: "education", name: "Éducation", emoji: "📚" },
  { id: "finance", name: "Finance", emoji: "💰" },
  { id: "gaming", name: "Gaming", emoji: "🎮" },
  { id: "culture", name: "Culture", emoji: "🎨" },
  { id: "news", name: "Actualités", emoji: "📰" },
  { id: "health", name: "Santé", emoji: "🏥" },
] as const;

const MODES = [
  { id: "accessible", name: "Accessible", desc: "Grand public" },
  { id: "standard", name: "Standard", desc: "Équilibré" },
  { id: "expert", name: "Expert", desc: "Technique" },
] as const;

const SUGGESTED_QUESTIONS_FR = [
  "Quels sont les points principaux ?",
  "Résume en 3 bullet points",
  "Y a-t-il des biais dans cette vidéo ?",
  "Quelles sont les sources citées ?",
];

const SUGGESTED_QUESTIONS_EN = [
  "What are the main points?",
  "Summarize in 3 bullet points",
  "Are there any biases in this video?",
  "What sources are cited?",
];

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const formatReadingTime = (wordCount: number): string => `${Math.ceil(wordCount / 200)} min`;

const getCategoryInfo = (cat: string) => CATEGORIES.find(c => c.id === cat) || { emoji: "📄", name: cat };

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
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // États principaux
  const [videoUrl, setVideoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<string>("standard");
  const [category, setCategory] = useState<string>("auto");
  
  // 🆕 États pour l'entrée intelligente
  const [smartInput, setSmartInput] = useState<SmartInputValue>({
    mode: 'search',
    searchLanguages: ['fr', 'en'],
  });
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResponse | null>(null);
  const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);
  
  // 🆕 États pour choix du modèle et recherche approfondie
  const [selectedModel, setSelectedModel] = useState<string>("mistral-small-latest");
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);
  
  // 🎨 État pour la personnalisation avancée v2
  const [analysisCustomization, setAnalysisCustomization] = useState<AnalysisCustomization>(DEFAULT_CUSTOMIZATION);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  
  // États du chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(true); // Grand par défaut
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [chatQuota, setChatQuota] = useState<ChatQuota | null>(null);
  
  // États UI
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCitationModal, setShowCitationModal] = useState(false);
  const [showStudyToolsModal, setShowStudyToolsModal] = useState(false);
  const [showKeywordsModal, setShowKeywordsModal] = useState(false);
  // 💰 Monetization states
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<'credits' | 'chat' | 'analysis'>('credits');
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

  // 🕐 États Freshness & Fact-Check LITE
  const [reliabilityData, setReliabilityData] = useState<ReliabilityResult | null>(null);
  const [reliabilityLoading, setReliabilityLoading] = useState(false);
  
  // Player YouTube
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playerStartTime, setPlayerStartTime] = useState(0);
  const playerRef = useRef<YouTubePlayerRef>(null);
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<boolean>(false);

  const isProUser = user?.plan === "pro" || user?.plan === "team" || user?.plan === "expert";
  // Note: isTeamOrHigher et isStarterPlus réservés pour futures fonctionnalités
  const isExpertUser = user?.plan === "expert" || user?.plan === "unlimited";
  
  // 🆕 Configuration des modèles selon le plan
  const availableModels = useMemo(() => {
    const plan = user?.plan || 'free';
    const models = [
      { id: 'mistral-small-latest', name: 'Mistral Small', desc: language === 'fr' ? 'Rapide' : 'Fast', icon: '⚡' }
    ];
    if (['student', 'starter', 'pro', 'team', 'expert', 'unlimited'].includes(plan)) {
      models.push({ id: 'mistral-medium-latest', name: 'Mistral Medium', desc: language === 'fr' ? 'Équilibré' : 'Balanced', icon: '⚖️' });
    }
    if (['pro', 'team', 'expert', 'unlimited'].includes(plan)) {
      models.push({ id: 'mistral-large-latest', name: 'Mistral Large', desc: language === 'fr' ? 'Puissant' : 'Powerful', icon: '🚀' });
    }
    return models;
  }, [user?.plan, language]);
  
  // SUGGESTED_QUESTIONS disponible pour le chat: language === 'fr' ? SUGGESTED_QUESTIONS_FR : SUGGESTED_QUESTIONS_EN

  // === SESSION ONLY: Ne plus persister la dernière analyse ===
  // L'analyse reste uniquement pour la session courante (pas de localStorage)

  // === Charger depuis l'URL (historique) ===
  
  useEffect(() => {
    const summaryId = searchParams.get('id');
    if (summaryId) {
      const id = parseInt(summaryId, 10);
      if (!isNaN(id)) {
        loadSummaryFromHistory(id);
      }
    }
  }, [searchParams]);

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
      } catch (err) {
        console.warn('Failed to load reliability data:', err);
        // Silencieux - ne pas afficher d'erreur à l'utilisateur
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
    } catch (err) {
      console.warn('Failed to load enriched concepts:', err);
      setConcepts([]);
      setConceptsProvider('none');
      setConceptsCategories({});
    } finally {
      setConceptsLoading(false);
    }
  };

  // === Handler pour ouvrir le modal Mots-clés ===
  
  const handleOpenKeywordsModal = () => {
    setShowKeywordsModal(true);
    if (selectedSummary?.id) {
      loadConcepts(selectedSummary.id);
    }
  };

  const loadSummaryFromHistory = async (summaryId: number) => {
    setLoading(true);
    setError(null);
    setLoadingMessage(language === 'fr' ? 'Chargement de l\'analyse...' : 'Loading analysis...');
    
    try {
      const summary = await videoApi.getSummary(summaryId);
      
      if (summary) {
        setSelectedSummary(summary);
        setVideoUrl(`https://youtube.com/watch?v=${summary.video_id}`);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
      setError(language === 'fr' 
        ? "Impossible de charger cette analyse. Elle n'existe peut-être plus."
        : "Unable to load this analysis. It may no longer exist.");
    } finally {
      setLoading(false);
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

  const summaryMarkdownComponents = useMemo(() => {
    return createTimecodeMarkdownComponents({
      mode: "embedded",
      onTimecodeClick: handleTimecodeClick,
      linkClassName: "text-accent-primary hover:text-accent-primary-hover underline underline-offset-2 cursor-pointer transition-colors font-medium",
    });
  }, [handleTimecodeClick]);

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

  const handleAnalyze = async () => {
    // Validation selon le mode
    if (smartInput.mode === 'url' && !smartInput.url?.trim()) return;
    if (smartInput.mode === 'text' && !smartInput.rawText?.trim()) return;
    if (smartInput.mode === 'search' && !smartInput.searchQuery?.trim()) return;

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

    try {
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
        
        // 🎨 Utiliser l'API v2 avec personnalisation avancée
        const response = await videoApi.analyzeV2(
          smartInput.url!,
          {
            category,
            mode,
            model: selectedModel,
            deepResearch: isExpertUser && deepResearchEnabled,
            lang: language,
            // 🆕 Options de personnalisation v2
            userPrompt: analysisCustomization.userPrompt || undefined,
            antiAIDetection: analysisCustomization.antiAIDetection,
            writingStyle: analysisCustomization.writingStyle,
            targetLength: analysisCustomization.targetLength,
            includeComments: analysisCustomization.includeComments,
            includeMetadata: analysisCustomization.includeMetadata,
            includeIntention: analysisCustomization.includeIntention,
          }
        );
        
        // Cas 1: Analyse déjà en cache
        if (response.status === "completed" && response.result?.summary_id) {
          setLoadingMessage(language === 'fr' ? "Chargement du résumé..." : "Loading summary...");
          setLoadingProgress(90);
          
          const fullSummary = await videoApi.getSummary(response.result.summary_id);
          setSelectedSummary(fullSummary);
          setPlayerVisible(false);
          setLoadingProgress(100);
          await refreshUser(true);
          return;
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
        
        const response = await videoApi.analyzeHybrid({
          inputType: 'raw_text',
          rawText: smartInput.rawText!,
          textTitle: smartInput.textTitle,
          textSource: smartInput.textSource,
          mode,
          category: category === 'auto' ? undefined : category,
          lang: language,
          model: selectedModel,
          deepResearch: isExpertUser && deepResearchEnabled,
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
  const handleSelectDiscoveredVideo = async (video: VideoCandidate) => {
    setShowDiscoveryModal(false);
    setLoading(true);
    setError(null);
    setLoadingProgress(0);
    setLoadingMessage(language === 'fr' ? `Analyse de "${video.title}"...` : `Analyzing "${video.title}"...`);
    
    const url = `https://youtube.com/watch?v=${video.video_id}`;
    setVideoUrl(url);
    
    try {
      // 🎨 Utiliser l'API v2 avec personnalisation pour les vidéos découvertes
      const response = await videoApi.analyzeV2(
        url,
        {
          category,
          mode,
          model: selectedModel,
          deepResearch: isExpertUser && deepResearchEnabled,
          lang: language,
          // 🆕 Options de personnalisation v2
          userPrompt: analysisCustomization.userPrompt || undefined,
          antiAIDetection: analysisCustomization.antiAIDetection,
          writingStyle: analysisCustomization.writingStyle,
          targetLength: analysisCustomization.targetLength,
          includeComments: analysisCustomization.includeComments,
          includeMetadata: analysisCustomization.includeMetadata,
          includeIntention: analysisCustomization.includeIntention,
        }
      );
      
      if (response.status === "completed" && response.result?.summary_id) {
        setLoadingProgress(90);
        const fullSummary = await videoApi.getSummary(response.result.summary_id);
        setSelectedSummary(fullSummary);
        setPlayerVisible(false);
        setLoadingProgress(100);
        await refreshUser(true);
      } else if (response.task_id) {
        pollingRef.current = true;
        await pollTaskStatus(response.task_id);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 
        (language === 'fr' ? "Erreur lors de l'analyse" : "Analysis error");
      setError(message);
    } finally {
      setLoading(false);
      pollingRef.current = false;
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const fallbackMsgFr = ["Traitement en cours...", "Analyse du contenu...", "Génération du résumé...", "Finalisation..."];
    const fallbackMsgEn = ["Processing...", "Analyzing content...", "Generating summary...", "Finalizing..."];
    const fallbackMessages = language === 'fr' ? fallbackMsgFr : fallbackMsgEn;
    
    let attempts = 0;
    const maxAttempts = 180; // 9 minutes max
    
    
    while (attempts < maxAttempts && pollingRef.current) {
      try {
        const status: TaskStatus = await videoApi.getTaskStatus(taskId);
        
        if (status.status === "completed" && status.result) {
          setLoadingProgress(95);
          setLoadingMessage(language === 'fr' ? 'Chargement du résumé...' : 'Loading summary...');
          
          const summaryId = status.result.summary_id;
          if (summaryId) {
            const fullSummary = await videoApi.getSummary(summaryId);
            setSelectedSummary(fullSummary);
          } else {
            setSelectedSummary(status.result as any);
          }
          
          setPlayerVisible(false);
          setLoadingProgress(100);
          await refreshUser(true);

          // 💰 Show friction modal for free users after analysis
          if (user?.plan === 'free') {
            const newCount = analysisCountThisMonth + 1;
            setAnalysisCountThisMonth(newCount);
            // Calculate time saved (video duration - 45 seconds analysis time)
            const videoDuration = (status.result as any)?.video_duration || 600;
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
  
  const handleSendChat = async (customMessage?: string) => {
    const message = customMessage || chatInput.trim();
    if (!message || !selectedSummary?.id) return;
    
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
        isProUser && webSearchEnabled
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
      
      // Rafraîchir quota
      try {
        const newQuota = await chatApi.getQuota(selectedSummary.id);
        setChatQuota(newQuota);
      } catch (quotaErr) {
        console.warn('Failed to refresh quota:', quotaErr);
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

  // === Export ===
  
  const handleExport = async (format: 'pdf' | 'md' | 'txt') => {
    if (!selectedSummary?.id) return;
    setExporting(true);
    setShowExportMenu(false);
    
    try {
      const blob = await videoApi.exportSummary(selectedSummary.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'md' ? 'md' : format;
      a.download = `${selectedSummary.video_title || 'analyse'}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // === Copy ===
  
  const handleCopy = async () => {
    if (!selectedSummary?.summary_content) return;
    await navigator.clipboard.writeText(selectedSummary.summary_content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground variant="default" density={50} />
      {/* Sidebar hidden on mobile - using DashboardLayout's hamburger menu */}
      <div className="hidden lg:block">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      </div>

      {/* Main content - responsive margin */}
      <main className={`transition-all duration-300 relative z-10 lg:${sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'}`}>
        <div className="min-h-screen p-4 sm:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto">

            {/* Header - with top padding on mobile for hamburger button */}
            <header className="mb-6 lg:mb-8 pt-2 lg:pt-0">
              <h1 className="font-display text-xl sm:text-2xl mb-2 text-text-primary">
                {language === 'fr' ? 'Analyse vidéo' : 'Video Analysis'}
              </h1>
              <p className="text-text-secondary text-xs sm:text-sm">
                {language === 'fr'
                  ? 'URL YouTube, texte brut, ou recherche intelligente de vidéos.'
                  : 'YouTube URL, raw text, or intelligent video search.'}
              </p>
            </header>

            {/* 🆕 Smart Input Section */}
            <div className="card p-4 sm:p-6 mb-4 sm:mb-6">
              <SmartInputBar
                value={smartInput}
                onChange={setSmartInput}
                onSubmit={handleAnalyze}
                loading={loading}
                disabled={loading}
                userCredits={user?.credits || 0}
                language={language as 'fr' | 'en'}
              />

              {/* Options - Only show for non-search modes (search has its own options) */}
              {smartInput.mode !== 'search' && (
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4 mt-4 pt-4 border-t border-border-subtle">
                  {/* Mode - Full width on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Mode</span>
                    <div className="flex rounded-lg bg-bg-tertiary p-1 w-full sm:w-auto">
                      {MODES.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => setMode(m.id)}
                          className={`flex-1 sm:flex-none px-3 py-2 sm:py-1.5 rounded-md text-sm font-medium transition-all ${
                            mode === m.id
                              ? 'bg-bg-elevated text-text-primary shadow-sm'
                              : 'text-text-tertiary hover:text-text-secondary'
                          }`}
                          title={m.desc}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Catégorie - Full width on mobile */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">
                      {language === 'fr' ? 'Catégorie' : 'Category'}
                    </span>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full sm:w-auto bg-bg-tertiary border border-border-default rounded-lg px-3 py-2 sm:py-1.5 text-sm text-text-primary cursor-pointer"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.emoji} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sélecteur de modèle (selon le plan) */}
                  {availableModels.length > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs text-text-tertiary uppercase tracking-wider font-medium">
                        {language === 'fr' ? 'Modèle' : 'Model'}
                      </span>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full sm:w-auto bg-bg-tertiary border border-border-default rounded-lg px-3 py-2 sm:py-1.5 text-sm text-text-primary cursor-pointer"
                      >
                        {availableModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.icon} {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Option recherche approfondie (Expert uniquement) */}
                  {isExpertUser && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`relative w-10 h-5 rounded-full transition-all ${deepResearchEnabled ? 'bg-purple-500' : 'bg-gray-600'}`}
                          onClick={() => setDeepResearchEnabled(!deepResearchEnabled)}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${deepResearchEnabled ? 'left-5' : 'left-0.5'}`} />
                        </div>
                        <span className="text-xs text-text-secondary flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          {language === 'fr' ? 'Recherche approfondie' : 'Deep research'}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Quota */}
                  {user && (
                    <div className="sm:ml-auto text-xs text-text-tertiary text-center sm:text-right">
                      {user.analysis_count}/{user.analysis_limit} {language === 'fr' ? 'analyses' : 'analyses'}
                    </div>
                  )}
                </div>
              )}
              
              {/* ═══════════════════════════════════════════════════════════════ */}
              {/* 🎨 CUSTOMIZATION PANEL v2 — Personnalisation Avancée */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              {smartInput.mode !== 'search' && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  {/* Toggle button to show/hide panel */}
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
                            : (language === 'fr' ? 'Style, longueur, anti-détection IA...' : 'Style, length, anti-AI detection...')}
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
              )}
            </div>

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
                  
                  {/* 🆕 Message informatif pour longues vidéos */}
                  {loadingProgress > 30 && loadingProgress < 90 && (
                    <p className="text-xs text-text-muted mt-3 max-w-sm">
                      {language === 'fr' 
                        ? "💡 Les vidéos longues (>30min) peuvent prendre plus de temps."
                        : "💡 Long videos (>30min) may take longer."}
                    </p>
                  )}
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
                        ? "Cette URL correspond à une playlist YouTube. Pour analyser plusieurs vidéos d'une playlist, utilisez la page dédiée aux playlists."
                        : "This URL corresponds to a YouTube playlist. To analyze multiple videos from a playlist, use the dedicated playlists page."}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => navigate('/playlists')}
                        className="btn btn-primary"
                      >
                        <ListVideo className="w-4 h-4" />
                        {language === 'fr' ? 'Aller aux Playlists' : 'Go to Playlists'}
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
              <div className="space-y-6 animate-fadeInUp">
                {/* Video Info Card */}
                <div className="card overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Thumbnail / Player - responsive height */}
                    <div className="w-full lg:w-96 flex-shrink-0 relative bg-bg-tertiary">
                      {playerVisible ? (
                        <div className="relative aspect-video">
                          <YouTubePlayer
                            ref={playerRef}
                            videoId={selectedSummary.video_id}
                            startTime={playerStartTime}
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
                        <h2 className="font-display text-lg sm:text-xl leading-tight text-text-primary line-clamp-2">
                          {selectedSummary.video_title}
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
                        {selectedSummary.video_channel}
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
                          {selectedSummary.mode || mode}
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
                        <TournesolMini 
                          videoId={selectedSummary.video_id}
                          onExpand={() => setShowTournesolDetails(!showTournesolDetails)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tournesol Details (expandable) */}
                {showTournesolDetails && (
                  <div className="card p-5 animate-fadeIn">
                    <TournesolWidget 
                      videoId={selectedSummary.video_id}
                      showDetails={true}
                    />
                  </div>
                )}

                {/* 🕐 Freshness & Fact-Check LITE Section */}
                {(reliabilityData || reliabilityLoading) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Indicateur de fraîcheur */}
                    {reliabilityLoading ? (
                      <div className="animate-pulse bg-bg-tertiary rounded-xl h-32" />
                    ) : reliabilityData?.freshness?.warning_level !== 'none' ? (
                      <FreshnessIndicator
                        summaryId={selectedSummary.id}
                        videoTitle={selectedSummary.video_title}
                        freshnessData={reliabilityData?.freshness}
                        onRequestVerification={() => {
                          setChatOpen(true);
                          setChatMinimized(false);
                          setChatInput(language === 'fr' 
                            ? "Peux-tu vérifier si les informations de cette vidéo sont toujours à jour ?"
                            : "Can you verify if the information in this video is still up to date?"
                          );
                        }}
                      />
                    ) : null}
                    
                    {/* Fact-Check LITE */}
                    {reliabilityLoading ? (
                      <div className="animate-pulse bg-bg-tertiary rounded-xl h-48" />
                    ) : reliabilityData?.fact_check_lite ? (
                      <FactCheckLite
                        summaryId={selectedSummary.id}
                        reliabilityData={reliabilityData}
                        onUpgrade={() => {
                          // Redirect to pricing or show upgrade modal
                          window.open('/pricing', '_blank');
                        }}
                      />
                    ) : null}
                  </div>
                )}

                {/* Summary Content */}
                <div className="card">
                  {/* Panel header - responsive */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-5 border-b border-border-subtle">
                    <h3 className="font-semibold text-text-primary flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-accent-primary" />
                      {language === 'fr' ? 'Analyse' : 'Analysis'}
                    </h3>
                    {/* Action buttons - scrollable on mobile */}
                    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0">
                      {/* Copy */}
                      <button
                        onClick={handleCopy}
                        className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
                      >
                        {copied ? <Check className="w-4 h-4 text-accent-success" /> : <Copy className="w-4 h-4" />}
                        <span className="hidden sm:inline">{copied ? (language === 'fr' ? 'Copié' : 'Copied') : (language === 'fr' ? 'Copier' : 'Copy')}</span>
                      </button>

                      {/* 🎓 Citation académique */}
                      <button
                        onClick={() => setShowCitationModal(true)}
                        className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
                        title={language === 'fr' ? 'Générer une citation académique' : 'Generate academic citation'}
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span className="hidden sm:inline">{language === 'fr' ? 'Citer' : 'Cite'}</span>
                      </button>

                      {/* 📚 Outils d'étude (fiches + mindmap) */}
                      <button
                        onClick={() => setShowStudyToolsModal(true)}
                        className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
                        title={language === 'fr' ? 'Fiches de révision et arbre pédagogique' : 'Study cards and concept map'}
                      >
                        <Brain className="w-4 h-4" />
                        <span className="hidden sm:inline">{language === 'fr' ? 'Réviser' : 'Study'}</span>
                      </button>

                      {/* 🏷️ Mots-clés */}
                      <button
                        onClick={handleOpenKeywordsModal}
                        className="btn btn-ghost text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]"
                        title={language === 'fr' ? 'Voir les mots-clés extraits' : 'View extracted keywords'}
                      >
                        <Tags className="w-4 h-4" />
                        <span className="hidden sm:inline">{language === 'fr' ? 'Mots-clés' : 'Keywords'}</span>
                      </button>

                      {/* Export */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={() => setShowExportMenu(!showExportMenu)}
                          className="btn btn-ghost text-xs min-h-[36px] sm:min-h-[32px]"
                          disabled={exporting}
                        >
                          {exporting ? <DeepSightSpinnerMicro /> : <Download className="w-4 h-4" />}
                          <span className="hidden sm:inline">Export</span>
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        {showExportMenu && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-bg-elevated border border-border-default rounded-lg shadow-lg z-10 py-1">
                            <button
                              onClick={() => handleExport('pdf')}
                              className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" /> PDF
                            </button>
                            <button
                              onClick={() => handleExport('md')}
                              className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                            >
                              <FileDown className="w-4 h-4" /> Markdown
                            </button>
                            <button
                              onClick={() => handleExport('txt')}
                              className="w-full px-3 py-2.5 text-left text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary flex items-center gap-2"
                            >
                              <FileText className="w-4 h-4" /> Texte
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Chat toggle */}
                      <button
                        onClick={() => { setChatOpen(!chatOpen); setChatMinimized(false); }}
                        className={`btn ${chatOpen ? 'btn-primary' : 'btn-secondary'} text-xs flex-shrink-0 min-h-[36px] sm:min-h-[32px]`}
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Chat</span>
                        {chatQuota && (
                          <span className="ml-1 text-xs opacity-70">
                            {chatQuota.used}/{chatQuota.limit}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 sm:p-5 prose max-w-none">
                    <EnrichedMarkdown 
                      language={language}
                      onTimecodeClick={handleTimecodeClick}
                      className="text-text-primary"
                    >
                      {selectedSummary.summary_content || ''}
                    </EnrichedMarkdown>
                    
                    {/* 📚 Glossaire des concepts clés */}
                    <div className="mt-6">
                      <ConceptsGlossary
                        summaryId={selectedSummary.id}
                        language={language}
                      />
                    </div>

                    {/* 🎓 Sources académiques */}
                    <div className="mt-6 not-prose">
                      <AcademicSourcesPanel
                        summaryId={selectedSummary.id.toString()}
                        userPlan={user?.plan || 'free'}
                        onUpgrade={() => navigate('/pricing')}
                        language={language as 'fr' | 'en'}
                      />
                    </div>

                    {/* 💰 Analysis Value Display - Shows time saved */}
                    <div className="mt-6 not-prose">
                      <AnalysisValueDisplay
                        videoDuration={selectedSummary.video_duration || 0}
                        keyPointsCount={selectedSummary.summary_content?.split('##').length - 1 || 0}
                        conceptsCount={concepts.length}
                        showUpgradeCTA={user?.plan === 'free' || user?.plan === 'student'}
                        compact={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!selectedSummary && !loading && (
              <div className="card p-12 text-center animate-fadeIn">
                <div className="w-20 h-20 rounded-2xl bg-bg-tertiary flex items-center justify-center mx-auto mb-6">
                  <Video className="w-10 h-10 text-text-muted" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  {language === 'fr' ? 'Prêt à analyser' : 'Ready to analyze'}
                </h3>
                <p className="text-text-secondary text-sm max-w-md mx-auto mb-6">
                  {language === 'fr'
                    ? 'Collez une URL YouTube ci-dessus pour générer une analyse détaillée avec résumé, fact-checking et chat contextuel.'
                    : 'Paste a YouTube URL above to generate a detailed analysis with summary, fact-checking and contextual chat.'}
                </p>
                {/* Widget "Le Saviez-Vous" désormais global dans App.tsx (coin bas-droite) */}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 🆕 Chat Panel - FloatingChatWindow (Draggable & Resizable) */}
      <FloatingChatWindow
        isOpen={chatOpen && !!selectedSummary}
        onClose={() => setChatOpen(false)}
        title={language === 'fr' ? 'Chat IA' : 'AI Chat'}
        subtitle={selectedSummary?.video_title}
        type="video"
        messages={chatMessages}
        isLoading={chatLoading}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={setWebSearchEnabled}
        onSendMessage={handleSendChat}
        markdownComponents={chatMarkdownComponents}
        language={language as 'fr' | 'en'}
        storageKey="dashboard-chat"
      />

      {/* 🎓 Modal Citation Académique */}
      {selectedSummary && (
        <CitationExport
          isOpen={showCitationModal}
          onClose={() => setShowCitationModal(false)}
          video={{
            title: selectedSummary.video_title || 'Vidéo sans titre',
            channel: selectedSummary.video_channel || 'Chaîne inconnue',
            videoId: selectedSummary.video_id,
            publishedDate: selectedSummary.created_at,
            duration: selectedSummary.video_duration,
          }}
          language={language as 'fr' | 'en'}
        />
      )}

      {/* 📚 Modal Outils d'étude (Fiches + Mindmap) */}
      {selectedSummary && (
        <StudyToolsModal
          isOpen={showStudyToolsModal}
          onClose={() => setShowStudyToolsModal(false)}
          summaryId={selectedSummary.id}
          videoTitle={selectedSummary.video_title || 'Vidéo'}
          language={language as 'fr' | 'en'}
        />
      )}

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

      {/* 🏷️ Modal Mots-clés enrichis */}
      {selectedSummary && (
        <KeywordsModal
          isOpen={showKeywordsModal}
          onClose={() => setShowKeywordsModal(false)}
          videoTitle={selectedSummary.video_title || 'Vidéo'}
          tags={selectedSummary.tags ? selectedSummary.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []}
          concepts={concepts}
          loading={conceptsLoading}
          language={language as 'fr' | 'en'}
          provider={conceptsProvider}
          categories={conceptsCategories}
        />
      )}

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
        maxFreeAnalyses={4}
        timeSavedSeconds={lastAnalysisTimeSaved}
      />

      {/* 🆕 CSS pour l'animation shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default DashboardPage;
