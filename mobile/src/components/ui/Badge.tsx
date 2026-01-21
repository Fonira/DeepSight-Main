import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';

interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  size = 'sm',
  style,
  textStyle,
}) => {
  const { colors } = useTheme();

  const variantColors: Record<string, { bg: string; text: string }> = {
    default: { bg: colors.bgElevated, text: colors.textSecondary },
    primary: { bg: `${colors.accentPrimary}20`, text: colors.accentPrimary },
    success: { bg: `${colors.accentSuccess}20`, text: colors.accentSuccess },
    warning: { bg: `${colors.accentWarning}20`, text: colors.accentWarning },
    error: { bg: `${colors.accentError}20`, text: colors.accentError },
    info: { bg: `${colors.accentInfo}20`, text: colors.accentInfo },
  };

  const sizeStyles: Record<string, { padding: ViewStyle; fontSize: number }> = {
    sm: {
      padding: { paddingVertical: 2, paddingHorizontal: Spacing.sm },
      fontSize: Typography.fontSize.xs,
    },
    md: {
      padding: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
      fontSize: Typography.fontSize.sm,
    },
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: variantColors[variant].bg },
        sizeStyles[size].padding,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: variantColors[variant].text, fontSize: sizeStyles[size].fontSize },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: Typography.fontFamily.bodyMedium,
  },
});

export default Badge;
