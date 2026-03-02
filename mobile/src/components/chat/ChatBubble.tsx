/**
 * ChatBubble - Shared reusable chat message bubble
 *
 * Design:
 * - User messages: teal/cyan aligned right with tail bottom-right
 * - Assistant messages: dark glass surface aligned left with tail bottom-left
 * - Staggered entrance animations (FadeInDown)
 * - Optional timestamp display
 * - [ask:] questions parsed and rendered as clickable pills (assistant only)
 * - Web-enriched badge when message used web search
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

// ── Parse [ask:Question] from content ──────────────────────────────
export interface ParsedContent {
  text: string;
  questions: string[];
}

export function parseAskQuestions(content: string): ParsedContent {
  const regex = /\[ask:\s*([^\]]+)\]/g;
  const questions: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const q = match[1].trim();
    if (q) questions.push(q);
  }

  // Remove [ask:...] from visible text
  const text = content.replace(regex, '').trim();
  return { text, questions };
}

/** Remove [[concept]] wiki-style markers from question text */
export function cleanQuestion(q: string): string {
  return q.replace(/\[\[([^\]]+)\]\]/g, '$1').trim();
}

// ── Props ──────────────────────────────────────────────────────────
export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  showTimestamp?: boolean;
  index?: number;
  /** Callback when user taps an [ask:] question pill */
  onQuestionPress?: (question: string) => void;
  /** Whether the message was enriched by web search */
  webSearchUsed?: boolean;
  /** Optional children rendered below message text (e.g. VideoMiniCards) */
  children?: React.ReactNode;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  timestamp,
  showTimestamp = false,
  index = 0,
  onQuestionPress,
  webSearchUsed = false,
  children,
}) => {
  const { colors } = useTheme();
  const isUser = role === 'user';

  // Parse [ask:] questions from assistant messages
  const parsed = useMemo(() => {
    if (isUser) return { text: content, questions: [] };
    return parseAskQuestions(content);
  }, [content, isUser]);

  // Teal for user, glass-dark for assistant
  const bubbleBg = isUser ? colors.accentTertiary : colors.bgSecondary;
  const textColor = isUser ? '#FFFFFF' : colors.textPrimary;

  const handleQuestionTap = (q: string) => {
    if (!onQuestionPress) return;
    Haptics.selectionAsync();
    onQuestionPress(cleanQuestion(q));
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(300).springify()}
      style={[
        styles.container,
        isUser ? styles.containerUser : styles.containerAssistant,
      ]}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: `${colors.accentPrimary}20` }]}>
          <Ionicons name="sparkles" size={14} color={colors.accentPrimary} />
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAssistant,
          { backgroundColor: bubbleBg },
          !isUser && { borderColor: colors.glassBorder, borderWidth: 1 },
        ]}
      >
        {/* Web search badge */}
        {!isUser && webSearchUsed && (
          <View style={[styles.webBadge, { backgroundColor: `${colors.accentPrimary}15` }]}>
            <Ionicons name="globe-outline" size={12} color={colors.accentPrimary} />
            <Text style={[styles.webBadgeText, { color: colors.accentPrimary }]}>
              Enrichi par le web
            </Text>
          </View>
        )}

        <Text style={[styles.messageText, { color: textColor }]}>
          {parsed.text}
        </Text>

        {children}

        {/* [ask:] question pills */}
        {!isUser && parsed.questions.length > 0 && onQuestionPress && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.questionsList}
            style={styles.questionsContainer}
          >
            {parsed.questions.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.questionPill, { borderColor: `${colors.accentPrimary}40`, backgroundColor: `${colors.accentPrimary}10` }]}
                onPress={() => handleQuestionTap(q)}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-forward-circle-outline" size={13} color={colors.accentPrimary} />
                <Text style={[styles.questionPillText, { color: colors.textPrimary }]} numberOfLines={2}>
                  {cleanQuestion(q)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {showTimestamp && timestamp && (
          <Text
            style={[
              styles.timestamp,
              { color: isUser ? 'rgba(255,255,255,0.6)' : colors.textMuted },
            ]}
          >
            {new Date(timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  containerUser: {
    justifyContent: 'flex-end',
  },
  containerAssistant: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  bubbleUser: {
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  timestamp: {
    fontSize: Typography.fontSize.xs - 2,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
    alignSelf: 'flex-end',
  },
  // Web search badge
  webBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: Spacing.xs,
  },
  webBadgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  // [ask:] question pills
  questionsContainer: {
    marginTop: Spacing.sm,
  },
  questionsList: {
    gap: Spacing.xs,
    paddingRight: Spacing.xs,
  },
  questionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxWidth: 220,
  },
  questionPillText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.xs * 1.4,
    flexShrink: 1,
  },
});

export default ChatBubble;
