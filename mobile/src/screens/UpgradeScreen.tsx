import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header, Card, Badge, Button } from '../components';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { billingApi, ApiError } from '../services/api';
import { normalizePlanId, isPlanHigher, comparePlans, type PlanId } from '../config/planPrivileges';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  credits: number;
  features: string[];
  isPopular?: boolean;
}

interface PlanEn {
  name: string;
  features: string[];
}

interface PlanWithTranslations extends Plan {
  en: PlanEn;
  icon: string;
}

const PLANS: PlanWithTranslations[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    period: '/mois',
    credits: 150,
    icon: 'gift-outline',
    features: [
      '3 analyses par mois',
      '150 crédits',
      'Vidéos ≤ 10 min',
      '3 questions chat/vidéo',
      'Historique 3 jours',
      'Export texte',
    ],
    en: {
      name: 'Free',
      features: [
        '3 analyses/month',
        '150 credits',
        'Videos ≤ 10 min',
        '3 chat questions/video',
        '3 days history',
        'Text export',
      ],
    },
  },
  {
    id: 'student',
    name: 'Étudiant',
    price: 2.99,
    period: '/mois',
    credits: 2000,
    icon: 'school-outline',
    features: [
      '40 analyses par mois',
      '2000 crédits',
      'Vidéos ≤ 2h',
      '15 questions chat/vidéo',
      'Historique 90 jours',
      'Export PDF + Markdown',
      'Citations BibTeX',
      'Audio TTS',
      'Recherche web (10/mois)',
    ],
    en: {
      name: 'Student',
      features: [
        '40 analyses/month',
        '2000 credits',
        'Videos ≤ 2h',
        '15 chat questions/video',
        '90 days history',
        'PDF + Markdown export',
        'BibTeX citations',
        'Audio TTS',
        'Web search (10/month)',
      ],
    },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 5.99,
    period: '/mois',
    credits: 3000,
    icon: 'rocket-outline',
    features: [
      '60 analyses par mois',
      '3000 crédits',
      'Vidéos ≤ 2h',
      '20 questions chat/vidéo',
      'Historique 60 jours',
      'Export PDF + TXT',
      'Citations académiques',
      'Recherche web (20/mois)',
    ],
    en: {
      name: 'Starter',
      features: [
        '60 analyses/month',
        '3000 credits',
        'Videos ≤ 2h',
        '20 chat questions/video',
        '60 days history',
        'PDF + TXT export',
        'Academic citations',
        'Web search (20/month)',
      ],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12.99,
    period: '/mois',
    credits: 15000,
    icon: 'star-outline',
    isPopular: true,
    features: [
      '300 analyses par mois',
      '15 000 crédits',
      'Vidéos ≤ 4h',
      'Chat illimité par vidéo',
      'Historique 180 jours',
      'Tous les exports + Markdown',
      'Playlists (20 vidéos max)',
      'Audio TTS',
      'Recherche web (100/mois)',
      'Support prioritaire',
      'Fact-checking avancé',
    ],
    en: {
      name: 'Pro',
      features: [
        '300 analyses/month',
        '15,000 credits',
        'Videos ≤ 4h',
        'Unlimited chat/video',
        '180 days history',
        'All exports + Markdown',
        'Playlists (20 videos max)',
        'Audio TTS',
        'Web search (100/month)',
        'Priority support',
        'Advanced fact-checking',
      ],
    },
  },
  {
    id: 'team',
    name: 'Team',
    price: 29.99,
    period: '/mois',
    credits: 50000,
    icon: 'people-outline',
    features: [
      '1000 analyses par mois',
      '50 000 crédits',
      'Vidéos illimitées',
      'Chat et exports illimités',
      'Historique illimité',
      'Playlists (100 vidéos, illimitées)',
      'Recherche web illimitée',
      'API REST (1000 req/jour)',
      '5 membres d\'équipe',
      'Support dédié',
      'Analytics avancés',
    ],
    en: {
      name: 'Team',
      features: [
        '1000 analyses/month',
        '50,000 credits',
        'Unlimited video length',
        'Unlimited chat & exports',
        'Unlimited history',
        'Playlists (100 videos, unlimited)',
        'Unlimited web search',
        'REST API (1000 req/day)',
        '5 team members',
        'Dedicated support',
        'Advanced analytics',
      ],
    },
  },
];

// Plan progression order for recommendations
const PLAN_ORDER: PlanId[] = ['free', 'student', 'starter', 'pro', 'team'];

// Get recommended upgrade path based on current plan
const getRecommendedPlan = (currentPlan: PlanId): PlanId | null => {
  const currentIndex = PLAN_ORDER.indexOf(currentPlan);
  if (currentIndex === -1 || currentIndex >= PLAN_ORDER.length - 1) return null;
  // Recommend the next tier, but skip to 'pro' if on 'starter' (since pro is popular)
  if (currentPlan === 'starter') return 'pro';
  return PLAN_ORDER[currentIndex + 1];
};

export const UpgradeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
  };

  const handleUpgrade = async () => {
    if (!selectedPlan) return;

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
      <Header title={t.upgrade.title} showBack />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t.upgrade.choosePlan}
        </Text>

        {PLANS.map(renderPlanCard)}
      </ScrollView>

      {/* Bottom CTA */}
      {selectedPlan && selectedPlan !== currentPlan && (
        <View style={[styles.bottomCta, { backgroundColor: 'transparent', paddingBottom: insets.bottom + Spacing.md }]}>
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
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
});

export default UpgradeScreen;
