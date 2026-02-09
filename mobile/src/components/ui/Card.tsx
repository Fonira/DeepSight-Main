import React, { ReactNode, useCallback } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  ViewStyle,
  StyleProp,
  PressableProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import { borderRadius, sp } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { gradients } from '../../theme/colors';
import { springs } from '../../theme/animations';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CardProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'glass' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  pressable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  style,
  pressable = false,
  onPress,
  ...props
}) => {
  const { colors, isDark } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, springs.gentle);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.gentle);
  }, [scale]);

  const paddingValues: Record<string, number> = {
    none: 0,
    sm: sp.sm,
    md: sp.md,
    lg: sp.lg,
  };

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: colors.bgCard,
      borderWidth: 1,
      borderColor: colors.border,
    },
    elevated: {
      backgroundColor: colors.bgElevated,
      borderWidth: 1,
      borderColor: colors.border,
      ...(isDark ? {} : shadows.md),
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    glass: {
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
    },
    gradient: {
      backgroundColor: 'transparent',
      borderWidth: 0,
    },
  };

  const cardStyle: ViewStyle = {
    ...styles.card,
    ...variantStyles[variant],
    padding: paddingValues[padding],
  };

  if (variant === 'gradient') {
    const inner = (
      <LinearGradient
        colors={isDark ? gradients.card : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.005)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, { padding: paddingValues[padding], borderWidth: 1, borderColor: colors.glassBorder }]}
      >
        {children}
      </LinearGradient>
    );

    if (pressable || onPress) {
      return (
        <AnimatedPressable
          style={[animatedStyle, style]}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          {...props}
        >
          {inner}
        </AnimatedPressable>
      );
    }
    return <View style={style}>{inner}</View>;
  }

  if (pressable || onPress) {
    return (
      <AnimatedPressable
        style={[animatedStyle, cardStyle, style]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        {...props}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});

export default Card;
