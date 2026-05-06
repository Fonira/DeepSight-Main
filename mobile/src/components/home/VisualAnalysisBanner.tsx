/**
 * VisualAnalysisBanner — Card discovery sur Home pour Phase 2 Visual Analysis.
 *
 * Tagline : « Maintenant, DeepSight regarde aussi. »
 * Affichée pour tous les users (CTA upsell pour Free, info pour Pro/Expert).
 *
 * Spec : 01-Projects/DeepSight/Sessions/2026-05-06-visual-analysis-phase-2-spec.md
 */

import React, { useCallback } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuthStore } from "@/stores/authStore";
import { palette } from "@/theme/colors";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

export const VisualAnalysisBanner: React.FC = () => {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const plan = (user?.plan ?? "free").toLowerCase();
  const isPaid = plan === "pro" || plan === "expert";

  const handlePress = useCallback(async () => {
    await Haptics.selectionAsync();
    if (isPaid) {
      // Pro/Expert : redirige vers la page de subscription pour info
      router.push("/(tabs)/subscription");
    } else {
      // Free : upsell vers subscription
      router.push("/(tabs)/subscription");
    }
  }, [isPaid]);

  const handleLearnMore = useCallback(async () => {
    await Haptics.selectionAsync();
    await Linking.openURL("https://www.deepsightsynthesis.com/#features");
  }, []);

  const ctaLabel = isPaid ? "Voir mon plan" : "Passer Pro";
  const subtitle = isPaid
    ? "Hooks visuels, B-roll, CTAs détectés. Inclus dans ton plan."
    : "Hooks visuels, B-roll, CTAs détectés. Disponible dès Pro.";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surfaceElevated ?? colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>👁️</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>NOUVEAU · PHASE 2</Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]}>
          Maintenant, DeepSight regarde aussi.
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
              styles.ctaPrimary,
              { backgroundColor: palette.violet, opacity: pressed ? 0.85 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
            <Ionicons name="arrow-forward" size={16} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleLearnMore}
            style={({ pressed }) => [
              styles.ctaSecondary,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="En savoir plus"
          >
            <Text style={[styles.ctaSecondaryText, { color: colors.text }]}>
              En savoir plus
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: sp(4),
    marginVertical: sp(3),
  },
  card: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: sp(4),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: sp(3),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 22,
  },
  badge: {
    paddingHorizontal: sp(2),
    paddingVertical: sp(1),
    borderRadius: borderRadius.sm,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.3)",
  },
  badgeText: {
    fontFamily: fontFamily.medium,
    fontSize: 10,
    color: palette.violet,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.lg,
    lineHeight: 24,
    marginBottom: sp(2),
  },
  subtitle: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: sp(4),
  },
  actions: {
    flexDirection: "row",
    gap: sp(2),
  },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp(1.5),
    paddingHorizontal: sp(3.5),
    paddingVertical: sp(2.5),
    borderRadius: borderRadius.md,
  },
  ctaPrimaryText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.sm,
    color: "#fff",
  },
  ctaSecondary: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp(3.5),
    paddingVertical: sp(2.5),
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  ctaSecondaryText: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.sm,
  },
});
