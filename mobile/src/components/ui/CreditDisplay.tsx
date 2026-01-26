import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CreditDisplayProps {
  variant?: 'compact' | 'full' | 'badge';
  showUpgradeButton?: boolean;
  onPress?: () => void;
}

export const CreditDisplay: React.FC<CreditDisplayProps> = ({
  variant = 'compact',
  showUpgradeButton = true,
  onPress,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<NavigationProp>();

  const credits = user?.credits ?? 0;
  const maxCredits = getMaxCredits(user?.plan || 'free');
  const isUnlimited = maxCredits === -1;
  const percentage = isUnlimited ? 100 : Math.min((credits / maxCredits) * 100, 100);
  const isLow = !isUnlimited && percentage <= 20;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Usage');
    }
  };

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Upgrade');
  };

  if (variant === 'badge') {
    return (
      <TouchableOpacity
        style={[
          styles.badge,
          {
            backgroundColor: isLow ? `${colors.accentError}20` : `${colors.accentPrimary}20`,
          },
        ]}
        onPress={handlePress}
      >
        <Ionicons
          name="flash"
          size={14}
          color={isLow ? colors.accentError : colors.accentPrimary}
        />
        <Text
          style={[
            styles.badgeText,
            { color: isLow ? colors.accentError : colors.accentPrimary },
          ]}
        >
          {isUnlimited ? '∞' : credits}
        </Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compact, { backgroundColor: colors.bgSecondary }]}
        onPress={handlePress}
      >
        <View style={styles.compactContent}>
          <Ionicons
            name="flash"
            size={16}
            color={isLow ? colors.accentWarning : colors.accentPrimary}
          />
          <Text style={[styles.compactCredits, { color: colors.textPrimary }]}>
            {isUnlimited ? t.common.unlimited : credits}
          </Text>
          <Text style={[styles.compactLabel, { color: colors.textTertiary }]}>
            {t.dashboard.credits}
          </Text>
        </View>
        {isLow && (
          <View style={[styles.lowBadge, { backgroundColor: colors.accentWarning }]}>
            <Ionicons name="warning" size={10} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Full variant
  return (
    <View style={[styles.full, { backgroundColor: colors.bgSecondary }]}>
      <View style={styles.fullHeader}>
        <View style={styles.fullTitleRow}>
          <Ionicons name="flash" size={20} color={colors.accentPrimary} />
          <Text style={[styles.fullTitle, { color: colors.textPrimary }]}>
            {t.dashboard.creditsRemaining}
          </Text>
        </View>
        <Text style={[styles.fullCredits, { color: colors.accentPrimary }]}>
          {isUnlimited ? t.common.unlimited : `${credits}/${maxCredits}`}
        </Text>
      </View>

      {/* Progress bar */}
      {!isUnlimited && (
        <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${percentage}%`,
                backgroundColor: isLow ? colors.accentWarning : colors.accentPrimary,
              },
            ]}
          />
        </View>
      )}

      {/* Low credits warning */}
      {isLow && (
        <View style={[styles.warningBox, { backgroundColor: `${colors.accentWarning}15` }]}>
          <Ionicons name="warning-outline" size={16} color={colors.accentWarning} />
          <Text style={[styles.warningText, { color: colors.accentWarning }]}>
            {t.notifications.creditsLow}
          </Text>
        </View>
      )}

      {/* Upgrade button */}
      {showUpgradeButton && !isUnlimited && (
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: colors.accentPrimary }]}
          onPress={handleUpgrade}
        >
          <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" />
          <Text style={styles.upgradeText}>{t.nav.upgrade}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

function getMaxCredits(plan: string): number {
  const limits: Record<string, number> = {
    free: 5,
    starter: 30,
    pro: 100,
    expert: -1, // unlimited
  };
  return limits[plan] ?? 5;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    position: 'relative',
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  compactCredits: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  compactLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  lowBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  fullHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  fullTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fullTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  fullCredits: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  warningText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    flex: 1,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default CreditDisplay;
