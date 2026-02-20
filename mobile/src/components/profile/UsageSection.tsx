import React from 'react';
import { View, Text, StyleSheet, DimensionValue } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/contexts/AuthContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

const PLAN_ANALYSES: Record<string, number> = {
  free: 3,
  student: 40,
  starter: 60,
  pro: 300,
  team: 1000,
};

export const UsageSection: React.FC = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const credits = useCredits();

  const analysesUsed = user?.analyses_this_month ?? 0;
  const analysesTotal = PLAN_ANALYSES[user?.plan ?? 'free'] ?? 3;
  const analysesPercent = analysesTotal > 0
    ? Math.min((analysesUsed / analysesTotal) * 100, 100)
    : 0;

  const creditsPercent = credits.total > 0
    ? Math.min((credits.used / credits.total) * 100, 100)
    : 0;

  // Jours restants avant renouvellement (1er du mois prochain)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const daysUntilRenewal = Math.ceil(
    (nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  const getBarColor = (percent: number): string => {
    if (percent >= 90) return colors.accentError;
    if (percent >= 70) return colors.accentWarning;
    return colors.accentSuccess;
  };

  const renderBar = (
    label: string,
    value: string,
    percent: number,
  ) => {
    const width: DimensionValue = `${Math.round(percent)}%` as `${number}%`;
    return (
      <View style={styles.progressItem}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            {label}
          </Text>
          <Text style={[styles.progressValue, { color: colors.textPrimary }]}>
            {value}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.bgElevated }]}>
          <View
            style={[
              styles.progressFill,
              { width, backgroundColor: getBarColor(percent) },
            ]}
          />
        </View>
      </View>
    );
  };

  return (
    <GlassCard style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        Utilisation
      </Text>

      {renderBar(
        'Analyses',
        `${analysesUsed}/${analysesTotal} ce mois`,
        analysesPercent,
      )}

      {renderBar(
        'Crédits',
        `${credits.used}/${credits.total} utilisés`,
        creditsPercent,
      )}

      <Text style={[styles.renewalText, { color: colors.textTertiary }]}>
        Renouvellement dans {daysUntilRenewal} jour{daysUntilRenewal > 1 ? 's' : ''}
      </Text>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: sp.lg,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.lg,
  },
  progressItem: {
    marginBottom: sp.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xs,
  },
  progressLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  progressValue: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
  renewalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: sp.sm,
  },
});

export default UsageSection;
