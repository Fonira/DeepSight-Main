import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
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
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { playlistApi } from '../services/api';
import { Header, Card, Badge, Button, VideoCard, UpgradePromptModal, DeepSightSpinner } from '../components';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { formatDate } from '../utils/formatters';
import { normalizePlanId, hasFeature, getMinPlanForFeature, getPlanInfo } from '../config/planPrivileges';
import type { RootStackParamList, Playlist, AnalysisSummary } from '../types';

type PlaylistDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PlaylistDetail'>;
type PlaylistDetailRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;

export const PlaylistDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigation = useNavigation<PlaylistDetailNavigationProp>();
  const route = useRoute<PlaylistDetailRouteProp>();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('video');
  const isEn = language === 'en';

  // Plan access checks
  const userPlan = normalizePlanId(user?.plan);
  const hasCorpusAccess = hasFeature(userPlan, 'corpus');
  const minPlanForCorpus = getMinPlanForFeature('corpus');
  const minPlanInfo = minPlanForCorpus ? getPlanInfo(minPlanForCorpus) : null;

  const { playlistId } = route.params;

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<AnalysisSummary[]>([]);
  const [corpusSummary, setCorpusSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);
  const [activeTab, setActiveTab] = useState<'videos' | 'synthesis'>('videos');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Load playlist details
  const loadPlaylistDetails = useCallback(async () => {
    setError(null);
    try {
      const response = await playlistApi.getPlaylistDetails(playlistId);
      setPlaylist(response.playlist);
      setVideos(response.videos || []);
      setCorpusSummary(response.corpusSummary || null);
    } catch (err) {
      console.error('Error loading playlist details:', err);
      setError(t.errors.generic);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId, t]);

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

    // Check plan access
    if (!hasCorpusAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradeModal(true);
      return;
    }

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
          <DeepSightSpinner size="lg" showGlow />
        </View>
      </View>
    );
  }

  if (error && !playlist) {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <Header title={t.playlists.title} showBack />
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.accentError} />
          <Text style={[styles.errorText, { color: colors.textPrimary }]}>
            {error}
          </Text>
          <Button
            title={t.common.retry}
            variant="outline"
            onPress={() => {
              setIsLoading(true);
              loadPlaylistDetails();
            }}
          />
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
        <Pressable
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
        </Pressable>
        <Pressable
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
        </Pressable>
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

              {/* Show Team badge if user doesn't have access */}
              {!hasCorpusAccess && (
                <View style={[styles.teamBadge, { backgroundColor: `${colors.accentWarning}15` }]}>
                  <View style={[styles.teamBadgeIcon, { backgroundColor: colors.accentWarning }]}>
                    <Ionicons name="people" size={14} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.teamBadgeText, { color: colors.textSecondary }]}>
                    {isEn
                      ? `Requires ${minPlanInfo?.name.en || 'Team'} plan`
                      : `Nécessite le plan ${minPlanInfo?.name.fr || 'Team'}`}
                  </Text>
                </View>
              )}

              <Button
                title={hasCorpusAccess
                  ? t.playlists.generateSynthesis
                  : (isEn ? 'Unlock Corpus Analysis' : 'Débloquer l\'analyse de corpus')}
                onPress={handleGenerateSynthesis}
                loading={isGeneratingSynthesis}
                style={styles.generateButton}
                icon={
                  hasCorpusAccess
                    ? <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                    : <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                }
              />
            </View>
          )}
        </ScrollView>
      )}

      {/* Upgrade Modal */}
      <UpgradePromptModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        limitType="playlist"
      />
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
    marginTop: Spacing.md,
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
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  teamBadgeIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default PlaylistDetailScreen;
