/**
 * TTSToggle — Mobile toggle for auto TTS playback
 */

import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTTSContext } from '../contexts/TTSContext';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

export const TTSToggle: React.FC = () => {
  const { autoPlayEnabled, setAutoPlayEnabled } = useTTSContext();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => setAutoPlayEnabled(!autoPlayEnabled)}
      style={[
        styles.button,
        {
          backgroundColor: autoPlayEnabled ? 'rgba(59, 130, 246, 0.12)' : colors.glassBg,
          borderColor: autoPlayEnabled ? 'rgba(59, 130, 246, 0.3)' : colors.glassBorder,
        },
      ]}
      accessibilityLabel={autoPlayEnabled ? 'Désactiver la voix auto' : 'Activer la voix auto'}
      accessibilityRole="button"
    >
      <Ionicons
        name={autoPlayEnabled ? 'volume-high' : 'volume-mute'}
        size={14}
        color={autoPlayEnabled ? '#3B82F6' : colors.textSecondary}
      />
      <Text
        style={[
          styles.label,
          { color: autoPlayEnabled ? '#3B82F6' : colors.textSecondary },
        ]}
      >
        Voix
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: sp.xs,
    paddingHorizontal: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
});
