import React, { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, StatusBar, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarFootprint } from "@/hooks/useTabBarFootprint";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PagerView from "react-native-pager-view";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { springs } from "@/theme/animations";
import { videoApi, historyApi } from "@/services/api";
import { resetCircuitBreaker } from "@/services/RetryService";
import { OfflineCache, CachePriority } from "@/services/OfflineCache";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useTabBarStore } from "@/stores/tabBarStore";
import type { AnalysisSummary } from "@/types";
import { AnalysisSkeleton } from "@/components/ui/SkeletonLoader";
import { VideoPlayer } from "@/components/analysis/VideoPlayer";
import { StreamingOverlay } from "@/components/analysis/StreamingOverlay";
import { AnalysisContentDisplay } from "@/components/analysis/AnalysisContentDisplay";
import { ActionBar } from "@/components/analysis/ActionBar";
import { ConversationScreen } from "@/components/conversation";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { VoiceButton } from "@/components/voice/VoiceButton";
import { TutorButton } from "@/components/tutor/TutorButton";
import { TutorBottomSheet } from "@/components/tutor/TutorBottomSheet";
import { ExportMenu } from "@/components/export";
import { AcademicSourcesSection } from "@/components/academic";
import { FactCheckButton } from "@/components/factcheck";
import { WebEnrichment } from "@/components/enrichment";
import { usePlan } from "@/contexts/PlanContext";

const TAB_LABELS = ["Résumé", "Sources", "Chat"] as const;
const TAB_COUNT = TAB_LABELS.length;

export default function AnalysisDetailScreen() {
  const { id, backTo, initialTab } = useLocalSearchParams<{
    id: string;
    backTo?: string;
    initialTab?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const tabBarFootprint = useTabBarFootprint();
  const { colors, isDark } = useTheme();
  const store = useAnalysisStore();
  const isOffline = useIsOffline();

  const pagerRef = useRef<PagerView>(null);
  const initialTabIndex = Number(initialTab ?? "0");

  // Track whether we started from a new analysis (id = task_id) or library (id = summary_id).
  // Refs are stable and evaluated once on mount — store.status is 'processing'/'pending' only
  // when the user just submitted a new analysis.
  const startedStreaming = useRef(
    store.status === "processing" || store.status === "pending",
  );
  const [activeTab, setActiveTab] = useState(initialTabIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVoiceVisible, setIsVoiceVisible] = useState(false);
  const [isExportVisible, setIsExportVisible] = useState(false);
  const [isTutorVisible, setIsTutorVisible] = useState(false);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const scrollY = useSharedValue(0);
  const tabIndicatorX = useSharedValue(initialTabIndex);
  const { plan } = usePlan();

  // Sync PagerView to initialTab (only on mount)
  React.useEffect(() => {
    if (initialTabIndex > 0) {
      pagerRef.current?.setPage(initialTabIndex);
      tabIndicatorX.value = initialTabIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [resolvedSummaryId, setResolvedSummaryId] = useState<string | null>(
    null,
  );
  const [summaryNotFound, setSummaryNotFound] = useState(false);

  // Reset local state when the route param `id` changes (navigating to a different analysis).
  // Without this, resolvedSummaryId from the previous analysis persists and effectiveId
  // keeps pointing to the old summary → user is "stuck" on the previous analysis.
  const prevIdRef = useRef(id);
  React.useEffect(() => {
    if (id !== prevIdRef.current) {
      prevIdRef.current = id;
      setResolvedSummaryId(null);
      setIsFullscreen(false);
      startedStreaming.current =
        store.status === "processing" || store.status === "pending";
    }
  }, [id, store.status]);

  // If we started from a new analysis (task_id navigation), NEVER use id directly
  // as summary_id — wait until resolvedSummaryId is set by handleStreamingComplete.
  // If we came from the library (id = summary_id), use id directly.
  const effectiveId =
    resolvedSummaryId ?? (!startedStreaming.current ? id : null);

  const isProcessing =
    store.status === "processing" || store.status === "pending";
  const isStreaming = store.status === "streaming";
  // En mode "failed", on garde l'overlay visible pour ne pas déclencher le query avec le task_id
  const showStreamingOverlay = isProcessing || store.status === "failed";
  const canFetchSummary =
    !!effectiveId && !isProcessing && store.status !== "failed";

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["summary", effectiveId],
    queryFn: async () => {
      const cacheKey = `summary_${effectiveId}`;

      // Offline: serve from cache or throw
      if (isOffline) {
        const cached = await OfflineCache.get<AnalysisSummary>(cacheKey);
        if (cached) return cached;
        throw new Error("OFFLINE_NO_CACHE");
      }

      // Online: fetch and cache on success, fallback to cache on network failure
      try {
        const result = await videoApi.getSummary(effectiveId!);
        // Persist for offline access (HIGH priority, 7-day TTL)
        await OfflineCache.set(cacheKey, result, {
          priority: CachePriority.HIGH,
          ttlMinutes: 7 * 24 * 60,
          tags: ["summaries"],
        });
        return result;
      } catch (err) {
        const cached = await OfflineCache.get<AnalysisSummary>(cacheKey);
        if (cached) return cached;
        throw err;
      }
    },
    enabled: canFetchSummary,
    // Keep retry count below the circuit breaker threshold (5 failures = open).
    // 2 retries = 3 total attempts → safely under the threshold.
    // Skip retries when offline — cache miss won't become a hit by retrying.
    retry: isOffline ? 0 : 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const [isFavorite, setIsFavorite] = useState(summary?.isFavorite ?? false);
  // Mode conversation = quel mode initial pour ConversationScreen quand on ouvre
  // depuis le bouton voice (FAB). 'call' déclenche auto-start mic. 'chat' = mic gris.
  const [conversationInitialMode, setConversationInitialMode] = useState<
    "chat" | "call"
  >("call");

  React.useEffect(() => {
    if (summary) setIsFavorite(summary.isFavorite);
  }, [summary]);

  const handleBack = useCallback(() => {
    store.resetAnalysis();
    if (backTo === "library") {
      router.replace("/(tabs)/library");
    } else if (backTo === "study") {
      router.replace("/(tabs)/study");
    } else if (backTo === "home") {
      router.replace("/(tabs)");
    } else {
      router.back();
    }
  }, [router, store, backTo]);

  /** Lance une nouvelle analyse depuis l'accueil */
  const handleNewAnalysis = useCallback(() => {
    store.resetAnalysis();
    router.replace("/(tabs)");
  }, [router, store]);

  const handleTabPress = useCallback(
    (index: number) => {
      setActiveTab(index);
      pagerRef.current?.setPage(index);
      tabIndicatorX.value = withSpring(index, springs.slide);
    },
    [tabIndicatorX],
  );

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const pos = e.nativeEvent.position;
      setActiveTab(pos);
      tabIndicatorX.value = withSpring(pos, springs.slide);
    },
    [tabIndicatorX],
  );

  const handleCancelAnalysis = useCallback(async () => {
    // Notify backend to stop processing
    if (id) {
      try {
        await videoApi.cancelTask(id);
      } catch (err) {
        if (__DEV__) console.warn("[CANCEL] Error cancelling task:", err);
      }
    }
    store.resetAnalysis();
    router.back();
  }, [store, router, id]);

  const handleStreamingComplete = useCallback(
    async (summaryId?: string) => {
      // Normalize: backend may send integer (number) or string
      const sid =
        summaryId != null && summaryId !== "" ? String(summaryId) : null;

      if (sid) {
        // Reset circuit breaker for this endpoint — previous failed attempts (if any)
        // during analysis must not block the first legitimate fetch.
        resetCircuitBreaker(`/api/videos/summary/${sid}`);
        setResolvedSummaryId(sid);
        store.resetAnalysis();
        queryClient.invalidateQueries({ queryKey: ["summary"] });
      } else {
        // Backend did not return summary_id (edge case) — poll history to find latest.
        // Reset store first so the overlay closes, then resolve the id.
        store.resetAnalysis();
        let foundId: string | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise<void>((r) => setTimeout(r, 1500 * (attempt + 1)));
          try {
            const hist = await historyApi.getHistory(1, 1);
            const latestId = hist.items[0]?.id;
            if (latestId) {
              foundId = latestId;
              break;
            }
          } catch {
            /* silent — retry */
          }
        }
        if (foundId) {
          resetCircuitBreaker(`/api/videos/summary/${foundId}`);
          setResolvedSummaryId(foundId);
        } else {
          setSummaryNotFound(true);
        }
        queryClient.invalidateQueries({ queryKey: ["summary"] });
      }
    },
    [store, queryClient],
  );

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Cacher la TabBar globale en mode fullscreen — `useFocusEffect` garantit
  // que la TabBar est réaffichée dès que l'écran perd le focus (back nav,
  // tab switch, modal stack), pas seulement au démontage. Évite que la
  // TabBar reste invisible si l'écran crash entre hide(true) et hide(false).
  const setTabBarHidden = useTabBarStore((s) => s.setTabBarHidden);
  useFocusEffect(
    React.useCallback(() => {
      setTabBarHidden(isFullscreen);
      return () => setTabBarHidden(false);
    }, [isFullscreen, setTabBarHidden]),
  );

  // Sync PagerView page after fullscreen toggle — the conditional rendering
  // (`!isFullscreen && Pager` vs `isFullscreen && Pager`) causes React to
  // unmount/remount the PagerView, which resets to initialPage=0.
  // This effect restores the correct tab position after the remount.
  React.useEffect(() => {
    if (activeTab > 0) {
      // Small delay to ensure PagerView is mounted before calling setPage
      const timer = setTimeout(() => {
        pagerRef.current?.setPage(activeTab);
      }, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  const tabWidth = tabBarWidth > 0 ? tabBarWidth / TAB_COUNT : 0;
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: tabIndicatorX.value * tabWidth }],
  }));

  // ── Éléments réutilisables ────────────────────────────────────────────────

  /** Tab bar identique en mode normal et fullscreen */
  const TabBar = (
    <View
      style={[styles.tabBar, { borderBottomColor: colors.border }]}
      onLayout={(e) => setTabBarWidth(e.nativeEvent.layout.width)}
    >
      {TAB_LABELS.map((label, index) => (
        <Pressable
          key={label}
          onPress={() => handleTabPress(index)}
          style={styles.tabButton}
          accessibilityLabel={label}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === index }}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === index ? palette.indigo : colors.textTertiary,
              },
              activeTab === index && styles.tabLabelActive,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        style={[
          styles.tabIndicator,
          { backgroundColor: palette.indigo },
          tabIndicatorStyle,
        ]}
      />
      <Pressable
        onPress={handleToggleFullscreen}
        style={styles.expandButton}
        accessibilityLabel={
          isFullscreen ? "Quitter le plein écran" : "Plein écran"
        }
        accessibilityRole="button"
      >
        <Ionicons
          name={isFullscreen ? "contract-outline" : "expand-outline"}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>
    </View>
  );

  const effectiveSummaryIdStr = resolvedSummaryId || (id as string) || "";
  const canExport = !!summary && !isProcessing;
  const sourcesEnabled = !!summary && !!effectiveSummaryIdStr;

  /** PagerView — instance unique, toujours dans le flow normal */
  const Pager = (
    <PagerView
      ref={pagerRef}
      style={styles.pager}
      initialPage={0}
      onPageSelected={handlePageSelected}
    >
      <View key="summary" style={styles.page}>
        <AnalysisContentDisplay
          content={summary?.content}
          isStreaming={isStreaming}
          streamingText={store.streamingText}
          isLoading={isLoading && canFetchSummary}
          error={error && !isProcessing ? "Erreur de chargement" : null}
          onRetry={() => refetch()}
          // Le container parent réserve déjà la footprint TabBar — le scroll
          // du content peut donc se contenter d'une marge respiration.
          bottomPadding={isFullscreen ? insets.bottom + sp.lg : sp["2xl"]}
        />
      </View>
      <View key="sources" style={styles.page}>
        {sourcesEnabled ? (
          <Animated.ScrollView
            contentContainerStyle={styles.sourcesScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sourcesHeader}>
              <FactCheckButton
                summaryId={effectiveSummaryIdStr}
                disabled={isOffline}
              />
            </View>
            <WebEnrichment
              summaryId={effectiveSummaryIdStr}
              disabled={isOffline}
            />
            <AcademicSourcesSection
              summaryId={effectiveSummaryIdStr}
              userPlan={plan}
              onUpgrade={() => router.push("/(tabs)/subscription")}
            />
          </Animated.ScrollView>
        ) : (
          <View style={styles.sourcesEmpty}>
            <Ionicons
              name="library-outline"
              size={48}
              color={colors.textTertiary}
            />
            <Text
              style={[styles.sourcesEmptyText, { color: colors.textSecondary }]}
            >
              Sources disponibles après l'analyse
            </Text>
          </View>
        )}
      </View>
      <View key="chat" style={[styles.page, styles.chatPlaceholder]}>
        <Ionicons
          name="chatbubbles-outline"
          size={48}
          color={colors.textTertiary}
        />
        <Text
          style={[styles.chatPlaceholderTitle, { color: colors.textPrimary }]}
        >
          Conversations dans le Hub
        </Text>
        <Text
          style={[styles.chatPlaceholderText, { color: colors.textTertiary }]}
        >
          Le chat avec cette vidéo se passe maintenant dans l'onglet Hub.
        </Text>
        <Pressable
          style={[
            styles.chatPlaceholderBtn,
            { backgroundColor: palette.indigo },
          ]}
          onPress={() => {
            router.push({
              pathname: "/(tabs)/hub",
              params: {
                summaryId: String(resolvedSummaryId || id),
                initialMode: "chat",
              },
            } as any);
          }}
          accessibilityLabel="Continuer la conversation dans le Hub"
          accessibilityRole="button"
        >
          <Text style={styles.chatPlaceholderBtnText}>
            Continuer dans le Hub
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </PagerView>
  );

  const BackHeader = (
    <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
      <Pressable
        onPress={handleBack}
        style={styles.iconButton}
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>
    </View>
  );

  // Loading state
  if (isLoading && !isProcessing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        {BackHeader}
        <AnalysisSkeleton />
      </View>
    );
  }

  // Summary not found after polling history
  if (summaryNotFound) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        {BackHeader}
        <View style={styles.errorContainer}>
          <Ionicons
            name="search-outline"
            size={48}
            color={colors.textTertiary}
          />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Analyse introuvable
          </Text>
          <Pressable
            onPress={handleBack}
            style={[
              styles.actionButton,
              { backgroundColor: colors.accentPrimary },
            ]}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>Retour</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Error state
  if (error && !isProcessing && store.status !== "failed" && !summary) {
    const isOfflineNoCache =
      isOffline || (error as Error)?.message === "OFFLINE_NO_CACHE";
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        {BackHeader}
        <View style={styles.errorContainer}>
          <Ionicons
            name={
              isOfflineNoCache
                ? "cloud-offline-outline"
                : "alert-circle-outline"
            }
            size={48}
            color={isOfflineNoCache ? colors.textSecondary : colors.accentError}
          />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {isOfflineNoCache
              ? "Hors ligne — cette analyse n'est pas encore en cache. Reconnectez-vous pour la télécharger."
              : "Impossible de charger l'analyse"}
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[
              styles.actionButton,
              { backgroundColor: colors.accentPrimary },
            ]}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>Réessayer</Text>
          </Pressable>
          <Pressable
            onPress={handleNewAnalysis}
            style={[
              styles.actionButton,
              { backgroundColor: colors.bgElevated, marginTop: sp.xs },
            ]}
            accessibilityLabel="Nouvelle analyse"
            accessibilityRole="button"
          >
            <Ionicons
              name="add-outline"
              size={16}
              color={colors.textSecondary}
              style={{ marginRight: sp.xs }}
            />
            <Text
              style={[styles.actionButtonText, { color: colors.textSecondary }]}
            >
              Nouvelle analyse
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgPrimary,
          // En fullscreen : paddingBottom=0 pour que l'overlay absolu atteigne le bas de l'écran.
          // En mode normal : footprint partagé pour ne jamais cacher le dernier élément derrière la TabBar.
          paddingBottom: isFullscreen ? 0 : tabBarFootprint,
        },
      ]}
    >
      <DoodleBackground variant="analysis" density="low" />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* Streaming Overlay */}
      {showStreamingOverlay && id && (
        <StreamingOverlay
          taskId={id}
          onCancel={handleCancelAnalysis}
          onComplete={handleStreamingComplete}
        />
      )}

      {/* ── MODE NORMAL ─────────────────────────────────── */}

      {/* Header normal — masqué en fullscreen */}
      {!isFullscreen && (
        <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
          <Pressable
            onPress={handleBack}
            style={styles.iconButton}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text
            style={[styles.headerTitle, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {summary?.title || "Analyse"}
          </Text>
          {/* Bouton export */}
          {canExport && (
            <Pressable
              onPress={() => setIsExportVisible(true)}
              style={styles.iconButton}
              accessibilityLabel="Exporter l'analyse"
              accessibilityRole="button"
            >
              <Ionicons
                name="share-outline"
                size={22}
                color={colors.textTertiary}
              />
            </Pressable>
          )}
          {/* Bouton nouvelle analyse */}
          <Pressable
            onPress={handleNewAnalysis}
            style={styles.iconButton}
            accessibilityLabel="Nouvelle analyse"
            accessibilityRole="button"
          >
            <Ionicons
              name="add-circle-outline"
              size={24}
              color={colors.textTertiary}
            />
          </Pressable>
        </View>
      )}

      {/* Video Player — masqué en fullscreen.
          NB: la condition de visibilité (videoId valide, plateforme connue,
          thumbnail TikTok dispo) est gérée DANS VideoPlayer pour garantir un
          rendu null systématique si le contenu n'est pas affichable. */}
      {!isFullscreen && summary && (
        <VideoPlayer
          videoId={summary.videoId}
          title={summary.title}
          scrollY={scrollY}
          platform={summary.platform}
          thumbnail={summary.thumbnail}
        />
      )}

      {/* Tab bar — masqué en fullscreen */}
      {!isFullscreen && TabBar}

      {/* PagerView normal — masqué en fullscreen */}
      {!isFullscreen && Pager}

      {/* Action Bar — masquée en fullscreen */}
      {!isFullscreen && summary && (
        <View>
          <TutorButton
            onPress={() => setIsTutorVisible(true)}
            disabled={!summary.title}
            style={styles.tutorButtonInline}
          />
          <ActionBar
            summaryId={summary.id}
            title={summary.title}
            videoId={summary.videoId}
            isFavorite={isFavorite}
            onFavoriteChange={setIsFavorite}
          />
        </View>
      )}

      {/* Tuteur V2 mobile lite — bottom-sheet text-only sur le concept de l'analyse */}
      {summary && (
        <TutorBottomSheet
          isOpen={isTutorVisible}
          onClose={() => setIsTutorVisible(false)}
          conceptTerm={summary.title ?? null}
          conceptDef={summary.title ?? null}
          summaryId={Number(summary.id)}
          sourceVideoTitle={summary.title ?? undefined}
        />
      )}

      {/* Export Menu */}
      {summary && (
        <ExportMenu
          summaryId={Number(summary.id)}
          videoTitle={summary.title || "analyse"}
          visible={isExportVisible}
          onClose={() => setIsExportVisible(false)}
        />
      )}

      {/* Voice Chat — bouton FAB ouvre ConversationScreen en mode 'call' */}
      {summary && (
        <>
          <VoiceButton
            summaryId={id as string}
            videoTitle={summary.title || "Vidéo"}
            onSessionStart={() => {
              setConversationInitialMode("call");
              setIsVoiceVisible(true);
            }}
          />
          <ConversationScreen
            visible={isVoiceVisible}
            summaryId={summary.id}
            initialMode={conversationInitialMode}
            videoTitle={summary.title || "Vidéo"}
            channelName={summary.channel}
            platform={
              (summary.platform === "tiktok" ? "tiktok" : "youtube") as
                | "youtube"
                | "tiktok"
            }
            initialFavorite={summary.isFavorite}
            onClose={() => setIsVoiceVisible(false)}
          />
        </>
      )}

      {/* ── MODE FULLSCREEN ──────────────────────────────── */}
      {/* paddingBottom du container est 0 → l'overlay couvre l'écran entier.
          La TabBar globale est cachée via tabBarStore (cf. useEffect ci-dessus)
          donc on n'a plus besoin de réserver TAB_BAR_HEIGHT — seul le safe area
          bottom suffit. */}
      {isFullscreen && (
        <View
          style={[
            styles.fullscreenOverlay,
            {
              backgroundColor: colors.bgPrimary,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {/* Header compact fullscreen */}
          <View style={styles.fullscreenHeader}>
            <Pressable
              onPress={handleBack}
              style={styles.iconButton}
              accessibilityLabel="Retour"
              accessibilityRole="button"
            >
              <Ionicons
                name="arrow-back"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
            <Text
              style={[styles.headerTitle, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {summary?.title || "Analyse"}
            </Text>
            <Pressable
              onPress={handleToggleFullscreen}
              style={styles.iconButton}
              accessibilityLabel="Quitter le plein écran"
              accessibilityRole="button"
            >
              <Ionicons
                name="contract-outline"
                size={22}
                color={colors.textPrimary}
              />
            </Pressable>
          </View>

          {/* Tab bar en fullscreen */}
          {TabBar}

          {/* PagerView plein écran — instance distincte mais même comportement */}
          {Pager}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tutorButtonInline: {
    marginHorizontal: sp.lg,
    marginBottom: sp.sm,
  },
  // Headers
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.md,
    paddingBottom: sp.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginHorizontal: sp.sm,
  },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: sp.lg,
    position: "relative",
    alignItems: "center",
  },
  tabButton: { flex: 1, paddingVertical: sp.md, alignItems: "center" },
  tabLabel: { fontFamily: fontFamily.body, fontSize: fontSize.sm },
  tabLabelActive: { fontFamily: fontFamily.bodySemiBold },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    borderRadius: 1,
  },
  expandButton: {
    position: "absolute",
    right: -sp.md,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  // Pager
  pager: { flex: 1 },
  page: { flex: 1, paddingTop: sp.md },
  // Sources tab
  sourcesScrollContent: {
    paddingHorizontal: sp.md,
    paddingBottom: sp["2xl"],
    gap: sp.md,
  },
  sourcesHeader: {
    alignItems: "flex-start",
    marginBottom: sp.sm,
  },
  sourcesEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp.md,
    paddingHorizontal: sp["3xl"],
  },
  sourcesEmptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  // Fullscreen overlay — position absolute avec bottom: 0
  // Le container parent a paddingBottom=0 en fullscreen → cet overlay couvre tout l'écran
  fullscreenOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.md,
    paddingBottom: sp.sm,
    paddingTop: sp.sm,
  },
  // Error / action states
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp.md,
    paddingHorizontal: sp["3xl"],
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: sp.md,
    paddingHorizontal: sp["2xl"],
    borderRadius: borderRadius.lg,
  },
  actionButtonText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: "#ffffff",
  },
  // Tab Chat placeholder → CTA Hub
  chatPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp["2xl"],
    gap: sp.md,
  },
  chatPlaceholderTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginTop: sp.sm,
  },
  chatPlaceholderText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: sp.md,
  },
  chatPlaceholderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingVertical: sp.md,
    paddingHorizontal: sp["2xl"],
    borderRadius: borderRadius.lg,
  },
  chatPlaceholderBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: "#fff",
  },
});
