/**
 * HighlightNavigationBar — FAB flottant compteur + nav up/down/close.
 *
 * Apparaît en bas-droite de la page analyse quand `SemanticHighlighter` a des
 * matches. Permet de naviguer entre les matches (next/prev) et de fermer la
 * recherche intra-analyse (clear query).
 */

import React from "react";
import { Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { useHighlightNav } from "./useHighlightNav";

interface HighlightNavigationBarProps {
  bottomOffset?: number;
}

export const HighlightNavigationBar: React.FC<HighlightNavigationBarProps> = ({
  bottomOffset = 80,
}) => {
  const { colors } = useTheme();
  const { total, current, matchesEmpty, next, prev, close } = useHighlightNav();

  if (matchesEmpty) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={[
        styles.bar,
        {
          bottom: bottomOffset,
          backgroundColor: colors.bgElevated,
          borderColor: palette.gold + "40",
        },
      ]}
    >
      <Text style={[styles.counter, { color: colors.textPrimary }]}>
        {current}/{total}
      </Text>
      <Pressable
        onPress={prev}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Match précédent"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-up" size={22} color={palette.gold} />
      </Pressable>
      <Pressable
        onPress={next}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Match suivant"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-down" size={22} color={palette.gold} />
      </Pressable>
      <Pressable
        onPress={close}
        style={styles.btn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Fermer la recherche intra-analyse"
        accessibilityRole="button"
      >
        <Ionicons name="close" size={20} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    right: sp.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  counter: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    minWidth: 36,
    textAlign: "center",
  },
  btn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
