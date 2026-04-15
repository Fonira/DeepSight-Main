import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useScreenDoodleVariant } from "../contexts/DoodleVariantContext";
import { videoApi, chatApi, studyApi, shareApi } from "../services/api";
import {
  Header,
  Card,
  Badge,
  Button,
  YouTubePlayer,
  useToast,
  StreamingProgress,
  FreshnessIndicator,
  ReliabilityScore,
  DeepSightSpinner,
} from "../components";
import {
  PlatformBadge,
  detectPlatformFromUrl,
} from "../components/ui/PlatformBadge";
import { AnimatedTabBar, ActionButton } from "../components/ui";
import type { TabItem } from "../components/ui";
import { FlashcardsComponent, QuizComponent } from "../components/study";
import type { QuizQuestion } from "../components/study";
import { FactCheckButton } from "../components/factcheck";
import { WebEnrichment } from "../components/enrichment";
import { AcademicSourcesSection } from "../components/academic";
import { TournesolWidget } from "../components/tournesol";
import { AnalysisValueDisplay } from "../components/analysis/AnalysisValueDisplay";
import { AnalysisContentDisplay } from "../components/analysis/AnalysisContentDisplay";
import { AudioPlayerButton } from "../components/AudioPlayerButton";
import { SuggestedQuestions } from "../components/chat/SuggestedQuestions";
import { ChatBubble } from "../components/chat/ChatBubble";
import { TypingIndicator } from "../components/chat/TypingIndicator";
import { ChatInput } from "../components/chat/ChatInput";
import { FloatingChat } from "../components/chat";
import { VoiceButton } from "../components/voice/VoiceButton";
import { VoiceScreen } from "../components/voice/VoiceScreen";
import { useVoiceChat } from "../components/voice/useVoiceChat";
import { UpgradePromptModal } from "../components/upgrade";
import { useAuth } from "../contexts/AuthContext";
import {
  useBackgroundAnalysis,
  type VideoAnalysisTask,
} from "../contexts/BackgroundAnalysisContext";
import {
  hasFeature,
  normalizePlanId,
  PLAN_LIMITS,
  type PlanId,
} from "../config/planPrivileges";
import { usePlan } from "../hooks/usePlan";
import { videoApi as videoApiService } from "../services/api";
import { Spacing, Typography, BorderRadius } from "../constants/theme";
import { formatDuration, formatDate } from "../utils/formatters";
import { trackAnalysisComplete } from "../utils/storeReview";
import { analytics } from "../services/analytics";
import type {
  RootStackParamList,
  AnalysisSummary,
  ChatMessage,
} from "../types";

type AnalysisNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Analysis"
>;
type AnalysisRouteProp = RouteProp<RootStackParamList, "Analysis">;

type TabType = "summary" | "concepts" | "study";
type StudySubTab = "chat" | "tools";

export const AnalysisScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { subscribeToTask, getTask } = useBackgroundAnalysis();
  const navigation = useNavigation<AnalysisNavigationProp>();
  const route = useRoute<AnalysisRouteProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant("analysis");
  const chatScrollRef = useRef<FlatList>(null);
  const isMountedRef = useRef(true);

  // User plan
  const userPlan = normalizePlanId(user?.plan);
  const { limits: planLimits, usage: planUsage } = usePlan();

  const { summaryId, videoUrl, initialTab } = route.params || {};

  // Map legacy tab values to new structure
  const mappedInitialTab: TabType =
    initialTab === "chat" || initialTab === "tools"
      ? "study"
      : initialTab || "summary";
  const [activeTab, setActiveTab] = useState<TabType>(mappedInitialTab);
  const [studySubTab, setStudySubTab] = useState<StudySubTab>(
    initialTab === "tools" ? "tools" : "chat",
  );
  // Ref to always have the latest activeTab value (avoids stale closures in useEffect/navigation.replace)
  const activeTabRef = useRef<TabType>(mappedInitialTab);
  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [concepts, setConcepts] = useState<
    Array<{ name: string; definition: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  // Analysis status polling
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [analysisStep, setAnalysisStep] = useState(0); // 0-4 for StreamingProgress
  const [isStreaming, setIsStreaming] = useState(false); // True only for new analyses in progress

  // Reliability and freshness state
  const [reliabilityData, setReliabilityData] = useState<{
    overallScore: number;
    confidence?: number;
    factors?: Array<{ name: string; score: number; description: string }>;
    recommendations?: string[];
  } | null>(null);
  const [isLoadingReliability, setIsLoadingReliability] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // Study tools state
  const [flashcards, setFlashcards] = useState<
    Array<{ front: string; back: string }>
  >([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);
  const [isLoadingTools, setIsLoadingTools] = useState(false);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  // Active study tool
  type StudyToolType = "flashcards" | "quiz" | null;
  const [activeStudyTool, setActiveStudyTool] = useState<StudyToolType>(null);

  // Notes and tags state
  const [personalNotes, setPersonalNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Video player state
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);

  // Dynamic keyboard offset measurement
  // Use a ref to avoid re-renders on every layout change (e.g. when toggling expanded player)
  const tabContentOffsetRef = useRef(200);
  const [tabContentOffset, setTabContentOffset] = useState(200);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showVoiceScreen, setShowVoiceScreen] = useState(false);

  // Voice chat — ElevenLabs integration
  const voiceChat = useVoiceChat({
    summaryId: summaryId || "",
    onError: (err) => console.warn("[VoiceChat]", err),
  });
  // Quick Chat Upgrade states
  const [upgradeMode, setUpgradeMode] = useState<string>("standard");
  const [upgradeDeepResearch, setUpgradeDeepResearch] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<
    | "chat"
    | "analysis"
    | "playlist"
    | "export"
    | "webSearch"
    | "tts"
    | "credits"
  >("analysis");

  // Helper to calculate step from progress
  const calculateStepFromProgress = useCallback((progress: number): number => {
    if (progress < 10) return 0; // Connect
    if (progress < 30) return 1; // Metadata
    if (progress < 60) return 2; // Transcript
    if (progress < 90) return 3; // Analysis
    return 4; // Complete
  }, []);

  // Handle Quick Chat upgrade to full analysis
  const handleUpgradeQuickChat = async () => {
    if (!summary) return;
    setUpgradeLoading(true);
    try {
      const summaryId = String(summary.id || route.params?.summaryId);
      const response = await videoApi.upgradeQuickChat(
        parseInt(summaryId),
        upgradeMode,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const status = await videoApi.getStatus(response.task_id);
          if (status.status === "completed" || status.status === "done") {
            clearInterval(pollInterval);
            await loadCompletedAnalysis(summaryId);
            setUpgradeLoading(false);
          } else if (status.status === "error" || status.status === "failed") {
            clearInterval(pollInterval);
            setUpgradeLoading(false);
            Alert.alert("Erreur", "L'analyse a echoue");
          }
        } catch (e) {
          // Keep polling
        }
      }, 5000);
    } catch (err: any) {
      Alert.alert("Erreur", err?.message || "Impossible de lancer l'analyse");
      setUpgradeLoading(false);
    }
  };

  // Load completed analysis data (summary, concepts, chat history)
  const loadCompletedAnalysis = useCallback(
    async (summaryIdToLoad: string) => {
      try {
        const summaryData = await videoApi.getSummary(summaryIdToLoad);
        if (!isMountedRef.current) return;
        setSummary(summaryData);
        setAnalysisProgress(100);
        setAnalysisStep(4);

        // Track pour In-App Rating (déclenche après 3+ analyses)
        trackAnalysisComplete().catch(() => {});

        // Analytics: track analysis completion
        analytics.track("analysis_completed", {
          platform: summaryData.platform || "youtube",
          mode: summaryData.mode || "standard",
          word_count: summaryData.wordCount || 0,
        });

        // Load concepts
        try {
          const conceptsData =
            await videoApi.getEnrichedConcepts(summaryIdToLoad);
          if (!isMountedRef.current) return;
          setConcepts(conceptsData.concepts || []);
        } catch {
          // Concepts might not be available
        }

        // Load chat history
        try {
          const chatHistory = await chatApi.getHistory(summaryIdToLoad);
          if (!isMountedRef.current) return;
          setChatMessages(chatHistory.messages || []);
        } catch {
          // Chat history might not exist
        }
      } catch (err) {
        if (__DEV__) {
          console.error("Error loading completed analysis:", err);
        }
        if (isMountedRef.current) setError(t.errors.generic);
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    },
    [t.errors.generic],
  );

  // Track if we're using local polling (for non-background tasks)
  const localPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load and subscription setup
  useEffect(() => {
    if (!summaryId) {
      setError(t.errors.generic);
      setIsLoading(false);
      return;
    }

    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);

    // Check if this is a background task we're tracking
    const backgroundTask = getTask(summaryId);

    if (backgroundTask) {
      // This is an active streaming analysis
      setIsStreaming(true);

      // Subscribe to updates from the centralized polling in BackgroundAnalysisContext
      const unsubscribe = subscribeToTask(summaryId, (task) => {
        if (!isMountedRef.current) return;

        if (task.type === "video") {
          const videoTask = task as VideoAnalysisTask;
          setAnalysisProgress(videoTask.progress);
          setAnalysisStatus(videoTask.message);
          setAnalysisStep(calculateStepFromProgress(videoTask.progress));

          if (videoTask.status === "completed") {
            // Task completed - load full summary data
            setIsStreaming(false);
            const loadId = videoTask.result?.id;
            if (loadId) {
              loadCompletedAnalysis(loadId);
            } else {
              // Result not available inline, fetch summary_id via status API
              setIsLoading(true);
              videoApi
                .getStatus(videoTask.taskId)
                .then((s) => {
                  if (!isMountedRef.current) return;
                  loadCompletedAnalysis(s.summary_id || videoTask.taskId);
                })
                .catch(() => {
                  if (isMountedRef.current) {
                    setError(t.analysis.failed);
                    setIsLoading(false);
                  }
                });
            }
          } else if (videoTask.status === "failed") {
            setIsStreaming(false);
            setError(videoTask.error || t.analysis.failed);
            setIsLoading(false);
          }
        }
      });

      // Set initial state from background task
      if (backgroundTask.type === "video") {
        const videoTask = backgroundTask as VideoAnalysisTask;
        setAnalysisProgress(videoTask.progress);
        setAnalysisStatus(videoTask.message);
        setAnalysisStep(calculateStepFromProgress(videoTask.progress));

        if (videoTask.status === "completed") {
          setIsStreaming(false);
          const loadId = videoTask.result?.id;
          if (loadId) {
            loadCompletedAnalysis(loadId);
          } else {
            setIsLoading(true);
            videoApi
              .getStatus(videoTask.taskId)
              .then((s) => {
                if (!isMountedRef.current) return;
                loadCompletedAnalysis(s.summary_id || videoTask.taskId);
              })
              .catch(() => {
                if (isMountedRef.current) {
                  setError(t.analysis.failed);
                  setIsLoading(false);
                }
              });
          }
        } else if (videoTask.status === "failed") {
          setIsStreaming(false);
          setError(videoTask.error || t.analysis.failed);
          setIsLoading(false);
        } else {
          setIsLoading(false); // Still processing - show streaming progress
        }
      }

      return () => {
        isMountedRef.current = false;
        unsubscribe();
      };
    }

    // Not a background task - try loading as existing summary or check API status
    const loadInitialData = async () => {
      try {
        // First try to get status (for task IDs)
        const status = await videoApi.getStatus(summaryId);
        if (!isMountedRef.current) return;

        if (status.status === "completed" && status.summary_id) {
          await loadCompletedAnalysis(status.summary_id);
        } else if (status.status === "processing") {
          // Task is processing but not in BackgroundAnalysisContext
          // Start local polling to track progress
          if (isMountedRef.current) {
            setIsStreaming(true);
            setAnalysisProgress(status.progress || 0);
            setAnalysisStatus(status.message || t.analysis.inProgress);
            setAnalysisStep(calculateStepFromProgress(status.progress || 0));
            setIsLoading(false);

            // Start local polling for this task
            if (!localPollingRef.current) {
              localPollingRef.current = setInterval(async () => {
                if (!isMountedRef.current) {
                  if (localPollingRef.current) {
                    clearInterval(localPollingRef.current);
                    localPollingRef.current = null;
                  }
                  return;
                }

                try {
                  const pollStatus = await videoApi.getStatus(summaryId);
                  if (!isMountedRef.current) return;

                  if (
                    pollStatus.status === "completed" &&
                    pollStatus.summary_id
                  ) {
                    // Stop polling and load completed analysis
                    if (localPollingRef.current) {
                      clearInterval(localPollingRef.current);
                      localPollingRef.current = null;
                    }
                    setIsStreaming(false);
                    await loadCompletedAnalysis(pollStatus.summary_id);
                  } else if (pollStatus.status === "failed") {
                    // Stop polling on failure
                    if (localPollingRef.current) {
                      clearInterval(localPollingRef.current);
                      localPollingRef.current = null;
                    }
                    setIsStreaming(false);
                    setError(pollStatus.error || t.analysis.failed);
                  } else {
                    // Update progress
                    setAnalysisProgress(pollStatus.progress || 0);
                    setAnalysisStatus(
                      pollStatus.message || t.analysis.inProgress,
                    );
                    setAnalysisStep(
                      calculateStepFromProgress(pollStatus.progress || 0),
                    );
                  }
                } catch (pollError) {
                  if (__DEV__) {
                    console.error("Local polling error:", pollError);
                  }
                }
              }, 2500); // Poll every 2.5 seconds (same as BackgroundAnalysisContext)
            }
          }
        } else if (status.status === "failed") {
          if (isMountedRef.current) {
            setError(status.error || t.analysis.failed);
            setIsLoading(false);
          }
        }
      } catch {
        // Not a task ID - try loading as existing summary
        if (!isMountedRef.current) return;
        try {
          await loadCompletedAnalysis(summaryId);
        } catch {
          if (isMountedRef.current) {
            setError(t.errors.generic);
            setIsLoading(false);
          }
        }
      }
    };

    loadInitialData();

    return () => {
      isMountedRef.current = false;
      // Clean up local polling on unmount
      if (localPollingRef.current) {
        clearInterval(localPollingRef.current);
        localPollingRef.current = null;
      }
    };
  }, [
    summaryId,
    getTask,
    subscribeToTask,
    calculateStepFromProgress,
    loadCompletedAnalysis,
    t.analysis.inProgress,
    t.analysis.failed,
    t.errors.generic,
  ]);

  // Auto-redirect safety net: when progress reaches 100% but streaming hasn't stopped,
  // resolve the actual summary ID and replace the screen after a 500ms delay
  useEffect(() => {
    if (!isStreaming || analysisProgress < 100 || !summaryId) return;

    const timer = setTimeout(async () => {
      if (!isMountedRef.current) return;

      try {
        // Resolve the API task ID from the background task if available
        const backgroundTask = getTask(summaryId);
        const apiTaskId = backgroundTask?.taskId || summaryId;

        // Fetch latest status to get the actual summary_id
        const status = await videoApi.getStatus(apiTaskId);
        if (!isMountedRef.current) return;

        const actualSummaryId =
          status.summary_id ||
          (status.result?.id != null ? String(status.result.id) : undefined) ||
          (status.result?.summary_id != null
            ? String(status.result.summary_id)
            : undefined);
        if (actualSummaryId) {
          // Use replace to prevent going back to the loading screen
          // Use activeTabRef.current to avoid stale closure — the user may have
          // switched tabs while the analysis was completing
          navigation.replace("Analysis", {
            summaryId: actualSummaryId,
            initialTab: activeTabRef.current,
          });
        }
      } catch {
        // Silent fail - normal completion path or next poll cycle will handle it
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [analysisProgress, isStreaming, summaryId, getTask, navigation]);

  // Reload function for retry button
  const loadAnalysis = useCallback(async () => {
    if (!summaryId) return;
    setIsLoading(true);
    setError(null);

    try {
      await loadCompletedAnalysis(summaryId);
    } catch {
      setError(t.errors.generic);
      setIsLoading(false);
    }
  }, [summaryId, loadCompletedAnalysis, t.errors.generic]);

  // Load reliability data
  const loadReliabilityData = useCallback(async () => {
    if (!summary?.id) return;
    setIsLoadingReliability(true);
    try {
      const data = await videoApiService.getReliability(summary.id);
      setReliabilityData({
        overallScore: data.overall_score || 0,
        confidence: data.confidence,
        factors: data.factors?.map((f: any) => ({
          name: f.name,
          score: f.score,
          description: f.description,
        })),
        recommendations: data.recommendations,
      });
    } catch (err) {
      // Reliability data might not be available
    } finally {
      setIsLoadingReliability(false);
    }
  }, [summary?.id]);

  // Load reliability when summary is available
  useEffect(() => {
    if (summary?.id) {
      loadReliabilityData();
    }
  }, [summary?.id, loadReliabilityData]);

  // Send chat message (supports direct call with custom message for suggestions)
  const handleSendMessage = async (customMessage?: string) => {
    const messageText = customMessage || chatInput.trim();
    if (!messageText || !summary?.id || isSendingMessage) return;

    if (!customMessage) setChatInput("");
    setIsSendingMessage(true);

    // Add user message to chat
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, newUserMessage]);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const canWs = (PLAN_LIMITS[userPlan]?.webSearchMonthly ?? 0) > 0;
      const response = await chatApi.sendMessage(summary.id, messageText, {
        useWebSearch: canWs && webSearchEnabled,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.response,
        timestamp: new Date().toISOString(),
        web_search_used: response.web_search_used === true,
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      // Specific error messages based on error type
      let errorMessage = t.chat.errors.failed;
      if (err?.status === 402) {
        errorMessage =
          language === "fr"
            ? "Quota de chat dépassé. Passez à un plan supérieur."
            : "Chat quota exceeded. Please upgrade your plan.";
      } else if (err?.status === 429) {
        errorMessage =
          language === "fr"
            ? "Trop de requêtes. Veuillez patienter un moment."
            : "Too many requests. Please wait a moment.";
      } else if (err?.code === "TIMEOUT") {
        errorMessage =
          language === "fr"
            ? "Ça prend plus de temps que prévu — réessayez."
            : "Taking longer than expected — try again.";
      } else if (err?.code === "NETWORK_ERROR") {
        errorMessage =
          language === "fr"
            ? "Connexion perdue — on réessaie dans un instant"
            : "Connection lost — retrying shortly";
      }
      Alert.alert(t.common.error, errorMessage);
      // Remove the user message on error
      setChatMessages((prev) => prev.filter((m) => m.id !== newUserMessage.id));
      setChatInput(messageText);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Generate flashcards
  const handleGenerateFlashcards = async () => {
    if (!summary?.id || isLoadingTools) return;

    // Check plan access
    if (!hasFeature(userPlan, "flashcards")) {
      setUpgradeLimitType("analysis");
      setShowUpgradeModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoadingTools(true);
    setActiveStudyTool("flashcards");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await studyApi.generateFlashcards(summary.id);
      setFlashcards(result.flashcards || []);
      setCurrentFlashcardIndex(0);
      setShowFlashcardAnswer(false);
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
      setActiveStudyTool(null);
    } finally {
      setIsLoadingTools(false);
    }
  };

  // Generate Quiz
  const handleGenerateQuiz = async () => {
    if (!summary?.id || isLoadingQuiz) return;

    // Check plan access (quiz uses flashcards feature)
    if (!hasFeature(userPlan, "flashcards")) {
      setUpgradeLimitType("analysis");
      setShowUpgradeModal(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setIsLoadingQuiz(true);
    setActiveStudyTool("quiz");
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await studyApi.generateQuiz(summary.id);
      // Transform API response to QuizQuestion format
      const questions: QuizQuestion[] = (result.quiz || []).map((q: any) => ({
        question: q.question,
        options: q.options,
        correct: q.correct_index ?? q.correct ?? 0,
        explanation: q.explanation || "",
      }));
      setQuizQuestions(questions);
      setShowQuiz(true);
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
      setActiveStudyTool(null);
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // Reset study tool
  const handleResetStudyTool = () => {
    setActiveStudyTool(null);
    setShowQuiz(false);
  };

  // Share summary with public link
  const handleShare = async () => {
    if (!summary) return;

    try {
      const videoId = summary.videoId || summary.videoInfo?.id || "";
      let shareUrl = "";

      try {
        const { share_url } = await shareApi.createShareLink(videoId);
        shareUrl = share_url;
      } catch {
        // Fallback without share link
      }

      const message = [
        `\u{1F3AF} DeepSight \u2014 ${summary.title}`,
        summary.content
          ? `\u{1F4A1} ${summary.content.substring(0, 200)}...`
          : "",
        shareUrl ? `\n\u{1F517} ${shareUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await Share.share({
        message,
        url: shareUrl || undefined, // iOS only
        title: `DeepSight \u2014 ${summary.title}`,
      });

      // Analytics: track share
      analytics.track("share_link_created", {
        platform: summary.platform || "youtube",
        has_share_url: !!shareUrl,
      });
    } catch {
      /* share cancelled or failed */
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (!summary) return;

    await Clipboard.setStringAsync(summary.content || "");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(t.success.analysisCopied, "success");
  };

  // Open YouTube video
  const handleOpenVideo = () => {
    if (summary?.videoId) {
      Linking.openURL(`https://www.youtube.com/watch?v=${summary.videoId}`);
    }
  };

  // Handle timecode press - opens YouTube at specific timestamp
  const handleTimecodePress = useCallback(
    (seconds: number) => {
      if (summary?.videoId) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const timeParam = `&t=${Math.floor(seconds)}`;
        Linking.openURL(
          `https://www.youtube.com/watch?v=${summary.videoId}${timeParam}`,
        );
      }
    },
    [summary?.videoId],
  );

  // Notes and tags handlers
  const handleSaveNotes = async () => {
    if (!summary?.id) return;

    setIsSavingNotes(true);
    try {
      await videoApi.updateNotes(summary.id, personalNotes);
      setIsEditingNotes(false);
      showToast(t.success.settingsSaved, "success");
    } catch (error) {
      showToast(t.errors.generic, "error");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddTag = async () => {
    if (!summary?.id || !newTag.trim()) return;

    const trimmedTag = newTag.trim().toLowerCase();
    if (tags.includes(trimmedTag)) {
      setNewTag("");
      return;
    }

    const updatedTags = [...tags, trimmedTag];
    setTags(updatedTags);
    setNewTag("");

    try {
      await videoApi.updateTags(summary.id, updatedTags);
    } catch (error) {
      setTags(tags); // Revert on error
      showToast(t.errors.generic, "error");
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!summary?.id) return;

    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);

    try {
      await videoApi.updateTags(summary.id, updatedTags);
    } catch (error) {
      setTags(tags); // Revert on error
      showToast(t.errors.generic, "error");
    }
  };

  // Initialize notes and tags from summary
  useEffect(() => {
    if (summary) {
      setPersonalNotes((summary as any).notes || "");
      // Parse tags - backend stores as comma-separated string, mobile expects array
      const rawTags = (summary as any).tags;
      const parsedTags = Array.isArray(rawTags)
        ? rawTags
        : typeof rawTags === "string" && rawTags.trim() !== ""
          ? rawTags.split(",").map((t: string) => t.trim())
          : [];
      setTags(parsedTags);
    }
  }, [summary]);

  // Force dismiss keyboard when leaving chat sub-tab
  useEffect(() => {
    if (activeTab !== "study" || studySubTab !== "chat") {
      Keyboard.dismiss();
    }
  }, [activeTab, studySubTab]);

  // Defensive listener: if keyboard opens on a non-chat tab, force close it
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      if (!(activeTab === "study" && studySubTab === "chat")) {
        Keyboard.dismiss();
      }
    });
    return () => sub.remove();
  }, [activeTab, studySubTab]);

  // Render streaming state (new analysis in progress)
  if (isStreaming) {
    return (
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <Header title={t.analysis.title} showBack />
        <View style={styles.loadingContainer}>
          <Card variant="elevated" style={styles.streamingCard}>
            <StreamingProgress
              currentStep={analysisStep}
              progress={analysisProgress}
              statusMessage={analysisStatus}
              error={error || undefined}
            />
          </Card>
        </View>
      </View>
    );
  }

  // Render simple loading state (loading existing analysis from history)
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <Header title={t.analysis.title} showBack />
        <View style={styles.loadingContainer}>
          <DeepSightSpinner size="lg" showGlow />
          <Text
            style={[
              styles.loadingText,
              { color: colors.textSecondary, marginTop: Spacing.lg },
            ]}
          >
            {t.analysis.loading || "Chargement..."}
          </Text>
        </View>
      </View>
    );
  }

  // Render error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: "transparent" }]}>
        <Header title={t.analysis.title} showBack />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {error}
          </Text>
          <Button
            title={t.common.retry}
            onPress={loadAnalysis}
            style={styles.retryButton}
          />
        </View>
      </View>
    );
  }

  // Tabs
  const tabs: TabItem[] = [
    { id: "summary", label: t.analysis.summary, icon: "document-text-outline" },
    { id: "concepts", label: t.analysis.concepts, icon: "bulb-outline" },
    {
      id: "study",
      label: language === "fr" ? "Réviser" : "Study",
      icon: "school-outline",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: "transparent" }]}>
      <Header
        title={t.analysis.title}
        showBack
        rightAction={{ icon: "share-outline", onPress: handleShare }}
      />

      {/* Video Header — Full-width immersive thumbnail */}
      {summary && !showExpandedPlayer && (
        <TouchableOpacity
          onPress={() => setShowExpandedPlayer(true)}
          activeOpacity={0.9}
          style={styles.videoHeaderNew}
        >
          <Image
            source={{ uri: summary.videoInfo?.thumbnail }}
            style={styles.thumbnailFullWidth}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", "rgba(10,10,15,0.8)", "rgba(10,10,15,1)"]}
            style={styles.thumbnailGradient}
          />
          {/* Play button */}
          <View style={styles.playButtonOverlay}>
            <View style={styles.playButtonCircle}>
              <Text style={styles.playButtonIcon}>{"\u25B6"}</Text>
            </View>
          </View>
          {/* Video info over gradient */}
          <View style={styles.videoInfoOverlay}>
            <Text style={styles.videoTitleOverlay} numberOfLines={2}>
              {summary.title}
            </Text>
            <Text style={styles.videoMetaOverlay}>
              {summary.videoInfo?.channel} •{" "}
              {formatDuration(summary.videoInfo?.duration || 0)}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Expanded YouTube Player */}
      {summary && showExpandedPlayer && (
        <View style={styles.expandedPlayerContainer}>
          <TouchableOpacity
            style={[
              styles.collapseButton,
              { backgroundColor: colors.bgTertiary },
            ]}
            onPress={() => setShowExpandedPlayer(false)}
          >
            <Ionicons
              name="chevron-up"
              size={20}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.collapseText, { color: colors.textSecondary }]}
            >
              {t.chat.minimizeChat}
            </Text>
          </TouchableOpacity>
          <YouTubePlayer
            videoId={summary.videoId || ""}
            title={summary.title}
            channel={summary.videoInfo?.channel}
            duration={summary.videoInfo?.duration}
            thumbnail={summary.videoInfo?.thumbnail}
            platform={
              summary.platform ||
              detectPlatformFromUrl(summary.video_url, summary.videoId)
            }
          />
        </View>
      )}

      {/* Tabs — Animated sliding indicator */}
      <View
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          const newOffset = y + height;
          if (Math.abs(newOffset - tabContentOffsetRef.current) > 5) {
            tabContentOffsetRef.current = newOffset;
            setTabContentOffset(newOffset);
          }
        }}
      >
        <AnimatedTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={(tabId) => {
            Keyboard.dismiss();
            requestAnimationFrame(() => {
              setActiveTab(tabId as TabType);
            });
          }}
        />
      </View>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <View
          style={{ flex: 1 }}
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return false;
          }}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {/* Summary badges */}
            <View style={styles.badgesRow}>
              <PlatformBadge
                platform={
                  summary?.platform ||
                  detectPlatformFromUrl(summary?.video_url, summary?.videoId)
                }
                size="md"
                showLabel
              />
              <Badge label={summary?.mode || "Standard"} variant="primary" />
              <Badge label={summary?.category || "Général"} variant="default" />
              {summary?.language && (
                <Badge
                  label={summary.language.toUpperCase()}
                  variant="default"
                />
              )}
            </View>

            {/* Freshness and Reliability indicators */}
            <View style={styles.indicatorsRow}>
              {summary?.videoInfo?.publishedAt && (
                <FreshnessIndicator
                  publicationDate={summary.videoInfo.publishedAt}
                  compact
                />
              )}
              {reliabilityData && (
                <ReliabilityScore
                  overallScore={reliabilityData.overallScore}
                  confidence={reliabilityData.confidence}
                  factors={reliabilityData.factors}
                  recommendations={reliabilityData.recommendations}
                  compact
                />
              )}
            </View>

            {/* Summary content or Quick Chat upgrade panel */}
            {summary?.mode === "quick_chat" && !summary?.content ? (
              <View
                style={{
                  padding: 20,
                  borderRadius: 16,
                  backgroundColor: colors.bgCard,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "#10b98120",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name="chatbubbles-outline"
                      size={20}
                      color="#10b981"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "600",
                        color: colors.textPrimary,
                      }}
                    >
                      Quick Chat
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {language === "fr"
                        ? "Pas encore d'analyse. Generez le resume complet."
                        : "No analysis yet. Generate the full summary."}
                    </Text>
                  </View>
                </View>

                {/* Mode selector */}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: colors.textSecondary,
                    marginBottom: 8,
                  }}
                >
                  {language === "fr" ? "Mode d'analyse" : "Analysis mode"}
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}
                >
                  {["accessible", "standard", "expert"].map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setUpgradeMode(m)}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        borderRadius: 10,
                        alignItems: "center",
                        backgroundColor:
                          upgradeMode === m
                            ? colors.accentPrimary
                            : colors.bgSecondary,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "600",
                          color:
                            upgradeMode === m ? "#fff" : colors.textSecondary,
                        }}
                      >
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Deep Research toggle */}
                <TouchableOpacity
                  onPress={() => setUpgradeDeepResearch(!upgradeDeepResearch)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: colors.bgSecondary,
                    marginBottom: 16,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "500",
                        color: colors.textPrimary,
                      }}
                    >
                      {language === "fr"
                        ? "Recherche approfondie"
                        : "Deep Research"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {language === "fr"
                        ? "Sources externes + fact-checking"
                        : "External sources + fact-checking"}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: upgradeDeepResearch
                        ? colors.accentPrimary
                        : colors.bgTertiary,
                      justifyContent: "center",
                      paddingHorizontal: 2,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "#fff",
                        alignSelf: upgradeDeepResearch
                          ? "flex-end"
                          : "flex-start",
                      }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Generate button */}
                <TouchableOpacity
                  onPress={handleUpgradeQuickChat}
                  disabled={upgradeLoading}
                  style={{
                    paddingVertical: 14,
                    borderRadius: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                    opacity: upgradeLoading ? 0.6 : 1,
                  }}
                >
                  <LinearGradient
                    colors={[colors.accentPrimary, "#3b82f6"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      borderRadius: 12,
                    }}
                  />
                  {upgradeLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="play" size={18} color="#fff" />
                  )}
                  <Text
                    style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}
                  >
                    {upgradeLoading
                      ? language === "fr"
                        ? "Analyse en cours..."
                        : "Analyzing..."
                      : language === "fr"
                        ? "Generer l'analyse (1 credit)"
                        : "Generate analysis (1 credit)"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Card variant="elevated" style={styles.summaryCard}>
                <AnalysisContentDisplay
                  content={summary?.content || ""}
                  onTimecodePress={handleTimecodePress}
                  showEmptyState={!summary?.content}
                  emptyStateMessage={t.history.empty}
                />
                {summary?.content && (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      marginTop: 8,
                    }}
                  >
                    <AudioPlayerButton
                      text={summary.content.slice(0, 5000)}
                      size="md"
                    />
                  </View>
                )}
              </Card>
            )}

            {/* Actions — Glassmorphism container */}
            <View
              style={[
                styles.actionsRowGlass,
                { backgroundColor: colors.bgCard, borderColor: colors.border },
              ]}
            >
              <ActionButton
                icon="copy-outline"
                label={t.common.copy}
                onPress={handleCopy}
              />
              <ActionButton
                icon="share-outline"
                label={t.common.share}
                onPress={handleShare}
              />
              <ActionButton
                icon="play-outline"
                label={t.common.video}
                onPress={handleOpenVideo}
                color={colors.accentSecondary}
              />
            </View>

            {/* Analysis date */}
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {t.analysis.publishedAt} {formatDate(summary?.createdAt || "")}
            </Text>

            {/* Analysis Value Display - Show time saved */}
            {summary?.videoInfo?.duration && (
              <View style={{ marginTop: Spacing.lg }}>
                <AnalysisValueDisplay
                  videoDurationSeconds={summary.videoInfo.duration}
                  creditsUsed={(summary as any).creditsUsed || 1}
                  animated
                />
              </View>
            )}

            {/* Tournesol Widget */}
            {summary?.videoId && (
              <View style={{ marginTop: Spacing.lg }}>
                <TournesolWidget videoId={summary.videoId} />
              </View>
            )}

            {/* TTS Player - Listen to summary */}
            {summary?.content && (
              <View style={{ marginTop: Spacing.lg, alignItems: "flex-start" }}>
                <AudioPlayerButton
                  text={summary.content}
                  size="md"
                  onUpgradePress={() => {
                    setUpgradeLimitType("tts");
                    setShowUpgradeModal(true);
                  }}
                />
              </View>
            )}

            {/* Notes Section */}
            <Card
              variant="elevated"
              style={[styles.summaryCard, { marginTop: Spacing.lg }]}
            >
              <View style={styles.notesHeader}>
                <View style={styles.notesTitleRow}>
                  <Ionicons
                    name="document-text-outline"
                    size={16}
                    color={colors.accentPrimary}
                  />
                  <Text
                    style={[
                      styles.notesTitle,
                      { color: colors.textPrimary, marginLeft: 6 },
                    ]}
                  >
                    {t.analysis.personalNotes}
                  </Text>
                </View>
                {!isEditingNotes ? (
                  <TouchableOpacity onPress={() => setIsEditingNotes(true)}>
                    <Ionicons
                      name="pencil"
                      size={18}
                      color={colors.accentPrimary}
                    />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    <Text
                      style={{
                        color: colors.accentPrimary,
                        fontFamily: Typography.fontFamily.bodyMedium,
                      }}
                    >
                      {isSavingNotes ? "..." : t.common.save}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {isEditingNotes ? (
                <TextInput
                  style={[
                    styles.notesInput,
                    {
                      backgroundColor: colors.bgSecondary,
                      color: colors.textPrimary,
                      borderColor: colors.border,
                    },
                  ]}
                  multiline
                  numberOfLines={4}
                  placeholder={t.analysis.notesPlaceholder}
                  placeholderTextColor={colors.textTertiary}
                  value={personalNotes}
                  onChangeText={setPersonalNotes}
                />
              ) : (
                <Text
                  style={[
                    styles.notesContent,
                    {
                      color: personalNotes
                        ? colors.textSecondary
                        : colors.textTertiary,
                    },
                  ]}
                >
                  {personalNotes || t.analysis.noNotes}
                </Text>
              )}
            </Card>

            {/* Tags Section */}
            <Card
              variant="elevated"
              style={[styles.summaryCard, { marginTop: Spacing.md }]}
            >
              <View
                style={[styles.notesTitleRow, { marginBottom: Spacing.sm }]}
              >
                <Ionicons
                  name="pricetags-outline"
                  size={16}
                  color={colors.accentSecondary}
                />
                <Text
                  style={[
                    styles.notesTitle,
                    { color: colors.textPrimary, marginLeft: 6 },
                  ]}
                >
                  Tags
                </Text>
              </View>
              <View style={styles.tagsContainer}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagChip,
                      { backgroundColor: colors.accentPrimary + "20" },
                    ]}
                    onPress={() => handleRemoveTag(tag)}
                  >
                    <Text
                      style={[styles.tagText, { color: colors.accentPrimary }]}
                    >
                      {tag}
                    </Text>
                    <Ionicons
                      name="close"
                      size={14}
                      color={colors.accentPrimary}
                    />
                  </TouchableOpacity>
                ))}
                <View
                  style={[
                    styles.addTagContainer,
                    { borderColor: colors.border },
                  ]}
                >
                  <TextInput
                    style={[styles.tagInput, { color: colors.textPrimary }]}
                    placeholder={`+ ${t.common.add}`}
                    placeholderTextColor={colors.textTertiary}
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                  />
                </View>
              </View>
            </Card>

            {/* Detailed Reliability Score */}
            {reliabilityData && (
              <View style={{ marginTop: Spacing.lg }}>
                <ReliabilityScore
                  overallScore={reliabilityData.overallScore}
                  confidence={reliabilityData.confidence}
                  factors={reliabilityData.factors}
                  recommendations={reliabilityData.recommendations}
                  onAnalyze={loadReliabilityData}
                  isLoading={isLoadingReliability}
                />
              </View>
            )}

            {/* Detailed Freshness Indicator */}
            {summary?.videoInfo?.publishedAt && (
              <View style={{ marginTop: Spacing.lg }}>
                <FreshnessIndicator
                  publicationDate={summary.videoInfo.publishedAt}
                />
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {activeTab === "concepts" && (
        <View
          style={{ flex: 1 }}
          onStartShouldSetResponder={() => {
            Keyboard.dismiss();
            return false;
          }}
        >
          <ScrollView
            style={styles.content}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
          >
            {concepts.length > 0 ? (
              concepts.map((concept, index) => (
                <Card
                  key={`concept-${index}-${concept.name}`}
                  variant="elevated"
                  style={[
                    styles.conceptCard,
                    {
                      borderLeftWidth: 4,
                      borderLeftColor:
                        index % 3 === 0
                          ? "#3b82f6"
                          : index % 3 === 1
                            ? "#8b5cf6"
                            : "#06b6d4",
                      backgroundColor: colors.bgCard,
                    },
                  ]}
                >
                  <View style={styles.conceptHeader}>
                    <Text
                      style={[
                        styles.conceptName,
                        { color: colors.accentPrimary, flex: 1 },
                      ]}
                    >
                      {concept.name}
                    </Text>
                    {summary && (
                      <WebEnrichment
                        summaryId={summary.id}
                        conceptName={concept.name}
                        compact
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.conceptDefinition,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {concept.definition}
                  </Text>
                </Card>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons
                  name="bulb-outline"
                  size={48}
                  color={colors.textTertiary}
                />
                <Text
                  style={[styles.emptyText, { color: colors.textSecondary }]}
                >
                  {t.analysis.noConcepts}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {activeTab === "study" && (
        <View style={{ flex: 1 }}>
          {/* Segmented Control: Chat IA / Outils d'étude */}
          {!activeStudyTool && (
            <View
              style={[
                styles.studySegmentContainer,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.studySegmentBtn,
                  studySubTab === "chat" && [
                    styles.studySegmentActive,
                    { borderBottomColor: colors.accentPrimary },
                  ],
                ]}
                onPress={() => setStudySubTab("chat")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbubble-outline"
                  size={16}
                  color={
                    studySubTab === "chat"
                      ? colors.accentPrimary
                      : colors.textTertiary
                  }
                />
                <Text
                  style={[
                    styles.studySegmentText,
                    {
                      color:
                        studySubTab === "chat"
                          ? colors.accentPrimary
                          : colors.textTertiary,
                    },
                    studySubTab === "chat" && styles.studySegmentTextActive,
                  ]}
                >
                  Chat IA
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.studySegmentBtn,
                  studySubTab === "tools" && [
                    styles.studySegmentActive,
                    { borderBottomColor: colors.accentPrimary },
                  ],
                ]}
                onPress={() => setStudySubTab("tools")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="albums-outline"
                  size={16}
                  color={
                    studySubTab === "tools"
                      ? colors.accentPrimary
                      : colors.textTertiary
                  }
                />
                <Text
                  style={[
                    styles.studySegmentText,
                    {
                      color:
                        studySubTab === "tools"
                          ? colors.accentPrimary
                          : colors.textTertiary,
                    },
                    studySubTab === "tools" && styles.studySegmentTextActive,
                  ]}
                >
                  {language === "fr" ? "Outils" : "Tools"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Chat IA sub-tab */}
          {studySubTab === "chat" && !activeStudyTool && (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={
                Platform.OS === "ios" ? tabContentOffset : 0
              }
            >
              <FlatList
                ref={chatScrollRef}
                data={chatMessages}
                keyExtractor={(item, index) =>
                  `chat-${index}-${item.id || "msg"}`
                }
                keyboardDismissMode="none"
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  flexGrow: 1,
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                }}
                onContentSizeChange={() =>
                  chatScrollRef.current?.scrollToEnd({ animated: true })
                }
                ListEmptyComponent={
                  <View style={styles.chatEmptyState}>
                    <Ionicons
                      name="chatbubble-outline"
                      size={48}
                      color={colors.textTertiary}
                    />
                    <Text
                      style={[
                        styles.chatEmptyText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t.chat.askQuestion}
                    </Text>
                    <View style={{ marginTop: Spacing.lg, width: "100%" }}>
                      <SuggestedQuestions
                        onQuestionSelect={(question) =>
                          handleSendMessage(question)
                        }
                        variant="chat"
                        category={summary?.category}
                      />
                    </View>
                  </View>
                }
                renderItem={({ item, index }) => (
                  <ChatBubble
                    role={item.role}
                    content={item.content}
                    timestamp={item.timestamp}
                    index={index}
                    onQuestionPress={(question) => handleSendMessage(question)}
                    webSearchUsed={item.web_search_used}
                  />
                )}
                ListFooterComponent={
                  isSendingMessage ? <TypingIndicator /> : null
                }
              />

              {/* Chat limit warning */}
              {planLimits.chatDailyLimit !== -1 &&
                planUsage.chat_messages_today >= planLimits.chatDailyLimit && (
                  <View style={styles.chatLimitWarning}>
                    <Text style={styles.chatLimitText}>
                      {language === "fr"
                        ? "Limite atteinte. Passez au plan supérieur pour continuer."
                        : "Limit reached. Upgrade to continue chatting."}
                    </Text>
                  </View>
                )}
              <ChatInput
                value={chatInput}
                onChangeText={setChatInput}
                onSend={() => handleSendMessage()}
                isLoading={isSendingMessage}
                showWebSearch={true}
                webSearchEnabled={webSearchEnabled}
                onToggleWebSearch={() => {
                  const canWs =
                    (PLAN_LIMITS[userPlan]?.webSearchMonthly ?? 0) > 0;
                  if (!canWs) {
                    setUpgradeLimitType("webSearch");
                    setShowUpgradeModal(true);
                  } else {
                    setWebSearchEnabled(!webSearchEnabled);
                  }
                }}
                canUseWebSearch={
                  (PLAN_LIMITS[userPlan]?.webSearchMonthly ?? 0) > 0
                }
              />
            </KeyboardAvoidingView>
          )}

          {/* Outils d'étude sub-tab */}
          {(studySubTab === "tools" || activeStudyTool) && (
            <View
              style={styles.toolsContainer}
              onStartShouldSetResponder={() => {
                Keyboard.dismiss();
                return false;
              }}
            >
              {/* Back button when a tool is active */}
              {activeStudyTool && (
                <TouchableOpacity
                  style={[
                    styles.backToTools,
                    { backgroundColor: colors.bgElevated },
                  ]}
                  onPress={handleResetStudyTool}
                >
                  <Ionicons
                    name="arrow-back"
                    size={20}
                    color={colors.textPrimary}
                  />
                  <Text
                    style={[
                      styles.backToToolsText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t.common.back}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Tool Selection */}
              {!activeStudyTool && (
                <ScrollView
                  style={styles.content}
                  contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                >
                  <Text
                    style={[styles.toolsTitle, { color: colors.textPrimary }]}
                  >
                    {t.analysis.studyTools}
                  </Text>

                  {/* Flashcards Button */}
                  <TouchableOpacity
                    style={[
                      styles.toolCard,
                      { backgroundColor: colors.bgElevated },
                    ]}
                    onPress={handleGenerateFlashcards}
                    disabled={isLoadingTools}
                  >
                    <View
                      style={[
                        styles.toolIconContainer,
                        { backgroundColor: `${colors.accentPrimary}20` },
                      ]}
                    >
                      <Ionicons
                        name="albums-outline"
                        size={28}
                        color={colors.accentPrimary}
                      />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text
                        style={[styles.toolName, { color: colors.textPrimary }]}
                      >
                        Flashcards
                      </Text>
                      <Text
                        style={[
                          styles.toolDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t.chat.suggestions.summary}
                      </Text>
                    </View>
                    {isLoadingTools && (
                      <DeepSightSpinner
                        size="sm"
                        speed="fast"
                        color={colors.accentPrimary}
                      />
                    )}
                    {!isLoadingTools && flashcards.length > 0 && (
                      <Badge label={`${flashcards.length}`} variant="primary" />
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Quiz Button */}
                  <TouchableOpacity
                    style={[
                      styles.toolCard,
                      { backgroundColor: colors.bgElevated },
                    ]}
                    onPress={handleGenerateQuiz}
                    disabled={isLoadingQuiz}
                  >
                    <View
                      style={[
                        styles.toolIconContainer,
                        { backgroundColor: `${colors.accentWarning}20` },
                      ]}
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={28}
                        color={colors.accentWarning}
                      />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text
                        style={[styles.toolName, { color: colors.textPrimary }]}
                      >
                        Quiz
                      </Text>
                      <Text
                        style={[
                          styles.toolDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t.chat.suggestions.keyPoints}
                      </Text>
                    </View>
                    {isLoadingQuiz && (
                      <DeepSightSpinner
                        size="sm"
                        speed="fast"
                        color={colors.accentWarning}
                      />
                    )}
                    {!isLoadingQuiz && quizQuestions.length > 0 && (
                      <Badge
                        label={`${quizQuestions.length}Q`}
                        variant="warning"
                      />
                    )}
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

                  {/* Verification Section */}
                  <Text
                    style={[
                      styles.toolsSectionTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t.analysis.factCheck}
                  </Text>

                  {summary && (
                    <>
                      <FactCheckButton summaryId={summary.id} />
                      <View style={{ height: Spacing.sm }} />
                      <WebEnrichment summaryId={summary.id} />
                    </>
                  )}

                  {/* Academic Sources Section */}
                  {summary && (
                    <AcademicSourcesSection
                      summaryId={summary.id}
                      userPlan={user?.plan}
                      onUpgrade={() => {
                        setUpgradeLimitType("analysis");
                        setShowUpgradeModal(true);
                      }}
                    />
                  )}

                  {/* Share & Copy Section */}
                  <Text
                    style={[
                      styles.toolsSectionTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {t.common.share}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.toolCard,
                      { backgroundColor: colors.bgElevated },
                    ]}
                    onPress={handleShare}
                  >
                    <View
                      style={[
                        styles.toolIconContainer,
                        { backgroundColor: `${colors.textTertiary}20` },
                      ]}
                    >
                      <Ionicons
                        name="share-outline"
                        size={28}
                        color={colors.textTertiary}
                      />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text
                        style={[styles.toolName, { color: colors.textPrimary }]}
                      >
                        {t.common.share}
                      </Text>
                      <Text
                        style={[
                          styles.toolDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t.analysis.summary}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.toolCard,
                      { backgroundColor: colors.bgElevated },
                    ]}
                    onPress={handleCopy}
                  >
                    <View
                      style={[
                        styles.toolIconContainer,
                        { backgroundColor: `${colors.textTertiary}20` },
                      ]}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={28}
                        color={colors.textTertiary}
                      />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text
                        style={[styles.toolName, { color: colors.textPrimary }]}
                      >
                        {t.common.copy}
                      </Text>
                      <Text
                        style={[
                          styles.toolDescription,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t.success.analysisCopied}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </ScrollView>
              )}

              {/* Flashcards Display */}
              {activeStudyTool === "flashcards" && (
                <FlashcardsComponent
                  flashcards={flashcards}
                  isLoading={isLoadingTools}
                  onComplete={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }}
                />
              )}

              {/* Quiz Display */}
              {activeStudyTool === "quiz" && (
                <QuizComponent
                  questions={quizQuestions}
                  isLoading={isLoadingQuiz}
                  onComplete={(score, total) => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                  }}
                  onRetry={() => {
                    setQuizQuestions([]);
                    handleGenerateQuiz();
                  }}
                />
              )}
            </View>
          )}
        </View>
      )}

      {/* Upgrade Modal */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType={upgradeLimitType}
      />

      {/* Voice Chat FAB + Modal */}
      {summary && summaryId && (
        <>
          <VoiceButton
            summaryId={String(summaryId)}
            videoTitle={summary.title || ""}
            onSessionStart={() => setShowVoiceScreen(true)}
          />
          <VoiceScreen
            visible={showVoiceScreen}
            onClose={() => {
              voiceChat.stop();
              setShowVoiceScreen(false);
            }}
            videoTitle={summary.title || ""}
            channelName={summary.videoInfo?.channel}
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

      {/* Floating Chat FAB - visible on all tabs except study/chat */}
      {summary && !(activeTab === "study" && studySubTab === "chat") && (
        <FloatingChat
          summaryId={summary.id}
          videoTitle={summary.title}
          category={summary.category}
          initialMessages={chatMessages}
          onMessagesUpdate={setChatMessages}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
  progressContainer: {
    width: "80%",
    marginTop: Spacing.lg,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  retryButton: {
    marginTop: Spacing.lg,
  },
  videoHeaderNew: {
    position: "relative",
    width: "100%",
    height: 180,
  },
  thumbnailFullWidth: {
    width: "100%",
    height: 180,
    position: "absolute",
    top: 0,
    left: 0,
  },
  thumbnailGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  playButtonOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  playButtonIcon: {
    fontSize: 24,
    color: "#ffffff",
    marginLeft: 4,
  },
  videoInfoOverlay: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
  },
  videoTitleOverlay: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  videoMetaOverlay: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  videoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  thumbnail: {
    width: 80,
    height: 45,
    borderRadius: BorderRadius.sm,
  },
  videoInfo: {
    flex: 1,
  },
  videoTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  videoMeta: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  expandedPlayerContainer: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  collapseText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
  },
  badgesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  indicatorsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    flexWrap: "wrap",
  },
  streamingCard: {
    width: "100%",
    padding: 0,
    overflow: "hidden",
  },
  summaryCard: {
    marginBottom: Spacing.md,
  },
  summaryContent: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: Spacing.md,
  },
  actionsRowGlass: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: Spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  actionButton: {
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    minWidth: 80,
  },
  actionLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  dateText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  conceptCard: {
    marginBottom: Spacing.md,
  },
  conceptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  conceptName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  conceptDefinition: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  chatContainer: {
    flex: 1,
  },
  chatMessages: {
    padding: Spacing.md,
  },
  chatEmptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  chatEmptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  studySegmentContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  studySegmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  studySegmentActive: {
    borderBottomWidth: 2,
  },
  studySegmentText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  studySegmentTextActive: {
    fontWeight: "600" as const,
  },
  toolsContainer: {
    flex: 1,
  },
  backToTools: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  backToToolsText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  toolsTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.md,
  },
  toolsSectionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  toolCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  toolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: 2,
  },
  toolDescription: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  generateButton: {
    marginBottom: Spacing.xl,
  },
  flashcardsContainer: {
    marginBottom: Spacing.xl,
  },
  flashcard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    minHeight: 200,
    justifyContent: "center",
  },
  flashcardLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  flashcardContent: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.body,
    textAlign: "center",
    lineHeight: Typography.fontSize.lg * 1.5,
  },
  flashcardHint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.lg,
  },
  flashcardNav: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  flashcardNavButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  // Notes styles
  notesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  notesTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    minHeight: 100,
    textAlignVertical: "top",
  },
  notesContent: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  // Tags styles
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  tagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  addTagContainer: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tagInput: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    minWidth: 60,
    paddingVertical: 0,
  },
  chatLimitWarning: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  chatLimitText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
    color: "#f59e0b",
    textAlign: "center",
  },
});

export default AnalysisScreen;
