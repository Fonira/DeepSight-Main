/**
 * CreditCounter - Affichage compact des crédits utilisateur
 * Avec niveaux d'urgence et navigation vers l'upgrade
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Plan limits
const PLAN_LIMITS: Record<string, { monthlyCredits: number; monthlyAnalyses: number }> = {
  free: { monthlyCredits: 150, monthlyAnalyses: 3 },
  student: { monthlyCredits: 2000, monthlyAnalyses: 40 },
  starter: { monthlyCredits: 3000, monthlyAnalyses: 60 },
  pro: { monthlyCredits: 15000, monthlyAnalyses: 300 },
};

interface CreditCounterProps {
  credits?: number;
  plan?: string;
  variant?: 'default' | 'compact' | 'minimal';
  showUpgradeButton?: boolean;
  showAnalyses?: boolean;
  analysesUsed?: number;
  isLoading?: boolean;
  onPress?: () => void;
}

export const CreditCounter: React.FC<CreditCounterProps> = ({
  credits = 0,
  plan = 'free',
  variant = 'default',
  showUpgradeButton = true,
  showAnalyses = false,
  analysesUsed = 0,
  isLoading = false,
  onPress,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const navigation = useNavigation<NavigationProp>();

  const normalizedPlan = plan?.toLowerCase() || 'free';
  const planLimits = PLAN_LIMITS[normalizedPlan] || PLAN_LIMITS.free;
  const maxCredits = planLimits.monthlyCredits;
  const maxAnalyses = planLimits.monthlyAnalyses;

  // Calculate urgency level
  const urgency = useMemo(() => {
    const percentage = (credits / maxCredits) * 100;

    if (credits <= 0) {
      return {
        level: 'empty',
        color: colors.accentError,
        bgColor: `${colors.accentError}15`,
        borderColor: `${colors.accentError}30`,
      };
    }
    if (percentage <= 10) {
      return {
        level: 'critical',
        color: colors.accentWarning,
        bgColor: `${colors.accentWarning}15`,
        borderColor: `${colors.accentWarning}30`,
      };
    }
    if (percentage <= 25) {
      return {
        level: 'warning',
        color: colors.accentWarning,
        bgColor: `${colors.accentWarning}15`,
        borderColor: `${colors.accentWarning}30`,
      };
    }
    return {
      level: 'good',
      color: colors.accentSuccess,
      bgColor: `${colors.accentSuccess}15`,
      borderColor: `${colors.accentSuccess}30`,
    };
  }, [credits, maxCredits, colors]);

  const handleUpgrade = () => {
    navigation.navigate('Upgrade');
  };

  const formatCredits = (value: number): string => {
    if (value >= 999999) return '∞';
    if (value >= 10000) return `${Math.floor(value / 1000)}k`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return value.toLocaleString();
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgElevated }]}>
        <ActivityIndicator size="small" color={colors.accentPrimary} />
      </View>
    );
  }

  // Minimal variant - just the number
  if (variant === 'minimal') {
    return (
      <TouchableOpacity
        style={styles.minimalContainer}
        onPress={onPress || handleUpgrade}
        activeOpacity={0.7}
      >
        <Ionicons name="wallet-outline" size={16} color={urgency.color} />
        <Text style={[styles.minimalText, { color: urgency.color }]}>
          {formatCredits(credits)}
        </Text>
      </TouchableOpacity>
    );
  }

  // Compact variant - small badge
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[
          styles.compactContainer,
          { backgroundColor: urgency.bgColor, borderColor: urgency.borderColor },
        ]}
        onPress={onPress || handleUpgrade}
        activeOpacity={0.7}
      >
        {urgency.level === 'empty' || urgency.level === 'critical' ? (
          <Ionicons name="warning" size={16} color={urgency.color} />
        ) : (
          <Ionicons name="wallet-outline" size={16} color={urgency.color} />
        )}
        <Text style={[styles.compactText, { color: urgency.color }]}>
          {formatCredits(credits)}
        </Text>
        {showUpgradeButton && (urgency.level === 'empty' || urgency.level === 'critical') && (
          <TouchableOpacity
            style={[styles.compactUpgradeButton, { backgroundColor: `${colors.accentPrimary}30` }]}
            onPress={handleUpgrade}
          >
            <Ionicons name="flash" size={12} color={colors.accentPrimary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // Default variant - full display
  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: urgency.bgColor, borderColor: urgency.borderColor },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {urgency.level === 'empty' || urgency.level === 'critical' ? (
            <Ionicons name="warning" size={20} color={urgency.color} />
          ) : (
            <Ionicons name="wallet-outline" size={20} color={urgency.color} />
          )}
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Crédits' : 'Credits'}
          </Text>
        </View>
        <Text style={[styles.creditValue, { color: urgency.color }]}>
          {formatCredits(credits)}
        </Text>
      </View>

      {/* Warning message */}
      {urgency.level !== 'good' && (
        <Text style={[styles.warningText, { color: urgency.color }]}>
          {urgency.level === 'empty'
            ? language === 'fr' ? '⚠️ Plus de crédits !' : '⚠️ Out of credits!'
            : urgency.level === 'critical'
            ? language === 'fr' ? '🔴 Crédits presque épuisés' : '🔴 Credits almost depleted'
            : language === 'fr' ? '🟡 Pensez à recharger' : '🟡 Consider recharging'}
        </Text>
      )}

      {/* Analyses count for free users */}
      {showAnalyses && normalizedPlan === 'free' && maxAnalyses > 0 && (
        <View style={[styles.analysesContainer, { backgroundColor: `${colors.bgTertiary}50` }]}>
          <View style={styles.analysesHeader}>
            <Text style={[styles.analysesLabel, { color: colors.textSecondary }]}>
              {language === 'fr' ? 'Analyses' : 'Analyses'}
            </Text>
            <Text
              style={[
                styles.analysesValue,
                { color: analysesUsed >= maxAnalyses ? colors.accentError : colors.textPrimary },
              ]}
            >
              {analysesUsed}/{maxAnalyses}
            </Text>
          </View>
          <View style={[styles.progressBarBg, { backgroundColor: colors.bgTertiary }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor:
                    analysesUsed >= maxAnalyses
                      ? colors.accentError
                      : analysesUsed >= maxAnalyses - 1
                      ? '#EAB308'
                      : colors.accentSuccess,
                  width: `${Math.min((analysesUsed / maxAnalyses) * 100, 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Credits progress bar */}
      {maxCredits > 0 && urgency.level !== 'good' && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.bgTertiary }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  backgroundColor: urgency.color,
                  width: `${Math.min((credits / maxCredits) * 100, 100)}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
              {formatCredits(credits)}
            </Text>
            <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
              {formatCredits(maxCredits)}
            </Text>
          </View>
        </View>
      )}

      {/* Upgrade button */}
      {showUpgradeButton && normalizedPlan !== 'pro' && (
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: `${colors.accentPrimary}20` }]}
          onPress={handleUpgrade}
        >
          <Ionicons name="trending-up" size={16} color={colors.accentPrimary} />
          <Text style={[styles.upgradeButtonText, { color: colors.accentPrimary }]}>
            {urgency.level === 'empty' || urgency.level === 'critical'
              ? language === 'fr' ? 'Recharger maintenant' : 'Recharge now'
              : language === 'fr' ? 'Obtenir plus' : 'Get more'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  minimalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  minimalText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  compactText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  compactUpgradeButton: {
    marginLeft: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  container: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  creditValue: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
    fontVariant: ['tabular-nums'],
  },
  warningText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.sm,
  },
  analysesContainer: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  analysesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  analysesLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  analysesValue: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  progressContainer: {
    marginBottom: Spacing.sm,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  progressLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  upgradeButtonText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default CreditCounter;
