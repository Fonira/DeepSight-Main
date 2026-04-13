/**
 * SkeletonCard — DeepSight-branded skeleton loader
 *
 * Replaces generic grey shimmer with brand gradient (indigo → violet).
 * Two variants matching real card layouts:
 *   - compact: horizontal layout matching AnalysisCard (thumbnail 80×60 + text + badge)
 *   - hero: full-width card for the featured/latest result
 */
import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  ReduceMotion,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIMMER_DURATION = 1200;
const SHIMMER_WIDTH_RATIO = 0.6; // gradient band = 60% of container

const COMPACT_THUMB_W = 80;
const COMPACT_THUMB_H = 60;

const HERO_ASPECT = 16 / 9;

// Brand shimmer colors — indigo #6366f1 → violet #8b5cf6 at low opacity
const SHIMMER_COLORS_DARK = [
  "transparent",
  "rgba(99, 102, 241, 0.12)",
  "rgba(139, 92, 246, 0.18)",
  "rgba(99, 102, 241, 0.12)",
  "transparent",
] as const;

const SHIMMER_COLORS_LIGHT = [
  "transparent",
  "rgba(99, 102, 241, 0.10)",
  "rgba(139, 92, 246, 0.14)",
  "rgba(99, 102, 241, 0.10)",
  "transparent",
] as const;

// ---------------------------------------------------------------------------
// ShimmerBlock — a single placeholder rectangle with animated gradient overlay
// ---------------------------------------------------------------------------

interface ShimmerBlockProps {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: object;
}

// Wrap gradient in Animated.View instead of animating LinearGradient directly
// to avoid TS issues with Animated.createAnimatedComponent color tuple types

const ShimmerBlock: React.FC<ShimmerBlockProps> = ({
  width,
  height,
  radius = borderRadius.sm,
  style,
}) => {
  const { isDark } = useTheme();
  const translateX = useSharedValue(-1);

  React.useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
    );
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value * 200 }],
  }));

  const { colors } = useTheme();
  const baseBg = colors.bgCard;
  const shimmerColors = isDark ? SHIMMER_COLORS_DARK : SHIMMER_COLORS_LIGHT;

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: baseBg,
          overflow: "hidden",
        },
        style,
      ]}
      accessibilityLabel="Chargement"
      accessibilityRole="progressbar"
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { width: `${SHIMMER_WIDTH_RATIO * 100 + 100}%`, left: "-30%" },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[...shimmerColors]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// SkeletonCard
// ---------------------------------------------------------------------------

interface SkeletonCardProps {
  variant?: "compact" | "hero";
}

const SkeletonCardInner: React.FC<SkeletonCardProps> = ({
  variant = "compact",
}) => {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();

  if (variant === "hero") {
    const thumbH = Math.round((screenWidth - sp.lg * 2) / HERO_ASPECT);

    return (
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
          },
        ]}
        accessibilityLabel="Chargement de l'analyse"
      >
        {/* Full-width thumbnail placeholder */}
        <ShimmerBlock width="100%" height={thumbH} radius={0} />

        <View style={styles.heroContent}>
          {/* Title — 2 lines */}
          <ShimmerBlock width="90%" height={16} radius={4} />
          <ShimmerBlock
            width="65%"
            height={16}
            radius={4}
            style={styles.lineGap}
          />

          {/* Subtitle (channel + duration) */}
          <ShimmerBlock
            width="45%"
            height={12}
            radius={4}
            style={styles.subtitleGap}
          />

          {/* Badge placeholder */}
          <ShimmerBlock
            width={56}
            height={20}
            radius={borderRadius.full}
            style={styles.badgeGap}
          />
        </View>
      </View>
    );
  }

  // ------ Compact variant (matches AnalysisCard layout) ------
  return (
    <View
      style={[
        styles.compactCard,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel="Chargement de l'analyse"
    >
      {/* Thumbnail */}
      <View style={styles.compactThumbWrapper}>
        <ShimmerBlock
          width={COMPACT_THUMB_W}
          height={COMPACT_THUMB_H}
          radius={borderRadius.sm}
        />
        {/* Platform badge placeholder */}
        <View style={styles.badgeOverlay}>
          <ShimmerBlock width={18} height={18} radius={borderRadius.full} />
        </View>
      </View>

      {/* Text content */}
      <View style={styles.compactText}>
        {/* Title — 2 lines */}
        <ShimmerBlock width="92%" height={14} radius={4} />
        <ShimmerBlock
          width="60%"
          height={14}
          radius={4}
          style={styles.lineGap}
        />
        {/* Subtitle */}
        <ShimmerBlock
          width="40%"
          height={11}
          radius={4}
          style={styles.subtitleGap}
        />
      </View>

      {/* Favorite star placeholder */}
      <ShimmerBlock
        width={14}
        height={14}
        radius={borderRadius.full}
        style={styles.starPlaceholder}
      />
    </View>
  );
};

export const SkeletonCard = React.memo(SkeletonCardInner);

// ---------------------------------------------------------------------------
// SkeletonList — convenience: render N skeleton cards
// ---------------------------------------------------------------------------

interface SkeletonListProps {
  count?: number;
  variant?: "compact" | "hero";
  /** Render the first card as hero and the rest as compact */
  heroFirst?: boolean;
}

const SkeletonListInner: React.FC<SkeletonListProps> = ({
  count = 5,
  variant = "compact",
  heroFirst = false,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <View>
      {items.map((i) => (
        <SkeletonCard
          key={i}
          variant={heroFirst && i === 0 ? "hero" : variant}
        />
      ))}
    </View>
  );
};

export const SkeletonList = React.memo(SkeletonListInner);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Compact variant — matches AnalysisCard
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: sp.sm,
  },
  compactThumbWrapper: {
    position: "relative",
  },
  badgeOverlay: {
    position: "absolute",
    top: 3,
    left: 3,
    zIndex: 2,
  },
  compactText: {
    flex: 1,
    marginLeft: sp.md,
  },
  starPlaceholder: {
    position: "absolute",
    top: sp.sm,
    right: sp.sm,
  },

  // Hero variant — full-width featured card
  heroCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: sp.md,
  },
  heroContent: {
    padding: sp.lg,
  },

  // Shared
  lineGap: {
    marginTop: 6,
  },
  subtitleGap: {
    marginTop: sp.sm,
  },
  badgeGap: {
    marginTop: sp.md,
  },
});
