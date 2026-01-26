import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playlistApi } from '../services/api';
import { Header, Card, Badge, Button, VideoCard } from '../components';
import { Spacing, Typography, BorderRadius, Colors } from '../constants/theme';
import { formatDate } from '../utils/formatters';
import type { RootStackParamList, Playlist, AnalysisSummary } from '../types';

type PlaylistDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlaylistDetail'>;
type PlaylistDetailRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;

export const PlaylistDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const navigation = useNavigation<PlaylistDetailNavigationProp>();
  const route = useRoute<PlaylistDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const isEn = language === 'en';

  const { playlistId } = route.params;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<AnalysisSummary[]>([]);
  const [corpusSummary, setCorpusSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'synthesis'>('videos');

  // Load playlist details
  const loadPlaylistDetails = useCallback(async () => {
    try {
      const response = await playlistApi.getPlaylistDetails(playlistId);
      setPlaylist(response.playlist);
      setVideos(response.videos || []);
      setCorpusSummary(response.corpusSummary || null);
    } catch (err) {
      console.error('Error loading playlist details:', err);
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId]);

  useEffect(() => {
    loadPlaylistDetails();
  }, [loadPlaylistDetails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPlaylistDetails();
    setRefreshing(false);
  }, [loadPlaylistDetails]);

  // Generate corpus synthesis
  const handleGenerateSynthesis = async () => {
    if (!playlistId) return;

    setIsGeneratingSynthesis(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await playlistApi.generateCorpusSummary(playlistId);
      setCorpusSummary(response.summary);
      setActiveTab('synthesis');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
    } finally {
      setIsGeneratingSynthesis(false);
    }
  };

  // Navigate to video analysis
  const handleVideoPress = (video: AnalysisSummary) => {
    Haptics.selectionAsync();
    navigation.navigate('Analysis', { summaryId: video.id });
  };

  // Delete playlist
  const handleDeletePlaylist = () => {
    Alert.alert(
      t.playlists.deletePlaylist,
      t.playlists.deletePlaylistConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await playlistApi.deletePlaylist(playlistId);
              navigation.goBack();
            } catch (err) {
              Alert.alert(t.common.error, t.errors.generic);
            }
          },
        },
      ]
    );
  };

  const renderVideoItem = useCallback(
    ({ item }: { item: AnalysisSummary }) => (
      <VideoCard
        video={item}
        onPress={() => handleVideoPress(item)}
        isFavorite={item.isFavorite}
        compact
      />
    ),
    []
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={t.playlists.title} showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentPrimary} />
        </View>
      </View>
    );
  }

  if (!playlist) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={t.playlists.title} showBack />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {t.errors.notFound}
          </Text>
          <Button title={t.common.back} onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header
        title={playlist.name}
        showBack
        rightAction={{
          icon: 'trash-outline',
          onPress: handleDeletePlaylist,
        }}
      />

      {/* Playlist Header */}
      <View style={styles.headerSection}>
        <View style={[styles.thumbnailGrid, { backgroundColor: colors.bgElevated }]}>
          {playlist.thumbnails && playlist.thumbnails.length > 0 ? (
            playlist.thumbnails.slice(0, 4).map((thumb, index) => (
              <Image
                key={index}
                source={{ uri: thumb }}
                style={styles.thumbnailImage}
                contentFit="cover"
              />
            ))
          ) : (
            <Ionicons name="folder-outline" size={48} color={colors.textTertiary} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.playlistName, { color: colors.textPrimary }]}>
            {playlist.name}
          </Text>
          {playlist.description && (
            <Text style={[styles.playlistDescription, { color: colors.textSecondary }]}>
              {playlist.description}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Badge label={`${videos.length} ${t.playlists.videos}`} variant="primary" />
            <Text style={[styles.dateText, { color: colors.textTertiary }]}>
              {formatDate(playlist.createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statItem, { backgroundColor: colors.bgElevated }]}>
          <Ionicons name="videocam" size={18} color={colors.accentPrimary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {videos.length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {t.playlists.analyzed}
          </Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.bgElevated }]}>
          <Ionicons name="document-text" size={18} color={colors.accentSecondary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {corpusSummary ? '1' : '0'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {t.playlists.synthesis}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'videos' && { borderBottomColor: colors.accentPrimary },
          ]}
          onPress={() => setActiveTab('videos')}
        >
          <Ionicons
            name="videocam-outline"
            size={18}
            color={activeTab === 'videos' ? colors.accentPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'videos' ? colors.accentPrimary : colors.textSecondary },
            ]}
          >
            {t.playlists.videos}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'synthesis' && { borderBottomColor: colors.accentPrimary },
          ]}
          onPress={() => setActiveTab('synthesis')}
        >
          <Ionicons
            name="layers-outline"
            size={18}
            color={activeTab === 'synthesis' ? colors.accentPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'synthesis' ? colors.accentPrimary : colors.textSecondary },
            ]}
          >
            {t.playlists.synthesis}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'videos' ? (
        <FlatList
          data={videos}
          renderItem={renderVideoItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accentPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="videocam-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {isEn ? 'No videos in this playlist' : 'Aucune vidéo dans cette playlist'}
              </Text>
            </View>
          }
        />
      ) : (
        <ScrollView
          style={styles.synthesisContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {corpusSummary ? (
            <Card variant="elevated" style={styles.synthesisCard}>
              <View style={styles.synthesisHeader}>
                <Ionicons name="layers" size={20} color={colors.accentPrimary} />
                <Text style={[styles.synthesisTitle, { color: colors.textPrimary }]}>
                  {t.playlists.corpusAnalysis}
                </Text>
              </View>
              <Text style={[styles.synthesisContent, { color: colors.textSecondary }]}>
                {corpusSummary}
              </Text>
            </Card>
          ) : (
            <View style={styles.noSynthesis}>
              <Ionicons name="sparkles-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.noSynthesisText, { color: colors.textSecondary }]}>
                {t.playlists.noSynthesisYet}
              </Text>
              <Text style={[styles.noSynthesisSubtext, { color: colors.textTertiary }]}>
                {t.playlists.generateFirst}
              </Text>
              <Button
                title={t.playlists.generateSynthesis}
                onPress={handleGenerateSynthesis}
                loading={isGeneratingSynthesis}
                style={styles.generateButton}
                icon={<Ionicons name="sparkles" size={18} color="#FFFFFF" />}
              />
            </View>
          )}
        </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  headerSection: {
    flexDirection: 'row',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  thumbnailGrid: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailImage: {
    width: '50%',
    height: '50%',
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  playlistName: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  playlistDescription: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  listContent: {
    padding: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  synthesisContainer: {
    flex: 1,
    padding: Spacing.lg,
  },
  synthesisCard: {
    padding: Spacing.lg,
  },
  synthesisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  synthesisTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  synthesisContent: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  noSynthesis: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  noSynthesisText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginTop: Spacing.md,
  },
  noSynthesisSubtext: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  generateButton: {
    marginTop: Spacing.xl,
  },
});

export default PlaylistDetailScreen;
