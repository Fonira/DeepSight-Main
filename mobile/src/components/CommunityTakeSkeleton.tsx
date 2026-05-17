/**
 * DEEP SIGHT — CommunityTakeSkeleton (Mobile)
 *
 * Placeholder pendant que le pipeline v6 génère le verdict communauté.
 * Réservé pour les futurs contextes où le rendu serait progressif (V2).
 * Non utilisé pour V1 mais exporté pour discoverability.
 */

import React from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { sp, borderRadius } from "../theme/spacing";

export const CommunityTakeSkeleton: React.FC = () => {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 900 }), -1, true);
  }, [opacity]);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.container,
        animStyle,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
      testID="community-take-skeleton-mobile"
    >
      <View style={styles.header}>
        <View
          style={[styles.iconBubble, { backgroundColor: colors.borderLight }]}
        />
        <View style={styles.headerText}>
          <View
            style={[styles.lineMd, { backgroundColor: colors.borderLight }]}
          />
          <View
            style={[styles.lineSm, { backgroundColor: colors.borderLight }]}
          />
        </View>
        <View style={[styles.badge, { backgroundColor: colors.borderLight }]} />
      </View>
      <View style={[styles.lineFull, { backgroundColor: colors.borderLight }]} />
      <View
        style={[styles.lineFullSmall, { backgroundColor: colors.borderLight }]}
      />
      <View
        style={[styles.lineFullMid, { backgroundColor: colors.borderLight }]}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: sp.lg,
    marginVertical: sp.md,
    padding: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: sp.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginBottom: sp.sm,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  lineMd: {
    width: "60%",
    height: 14,
    borderRadius: 4,
  },
  lineSm: {
    width: "40%",
    height: 10,
    borderRadius: 4,
  },
  badge: {
    width: 80,
    height: 22,
    borderRadius: borderRadius.full,
  },
  lineFull: {
    width: "100%",
    height: 12,
    borderRadius: 4,
  },
  lineFullSmall: {
    width: "85%",
    height: 12,
    borderRadius: 4,
  },
  lineFullMid: {
    width: "65%",
    height: 12,
    borderRadius: 4,
  },
});

export default CommunityTakeSkeleton;
