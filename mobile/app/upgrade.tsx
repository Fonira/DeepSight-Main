/**
 * UpgradeScreen — Pricing v2 (Avril 2026)
 *
 * Affiche les plans payants v2 (Pro + Expert) avec :
 *   - Toggle mensuel/annuel (-17 %)
 *   - CTA principal : "Choisir ce plan" → Stripe Checkout (createCheckout v2)
 *   - CTA secondaire : "Essayer 7 jours gratuit" (trial sans CB) si user free + éligible
 *
 * Note : la page (tabs)/subscription.tsx est l'écran principal de gestion d'abo.
 * upgrade.tsx est appelé via deeplink ou depuis les modals d'upgrade contextuels.
 */
import React, { useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import PagerView from "react-native-pager-view";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { billingApi, ApiError, type BillingCycle } from "@/services/api";
import { PlanCard } from "@/components/upgrade/PlanCard";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, textStyles } from "@/theme/typography";
import { DoodleBackground } from "@/components/ui/DoodleBackground";
import {
  PLANS_INFO,
  CONVERSION_TRIGGERS,
  normalizePlanId,
  type PlanId,
} from "@/config/planPrivileges";

// Affichage du plan courant en haut de page
const PLAN_LABELS: Record<string, string> = {
  free: "Gratuit",
  pro: "Pro",
  expert: "Expert",
};

interface UpgradePlanView {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

/**
 * Construit les vues plan pour PagerView depuis PLANS_INFO + cycle.
 * On exclut "free" (cet écran sert à upgrade vers payant).
 */
function buildPlanViews(cycle: BillingCycle): UpgradePlanView[] {
  return PLANS_INFO.filter((p) => p.id !== "free").map((p) => {
    const monthly = p.priceDisplay.fr.replace("/mois", "").trim();
    const yearly = p.priceYearlyDisplay.fr.replace("/an", "").trim();
    return {
      id: p.id,
      name: p.name.fr,
      price: cycle === "yearly" ? yearly : monthly,
      period: cycle === "yearly" ? "/an" : "/mois",
      popular: p.popular,
      features:
        p.id === "pro"
          ? [
              "25 analyses/mois",
              "Vidéos jusqu'à 1 h",
              "Mind Maps + Flashcards",
              "Export PDF + Markdown",
              "Voice Chat 30 min/mois",
              "Recherche web (20/mois)",
              "Fact-checking",
            ]
          : [
              "100 analyses/mois",
              "Vidéos jusqu'à 4 h",
              "Playlists (10×20 vidéos)",
              "Voice Chat 120 min/mois",
              "Recherche web (60/mois)",
              "Deep Research + TTS",
              "Support prioritaire",
            ],
    };
  });
}

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(0);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [trialLoading, setTrialLoading] = useState<PlanId | null>(null);

  const currentPlanRaw = user?.plan ?? "free";
  const currentPlan = normalizePlanId(currentPlanRaw);

  const planViews = useMemo(() => buildPlanViews(cycle), [cycle]);

  // Trial dispo seulement pour user free, sur Pro et Expert (Sprint B H5)
  const trialAvailable =
    CONVERSION_TRIGGERS.trialEnabled && currentPlan === "free";

  const handleSelectPlan = useCallback(
    async (planId: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        // 🆕 Pricing v2 : envoie {plan, cycle}
        const { url } = await billingApi.createCheckout(planId, cycle);
        await WebBrowser.openBrowserAsync(url);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Impossible de créer la session de paiement";
        Alert.alert("Erreur", message);
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
        await WebBrowser.openBrowserAsync(checkout_url);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Impossible de démarrer l'essai";
        Alert.alert("Erreur", message);
      } finally {
        setTrialLoading(null);
      }
    },
    [cycle],
  );

  const activePlan = planViews[activePage];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <DoodleBackground variant="creative" density="low" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + sp.sm }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Passer au niveau supérieur
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Toggle mensuel/annuel */}
      <View style={styles.toggleContainer}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setCycle("monthly");
          }}
          style={[
            styles.toggleButton,
            cycle === "monthly" && {
              backgroundColor: colors.accentPrimary,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: cycle === "monthly" }}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: cycle === "monthly" ? "#ffffff" : colors.textSecondary,
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
            cycle === "yearly" && {
              backgroundColor: colors.accentPrimary,
            },
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: cycle === "yearly" }}
        >
          <Text
            style={[
              styles.toggleText,
              {
                color: cycle === "yearly" ? "#ffffff" : colors.textSecondary,
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

      {/* Pager */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        {planViews.map((plan) => (
          <View key={plan.id} style={styles.pageContainer}>
            <View
              style={[
                styles.cardWrapper,
                { maxWidth: screenWidth - sp.xl * 2 },
              ]}
            >
              <PlanCard
                plan={plan}
                isCurrentPlan={currentPlan === plan.id}
                onSelect={handleSelectPlan}
              />
            </View>
          </View>
        ))}
      </PagerView>

      {/* Dots indicator */}
      <View style={styles.dotsContainer}>
        {planViews.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activePage
                    ? colors.accentPrimary
                    : colors.textMuted,
                width: index === activePage ? 20 : 8,
              },
            ]}
          />
        ))}
      </View>

      {/* CTA Trial 7 j sans CB (Sprint B H5) */}
      {trialAvailable && activePlan && (
        <View style={styles.trialContainer}>
          <Pressable
            onPress={() => handleStartTrial(activePlan.id)}
            disabled={trialLoading === activePlan.id}
            style={({ pressed }) => [
              styles.trialButton,
              { borderColor: colors.accentPrimary },
              pressed && { opacity: 0.85 },
              trialLoading === activePlan.id && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Essayer ${activePlan.name} gratuitement 7 jours`}
          >
            <Ionicons
              name="gift-outline"
              size={18}
              color={colors.accentPrimary}
            />
            <Text style={[styles.trialText, { color: colors.accentPrimary }]}>
              Essai 7 jours gratuit ({activePlan.name}) — sans CB
            </Text>
          </Pressable>
        </View>
      )}

      {/* Current plan */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + sp.lg }]}>
        <Text style={[styles.currentPlanText, { color: colors.textTertiary }]}>
          Plan actuel : {PLAN_LABELS[currentPlan] ?? "Gratuit"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.lg,
    paddingBottom: sp.md,
  },
  backButton: {
    padding: sp.sm,
  },
  headerTitle: {
    ...textStyles.headingMd,
    flex: 1,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40, // même largeur que le bouton retour pour centrer le titre
  },
  // Toggle annuel/mensuel
  toggleContainer: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: borderRadius.full,
    padding: 4,
    marginVertical: sp.md,
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
  pager: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp.xl,
    paddingVertical: sp.lg,
  },
  cardWrapper: {
    flex: 1,
    width: "100%",
  },
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: sp.sm,
    paddingVertical: sp.md,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  // Trial CTA
  trialContainer: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.sm,
    paddingBottom: sp.md,
  },
  trialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    backgroundColor: "rgba(99,102,241,0.08)",
  },
  trialText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: sp.lg,
  },
  currentPlanText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});
