/**
 * SubscriptionScreen — Editorial Premium (avril 2026)
 *
 * Refonte design : hero éditorial, hiérarchie Free/Pro/Expert, ribbons trial,
 * glow or sur Expert, section "Pourquoi DeepSight", trust signals.
 *
 * Logique métier conservée : Stripe checkout (+Apple Pay), trial 7j Pro+Expert,
 * grandfathering legacy, portail Stripe, packs crédits + voice addon.
 */
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { billingApi, ApiError, type BillingCycle } from "@/services/api";
import { OfflineCache, CachePriority } from "@/services/OfflineCache";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { CreditPacksModal } from "@/components/billing";
import VoiceAddonModal from "@/components/voice/VoiceAddonModal";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { PlanType } from "@/constants/config";
import {
  CONVERSION_TRIGGERS,
  normalizePlanId,
  type PlanId,
} from "@/config/planPrivileges";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = "subdued" | "default" | "highlight";

interface PlanConfig {
  id: PlanId;
  label: string;
  taglineFr: string;
  priceMonthly: string;
  priceYearly: string;
  priceRawMonthly: number;
  priceRawYearly: number;
  yearlySavings: string;
  tier: Tier;
  badgeText?: string;
  features: string[];
  highlightFeatures: string[];
  cta: string;
}

const PLANS_CONFIG: PlanConfig[] = [
  {
    id: "free",
    label: "Gratuit",
    taglineFr: "Pour découvrir",
    priceMonthly: "0 €",
    priceYearly: "0 €",
    priceRawMonthly: 0,
    priceRawYearly: 0,
    yearlySavings: "",
    tier: "subdued",
    features: [
      "5 analyses / mois",
      "Vidéos jusqu'à 15 min",
      "Chat IA basique (10/jour)",
      "Flashcards & Quiz",
    ],
    highlightFeatures: [],
    cta: "Plan actuel",
  },
  {
    id: "pro",
    label: "Pro",
    taglineFr: "Pour apprendre sérieusement",
    priceMonthly: "8,99 €/mois",
    priceYearly: "89,90 €/an",
    priceRawMonthly: 8.99,
    priceRawYearly: 89.9,
    yearlySavings: "−17,98 €",
    tier: "default",
    badgeText: "POPULAIRE",
    features: [
      "25 analyses / mois",
      "Vidéos jusqu'à 1 h",
      "Chat IA (25 q/vidéo)",
      "Recherche web (20/mois)",
      "Export PDF + Markdown",
    ],
    highlightFeatures: [
      "Cartes mentales interactives",
      "Fact-check automatique",
      "Voice chat (30 min/mois)",
    ],
    cta: "Choisir Pro",
  },
  {
    id: "expert",
    label: "Expert",
    taglineFr: "Pour les créateurs et chercheurs",
    priceMonthly: "19,99 €/mois",
    priceYearly: "199,90 €/an",
    priceRawMonthly: 19.99,
    priceRawYearly: 199.9,
    yearlySavings: "−39,98 €",
    tier: "highlight",
    badgeText: "RECOMMANDÉ CRÉATEURS",
    features: [
      "100 analyses / mois",
      "Vidéos jusqu'à 4 h",
      "Recherche web (60/mois)",
      "File d'attente prioritaire",
    ],
    highlightFeatures: [
      "Chat IA illimité",
      "Playlists (10 × 20 vidéos)",
      "Voice chat (120 min/mois)",
      "Deep Research + TTS",
    ],
    cta: "Passer Expert",
  },
];

const DIFFERENTIATORS_MOBILE = [
  {
    icon: "shield-checkmark-outline",
    title: "IA 100 % française",
    desc: "Mistral AI · données en Europe · RGPD",
  },
  {
    icon: "search-outline",
    title: "Fact-check automatique",
    desc: "Chaque affirmation vérifiée par sources",
  },
  {
    icon: "school-outline",
    title: "Sources académiques",
    desc: "arXiv, Semantic Scholar, CrossRef",
  },
] as const;

const PLAN_DISPLAY: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  expert: "Expert",
  plus: "Pro",
  starter: "Pro",
  etudiant: "Pro",
  team: "Expert",
};

// ─── Sous-composant : PlanCard ─────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanConfig;
  cycle: BillingCycle;
  isCurrentPlan: boolean;
  userPlanPrice: number;
  onPress: (planId: string) => void;
  loading: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  cycle,
  isCurrentPlan,
  userPlanPrice,
  onPress,
  loading,
  colors,
}) => {
  const displayedPrice =
    cycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const displayedPriceRaw =
    cycle === "yearly" ? plan.priceRawYearly : plan.priceRawMonthly;
  const monthlyEquivalent =
    cycle === "yearly" && plan.priceRawYearly > 0
      ? `${(plan.priceRawYearly / 12).toFixed(2).replace(".", ",")} €/mois`
      : null;

  const isDowngrade =
    !isCurrentPlan && displayedPriceRaw < userPlanPrice && userPlanPrice > 0;
  const isFree = plan.id === "free";
  const isExpert = plan.tier === "highlight";
  const showsTrial = plan.id === "pro" || plan.id === "expert";

  const ctaLabel = isCurrentPlan
    ? "✓ Plan actuel"
    : isDowngrade
      ? "Réduire"
      : plan.cta;

  return (
    <View style={styles.cardWrapper}>
      {/* Glow externe (Expert) */}
      {isExpert && !isCurrentPlan && (
        <LinearGradient
          colors={
            [
              "rgba(200,144,58,0.28)",
              "rgba(155,107,74,0.18)",
              "transparent",
            ] as [string, string, string]
          }
          style={styles.cardGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          pointerEvents="none"
        />
      )}

      <Pressable
        onPress={() => !isCurrentPlan && !isFree && onPress(plan.id)}
        disabled={isCurrentPlan || isFree || loading}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.bgCard,
            borderColor: isCurrentPlan
              ? palette.green
              : isExpert
                ? palette.gold
                : plan.tier === "default"
                  ? palette.blue
                  : colors.border,
            borderWidth: isExpert ? 2 : 1,
          },
          isExpert && styles.cardElevatedExpert,
          pressed && !isCurrentPlan && !isFree && { opacity: 0.92 },
        ]}
      >
        {/* Top ribbon */}
        {showsTrial && !isCurrentPlan ? (
          <LinearGradient
            colors={
              isExpert
                ? ([palette.gold, palette.warmAmber] as [string, string])
                : ([palette.blue, palette.indigo] as [string, string])
            }
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
        ) : plan.badgeText ? (
          <View
            style={[
              styles.ribbonStatic,
              {
                backgroundColor: isExpert
                  ? `${palette.gold}1A`
                  : `${palette.blue}1A`,
                borderBottomColor: isExpert
                  ? `${palette.gold}33`
                  : `${palette.blue}33`,
              },
            ]}
          >
            <Ionicons
              name={isExpert ? "star" : "sparkles"}
              size={12}
              color={isExpert ? palette.gold : palette.blue}
            />
            <Text
              style={[
                styles.ribbonText,
                { color: isExpert ? palette.gold : palette.blue },
              ]}
            >
              {plan.badgeText}
            </Text>
          </View>
        ) : (
          <View style={styles.ribbonSpacer} />
        )}

        <View style={styles.cardBody}>
          {/* Icon + label + tagline */}
          <View style={styles.cardHeaderRow}>
            <LinearGradient
              colors={
                isExpert
                  ? ([palette.gold, palette.warmAmber] as [string, string])
                  : plan.tier === "default"
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
                  isExpert
                    ? "diamond"
                    : plan.tier === "default"
                      ? "star"
                      : "flash"
                }
                size={18}
                color="#fff"
              />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.planLabel, { color: colors.textPrimary }]}>
                {plan.label}
              </Text>
              <Text
                style={[styles.planTagline, { color: colors.textTertiary }]}
              >
                {plan.taglineFr}
              </Text>
            </View>
          </View>

          {/* Prix */}
          <View style={styles.priceBlock}>
            <Text style={[styles.priceText, { color: colors.textPrimary }]}>
              {displayedPrice}
            </Text>
            {monthlyEquivalent && (
              <View style={styles.priceMetaRow}>
                <Text
                  style={[styles.priceSubtext, { color: colors.textTertiary }]}
                >
                  soit {monthlyEquivalent}
                </Text>
                {plan.yearlySavings ? (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>{plan.yearlySavings}</Text>
                  </View>
                ) : null}
              </View>
            )}
            {isFree && (
              <Text
                style={[styles.priceSubtext, { color: colors.textTertiary }]}
              >
                Sans CB · à vie
              </Text>
            )}
          </View>

          {/* Features highlightées */}
          {plan.highlightFeatures.map((f) => (
            <View key={f} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIconBg,
                  {
                    backgroundColor: isExpert
                      ? `${palette.gold}33`
                      : `${palette.blue}33`,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={11}
                  color={isExpert ? palette.gold : palette.blue}
                />
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
          {plan.features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <View
                style={[
                  styles.featureIconBg,
                  { backgroundColor: `${palette.green}26` },
                ]}
              >
                <Ionicons name="checkmark" size={11} color={palette.green} />
              </View>
              <Text
                style={[styles.featureText, { color: colors.textSecondary }]}
              >
                {f}
              </Text>
            </View>
          ))}

          {/* CTA */}
          {!isFree && (
            <View style={{ marginTop: sp.md }}>
              {isCurrentPlan ? (
                <View
                  style={[
                    styles.ctaButton,
                    {
                      backgroundColor: `${palette.green}1A`,
                      borderColor: `${palette.green}40`,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.ctaText, { color: palette.green }]}>
                    {ctaLabel}
                  </Text>
                </View>
              ) : (
                <LinearGradient
                  colors={
                    isExpert
                      ? ([palette.gold, palette.warmAmber] as [string, string])
                      : ([palette.blue, palette.indigo] as [string, string])
                  }
                  style={styles.ctaButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>{ctaLabel}</Text>
                  )}
                </LinearGradient>
              )}
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
};

// ─── Écran principal ───────────────────────────────────────────────────────────

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isOffline = useIsOffline();

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [creditPacksVisible, setCreditPacksVisible] = useState(false);
  const [voiceAddonVisible, setVoiceAddonVisible] = useState(false);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [trialLoading, setTrialLoading] = useState<PlanId | null>(null);

  const userPlanRaw = (user?.plan ?? "free") as PlanType;
  const userPlanNormalized = normalizePlanId(userPlanRaw) as PlanId;
  const userPlanConfig = PLANS_CONFIG.find((p) => p.id === userPlanNormalized);
  const userPlanPrice =
    cycle === "yearly"
      ? (userPlanConfig?.priceRawYearly ?? 0)
      : (userPlanConfig?.priceRawMonthly ?? 0);
  const isPaidUser = userPlanNormalized !== "free";
  const trialAvailable =
    CONVERSION_TRIGGERS.trialEnabled && userPlanNormalized === "free";

  const { data: subStatus } = useQuery({
    queryKey: ["subscription-status"],
    queryFn: async () => {
      const cacheKey = "subscription_status";
      if (isOffline) {
        const cached =
          await OfflineCache.get<
            Awaited<ReturnType<typeof billingApi.getSubscriptionStatus>>
          >(cacheKey);
        return cached ?? null;
      }
      try {
        const result = await billingApi.getSubscriptionStatus();
        await OfflineCache.set(cacheKey, result, {
          priority: CachePriority.NORMAL,
          ttlMinutes: 24 * 60,
          tags: ["billing"],
        });
        return result;
      } catch (err) {
        const cached =
          await OfflineCache.get<
            Awaited<ReturnType<typeof billingApi.getSubscriptionStatus>>
          >(cacheKey);
        if (cached !== null) return cached;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: isOffline ? 0 : 1,
  });

  const handleSubscribe = useCallback(
    async (planId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCheckoutLoading(planId);
      try {
        const { url } = await billingApi.createCheckout(planId, cycle);
        const result = await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: palette.gold,
        });
        if (result.type === "dismiss") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Erreur lors du paiement";
        Alert.alert("Paiement impossible", message, [{ text: "OK" }]);
      } finally {
        setCheckoutLoading(null);
      }
    },
    [cycle],
  );

  const handleStartTrial = useCallback(
    async (planId: PlanId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTrialLoading(planId);
      try {
        const eligibility = await billingApi.checkTrialEligibility(planId);
        if (!eligibility.eligible) {
          Alert.alert(
            "Essai indisponible",
            eligibility.reason ||
              "Vous avez déjà bénéficié d'un essai ou d'un abonnement.",
          );
          return;
        }
        const { checkout_url } = await billingApi.startTrial(planId, cycle);
        await WebBrowser.openBrowserAsync(checkout_url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: palette.gold,
        });
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Impossible de démarrer l'essai";
        Alert.alert("Erreur", message, [{ text: "OK" }]);
      } finally {
        setTrialLoading(null);
      }
    },
    [cycle],
  );

  const handleManageSubscription = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPortalLoading(true);
    try {
      const { url } = await billingApi.getPortalUrl();
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        controlsColor: palette.gold,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible d'ouvrir le portail";
      Alert.alert("Erreur", message, [{ text: "OK" }]);
    } finally {
      setPortalLoading(false);
    }
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="default" density="low" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + sp.lg,
            paddingBottom: 90 + Math.max(insets.bottom, sp.sm),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.eyebrow}>
          <Ionicons name="sparkles" size={11} color={palette.gold} />
          <Text style={styles.eyebrowText}>TARIFS DEEPSIGHT 2026</Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Choisissez votre plan
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          🇫🇷 IA française · Données en Europe · Annulation à tout moment
        </Text>

        {/* ── Plan actuel ── */}
        <View
          style={[
            styles.currentPlanBanner,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.currentPlanLeft}>
            <Ionicons
              name={isPaidUser ? "diamond" : "person-circle-outline"}
              size={20}
              color={isPaidUser ? palette.gold : colors.textSecondary}
            />
            <Text
              style={[styles.currentPlanLabel, { color: colors.textPrimary }]}
            >
              Plan actuel
            </Text>
          </View>
          <View
            style={[
              styles.currentPlanBadge,
              {
                backgroundColor: isPaidUser
                  ? `${palette.gold}22`
                  : colors.bgElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.currentPlanName,
                { color: isPaidUser ? palette.gold : colors.textSecondary },
              ]}
            >
              {PLAN_DISPLAY[userPlanRaw] ??
                PLAN_DISPLAY[userPlanNormalized] ??
                "Gratuit"}
            </Text>
          </View>
        </View>

        {subStatus?.currentPeriodEnd && (
          <Text style={[styles.renewalText, { color: colors.textTertiary }]}>
            Prochain renouvellement :{" "}
            {new Date(subStatus.currentPeriodEnd).toLocaleDateString("fr-FR")}
          </Text>
        )}

        {Platform.OS === "ios" && (
          <View
            style={[
              styles.applePayBanner,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="logo-apple"
              size={16}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.applePayText, { color: colors.textSecondary }]}
            >
              Apple Pay disponible lors du paiement
            </Text>
          </View>
        )}

        {/* ── Toggle mensuel/annuel ── */}
        <View style={styles.toggleContainer}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setCycle("monthly");
            }}
            style={[
              styles.toggleButton,
              cycle === "monthly" && styles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    cycle === "monthly"
                      ? colors.textPrimary
                      : colors.textTertiary,
                },
              ]}
            >
              Mensuel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setCycle("yearly");
            }}
            style={[
              styles.toggleButton,
              cycle === "yearly" && styles.toggleButtonActive,
            ]}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    cycle === "yearly"
                      ? colors.textPrimary
                      : colors.textTertiary,
                },
              ]}
            >
              Annuel
            </Text>
          </Pressable>
          <View style={styles.savingsRibbon}>
            <Text style={styles.savingsRibbonText}>−17 % · 2 mois offerts</Text>
          </View>
        </View>

        {/* ── Cards plans ── */}
        <View style={styles.cardsContainer}>
          {PLANS_CONFIG.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              cycle={cycle}
              isCurrentPlan={plan.id === userPlanNormalized}
              userPlanPrice={userPlanPrice}
              onPress={handleSubscribe}
              loading={checkoutLoading === plan.id}
              colors={colors}
            />
          ))}
        </View>

        {/* ── Trial 7 jours sans CB ── */}
        {trialAvailable && (
          <View style={styles.trialSection}>
            <View style={styles.trialBadge}>
              <Ionicons name="gift" size={12} color={palette.gold} />
              <Text style={styles.trialBadgeText}>SANS CARTE BANCAIRE</Text>
            </View>
            <Text style={[styles.trialTitle, { color: colors.textPrimary }]}>
              Essayez 7 jours gratuit
            </Text>
            <Text style={[styles.trialSub, { color: colors.textTertiary }]}>
              Un seul essai, à vie. Annulable à tout moment.
            </Text>
            <View style={styles.trialButtonsRow}>
              <Pressable
                onPress={() => handleStartTrial("pro")}
                disabled={trialLoading !== null}
                style={({ pressed }) => [
                  styles.trialButton,
                  {
                    borderColor: palette.blue,
                    backgroundColor: `${palette.blue}10`,
                  },
                  pressed && { opacity: 0.85 },
                  trialLoading === "pro" && { opacity: 0.6 },
                ]}
              >
                {trialLoading === "pro" ? (
                  <ActivityIndicator size="small" color={palette.blue} />
                ) : (
                  <>
                    <Ionicons name="star" size={14} color={palette.blue} />
                    <Text
                      style={[styles.trialButtonText, { color: palette.blue }]}
                    >
                      Essai Pro
                    </Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleStartTrial("expert")}
                disabled={trialLoading !== null}
                style={({ pressed }) => [
                  styles.trialButton,
                  {
                    borderColor: palette.gold,
                    backgroundColor: `${palette.gold}10`,
                  },
                  pressed && { opacity: 0.85 },
                  trialLoading === "expert" && { opacity: 0.6 },
                ]}
              >
                {trialLoading === "expert" ? (
                  <ActivityIndicator size="small" color={palette.gold} />
                ) : (
                  <>
                    <Ionicons name="diamond" size={14} color={palette.gold} />
                    <Text
                      style={[styles.trialButtonText, { color: palette.gold }]}
                    >
                      Essai Expert
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Manage subscription (paid users) ── */}
        {isPaidUser && (
          <Pressable
            onPress={handleManageSubscription}
            disabled={portalLoading}
            style={[
              styles.manageButton,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
          >
            {portalLoading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <>
                <Ionicons
                  name="settings-outline"
                  size={16}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.manageButtonText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Gérer mon abonnement
                </Text>
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={colors.textMuted}
                />
              </>
            )}
          </Pressable>
        )}

        {/* ── Pourquoi DeepSight ── */}
        <View style={styles.whySection}>
          <Text style={styles.whyEyebrow}>POURQUOI DEEPSIGHT</Text>
          <Text style={[styles.whyTitle, { color: colors.textPrimary }]}>
            Plus qu'un résumeur. Une plateforme d'analyse.
          </Text>
          <View style={styles.whyGrid}>
            {DIFFERENTIATORS_MOBILE.map((d) => (
              <View
                key={d.title}
                style={[
                  styles.whyCard,
                  {
                    backgroundColor: colors.bgCard,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.whyIconWrap}>
                  <Ionicons
                    name={d.icon as keyof typeof Ionicons.glyphMap}
                    size={20}
                    color={palette.gold}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[styles.whyCardTitle, { color: colors.textPrimary }]}
                  >
                    {d.title}
                  </Text>
                  <Text
                    style={[styles.whyCardDesc, { color: colors.textTertiary }]}
                  >
                    {d.desc}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── Trust signals row ── */}
        <View style={styles.trustRow}>
          <View style={styles.trustItem}>
            <Ionicons name="shield-checkmark" size={14} color={palette.green} />
            <Text style={[styles.trustText, { color: colors.textTertiary }]}>
              Annulation à tout moment
            </Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="refresh" size={14} color={palette.blue} />
            <Text style={[styles.trustText, { color: colors.textTertiary }]}>
              Remboursement 14 jours
            </Text>
          </View>
          <View style={styles.trustItem}>
            <Ionicons name="lock-closed" size={14} color={palette.gold} />
            <Text style={[styles.trustText, { color: colors.textTertiary }]}>
              Paiements Stripe sécurisés
            </Text>
          </View>
        </View>

        {/* ── Packs supplémentaires ── */}
        <View style={[styles.packsSection, { borderTopColor: colors.border }]}>
          <Text
            style={[styles.packsSectionTitle, { color: colors.textPrimary }]}
          >
            Booster votre compte
          </Text>
          <View style={styles.packsRow}>
            <Pressable
              onPress={() => setCreditPacksVisible(true)}
              style={({ pressed }) => [
                styles.packCard,
                {
                  backgroundColor: colors.bgElevated,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name="sparkles-outline"
                size={24}
                color={palette.amber}
              />
              <Text
                style={[styles.packCardTitle, { color: colors.textPrimary }]}
              >
                Crédits
              </Text>
              <Text
                style={[styles.packCardSub, { color: colors.textSecondary }]}
              >
                Analyses extra
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setVoiceAddonVisible(true)}
              style={({ pressed }) => [
                styles.packCard,
                {
                  backgroundColor: colors.bgElevated,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons name="mic-outline" size={24} color={palette.indigo} />
              <Text
                style={[styles.packCardTitle, { color: colors.textPrimary }]}
              >
                Minutes vocales
              </Text>
              <Text
                style={[styles.packCardSub, { color: colors.textSecondary }]}
              >
                ElevenLabs
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ── Footer légal ── */}
        <Text style={[styles.legalText, { color: colors.textMuted }]}>
          Les abonnements se renouvellent automatiquement. Annulable à tout
          moment
          {Platform.OS === "ios"
            ? " depuis les Réglages iOS ou le portail Stripe."
            : " depuis le portail Stripe."}
          {"\n"}Paiement sécurisé par Stripe · Données hébergées en Europe.
        </Text>
      </ScrollView>

      <CreditPacksModal
        visible={creditPacksVisible}
        onClose={() => setCreditPacksVisible(false)}
      />
      <VoiceAddonModal
        visible={voiceAddonVisible}
        onClose={() => setVoiceAddonVisible(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: sp.lg },

  // Hero
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: `${palette.gold}1A`,
    borderColor: `${palette.gold}33`,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginBottom: sp.sm,
  },
  eyebrowText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: palette.gold,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["3xl"],
    marginBottom: sp.xs,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginBottom: sp.xl,
  },

  // Current plan
  currentPlanBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: sp.sm,
  },
  currentPlanLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  currentPlanLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  currentPlanBadge: {
    paddingVertical: 4,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
  },
  currentPlanName: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  renewalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.md,
    textAlign: "center",
  },

  // Apple Pay
  applePayBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    padding: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: sp.lg,
  },
  applePayText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    flex: 1,
  },

  // Toggle
  toggleContainer: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: sp.md,
  },
  toggleButton: {
    paddingVertical: sp.xs + 2,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.full,
  },
  toggleButtonActive: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
  },
  toggleText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  savingsRibbon: {
    backgroundColor: `${palette.green}22`,
    borderColor: `${palette.green}40`,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    marginLeft: 4,
  },
  savingsRibbonText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: palette.green,
    letterSpacing: 0.4,
  },

  // Cards
  cardsContainer: { gap: sp.md, marginBottom: sp.xl },
  cardWrapper: { position: "relative" },
  cardGlow: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: borderRadius.xl + 8,
    opacity: 0.6,
  },
  card: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
  },
  cardElevatedExpert: {
    shadowColor: palette.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },

  // Ribbon
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

  // Card body
  cardBody: { padding: sp.lg, gap: sp.sm },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.xs,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  planLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    letterSpacing: -0.3,
  },
  planTagline: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
    marginTop: 1,
  },

  priceBlock: { marginBottom: sp.xs },
  priceText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xl"],
    letterSpacing: -0.5,
  },
  priceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    marginTop: 2,
  },
  priceSubtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  savingsBadge: {
    backgroundColor: `${palette.green}22`,
    borderColor: `${palette.green}40`,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
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
    gap: 10,
    paddingVertical: 3,
  },
  featureIconBg: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
  ctaButton: {
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

  // Trial
  trialSection: {
    alignItems: "center",
    marginBottom: sp.xl,
    gap: 6,
    paddingHorizontal: sp.md,
    paddingVertical: sp.lg,
    backgroundColor: "rgba(200,144,58,0.04)",
    borderColor: "rgba(200,144,58,0.20)",
    borderWidth: 1,
    borderRadius: borderRadius.xl,
  },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${palette.gold}1A`,
    borderColor: `${palette.gold}33`,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
  },
  trialBadgeText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: palette.gold,
    letterSpacing: 1,
  },
  trialTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    textAlign: "center",
  },
  trialSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: "center",
    marginBottom: sp.sm,
  },
  trialButtonsRow: {
    flexDirection: "row",
    gap: sp.md,
    width: "100%",
  },
  trialButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  trialButtonText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  // Manage
  manageButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: sp.xl,
  },
  manageButtonText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    flex: 1,
    textAlign: "center",
  },

  // Why section
  whySection: {
    marginTop: sp.lg,
    marginBottom: sp.xl,
  },
  whyEyebrow: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: palette.gold,
    letterSpacing: 1.2,
    marginBottom: sp.xs,
    textAlign: "center",
  },
  whyTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    textAlign: "center",
    marginBottom: sp.lg,
    letterSpacing: -0.4,
  },
  whyGrid: { gap: sp.sm },
  whyCard: {
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.md,
  },
  whyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: `${palette.gold}1A`,
    alignItems: "center",
    justifyContent: "center",
  },
  whyCardTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    marginBottom: 2,
  },
  whyCardDesc: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  // Trust row
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: sp.md,
    marginBottom: sp.xl,
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  // Packs section
  packsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: sp.xl,
    marginTop: sp.lg,
    marginBottom: sp.lg,
  },
  packsSectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.md,
  },
  packsRow: {
    flexDirection: "row",
    gap: sp.md,
  },
  packCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: sp.lg,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.lg,
    gap: sp.xs,
  },
  packCardTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    marginTop: sp.xs,
  },
  packCardSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },

  // Legal
  legalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: "center",
    lineHeight: 18,
  },
});
