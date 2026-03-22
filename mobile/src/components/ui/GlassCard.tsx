import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Spacing } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof Spacing | number;
  borderRadius?: keyof typeof BorderRadius | number;
}

/**
 * GlassCard - Composant carte avec fond solide
 *
 * Utilise les couleurs du thème pour un rendu solide et performant.
 * S'adapte automatiquement au thème dark/light.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 25, // Ignoré maintenant
  style,
  padding = 'lg',
  borderRadius = 'lg',
}) => {
  const { colors } = useTheme();

  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const borderRadiusValue = typeof borderRadius === 'number' ? borderRadius : BorderRadius[borderRadius];

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: borderRadiusValue,
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
          padding: paddingValue,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});

export default GlassCard;
