/**
 * VideoMiniCard - Inline clickable video reference card
 *
 * Displayed inside chat messages when the AI references a specific video.
 * Shows a compact thumbnail + title that navigates to the analysis.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

export interface VideoMiniCardProps {
  videoId?: string;
  summaryId?: string;
  title: string;
  thumbnail?: string;
  channel?: string;
  onPress?: () => void;
}

export const VideoMiniCard: React.FC<VideoMiniCardProps> = ({
  title,
  thumbnail,
  channel,
  onPress,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      Haptics.selectionAsync();
      onPress();
    }
  };

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: `${colors.accentPrimary}10`,
          borderColor: `${colors.accentPrimary}30`,
        },
      ]}
      onPress={handlePress}
    >
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: colors.bgTertiary }]}>
          <Ionicons name="videocam" size={16} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.accentPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {channel && (
          <Text style={[styles.channel, { color: colors.textMuted }]} numberOfLines={1}>
            {channel}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={colors.accentPrimary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  thumbnail: {
    width: 48,
    height: 32,
    borderRadius: BorderRadius.sm,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  channel: {
    fontSize: Typography.fontSize.xs - 2,
    fontFamily: Typography.fontFamily.body,
    marginTop: 1,
  },
});

export default VideoMiniCard;
