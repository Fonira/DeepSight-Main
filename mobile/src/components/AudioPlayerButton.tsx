/**
 * AudioPlayerButton — Mobile TTS toggle button
 * Pressable with Ionicons icon, plays/stops TTS via useTTS hook
 */

import React from 'react';
import { Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTTS } from '../hooks/useTTS';
import { useTheme } from '../contexts/ThemeContext';

interface AudioPlayerButtonProps {
  text: string;
  size?: 'sm' | 'md';
}

export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
  text,
  size = 'sm',
}) => {
  const { isPlaying, isLoading, error, play, stop } = useTTS();
  const { colors } = useTheme();

  const handlePress = () => {
    if (isPlaying) {
      stop();
    } else {
      play(text);
    }
  };

  const iconSize = size === 'sm' ? 16 : 20;
  const btnSize = size === 'sm' ? 28 : 34;

  const iconColor = isPlaying
    ? '#3B82F6'
    : error
      ? '#EF4444'
      : colors.textSecondary;

  const bgColor = isPlaying
    ? 'rgba(59, 130, 246, 0.15)'
    : error
      ? 'rgba(239, 68, 68, 0.1)'
      : colors.glassBg;

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
          borderColor: isPlaying ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
          opacity: isLoading ? 0.6 : 1,
        },
      ]}
      accessibilityLabel={isPlaying ? 'Stop audio' : 'Play audio'}
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
