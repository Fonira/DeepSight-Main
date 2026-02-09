import React, { useState, forwardRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { borderRadius, sp } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { timings } from '../../theme/animations';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  testID?: string;
}

export const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      onRightIconPress,
      containerStyle,
      secureTextEntry,
      style,
      testID,
      value,
      placeholder,
      onFocus: onFocusProp,
      onBlur: onBlurProp,
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPassword = secureTextEntry !== undefined;
    const showPassword = isPassword && isPasswordVisible;

    // Animated floating label
    const labelAnim = useSharedValue(value ? 1 : 0);

    useEffect(() => {
      if (value || isFocused) {
        labelAnim.value = withTiming(1, timings.standard);
      } else {
        labelAnim.value = withTiming(0, timings.standard);
      }
    }, [value, isFocused, labelAnim]);

    const animatedLabelStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateY: interpolate(labelAnim.value, [0, 1], [0, -22]) },
          { scale: interpolate(labelAnim.value, [0, 1], [1, 0.85]) },
        ],
        opacity: interpolate(labelAnim.value, [0, 1], [0.5, 1]),
      };
    });

    // Border color animation
    const focusAnim = useSharedValue(0);

    useEffect(() => {
      focusAnim.value = withTiming(isFocused ? 1 : 0, timings.standard);
    }, [isFocused, focusAnim]);

    const borderColor = error
      ? colors.accentError
      : isFocused
      ? colors.borderFocus
      : colors.border;

    const handleFocus = (e: any) => {
      setIsFocused(true);
      onFocusProp?.(e);
    };

    const handleBlur = (e: any) => {
      setIsFocused(false);
      onBlurProp?.(e);
    };

    return (
      <View style={[styles.container, containerStyle]}>
        {label && !props.multiline && (
          <Animated.Text
            style={[
              styles.floatingLabel,
              animatedLabelStyle,
              {
                color: error
                  ? colors.accentError
                  : isFocused
                  ? colors.accentPrimary
                  : colors.textTertiary,
              },
            ]}
          >
            {label}
          </Animated.Text>
        )}

        {label && props.multiline && (
          <Text style={[styles.staticLabel, { color: colors.textSecondary }]}>
            {label}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.bgElevated,
              borderColor,
            },
            isFocused && {
              borderColor: colors.borderFocus,
            },
          ]}
        >
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={isFocused ? colors.accentPrimary : colors.textTertiary}
              style={styles.leftIcon}
            />
          )}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              { color: colors.textPrimary },
              leftIcon && { paddingLeft: 0 },
              (rightIcon || isPassword) && { paddingRight: 0 },
              style,
            ]}
            placeholderTextColor={colors.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={isPassword && !showPassword}
            value={value}
            placeholder={label && !props.multiline ? (isFocused || value ? placeholder : label) : placeholder}
            {...props}
          />

          {isPassword && (
            <Pressable
              testID={testID ? `${testID}-password-toggle` : 'password-toggle'}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.rightIcon}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          )}

          {rightIcon && !isPassword && (
            <Pressable
              testID={testID ? `${testID}-right-icon` : 'right-icon-button'}
              onPress={onRightIconPress}
              style={styles.rightIcon}
              hitSlop={8}
              disabled={!onRightIconPress}
            >
              <Ionicons
                name={rightIcon}
                size={20}
                color={colors.textTertiary}
              />
            </Pressable>
          )}
        </View>

        {error && (
          <Text style={[styles.error, { color: colors.accentError }]}>
            {error}
          </Text>
        )}

        {hint && !error && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {hint}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  container: {
    marginBottom: sp.lg,
    position: 'relative',
  },
  floatingLabel: {
    position: 'absolute',
    left: sp.lg,
    top: sp.lg,
    fontSize: fontSize.base,
    fontFamily: fontFamily.bodyMedium,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
  staticLabel: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bodyMedium,
    marginBottom: sp.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingHorizontal: sp.md,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.body,
    paddingVertical: sp.md,
    paddingHorizontal: sp.sm,
  },
  leftIcon: {
    marginRight: sp.sm,
  },
  rightIcon: {
    marginLeft: sp.sm,
    padding: sp.xs,
  },
  error: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
  },
  hint: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.body,
    marginTop: sp.xs,
  },
});

export default Input;
