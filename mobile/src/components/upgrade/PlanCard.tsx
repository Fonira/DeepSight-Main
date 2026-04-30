/**
 * PlanCard — Editorial Premium (avril 2026)
 *
 * Carte plan utilisée par upgrade.tsx (PagerView swipeable). Aligne avec le
 * langage de subscription.tsx : ribbon trial, glow Expert, hiérarchie via tier,
 * features highlightées, savings annuel.
 */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";

type Tier = "subdued" | "default" | "highlight";

export interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
  tier?: Tier;
  tagline?: string;
  highlightFeatures?: string[];
  yearlySavings?: string;
}

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  onSelect: (planId: string) => void;
  loading?: boolean;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  onSelect,
  loading = false,
}) => {
  const { colors } = useTheme();

  // Inférence du tier si non fourni : id=expert → highlight, popular → default, sinon subdued
  const tier: Tier =
    plan.tier ??
    (plan.id === "expert" ? "highlight" : plan.popular ? "default" : "subdued");
  const isExpert = tier === "highlight";
  const isFree = plan.id === "free";
  const showsTrial = !isFree && !isCurrentPlan;

  const accent = isExpert ? palette.gold : palette.blue;
  const accentSecondary = isExpert ? palette.warmAmber : palette.indigo;

  return (
    <View style={styles.wrapper}>
      {/* Glow externe Expert */}
      {isExpert && !isCurrentPlan && (
        <LinearGradient
          colors={
            [
              "rgba(200,144,58,0.30)",
              "rgba(155,107,74,0.18)",
              "transparent",
            ] as [string, string, string]
          }
          style={styles.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
      )}

      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.bgCard,
            borderColor: isCurrentPlan
              ? palette.green
              : isExpert
                ? palette.gold
                : tier === "default"
                  ? palette.blue
                  : colors.border,
            borderWidth: isExpert ? 2 : 1,
          },
          isExpert && styles.elevatedExpert,
        ]}
      >
        {/* Ribbon top */}
        {showsTrial ? (
          <LinearGradient
            colors={[accent, accentSecondary] as [string, string]}
            style={styles.ribbon}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="gift" size={12} color="#fff" />
            <Text style={styles.ribbonText}>ESSAI 7 JOURS · SANS CB</Text>
          </LinearGradient>
        ) : isCurrentPlan ? (
          <View
            style={[
              styles.ribbonStatic,
              {
                backgroundColor: `${palette.green}20`,
                borderBottomColor: `${palette.green}40`,
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={12} color={palette.green} />
            <Text style={[styles.ribbonText, { color: palette.green }]}>
              VOTRE PLAN ACTUEL
            </Text>
          </View>
        ) : isExpert ? (
          <View
            style={[
              styles.ribbonStatic,
              {
                backgroundColor: `${palette.gold}1A`,
                borderBottomColor: `${palette.gold}33`,
              },
            ]}
          >
            <Ionicons name="star" size={12} color={palette.gold} />
            <Text style={[styles.ribbonText, { color: palette.gold }]}>
              RECOMMANDÉ CRÉATEURS
            </Text>
          </View>
        ) : plan.popular ? (
          <View
            style={[
              styles.ribbonStatic,
              {
                backgroundColor: `${palette.blue}1A`,
                borderBottomColor: `${palette.blue}33`,
              },
            ]}
          >
            <Ionicons name="sparkles" size={12} color={palette.blue} />
            <Text style={[styles.ribbonText, { color: palette.blue }]}>
              POPULAIRE
            </Text>
          </View>
        ) : (
          <View style={styles.ribbonSpacer} />
        )}

        <View style={styles.body}>
          {/* Icon + name + tagline */}
          <View style={styles.headerRow}>
            <LinearGradient
              colors={
                isExpert
                  ? ([palette.gold, palette.warmAmber] as [string, string])
                  : tier === "default"
                    ? ([palette.blue, palette.indigo] as [string, string])
                    : (["rgba(255,255,255,0.10)", "rgba(255,255,255,0.04)"] as [
                        string,
                        string,
                      ])
              }
              style={styles.iconBubble}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name={
                  isExpert ? "diamond" : tier === "default" ? "star" : "flash"
                }
                size={20}
                color="#fff"
              />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planName, { color: colors.textPrimary }]}>
                {plan.name}
              </Text>
              {plan.tagline && (
                <Text style={[styles.tagline, { color: colors.textTertiary }]}>
                  {plan.tagline}
                </Text>
              )}
            </View>
          </View>

          {/* Price */}
          <View style={styles.priceBlock}>
            <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.textPrimary }]}>
                {plan.price}
              </Text>
              <Text style={[styles.period, { color: colors.textTertiary }]}>
                {plan.period}
              </Text>
            </View>
            {plan.yearlySavings && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>{plan.yearlySavings}</Text>
              </View>
            )}
          </View>

          {/* Features highlightées */}
          {(plan.highlightFeatures ?? []).map((f, i) => (
            <View key={`hl-${i}`} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIconBg,
                  { backgroundColor: `${accent}33` },
                ]}
              >
                <Ionicons name="checkmark" size={12} color={accent} />
              </View>
              <Text
                style={[
                  styles.featureText,
                  styles.featureTextHighlight,
                  { color: colors.textPrimary },
                ]}
              >
                {f}
              </Text>
            </View>
          ))}
          {/* Features standards */}
          {plan.features.map((f, i) => (
            <View key={`std-${i}`} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIconBg,
                  { backgroundColor: `${palette.green}26` },
                ]}
              >
                <Ionicons name="checkmark" size={12} color={palette.green} />
              </View>
              <Text
                style={[styles.featureText, { color: colors.textSecondary }]}
              >
                {f}
              </Text>
            </View>
          ))}

          {/* CTA */}
          <View style={styles.ctaContainer}>
            {isCurrentPlan ? (
              <View
                style={[
                  styles.cta,
                  {
                    backgroundColor: `${palette.green}1A`,
                    borderColor: `${palette.green}40`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[styles.ctaText, { color: palette.green }]}>
                  ✓ Plan actuel
                </Text>
              </View>
            ) : (
              <Pressable
                onPress={() => onSelect(plan.id)}
                disabled={loading}
                style={({ pressed }) => [pressed && { opacity: 0.9 }]}
              >
                <LinearGradient
                  colors={[accent, accentSecondary] as [string, string]}
                  style={styles.cta}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>Choisir ce plan</Text>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: "100%",
    position: "relative",
  },
  glow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: borderRadius.xl + 10,
    opacity: 0.6,
  },
  card: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  elevatedExpert: {
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },

  // Ribbons
  ribbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  ribbonStatic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  ribbonText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: "#fff",
    letterSpacing: 1,
  },
  ribbonSpacer: { height: 0 },

  // Body
  body: {
    flex: 1,
    padding: sp.lg,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
    marginBottom: sp.lg,
  },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  planName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize["2xl"],
    letterSpacing: -0.4,
  },
  tagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },

  // Price
  priceBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.lg,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xl"],
  },
  period: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginLeft: sp.xs,
  },
  savingsBadge: {
    backgroundColor: `${palette.green}22`,
    borderColor: `${palette.green}40`,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  savingsText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: palette.green,
  },

  // Features
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.sm,
  },
  featureIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    flex: 1,
  },
  featureTextHighlight: {
    fontFamily: fontFamily.bodyMedium,
  },

  // CTA
  ctaContainer: {
    marginTop: "auto" as const,
    paddingTop: sp.md,
  },
  cta: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: "#fff",
  },
});

export default PlanCard;
