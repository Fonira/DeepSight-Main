import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';

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
      ...props
    },
    ref
  ) => {
    const { colors } = useTheme();
    const [isFocused, setIsFocused] = useState(false);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const isPassword = secureTextEntry !== undefined;
    const showPassword = isPassword && isPasswordVisible;

    const borderColor = error
      ? colors.accentError
      : isFocused
      ? colors.accentPrimary
      : colors.border;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text style={[styles.label, { color: colors.textSecondary }]}>
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
          ]}
        >
          {leftIcon && (
            <Ionicons
              name={leftIcon}
              size={20}
              color={colors.textTertiary}
              style={styles.leftIcon}
            />
          )}

          <TextInput
            ref={ref}
            style={[
              styles.input,
              {
                color: colors.textPrimary,
              },
              leftIcon && { paddingLeft: 0 },
              (rightIcon || isPassword) && { paddingRight: 0 },
              style,
            ]}
            placeholderTextColor={colors.textMuted}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            secureTextEntry={isPassword && !showPassword}
            {...props}
          />

          {isPassword && (
            <TouchableOpacity
              testID={testID ? `${testID}-password-toggle` : 'password-toggle'}
              onPress={() => setIsPasswordVisible(!isPasswordVisible)}
              style={styles.rightIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          )}

          {rightIcon && !isPassword && (
            <TouchableOpacity
              testID={testID ? `${testID}-right-icon` : 'right-icon-button'}
              onPress={onRightIconPress}
              style={styles.rightIcon}
              disabled={!onRightIconPress}
            >
              <Ionicons
                name={rightIcon}
                size={20}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
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
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  error: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  hint: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
});

export default Input;
