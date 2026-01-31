import React, { ReactNode } from 'react';
import { StyleProp, ViewStyle, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleValue?: number;
  hapticFeedback?: boolean;
  hapticStyle?: 'light' | 'medium' | 'heavy';
  disabled?: boolean;
  delayLongPress?: number;
}

export const AnimatedPressable: React.FC<AnimatedPressableProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  scaleValue = 0.97,
  hapticFeedback = true,
  hapticStyle = 'light',
  disabled = false,
  delayLongPress = 500,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(scaleValue, {
      damping: 15,
      stiffness: 400,
    });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, {
      damping: 15,
      stiffness: 400,
    });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const handlePress = () => {
    if (disabled) return;

    if (hapticFeedback) {
      const hapticMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(hapticMap[hapticStyle]);
    }
    onPress?.();
  };

  const handleLongPress = () => {
    if (disabled) return;

    if (hapticFeedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onLongPress?.();
  };

  return (
    <AnimatedPressableBase
      onPress={handlePress}
      onLongPress={onLongPress ? handleLongPress : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      disabled={disabled}
      delayLongPress={delayLongPress}
    >
      {children}
    </AnimatedPressableBase>
  );
};

// Animated Card wrapper with subtle scale animation
interface AnimatedCardWrapperProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

export const AnimatedCardWrapper: React.FC<AnimatedCardWrapperProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  disabled = false,
}) => {
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={style}
      scaleValue={0.98}
      hapticFeedback={true}
      hapticStyle="light"
      disabled={disabled}
      delayLongPress={500}
    >
      {children}
    </AnimatedPressable>
  );
};

export default AnimatedPressable;
