import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Header, Card, EmptyState } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import type { Playlist } from '../types';

// Mock data for demonstration
const MOCK_PLAYLISTS: Playlist[] = [];

export const PlaylistsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [playlists, setPlaylists] = useState<Playlist[]>(MOCK_PLAYLISTS);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setPlaylists(MOCK_PLAYLISTS);
      setIsLoading(false);
    }, 500);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlaylists();
    setRefreshing(false);
  }, [loadPlaylists]);

  const handleCreatePlaylist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Nouvelle playlist',
      'La création de playlists sera disponible prochainement.',
      [{ text: 'OK' }]
    );
  };

  const handlePlaylistPress = (playlist: Playlist) => {
    Alert.alert(
      playlist.name,
      'L\'affichage des playlists sera disponible prochainement.',
      [{ text: 'OK' }]
    );
  };

  const renderPlaylistItem = useCallback(
    ({ item }: { item: Playlist }) => (
      <TouchableOpacity
        onPress={() => handlePlaylistPress(item)}
        activeOpacity={0.7}
      >
        <Card variant="elevated" style={styles.playlistCard}>
          <View style={styles.playlistContent}>
            <View style={[styles.playlistThumbnails, { backgroundColor: colors.bgElevated }]}>
              {item.thumbnails.length > 0 ? (
                <View style={styles.thumbnailGrid}>
                  {item.thumbnails.slice(0, 4).map((_, index) => (
                    <View
                      key={index}
                      style={[styles.thumbnailPlaceholder, { backgroundColor: colors.bgTertiary }]}
                    />
                  ))}
                </View>
              ) : (
                <Ionicons name="folder-outline" size={32} color={colors.textTertiary} />
              )}
            </View>
            <View style={styles.playlistInfo}>
              <Text style={[styles.playlistName, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.description && (
                <Text style={[styles.playlistDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={[styles.playlistCount, { color: colors.textTertiary }]}>
                {item.videoCount} vidéo{item.videoCount > 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </View>
        </Card>
      </TouchableOpacity>
    ),
    [colors]
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="folder-outline"
        title="Aucune playlist"
        description="Créez des playlists pour organiser vos analyses de vidéos YouTube."
        actionLabel="Créer une playlist"
        onAction={handleCreatePlaylist}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Playlists"
        rightAction={{
          icon: 'add',
          onPress: handleCreatePlaylist,
        }}
      />

      {/* Stats */}
      {playlists.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={[styles.statItem, { backgroundColor: colors.bgElevated }]}>
            <Ionicons name="folder" size={20} color={colors.accentPrimary} />
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {user?.total_playlists || playlists.length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
              Playlists
            </Text>
          </View>
        </View>
      )}

      {/* Playlist List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      ) : (
        <FlatList
          data={playlists}
          renderItem={renderPlaylistItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
            playlists.length === 0 && styles.emptyListContent,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentPrimary}
            />
          }
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statLabel: {
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
  separator: {
    height: Spacing.md,
  },
  playlistCard: {
    padding: Spacing.md,
  },
  playlistContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playlistThumbnails: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '50%',
    height: '50%',
  },
  playlistInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  playlistName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  playlistDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.xs,
  },
  playlistCount: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
});

export default PlaylistsScreen;
