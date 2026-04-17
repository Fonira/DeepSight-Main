/**
 * VoiceTranscript — Chat bubble transcript for voice conversations.
 *
 * ScrollView (not FlashList) because voice sessions are typically short (<50 msgs).
 * Auto-scrolls to bottom on new messages, shows a "typing" bubble during streaming.
 */

import React, { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontSize } from "../../theme/typography";

// ─── Types ─────────────────────────────────────────────────────────────────

interface VoiceTranscriptMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface VoiceTranscriptProps {
  messages: VoiceTranscriptMessage[];
  isStreaming?: boolean;
}

// ─── Typing indicator (3 pulsing dots) ─────────────────────────────────────

interface TypingDotProps {
  index: number;
  color: string;
}

const DOT_DELAYS = [0, 150, 300] as const;

const TypingDot: React.FC<TypingDotProps> = React.memo(({ index, color }) => {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      DOT_DELAYS[index] ?? 0,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, [index, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[styles.typingDot, { backgroundColor: color }, animatedStyle]}
    />
  );
});

TypingDot.displayName = "TypingDot";

// ─── Helpers ───────────────────────────────────────────────────────────────

const formatTimestamp = (ts: number): string => {
  const date = new Date(ts);
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
};

// ─── Main component ────────────────────────────────────────────────────────

const VoiceTranscriptInner: React.FC<VoiceTranscriptProps> = ({
  messages,
  isStreaming = false,
}) => {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Defer scrollToEnd to the next frame so layout has settled.
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [messages.length, isStreaming]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          La conversation apparaîtra ici...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const bubbleBg = isUser
          ? `${colors.accentPrimary}33` // primary/20%
          : `${colors.surface}1A`; // surface/10%
        const textColor = isUser ? colors.accentPrimary : colors.textPrimary;

        return (
          <View
            key={msg.id}
            style={[
              styles.messageRow,
              isUser ? styles.alignRight : styles.alignLeft,
            ]}
          >
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: bubbleBg,
                  borderColor: isUser
                    ? `${colors.accentPrimary}40`
                    : colors.border,
                },
                isUser ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
              accessibilityRole="text"
              accessibilityLabel={`${isUser ? "Vous" : "Assistant"}: ${msg.content}`}
            >
              <Text style={[styles.bubbleText, { color: textColor }]}>
                {msg.content}
              </Text>
            </View>
            {typeof msg.timestamp === "number" && (
              <Text
                style={[
                  styles.timestamp,
                  { color: colors.textMuted },
                  isUser ? styles.timestampRight : styles.timestampLeft,
                ]}
              >
                {formatTimestamp(msg.timestamp)}
              </Text>
            )}
          </View>
        );
      })}

      {isStreaming && (
        <View style={[styles.messageRow, styles.alignLeft]}>
          <View
            style={[
              styles.bubble,
              styles.bubbleAssistant,
              {
                backgroundColor: `${colors.surface}1A`,
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="text"
            accessibilityLabel="Assistant en train d'écrire"
          >
            <View style={styles.typingRow}>
              <TypingDot index={0} color={colors.textSecondary} />
              <TypingDot index={1} color={colors.textSecondary} />
              <TypingDot index={2} color={colors.textSecondary} />
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.md,
    gap: sp.sm,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: sp.lg,
    minHeight: 120,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  messageRow: {
    marginBottom: sp.xs,
    maxWidth: "100%",
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  bubble: {
    paddingVertical: sp.md,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.lg,
    maxWidth: "80%",
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleUser: {
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleText: {
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.45,
  },
  timestamp: {
    fontSize: fontSize.xs,
    marginTop: 2,
    opacity: 0.5,
  },
  timestampLeft: {
    marginLeft: sp.xs,
  },
  timestampRight: {
    marginRight: sp.xs,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 18,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export const VoiceTranscript = React.memo(VoiceTranscriptInner);
VoiceTranscript.displayName = "VoiceTranscript";

export default VoiceTranscript;
