import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing } from '../../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.md,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          shimmerProgress.value,
          [0, 1],
          [-200, 200]
        ),
      },
    ],
  }));

  const baseColor = isDark ? colors.bgElevated : '#E5E5E8';
  const shimmerColor = isDark ? colors.bgHover : '#F5F5F7';

  return (
    <View
      style={[
        styles.container,
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

// Pre-built skeleton patterns
interface SkeletonCardProps {
  compact?: boolean;
}

export const SkeletonVideoCard: React.FC<SkeletonCardProps> = ({ compact = false }) => {
  const { colors } = useTheme();

  if (compact) {
    return (
      <View style={[styles.compactCard, { backgroundColor: colors.bgCard }]}>
        <Skeleton width={120} height={68} borderRadius={BorderRadius.sm} />
        <View style={styles.compactContent}>
          <Skeleton width="100%" height={14} style={{ marginBottom: Spacing.xs }} />
          <Skeleton width="60%" height={12} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bgCard }]}>
      <Skeleton width="100%" height={180} borderRadius={0} />
      <View style={styles.cardContent}>
        <Skeleton width="90%" height={16} style={{ marginBottom: Spacing.sm }} />
        <Skeleton width="50%" height={14} style={{ marginBottom: Spacing.md }} />
        <View style={styles.badgeRow}>
          <Skeleton width={60} height={22} borderRadius={BorderRadius.full} />
          <Skeleton width={80} height={22} borderRadius={BorderRadius.full} style={{ marginLeft: Spacing.xs }} />
        </View>
      </View>
    </View>
  );
};

export const SkeletonAnalysisSection: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={[styles.section, { backgroundColor: colors.bgCard }]}>
      <Skeleton width={150} height={20} style={{ marginBottom: Spacing.md }} />
      <Skeleton width="100%" height={14} style={{ marginBottom: Spacing.sm }} />
      <Skeleton width="100%" height={14} style={{ marginBottom: Spacing.sm }} />
      <Skeleton width="80%" height={14} style={{ marginBottom: Spacing.sm }} />
      <Skeleton width="60%" height={14} />
    </View>
  );
};

export const SkeletonList: React.FC<{ count?: number; compact?: boolean }> = ({ 
  count = 3,
  compact = false,
}) => {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonVideoCard key={index} compact={compact} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 200,
  },
  gradient: {
    flex: 1,
    width: '100%',
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  cardContent: {
    padding: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  compactCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  compactContent: {
    flex: 1,
    marginLeft: Spacing.sm,
    justifyContent: 'center',
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
});

export default Skeleton;
