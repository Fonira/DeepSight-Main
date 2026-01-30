/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  ✨ DEEPSIGHT SPINNER — React Native Loading Animation                             ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Cosmic compass wheel with smooth rotation                                        ║
 * ║  - Pulsing glow effect                                                             ║
 * ║  - Blue/Orange gradient                                                            ║
 * ║  - Sizes: xs, sm, md, lg, xl                                                       ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Text } from 'react-native';
import Svg, { 
  Circle, 
  Line, 
  Defs, 
  LinearGradient, 
  Stop, 
  G 
} from 'react-native-svg';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface DeepSightSpinnerProps {
  size?: SpinnerSize;
  label?: string;
  showLabel?: boolean;
  style?: object;
}

const sizeConfig: Record<SpinnerSize, { container: number; wheel: number; stroke: number }> = {
  xs: { container: 24, wheel: 20, stroke: 2 },
  sm: { container: 32, wheel: 28, stroke: 2.5 },
  md: { container: 48, wheel: 42, stroke: 3 },
  lg: { container: 64, wheel: 56, stroke: 3.5 },
  xl: { container: 96, wheel: 84, stroke: 4 },
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export const DeepSightSpinner: React.FC<DeepSightSpinnerProps> = ({
  size = 'md',
  label = 'Chargement...',
  showLabel = false,
  style,
}) => {
  const config = sizeConfig[size];
  const center = config.wheel / 2;
  const radius = (config.wheel - config.stroke) / 2 - 2;
  const innerRadius = radius * 0.25;
  
  // Animations
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.8)).current;
  const sparkleValues = useRef([...Array(6)].map(() => new Animated.Value(0))).current;
  
  useEffect(() => {
    // Spin animation
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    
    // Pulse animation
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
    
    // Sparkle animations
    const sparkleAnimations = sparkleValues.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 300),
          Animated.timing(value, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    
    spinAnimation.start();
    pulseAnimation.start();
    sparkleAnimations.forEach(anim => anim.start());
    
    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
      sparkleAnimations.forEach(anim => anim.stop());
    };
  }, []);
  
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  // Generate spoke positions
  const spokes = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x1: center + innerRadius * Math.cos(rad),
      y1: center + innerRadius * Math.sin(rad),
      x2: center + (radius - config.stroke) * Math.cos(rad),
      y2: center + (radius - config.stroke) * Math.sin(rad),
      opacity: 0.7 + (i % 2) * 0.3,
    };
  });
  
  // Cardinal accents
  const accents = [0, 90, 180, 270].map((angle) => {
    const rad = (angle * Math.PI) / 180;
    return {
      cx: center + (radius + 2) * Math.cos(rad - Math.PI/2),
      cy: center + (radius + 2) * Math.sin(rad - Math.PI/2),
    };
  });

  return (
    <View style={[styles.container, style]}>
      {/* Glow background */}
      <Animated.View 
        style={[
          styles.glow,
          {
            width: config.container * 1.5,
            height: config.container * 1.5,
            borderRadius: config.container,
            opacity: pulseValue,
          }
        ]}
      >
        <ExpoLinearGradient
          colors={['rgba(59,130,246,0.4)', 'rgba(249,115,22,0.3)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>
      
      {/* Spinning wheel */}
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Svg
          width={config.container}
          height={config.container}
          viewBox={`0 0 ${config.wheel} ${config.wheel}`}
        >
          <Defs>
            <LinearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#3B82F6" />
              <Stop offset="50%" stopColor="#8B5CF6" />
              <Stop offset="100%" stopColor="#F97316" />
            </LinearGradient>
          </Defs>
          
          {/* Outer ring */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth={config.stroke}
            opacity={0.8}
          />
          
          {/* Inner ring */}
          <Circle
            cx={center}
            cy={center}
            r={innerRadius}
            fill="none"
            stroke="url(#gradient)"
            strokeWidth={config.stroke * 0.6}
            opacity={0.9}
          />
          
          {/* Spokes */}
          <G>
            {spokes.map((spoke, i) => (
              <Line
                key={i}
                x1={spoke.x1}
                y1={spoke.y1}
                x2={spoke.x2}
                y2={spoke.y2}
                stroke="url(#gradient)"
                strokeWidth={config.stroke * 0.7}
                strokeLinecap="round"
                opacity={spoke.opacity}
              />
            ))}
          </G>
          
          {/* Cardinal accents */}
          {accents.map((accent, i) => (
            <Circle
              key={`accent-${i}`}
              cx={accent.cx}
              cy={accent.cy}
              r={config.stroke * 0.8}
              fill="url(#gradient)"
            />
          ))}
          
          {/* Center dot */}
          <Circle
            cx={center}
            cy={center}
            r={config.stroke}
            fill="url(#gradient)"
          />
        </Svg>
      </Animated.View>
      
      {/* Sparkle particles */}
      {sparkleValues.map((value, i) => {
        const angle = i * 60;
        const rad = (angle * Math.PI) / 180;
        const x = config.container / 2 + (config.container * 0.4) * Math.cos(rad);
        const y = config.container / 2 + (config.container * 0.4) * Math.sin(rad);
        
        return (
          <Animated.View
            key={i}
            style={[
              styles.sparkle,
              {
                left: x - 2,
                top: y - 2,
                opacity: value,
                transform: [{
                  scale: value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1.2],
                  })
                }],
              }
            ]}
          />
        );
      })}
      
      {showLabel && (
        <Text style={styles.label}>{label}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    overflow: 'hidden',
  },
  sparkle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#60A5FA',
  },
  label: {
    marginTop: 8,
    fontSize: 14,
    color: '#9CA3AF',
  },
});

// Quick variants
export const DeepSightSpinnerSmall: React.FC<{ style?: object }> = (props) => (
  <DeepSightSpinner size="sm" {...props} />
);

export const DeepSightSpinnerLarge: React.FC<{ style?: object; label?: string }> = (props) => (
  <DeepSightSpinner size="lg" showLabel {...props} />
);

export default DeepSightSpinner;
