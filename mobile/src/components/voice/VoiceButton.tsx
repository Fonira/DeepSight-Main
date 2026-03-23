/**
 * VoiceButton — FAB for voice chat with ElevenLabs
 * Circular 56px button, gold accent, pulse animation, plan-gated
 */

import React, { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useVoiceChatGate } from '../../contexts/PlanContext';
import { palette } from '../../theme/colors';
import { shadows } from '../../theme/shadows';

interface VoiceButtonProps {
  summaryId: string;
  videoTitle: string;
  onSessionStart?: () => void;
  disabled?: boolean;
}

const BUTTON_SIZE = 56;
const RING_SIZE = 72;

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  summaryId,
  videoTitle,
  onSessionStart,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const { enabled, requiresUpgrade } = useVoiceChatGate();

  // Pulse ring animation
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0.5);

  React.useEffect(() => {
    ringScale.value = withRepeat(
      withSequence(
        withSpring(1.3, { damping: 8, stiffness: 80, mass: 0.8 }),
        withSpring(1, { damping: 12, stiffness: 100, mass: 0.8 }),
      ),
      -1,
      false,
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withSpring(0.15, { damping: 10, stiffness: 60 }),
        withSpring(0.5, { damping: 10, stiffness: 60 }),
      ),
      -1,
      false,
    );
  }, [ringScale, ringOpacity]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (requiresUpgrade) {
      Alert.alert(
        'Fonctionnalité Premium',
        'Le chat vocal est disponible avec un abonnement supérieur. Mettez à niveau pour débloquer cette fonctionnalité.',
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Voir les plans', style: 'default' },
        ],
      );
      return;
    }

    onSessionStart?.();
  }, [disabled, requiresUpgrade, onSessionStart]);

  const iconName = requiresUpgrade ? 'lock-closed-outline' : 'mic-outline';
  const buttonOpacity = disabled ? 0.5 : 1;
  const glowShadow = shadows.glow(palette.gold);

  return (
    <View
      style={styles.container}
      pointerEvents={disabled ? 'none' : 'auto'}
    >
      {/* Pulse ring (only when feature is available) */}
      {enabled && !disabled && (
        <Animated.View
          style={[
            styles.ring,
            { borderColor: palette.gold },
            ringAnimatedStyle,
          ]}
        />
      )}

      <Pressable
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: palette.gold,
            opacity: pressed ? buttonOpacity * 0.85 : buttonOpacity,
            ...glowShadow,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          requiresUpgrade
            ? 'Chat vocal — plan premium requis'
            : `Démarrer le chat vocal pour ${videoTitle}`
        }
        accessibilityHint={
          requiresUpgrade
            ? 'Appuyez pour voir les plans disponibles'
            : 'Appuyez pour démarrer une conversation vocale avec l\'IA'
        }
      >
        <Ionicons name={iconName} size={24} color={palette.white} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 2,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
