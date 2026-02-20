import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';

import { useTheme } from '../contexts/ThemeContext';
import { playlistApi } from '../services/api';
import { DeepSightSpinner } from '../components/loading';
import { formatDuration, formatRelativeTime } from '../utils/formatters';
import type {
  RootStackParamList,
  PlaylistFullResponse,
  PlaylistDetailsResponse,
  PlaylistVideoItem,
  CorpusChatMessage,
} from '../types';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════
type TabId = 'videos' | 'synthesis' | 'chat' | 'stats';

interface TabConfig {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'videos', label: 'Vidéos', icon: 'videocam' },
  { id: 'synthesis', label: 'Synthèse', icon: 'document-text' },
  { id: 'chat', label: 'Chat IA', icon: 'chatbubbles' },
  { id: 'stats', label: 'Stats', icon: 'bar-chart' },
];

// ════════════════════════════════════════════
// Main Component
// ════════════════════════════════════════════
export const PlaylistDetailScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'PlaylistDetail'>>();
  const { playlistId } = route.params;

  // ── State ──
  const [activeTab, setActiveTab] = useState<TabId>('videos');
  const [playlist, setPlaylist] = useState<PlaylistFullResponse | null>(null);
  const [details, setDetails] = useState<PlaylistDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<CorpusChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);
  const chatScrollRef = useRef<FlatList>(null);

  // Synthesis state
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ── Load playlist data ──
  const loadPlaylist = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await playlistApi.getPlaylist(playlistId);
      setPlaylist(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de chargement';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [playlistId]);

  const loadDetails = useCallback(async () => {
    try {
      const data = await playlistApi.getDetails(playlistId);
      setDetails(data);
    } catch {
      // Stats are optional, don't block
    }
  }, [playlistId]);

  const loadChatHistory = useCallback(async () => {
    try {
      const messages = await playlistApi.getChatHistory(playlistId);
      setChatMessages(messages);
      setChatLoaded(true);
    } catch {
      setChatLoaded(true);
    }
  }, [playlistId]);

  useEffect(() => {
    loadPlaylist();
    loadDetails();
  }, [loadPlaylist, loadDetails]);

  // Lazy-load chat when tab switches
  useEffect(() => {
    if (activeTab === 'chat' && !chatLoaded) {
      loadChatHistory();
    }
  }, [activeTab, chatLoaded, loadChatHistory]);

  // ── Chat actions ──
  const sendChatMessage = useCallback(async () => {
    const message = chatInput.trim();
    if (!message || isSendingChat) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatInput('');

    const userMsg: CorpusChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMsg]);

    setIsSendingChat(true);
    try {
      const response = await playlistApi.chatWithCorpus(playlistId, message);
      const assistantMsg: CorpusChatMessage = {
        id: `resp-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        created_at: new Date().toISOString(),
        sources: response.sources,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', errMsg);
      // Remove the user message on error
      setChatMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setChatInput(message); // Restore input
    } finally {
      setIsSendingChat(false);
    }
  }, [chatInput, isSendingChat, playlistId]);

  // ── Synthesis actions ──
  const regenerateSynthesis = useCallback(async () => {
    if (isRegenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRegenerating(true);
    try {
      const result = await playlistApi.generateCorpusSummary(playlistId);
      if (playlist) {
        setPlaylist({ ...playlist, meta_analysis: result.meta_analysis });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', errMsg);
    } finally {
      setIsRegenerating(false);
    }
  }, [isRegenerating, playlistId, playlist]);

  // ── Navigate to video analysis ──
  const openVideo = useCallback((video: PlaylistVideoItem) => {
    if (video.video_id) {
      navigation.navigate('Analysis', { summaryId: String(video.id), videoId: video.video_id });
    }
  }, [navigation]);

  // ── Tab change ──
  const handleTabChange = useCallback((tab: TabId) => {
    Haptics.selectionAsync();
    setActiveTab(tab);
  }, []);

  // ════════════════════════════════════════════
  // RENDERS
  // ════════════════════════════════════════════

  // ── Header ──
  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={12}>
        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {playlist?.playlist_title || 'Playlist'}
        </Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {playlist?.num_processed ?? 0}/{playlist?.num_videos ?? 0} vidéos analysées
        </Text>
      </View>
    </View>
  );

  // ── Tab Bar ──
  const renderTabBar = () => (
    <View style={[styles.tabBar, { borderBottomColor: colors.glassBorder }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tabItem, isActive && { borderBottomColor: colors.accentPrimary, borderBottomWidth: 2 }]}
            onPress={() => handleTabChange(tab.id)}
          >
            <Ionicons
              name={tab.icon as keyof typeof Ionicons.glyphMap}
              size={18}
              color={isActive ? colors.accentPrimary : colors.textMuted}
            />
            <Text style={[styles.tabLabel, { color: isActive ? colors.accentPrimary : colors.textMuted }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ── Video Item ──
  const renderVideoItem = ({ item }: { item: PlaylistVideoItem }) => (
    <Pressable
      style={[styles.videoCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
      onPress={() => openVideo(item)}
    >
      <Image
        source={{ uri: item.thumbnail_url || `https://img.youtube.com/vi/${item.video_id}/mqdefault.jpg` }}
        style={styles.videoThumb}
        contentFit="cover"
      />
      <View style={styles.videoInfo}>
        <Text style={[styles.videoTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {item.video_title}
        </Text>
        <Text style={[styles.videoChannel, { color: colors.textMuted }]} numberOfLines={1}>
          {item.video_channel}
        </Text>
        <View style={styles.videoMeta}>
          {item.video_duration != null && (
            <View style={styles.metaChip}>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatDuration(item.video_duration)}
              </Text>
            </View>
          )}
          {item.category && (
            <View style={[styles.metaChip, { backgroundColor: colors.accentPrimary + '20' }]}>
              <Text style={[styles.metaText, { color: colors.accentPrimary }]}>{item.category}</Text>
            </View>
          )}
          {item.reliability_score != null && (
            <View style={[styles.metaChip, {
              backgroundColor: item.reliability_score >= 70
                ? '#22c55e20' : item.reliability_score >= 50 ? '#f59e0b20' : '#ef444420'
            }]}>
              <Text style={[styles.metaText, {
                color: item.reliability_score >= 70
                  ? '#22c55e' : item.reliability_score >= 50 ? '#f59e0b' : '#ef4444'
              }]}>
                {item.reliability_score}%
              </Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );

  // ── Videos Tab ──
  const renderVideosTab = () => {
    const videos = playlist?.videos || [];
    return (
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="videocam-off-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aucune vidéo analysée</Text>
          </View>
        }
      />
    );
  };

  // ── Synthesis Tab ──
  const renderSynthesisTab = () => {
    const meta = playlist?.meta_analysis;
    const markdownStyles = {
      body: { color: colors.textPrimary, fontSize: 15, lineHeight: 24 },
      heading1: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' as const, marginTop: 20, marginBottom: 10 },
      heading2: { color: colors.textPrimary, fontSize: 18, fontWeight: '600' as const, marginTop: 16, marginBottom: 8 },
      heading3: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' as const, marginTop: 12, marginBottom: 6 },
      strong: { color: colors.accentPrimary, fontWeight: '600' as const },
      em: { color: colors.textSecondary, fontStyle: 'italic' as const },
      bullet_list: { marginVertical: 8 },
      ordered_list: { marginVertical: 8 },
      list_item: { marginVertical: 2 },
      code_inline: { backgroundColor: colors.glassBg, color: colors.accentSecondary, paddingHorizontal: 4, borderRadius: 4, fontSize: 13 },
      fence: { backgroundColor: colors.glassBg, borderColor: colors.glassBorder, borderWidth: 1, borderRadius: 8, padding: 12, marginVertical: 8 },
      blockquote: { backgroundColor: colors.glassBg, borderLeftColor: colors.accentPrimary, borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 8, marginVertical: 8, borderRadius: 4 },
      hr: { backgroundColor: colors.glassBorder, height: 1, marginVertical: 16 },
      link: { color: colors.accentPrimary },
    };

    return (
      <ScrollView
        contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Regenerate button */}
        <Pressable
          style={[styles.regenButton, { backgroundColor: colors.accentSecondary + '20', borderColor: colors.accentSecondary + '40' }]}
          onPress={regenerateSynthesis}
          disabled={isRegenerating}
        >
          {isRegenerating ? (
            <ActivityIndicator size="small" color={colors.accentSecondary} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.accentSecondary} />
          )}
          <Text style={[styles.regenText, { color: colors.accentSecondary }]}>
            {isRegenerating ? 'Génération...' : 'Régénérer la synthèse'}
          </Text>
        </Pressable>

        {meta ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <Markdown style={markdownStyles}>{meta}</Markdown>
          </Animated.View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Aucune méta-analyse disponible
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              Appuyez sur "Régénérer" pour lancer l'analyse du corpus
            </Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ── Chat Message ──
  const renderChatMessage = ({ item }: { item: CorpusChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <Animated.View
        entering={FadeInDown.duration(300)}
        style={[
          styles.chatBubble,
          isUser
            ? [styles.chatBubbleUser, { backgroundColor: colors.accentPrimary }]
            : [styles.chatBubbleAssistant, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }],
        ]}
      >
        <Text style={[styles.chatText, { color: isUser ? '#FFFFFF' : colors.textPrimary }]}>
          {item.content}
        </Text>
        {item.sources && item.sources.length > 0 && (
          <View style={styles.chatSources}>
            <Text style={[styles.chatSourcesLabel, { color: colors.textMuted }]}>Sources :</Text>
            {item.sources.map((src, idx) => (
              <Text key={idx} style={[styles.chatSourceItem, { color: colors.accentPrimary }]}>
                • {src.video_title}
              </Text>
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  // ── Chat Tab ──
  const renderChatTab = () => (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 120}
    >
      <FlatList
        ref={chatScrollRef}
        data={chatMessages}
        renderItem={renderChatMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.chatList, chatMessages.length === 0 && styles.chatListEmpty]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Posez une question sur le corpus
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
              L'IA répondra en se basant sur l'ensemble des vidéos analysées
            </Text>
          </View>
        }
      />
      <View style={[styles.chatInputBar, { backgroundColor: colors.bgSecondary, borderTopColor: colors.glassBorder }]}>
        <TextInput
          style={[styles.chatInput, { color: colors.textPrimary, backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          placeholder="Votre question..."
          placeholderTextColor={colors.textMuted}
          value={chatInput}
          onChangeText={setChatInput}
          multiline
          maxLength={2000}
          returnKeyType="send"
          editable={!isSendingChat}
        />
        <Pressable
          style={[styles.chatSendButton, { backgroundColor: chatInput.trim() ? colors.accentPrimary : colors.glassBg }]}
          onPress={sendChatMessage}
          disabled={!chatInput.trim() || isSendingChat}
        >
          {isSendingChat ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="send" size={18} color={chatInput.trim() ? '#FFFFFF' : colors.textMuted} />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  // ── Stat Card ──
  const StatCard = ({ icon, label, value, color: cardColor }: { icon: string; label: string; value: string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
      <View style={[styles.statIconContainer, { backgroundColor: cardColor + '20' }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={cardColor} />
      </View>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  // ── Category Bar ──
  const CategoryBar = ({ name, count, max }: { name: string; count: number; max: number }) => (
    <View style={styles.categoryRow}>
      <Text style={[styles.categoryName, { color: colors.textSecondary }]} numberOfLines={1}>{name}</Text>
      <View style={[styles.categoryBarBg, { backgroundColor: colors.glassBg }]}>
        <View style={[styles.categoryBarFill, { width: `${(count / max) * 100}%`, backgroundColor: colors.accentPrimary }]} />
      </View>
      <Text style={[styles.categoryCount, { color: colors.textMuted }]}>{count}</Text>
    </View>
  );

  // ── Stats Tab ──
  const renderStatsTab = () => {
    const stats = details?.statistics;
    const categories = details?.categories || {};
    const channels = details?.channels || {};
    const maxCat = Math.max(...Object.values(categories), 1);
    const maxCh = Math.max(...Object.values(channels), 1);

    const totalDurationMin = stats?.total_duration ? Math.round(stats.total_duration / 60) : 0;
    const totalDurationStr = totalDurationMin > 60
      ? `${Math.floor(totalDurationMin / 60)}h ${totalDurationMin % 60}m`
      : `${totalDurationMin}m`;

    return (
      <ScrollView
        contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat Cards */}
        <View style={styles.statGrid}>
          <StatCard icon="videocam" label="Vidéos" value={`${stats?.num_processed ?? 0}/${stats?.num_videos ?? 0}`} color={colors.accentPrimary} />
          <StatCard icon="time" label="Durée totale" value={totalDurationStr} color={colors.accentSecondary} />
          <StatCard icon="document-text" label="Mots" value={`${((stats?.total_words ?? 0) / 1000).toFixed(1)}K`} color="#06b6d4" />
          <StatCard icon="analytics" label="Mots/vidéo" value={String(stats?.average_words ?? 0)} color="#f59e0b" />
        </View>

        {/* Categories */}
        {Object.keys(categories).length > 0 && (
          <View style={styles.statsSection}>
            <Text style={[styles.statsSectionTitle, { color: colors.textPrimary }]}>
              <Ionicons name="grid-outline" size={16} /> Catégories
            </Text>
            {Object.entries(categories)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([name, count]) => (
                <CategoryBar key={name} name={name} count={count} max={maxCat} />
              ))}
          </View>
        )}

        {/* Channels */}
        {Object.keys(channels).length > 0 && (
          <View style={styles.statsSection}>
            <Text style={[styles.statsSectionTitle, { color: colors.textPrimary }]}>
              <Ionicons name="people-outline" size={16} /> Chaînes YouTube
            </Text>
            {Object.entries(channels)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 8)
              .map(([name, count]) => (
                <CategoryBar key={name} name={name} count={count} max={maxCh} />
              ))}
          </View>
        )}

        {!details && (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Chargement des statistiques...</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  // ════════════════════════════════════════════
  // MAIN RENDER
  // ════════════════════════════════════════════
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}>
        <DeepSightSpinner size="lg" showGlow />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accentError} />
        <Text style={[styles.errorText, { color: colors.textPrimary }]}>{error}</Text>
        <Pressable
          style={[styles.retryButton, { backgroundColor: colors.accentPrimary }]}
          onPress={loadPlaylist}
        >
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {renderHeader()}
      {renderTabBar()}

      {activeTab === 'videos' && renderVideosTab()}
      {activeTab === 'synthesis' && renderSynthesisTab()}
      {activeTab === 'chat' && renderChatTab()}
      {activeTab === 'stats' && renderStatsTab()}
    </View>
  );
};

// ════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 32,
    marginTop: 12,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Tab Content
  tabContent: {
    padding: 16,
    gap: 12,
  },

  // Video Card
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  videoThumb: {
    width: 80,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  videoInfo: {
    flex: 1,
    gap: 3,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 18,
  },
  videoChannel: {
    fontSize: 12,
  },
  videoMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Synthesis
  regenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  regenText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Chat
  chatContainer: {
    flex: 1,
  },
  chatList: {
    padding: 16,
    gap: 10,
  },
  chatListEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  chatBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatSources: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  chatSourcesLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  chatSourceItem: {
    fontSize: 12,
    marginVertical: 1,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    flexGrow: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },

  // Stats Sections
  statsSection: {
    marginTop: 20,
    gap: 10,
  },
  statsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryName: {
    width: 90,
    fontSize: 13,
  },
  categoryBarBg: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  categoryCount: {
    width: 28,
    fontSize: 12,
    textAlign: 'right',
  },
});

export default PlaylistDetailScreen;
