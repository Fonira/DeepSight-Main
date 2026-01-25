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
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Header, Card, Badge, Button } from '../components';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  credits: number;
  features: string[];
  isPopular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Gratuit',
    price: 0,
    period: '/mois',
    credits: 20,
    features: [
      '20 crédits par mois',
      'Analyses de base',
      'Historique 7 jours',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    period: '/mois',
    credits: 100,
    features: [
      '100 crédits par mois',
      'Analyses détaillées',
      'Historique illimité',
      'Export PDF',
    ],
    isPopular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 19.99,
    period: '/mois',
    credits: 500,
    features: [
      '500 crédits par mois',
      'Tous les modèles IA',
      'Analyses de playlists',
      'Outils d\'étude',
      'Support prioritaire',
    ],
  },
  {
    id: 'expert',
    name: 'Expert',
    price: 49.99,
    period: '/mois',
    credits: 2000,
    features: [
      '2000 crédits par mois',
      'API access',
      'Analyses avancées',
      'Support dédié',
      'Fonctionnalités beta',
    ],
  },
];

export const UpgradeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentPlan = user?.plan || 'free';

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    Haptics.selectionAsync();
    setSelectedPlan(planId);
  };

  const handleUpgrade = () => {
    if (!selectedPlan) return;

    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        t.upgrade.title,
        t.upgrade.comingSoon,
        [{ text: 'OK' }]
      );
    }, 1000);
  };

  const renderPlanCard = (plan: Plan) => {
    const isCurrentPlan = plan.id === currentPlan;
    const isSelected = plan.id === selectedPlan;

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
            isCurrentPlan && { opacity: 0.7 },
          ]}
        >
          {plan.isPopular && (
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
            <Text style={[styles.planName, { color: colors.textPrimary }]}>
              {plan.name}
            </Text>
            {isCurrentPlan && (
              <Badge label={t.upgrade.currentPlan} variant="primary" size="sm" />
            )}
          </View>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: colors.textPrimary }]}>
              {plan.price === 0 ? t.common.free : `${plan.price}€`}
            </Text>
            {plan.price > 0 && (
              <Text style={[styles.period, { color: colors.textTertiary }]}>
                {plan.period}
              </Text>
            )}
          </View>

          <Text style={[styles.credits, { color: colors.accentPrimary }]}>
            {plan.credits} crédits/mois
          </Text>

          <View style={styles.features}>
            {plan.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.accentSuccess}
                />
                <Text style={[styles.featureText, { color: colors.textSecondary }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>
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
          <Button
            title={`Passer à ${PLANS.find(p => p.id === selectedPlan)?.name}`}
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
  planName: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.sm,
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
  credits: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.lg,
  },
  features: {
    gap: Spacing.sm,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featureText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    flex: 1,
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
