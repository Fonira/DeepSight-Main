/**
 * SubscriptionScreen — Abonnement DeepSight
 *
 * Affiche les plans disponibles, le plan actuel de l'utilisateur,
 * et permet de souscrire via Stripe Checkout (+ Apple Pay natif sur iOS)
 * ou de gérer son abonnement via le portail Stripe.
 *
 * Apple Pay fonctionne automatiquement via le Stripe Checkout Web
 * lorsqu'on ouvre l'URL dans expo-web-browser sur iOS.
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

interface PlanConfig {
  id: PlanId; // ID backend v2 (free | pro | expert)
  label: string; // Nom affiché
  priceMonthly: string; // Ex: "8,99 €/mois"
  priceYearly: string; // Ex: "89,90 €/an"
  priceRawMonthly: number; // Pour tri / downgrade detection
  priceRawYearly: number;
  highlight: boolean; // Mise en avant (plan recommandé)
  badge?: string; // Ex: "Populaire"
  color: string[]; // Gradient
  features: string[];
  cta: string; // Texte du bouton
}

// Plans statiques v2 — toujours disponibles même sans réseau.
// Aligné avec mobile/src/config/planPrivileges.ts (PLANS_INFO)
// et backend/src/billing/plan_config.py (SSOT).
const PLANS_CONFIG: PlanConfig[] = [
  {
    id: "free",
    label: "Gratuit",
    priceMonthly: "0 €",
    priceYearly: "0 €",
    priceRawMonthly: 0,
    priceRawYearly: 0,
    highlight: false,
    color: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"],
    features: [
      "5 analyses / mois",
      "Vidéos jusqu'à 15 min",
      "Historique 60 jours",
      "Chat limité (10/jour)",
    ],
    cta: "Plan actuel",
  },
  {
    // Anciennement "plus" v0 (4,99 €) — voir mémoire pricing v2
    id: "pro",
    label: "Pro",
    priceMonthly: "8,99 €/mois",
    priceYearly: "89,90 €/an",
    priceRawMonthly: 8.99,
    priceRawYearly: 89.9,
    highlight: true,
    badge: "Populaire",
    color: ["rgba(59,130,246,0.20)", "rgba(59,130,246,0.05)"],
    features: [
      "25 analyses / mois",
      "Vidéos jusqu'à 1 h",
      "Mind Maps + Flashcards",
      "Export PDF + Markdown",
      "Voice Chat 30 min/mois",
      "Recherche web (20/mois)",
      "Fact-checking",
    ],
    cta: "Commencer",
  },
  {
    // Anciennement "pro" v0 (9,99 €)
    id: "expert",
    label: "Expert",
    priceMonthly: "19,99 €/mois",
    priceYearly: "199,90 €/an",
    priceRawMonthly: 19.99,
    priceRawYearly: 199.9,
    highlight: false,
    badge: "Le + puissant",
    color: ["rgba(139,92,246,0.25)", "rgba(139,92,246,0.08)"],
    features: [
      "100 analyses / mois",
      "Vidéos jusqu'à 4 h",
      "Playlists (10×20 vidéos)",
      "Voice Chat 120 min/mois",
      "Recherche web (60/mois)",
      "Deep Research + TTS",
      "Support prioritaire",
    ],
    cta: "Passer Expert",
  },
];

// Correspondance ID backend → label affiché
const PLAN_DISPLAY: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  expert: "Expert",
  // Legacy aliases (utilisateurs grandfathered) — affichage fallback
  plus: "Pro",
  starter: "Pro",
  etudiant: "Pro",
  team: "Expert",
};

// ─── Composant PlanCard ────────────────────────────────────────────────────────

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

  const isDowngrade =
    !isCurrentPlan && displayedPriceRaw < userPlanPrice && userPlanPrice > 0;
  const isFree = plan.id === "free";

  const ctaLabel = isCurrentPlan
    ? "✓ Plan actuel"
    : isDowngrade
      ? "Réduire"
      : plan.cta;

  return (
    <Pressable
      onPress={() => !isCurrentPlan && !isFree && onPress(plan.id)}
      disabled={isCurrentPlan || isFree || loading}
      style={({ pressed }) => [
        styles.card,
        plan.highlight && styles.cardHighlight,
        { borderColor: plan.highlight ? palette.violet : colors.border },
        pressed && !isCurrentPlan && !isFree && { opacity: 0.85 },
      ]}
    >
      <LinearGradient
        colors={plan.color as [string, string]}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Badge */}
        {plan.badge && (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: plan.highlight ? palette.violet : palette.blue,
              },
            ]}
          >
            <Text style={styles.badgeText}>{plan.badge}</Text>
          </View>
        )}

        {/* Header plan */}
        <View style={styles.cardHeader}>
          <Text style={[styles.planLabel, { color: colors.textPrimary }]}>
            {plan.label}
          </Text>
          <Text
            style={[
              styles.planPrice,
              { color: isFree ? colors.textSecondary : colors.textPrimary },
            ]}
          >
            {displayedPrice}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresList}>
          {plan.features.map((f) => (
            <View key={f} style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={15}
                color={plan.highlight ? palette.violet : palette.blue}
              />
              <Text
                style={[styles.featureText, { color: colors.textSecondary }]}
              >
                {f}
              </Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        {!isFree && (
          <View
            style={[
              styles.ctaButton,
              {
                backgroundColor: isCurrentPlan
                  ? "rgba(255,255,255,0.08)"
                  : plan.highlight
                    ? palette.violet
                    : palette.blue,
              },
            ]}
          >
            {loading && !isCurrentPlan ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={[
                  styles.ctaText,
                  isCurrentPlan && { color: colors.textMuted },
                ]}
              >
                {ctaLabel}
              </Text>
            )}
          </View>
        )}
      </LinearGradient>
    </Pressable>
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
  // Pricing v2 — toggle mensuel/annuel (default monthly, -17 % sur annuel)
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [trialLoading, setTrialLoading] = useState<PlanId | null>(null);

  const userPlanRaw = (user?.plan ?? "free") as PlanType;
  // Normalize legacy aliases (plus → pro, etc.) pour matcher PLANS_CONFIG v2
  const userPlanNormalized = normalizePlanId(userPlanRaw) as PlanId;
  const userPlanConfig = PLANS_CONFIG.find(
    (p) => p.id === userPlanNormalized,
  );
  const userPlanPrice =
    cycle === "yearly"
      ? (userPlanConfig?.priceRawYearly ?? 0)
      : (userPlanConfig?.priceRawMonthly ?? 0);
  const isPaidUser = userPlanNormalized !== "free";
  const trialAvailable =
    CONVERSION_TRIGGERS.trialEnabled && userPlanNormalized === "free";

  // Statut abonnement depuis le backend (avec cache offline)
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
        // Cache billing status for read-only offline display (NORMAL priority, 1-day TTL)
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

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSubscribe = useCallback(
    async (planId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCheckoutLoading(planId);
      try {
        // 🆕 Pricing v2 : envoie {plan, cycle} au backend
        const { url } = await billingApi.createCheckout(planId, cycle);
        // Stripe Checkout sur iOS gère Apple Pay nativement dans le WebBrowser
        const result = await WebBrowser.openBrowserAsync(url, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          controlsColor: "#8b5cf6",
        });
        // Si l'utilisateur a complété le paiement, on invalide le cache plan
        if (result.type === "dismiss") {
          // Le plan se mettra à jour via le prochain refresh de l'AuthContext
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
        // Vérifier l'éligibilité (defensive — backend re-vérifie aussi)
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
          controlsColor: "#8b5cf6",
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
        controlsColor: "#8b5cf6",
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

  // ── Render ─────────────────────────────────────────────────────────────────

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
        {/* ── Header ── */}
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Abonnement
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          🇫🇷 IA 100% Française — Propulsé par Mistral AI
        </Text>

        {/* ── Plan actuel ── */}
        <View
          style={[
            styles.currentPlanBanner,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
        >
          <View style={styles.currentPlanLeft}>
            <Ionicons name="diamond-outline" size={20} color={palette.violet} />
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
                  ? `${palette.violet}22`
                  : colors.bgElevated,
              },
            ]}
          >
            <Text
              style={[
                styles.currentPlanName,
                { color: isPaidUser ? palette.violet : colors.textSecondary },
              ]}
            >
              {PLAN_DISPLAY[userPlanRaw] ??
                PLAN_DISPLAY[userPlanNormalized] ??
                "Gratuit"}
            </Text>
          </View>
        </View>

        {/* ── Statut renouvellement ── */}
        {subStatus?.currentPeriodEnd && (
          <Text style={[styles.renewalText, { color: colors.textTertiary }]}>
            Prochain renouvellement :{" "}
            {new Date(subStatus.currentPeriodEnd).toLocaleDateString("fr-FR")}
          </Text>
        )}

        {/* ── Apple Pay info (iOS only) ── */}
        {Platform.OS === "ios" && (
          <View
            style={[
              styles.applePayBanner,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name="logo-apple"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.applePayText, { color: colors.textSecondary }]}
            >
              Apple Pay disponible lors du paiement
            </Text>
          </View>
        )}

        {/* ── Toggle mensuel/annuel (Pricing v2) ── */}
        <View style={styles.toggleContainer}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              setCycle("monthly");
            }}
            style={[
              styles.toggleButton,
              cycle === "monthly" && { backgroundColor: palette.violet },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: cycle === "monthly" }}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    cycle === "monthly" ? "#ffffff" : colors.textSecondary,
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
              cycle === "yearly" && { backgroundColor: palette.violet },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: cycle === "yearly" }}
          >
            <Text
              style={[
                styles.toggleText,
                {
                  color:
                    cycle === "yearly" ? "#ffffff" : colors.textSecondary,
                },
              ]}
            >
              Annuel
            </Text>
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>-17%</Text>
            </View>
          </Pressable>
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

        {/* ── CTA Trial 7j sans CB (Sprint B H5 — user free seulement) ── */}
        {trialAvailable && (
          <View style={styles.trialSection}>
            <Text
              style={[styles.trialTitle, { color: colors.textPrimary }]}
            >
              Essayez 7 jours gratuit, sans carte bancaire
            </Text>
            <View style={styles.trialButtonsRow}>
              <Pressable
                onPress={() => handleStartTrial("pro")}
                disabled={trialLoading !== null}
                style={({ pressed }) => [
                  styles.trialButton,
                  { borderColor: palette.blue },
                  pressed && { opacity: 0.85 },
                  trialLoading === "pro" && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Essayer Pro 7 jours gratuit"
              >
                {trialLoading === "pro" ? (
                  <ActivityIndicator size="small" color={palette.blue} />
                ) : (
                  <>
                    <Ionicons
                      name="gift-outline"
                      size={16}
                      color={palette.blue}
                    />
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
                  { borderColor: palette.violet },
                  pressed && { opacity: 0.85 },
                  trialLoading === "expert" && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Essayer Expert 7 jours gratuit"
              >
                {trialLoading === "expert" ? (
                  <ActivityIndicator size="small" color={palette.violet} />
                ) : (
                  <>
                    <Ionicons
                      name="gift-outline"
                      size={16}
                      color={palette.violet}
                    />
                    <Text
                      style={[
                        styles.trialButtonText,
                        { color: palette.violet },
                      ]}
                    >
                      Essai Expert
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Gérer l'abonnement (utilisateurs payants) ── */}
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
              accessibilityRole="button"
              accessibilityLabel="Acheter des crédits supplémentaires"
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
              accessibilityRole="button"
              accessibilityLabel="Acheter des minutes vocales"
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

      {/* Purchase modals */}
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

  // Header
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["3xl"],
    marginBottom: sp.xs,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginBottom: sp.xl,
  },

  // Current plan banner
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

  // Renewal
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
    padding: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: sp.lg,
  },
  applePayText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    flex: 1,
  },

  // Toggle mensuel/annuel (Pricing v2)
  toggleContainer: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: borderRadius.full,
    padding: 4,
    marginBottom: sp.md,
    gap: 4,
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    paddingVertical: sp.xs,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.full,
  },
  toggleText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  discountBadge: {
    backgroundColor: "#10b981",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  discountText: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize["2xs"],
    color: "#ffffff",
  },

  // Trial section (Sprint B H5)
  trialSection: {
    alignItems: "center",
    marginBottom: sp.xl,
    gap: sp.md,
  },
  trialTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    textAlign: "center",
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
    gap: sp.xs,
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  trialButtonText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },

  // Cards
  cardsContainer: { gap: sp.md, marginBottom: sp.xl },
  card: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHighlight: {
    borderWidth: 1.5,
  },
  cardGradient: {
    padding: sp.lg,
    gap: sp.md,
    position: "relative",
  },

  // Badge
  badge: {
    position: "absolute",
    top: sp.md,
    right: sp.md,
    paddingVertical: 3,
    paddingHorizontal: sp.sm,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xs"],
    color: "#ffffff",
  },

  // Plan header
  cardHeader: { gap: 2 },
  planLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  planPrice: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xl"],
  },

  // Features
  featuresList: { gap: sp.xs },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  featureText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    flex: 1,
  },

  // CTA
  ctaButton: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    marginTop: sp.xs,
  },
  ctaText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    color: "#ffffff",
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

  // Legal
  legalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: "center",
    lineHeight: 18,
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
});
