import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';

type FreshnessLevel = 'fresh' | 'recent' | 'dated' | 'outdated';

interface FreshnessIndicatorProps {
  publicationDate: string | Date;
  daysSincePublished?: number;
  freshnessLevel?: FreshnessLevel;
  compact?: boolean;
  onPress?: () => void;
}

const FRESHNESS_CONFIG: Record<FreshnessLevel, { color: string; icon: string; labelFr: string; labelEn: string }> = {
  fresh: {
    color: Colors.accentSuccess,
    icon: 'leaf',
    labelFr: 'Récent',
    labelEn: 'Fresh',
  },
  recent: {
    color: Colors.accentSuccess,
    icon: 'time',
    labelFr: 'Assez récent',
    labelEn: 'Recent',
  },
  dated: {
    color: Colors.accentWarning,
    icon: 'hourglass',
    labelFr: 'Daté',
    labelEn: 'Dated',
  },
  outdated: {
    color: Colors.accentError,
    icon: 'alert-circle',
    labelFr: 'Ancien',
    labelEn: 'Outdated',
  },
};

const calculateFreshnessLevel = (daysSince: number): FreshnessLevel => {
  if (daysSince <= 7) return 'fresh';
  if (daysSince <= 30) return 'recent';
  if (daysSince <= 180) return 'dated';
  return 'outdated';
};

const calculateDaysSince = (date: string | Date): number => {
  const pubDate = new Date(date);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - pubDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (date: string | Date, isEn: boolean): string => {
  const d = new Date(date);
  return d.toLocaleDateString(isEn ? 'en-US' : 'fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatRelativeTime = (days: number, isEn: boolean): string => {
  if (days === 0) return isEn ? 'Today' : "Aujourd'hui";
  if (days === 1) return isEn ? 'Yesterday' : 'Hier';
  if (days < 7) return isEn ? `${days} days ago` : `Il y a ${days} jours`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return isEn ? `${weeks} week${weeks > 1 ? 's' : ''} ago` : `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return isEn ? `${months} month${months > 1 ? 's' : ''} ago` : `Il y a ${months} mois`;
  }
  const years = Math.floor(days / 365);
  return isEn ? `${years} year${years > 1 ? 's' : ''} ago` : `Il y a ${years} an${years > 1 ? 's' : ''}`;
};

export const FreshnessIndicator: React.FC<FreshnessIndicatorProps> = ({
  publicationDate,
  daysSincePublished,
  freshnessLevel,
  compact = false,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const days = daysSincePublished ?? calculateDaysSince(publicationDate);
  const level = freshnessLevel ?? calculateFreshnessLevel(days);
  const config = FRESHNESS_CONFIG[level];

  const Container = onPress ? TouchableOpacity : View;

  if (compact) {
    return (
      <Container
        onPress={onPress}
        style={[styles.compactContainer, { backgroundColor: config.color + '20' }]}
      >
        <Ionicons name={config.icon as any} size={12} color={config.color} />
        <Text style={[styles.compactText, { color: config.color }]}>
          {isEn ? config.labelEn : config.labelFr}
        </Text>
      </Container>
    );
  }

  return (
    <Container
      onPress={onPress}
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSecondary,
          borderLeftColor: config.color,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: config.color + '20' }]}>
          <Ionicons name={config.icon as any} size={14} color={config.color} />
          <Text style={[styles.badgeText, { color: config.color }]}>
            {isEn ? config.labelEn : config.labelFr}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={colors.textMuted}
          />
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {formatDate(publicationDate, isEn)}
          </Text>
        </View>
        <Text style={[styles.relativeText, { color: colors.textMuted }]}>
          {formatRelativeTime(days, isEn)}
        </Text>
      </View>

      {level === 'outdated' && (
        <View style={[styles.warningBanner, { backgroundColor: Colors.accentWarning + '15' }]}>
          <Ionicons name="warning" size={12} color={Colors.accentWarning} />
          <Text style={[styles.warningText, { color: Colors.accentWarning }]}>
            {isEn
              ? 'Content may be outdated. Verify current information.'
              : 'Le contenu peut être obsolète. Vérifiez les informations actuelles.'}
          </Text>
        </View>
      )}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 3,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  compactText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  badgeText: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontSize: Typography.fontSize.xs,
  },
  content: {
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  relativeText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  warningText: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.xs,
  },
});

export default FreshnessIndicator;
