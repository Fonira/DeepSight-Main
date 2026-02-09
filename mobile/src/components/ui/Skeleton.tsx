/**
 * Skeleton - Premium shimmer loading placeholders
 * Uses Reanimated for smooth 60fps shimmer effect
 */
import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { borderRadius as br, sp } from '../../theme/spacing';
import { useEffect } from 'react';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> & {
  Text: typeof SkeletonText;
  Card: typeof SkeletonCard;
  Avatar: typeof SkeletonAvatar;
  ListItem: typeof SkeletonListItem;
} = ({
  width = '100%',
  height = 16,
  borderRadius = br.sm,
  style,
  animated = true,
}) => {
  const { colors, isDark } = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      false,
    );
  }, [animated, shimmerValue]);

  const animatedShimmer = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        shimmerValue.value,
        [0, 0.5, 1],
        [0.3, 0.6, 0.3],
      ),
    };
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          overflow: 'hidden',
        },
        animated && animatedShimmer,
        style,
      ]}
    />
  );
};

// Skeleton.Text
interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  spacing?: number;
  lastLineWidth?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
}

const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lineHeight = 14,
  spacing = sp.sm,
  lastLineWidth = '60%',
  style,
}) => {
  return (
    <View style={[styles.textContainer, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          style={index > 0 ? { marginTop: spacing } : undefined}
        />
      ))}
    </View>
  );
};

// Skeleton.Card
interface SkeletonCardProps {
  hasImage?: boolean;
  imageHeight?: number;
  style?: StyleProp<ViewStyle>;
}

const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasImage = true,
  imageHeight = 180,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {hasImage && (
        <Skeleton
          width="100%"
          height={imageHeight}
          borderRadius={0}
          style={styles.cardImage}
        />
      )}
      <View style={styles.cardContent}>
        <Skeleton width="80%" height={20} />
        <Skeleton width="50%" height={14} style={{ marginTop: sp.sm }} />
        <SkeletonText lines={2} style={{ marginTop: sp.md }} />
      </View>
    </View>
  );
};

// Skeleton.Avatar
interface SkeletonAvatarProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 48,
  style,
}) => {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
};

// Skeleton.ListItem
interface SkeletonListItemProps {
  hasAvatar?: boolean;
  avatarSize?: number;
  lines?: number;
  style?: StyleProp<ViewStyle>;
}

const SkeletonListItem: React.FC<SkeletonListItemProps> = ({
  hasAvatar = true,
  avatarSize = 48,
  lines = 2,
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.listItem,
        {
          backgroundColor: colors.bgSecondary,
          borderBottomColor: colors.border,
        },
        style,
      ]}
    >
      {hasAvatar && (
        <SkeletonAvatar size={avatarSize} style={styles.listItemAvatar} />
      )}
      <View style={styles.listItemContent}>
        <Skeleton width="70%" height={16} />
        {lines > 1 && (
          <Skeleton width="50%" height={12} style={{ marginTop: sp.xs }} />
        )}
        {lines > 2 && (
          <Skeleton width="90%" height={12} style={{ marginTop: sp.xs }} />
        )}
      </View>
    </View>
  );
};

// Attach sub-components
Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;
Skeleton.Avatar = SkeletonAvatar;
Skeleton.ListItem = SkeletonListItem;

// Video Card Skeleton for History/Dashboard
export const VideoCardSkeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({
  style,
}) => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.videoCard,
        {
          backgroundColor: colors.bgSecondary,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Skeleton width="100%" height={180} borderRadius={br.lg} />
      <View style={styles.videoCardContent}>
        <Skeleton width="90%" height={18} />
        <Skeleton width="60%" height={18} style={{ marginTop: sp.xs }} />
        <View style={styles.videoCardMeta}>
          <SkeletonAvatar size={24} />
          <Skeleton width={100} height={14} style={{ marginLeft: sp.sm }} />
          <Skeleton width={50} height={14} style={{ marginLeft: 'auto' }} />
        </View>
        <View style={styles.videoCardTags}>
          <Skeleton width={60} height={24} borderRadius={br.full} />
          <Skeleton width={80} height={24} borderRadius={br.full} style={{ marginLeft: sp.sm }} />
        </View>
      </View>
    </View>
  );
};

// Analysis Screen Skeleton
export const AnalysisSkeleton: React.FC = () => {
  return (
    <View style={styles.analysisContainer}>
      <View style={styles.analysisHeader}>
        <Skeleton width={40} height={40} borderRadius={br.full} />
        <View style={styles.analysisHeaderText}>
          <Skeleton width="80%" height={20} />
          <Skeleton width="50%" height={14} style={{ marginTop: sp.xs }} />
        </View>
      </View>
      <Skeleton
        width="100%"
        height={8}
        borderRadius={br.full}
        style={{ marginVertical: sp.lg }}
      />
      <SkeletonText lines={8} lineHeight={16} spacing={sp.md} />
    </View>
  );
};

const styles = StyleSheet.create({
  textContainer: {
    width: '100%',
  },
  card: {
    borderRadius: br.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardContent: {
    padding: sp.lg,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemAvatar: {
    marginRight: sp.md,
  },
  listItemContent: {
    flex: 1,
  },
  videoCard: {
    borderRadius: br.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  videoCardContent: {
    padding: sp.lg,
  },
  videoCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.md,
  },
  videoCardTags: {
    flexDirection: 'row',
    marginTop: sp.md,
  },
  analysisContainer: {
    padding: sp.lg,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisHeaderText: {
    flex: 1,
    marginLeft: sp.md,
  },
});

export default Skeleton;
