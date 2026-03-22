/**
 * AudioPlayerButton v2 — Mobile TTS button with premium gate
 * Uses TTSContext for language/gender/speed settings
 */

import React, { useCallback } from 'react';
import { Pressable, ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTTSContext } from '../contexts/TTSContext';
import { useTheme } from '../contexts/ThemeContext';

interface AudioPlayerButtonProps {
  text: string;
  size?: 'sm' | 'md';
  onUpgradePress?: () => void;
}

export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
  text,
  size = 'sm',
  onUpgradePress,
}) => {
  const { isPlaying, isLoading, isPremium, playText, stopPlaying, currentText } = useTTSContext();
  const { colors } = useTheme();

  const isThisPlaying = isPlaying && currentText === text;

  const handlePress = useCallback(() => {
    if (!isPremium) {
      onUpgradePress?.();
      return;
    }
    if (isThisPlaying) {
      stopPlaying();
    } else {
      playText(text);
    }
  }, [isPremium, isThisPlaying, text, stopPlaying, playText, onUpgradePress]);

  const iconSize = size === 'sm' ? 16 : 20;
  const btnSize = size === 'sm' ? 28 : 34;

  // Locked state
  if (!isPremium) {
    return (
      <Pressable
        onPress={handlePress}
        style={[
          styles.button,
          {
            width: btnSize,
            height: btnSize,
            backgroundColor: colors.bgTertiary,
            borderColor: 'transparent',
          },
        ]}
        accessibilityLabel="Lecture vocale (plan premium requis)"
        accessibilityRole="button"
      >
        <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />
      </Pressable>
    );
  }

  const iconColor = isThisPlaying ? '#06B6D4' : colors.textSecondary;
  const bgColor = isThisPlaying ? 'rgba(6, 182, 212, 0.15)' : colors.glassBg;

  return (
    <Pressable
      onPress={handlePress}
      disabled={isLoading}
      style={[
        styles.button,
        {
          width: btnSize,
          height: btnSize,
          backgroundColor: bgColor,
          borderColor: isThisPlaying ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
          opacity: isLoading ? 0.6 : 1,
        },
      ]}
      accessibilityLabel={isThisPlaying ? 'Arrêter la lecture' : 'Écouter'}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Ionicons
          name={isThisPlaying ? 'volume-mute' : 'volume-high'}
          size={iconSize}
          color={iconColor}
        />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
