import React, { useMemo } from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useSharedValue,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";
import { DOODLE_CATEGORIES, DoodleCategory } from "./doodlePaths";
import DoodleIcon from "./DoodleIcon";

export type EmptyStateVariant =
  | "no-analyses"
  | "no-flashcards"
  | "no-playlists"
  | "no-results"
  | "welcome";

interface EmptyStateConfig {
  icons: DoodleCategory[];
  title: string;
  message: string;
  accentColor: string;
}

interface DoodleEmptyStateProps {
  variant: EmptyStateVariant;
  title?: string;
  message?: string;
  style?: ViewStyle;
  iconSize?: number;
  showIcons?: boolean;
}

/**
 * DoodleEmptyState Component
 * Displays empty state with floating animated doodle icons
 *
 * Variants:
 * - no-analyses: VIDEO + ANALYTICS icons
 * - no-flashcards: STUDY + AI icons
 * - no-playlists: CREATIVE + TECH icons
 * - no-results: ABSTRACT + ANALYTICS icons
 * - welcome: All icons with accent color
 *
 * Features:
 * - Floating animations on icons (vertical oscillation)
 * - Staggered animation timing
 * - Theme-aware colors
 * - Customizable title/message
 */
export const DoodleEmptyState: React.FC<DoodleEmptyStateProps> = ({
  variant,
  title: customTitle,
  message: customMessage,
  style,
  iconSize = 32,
  showIcons = true,
}) => {
  const { colors } = useTheme();

  // Empty state configurations
  const configs: Record<EmptyStateVariant, EmptyStateConfig> = useMemo(
    () => ({
      "no-analyses": {
        icons: ["video", "analytics"],
        title: customTitle || "No Analyses Yet",
        message:
          customMessage ||
          "Start by analyzing a YouTube video to see results here.",
        accentColor: colors.accentPrimary,
      },
      "no-flashcards": {
        icons: ["study", "ai"],
        title: customTitle || "No Flashcards",
        message:
          customMessage ||
          "Create flashcards from your analyses to study effectively.",
        accentColor: colors.accentSecondary,
      },
      "no-playlists": {
        icons: ["creative", "tech"],
        title: customTitle || "No Playlists",
        message:
          customMessage ||
          "Organize your analyses into playlists for better learning.",
        accentColor: colors.accentTertiary,
      },
      "no-results": {
        icons: ["abstract", "analytics"],
        title: customTitle || "No Results Found",
        message:
          customMessage ||
          "Try adjusting your search or filters to find what you're looking for.",
        accentColor: colors.warning,
      },
      welcome: {
        icons: ["video", "study", "ai"],
        title: customTitle || "Welcome to DeepSight",
        message:
          customMessage ||
          "Analyze videos, create flashcards, and level up your learning.",
        accentColor: colors.accentPrimary,
      },
    }),
    [colors, customTitle, customMessage],
  );

  const config = configs[variant];

  // Select random icons from specified categories
  const selectedIcons = useMemo(() => {
    const icons: { name: string; delay: number }[] = [];
    let delay = 0;

    config.icons.forEach((category) => {
      const categoryIcons = DOODLE_CATEGORIES[category];
      const iconNames = Object.keys(categoryIcons) as string[];

      // Select 2-3 icons per category
      const count = Math.min(
        Math.floor(Math.random() * 2) + 2,
        iconNames.length,
      );
      const selected = new Set<number>();

      while (selected.size < count) {
        const idx = Math.floor(Math.random() * iconNames.length);
        if (!selected.has(idx)) {
          selected.add(idx);
          icons.push({
            name: iconNames[idx],
            delay,
          });
          delay += 200; // 200ms stagger between animations
        }
      }
    });

    return icons;
  }, [config, variant]);

  // Random rotation angles
  const rotations = useMemo(() => {
    return selectedIcons.map(() => {
      const angles = [
        0, 12, -12, 25, -25, 40, -40, 55, -55, 70, -70, 90, -90, 135, -135, 180,
      ];
      return angles[Math.floor(Math.random() * angles.length)];
    });
  }, [selectedIcons]);

  return (
    <View style={[styles.container, style]}>
      {/* Floating Icons Background */}
      {showIcons && (
        <View style={styles.iconGridContainer}>
          {selectedIcons.map((icon, index) => (
            <FloatingIcon
              key={`${variant}-${index}`}
              name={icon.name as any}
              color={config.accentColor}
              size={iconSize}
              delay={icon.delay}
              rotation={rotations[index]}
            />
          ))}
        </View>
      )}

      {/* Text Content */}
      <View style={styles.contentContainer}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {config.title}
        </Text>
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {config.message}
        </Text>
      </View>
    </View>
  );
};

/**
 * FloatingIcon Component
 * Individual icon with staggered floating animation
 */
interface FloatingIconProps {
  name: any;
  color: string;
  size: number;
  delay: number;
  rotation: number;
}

const FloatingIcon: React.FC<FloatingIconProps> = ({
  name,
  color,
  size,
  delay,
  rotation,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    // Staggered floating animation with delay
    const floatingY = withRepeat(
      withSequence(
        withTiming(-8, {
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(8, {
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );

    return {
      transform: [{ translateY: floatingY }, { rotate: `${rotation}deg` }],
    };
  }, [rotation]);

  return (
    <Animated.View style={animatedStyle}>
      <DoodleIcon
        name={name}
        size={size}
        color={color}
        animated={false}
        rotation={rotation}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconGridContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-around",
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.1,
    pointerEvents: "none",
  },
  contentContainer: {
    alignItems: "center",
    zIndex: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 24,
  },
});

export default DoodleEmptyState;
