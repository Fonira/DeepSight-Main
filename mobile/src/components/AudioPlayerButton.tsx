/**
 * AudioPlayerButton v2 — Mobile TTS button with premium gate
 * Uses TTSContext for language/gender/speed settings
 */

import React from 'react';
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
  const { isPlaying, isLoading, isPremium, playText, stopPlaying } = useTTSContext();
  const { colors } = useTheme();

  const handlePress = () => {
    if (!isPremium) {
      onUpgradePress?.();
      return;
    }
    if (isPlaying) {
      stopPlaying();
    } else {
      playText(text);
    }
  };

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

  const iconColor = isPlaying ? '#06B6D4' : colors.textSecondary;
  const bgColor = isPlaying ? 'rgba(6, 182, 212, 0.15)' : colors.glassBg;

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
          borderColor: isPlaying ? 'rgba(6, 182, 212, 0.3)' : 'transparent',
          opacity: isLoading ? 0.6 : 1,
        },
      ]}
      accessibilityLabel={isPlaying ? 'Arrêter la lecture' : 'Écouter'}
      accessibilityRole="button"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={colors.textSecondary} />
      ) : (
        <Ionicons
          name={isPlaying ? 'volume-mute' : 'volume-high'}
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
