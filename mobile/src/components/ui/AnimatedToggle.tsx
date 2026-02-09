/**
 * AnimatedToggle - Premium animated switch with Reanimated
 * Smooth knob slide + color transition + haptic feedback
 */
import React, { useEffect, useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { springs } from '../../theme/animations';

interface AnimatedToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const TRACK_SIZES = {
  sm: { width: 44, height: 26, knob: 22, padding: 2 },
  md: { width: 52, height: 30, knob: 26, padding: 2 },
};

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
  size = 'md',
  style,
}) => {
  const { colors } = useTheme();
  const progress = useSharedValue(value ? 1 : 0);
  const dims = TRACK_SIZES[size];

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, springs.slide);
  }, [value, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.bgTertiary, colors.accentPrimary],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: progress.value * (dims.width - dims.knob - dims.padding * 2),
      },
    ],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onValueChange(!value);
  }, [disabled, value, onValueChange]);

  return (
    <Pressable onPress={handlePress} disabled={disabled} style={style}>
      <Animated.View
        style={[
          styles.track,
          {
            width: dims.width,
            height: dims.height,
            borderRadius: dims.height / 2,
            padding: dims.padding,
          },
          trackStyle,
          disabled && { opacity: 0.5 },
        ]}
      >
        <Animated.View
          style={[
            styles.knob,
            {
              width: dims.knob,
              height: dims.knob,
              borderRadius: dims.knob / 2,
            },
            knobStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
  knob: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
});

export default AnimatedToggle;
