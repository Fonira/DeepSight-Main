/**
 * EmptyConversationSuggestions — 3 chips suggestions cliquables animées
 * affichées dans le ConversationFeed quand `messages.length === 0`.
 *
 * Le main thread Claude intégrera ce composant dans ConversationFeed
 * (côté Agent D ne touche pas au scope empty state) après merge.
 *
 * Design :
 * - Chip = Pressable avec border indigo subtle, fond légèrement teinté
 * - Animation entrée FadeInUp staggered (delay = index * 100ms)
 * - Press scale 0.95 + haptics.light au tap
 *
 * Spec : `docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md`
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { haptics } from "../../utils/haptics";

const DEFAULT_SUGGESTIONS: readonly string[] = [
  "Quels sont les points clés ?",
  "Résume en 3 points",
  "Quelles sources cite la vidéo ?",
] as const;

export interface EmptyConversationSuggestionsProps {
  /** Callback fired when a chip is tapped. The string is the suggestion. */
  onSelect: (suggestion: string) => void;
  /** Optional video title for future contextual suggestions (unused yet). */
  videoTitle?: string;
  /** Override default suggestions (max 4 displayed for vertical density). */
  suggestions?: readonly string[];
}

interface SuggestionChipProps {
  text: string;
  index: number;
  borderColor: string;
  bgColor: string;
  textColor: string;
  onPress: () => void;
}

const SuggestionChip: React.FC<SuggestionChipProps> = ({
  text,
  index,
  borderColor,
  bgColor,
  textColor,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const onPressIn = () => {
    scale.value = withTiming(0.95, { duration: 80 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 240 });
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 100).duration(280)}
      style={animatedStyle}
    >
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        testID={`suggestion-chip-${index}`}
        style={[styles.chip, { borderColor, backgroundColor: bgColor }]}
        accessibilityRole="button"
        accessibilityLabel={`Suggestion : ${text}`}
      >
        <Ionicons name="sparkles-outline" size={14} color={palette.indigo} />
        <Text style={[styles.chipText, { color: textColor }]}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
};

export const EmptyConversationSuggestions: React.FC<
  EmptyConversationSuggestionsProps
> = ({ onSelect, suggestions = DEFAULT_SUGGESTIONS }) => {
  const { colors } = useTheme();

  // Garde les 4 premiers max (densité verticale).
  const items = suggestions.slice(0, 4);

  const handleSelect = (text: string) => {
    haptics.light();
    onSelect(text);
  };

  return (
    <View testID="empty-conversation-suggestions" style={styles.container}>
      <Text style={[styles.heading, { color: colors.textTertiary }]}>
        Suggestions pour démarrer
      </Text>
      <View style={styles.list}>
        {items.map((text, i) => (
          <SuggestionChip
            key={text}
            text={text}
            index={i}
            borderColor={palette.indigo + "40"}
            bgColor={palette.indigo + "15"}
            textColor={colors.textPrimary}
            onPress={() => handleSelect(text)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: sp.lg,
    paddingVertical: sp.lg,
    gap: sp.sm,
  },
  heading: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: sp.xs,
  },
  list: {
    gap: sp.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  chipText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});

export default EmptyConversationSuggestions;
