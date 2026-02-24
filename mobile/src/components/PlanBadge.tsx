import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

const UPGRADE_URL = 'https://www.deepsightsynthesis.com/upgrade';

interface PlanBadgeProps {
  planName: string;
  planIcon: string;
  planColor: string;
  analysesUsed?: number;
  analysesLimit?: number;
  compact?: boolean;
}

export const PlanBadge: React.FC<PlanBadgeProps> = ({
  planName,
  planIcon,
  planColor,
  analysesUsed,
  analysesLimit,
  compact = false,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(UPGRADE_URL);
  };

  const showUsage = analysesUsed !== undefined && analysesLimit !== undefined;
  const isUnlimited = analysesLimit === -1;
  const usageText = isUnlimited
    ? `${analysesUsed} analyses`
    : `${analysesUsed}/${analysesLimit} analyses`;

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View style={[styles.badge, { backgroundColor: `${planColor}20`, borderColor: `${planColor}40` }]}>
        <View style={[styles.dot, { backgroundColor: planColor }]} />
        <Ionicons
          name={planIcon as keyof typeof Ionicons.glyphMap}
          size={compact ? 14 : 16}
          color={planColor}
        />
        <Text style={[
          styles.planName,
          compact && styles.planNameCompact,
          { color: planColor },
        ]}>
          {planName}
        </Text>
      </View>
      {showUsage && (
        <Text style={[styles.usageText, { color: colors.textTertiary }]}>
          {usageText}
        </Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: sp.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planName: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodySemiBold,
  },
  planNameCompact: {
    fontSize: fontSize.xs,
  },
  usageText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
    marginLeft: sp.xs,
  },
});
