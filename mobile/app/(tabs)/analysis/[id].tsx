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
import { useQuery } from '@tanstack/react-query';
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
import { videoApi } from '@/services/api';
import { useAnalysisStore } from '@/stores/analysisStore';
import { AnalysisSkeleton } from '@/components/ui/SkeletonLoader';
import { VideoPlayer } from '@/components/analysis/VideoPlayer';
import { StreamingOverlay } from '@/components/analysis/StreamingOverlay';
import { SummaryView } from '@/components/analysis/SummaryView';
import { ChatView } from '@/components/analysis/ChatView';
import { ActionBar } from '@/components/analysis/ActionBar';
import { DoodleBackground } from '@/components/ui/DoodleBackground';

const TAB_LABELS = ['Résumé', 'Chat'] as const;

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const store = useAnalysisStore();

  const pagerRef = useRef<PagerView>(null);
  const [activeTab, setActiveTab] = useState(0);
  const scrollY = useSharedValue(0);
  const tabIndicatorX = useSharedValue(0);

  // Fetch summary
  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['summary', id],
    queryFn: () => videoApi.getSummary(id!),
    enabled: !!id,
  });

  // Determine if analysis is still processing
  const isProcessing = store.status === 'processing' || store.status === 'pending';
  const isStreaming = store.status === 'streaming';
  const [isFavorite, setIsFavorite] = useState(summary?.isFavorite ?? false);

  // Update favorite when summary loads
  React.useEffect(() => {
    if (summary) setIsFavorite(summary.isFavorite);
  }, [summary]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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

  const handleStreamingComplete = useCallback((summaryId?: string) => {
    // Reset analysis state, then refetch summary data
    store.resetAnalysis();
    refetch();
  }, [store, refetch]);

  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(tabIndicatorX.value, [0, 1], [0, 160]),
      },
    ],
  }));

  const BackHeader = (
    <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
      <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Retour" accessibilityRole="button">
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>
    </View>
  );

  if (isLoading && !isProcessing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {BackHeader}
        <AnalysisSkeleton />
      </View>
    );
  }

  if (error && !isProcessing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {BackHeader}
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>Impossible de charger l'analyse</Text>
          <Pressable onPress={() => refetch()} style={[styles.retryButton, { backgroundColor: colors.accentPrimary }]} accessibilityLabel="Réessayer" accessibilityRole="button">
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="analysis" density="low" />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Streaming Overlay */}
      {isProcessing && id && (
        <StreamingOverlay
          taskId={id}
          onCancel={handleCancelAnalysis}
          onComplete={handleStreamingComplete}
        />
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
        <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Retour" accessibilityRole="button">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {summary?.title || 'Analyse'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Video Player */}
      {summary?.videoId && (
        <VideoPlayer
          videoId={summary.videoId}
          title={summary.title}
          scrollY={scrollY}
        />
      )}

      {/* Tab Selector */}
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
                {
                  color: activeTab === index ? palette.indigo : colors.textTertiary,
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
      </View>

      {/* PagerView */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={handlePageSelected}
      >
        <View key="summary" style={styles.page}>
          <SummaryView
            content={summary?.content}
            isStreaming={isStreaming}
            streamingText={store.streamingText}
            isLoading={isLoading}
            error={error ? 'Erreur de chargement' : null}
            onRetry={() => refetch()}
          />
        </View>
        <View key="chat" style={styles.page}>
          <ChatView summaryId={id || ''} />
        </View>
      </PagerView>

      {/* Action Bar */}
      {summary && (
        <View style={{ paddingBottom: insets.bottom }}>
          <ActionBar
            summaryId={summary.id}
            title={summary.title}
            videoId={summary.videoId}
            isFavorite={isFavorite}
            onFavoriteChange={setIsFavorite}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: sp.md, paddingBottom: sp.sm },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.lg, marginHorizontal: sp.sm },
  headerSpacer: { width: 40 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: sp.lg, position: 'relative' },
  tabButton: { width: 160, paddingVertical: sp.md, alignItems: 'center' },
  tabLabel: { fontFamily: fontFamily.body, fontSize: fontSize.sm },
  tabLabelActive: { fontFamily: fontFamily.bodySemiBold },
  tabIndicator: { position: 'absolute', bottom: 0, left: 0, width: 160, height: 2, borderRadius: 1 },
  pager: { flex: 1 },
  page: { flex: 1, paddingTop: sp.md },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: sp.md, paddingHorizontal: sp['3xl'] },
  errorText: { fontFamily: fontFamily.body, fontSize: fontSize.base, textAlign: 'center' },
  retryButton: { paddingVertical: sp.md, paddingHorizontal: sp['2xl'], borderRadius: borderRadius.lg, marginTop: sp.sm },
  retryText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.sm, color: '#ffffff' },
});
