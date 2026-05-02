/**
 * ConversationFeedBubble — Une bulle dans le fil unifié chat + voice.
 *
 * Rend :
 * - User text : bulle indigo, alignée à droite
 * - Assistant text : bulle card (bg + border), alignée gauche, markdown via ChatMarkdown
 * - Assistant voice : idem assistant text + badge 🎙️ (icône mic + label "voix")
 *
 * Note : audio user (`source='voice'` + `voiceSpeaker='user'`) est filtré en
 * amont par `useConversation` (règle UX DeepSight). Cette bulle n'a donc pas
 * de cas "user voice" à gérer.
 */

import React, { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { ChatMarkdown } from "../analysis/ChatMarkdown";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize, lineHeight } from "../../theme/typography";
import { palette } from "../../theme/colors";
import type { UnifiedMessage } from "../../hooks/useConversation";

interface ConversationFeedBubbleProps {
  message: UnifiedMessage;
}

const ConversationFeedBubbleImpl: React.FC<ConversationFeedBubbleProps> = ({
  message,
}) => {
  const { colors, isDark } = useTheme();
  const isUser = message.role === "user";
  const isVoiceAgent =
    message.source === "voice" && message.voiceSpeaker === "agent";

  if (isUser) {
    return (
      <View
        style={[
          styles.bubble,
          styles.bubbleUser,
          { backgroundColor: palette.indigo, borderColor: "transparent" },
        ]}
      >
        <Text style={[styles.bubbleText, { color: palette.white }]} selectable>
          {message.content}
        </Text>
      </View>
    );
  }

  // Assistant (texte ou voice agent)
  return (
    <View>
      <View
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
      </View>
      {isVoiceAgent ? (
        <View
          testID="voice-badge-mic"
          style={[
            styles.voiceBadge,
            { borderColor: colors.borderLight },
          ]}
        >
          <Ionicons
            name="mic-outline"
            size={11}
            color={colors.textTertiary}
          />
          <Text style={[styles.voiceBadgeLabel, { color: colors.textTertiary }]}>
            voix
          </Text>
        </View>
      ) : null}
    </View>
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
