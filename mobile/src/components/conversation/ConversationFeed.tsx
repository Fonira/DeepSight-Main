/**
 * ConversationFeed — FlatList inverted des UnifiedMessage[].
 *
 * Affiche le fil unifié chat + voice agent. Empty state = chips de questions
 * suggérées (3 prédéfinies, repris de QuickChatScreen).
 *
 * Le tri ascending par timestamp est fait en amont par `useConversation`.
 * On `reverse()` ici pour la FlatList inverted (newest at bottom).
 */

import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";
import { ConversationFeedBubble } from "./ConversationFeedBubble";
import { EmptyConversationSuggestions } from "./EmptyConversationSuggestions";
import type { UnifiedMessage } from "../../hooks/useConversation";

const SUGGESTED_QUESTIONS = [
  "Résume en 3 points clés",
  "Quels sont les arguments principaux ?",
  "C'est fiable ? Quelles sources ?",
];

interface ConversationFeedProps {
  messages: UnifiedMessage[];
  isLoading: boolean;
  onSuggestionPress: (question: string) => void;
}

const TypingDots: React.FC = () => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    dot1.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 300 }),
        withTiming(0, { duration: 300 }),
      ),
      -1,
      true,
    );
    const t1 = setTimeout(() => {
      dot2.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        true,
      );
    }, 150);
    const t2 = setTimeout(() => {
      dot3.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        true,
      );
    }, 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));
  const s3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.typingContainer}>
      <Animated.View
        style={[styles.typingDot, { backgroundColor: palette.indigo }, s1]}
      />
      <Animated.View
        style={[styles.typingDot, { backgroundColor: palette.indigo }, s2]}
      />
      <Animated.View
        style={[styles.typingDot, { backgroundColor: palette.indigo }, s3]}
      />
    </View>
  );
};

export const ConversationFeed: React.FC<ConversationFeedProps> = ({
  messages,
  isLoading,
  onSuggestionPress,
}) => {
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item }: { item: UnifiedMessage }) => (
      <ConversationFeedBubble message={item} />
    ),
    [],
  );

  const keyExtractor = useCallback((item: UnifiedMessage) => item.id, []);

  const hasMessages = messages.length > 0 || isLoading;

  if (!hasMessages) {
    return (
      <View style={styles.welcomeContainer}>
        <DeepSightSpinner size="lg" />
        <Text style={[styles.welcomeTitle, { color: colors.textPrimary }]}>
          Conversation
        </Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.textTertiary }]}>
          Pose une question sur cette vidéo...
        </Text>
        <EmptyConversationSuggestions onSelect={onSuggestionPress} />
      </View>
    );
  }

  // Reverse pour FlatList inverted (le plus récent en bas).
  // Spread pour ne pas muter le tableau parent (mémoïsé par useConversation).
  const reversed = [...messages].reverse();

  return (
    <View style={styles.flex}>
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
              onPress={() => onSuggestionPress(q)}
              style={[
                styles.suggestionChip,
                { borderColor: palette.cyan + "4D" },
              ]}
              accessibilityLabel={q}
            >
              <Text style={[styles.suggestionText, { color: palette.cyan }]}>
                {q}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <FlatList
        data={reversed}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        inverted
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === "android"}
      />
      {isLoading && (
        <View
          style={[
            styles.bubble,
            styles.bubbleAssistant,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
              marginLeft: sp.lg,
            },
          ]}
        >
          <TypingDots />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  // Welcome
  welcomeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp["2xl"],
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
    textAlign: "center",
  },
  // Suggestions
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
    alignItems: "center",
  },
  suggestionChip: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  suggestionText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  // List
  listContent: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    marginBottom: sp.sm,
    borderWidth: 1,
  },
  bubbleAssistant: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: borderRadius.sm,
  },
  typingContainer: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

export default ConversationFeed;
