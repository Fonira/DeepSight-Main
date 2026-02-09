/**
 * CreditAlert - Bannière d'alerte pour crédits faibles
 * S'affiche automatiquement selon les seuils configurés
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CreditAlertProps {
  credits: number;
  maxCredits: number;
  warningThreshold?: number; // percentage
  criticalThreshold?: number; // percentage
  position?: 'top' | 'bottom' | 'inline';
  onDismiss?: () => void;
  onUpgrade?: () => void;
  visible?: boolean;
}

export const CreditAlert: React.FC<CreditAlertProps> = ({
  credits,
  maxCredits,
  warningThreshold = 25,
  criticalThreshold = 10,
  position = 'inline',
  onDismiss,
  onUpgrade,
  visible = true,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const navigation = useNavigation<NavigationProp>();
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const percentage = maxCredits > 0 ? (credits / maxCredits) * 100 : 0;

  // Determine alert level
  const alertLevel = credits <= 0
    ? 'empty'
    : percentage <= criticalThreshold
    ? 'critical'
    : percentage <= warningThreshold
    ? 'warning'
    : null;

  // Show/hide animation
  useEffect(() => {
    if (alertLevel && visible && !dismissed) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [alertLevel, visible, dismissed, fadeAnim]);

  // Don't render if no alert needed
  if (!alertLevel || !visible || dismissed) {
    return null;
  }

  const alertConfig = {
    empty: {
      icon: 'alert-circle' as const,
      color: colors.accentError,
      bgColor: `${colors.accentError}15`,
      borderColor: `${colors.accentError}30`,
      title: language === 'fr' ? 'Crédits épuisés' : 'Out of credits',
      message: language === 'fr'
        ? 'Rechargez vos crédits pour continuer vos analyses'
        : 'Recharge your credits to continue analyzing',
    },
    critical: {
      icon: 'warning' as const,
      color: colors.accentWarning,
      bgColor: `${colors.accentWarning}15`,
      borderColor: `${colors.accentWarning}30`,
      title: language === 'fr' ? 'Crédits presque épuisés' : 'Credits almost depleted',
      message: language === 'fr'
        ? `Il vous reste ${credits} crédits`
        : `You have ${credits} credits remaining`,
    },
    warning: {
      icon: 'information-circle' as const,
      color: colors.accentWarning,
      bgColor: `${colors.accentWarning}15`,
      borderColor: `${colors.accentWarning}30`,
      title: language === 'fr' ? 'Crédits limités' : 'Limited credits',
      message: language === 'fr'
        ? `Il vous reste ${credits} crédits (${Math.round(percentage)}%)`
        : `You have ${credits} credits remaining (${Math.round(percentage)}%)`,
    },
  };

  const config = alertConfig[alertLevel];

  const handleUpgrade = () => {
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigation.navigate('Upgrade');
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' && styles.positionTop,
        position === 'bottom' && styles.positionBottom,
        {
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={config.icon} size={24} color={config.color} />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: config.color }]}>
            {config.title}
          </Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {config.message}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: config.color }]}
          onPress={handleUpgrade}
        >
          <Ionicons name="flash" size={16} color="#FFFFFF" />
          <Text style={styles.upgradeButtonText}>
            {language === 'fr' ? 'Recharger' : 'Recharge'}
          </Text>
        </TouchableOpacity>

        {onDismiss && (
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
          >
            <Ionicons name="close" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.sm,
  },
  positionTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  positionBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginHorizontal: 0,
    marginVertical: 0,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: 2,
  },
  message: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.md,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});

export default CreditAlert;
