import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, CompositeNavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { historyApi } from '../services/api';
import { Header, VideoCard, EmptyState } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { useIsOffline } from '../hooks/useNetworkStatus';
import type { RootStackParamList, MainTabParamList, AnalysisSummary, HistoryFilters } from '../types';

// Cache key for offline storage
const HISTORY_CACHE_KEY = 'deepsight_history_cache';

// Composite type for navigating to both tab screens and stack screens
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

  // Filter options
  const modes = ['Standard', 'Approfondi', 'Expert'];
  const categories = ['Éducation', 'Science', 'Technologie', 'Divertissement', 'Actualités', 'Autre'];

  const loadAnalyses = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    // If offline, load from cache
    if (isOffline) {
      try {
        const cached = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
        if (cached) {
          const cachedData = JSON.parse(cached);
          setAnalyses(cachedData);
          setIsUsingCache(true);
          setHasMore(false); // Can't load more when offline
        }
      } catch (e) {
        console.error('Failed to load cached history:', e);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
      return;
    }

    // Online: fetch from API
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
        // Cache the first page results for offline use
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
      // Try to load from cache on error
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
        <ActivityIndicator size="small" color={colors.accentPrimary} />
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
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t.history.searchHistory}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
            showFavoritesOnly && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary },
          ]}
          onPress={toggleFavoritesFilter}
        >
          <Ionicons
            name={showFavoritesOnly ? 'heart' : 'heart-outline'}
            size={20}
            color={showFavoritesOnly ? '#FFFFFF' : colors.textTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
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
            color={showFilters ? '#FFFFFF' : colors.textTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
          onPress={toggleViewMode}
        >
          <Ionicons
            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          {/* Mode Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.dashboard.selectMode}:</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: !selectedMode ? colors.accentPrimary : colors.bgElevated },
                ]}
                onPress={() => setSelectedMode(null)}
              >
                <Text style={[styles.filterChipText, { color: !selectedMode ? '#FFFFFF' : colors.textSecondary }]}>
                  {t.common.all}
                </Text>
              </TouchableOpacity>
              {modes.map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.filterChip,
                    { backgroundColor: selectedMode === mode ? colors.accentPrimary : colors.bgElevated },
                  ]}
                  onPress={() => setSelectedMode(selectedMode === mode ? null : mode)}
                >
                  <Text style={[styles.filterChipText, { color: selectedMode === mode ? '#FFFFFF' : colors.textSecondary }]}>
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Filter */}
          <View style={styles.filterRow}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.dashboard.selectCategory}:</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: !selectedCategory ? colors.accentPrimary : colors.bgElevated },
                ]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.filterChipText, { color: !selectedCategory ? '#FFFFFF' : colors.textSecondary }]}>
                  {t.history.allCategories}
                </Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.filterChip,
                    { backgroundColor: selectedCategory === cat ? colors.accentPrimary : colors.bgElevated },
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <Text style={[styles.filterChipText, { color: selectedCategory === cat ? '#FFFFFF' : colors.textSecondary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
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
              color={colors.textTertiary}
            />
            <Text style={[styles.viewModeText, { color: colors.textTertiary }]}>
              {viewMode === 'list' ? 'Liste' : 'Grille'}
            </Text>
          </View>
        </View>
      )}

      {/* Analysis List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          key={viewMode} // Force re-render when view mode changes
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
          // Performance optimizations
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    paddingVertical: Spacing.sm,
  },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
  },
  resultsInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  resultsText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  viewModeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  viewModeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  loadingFooter: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  filtersContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  filterRow: {
    marginBottom: Spacing.sm,
  },
  filterLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.xs,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  filterChipText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  gridRow: {
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  gridItem: {
    flex: 1,
    maxWidth: '48%',
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  offlineText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
});

export default HistoryScreen;
