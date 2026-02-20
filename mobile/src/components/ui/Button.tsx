import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { gradients } from '../../theme/colors';
import { borderRadius, sp } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { springs } from '../../theme/animations';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  haptic?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  haptic = true,
  disabled,
  onPress,
  style,
  ...props
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, springs.button);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.button);
  }, [scale]);

  const handlePress = useCallback((event: any) => {
    if (haptic && !disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.(event);
  }, [haptic, disabled, loading, onPress]);

  const sizeMap: Record<string, { container: ViewStyle; text: TextStyle }> = {
    sm: {
      container: { paddingVertical: sp.sm, paddingHorizontal: sp.md, minHeight: 36 },
      text: { fontSize: fontSize.sm },
    },
    md: {
      container: { paddingVertical: sp.md, paddingHorizontal: sp.lg, minHeight: 44 },
      text: { fontSize: fontSize.base },
    },
    lg: {
      container: { paddingVertical: sp.lg, paddingHorizontal: sp.xl, minHeight: 52 },
      text: { fontSize: fontSize.lg },
    },
  };

  const variantMap: Record<string, { container: ViewStyle; text: TextStyle }> = {
    primary: {
      container: {},
      text: { color: '#ffffff' },
    },
    secondary: {
      container: { backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border },
      text: { color: colors.textPrimary },
    },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderLight },
      text: { color: colors.textPrimary },
    },
    ghost: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.accentPrimary },
    },
    danger: {
      container: { backgroundColor: colors.accentError },
      text: { color: '#ffffff' },
    },
  };

  const containerStyle: ViewStyle = {
    ...styles.container,
    ...sizeMap[size].container,
    ...variantMap[variant].container,
    ...(fullWidth && { width: '100%' as any }),
    ...(disabled && { opacity: 0.5 }),
  };

  const textStyle: TextStyle = {
    ...styles.text,
    ...sizeMap[size].text,
    ...variantMap[variant].text,
  };

  const content = (
    <View style={styles.contentRow}>
      {loading ? (
        <ActivityIndicator size="small" color={variantMap[variant].text.color as string} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
          <Text style={textStyle}>{title}</Text>
          {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          animatedStyle,
          { borderRadius: borderRadius.lg },
          fullWidth && { width: '100%' as any },
          style,
        ]}
        {...props}
      >
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[containerStyle, { backgroundColor: undefined, borderWidth: 0 }]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[animatedStyle, containerStyle, style]}
      {...props}
    >
      {content}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamily.bodySemiBold,
    textAlign: 'center',
  },
  iconLeft: {
    marginRight: sp.sm,
  },
  iconRight: {
    marginLeft: sp.sm,
  },
});

export default Button;
