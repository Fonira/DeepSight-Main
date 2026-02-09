import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { DeepSightSpinner } from '../components/loading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { historyApi } from '../services/api';
import { Header, VideoCard, EmptyState } from '../components';
import { VideoCardSkeleton } from '../components/ui/Skeleton';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';
import { useIsOffline } from '../hooks/useNetworkStatus';
import type { RootStackParamList, MainTabParamList, AnalysisSummary, HistoryFilters } from '../types';

const HISTORY_CACHE_KEY = 'deepsight_history_cache';

type HistoryNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'History'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export const HistoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const navigation = useNavigation<HistoryNavigationProp>();
  const insets = useSafeAreaInsets();
  const isOffline = useIsOffline();
  useScreenDoodleVariant('video');

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isUsingCache, setIsUsingCache] = useState(false);

  const wasOfflineRef = useRef(isOffline);

  const modes = [
    { key: 'standard', label: t.modes.standard },
    { key: 'deep', label: t.modes.deep },
    { key: 'expert', label: t.modes.expert },
  ];
  const categories = [
    { key: 'educational', label: t.categories.educational },
    { key: 'science', label: t.categories.science },
    { key: 'tech', label: t.categories.tech },
    { key: 'entertainment', label: t.categories.entertainment },
    { key: 'news', label: t.categories.news },
    { key: 'other', label: t.categories.other },
  ];

  const loadAnalyses = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    if (isOffline) {
      try {
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setAnalyses(cachedData);
          setIsUsingCache(true);
          setHasMore(false);
        }
      } catch (e) {
        console.error('Failed to load cached history:', e);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
      return;
    }

    setIsUsingCache(false);
    try {
      const filters: HistoryFilters = {
        search: searchQuery || undefined,
        favoritesOnly: showFavoritesOnly || undefined,
        mode: selectedMode || undefined,
        category: selectedCategory || undefined,
      };

      const response = await historyApi.getHistory(pageNum, 20, filters);

      if (reset || pageNum === 1) {
        setAnalyses(response.items);
        try {
          await AsyncStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(response.items));
        } catch (e) {
          console.warn('Failed to cache history:', e);
        }
      } else {
        setAnalyses((prev) => [...prev, ...response.items]);
      }

      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load history:', error);
      try {
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setAnalyses(cachedData);
          setIsUsingCache(true);
          setHasMore(false);
        }
      } catch (e) {
        console.error('Failed to load cached history:', e);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchQuery, showFavoritesOnly, selectedMode, selectedCategory, isOffline]);

  useEffect(() => {
    loadAnalyses(1, true);
  }, [loadAnalyses]);

  useEffect(() => {
    if (wasOfflineRef.current && !isOffline) {
      setIsUsingCache(false);
      loadAnalyses(1, true);
    }
    wasOfflineRef.current = isOffline;
  }, [isOffline, loadAnalyses]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalyses(1, true);
    setRefreshing(false);
  }, [loadAnalyses]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadAnalyses(page + 1);
    }
  }, [isLoadingMore, hasMore, page, loadAnalyses]);

  const handleVideoPress = (summary: AnalysisSummary) => {
    navigation.navigate('Analysis', { summaryId: summary.id });
  };

  const handleFavoritePress = async (summary: AnalysisSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { isFavorite } = await historyApi.toggleFavorite(summary.id);
      setAnalyses((prev) =>
        prev.map((item) =>
          item.id === summary.id ? { ...item, isFavorite } : item
        )
      );
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleDeletePress = (summary: AnalysisSummary) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      t.history.confirmDeleteTitle,
      `${t.history.deleteConfirm} "${summary.title}"`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await historyApi.deleteSummary(summary.id);
              setAnalyses((prev) => prev.filter((item) => item.id !== summary.id));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Failed to delete summary:', error);
              Alert.alert(t.common.error, t.errors.generic);
            }
          },
        },
      ]
    );
  };

  const toggleFavoritesFilter = () => {
    Haptics.selectionAsync();
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  const toggleViewMode = () => {
    Haptics.selectionAsync();
    setViewMode(viewMode === 'list' ? 'grid' : 'list');
  };

  const renderItem = useCallback(
    ({ item }: { item: AnalysisSummary }) => (
      <View style={viewMode === 'grid' ? styles.gridItem : undefined}>
        <VideoCard
          video={item}
          onPress={() => handleVideoPress(item)}
          onFavoritePress={() => handleFavoritePress(item)}
          onLongPress={() => handleDeletePress(item)}
          isFavorite={item.isFavorite}
          compact={viewMode === 'grid'}
        />
      </View>
    ),
    [viewMode]
  );

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <DeepSightSpinner size="sm" />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon={showFavoritesOnly ? 'heart-outline' : 'folder-open-outline'}
        title={
          showFavoritesOnly
            ? t.common.noResults
            : searchQuery
            ? t.common.noResults
            : t.history.noAnalysesYet
        }
        description={
          showFavoritesOnly
            ? t.history.emptyDesc
            : searchQuery
            ? t.errors.tryAgain
            : t.history.startFirstAnalysis
        }
        actionLabel={!showFavoritesOnly && !searchQuery ? t.dashboard.analyze : undefined}
        onAction={!showFavoritesOnly && !searchQuery ? () => navigation.navigate('Dashboard') : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.history.title} />

      {/* Search Bar */}
      <Animated.View entering={FadeInDown.duration(300)} style={styles.searchSection}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t.history.searchHistory}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
            showFavoritesOnly && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
          ]}
          onPress={toggleFavoritesFilter}
        >
          <Ionicons
            name={showFavoritesOnly ? 'heart' : 'heart-outline'}
            size={20}
            color={showFavoritesOnly ? '#FFFFFF' : colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
            showFilters && { backgroundColor: colors.accentSecondary, borderColor: colors.accentSecondary },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setShowFilters(!showFilters);
          }}
        >
          <Ionicons
            name="options-outline"
            size={20}
            color={showFilters ? '#FFFFFF' : colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: colors.glassBg, borderColor: colors.glassBorder },
          ]}
          onPress={toggleViewMode}
        >
          <Ionicons
            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>
      </Animated.View>

      {/* Filter Chips */}
      {showFilters && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.filtersContainer}>
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.dashboard.selectMode}:</Text>
            <View style={styles.filterChips}>
              <Pressable
                style={[
                  styles.filterChip,
                  { backgroundColor: !selectedMode ? colors.accentPrimary : colors.glassBg },
                ]}
                onPress={() => setSelectedMode(null)}
              >
                <Text style={[styles.filterChipText, { color: !selectedMode ? '#FFFFFF' : colors.textSecondary }]}>
                  {t.common.all}
                </Text>
              </Pressable>
              {modes.map((mode) => (
                <Pressable
                  key={mode.key}
                  style={[
                    styles.filterChip,
                    { backgroundColor: selectedMode === mode.key ? colors.accentPrimary : colors.glassBg },
                  ]}
                  onPress={() => setSelectedMode(selectedMode === mode.key ? null : mode.key)}
                >
                  <Text style={[styles.filterChipText, { color: selectedMode === mode.key ? '#FFFFFF' : colors.textSecondary }]}>
                    {mode.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.dashboard.selectCategory}:</Text>
            <View style={styles.filterChips}>
              <Pressable
                style={[
                  styles.filterChip,
                  { backgroundColor: !selectedCategory ? colors.accentPrimary : colors.glassBg },
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.filterChipText, { color: !selectedCategory ? '#FFFFFF' : colors.textSecondary }]}>
                  {t.history.allCategories}
                </Text>
              </Pressable>
              {categories.map((cat) => (
                <Pressable
                  key={cat.key}
                  style={[
                    styles.filterChip,
                    { backgroundColor: selectedCategory === cat.key ? colors.accentPrimary : colors.glassBg },
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === cat.key ? null : cat.key)}
                >
                  <Text style={[styles.filterChipText, { color: selectedCategory === cat.key ? '#FFFFFF' : colors.textSecondary }]}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Offline/Cache Notice */}
      {(isOffline || isUsingCache) && !isLoading && (
        <View style={styles.offlineNotice}>
          <Ionicons name="information-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
            {t.history.showingCachedData}
          </Text>
        </View>
      )}

      {/* Results Count and View Mode */}
      {!isLoading && analyses.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {analyses.length} {t.history.analyses}
          </Text>
          <View style={styles.viewModeIndicator}>
            <Ionicons
              name={viewMode === 'list' ? 'list' : 'grid'}
              size={14}
              color={colors.textMuted}
            />
            <Text style={[styles.viewModeText, { color: colors.textMuted }]}>
              {viewMode === 'list' ? t.history.listView : t.history.gridView}
            </Text>
          </View>
        </View>
      )}

      {/* Analysis List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} style={styles.skeletonCard} />
          ))}
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={analyses}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
            analyses.length === 0 && styles.emptyListContent,
          ]}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentPrimary}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          updateCellsBatchingPeriod={50}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    gap: sp.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: sp.md,
    gap: sp.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    paddingVertical: sp.sm,
  },
  filterButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
  },
  resultsText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.body,
  },
  viewModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  viewModeText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
  },
  skeletonCard: {
    marginBottom: sp.lg,
  },
  listContent: {
    paddingHorizontal: sp.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  loadingFooter: {
    paddingVertical: sp.lg,
    alignItems: 'center',
  },
  filtersContainer: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  filterRow: {
    marginBottom: sp.sm,
  },
  filterLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
    marginBottom: sp.xs,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.xs,
  },
  filterChip: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.full,
  },
  filterChipText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodyMedium,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: sp.md,
  },
  gridItem: {
    flex: 1,
    maxWidth: '48%',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp.sm,
    gap: sp.xs,
  },
  offlineText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
});

export default HistoryScreen;
