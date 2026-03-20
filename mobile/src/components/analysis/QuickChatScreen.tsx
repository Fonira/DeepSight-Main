/**
 * QuickChatScreen — Full-screen immersive chat for Quick Chat mode.
 * No tabs, no video player, no summary. Just chat.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  Share,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize, lineHeight } from '../../theme/typography';
import { palette } from '../../theme/colors';
import { useChat } from '../../hooks/useChat';
import { videoApi, historyApi } from '../../services/api';
import { useAnalysisStore } from '../../stores/analysisStore';
import { ChatInput } from './ChatInput';
import { ChatMarkdown } from './ChatMarkdown';
import { DeepSightSpinner } from '../ui/DeepSightSpinner';
import type { ChatMessage, AnalysisSummary } from '../../types';

// ── Parse [ask:...] questions from assistant messages ──
const parseAskQuestions = (content: string): { cleaned: string; questions: string[] } => {
  const regex = /\[ask:([^\]]+)\]/g;
  const questions: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    questions.push(match[1].trim());
  }
  const cleaned = content.replace(regex, '').trim();
  return { cleaned, questions };
};

const SUGGESTED_QUESTIONS = [
  'Résume en 3 points clés',
  'Quels sont les arguments principaux ?',
  'C\'est fiable ? Quelles sources ?',
];

interface QuickChatScreenProps {
  summary: AnalysisSummary;
  onBack: () => void;
}

export const QuickChatScreen: React.FC<QuickChatScreenProps> = ({
  summary,
  onBack,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { messages, isLoading, sendMessage, loadHistory } = useChat(summary.id);
  const [inputText, setInputText] = useState('');
  const [isFavorite, setIsFavorite] = useState(summary.isFavorite);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    Haptics.selectionAsync();
    setInputText('');
    await sendMessage(text);
  }, [inputText, isLoading, sendMessage]);

  const handleSuggestion = useCallback((q: string) => {
    Haptics.selectionAsync();
    sendMessage(q);
  }, [sendMessage]);

  const handleAskQuestion = useCallback((question: string) => {
    Haptics.selectionAsync();
    sendMessage(question);
  }, [sendMessage]);

  const handleToggleFavorite = useCallback(async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await historyApi.toggleFavorite(summary.id);
      setIsFavorite((prev) => !prev);
    } catch {
      // Silent fail
    }
  }, [summary.id]);

  const store = useAnalysisStore();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const handleUpgrade = useCallback(async () => {
    if (isUpgrading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsUpgrading(true);
    try {
      const result = await videoApi.upgradeQuickChat(Number(summary.id), 'standard');
      if (result.status === 'completed') {
        // Already analyzed — just navigate to full view
        router.replace({
          pathname: '/(tabs)/analysis/[id]',
          params: { id: summary.id, initialTab: '0' },
        } as any);
        return;
      }
      // Start streaming overlay flow
      store.startAnalysis(result.task_id);
      router.replace({
        pathname: '/(tabs)/analysis/[id]',
        params: { id: result.task_id, initialTab: '0' },
      } as any);
    } catch (err: any) {
      setIsUpgrading(false);
      const msg = err?.message || err?.detail || 'Erreur lors du lancement de l\'analyse';
      Alert.alert('Erreur', msg);
    }
  }, [isUpgrading, summary.id, store, router]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `${summary.title} — Analysé avec DeepSight`,
        url: summary.video_url || '',
      });
    } catch {
      // Silent fail
    }
  }, [summary]);

  // Détecter la plateforme (multi-fallback robuste)
  const detectedPlatform: string = (() => {
    if (summary.platform && summary.platform !== 'youtube') return summary.platform;
    if (summary.video_url?.includes('tiktok')) return 'tiktok';
    // YouTube video IDs = exactement 11 chars [A-Za-z0-9_-]
    // TikTok IDs = codes courts alphanumériques OU longs numériques
    const vid = summary.videoId || '';
    const isYouTubeId = /^[A-Za-z0-9_-]{11}$/.test(vid);
    if (!isYouTubeId && vid.length > 0 && !vid.startsWith('txt_')) return 'tiktok';
    return summary.platform || 'youtube';
  })();
  const platformBadge = detectedPlatform === 'tiktok'
    ? { label: 'TikTok', bg: '#010101', border: '#333' }
    : { label: 'YT', bg: '#FF0000', border: '#FF0000' };

  // Titre intelligent : éviter les titres génériques
  const displayTitle = (summary.title && !['TikTok Video', 'Video sans titre', 'TikTok'].includes(summary.title))
    ? summary.title
    : summary.channel
      ? `Vidéo de ${summary.channel}`
      : `Vidéo ${detectedPlatform === 'tiktok' ? 'TikTok' : 'YouTube'}`;

  const quotaText = `${messages.filter((m) => m.role === 'user').length}/15 questions`;

  // ── Typing indicator ──
  const TypingDots = useCallback(() => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
      dot1.value = withRepeat(
        withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })),
        -1, true
      );
      setTimeout(() => {
        dot2.value = withRepeat(
          withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })),
          -1, true
        );
      }, 150);
      setTimeout(() => {
        dot3.value = withRepeat(
          withSequence(withTiming(-4, { duration: 300 }), withTiming(0, { duration: 300 })),
          -1, true
        );
      }, 300);
    }, [dot1, dot2, dot3]);

    const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: dot1.value }] }));
    const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: dot2.value }] }));
    const s3 = useAnimatedStyle(() => ({ transform: [{ translateY: dot3.value }] }));

    return (
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDot, { backgroundColor: palette.indigo }, s1]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: palette.indigo }, s2]} />
        <Animated.View style={[styles.typingDot, { backgroundColor: palette.indigo }, s3]} />
      </View>
    );
  }, []);

  // ── Message renderer ──
  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const { cleaned, questions } = isUser
      ? { cleaned: item.content, questions: [] }
      : parseAskQuestions(item.content);

    return (
      <View>
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            {
              backgroundColor: isUser ? palette.indigo : colors.bgCard,
              borderColor: isUser ? 'transparent' : colors.border,
            },
          ]}
        >
          {isUser ? (
            <Text style={[styles.bubbleText, { color: '#ffffff' }]} selectable>
              {item.content}
            </Text>
          ) : (
            <ChatMarkdown
              content={cleaned}
              textColor={colors.textPrimary}
              isDark={isDark}
            />
          )}
        </View>
        {/* Clickable [ask:] follow-up questions */}
        {questions.length > 0 && (
          <View style={[styles.askBlock, { borderColor: colors.border }]}>
            <View style={styles.askHeader}>
              <Ionicons name="sparkles" size={14} color={palette.amber} />
              <Text style={[styles.askHeaderText, { color: palette.amber }]}>Pour aller plus loin</Text>
            </View>
            {questions.map((q, idx) => (
              <Pressable
                key={idx}
                style={[styles.askBtn, { backgroundColor: palette.cyan + '1A', borderColor: palette.cyan + '4D' }]}
                onPress={() => handleAskQuestion(q)}
              >
                <Ionicons name="arrow-forward" size={14} color={palette.cyan} style={{ marginTop: 2 }} />
                <Text style={[styles.askBtnText, { color: palette.cyan }]}>{q}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  }, [colors, isDark, handleAskQuestion]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  const hasMessages = messages.length > 0 || isLoading;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.container,
        {
          backgroundColor: colors.bgPrimary,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {/* ── Header compact ── */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} style={styles.iconButton} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {displayTitle}
        </Text>
        <View style={[styles.platformBadge, { backgroundColor: platformBadge.bg }]}>
          <Text style={styles.platformBadgeText}>{platformBadge.label}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        {/* ── Welcome / Empty state ── */}
        {!hasMessages && (
          <View style={styles.welcomeContainer}>
            <DeepSightSpinner size="lg" />
            <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
              Quick Chat
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textTertiary }]}>
              Pose une question sur cette vidéo...
            </Text>

            {/* Suggested questions — horizontal scrollable chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsRow}
              style={styles.suggestionsScroll}
            >
              {SUGGESTED_QUESTIONS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => handleSuggestion(q)}
                  style={[styles.suggestionChip, { borderColor: palette.cyan + '4D' }]}
                  accessibilityLabel={q}
                >
                  <Text style={[styles.suggestionText, { color: palette.cyan }]}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── Chat messages ── */}
        {hasMessages && (
          <>
            {messages.length < 3 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsRow}
                style={styles.suggestionsScrollCompact}
              >
                {SUGGESTED_QUESTIONS.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => handleSuggestion(q)}
                    style={[styles.suggestionChip, { borderColor: palette.cyan + '4D' }]}
                    accessibilityLabel={q}
                  >
                    <Text style={[styles.suggestionText, { color: palette.cyan }]}>{q}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <FlatList
              data={[...messages].reverse()}
              renderItem={renderMessage}
              keyExtractor={keyExtractor}
              inverted
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              maxToRenderPerBatch={10}
              windowSize={10}
              removeClippedSubviews={Platform.OS === 'android'}
            />
            {isLoading && (
              <View style={[styles.bubble, styles.bubbleAssistant, { backgroundColor: colors.bgCard, borderColor: colors.border, marginLeft: sp.lg }]}>
                <TypingDots />
              </View>
            )}
          </>
        )}

        {/* ── Chat input ── */}
        <ChatInput
          inputText={inputText}
          setInputText={setInputText}
          onSend={handleSend}
          isLoading={isLoading}
          colors={colors}
          quotaText={quotaText}
        />

        {/* ── Mini action bar ── */}
        <View style={[styles.miniActionBar, { borderTopColor: colors.border }]}>
          <Pressable onPress={handleToggleFavorite} style={styles.miniAction} accessibilityLabel="Favori">
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={18}
              color={isFavorite ? palette.amber : colors.textTertiary}
            />
            <Text style={[styles.miniActionText, { color: colors.textTertiary }]}>Favori</Text>
          </Pressable>
          <Pressable
            onPress={handleUpgrade}
            disabled={isUpgrading}
            style={[styles.upgradeAction, { backgroundColor: palette.indigo + '20', borderColor: palette.indigo + '40' }]}
            accessibilityLabel="Lancer l'analyse complète"
          >
            {isUpgrading ? (
              <DeepSightSpinner size="xs" speed="fast" />
            ) : (
              <Ionicons name="analytics-outline" size={16} color={palette.indigo} />
            )}
            <Text style={[styles.upgradeActionText, { color: palette.indigo }]}>
              {isUpgrading ? 'Lancement...' : 'Analyse complète'}
            </Text>
          </Pressable>
          <Pressable onPress={handleShare} style={styles.miniAction} accessibilityLabel="Partager">
            <Ionicons name="share-outline" size={18} color={colors.textTertiary} />
            <Text style={[styles.miniActionText, { color: colors.textTertiary }]}>Partager</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderBottomWidth: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    marginHorizontal: sp.sm,
  },
  platformBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  platformBadgeText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  // ── Welcome ──
  welcomeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp['2xl'],
    gap: sp.md,
  },
  welcomeTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    marginTop: sp.sm,
  },
  welcomeSubtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  // ── Suggestions ──
  suggestionsScroll: {
    marginTop: sp.lg,
    maxHeight: 50,
  },
  suggestionsScrollCompact: {
    maxHeight: 44,
    marginBottom: sp.xs,
  },
  suggestionsRow: {
    paddingHorizontal: sp.lg,
    gap: sp.sm,
    alignItems: 'center',
  },
  suggestionChip: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  suggestionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  // ── Chat messages ──
  listContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    marginBottom: sp.sm,
    borderWidth: 1,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  typingContainer: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // ── [ask:] questions ──
  askBlock: {
    alignSelf: 'flex-start',
    width: '100%',
    marginBottom: sp.md,
    marginTop: -sp.xs,
    paddingTop: sp.sm,
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: sp.sm,
  },
  askHeaderText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
  askBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: sp.sm,
  },
  askBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    flex: 1,
    lineHeight: fontSize.sm * 1.4,
  },
  // ── Mini action bar ──
  miniActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: sp.sm,
    borderTopWidth: 1,
  },
  miniAction: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs,
  },
  miniActionText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize['2xs'],
  },
  upgradeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  upgradeActionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['2xs'],
  },
});

export default QuickChatScreen;
