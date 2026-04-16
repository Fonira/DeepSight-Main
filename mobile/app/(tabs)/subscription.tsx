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
import { billingApi, ApiError } from "@/services/api";
import { OfflineCache, CachePriority } from "@/services/OfflineCache";
import { useIsOffline } from "@/hooks/useNetworkStatus";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import type { PlanType } from "@/constants/config";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanConfig {
  id: string; // ID backend
  label: string; // Nom affiché
  price: string; // Ex: "2,99 €/mois"
  priceRaw: number; // Pour tri
  highlight: boolean; // Mise en avant (plan recommandé)
  badge?: string; // Ex: "Populaire"
  color: string[]; // Gradient
  features: string[];
  cta: string; // Texte du bouton
}

// Plans statiques — toujours disponibles même sans réseau
const PLANS_CONFIG: PlanConfig[] = [
  {
    id: "free",
    label: "Gratuit",
    price: "0 €",
    priceRaw: 0,
    highlight: false,
    color: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"],
    features: [
      "5 analyses / mois",
      "Vidéos jusqu'à 15 min",
      "Historique 60 jours",
      "Chat limité",
    ],
    cta: "Plan actuel",
  },
  {
    id: "etudiant", // ID backend pour "Starter"
    label: "Starter",
    price: "2,99 €/mois",
    priceRaw: 2.99,
    highlight: false,
    color: ["rgba(59,130,246,0.15)", "rgba(59,130,246,0.05)"],
    features: [
      "20 analyses / mois",
      "Flashcards automatiques",
      "Cartes mentales",
      "Historique complet",
    ],
    cta: "Commencer",
  },
  {
    id: "starter", // ID backend pour "Standard"
    label: "Standard",
    price: "5,99 €/mois",
    priceRaw: 5.99,
    highlight: true,
    badge: "Populaire",
    color: ["rgba(139,92,246,0.25)", "rgba(139,92,246,0.08)"],
    features: [
      "50 analyses / mois",
      "Vidéos jusqu'à 2 heures",
      "Recherche web IA",
      "Flashcards + Cartes mentales",
      "Export Markdown",
    ],
    cta: "Commencer",
  },
  {
    id: "pro",
    label: "Pro",
    price: "12,99 €/mois",
    priceRaw: 12.99,
    highlight: false,
    badge: "Tout inclus",
    color: ["rgba(6,182,212,0.15)", "rgba(139,92,246,0.08)"],
    features: [
      "200 analyses / mois",
      "Playlists entières",
      "Chat illimité",
      "Export PDF + DOCX",
      "Recherche web avancée",
      "Support prioritaire",
    ],
    cta: "Passer Pro",
  },
];

// Correspondance ID backend → label
const PLAN_DISPLAY: Record<string, string> = {
  free: "Gratuit",
  etudiant: "Starter",
  starter: "Standard",
  pro: "Pro",
};

// ─── Composant PlanCard ────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: PlanConfig;
  isCurrentPlan: boolean;
  userPlanPrice: number;
  onPress: (planId: string) => void;
  loading: boolean;
  colors: ReturnType<typeof useTheme>["colors"];
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  userPlanPrice,
  onPress,
  loading,
  colors,
}) => {
  const isDowngrade =
    !isCurrentPlan && plan.priceRaw < userPlanPrice && userPlanPrice > 0;
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
            {plan.price}
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

  const userPlan = (user?.plan ?? "free") as PlanType;
  const userPlanConfig = PLANS_CONFIG.find((p) => p.id === userPlan);
  const userPlanPrice = userPlanConfig?.priceRaw ?? 0;
  const isPaidUser = userPlan !== "free";

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

  const handleSubscribe = useCallback(async (planId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCheckoutLoading(planId);
    try {
      const { url } = await billingApi.createCheckout(planId);
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
  }, []);

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
              {PLAN_DISPLAY[userPlan] ?? "Gratuit"}
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

        {/* ── Cards plans ── */}
        <View style={styles.cardsContainer}>
          {PLANS_CONFIG.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrentPlan={plan.id === userPlan}
              userPlanPrice={userPlanPrice}
              onPress={handleSubscribe}
              loading={checkoutLoading === plan.id}
              colors={colors}
            />
          ))}
        </View>

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
});
