import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { gradients } from '@/theme/colors';

interface Plan {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string[];
  popular?: boolean;
}

interface PlanCardProps {
  plan: Plan;
  isCurrentPlan: boolean;
  onSelect: (planId: string) => void;
}

export const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  isCurrentPlan,
  onSelect,
}) => {
  const { colors } = useTheme();

  return (
    <GlassCard
      style={[
        styles.card,
        isCurrentPlan && { borderColor: colors.accentSuccess, borderWidth: 2 },
      ]}
    >
      {/* Badges */}
      <View style={styles.badgeRow}>
        {plan.popular && (
          <LinearGradient
            colors={gradients.accent}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.popularBadge}
          >
            <Text style={styles.popularText}>Populaire</Text>
          </LinearGradient>
        )}
        {isCurrentPlan && (
          <View style={[styles.currentBadge, { borderColor: colors.accentSuccess }]}>
            <Text style={[styles.currentText, { color: colors.accentSuccess }]}>
              Actuel
            </Text>
          </View>
        )}
      </View>

      {/* Plan name */}
      <Text style={[styles.planName, { color: colors.textPrimary }]}>
        {plan.name}
      </Text>

      {/* Price */}
      <View style={styles.priceRow}>
        <Text style={[styles.price, { color: colors.textPrimary }]}>
          {plan.price}
        </Text>
        <Text style={[styles.period, { color: colors.textTertiary }]}>
          {plan.period}
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.accentSuccess}
              style={styles.featureIcon}
            />
            <Text style={[styles.featureText, { color: colors.textSecondary }]}>
              {feature}
            </Text>
          </View>
        ))}
      </View>

      {/* CTA */}
      <View style={styles.ctaContainer}>
        <Button
          title={isCurrentPlan ? 'Plan actuel' : 'Choisir ce plan'}
          variant={isCurrentPlan ? 'secondary' : 'primary'}
          onPress={() => onSelect(plan.id)}
          disabled={isCurrentPlan}
          fullWidth
          style={isCurrentPlan ? { opacity: 0.5 } : undefined}
        />
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: sp.sm,
    marginBottom: sp.lg,
    minHeight: 28,
  },
  popularBadge: {
    paddingVertical: sp.xs,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
  },
  popularText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    color: '#ffffff',
  },
  currentBadge: {
    paddingVertical: sp.xs,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  currentText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
  planName: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['3xl'],
    marginBottom: sp.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: sp.xl,
  },
  price: {
    fontFamily: fontFamily.bodyBold,
    fontSize: fontSize['2xl'],
  },
  period: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginLeft: sp.xs,
  },
  features: {
    flex: 1,
    marginBottom: sp.xl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sp.md,
  },
  featureIcon: {
    marginRight: sp.sm,
  },
  featureText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    flex: 1,
  },
  ctaContainer: {
    marginTop: 'auto' as const,
  },
});

export default PlanCard;
