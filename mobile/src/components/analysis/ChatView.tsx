import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize, lineHeight } from '../../theme/typography';
import { palette } from '../../theme/colors';
import { useChat } from '../../hooks/useChat';
import { ChatInput } from './ChatInput';
import { ChatMarkdown } from './ChatMarkdown';
import { AudioPlayerButton } from '../AudioPlayerButton';
import { TTSToggle } from '../TTSToggle';
import { useTTSContext } from '../../contexts/TTSContext';
import type { ChatMessage } from '../../types';

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

interface ChatViewProps {
  summaryId: string;
  /** Offset clavier (pixels entre le bas de la view et le bas de l'écran).
   *  Mode normal ≈ 120 (header+vidéo+tabbar), fullscreen ≈ 88. */
  keyboardOffset?: number;
}

const SUGGESTED_QUESTIONS = [
  'Résume en 3 points',
  'Quels sont les arguments ?',
  "C'est fiable ?",
];

const TypingIndicator: React.FC = () => {
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
};

export const ChatView: React.FC<ChatViewProps> = ({ summaryId, keyboardOffset = 120 }) => {
  const { colors, isDark } = useTheme();
  const { messages, isLoading, sendMessage, loadHistory } = useChat(summaryId);
  const { autoPlayEnabled, playText, stopPlaying } = useTTSContext();
  const [inputText, setInputText] = useState('');
  const prevMsgCountRef = useRef(messages.length);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Auto-play TTS on new assistant message
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current && autoPlayEnabled) {
      const last = messages[messages.length - 1];
      if (last?.role === 'assistant') {
        const text = typeof last.content === 'string' ? last.content : '';
        playText(text.slice(0, 5000));
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, autoPlayEnabled, playText]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    stopPlaying();
    Haptics.selectionAsync();
    setInputText('');
    await sendMessage(text);
  }, [inputText, isLoading, sendMessage, stopPlaying]);

  const handleSuggestion = useCallback((q: string) => {
    Haptics.selectionAsync();
    sendMessage(q);
  }, [sendMessage]);

  const handleAskQuestion = useCallback((question: string) => {
    Haptics.selectionAsync();
    sendMessage(question);
  }, [sendMessage]);

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
            { backgroundColor: isUser ? palette.indigo : colors.bgCard, borderColor: isUser ? 'transparent' : colors.border },
          ]}
        >
          {isUser ? (
            <Text style={[styles.bubbleText, { color: '#ffffff' }]} selectable>
              {item.content}
            </Text>
          ) : (
            <>
              <ChatMarkdown
                content={cleaned}
                textColor={colors.textPrimary}
                isDark={isDark}
              />
              <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                <AudioPlayerButton text={cleaned} size="sm" />
              </View>
            </>
          )}
        </View>
        {/* Questions cliquables "Pour aller plus loin" */}
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
  const quotaText = `${messages.filter((m) => m.role === 'user').length}/15 questions`;

  const SuggestionsRow = useCallback(() => (
    <View style={styles.suggestionsRow}>
      {SUGGESTED_QUESTIONS.map((q) => (
        <Pressable
          key={q}
          onPress={() => handleSuggestion(q)}
          style={[styles.chip, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
          accessibilityLabel={q}
          accessibilityRole="button"
        >
          <Text style={[styles.chipText, { color: colors.accentPrimary }]}>{q}</Text>
        </Pressable>
      ))}
    </View>
  ), [handleSuggestion, colors]);

  if (messages.length === 0 && !isLoading) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardOffset}
      >
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={56} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            Pose ta première question
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Interroge l'IA sur le contenu de cette vidéo
          </Text>
        </View>
        <SuggestionsRow />
        <ChatInput inputText={inputText} setInputText={setInputText} onSend={handleSend} isLoading={isLoading} colors={colors} quotaText={quotaText} />
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={keyboardOffset}>
      {messages.length < 3 && <SuggestionsRow />}
      <FlatList
        data={[...messages].slice(-200).reverse()}
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
          <TypingIndicator />
        </View>
      )}
      <View style={styles.ttsToggleRow}>
        <TTSToggle />
      </View>
      <ChatInput inputText={inputText} setInputText={setInputText} onSend={handleSend} isLoading={isLoading} colors={colors} quotaText={quotaText} />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    paddingBottom: sp['4xl'],
  },
  emptyTitle: { fontFamily: fontFamily.bodySemiBold, fontSize: fontSize.lg, marginTop: sp.md },
  emptySubtitle: { fontFamily: fontFamily.body, fontSize: fontSize.sm, textAlign: 'center' },
  ttsToggleRow: { paddingHorizontal: sp.lg, paddingTop: sp.xs, alignItems: 'flex-end' },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sp.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.sm,
  },
  chip: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontFamily: fontFamily.bodyMedium, fontSize: fontSize.xs },
  listContent: { paddingHorizontal: sp.lg, paddingBottom: sp.md },
  bubble: {
    maxWidth: '80%',
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    marginBottom: sp.sm,
    borderWidth: 1,
  },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: borderRadius.sm },
  bubbleAssistant: { alignSelf: 'flex-start', borderBottomLeftRadius: borderRadius.sm },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  typingContainer: { flexDirection: 'row', gap: 4, paddingVertical: 4, paddingHorizontal: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3 },
  // ── Clickable [ask:] questions ──
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
});

export default ChatView;
