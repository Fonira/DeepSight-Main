/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER — Logo qui tourne (vraie image)                              ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Utilise le VRAI logo DeepSight                                                  ║
 * ║  - Rotation fluide du gouvernail                                                   ║
 * ║  - Effets de glow cosmic en arrière-plan                                          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Easing, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Logo asset
const logoSource = require('../../../assets/logo.png');

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  showLabel?: boolean;
  /** Durée d'une rotation complète en ms */
  duration?: number;
  /** Afficher les effets de glow */
  showGlow?: boolean;
  style?: object;
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 24,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  label = 'Chargement...',
  showLabel = false,
  duration = 3000,
  showGlow = true,
  style,
}) => {
  const pixelSize = sizeMap[size];
  const glowSize = pixelSize * 1.5;
  
  // Animation de rotation
  const spinValue = useRef(new Animated.Value(0)).current;
  // Animation de pulse pour le glow
  const pulseValue = useRef(new Animated.Value(0.8)).current;
  
  useEffect(() => {
    // Rotation infinie
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Pulse du glow
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.8,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    spinAnimation.start();
    pulseAnimation.start();
    
    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
    };
  }, [duration]);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={[styles.container, style]}>
      <View style={{ width: glowSize, height: glowSize, alignItems: 'center', justifyContent: 'center' }}>
        
        {/* Glow cosmic background - STATIQUE (juste pulse) */}
        {showGlow && (
          <Animated.View 
            style={[
              styles.glowContainer,
              {
                width: glowSize,
                height: glowSize,
                borderRadius: glowSize / 2,
                opacity: pulseValue,
                transform: [{
                  scale: pulseValue.interpolate({
                    inputRange: [0.8, 1],
                    outputRange: [1, 1.1],
                  })
                }],
              }
            ]}
          >
            <LinearGradient
              colors={[
                'rgba(59, 130, 246, 0.4)',
                'rgba(139, 92, 246, 0.3)',
                'rgba(249, 115, 22, 0.4)',
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: glowSize / 2 }]}
            />
          </Animated.View>
        )}
        
        {/* Logo qui TOURNE */}
        <Animated.Image
          source={logoSource}
          style={[
            styles.logo,
            {
              width: pixelSize,
              height: pixelSize,
              transform: [{ rotate: spin }],
            }
          ]}
          resizeMode="contain"
        />
      </View>
      
      {showLabel && (
        <Animated.Text style={[styles.label, { opacity: pulseValue }]}>
          {label}
        </Animated.Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  logo: {
    zIndex: 10,
  },
  label: {
    marginTop: 12,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});

// Variants rapides
export const DeepSightSpinnerSmall: React.FC<{ style?: object }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ style?: object; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export default DeepSightSpinner;
