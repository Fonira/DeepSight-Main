import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  RefreshControl,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { historyApi } from '@/services/api';
import { AnalysisCard } from '@/components/library/AnalysisCard';
import { SearchBar } from '@/components/library/SearchBar';
import { PlaylistSection } from '@/components/library/PlaylistSection';
import { VideoCardSkeleton } from '@/components/ui/SkeletonLoader';
import { sp, borderRadius } from '@/theme/spacing';
import { palette } from '@/theme/colors';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';
import { DoodleBackground } from '@/components/ui/DoodleBackground';
import type { AnalysisSummary, PaginatedResponse } from '@/types';

const QUERY_KEY_BASE = 'library';

export default function LibraryScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);

  const queryKey = useMemo(
    () => [QUERY_KEY_BASE, favoritesOnly],
    [favoritesOnly],
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      historyApi.getHistory(
        pageParam as number,
        20,
        favoritesOnly ? { favoritesOnly: true } : undefined,
      ),
    getNextPageParam: (lastPage: PaginatedResponse<AnalysisSummary>) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    staleTime: 5 * 60 * 1000,
  });

  const allItems = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.channel?.toLowerCase().includes(q) ?? false) ||
        item.videoId.toLowerCase().includes(q),
    );
  }, [allItems, searchQuery]);

  const handleDelete = useCallback(
    async (id: string) => {
      const previousData = queryClient.getQueryData(queryKey);

      // Optimistic removal
      queryClient.setQueryData(
        queryKey,
        (old: { pages: PaginatedResponse<AnalysisSummary>[]; pageParams: unknown[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => item.id !== id),
            })),
          };
        },
      );

      try {
        await historyApi.deleteSummary(id);
      } catch {
        queryClient.setQueryData(queryKey, previousData);
        Alert.alert('Erreur', "Impossible de supprimer l'analyse.");
      }
    },
    [queryClient, queryKey],
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AnalysisSummary }) => (
      <AnalysisCard
        summary={item}
        isFavorite={item.isFavorite}
        onPress={() => router.push(`/(tabs)/analysis/${item.id}`)}
        onDelete={handleDelete}
      />
    ),
    [handleDelete, router],
  );

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="library-outline" size={64} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
          Aucune analyse
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {'Analyse ta premi\u00E8re vid\u00E9o pour la retrouver ici'}
        </Text>
        <Pressable
          style={[styles.emptyButton, { backgroundColor: colors.accentPrimary }]}
          onPress={() => router.push('/(tabs)')}
          accessibilityLabel="Commencer une analyse"
        >
          <Text style={styles.emptyButtonText}>Commencer</Text>
        </Pressable>
      </View>
    );
  }, [isLoading, colors, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="video" density="low" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {'Ma Biblioth\u00E8que'}
        </Text>
        <Pressable
          onPress={() => setSearchVisible((v) => !v)}
          hitSlop={8}
          accessibilityLabel="Rechercher"
        >
          <Ionicons
            name={searchVisible ? 'close' : 'search'}
            size={24}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>

      {/* Search bar */}
      {searchVisible && (
        <View style={styles.searchWrapper}>
          <SearchBar
            value={searchQuery}
            onChangeText={setSearchQuery}
            onClose={() => {
              setSearchVisible(false);
              setSearchQuery('');
            }}
          />
        </View>
      )}

      {/* Filter chips */}
      <View style={styles.chipsRow}>
        <Pressable
          style={[
            styles.chip,
            {
              backgroundColor: !showPlaylists && !favoritesOnly
                ? palette.indigo + '20'
                : colors.glassBg,
              borderColor: !showPlaylists && !favoritesOnly
                ? palette.indigo
                : colors.glassBorder,
            },
          ]}
          onPress={() => { setShowPlaylists(false); setFavoritesOnly(false); }}
          accessibilityLabel="Toutes les analyses"
          accessibilityState={{ selected: !showPlaylists && !favoritesOnly }}
        >
          <Ionicons
            name="list-outline"
            size={14}
            color={!showPlaylists && !favoritesOnly ? palette.indigo : colors.textTertiary}
          />
          <Text
            style={[
              styles.chipText,
              { color: !showPlaylists && !favoritesOnly ? palette.indigo : colors.textTertiary },
            ]}
          >
            Vidéos
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.chip,
            {
              backgroundColor: favoritesOnly
                ? colors.accentWarning + '20'
                : colors.glassBg,
              borderColor: favoritesOnly
                ? colors.accentWarning
                : colors.glassBorder,
            },
          ]}
          onPress={() => { setFavoritesOnly((v) => !v); setShowPlaylists(false); }}
          accessibilityLabel="Filtrer les favoris"
          accessibilityState={{ selected: favoritesOnly }}
        >
          <Ionicons
            name={favoritesOnly ? 'star' : 'star-outline'}
            size={14}
            color={favoritesOnly ? colors.accentWarning : colors.textTertiary}
          />
          <Text
            style={[
              styles.chipText,
              {
                color: favoritesOnly
                  ? colors.accentWarning
                  : colors.textTertiary,
              },
            ]}
          >
            Favoris
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.chip,
            {
              backgroundColor: showPlaylists
                ? palette.violet + '20'
                : colors.glassBg,
              borderColor: showPlaylists
                ? palette.violet
                : colors.glassBorder,
            },
          ]}
          onPress={() => { setShowPlaylists((v) => !v); setFavoritesOnly(false); }}
          accessibilityLabel="Voir les playlists"
          accessibilityState={{ selected: showPlaylists }}
        >
          <Ionicons
            name={showPlaylists ? 'albums' : 'albums-outline'}
            size={14}
            color={showPlaylists ? palette.violet : colors.textTertiary}
          />
          <Text
            style={[
              styles.chipText,
              { color: showPlaylists ? palette.violet : colors.textTertiary },
            ]}
          >
            Playlists
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {showPlaylists ? (
        <View style={styles.playlistContainer}>
          <PlaylistSection />
        </View>
      ) : isLoading ? (
        <View style={styles.skeletonContainer}>
          {Array.from({ length: 5 }).map((_, i) => (
            <VideoCardSkeleton key={i} compact />
          ))}
        </View>
      ) : (
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => { refetch(); }}
              tintColor={colors.accentPrimary}
              colors={[colors.accentPrimary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  headerTitle: {
    ...textStyles.headingLg,
  },
  searchWrapper: {
    paddingHorizontal: sp.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: sp.lg,
    marginBottom: sp.md,
    gap: sp.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  playlistContainer: {
    flex: 1,
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
  },
  skeletonContainer: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
  },
  listContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: 80,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: sp.xl,
  },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginTop: sp.lg,
  },
  emptySubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: sp.sm,
  },
  emptyButton: {
    marginTop: sp['2xl'],
    paddingHorizontal: sp['2xl'],
    paddingVertical: sp.md,
    borderRadius: borderRadius.full,
  },
  emptyButtonText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    color: '#fff',
  },
});
