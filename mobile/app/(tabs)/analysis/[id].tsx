import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PagerView from 'react-native-pager-view';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { palette } from '@/theme/colors';
import { springs } from '@/theme/animations';
import { videoApi, historyApi } from '@/services/api';
import { resetCircuitBreaker } from '@/services/RetryService';
import { useAnalysisStore } from '@/stores/analysisStore';
import { AnalysisSkeleton } from '@/components/ui/SkeletonLoader';
import { VideoPlayer } from '@/components/analysis/VideoPlayer';
import { StreamingOverlay } from '@/components/analysis/StreamingOverlay';
import { AnalysisContentDisplay } from '@/components/analysis/AnalysisContentDisplay';
import { ChatView } from '@/components/analysis/ChatView';
import { ActionBar } from '@/components/analysis/ActionBar';
import { QuickChatScreen } from '@/components/analysis/QuickChatScreen';
import { DoodleBackground } from '@/components/ui/DoodleBackground';
import { DeepSightSpinner } from '@/components/ui/DeepSightSpinner';

const TAB_LABELS = ['Résumé', 'Chat'] as const;
const TAB_BAR_HEIGHT = 60;

export default function AnalysisDetailScreen() {
  const { id, backTo, initialTab, quickChat } = useLocalSearchParams<{
    id: string;
    backTo?: string;
    initialTab?: string;
    quickChat?: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const store = useAnalysisStore();

  const pagerRef = useRef<PagerView>(null);
  const initialTabIndex = Number(initialTab ?? '0');

  // Track whether we started from a new analysis (id = task_id) or library (id = summary_id).
  // Refs are stable and evaluated once on mount — store.status is 'processing'/'pending' only
  // when the user just submitted a new analysis.
  const startedStreaming = useRef(
    store.status === 'processing' || store.status === 'pending'
  );
  const [activeTab, setActiveTab] = useState(initialTabIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollY = useSharedValue(0);
  const tabIndicatorX = useSharedValue(initialTabIndex);

  // Sync PagerView to initialTab (only on mount)
  React.useEffect(() => {
    if (initialTabIndex > 0) {
      pagerRef.current?.setPage(initialTabIndex);
      tabIndicatorX.value = initialTabIndex;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [resolvedSummaryId, setResolvedSummaryId] = useState<string | null>(null);

  // Reset local state when the route param `id` changes (navigating to a different analysis).
  // Without this, resolvedSummaryId from the previous analysis persists and effectiveId
  // keeps pointing to the old summary → user is "stuck" on the previous analysis.
  const prevIdRef = useRef(id);
  React.useEffect(() => {
    if (id !== prevIdRef.current) {
      prevIdRef.current = id;
      setResolvedSummaryId(null);
      setIsFullscreen(false);
      startedStreaming.current = store.status === 'processing' || store.status === 'pending';
    }
  }, [id, store.status]);

  // If we started from a new analysis (task_id navigation), NEVER use id directly
  // as summary_id — wait until resolvedSummaryId is set by handleStreamingComplete.
  // If we came from the library (id = summary_id), use id directly.
  const effectiveId = resolvedSummaryId ?? (!startedStreaming.current ? id : null);

  const isProcessing = store.status === 'processing' || store.status === 'pending';
  const isStreaming = store.status === 'streaming';
  // En mode "failed", on garde l'overlay visible pour ne pas déclencher le query avec le task_id
  const showStreamingOverlay = isProcessing || store.status === 'failed';
  const canFetchSummary = !!effectiveId && !isProcessing && store.status !== 'failed';

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['summary', effectiveId],
    queryFn: () => videoApi.getSummary(effectiveId!),
    enabled: canFetchSummary,
    // Keep retry count below the circuit breaker threshold (5 failures = open).
    // 2 retries = 3 total attempts → safely under the threshold.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
  });

  const [isFavorite, setIsFavorite] = useState(summary?.isFavorite ?? false);

  React.useEffect(() => {
    if (summary) setIsFavorite(summary.isFavorite);
  }, [summary]);

  const handleBack = useCallback(() => {
    store.resetAnalysis();
    if (backTo === 'library') {
      router.replace('/(tabs)/library');
    } else {
      router.back();
    }
  }, [router, store, backTo]);

  /** Lance une nouvelle analyse depuis l'accueil */
  const handleNewAnalysis = useCallback(() => {
    store.resetAnalysis();
    router.replace('/(tabs)');
  }, [router, store]);

  const handleTabPress = useCallback(
    (index: number) => {
      setActiveTab(index);
      pagerRef.current?.setPage(index);
      tabIndicatorX.value = withSpring(index, springs.slide);
    },
    [tabIndicatorX]
  );

  const handlePageSelected = useCallback(
    (e: { nativeEvent: { position: number } }) => {
      const pos = e.nativeEvent.position;
      setActiveTab(pos);
      tabIndicatorX.value = withSpring(pos, springs.slide);
    },
    [tabIndicatorX]
  );

  const handleCancelAnalysis = useCallback(() => {
    store.resetAnalysis();
    router.back();
  }, [store, router]);

  const handleStreamingComplete = useCallback(async (summaryId?: string) => {
    // Normalize: backend may send integer (number) or string
    const sid = summaryId != null && summaryId !== '' ? String(summaryId) : null;

    if (sid) {
      // Reset circuit breaker for this endpoint — previous failed attempts (if any)
      // during analysis must not block the first legitimate fetch.
      resetCircuitBreaker(`/api/videos/summary/${sid}`);
      setResolvedSummaryId(sid);
      store.resetAnalysis();
      queryClient.invalidateQueries({ queryKey: ['summary'] });
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
          if (latestId) { foundId = latestId; break; }
        } catch { /* silent — retry */ }
      }
      if (foundId) {
        resetCircuitBreaker(`/api/videos/summary/${foundId}`);
        setResolvedSummaryId(foundId);
      }
      queryClient.invalidateQueries({ queryKey: ['summary'] });
    }
  }, [store, queryClient]);

  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

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

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(tabIndicatorX.value, [0, 1], [0, 160]) }],
  }));

  // ── Éléments réutilisables ────────────────────────────────────────────────

  /** Tab bar identique en mode normal et fullscreen */
  const TabBar = (
    <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
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
              { color: activeTab === index ? palette.indigo : colors.textTertiary },
              activeTab === index && styles.tabLabelActive,
            ]}
          >
            {label}
          </Text>
        </Pressable>
      ))}
      <Animated.View
        style={[styles.tabIndicator, { backgroundColor: palette.indigo }, tabIndicatorStyle]}
      />
      <Pressable
        onPress={handleToggleFullscreen}
        style={styles.expandButton}
        accessibilityLabel={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isFullscreen ? 'contract-outline' : 'expand-outline'}
          size={18}
          color={colors.textTertiary}
        />
      </Pressable>
    </View>
  );

  /** keyboardVerticalOffset adapté selon le mode */
  const kbOffset = isFullscreen
    ? 88   // fullscreen : header compact (~56px) + tab bar (~44px) sans video player
    : 120; // normal : header + video player + tab bar

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
          error={error && !isProcessing ? 'Erreur de chargement' : null}
          onRetry={() => refetch()}
        />
      </View>
      <View key="chat" style={styles.page}>
        <ChatView
          summaryId={resolvedSummaryId || id || ''}
          keyboardOffset={kbOffset}
        />
      </View>
    </PagerView>
  );

  const BackHeader = (
    <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
      <Pressable onPress={handleBack} style={styles.iconButton} accessibilityLabel="Retour" accessibilityRole="button">
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>
    </View>
  );

  // ── Quick Chat mode ──────────────────────────────────────────────────────
  const isQuickChat = quickChat === 'true' || summary?.mode === 'quick_chat';

  if (isQuickChat && summary) {
    return <QuickChatScreen summary={summary} onBack={handleBack} />;
  }

  // Loading state — Quick Chat = DeepSight spinner, analyse = skeleton
  if (isLoading && !isProcessing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {BackHeader}
        {isQuickChat ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <DeepSightSpinner size="lg" label="Connexion au chat..." showLabel />
          </View>
        ) : (
          <AnalysisSkeleton />
        )}
      </View>
    );
  }

  // Error state
  if (error && !isProcessing && store.status !== 'failed' && !summary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {BackHeader}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Impossible de charger l'analyse</Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.actionButton, { backgroundColor: colors.accentPrimary }]}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <Text style={styles.actionButtonText}>Réessayer</Text>
          </Pressable>
          <Pressable
            onPress={handleNewAnalysis}
            style={[styles.actionButton, { backgroundColor: colors.bgElevated, marginTop: sp.xs }]}
            accessibilityLabel="Nouvelle analyse"
            accessibilityRole="button"
          >
            <Ionicons name="add-outline" size={16} color={colors.textSecondary} style={{ marginRight: sp.xs }} />
            <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Nouvelle analyse</Text>
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
          // En fullscreen : paddingBottom=0 pour que l'overlay absolu atteigne le bas de l'écran
          paddingBottom: isFullscreen ? 0 : TAB_BAR_HEIGHT + Math.max(insets.bottom, sp.sm),
        },
      ]}
    >
      <DoodleBackground variant="analysis" density="low" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

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
          <Pressable onPress={handleBack} style={styles.iconButton} accessibilityLabel="Retour" accessibilityRole="button">
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {summary?.title || 'Analyse'}
          </Text>
          {/* Bouton nouvelle analyse */}
          <Pressable
            onPress={handleNewAnalysis}
            style={styles.iconButton}
            accessibilityLabel="Nouvelle analyse"
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={24} color={colors.textTertiary} />
          </Pressable>
        </View>
      )}

      {/* Video Player — masqué en fullscreen */}
      {!isFullscreen && summary?.videoId && (
        <VideoPlayer videoId={summary.videoId} title={summary.title} scrollY={scrollY} />
      )}

      {/* Tab bar — masqué en fullscreen */}
      {!isFullscreen && TabBar}

      {/* PagerView normal — masqué en fullscreen */}
      {!isFullscreen && Pager}

      {/* Action Bar — masquée en fullscreen */}
      {!isFullscreen && summary && (
        <View>
          <ActionBar
            summaryId={summary.id}
            title={summary.title}
            videoId={summary.videoId}
            isFavorite={isFavorite}
            onFavoriteChange={setIsFavorite}
          />
        </View>
      )}

      {/* ── MODE FULLSCREEN ──────────────────────────────── */}
      {/* paddingBottom du container est 0 → l'overlay couvre l'écran entier */}
      {isFullscreen && (
        <View
          style={[
            styles.fullscreenOverlay,
            {
              backgroundColor: colors.bgPrimary,
              paddingTop: insets.top,
              // TAB_BAR_HEIGHT : le CustomTabBar est position:absolute bottom:0
              // il chevauche le contenu fullscreen → on réserve sa hauteur
              paddingBottom: insets.bottom + TAB_BAR_HEIGHT,
            },
          ]}
        >
          {/* Header compact fullscreen */}
          <View style={styles.fullscreenHeader}>
            <Pressable onPress={handleBack} style={styles.iconButton} accessibilityLabel="Retour" accessibilityRole="button">
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {summary?.title || 'Analyse'}
            </Text>
            <Pressable onPress={handleToggleFullscreen} style={styles.iconButton} accessibilityLabel="Quitter le plein écran" accessibilityRole="button">
              <Ionicons name="contract-outline" size={22} color={colors.textPrimary} />
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
  // Headers
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingBottom: sp.sm,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginHorizontal: sp.sm,
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: sp.lg,
    position: 'relative',
    alignItems: 'center',
  },
  tabButton: { width: 160, paddingVertical: sp.md, alignItems: 'center' },
  tabLabel: { fontFamily: fontFamily.body, fontSize: fontSize.sm },
  tabLabelActive: { fontFamily: fontFamily.bodySemiBold },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 160,
    height: 2,
    borderRadius: 1,
  },
  expandButton: {
    position: 'absolute',
    right: -sp.md,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pager
  pager: { flex: 1 },
  page: { flex: 1, paddingTop: sp.md },
  // Fullscreen overlay — position absolute avec bottom: 0
  // Le container parent a paddingBottom=0 en fullscreen → cet overlay couvre tout l'écran
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingBottom: sp.sm,
    paddingTop: sp.sm,
  },
  // Error / action states
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
    paddingHorizontal: sp['3xl'],
  },
  errorText: { fontFamily: fontFamily.body, fontSize: fontSize.base, textAlign: 'center' },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.md,
    paddingHorizontal: sp['2xl'],
    borderRadius: borderRadius.lg,
  },
  actionButtonText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: '#ffffff' },
});
