import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
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
 * GlassCard - Composant carte avec effet verre dépoli (glass morphism)
 *
 * Utilise expo-blur pour créer un effet de flou derrière le contenu.
 * S'adapte automatiquement au thème dark/light.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  intensity = 25,
  style,
  padding = 'lg',
  borderRadius = 'lg',
}) => {
  const { isDark, colors } = useTheme();

  const paddingValue = typeof padding === 'number' ? padding : Spacing[padding];
  const borderRadiusValue = typeof borderRadius === 'number' ? borderRadius : BorderRadius[borderRadius];

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius: borderRadiusValue,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
        style,
      ]}
    >
      <BlurView
        intensity={intensity}
        tint={isDark ? 'dark' : 'light'}
        style={[
          styles.blur,
          {
            borderRadius: borderRadiusValue,
            padding: paddingValue,
          },
        ]}
      >
        {/* Overlay pour améliorer le contraste */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(17, 17, 19, 0.7)'
                : 'rgba(255, 255, 255, 0.7)',
              borderRadius: borderRadiusValue,
            },
          ]}
        />
        {/* Contenu */}
        <View style={styles.content}>
          {children}
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassCard;
