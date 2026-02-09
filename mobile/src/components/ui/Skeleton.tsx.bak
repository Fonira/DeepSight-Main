/**
 * Skeleton - Composant de placeholder pour chargement
 *
 * Utilisation:
 * <Skeleton width={200} height={20} />
 * <Skeleton.Text lines={3} />
 * <Skeleton.Card />
 * <Skeleton.Avatar size={48} />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing } from '../../constants/theme';

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
  borderRadius = BorderRadius.sm,
  style,
  animated = true,
}) => {
  const { colors } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animated, animatedValue]);

  const opacity = animated
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.7],
      })
    : 0.5;

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.bgTertiary,
          opacity,
        },
        style,
      ]}
    />
  );
};

// Skeleton.Text - Multiple lines of text
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
  spacing = Spacing.sm,
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

// Skeleton.Card - Card placeholder
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
        <Skeleton width="50%" height={14} style={{ marginTop: Spacing.sm }} />
        <SkeletonText lines={2} style={{ marginTop: Spacing.md }} />
      </View>
    </View>
  );
};

// Skeleton.Avatar - Circular avatar placeholder
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

// Skeleton.ListItem - List item with avatar and text
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
          <Skeleton width="50%" height={12} style={{ marginTop: Spacing.xs }} />
        )}
        {lines > 2 && (
          <Skeleton width="90%" height={12} style={{ marginTop: Spacing.xs }} />
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
      {/* Thumbnail */}
      <Skeleton
        width="100%"
        height={180}
        borderRadius={BorderRadius.lg}
      />

      {/* Content */}
      <View style={styles.videoCardContent}>
        {/* Title */}
        <Skeleton width="90%" height={18} />
        <Skeleton width="60%" height={18} style={{ marginTop: Spacing.xs }} />

        {/* Channel + Duration */}
        <View style={styles.videoCardMeta}>
          <SkeletonAvatar size={24} />
          <Skeleton width={100} height={14} style={{ marginLeft: Spacing.sm }} />
          <Skeleton width={50} height={14} style={{ marginLeft: 'auto' }} />
        </View>

        {/* Tags */}
        <View style={styles.videoCardTags}>
          <Skeleton width={60} height={24} borderRadius={BorderRadius.full} />
          <Skeleton width={80} height={24} borderRadius={BorderRadius.full} style={{ marginLeft: Spacing.sm }} />
        </View>
      </View>
    </View>
  );
};

// Analysis Screen Skeleton
export const AnalysisSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.analysisContainer}>
      {/* Header */}
      <View style={styles.analysisHeader}>
        <Skeleton width={40} height={40} borderRadius={BorderRadius.full} />
        <View style={styles.analysisHeaderText}>
          <Skeleton width="80%" height={20} />
          <Skeleton width="50%" height={14} style={{ marginTop: Spacing.xs }} />
        </View>
      </View>

      {/* Progress */}
      <Skeleton
        width="100%"
        height={8}
        borderRadius={BorderRadius.full}
        style={{ marginVertical: Spacing.lg }}
      />

      {/* Content */}
      <SkeletonText lines={8} lineHeight={16} spacing={Spacing.md} />
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  textContainer: {
    width: '100%',
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  cardContent: {
    padding: Spacing.lg,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listItemAvatar: {
    marginRight: Spacing.md,
  },
  listItemContent: {
    flex: 1,
  },
  videoCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  videoCardContent: {
    padding: Spacing.lg,
  },
  videoCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  videoCardTags: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  analysisContainer: {
    padding: Spacing.lg,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analysisHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});

export default Skeleton;
