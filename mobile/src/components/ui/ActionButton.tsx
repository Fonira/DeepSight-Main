import React from "react";
import { Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  style?: object;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  onPress,
  color,
  disabled = false,
  style,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(0);

  const accentColor = color || colors.accentPrimary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: `${accentColor}${Math.round(bgOpacity.value * 255)
      .toString(16)
      .padStart(2, "0")}`,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.88, { damping: 12, stiffness: 300 });
    bgOpacity.value = withSpring(0.15, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    bgOpacity.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <AnimatedPressable
      style={[styles.container, animatedStyle, style]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.bgElevated },
          bgAnimatedStyle,
        ]}
      >
        <Ionicons name={icon} size={22} color={accentColor} />
      </Animated.View>
      <Text
        style={[styles.label, { color: colors.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    minWidth: 72,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: sp.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bodyMedium,
    textAlign: "center",
  },
});

export default ActionButton;
