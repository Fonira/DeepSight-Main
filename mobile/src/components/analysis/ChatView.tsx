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
import type { ChatMessage } from '../../types';

interface ChatViewProps {
  summaryId: string;
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

export const ChatView: React.FC<ChatViewProps> = ({ summaryId }) => {
  const { colors } = useTheme();
  const { messages, isLoading, sendMessage, loadHistory } = useChat(summaryId);
  const [inputText, setInputText] = useState('');

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

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          { backgroundColor: isUser ? palette.indigo : colors.bgCard, borderColor: isUser ? 'transparent' : colors.border },
        ]}
      >
        <Text style={[styles.bubbleText, { color: isUser ? '#ffffff' : colors.textPrimary }]} selectable>
          {item.content}
        </Text>
      </View>
    );
  }, [colors]);

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
      <View style={styles.container}>
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
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
      {messages.length < 3 && <SuggestionsRow />}
      <FlatList
        data={messages}
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
});

export default ChatView;
