/**
 * Analysis Value Display Component for DeepSight Mobile
 *
 * Shows the value provided by analysis:
 * - Time saved
 * - Equivalent pages read
 * - Credit cost
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { calculateTimeSaved, CONVERSION_TRIGGERS } from '../../config/planPrivileges';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface AnalysisValueDisplayProps {
  videoDurationSeconds: number;
  creditsUsed?: number;
  compact?: boolean;
  animated?: boolean;
}

export const AnalysisValueDisplay: React.FC<AnalysisValueDisplayProps> = ({
  videoDurationSeconds,
  creditsUsed,
  compact = false,
  animated = true,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();

  // Calculate values
  const { minutes: minutesSaved, equivalent } = calculateTimeSaved(videoDurationSeconds);

  // Only show if conversion triggers are enabled and video is long enough
  if (!CONVERSION_TRIGGERS.showTimeSaved || videoDurationSeconds < 60) {
    return null;
  }

  // Format video duration
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h${remainingMins}min` : `${hours}h`;
  };

  const videoDuration = formatDuration(videoDurationSeconds);

  // Animated scale for emphasis
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (animated) {
      scale.value = withDelay(
        500,
        withSequence(
          withSpring(1.05, { damping: 10 }),
          withSpring(1, { damping: 15 })
        )
      );
    }
  }, [animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.accentSuccess + '15' }]}>
        <Ionicons name="time-outline" size={14} color={colors.accentSuccess} />
        <Text style={[styles.compactText, { color: colors.accentSuccess }]}>
          {language === 'fr'
            ? `~${minutesSaved} min économisées`
            : `~${minutesSaved} min saved`
          }
        </Text>
      </View>
    );
  }

  const Container = animated ? Animated.View : View;
  const containerProps = animated ? { entering: FadeInDown.delay(300).springify() } : {};

  return (
    <Container
      style={[
        styles.container,
        { backgroundColor: colors.bgSecondary, borderColor: colors.border },
        animated && animatedStyle,
      ]}
      {...containerProps}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accentSuccess + '20' }]}>
          <Ionicons name="trending-up" size={20} color={colors.accentSuccess} />
        </View>
        <Text style={[styles.headerText, { color: colors.textPrimary }]}>
          {language === 'fr' ? 'Valeur de l\'analyse' : 'Analysis Value'}
        </Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Time Saved */}
        <View style={styles.statItem}>
          <View style={[styles.statIconBg, { backgroundColor: colors.accentPrimary + '15' }]}>
            <Ionicons name="time-outline" size={18} color={colors.accentPrimary} />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            ~{minutesSaved} min
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'économisées' : 'saved'}
          </Text>
        </View>

        {/* Video Duration */}
        <View style={styles.statItem}>
          <View style={[styles.statIconBg, { backgroundColor: colors.accentWarning + '15' }]}>
            <Ionicons name="videocam-outline" size={18} color={colors.accentWarning} />
          </View>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {videoDuration}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'de vidéo' : 'video'}
          </Text>
        </View>

        {/* Equivalent Pages */}
        {CONVERSION_TRIGGERS.showEquivalentPages && (
          <View style={styles.statItem}>
            <View style={[styles.statIconBg, { backgroundColor: colors.accentInfo + '15' }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.accentInfo} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {equivalent}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'fr' ? 'équivalent' : 'equivalent'}
            </Text>
          </View>
        )}

        {/* Credits Used */}
        {creditsUsed !== undefined && (
          <View style={styles.statItem}>
            <View style={[styles.statIconBg, { backgroundColor: colors.accentSecondary + '15' }]}>
              <Ionicons name="sparkles-outline" size={18} color={colors.accentSecondary} />
            </View>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>
              {creditsUsed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              {language === 'fr' ? 'crédits' : 'credits'}
            </Text>
          </View>
        )}
      </View>

      {/* Encouragement message */}
      <View style={[styles.messageContainer, { backgroundColor: colors.accentSuccess + '10' }]}>
        <Ionicons name="checkmark-circle" size={16} color={colors.accentSuccess} />
        <Text style={[styles.messageText, { color: colors.textSecondary }]}>
          {language === 'fr'
            ? `Vous avez gagné ~${minutesSaved} minutes de lecture!`
            : `You saved ~${minutesSaved} minutes of reading time!`
          }
        </Text>
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginVertical: Spacing.sm,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  compactText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statItem: {
    flex: 1,
    minWidth: 70,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  statValue: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  messageText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default AnalysisValueDisplay;
