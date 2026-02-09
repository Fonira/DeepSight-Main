import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing } from '../../constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

const SkeletonBlock: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = BorderRadius.sm,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  const bgColor = isDark ? colors.bgElevated : colors.bgTertiary;

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: bgColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

/** Skeleton for a VideoCard in list mode */
export const VideoCardSkeleton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { colors, isDark } = useTheme();
  const bgColor = isDark ? colors.bgCard : colors.bgCard;

  if (compact) {
    return (
      <View style={[skeletonStyles.compactCard, { backgroundColor: bgColor }]}>
        <SkeletonBlock width={120} height={68} borderRadius={BorderRadius.sm} />
        <View style={skeletonStyles.compactContent}>
          <SkeletonBlock width="90%" height={14} />
          <SkeletonBlock width="60%" height={12} style={{ marginTop: Spacing.sm }} />
        </View>
      </View>
    );
  }

  return (
    <View style={[skeletonStyles.card, { backgroundColor: bgColor }]}>
      <SkeletonBlock width="100%" height={180} borderRadius={0} />
      <View style={skeletonStyles.cardContent}>
        <SkeletonBlock width="85%" height={16} />
        <SkeletonBlock width="50%" height={14} style={{ marginTop: Spacing.sm }} />
        <View style={skeletonStyles.badgeRow}>
          <SkeletonBlock width={60} height={20} borderRadius={BorderRadius.full} />
          <SkeletonBlock width={80} height={20} borderRadius={BorderRadius.full} />
        </View>
      </View>
    </View>
  );
};

/** Skeleton for the Dashboard screen */
export const DashboardSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={skeletonStyles.dashboardContainer}>
      {/* Welcome section */}
      <View style={skeletonStyles.welcomeRow}>
        <View style={{ flex: 1 }}>
          <SkeletonBlock width="40%" height={14} />
          <SkeletonBlock width="60%" height={24} style={{ marginTop: Spacing.sm }} />
        </View>
        <SkeletonBlock width={48} height={48} borderRadius={24} />
      </View>

      {/* Credits card */}
      <SkeletonBlock width="100%" height={100} borderRadius={BorderRadius.lg} style={{ marginTop: Spacing.lg }} />

      {/* Input section */}
      <SkeletonBlock width="40%" height={18} style={{ marginTop: Spacing.xl }} />
      <SkeletonBlock width="100%" height={120} borderRadius={BorderRadius.lg} style={{ marginTop: Spacing.md }} />

      {/* Recent analyses */}
      <SkeletonBlock width="50%" height={18} style={{ marginTop: Spacing.xl }} />
      <VideoCardSkeleton compact />
      <VideoCardSkeleton compact />
      <VideoCardSkeleton compact />
    </View>
  );
};

/** Skeleton for the History screen list */
export const HistoryListSkeleton: React.FC = () => (
  <View style={skeletonStyles.historyContainer}>
    {Array.from({ length: 5 }).map((_, i) => (
      <VideoCardSkeleton key={i} />
    ))}
  </View>
);

/** Skeleton for the Analysis screen content */
export const AnalysisSkeleton: React.FC = () => (
  <View style={skeletonStyles.analysisContainer}>
    {/* Video header */}
    <View style={skeletonStyles.analysisHeader}>
      <SkeletonBlock width={80} height={45} borderRadius={BorderRadius.sm} />
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <SkeletonBlock width="80%" height={14} />
        <SkeletonBlock width="50%" height={12} style={{ marginTop: Spacing.sm }} />
      </View>
    </View>

    {/* Tabs */}
    <View style={skeletonStyles.tabsRow}>
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} width={70} height={30} borderRadius={BorderRadius.md} />
      ))}
    </View>

    {/* Content */}
    <SkeletonBlock width="100%" height={200} borderRadius={BorderRadius.lg} style={{ marginTop: Spacing.lg }} />
    <SkeletonBlock width="100%" height={40} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.md }} />
    <SkeletonBlock width="100%" height={40} borderRadius={BorderRadius.md} style={{ marginTop: Spacing.md }} />
  </View>
);

/** Skeleton for a playlist item */
export const PlaylistSkeleton: React.FC = () => (
  <View style={skeletonStyles.historyContainer}>
    {Array.from({ length: 4 }).map((_, i) => (
      <View key={i} style={skeletonStyles.playlistItem}>
        <SkeletonBlock width={72} height={72} borderRadius={BorderRadius.md} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <SkeletonBlock width="70%" height={16} />
          <SkeletonBlock width="90%" height={12} style={{ marginTop: Spacing.sm }} />
          <SkeletonBlock width={60} height={20} borderRadius={BorderRadius.full} style={{ marginTop: Spacing.sm }} />
        </View>
      </View>
    ))}
  </View>
);

export { SkeletonBlock };

const skeletonStyles = StyleSheet.create({
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
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dashboardContainer: {
    padding: Spacing.lg,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyContainer: {
    padding: Spacing.lg,
  },
  analysisContainer: {
    padding: Spacing.md,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.md,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
});
