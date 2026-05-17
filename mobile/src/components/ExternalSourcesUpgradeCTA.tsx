/**
 * DEEP SIGHT — ExternalSourcesUpgradeCTA (Mobile)
 *
 * CTA discret pour les users free : "Sources externes citées — disponible avec Pro".
 * Tap → navigue vers /(tabs)/subscription (ou handler custom).
 *
 * Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9 (Mobile)
 * Mirror du frontend `ExternalSourcesUpgradeCTA.tsx` (PR #503).
 */

import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "../contexts/ThemeContext";
import { sp, borderRadius } from "../theme/spacing";
import { fontFamily, fontSize } from "../theme/typography";

interface Props {
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

export const ExternalSourcesUpgradeCTA: React.FC<Props> = ({
  language,
  onUpgradeClick,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onUpgradeClick) {
      onUpgradeClick();
    } else {
      router.push("/(tabs)/subscription");
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.accentSecondary + "33",
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      testID="external-sources-upgrade-cta-mobile"
    >
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: colors.accentSecondary + "22" },
        ]}
      >
        <Ionicons name="link-outline" size={18} color={colors.accentSecondary} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === "fr"
              ? "Sources externes citées"
              : "External sources cited"}
          </Text>
          <Ionicons
            name="lock-closed-outline"
            size={12}
            color={colors.textMuted}
          />
        </View>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {language === "fr"
            ? "Mini-résumé de chaque lien cité dans la description — disponible avec Pro"
            : "Mini-summary of each link cited in the description — available with Pro"}
        </Text>
      </View>
      <View style={styles.cta}>
        <Text style={[styles.ctaText, { color: colors.accentSecondary }]}>
          {language === "fr" ? "Passer Pro" : "Upgrade"}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={colors.accentSecondary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginHorizontal: sp.lg,
    marginVertical: sp.md,
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    marginTop: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ctaText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
});

export default ExternalSourcesUpgradeCTA;
