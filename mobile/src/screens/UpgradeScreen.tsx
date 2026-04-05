import React, { useState } from 'react';
import { analytics } from '../services/analytics';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useScreenDoodleVariant } from '../contexts/DoodleVariantContext';
import { Header, Card, Badge, Button } from '../components';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { billingApi, ApiError } from '../services/api';
import {
  normalizePlanId, isPlanHigher, comparePlans,
  PLANS_INFO, PLAN_LIMITS, getFeatureListForDisplay,
  DIFFERENTIATORS, CREDIT_PACKS,
  type PlanId,
} from '../config/planPrivileges';

interface PlanWithTranslations {
  id: string;
  name: string;
  price: number;
  period: string;
  credits: number;
  features: string[];
  isPopular?: boolean;
  en: { name: string; features: string[] };
  icon: string;
}

// Dynamique depuis planPrivileges — plus de hardcoding
const PLANS: PlanWithTranslations[] = PLANS_INFO.map((info) => {
  const limits = PLAN_LIMITS[info.id];
  const frFeatures = getFeatureListForDisplay(info.id, 'fr').filter(f => f.included).map(f => f.text);
  const enFeatures = getFeatureListForDisplay(info.id, 'en').filter(f => f.included).map(f => f.text);
  return {
    id: info.id,
    name: info.name.fr,
    price: info.price / 100,
    period: '/mois',
    credits: limits.monthlyCredits,
    icon: info.icon,
    isPopular: info.popular,
    features: frFeatures,
    en: { name: info.name.en, features: enFeatures },
  };
});

// Plan progression order for recommendations
const PLAN_ORDER: PlanId[] = ['free', 'pro', 'expert'];

// Get recommended upgrade path based on current plan
const getRecommendedPlan = (currentPlan: PlanId): PlanId | null => {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex >= PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[currentIndex + 1];
};

export const UpgradeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  useScreenDoodleVariant('creative');

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [packLoading, setPackLoading] = useState<string | null>(null);

  const isEn = language === 'en';
  const currentPlan = normalizePlanId(user?.plan);
  const recommendedPlan = getRecommendedPlan(currentPlan);

  // Check if selected plan is an upgrade or downgrade
  const isUpgrade = selectedPlan ? isPlanHigher(selectedPlan as PlanId, currentPlan) : false;
  const isDowngrade = selectedPlan ? isPlanHigher(currentPlan, selectedPlan as PlanId) : false;

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    Haptics.selectionAsync();
    setSelectedPlan(planId);
    analytics.track('upgrade_plan_selected', { plan: planId, current_plan: currentPlan });
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

    analytics.track('upgrade_checkout_started', { plan: selectedPlan, current_plan: currentPlan });
    setIsLoading(true);
    try {
      // Get checkout URL from backend
      const { url } = await billingApi.createCheckout(selectedPlan);

      if (!url) {
        throw new Error('No checkout URL received');
      }

      // Open Stripe checkout in browser
      const result = await WebBrowser.openBrowserAsync(url, {
        showTitle: true,
        enableBarCollapsing: true,
      });

      // Handle return from browser
      if (result.type === 'cancel') {
        // User cancelled - no action needed
      } else {
        // Refresh user data to get updated plan
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t.success?.generic || 'Succès',
          isEn
            ? 'Payment processing. Your plan will be updated shortly.'
            : 'Paiement en cours. Votre abonnement sera mis à jour sous peu.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : (isEn ? 'Unable to start checkout. Please try again.' : 'Impossible de démarrer le paiement. Veuillez réessayer.');
      Alert.alert(t.common.error, message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBuyCreditPack = async (packId: string) => {
    setPackLoading(packId);
    try {
      const { checkout_url } = await billingApi.createCreditPackCheckout(packId);
      if (!checkout_url) throw new Error('No checkout URL');
      await WebBrowser.openBrowserAsync(checkout_url, {
        showTitle: true,
        enableBarCollapsing: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : (isEn ? 'Unable to start checkout.' : 'Impossible de démarrer le paiement.');
      Alert.alert(t.common.error, message);
    } finally {
      setPackLoading(null);
    }
  };

  const formatCredits = (credits: number): string => {
    if (credits >= 1000) {
      return `${(credits / 1000).toFixed(0)}k`;
    }
    return credits.toString();
  };

  const renderPlanCard = (plan: PlanWithTranslations) => {
    const isCurrentPlan = plan.id === currentPlan;
    const isSelected = plan.id === selectedPlan;
    const isRecommended = plan.id === recommendedPlan;
    const isPlanUpgrade = isPlanHigher(plan.id as PlanId, currentPlan);
    const displayName = isEn ? plan.en.name : plan.name;
    const displayFeatures = isEn ? plan.en.features : plan.features;

    return (
      <TouchableOpacity
        key={plan.id}
        onPress={() => handleSelectPlan(plan.id)}
        activeOpacity={isCurrentPlan ? 1 : 0.7}
      >
        <Card
          variant="elevated"
          style={[
            styles.planCard,
            isSelected && { borderWidth: 2, borderColor: colors.accentPrimary },
            isCurrentPlan && [styles.currentPlanCard, { borderColor: colors.accentSuccess }],
            isRecommended && !isCurrentPlan && [styles.recommendedPlanCard, { borderColor: colors.accentSuccess }],
          ]}
        >
          {/* Recommended badge */}
          {isRecommended && !isCurrentPlan && (
            <View style={[styles.recommendedBadge, { backgroundColor: colors.accentSuccess }]}>
              <Ionicons name="trending-up" size={12} color="#FFFFFF" />
              <Text style={styles.recommendedText}>
                {isEn ? 'Recommended' : 'Recommandé'}
              </Text>
            </View>
          )}

          {/* Popular badge (only if not showing recommended) */}
          {plan.isPopular && !isRecommended && (
            <View style={styles.popularBadge}>
              <LinearGradient
                colors={Colors.gradientPrimary}
                style={styles.popularGradient}
              >
                <Text style={styles.popularText}>{t.upgrade.popular}</Text>
              </LinearGradient>
            </View>
          )}

          <View style={styles.planHeader}>
            <View style={styles.planTitleRow}>
              <View style={[styles.planIcon, { backgroundColor: colors.accentPrimary + '20' }]}>
                <Ionicons name={plan.icon as any} size={20} color={colors.accentPrimary} />
              </View>
              <Text style={[styles.planName, { color: colors.textPrimary }]}>
                {displayName}
              </Text>
            </View>
            {isCurrentPlan && (
              <Badge label={t.upgrade.currentPlan} variant="primary" size="sm" />
            )}
          </View>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: colors.textPrimary }]}>
              {plan.price === 0 ? (isEn ? 'Free' : 'Gratuit') : `${plan.price}€`}
            </Text>
            {plan.price > 0 && (
              <Text style={[styles.period, { color: colors.textTertiary }]}>
                {isEn ? '/month' : plan.period}
              </Text>
            )}
          </View>

          <View style={styles.creditsRow}>
            <Ionicons name="flash" size={16} color={colors.accentSecondary} />
            <Text style={[styles.credits, { color: colors.accentPrimary }]}>
              {formatCredits(plan.credits)} {isEn ? 'credits/month' : 'crédits/mois'}
            </Text>
          </View>

          <View style={styles.features}>
            {displayFeatures.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.accentSuccess}
                />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {!isCurrentPlan && (
            <TouchableOpacity
              style={[
                styles.selectButton,
                isSelected && { backgroundColor: colors.accentPrimary },
                !isSelected && { borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => handleSelectPlan(plan.id)}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  { color: isSelected ? '#fff' : colors.textSecondary },
                ]}
              >
                {isSelected
                  ? (isEn ? 'Selected' : 'Sélectionné')
                  : (isEn ? 'Choose Plan' : 'Choisir')}
              </Text>
            </TouchableOpacity>
          )}
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <Header title={t.upgrade.title} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t.upgrade.choosePlan}
        </Text>

        {PLANS.map(renderPlanCard)}

        {/* Pourquoi DeepSight — Différenciateurs */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          {isEn ? 'Why DeepSight?' : 'Pourquoi DeepSight ?'}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
          {isEn
            ? 'Features no other tool offers'
            : 'Ce que personne d\'autre ne propose'}
        </Text>
        {DIFFERENTIATORS.map((diff, index) => (
          <Card key={index} style={styles.diffCard}>
            <View style={styles.diffHeader}>
              <View style={[styles.diffIconWrap, { backgroundColor: colors.accentPrimary + '15' }]}>
                <Ionicons name={diff.ionicon as any} size={20} color={colors.accentPrimary} />
              </View>
              <View style={[styles.diffTag, { backgroundColor: colors.accentSecondary + '20' }]}>
                <Text style={[styles.diffTagText, { color: colors.accentSecondary }]}>
                  {isEn ? diff.tag.en : diff.tag.fr}
                </Text>
              </View>
            </View>
            <Text style={[styles.diffTitle, { color: colors.textPrimary }]}>
              {isEn ? diff.title.en : diff.title.fr}
            </Text>
            <Text style={[styles.diffDesc, { color: colors.textSecondary }]}>
              {isEn ? diff.description.en : diff.description.fr}
            </Text>
          </Card>
        ))}

        {/* Credit Packs */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: Spacing.lg }]}>
          {isEn ? 'Need more credits?' : 'Besoin de plus de crédits ?'}
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textTertiary }]}>
          {isEn
            ? 'One-time purchase, no subscription'
            : 'Achat unique, sans abonnement'}
        </Text>
        {CREDIT_PACKS.map((pack) => (
          <Card key={pack.id} style={styles.packCard}>
            <View style={styles.packRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.packName, { color: colors.textPrimary }]}>
                  {isEn ? pack.name.en : pack.name.fr}
                </Text>
                <Text style={[styles.packCredits, { color: colors.accentPrimary }]}>
                  {pack.credits.toLocaleString()} {isEn ? 'credits' : 'crédits'}
                </Text>
                <Text style={[styles.packDesc, { color: colors.textTertiary }]}>
                  {isEn ? pack.description.en : pack.description.fr}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.packButton, { borderColor: colors.accentPrimary }]}
                onPress={() => handleBuyCreditPack(pack.id)}
                disabled={packLoading === pack.id}
              >
                <Text style={[styles.packButtonText, { color: colors.accentPrimary }]}>
                  {packLoading === pack.id
                    ? '...'
                    : `${pack.priceDisplay}€`}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {/* B2B / Sur-mesure */}
        <Card style={{ padding: Spacing.lg, marginBottom: Spacing.xl, alignItems: 'center' as const }}>
          <Text style={{ fontSize: Typography.fontSize.base, fontFamily: Typography.fontFamily.bodySemiBold, color: colors.textPrimary, marginBottom: Spacing.xs, textAlign: 'center' as const }}>
            {isEn ? 'Need a custom plan?' : 'Besoin d\'une offre sur-mesure ?'}
          </Text>
          <Text style={{ fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.body, color: colors.textSecondary, textAlign: 'center' as const, marginBottom: Spacing.md }}>
            {isEn
              ? 'Teams, universities, enterprises — contact us.'
              : 'Équipes, universités, entreprises — contactez-nous.'}
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('mailto:contact@deepsightsynthesis.com?subject=Offre%20sur-mesure%20DeepSight')}
            style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontSize: Typography.fontSize.sm, fontFamily: Typography.fontFamily.bodyMedium, color: colors.textPrimary }}>
              {isEn ? 'Contact us' : 'Contactez-nous'}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>

      {/* Bottom CTA */}
      {selectedPlan && selectedPlan !== currentPlan && (
        <View style={[styles.bottomCta, { backgroundColor: colors.bgPrimary, paddingBottom: insets.bottom + Spacing.md }]}>
          {isDowngrade && (
            <Text style={[styles.downgradeWarning, { color: colors.accentWarning }]}>
              {isEn
                ? 'Downgrading will reduce your limits'
                : 'Rétrograder réduira vos limites'}
            </Text>
          )}
          <Button
            title={
              isUpgrade
                ? (isEn
                    ? `Upgrade to ${PLANS.find(p => p.id === selectedPlan)?.en.name}`
                    : `Passer à ${PLANS.find(p => p.id === selectedPlan)?.name}`)
                : (isEn
                    ? `Switch to ${PLANS.find(p => p.id === selectedPlan)?.en.name}`
                    : `Changer pour ${PLANS.find(p => p.id === selectedPlan)?.name}`)
            }
            onPress={handleUpgrade}
            loading={isLoading}
            fullWidth
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  planCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    position: 'relative',
    overflow: 'visible',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: Spacing.lg,
  },
  popularGradient: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.xs,
  },
  price: {
    fontSize: Typography.fontSize['3xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  period: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginLeft: Spacing.xs,
  },
  creditsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  credits: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  features: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    flex: 1,
    lineHeight: 18,
  },
  currentPlanCard: {
    borderWidth: 2,
    // borderColor is set dynamically
  },
  recommendedPlanCard: {
    borderWidth: 2,
    // borderColor is set dynamically
  },
  recommendedBadge: {
    position: 'absolute',
    top: -12,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  downgradeWarning: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  selectButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  selectButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  diffCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  diffHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  diffIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diffTag: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  diffTagText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  diffTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  diffDesc: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 20,
  },
  packCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packName: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  packCredits: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginTop: 2,
  },
  packDesc: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  packButton: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginLeft: Spacing.md,
  },
  packButtonText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
});

export default UpgradeScreen;
