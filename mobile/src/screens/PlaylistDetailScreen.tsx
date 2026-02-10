import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { ChatBubble } from '../components/chat/ChatBubble';
import { TypingIndicator } from '../components/chat/TypingIndicator';
import { ChatInput } from '../components/chat/ChatInput';
import { VideoMiniCard } from '../components/chat/VideoMiniCard';
import { SuggestedQuestions } from '../components/chat/SuggestedQuestions';
import { Spacing, Typography, BorderRadius } from '../constants/theme';
import { formatDate } from '../utils/formatters';
import { normalizePlanId, hasFeature, getMinPlanForFeature, getPlanInfo } from '../config/planPrivileges';
import type { RootStackParamList, Playlist, AnalysisSummary, ChatMessage } from '../types';

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
  const chatScrollRef = useRef<FlatList>(null);

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
  const [activeTab, setActiveTab] = useState<'videos' | 'chat'>('videos');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Load playlist details
  const loadPlaylistDetails = useCallback(async () => {
    setError(null);
    try {
      const response = await playlistApi.getPlaylistDetails(playlistId);
      setPlaylist(response.playlist);
      setVideos(response.videos || []);
      setCorpusSummary(response.corpusSummary || null);

      // If there's a corpus summary, seed the chat with it as the first assistant message
      if (response.corpusSummary) {
        setChatMessages([{
          id: 'corpus-summary',
          role: 'assistant',
          content: response.corpusSummary,
          timestamp: new Date().toISOString(),
        }]);
      }
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

  // Generate corpus synthesis (initial chat message)
  const handleGenerateSynthesis = async () => {
    if (!playlistId) return;

    if (!hasCorpusAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradeModal(true);
      return;
    }

    setIsSendingMessage(true);

    // Add a user message for the synthesis request
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: isEn
        ? 'Generate a comprehensive synthesis of all videos in this playlist.'
        : 'Génère une synthèse complète de toutes les vidéos de cette playlist.',
      timestamp: new Date().toISOString(),
    };
    setChatMessages(prev => [...prev, userMsg]);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await playlistApi.generateCorpusSummary(playlistId);
      setCorpusSummary(response.summary);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.summary,
        timestamp: new Date().toISOString(),
      };
      setChatMessages(prev => [...prev, assistantMsg]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
      // Remove the user message on error
      setChatMessages(prev => prev.filter(m => m.id !== userMsg.id));
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Send chat message (uses corpus summary context)
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isSendingMessage) return;

    // If no corpus access, prompt upgrade
    if (!hasCorpusAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setShowUpgradeModal(true);
      return;
    }

    // If no synthesis yet, generate it first
    if (!corpusSummary) {
      handleGenerateSynthesis();
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date().toISOString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setIsSendingMessage(true);

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Use the first video's summaryId for the chat API with playlist context
      const firstVideo = videos[0];
      if (firstVideo) {
        const { chatApi } = await import('../services/api');
        const response = await chatApi.sendMessage(firstVideo.id, userMessage.content, {
          mode: 'playlist',
        });

        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.response,
          timestamp: new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, assistantMsg]);
      }
    } catch (err) {
      Alert.alert(t.common.error, t.errors.generic);
      setChatMessages(prev => prev.filter(m => m.id !== userMessage.id));
      setChatInput(userMessage.content);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Handle suggested question
  const handleSuggestedQuestion = (question: string) => {
    setChatInput(question);
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

  /**
   * Detect video references in assistant messages.
   * Matches patterns like "Video: Title" or quoted video titles
   * and renders VideoMiniCards for matching playlist videos.
   */
  const findVideoReferences = (content: string): AnalysisSummary[] => {
    if (!videos.length) return [];
    const refs: AnalysisSummary[] = [];
    for (const video of videos) {
      if (video.title && content.toLowerCase().includes(video.title.toLowerCase().substring(0, 30))) {
        refs.push(video);
      }
    }
    return refs.slice(0, 3); // max 3 inline cards
  };

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
          <Ionicons name="chatbubble-ellipses" size={18} color={colors.accentTertiary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {chatMessages.filter(m => m.role === 'user').length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            {isEn ? 'Questions' : 'Questions'}
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
            activeTab === 'chat' && { borderBottomColor: colors.accentTertiary },
          ]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={18}
            color={activeTab === 'chat' ? colors.accentTertiary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'chat' ? colors.accentTertiary : colors.textSecondary },
            ]}
          >
            {isEn ? 'Chat' : 'Chat'}
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
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={100}
        >
          {/* Playlist Context Badge */}
          <View style={[styles.playlistBadge, { backgroundColor: `${colors.accentTertiary}12`, borderColor: `${colors.accentTertiary}30` }]}>
            <Ionicons name="folder" size={14} color={colors.accentTertiary} />
            <Text style={[styles.playlistBadgeText, { color: colors.accentTertiary }]} numberOfLines={1}>
              Playlist: {playlist.name}
            </Text>
            <View style={[styles.playlistBadgeCount, { backgroundColor: `${colors.accentTertiary}20` }]}>
              <Text style={[styles.playlistBadgeCountText, { color: colors.accentTertiary }]}>
                {videos.length} {isEn ? 'videos' : 'vidéos'}
              </Text>
            </View>
          </View>

          {/* Chat Messages */}
          <FlatList
            ref={chatScrollRef}
            data={chatMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatMessages}
            onContentSizeChange={() => chatScrollRef.current?.scrollToEnd()}
            ListEmptyComponent={
              <View style={styles.chatEmptyState}>
                <Ionicons name="sparkles-outline" size={48} color={colors.textTertiary} />
                <Text style={[styles.chatEmptyTitle, { color: colors.textPrimary }]}>
                  {isEn ? 'Playlist Q&A' : 'Q&R Playlist'}
                </Text>
                <Text style={[styles.chatEmptyText, { color: colors.textSecondary }]}>
                  {isEn
                    ? 'Ask questions about all videos in this playlist. Start by generating a corpus synthesis.'
                    : 'Posez des questions sur toutes les vidéos de cette playlist. Commencez par générer une synthèse du corpus.'}
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

                {/* Generate synthesis button */}
                <Button
                  title={hasCorpusAccess
                    ? (isEn ? 'Generate Corpus Synthesis' : 'Générer la synthèse du corpus')
                    : (isEn ? 'Unlock Corpus Analysis' : 'Débloquer l\'analyse de corpus')}
                  onPress={handleGenerateSynthesis}
                  loading={isSendingMessage}
                  style={styles.generateButton}
                  icon={
                    hasCorpusAccess
                      ? <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                      : <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                  }
                />

                {/* Suggested Questions */}
                <View style={{ marginTop: Spacing.lg, width: '100%' }}>
                  <SuggestedQuestions
                    onQuestionSelect={handleSuggestedQuestion}
                    variant="playlist"
                    disabled={!hasCorpusAccess}
                  />
                </View>
              </View>
            }
            renderItem={({ item, index }) => {
              const videoRefs = item.role === 'assistant' ? findVideoReferences(item.content) : [];
              return (
                <ChatBubble
                  role={item.role}
                  content={item.content}
                  timestamp={item.timestamp}
                  index={index}
                >
                  {/* Inline video reference mini-cards */}
                  {videoRefs.length > 0 && (
                    <View style={styles.videoRefsContainer}>
                      {videoRefs.map((video) => (
                        <VideoMiniCard
                          key={video.id}
                          summaryId={video.id}
                          title={video.title}
                          thumbnail={video.videoInfo?.thumbnail || video.thumbnail}
                          channel={video.videoInfo?.channel || video.channel}
                          onPress={() => handleVideoPress(video)}
                        />
                      ))}
                    </View>
                  )}
                </ChatBubble>
              );
            }}
            ListFooterComponent={isSendingMessage ? <TypingIndicator /> : null}
          />

          {/* Chat Input */}
          <ChatInput
            value={chatInput}
            onChangeText={setChatInput}
            onSend={handleSendChatMessage}
            isLoading={isSendingMessage}
            placeholder={isEn ? 'Ask about this playlist...' : 'Posez une question sur cette playlist...'}
            disabled={!hasCorpusAccess}
          />
        </KeyboardAvoidingView>
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
    paddingVertical: Spacing.xl * 2,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },

  // Chat styles
  chatContainer: {
    flex: 1,
  },
  playlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  playlistBadgeText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  playlistBadgeCount: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  playlistBadgeCountText: {
    fontSize: Typography.fontSize.xs - 2,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  chatMessages: {
    padding: Spacing.md,
    paddingBottom: 20,
  },
  chatEmptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  chatEmptyTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  chatEmptyText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.5,
    marginBottom: Spacing.md,
  },
  generateButton: {
    marginTop: Spacing.md,
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
  videoRefsContainer: {
    marginTop: Spacing.xs,
  },
});

export default PlaylistDetailScreen;
