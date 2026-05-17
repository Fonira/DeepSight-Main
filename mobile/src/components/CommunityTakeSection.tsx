/**
 * DEEP SIGHT — CommunityTakeSection (Mobile)
 *
 * Verdict communauté : synthèse Mistral du scrape commentaires YouTube/TikTok.
 * Spec : docs/superpowers/specs/2026-05-17-comments-community-take.md §7.2
 *
 * Insertion : tab Résumé (PagerView index 0) de `app/(tabs)/analysis/[id].tsx`,
 * passé comme `footer` à `<AnalysisContentDisplay />` pour scroller avec le contenu.
 *
 * Gating mobile :
 *  - free   → <CommunityTakeUpgradeCTAMobile />
 *  - pro    → vue principale (3 voix, 3 controversies, pas de sentiment bar)
 *  - expert → +5 voix +5 controversies
 *
 * Empty states : disabled / insufficient_data → carte légère.
 */

import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { usePlan } from "../hooks/usePlan";
import { sp, borderRadius } from "../theme/spacing";
import { fontFamily, fontSize } from "../theme/typography";
import { canAccess } from "../config/planPrivileges";
import type {
  CommunityTake,
  CommunityAgreementSignal,
  CommunityTopVoice,
} from "../types";
import { CommunityTakeUpgradeCTAMobile } from "./CommunityTakeUpgradeCTAMobile";

interface Props {
  take: CommunityTake | null | undefined;
  language: "fr" | "en";
  onUpgradeClick?: () => void;
}

type SignalMeta = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  labelFr: string;
  labelEn: string;
};

const SIGNAL_META: Record<CommunityAgreementSignal, SignalMeta> = {
  agree: {
    icon: "thumbs-up-outline",
    color: "#10b981",
    labelFr: "Plutôt d'accord",
    labelEn: "Mostly agree",
  },
  disagree: {
    icon: "thumbs-down-outline",
    color: "#f43f5e",
    labelFr: "Plutôt en désaccord",
    labelEn: "Mostly disagree",
  },
  mixed: {
    icon: "remove-outline",
    color: "#f59e0b",
    labelFr: "Communauté divisée",
    labelEn: "Mixed reactions",
  },
  unclear: {
    icon: "help-circle-outline",
    color: "#94a3b8",
    labelFr: "Signal incertain",
    labelEn: "Unclear signal",
  },
};

const STANCE_META: Record<
  CommunityTopVoice["stance"],
  { icon: keyof typeof Ionicons.glyphMap; color: string; labelFr: string; labelEn: string }
> = {
  agree: {
    icon: "thumbs-up-outline",
    color: "#10b981",
    labelFr: "D'accord",
    labelEn: "Agree",
  },
  disagree: {
    icon: "thumbs-down-outline",
    color: "#f43f5e",
    labelFr: "En désaccord",
    labelEn: "Disagree",
  },
  neutral: {
    icon: "remove-outline",
    color: "#94a3b8",
    labelFr: "Neutre",
    labelEn: "Neutral",
  },
  question: {
    icon: "help-circle-outline",
    color: "#f59e0b",
    labelFr: "Question",
    labelEn: "Question",
  },
};

const formatLikes = (n: number, language: "fr" | "en"): string => {
  if (n < 1000) return n.toLocaleString(language === "fr" ? "fr-FR" : "en-US");
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
};

export const CommunityTakeSection: React.FC<Props> = ({
  take,
  language,
  onUpgradeClick,
}) => {
  const { colors } = useTheme();
  const { plan } = usePlan();
  const isAllowed = canAccess(plan, "community_take", "mobile");

  if (!isAllowed) {
    return (
      <CommunityTakeUpgradeCTAMobile
        language={language}
        onUpgradeClick={onUpgradeClick}
      />
    );
  }

  if (!take) return null;

  if (take.disabled || take.insufficient_data) {
    return (
      <View
        style={[
          styles.container,
          styles.emptyContainer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="community-take-empty-mobile"
      >
        <View style={styles.emptyHeader}>
          <Ionicons
            name={take.disabled ? "chatbubble-ellipses-outline" : "people-outline"}
            size={18}
            color={colors.textTertiary}
          />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
            {language === "fr" ? "Verdict communauté" : "Community verdict"}
          </Text>
        </View>
        <Text style={[styles.emptyMessage, { color: colors.textTertiary }]}>
          {take.disabled
            ? language === "fr"
              ? "Les commentaires sont désactivés sur cette vidéo."
              : "Comments are disabled on this video."
            : language === "fr"
              ? `Trop peu de commentaires (${take.comments_analyzed}) pour un verdict fiable.`
              : `Too few comments (${take.comments_analyzed}) for a reliable verdict.`}
        </Text>
      </View>
    );
  }

  const meta = SIGNAL_META[take.agreement_signal] ?? SIGNAL_META.unclear;
  const signalLabel = language === "fr" ? meta.labelFr : meta.labelEn;
  const isExpert = plan === "expert";
  const maxVoices = isExpert ? 5 : 3;
  const maxControversies = isExpert ? 5 : 3;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.accentSecondary + "33" },
      ]}
      testID="community-take-section-mobile"
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconBubble,
            { backgroundColor: colors.accentSecondary + "22" },
          ]}
        >
          <Ionicons name="people-outline" size={20} color={colors.accentSecondary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {language === "fr" ? "Verdict communauté" : "Community verdict"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {language === "fr"
              ? `Analyse de ${take.comments_analyzed} commentaires`
              : `Analysis of ${take.comments_analyzed} comments`}
          </Text>
        </View>
        <View
          style={[
            styles.signalBadge,
            { backgroundColor: meta.color + "22", borderColor: meta.color + "44" },
          ]}
          testID="community-signal-badge-mobile"
        >
          <Ionicons name={meta.icon} size={12} color={meta.color} />
          <Text style={[styles.signalLabel, { color: meta.color }]}>
            {signalLabel}
          </Text>
        </View>
      </View>

      {/* Summary */}
      <Text style={[styles.summary, { color: colors.textPrimary }]}>
        {take.community_summary}
      </Text>

      {/* Sentiment bar (Expert) */}
      {isExpert && (
        <View style={styles.sentimentSection} testID="community-sentiment-bar-mobile">
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {language === "fr" ? "TONALITÉ" : "SENTIMENT"}
          </Text>
          <View style={styles.sentimentBar}>
            {take.sentiment_distribution.positive > 0 && (
              <View
                style={{
                  flex: take.sentiment_distribution.positive,
                  backgroundColor: "#10b981",
                }}
              />
            )}
            {take.sentiment_distribution.neutral > 0 && (
              <View
                style={{
                  flex: take.sentiment_distribution.neutral,
                  backgroundColor: "#64748b",
                }}
              />
            )}
            {take.sentiment_distribution.negative > 0 && (
              <View
                style={{
                  flex: take.sentiment_distribution.negative,
                  backgroundColor: "#f43f5e",
                }}
              />
            )}
          </View>
          <View style={styles.sentimentLegend}>
            <Text style={[styles.sentimentLegendItem, { color: colors.textMuted }]}>
              {language === "fr" ? "Positif" : "Positive"}{" "}
              {Math.round(take.sentiment_distribution.positive * 100)}%
            </Text>
            <Text style={[styles.sentimentLegendItem, { color: colors.textMuted }]}>
              {language === "fr" ? "Neutre" : "Neutral"}{" "}
              {Math.round(take.sentiment_distribution.neutral * 100)}%
            </Text>
            <Text style={[styles.sentimentLegendItem, { color: colors.textMuted }]}>
              {language === "fr" ? "Négatif" : "Negative"}{" "}
              {Math.round(take.sentiment_distribution.negative * 100)}%
            </Text>
          </View>
        </View>
      )}

      {/* Controversies */}
      {take.controversies && take.controversies.length > 0 && (
        <View style={styles.controversiesSection}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="warning-outline" size={14} color="#f59e0b" />
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {language === "fr"
                ? "POINTS DE DÉSACCORD"
                : "POINTS OF DISAGREEMENT"}
            </Text>
          </View>
          {take.controversies.slice(0, maxControversies).map((c, i) => (
            <View key={i} style={styles.controversyRow}>
              <View style={styles.controversyBullet} />
              <Text
                style={[styles.controversyText, { color: colors.textSecondary }]}
              >
                {c}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Top voices */}
      {take.top_voices && take.top_voices.length > 0 && (
        <View style={styles.voicesSection}>
          <View style={styles.sectionLabelRow}>
            <Ionicons name="chatbubbles-outline" size={14} color={colors.accentSecondary} />
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              {language === "fr" ? "VOIX REPRÉSENTATIVES" : "REPRESENTATIVE VOICES"}
            </Text>
          </View>
          {take.top_voices.slice(0, maxVoices).map((voice, i) => {
            const stanceMeta = STANCE_META[voice.stance] ?? STANCE_META.neutral;
            const stanceLabel = language === "fr" ? stanceMeta.labelFr : stanceMeta.labelEn;
            return (
              <View
                key={`${voice.author}-${i}`}
                style={[styles.voiceCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
                testID="community-top-voice-mobile"
              >
                <View style={styles.voiceHeader}>
                  <Ionicons name={stanceMeta.icon} size={14} color={stanceMeta.color} />
                  <Text style={[styles.voiceAuthor, { color: colors.textSecondary }]}>
                    {voice.author}
                  </Text>
                  <Text style={[styles.voiceMeta, { color: stanceMeta.color }]}>
                    {" · "}{stanceLabel}
                  </Text>
                  {voice.like_count > 0 && (
                    <View style={styles.voiceLikes}>
                      <Ionicons name="heart-outline" size={12} color={colors.textMuted} />
                      <Text style={[styles.voiceLikesText, { color: colors.textMuted }]}>
                        {formatLikes(voice.like_count, language)}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.voiceExcerpt, { color: colors.textPrimary }]}>
                  {voice.excerpt}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          {language === "fr" ? "Généré par " : "Generated by "}
          {take.model_used || "Mistral"}
        </Text>
        {take.is_truncated && (
          <Text style={[styles.footerText, { color: "#f59e0b" }]}>
            {language === "fr" ? "Échantillon partiel" : "Partial sample"}
          </Text>
        )}
      </View>
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
  emptyContainer: {
    padding: sp.md,
  },
  emptyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  emptyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  emptyMessage: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    lineHeight: 18,
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
  signalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: sp.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  signalLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
  },
  summary: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 22,
    marginBottom: sp.md,
  },
  sectionLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    marginBottom: sp.sm,
  },
  sentimentSection: {
    marginBottom: sp.md,
  },
  sentimentBar: {
    flexDirection: "row",
    height: 8,
    borderRadius: borderRadius.full,
    overflow: "hidden",
    marginTop: sp.xs,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  sentimentLegend: {
    flexDirection: "row",
    gap: sp.md,
    marginTop: 6,
  },
  sentimentLegendItem: {
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  controversiesSection: {
    marginTop: sp.md,
  },
  controversyRow: {
    flexDirection: "row",
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  controversyBullet: {
    width: 3,
    backgroundColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: 1.5,
    marginTop: 6,
    height: 16,
  },
  controversyText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  voicesSection: {
    marginTop: sp.md,
  },
  voiceCard: {
    padding: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: sp.sm,
  },
  voiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
    marginBottom: 4,
  },
  voiceAuthor: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
  },
  voiceMeta: {
    fontFamily: fontFamily.body,
    fontSize: 12,
  },
  voiceLikes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginLeft: sp.xs,
  },
  voiceLikesText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
  voiceExcerpt: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingLeft: 20,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: sp.sm,
    marginTop: sp.md,
    borderTopWidth: 1,
  },
  footerText: {
    fontFamily: fontFamily.body,
    fontSize: 11,
  },
});

export default CommunityTakeSection;
