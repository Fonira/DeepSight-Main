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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { historyApi } from '../services/api';
import { Header, VideoCard, EmptyState } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { RootStackParamList, AnalysisSummary, HistoryFilters } from '../types';

type HistoryNavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

export const HistoryScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation<HistoryNavigationProp>();
  const insets = useSafeAreaInsets();

  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const loadAnalyses = useCallback(async (pageNum: number = 1, reset: boolean = false) => {
    if (pageNum === 1) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const filters: HistoryFilters = {
        search: searchQuery || undefined,
        favoritesOnly: showFavoritesOnly || undefined,
      };

      const response = await historyApi.getHistory(pageNum, 20, filters);

      if (reset || pageNum === 1) {
        setAnalyses(response.items);
      } else {
        setAnalyses((prev) => [...prev, ...response.items]);
      }

      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [searchQuery, showFavoritesOnly]);

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

  const toggleFavoritesFilter = () => {
    Haptics.selectionAsync();
    setShowFavoritesOnly(!showFavoritesOnly);
  };

  const renderItem = useCallback(
    ({ item }: { item: AnalysisSummary }) => (
      <VideoCard
        video={item}
        onPress={() => handleVideoPress(item)}
        onFavoritePress={() => handleFavoritePress(item)}
        isFavorite={item.isFavorite}
      />
    ),
    []
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
            ? 'Aucun favori'
            : searchQuery
            ? 'Aucun résultat'
            : 'Aucune analyse'
        }
        description={
          showFavoritesOnly
            ? 'Ajoutez des vidéos à vos favoris pour les retrouver ici'
            : searchQuery
            ? 'Essayez avec d\'autres termes de recherche'
            : 'Analysez votre première vidéo YouTube pour commencer'
        }
        actionLabel={!showFavoritesOnly && !searchQuery ? 'Analyser une vidéo' : undefined}
        onAction={!showFavoritesOnly && !searchQuery ? () => (navigation as any).navigate('Dashboard') : undefined}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title="Historique" />

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
            placeholder="Rechercher..."
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
      </View>

      {/* Results Count */}
      {!isLoading && analyses.length > 0 && (
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {analyses.length} analyse{analyses.length > 1 ? 's' : ''}
            {showFavoritesOnly ? ' en favoris' : ''}
          </Text>
        </View>
      )}

      {/* Analysis List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={analyses}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
            analyses.length === 0 && styles.emptyListContent,
          ]}
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  resultsText: {
    fontSize: Typography.fontSize.sm,
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
});

export default HistoryScreen;
