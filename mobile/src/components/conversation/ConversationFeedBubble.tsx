/**
 * ConversationFeedBubble — Une bulle dans le fil unifié chat + voice.
 *
 * Rend :
 * - User text : bulle indigo, alignée à droite
 * - Assistant text : bulle card (bg + border), alignée gauche, markdown via ChatMarkdown
 * - Assistant voice : idem assistant text + badge mic (icône + label "voix")
 *
 * Note : audio user (`source='voice'` + `voiceSpeaker='user'`) est filtré en
 * amont par `useConversation` (règle UX DeepSight). Cette bulle n'a donc pas
 * de cas "user voice" à gérer.
 *
 * Polish (mai 2026) :
 * - Animation entrée FadeInDown.springify() (Reanimated 4 layout animation)
 * - Long-press → copy content to clipboard + haptic success
 * - Pulse subtle sur le badge mic des messages voice agent récents (<2s)
 * - Accessibilité enrichie (rôle text + label complet)
 */

import React, { memo, useCallback, useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { ChatMarkdown } from "../analysis/ChatMarkdown";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize, lineHeight } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { haptics } from "../../utils/haptics";
import type { UnifiedMessage } from "../../hooks/useConversation";

interface ConversationFeedBubbleProps {
  message: UnifiedMessage;
  /** Optional callback fired after a successful long-press copy.
   *  Parent typically shows a toast "Copié". */
  onCopy?: (content: string) => void;
}

const formatTimestamp = (ts: number): string => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

// ─── Pulsing mic badge for very-recent voice agent messages ───
const PulsingMicBadge: React.FC<{
  isFresh: boolean;
  borderColor: string;
  iconColor: string;
  textColor: string;
}> = ({ isFresh, borderColor, iconColor, textColor }) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (!isFresh) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      3, // 3 cycles puis stop (~3.6s)
      false,
    );
  }, [isFresh, pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      testID="voice-badge-mic"
      style={[styles.voiceBadge, { borderColor }, animatedStyle]}
    >
      <Ionicons name="mic-outline" size={11} color={iconColor} />
      <Text style={[styles.voiceBadgeLabel, { color: textColor }]}>voix</Text>
    </Animated.View>
  );
};

const ConversationFeedBubbleImpl: React.FC<ConversationFeedBubbleProps> = ({
  message,
  onCopy,
}) => {
  const { colors, isDark } = useTheme();
  const isUser = message.role === "user";
  const isVoiceAgent =
    message.source === "voice" && message.voiceSpeaker === "agent";

  // Détecter si la bulle vient juste d'arriver (timestamp < 2s)
  // Important : valeur figée au mount (un re-render ne doit pas relancer le pulse).
  const isFreshVoice = useMemo(() => {
    if (!isVoiceAgent) return false;
    if (!message.timestamp) return false;
    return Date.now() - message.timestamp < 2000;
  }, [isVoiceAgent, message.timestamp]);

  const handleLongPress = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      haptics.success();
      onCopy?.(message.content);
    } catch {
      haptics.error();
    }
  }, [message.content, onCopy]);

  const accessibilityLabel = useMemo(() => {
    const role = isUser ? "Vous" : "Assistant";
    const time = formatTimestamp(message.timestamp);
    const voiceTag = isVoiceAgent ? " (voix)" : "";
    const timeTag = time ? ` à ${time}` : "";
    return `${role}${voiceTag}${timeTag} : ${message.content}`;
  }, [isUser, isVoiceAgent, message.timestamp, message.content]);

  if (isUser) {
    return (
      <Animated.View entering={FadeInDown.duration(250).springify()}>
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={400}
          accessibilityRole="text"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint="Maintenir pour copier"
          style={[
            styles.bubble,
            styles.bubbleUser,
            { backgroundColor: palette.indigo, borderColor: "transparent" },
          ]}
        >
          <Text
            style={[styles.bubbleText, { color: palette.white }]}
            selectable
          >
            {message.content}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // Assistant (texte ou voice agent)
  return (
    <Animated.View entering={FadeInDown.duration(250).springify()}>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={400}
        accessibilityRole="text"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Maintenir pour copier"
        style={[
          styles.bubble,
          styles.bubbleAssistant,
          { backgroundColor: colors.bgCard, borderColor: colors.border },
        ]}
      >
        <ChatMarkdown
          content={message.content}
          textColor={colors.textPrimary}
          isDark={isDark}
        />
      </Pressable>
      {isVoiceAgent ? (
        <PulsingMicBadge
          isFresh={isFreshVoice}
          borderColor={colors.borderLight}
          iconColor={colors.textTertiary}
          textColor={colors.textTertiary}
        />
      ) : null}
    </Animated.View>
  );
};

export const ConversationFeedBubble = memo(ConversationFeedBubbleImpl);

const styles = StyleSheet.create({
  bubble: {
    maxWidth: "80%",
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    marginBottom: sp.xs,
    borderWidth: 1,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  voiceBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: sp.xs,
    paddingVertical: 2,
    marginLeft: sp.xs,
    marginBottom: sp.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  voiceBadgeLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    letterSpacing: 0.3,
  },
});

export default ConversationFeedBubble;
