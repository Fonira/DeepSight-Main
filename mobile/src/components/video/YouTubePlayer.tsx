import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { BorderRadius, Spacing, Typography } from '../../constants/theme';
import { formatDuration } from '../../utils/formatters';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  channel?: string;
  duration?: number;
  thumbnail?: string;
  timestamp?: number;
  onTimestampChange?: (timestamp: number) => void;
  compact?: boolean;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoId,
  title,
  channel,
  duration,
  thumbnail,
  timestamp = 0,
  onTimestampChange,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);

  const thumbnailUrl = thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  const fallbackThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const handlePlay = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Open YouTube with timestamp if provided
      const timeParam = timestamp > 0 ? `&t=${Math.floor(timestamp)}` : '';
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}${timeParam}`;

      // Try to open in YouTube app first, fallback to browser
      const youtubeAppUrl = `vnd.youtube://watch?v=${videoId}${timeParam}`;

      const canOpenApp = await Linking.canOpenURL(youtubeAppUrl);
      if (canOpenApp) {
        await Linking.openURL(youtubeAppUrl);
      } else {
        await Linking.openURL(youtubeUrl);
      }
    } catch (error) {
      if (__DEV__) { console.error('Failed to open YouTube:', error); }
      // Fallback to web URL
      const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
      await Linking.openURL(youtubeUrl);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimestampPress = (ts: number) => {
    Haptics.selectionAsync();
    if (onTimestampChange) {
      onTimestampChange(ts);
    }
    // Open at specific timestamp
    const timeParam = `&t=${Math.floor(ts)}`;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}${timeParam}`;
    Linking.openURL(youtubeUrl);
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.bgElevated }]}
        onPress={handlePlay}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.compactThumbnail}
          contentFit="cover"
          placeholder={{ uri: fallbackThumbnailUrl }}
        />
        <View style={styles.compactPlayOverlay}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="play" size={20} color="#FFFFFF" />
          )}
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {title || t.common.video}
          </Text>
          {channel && (
            <Text style={[styles.compactChannel, { color: colors.textTertiary }]} numberOfLines={1}>
              {channel}
            </Text>
          )}
        </View>
        {duration && (
          <View style={[styles.durationBadge, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
      {/* Video Thumbnail with Play Button Overlay */}
      <TouchableOpacity
        style={styles.thumbnailContainer}
        onPress={handlePlay}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          placeholder={{ uri: fallbackThumbnailUrl }}
        />

        {/* Dark gradient overlay */}
        <View style={styles.gradientOverlay} />

        {/* Play button */}
        <View style={[styles.playButton, { backgroundColor: colors.accentPrimary }]}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <Ionicons name="play" size={32} color="#FFFFFF" />
          )}
        </View>

        {/* Duration badge */}
        {duration && (
          <View style={[styles.durationBadge, styles.durationBadgePosition]}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}

        {/* YouTube logo */}
        <View style={styles.youtubeLogoContainer}>
          <Ionicons name="logo-youtube" size={24} color="#FF0000" />
        </View>
      </TouchableOpacity>

      {/* Video Info */}
      <View style={styles.infoContainer}>
        {title && (
          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {title}
          </Text>
        )}
        {channel && (
          <View style={styles.channelRow}>
            <Ionicons name="person-circle-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.channel, { color: colors.textSecondary }]}>
              {channel}
            </Text>
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={[styles.controls, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.bgTertiary }]}
          onPress={handlePlay}
        >
          <Ionicons name="play-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.controlText, { color: colors.textPrimary }]}>
            {t.dashboard.videoFound}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.bgTertiary }]}
          onPress={() => {
            Haptics.selectionAsync();
            Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
          }}
        >
          <Ionicons name="open-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.controlText, { color: colors.textPrimary }]}>
            YouTube
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Timestamp link component for clickable timestamps in text
interface TimestampLinkProps {
  timestamp: number;
  videoId: string;
  children?: React.ReactNode;
}

export const TimestampLink: React.FC<TimestampLinkProps> = ({
  timestamp,
  videoId,
  children,
}) => {
  const { colors } = useTheme();

  const handlePress = () => {
    Haptics.selectionAsync();
    const timeParam = `&t=${Math.floor(timestamp)}`;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}${timeParam}`;
    Linking.openURL(youtubeUrl);
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text style={[styles.timestampLink, { color: colors.accentPrimary }]}>
        {children || formatDuration(timestamp)}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    borderRadius: 32,
    marginLeft: -32,
    marginTop: -32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  durationBadgePosition: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  youtubeLogoContainer: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  infoContainer: {
    padding: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  channel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  controls: {
    flexDirection: 'row',
    padding: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  controlText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  compactThumbnail: {
    width: 80,
    height: 45,
    borderRadius: BorderRadius.sm,
  },
  compactPlayOverlay: {
    position: 'absolute',
    left: Spacing.sm,
    width: 80,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: BorderRadius.sm,
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  compactChannel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: 2,
  },
  timestampLink: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    textDecorationLine: 'underline',
  },
});

export default YouTubePlayer;
