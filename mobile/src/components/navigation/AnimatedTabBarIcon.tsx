/**
 * AnimatedTabBarIcon - Icone de tab animee avec effet bounce/scale
 *
 * Animations:
 * - Scale bounce quand l'onglet devient actif
 * - Transition de couleur smooth
 * - Support des badges de notification
 */

import React, { useEffect, useRef, memo } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { BorderRadius, Typography } from '../../constants/theme';

interface AnimatedTabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  color: string;
  size?: number;
  badge?: number;
}

export const AnimatedTabBarIcon: React.FC<AnimatedTabBarIconProps> = memo(({
  name,
  focused,
  color,
  size = 24,
  badge,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevFocusedRef = useRef(focused);

  useEffect(() => {
    // Only animate when becoming focused (not on initial render)
    if (focused && !prevFocusedRef.current) {
      // Bounce animation
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          useNativeDriver: true,
          friction: 3,
          tension: 100,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 3,
          tension: 100,
        }),
      ]).start();
    }

    prevFocusedRef.current = focused;
  }, [focused, scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconWrapper,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Ionicons name={name} size={size} color={color} />

        {/* Active indicator dot */}
        {focused && (
          <View
            style={[
              styles.activeIndicator,
              { backgroundColor: colors.accentPrimary },
            ]}
          />
        )}
      </Animated.View>

      {/* Badge */}
      {badge !== undefined && badge > 0 && (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.accentError },
          ]}
        >
          <Animated.Text
            style={[
              styles.badgeText,
              { color: '#FFFFFF' },
            ]}
          >
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}
    </View>
  );
});

AnimatedTabBarIcon.displayName = 'AnimatedTabBarIcon';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: 12,
  },
});

export default AnimatedTabBarIcon;
