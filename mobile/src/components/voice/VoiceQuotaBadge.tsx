/**
 * VoiceQuotaBadge — Pill showing voice chat minutes remaining.
 *
 * Threshold-based coloring:
 *   >= 20 min → green
 *   5–19 min → amber
 *   <  5 min → red
 *
 * Pressable variant (haptic light feedback) when `onPress` is provided.
 */

import React, { useCallback } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { sp, borderRadius } from "../../theme/spacing";
import { fontSize } from "../../theme/typography";

// ─── Types ─────────────────────────────────────────────────────────────────

interface VoiceQuotaBadgeProps {
  minutesRemaining: number;
  onPress?: () => void;
}

type Tier = "green" | "amber" | "red";

interface TierPalette {
  bg: string;
  text: string;
  icon: string;
}

// ─── Colors (fixed — independent from theme, semantic status) ──────────────

const TIER_PALETTES: Record<Tier, TierPalette> = {
  green: {
    bg: "rgba(34, 197, 94, 0.20)", // #22c55e/20
    text: "#86efac",
    icon: "#86efac",
  },
  amber: {
    bg: "rgba(245, 158, 11, 0.20)", // #f59e0b/20
    text: "#fbbf24",
    icon: "#fbbf24",
  },
  red: {
    bg: "rgba(239, 68, 68, 0.20)", // #ef4444/20
    text: "#fca5a5",
    icon: "#fca5a5",
  },
};

const getTier = (minutes: number): Tier => {
  if (minutes >= 20) return "green";
  if (minutes >= 5) return "amber";
  return "red";
};

// ─── Main component ────────────────────────────────────────────────────────

const VoiceQuotaBadgeInner: React.FC<VoiceQuotaBadgeProps> = ({
  minutesRemaining,
  onPress,
}) => {
  const safeMinutes = Math.max(0, Math.floor(minutesRemaining));
  const tier = getTier(safeMinutes);
  const palette = TIER_PALETTES[tier];

  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
      // Haptics not available on some devices — silently ignore.
    });
    onPress();
  }, [onPress]);

  const content = (
    <>
      <Ionicons
        name="mic-outline"
        size={12}
        color={palette.icon}
        style={styles.iconLeft}
      />
      <Text style={[styles.label, { color: palette.text }]}>
        {safeMinutes} min
      </Text>
      <Ionicons
        name="time-outline"
        size={12}
        color={palette.icon}
        style={styles.iconRight}
      />
    </>
  );

  const containerStyle: ViewStyle = {
    ...styles.container,
    backgroundColor: palette.bg,
  };

  const accessibilityLabel = `${safeMinutes} minutes de chat vocal restantes`;

  if (onPress) {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          containerStyle,
          pressed && styles.containerPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Appuyez pour voir les détails du quota vocal"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      style={containerStyle}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
    >
      {content}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: sp.xs + 2, // 6
    paddingHorizontal: sp.md, // 12
    borderRadius: borderRadius.full,
    alignSelf: "flex-start",
  },
  containerPressed: {
    opacity: 0.7,
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
});

export const VoiceQuotaBadge = React.memo(VoiceQuotaBadgeInner);
VoiceQuotaBadge.displayName = "VoiceQuotaBadge";

export default VoiceQuotaBadge;
