/**
 * StatsCard - Carte statistiques globales du Study Hub
 * Affiche vidéos étudiées, score moyen, streak
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { Card } from '../ui/Card';
import { sp } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { duration } from '../../theme/animations';
import type { StudyStats } from '../../types/v2';

interface StatsCardProps {
  stats: StudyStats;
}

const FlameIcon: React.FC<{ active: boolean }> = ({ active }) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: duration.slow }),
          withTiming(1, { duration: duration.slow })
        ),
        -1,
        true
      );
    }
  }, [active, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name="flame"
        size={20}
        color={active ? colors.accentWarning : colors.textMuted}
      />
    </Animated.View>
  );
};

const ScoreMini: React.FC<{ score: number }> = ({ score }) => {
  const { colors } = useTheme();
  const size = 36;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score, 100) / 100;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background circle via border */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.bgTertiary,
        }}
      />
      {/* Fake progress via border + clip (simplified) */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: colors.accentPrimary,
          opacity: progress,
        }}
      />
      <Text style={[styles.scoreMiniText, { color: colors.textPrimary }]}>
        {score}%
      </Text>
    </View>
  );
};

export const StatsCard: React.FC<StatsCardProps> = ({ stats }) => {
  const { colors } = useTheme();
  const hasStats = stats.totalStudied > 0;

  if (!hasStats) {
    return (
      <Card variant="glass" padding="md">
        <View style={styles.emptyRow}>
          <Ionicons name="school-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Commence à réviser !
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card variant="glass" padding="md">
      <View style={styles.row}>
        <View style={styles.stat}>
          <Ionicons name="book" size={20} color={colors.accentPrimary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {stats.totalStudied}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            vidéos étudiées
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <ScoreMini score={Math.round(stats.averageScore)} />
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            score moyen
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <FlameIcon active={stats.streak > 0} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {stats.streak}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
            jours de suite
          </Text>
        </View>
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: sp.xs,
    flex: 1,
  },
  statValue: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  statLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  scoreMiniText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['2xs'],
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
    paddingVertical: sp.sm,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});

export default StatsCard;
