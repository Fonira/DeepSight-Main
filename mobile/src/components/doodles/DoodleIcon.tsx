import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../contexts/ThemeContext";
import { DOODLE_MAP, DoodleName } from "./doodlePaths";

interface DoodleIconProps {
  name: DoodleName;
  size?: number;
  color?: string;
  animated?: boolean;
  strokeWidth?: number;
  style?: any;
  rotation?: number;
}

/**
 * DoodleIcon Component
 * Renders SVG doodle icons with optional animations
 *
 * @param name - Icon name from DOODLE_MAP (e.g., 'play', 'book', 'sparkles')
 * @param size - Icon size in pixels (default: 24)
 * @param color - Icon color (default: theme accentPrimary)
 * @param animated - Enable floating animation (default: false)
 * @param strokeWidth - SVG stroke width (default: 2)
 * @param style - Additional styles
 * @param rotation - Initial rotation in degrees (default: 0)
 */
export const DoodleIcon: React.FC<DoodleIconProps> = ({
  name,
  size = 24,
  color,
  animated = false,
  strokeWidth = 2,
  style,
  rotation = 0,
}) => {
  const { colors } = useTheme();
  const iconColor = color || colors.accentPrimary;

  // Get SVG path from DOODLE_MAP
  const svgPath = DOODLE_MAP[name];

  if (!svgPath) {
    console.warn(`DoodleIcon: Unknown icon name "${name}"`);
    return null;
  }

  // Animated style for floating effect
  const animatedStyle = useAnimatedStyle(() => {
    if (!animated) {
      return {
        transform: [{ rotate: `${rotation}deg` }],
      };
    }

    // Floating oscillation animation
    const floatingY = withRepeat(
      withSequence(
        withTiming(-4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(4, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );

    return {
      transform: [{ translateY: floatingY }, { rotate: `${rotation}deg` }],
    };
  }, [animated, rotation]);

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={iconColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={svgPath} />
      </Svg>
    </Animated.View>
  );
};

export default DoodleIcon;
