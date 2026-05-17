/**
 * DEEP SIGHT — ExternalSourcesSection (Mobile)
 *
 * Pages externes citées dans la description vidéo (URLs scrapées + résumées
 * par Mistral). Spec : docs/superpowers/specs/2026-05-17-pages-externes-citees.md §9.
 *
 * Insertion : tab Résumé du PagerView dans `app/(tabs)/analysis/[id].tsx`,
 * rendu juste après `<CommunityTakeSection>` dans le `footer` passé à
 * `<AnalysisContentDisplay />`.
 *
 * Gating mobile :
 *  - free   → <ExternalSourcesUpgradeCTA />
 *  - pro    → cards horizontales scrollables (cap 5 pages backend)
 *  - expert → cards horizontales scrollables (cap 10 pages backend)
 *
 * Empty states : `data=null` (rien à afficher, silent), `data.pages.length===0`
 * (idem, silent — pipeline backend retourne null dans ce cas mais on défend).
 *
 * Mirror du frontend `ExternalSourcesSection.tsx` (PR #503).
 */

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { usePlan } from "../hooks/usePlan";
import { sp, borderRadius } from "../theme/spacing";
import { fontFamily, fontSize } from "../theme/typography";
import { canAccess } from "../config/planPrivileges";
import type { ExternalPagesData } from "../types";
import { ExternalSourcesUpgradeCTA } from "./ExternalSourcesUpgradeCTA";
import { ExternalSourceCard } from "./ExternalSourceCard";

interface Props {
  data: ExternalPagesData | null | undefined;
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

export const ExternalSourcesSection: React.FC<Props> = ({
  data,
  language,
  onUpgradeClick,
}) => {
  const { colors } = useTheme();
  const { plan } = usePlan();
  const isAllowed = canAccess(plan, "external_sources", "mobile");

  // Free plan → CTA upgrade (discoverability).
  if (!isAllowed) {
    return (
      <ExternalSourcesUpgradeCTA
        language={language}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  // Pas encore généré ou aucune page exploitable → silent (pipeline asynchrone,
  // peut être null si description vide / aucune URL / toutes les pages ont échoué).
  if (!data || !data.pages || data.pages.length === 0) {
    return null;
  }

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.accentSecondary + "33",
        },
      ]}
      testID="external-sources-section-mobile"
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: colors.accentSecondary + "22" },
          ]}
        >
          <Ionicons name="link-outline" size={20} color={colors.accentSecondary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === "fr"
              ? "Sources externes citées"
              : "External sources cited"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {language === "fr"
              ? `${data.stats.successful}/${data.pages.length} pages traitées`
              : `${data.stats.successful}/${data.pages.length} pages processed`}
          </Text>
        </View>
      </View>

      {/* Cards horizontales scrollables */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="external-sources-scroll-mobile"
      >
        {data.pages.map((page, i) => (
          <ExternalSourceCard
            key={`${page.final_url}-${i}`}
            page={page}
            index={i}
            language={language}
          />
        ))}
      </ScrollView>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: sp.md,
    marginBottom: sp.md,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  scrollContent: {
    paddingRight: sp.lg,
  },
});

export default ExternalSourcesSection;
