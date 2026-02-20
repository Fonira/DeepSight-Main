/**
 * ChatBubble - Shared reusable chat message bubble
 *
 * Design:
 * - User messages: teal/cyan aligned right with tail bottom-right
 * - Assistant messages: dark glass surface aligned left with tail bottom-left
 * - Staggered entrance animations (FadeInDown)
 * - Optional timestamp display
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

export interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  showTimestamp?: boolean;
  index?: number;
  /** Optional children rendered below message text (e.g. VideoMiniCards) */
  children?: React.ReactNode;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  role,
  content,
  timestamp,
  showTimestamp = false,
  index = 0,
  children,
}) => {
  const { colors } = useTheme();
  const isUser = role === 'user';

  // Teal for user, glass-dark for assistant
  const bubbleBg = isUser ? colors.accentTertiary : colors.bgSecondary;
  const textColor = isUser ? '#FFFFFF' : colors.textPrimary;

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
        <Text style={[styles.messageText, { color: textColor }]}>
          {content}
        </Text>

        {children}

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
});

export default ChatBubble;
