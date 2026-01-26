import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { Badge } from './ui';
import { BorderRadius, Spacing, Typography } from '../constants/theme';
import { formatDuration, formatRelativeTime, truncateText } from '../utils/formatters';
import type { AnalysisSummary, VideoInfo } from '../types';

interface VideoCardProps {
  video: AnalysisSummary | VideoInfo;
  onPress?: () => void;
  onFavoritePress?: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  showMode?: boolean;
  compact?: boolean;
}

const VideoCardComponent: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onFavoritePress,
  onLongPress,
  isFavorite = false,
  showMode = true,
  compact = false,
}) => {
  const { colors } = useTheme();

  // Handle both AnalysisSummary and VideoInfo types
  const videoInfo = 'videoInfo' in video
    ? video.videoInfo || {
        id: video.id,
        title: video.title || '',
        description: '',
        thumbnail: video.thumbnail || '',
        channel: video.channel || '',
        channelId: '',
        duration: video.duration || 0,
        publishedAt: '',
        viewCount: 0,
      }
    : video;
  const analysisSummary = 'videoInfo' in video ? video : null;

  const handleFavoritePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFavoritePress?.();
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactContainer, { backgroundColor: colors.bgCard }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: videoInfo.thumbnail }}
          style={styles.compactThumbnail}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.compactContent}>
          <Text
            style={[styles.compactTitle, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {videoInfo.title}
          </Text>
          <Text style={[styles.compactChannel, { color: colors.textTertiary }]}>
            {videoInfo.channel}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.bgCard }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: videoInfo.thumbnail }}
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
        {videoInfo.duration && (
          <View style={[styles.duration, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
            <Text style={styles.durationText}>
              {formatDuration(videoInfo.duration)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {videoInfo.title}
          </Text>
          {onFavoritePress && (
            <TouchableOpacity
              onPress={handleFavoritePress}
              style={styles.favoriteButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? colors.accentError : colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.channel, { color: colors.textSecondary }]}>
          {videoInfo.channel}
        </Text>

        <View style={styles.footer}>
          <View style={styles.badges}>
            {showMode && analysisSummary?.mode && (
              <Badge
                label={analysisSummary.mode}
                variant="primary"
                size="sm"
              />
            )}
            {analysisSummary?.category && (
              <Badge
                label={analysisSummary.category}
                variant="default"
                size="sm"
                style={{ marginLeft: Spacing.xs }}
              />
            )}
          </View>

          {analysisSummary?.createdAt && (
            <Text style={[styles.date, { color: colors.textTertiary }]}>
              {formatRelativeTime(analysisSummary.createdAt)}
            </Text>
          )}
        </View>

        {analysisSummary?.content && (
          <Text
            style={[styles.preview, { color: colors.textTertiary }]}
            numberOfLines={2}
          >
            {truncateText(analysisSummary.content.replace(/[#*`]/g, ''), 150)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  thumbnailContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  duration: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: Typography.fontSize.base * Typography.lineHeight.normal,
    marginRight: Spacing.sm,
  },
  favoriteButton: {
    padding: Spacing.xs,
  },
  channel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  date: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  preview: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.sm,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.relaxed,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  compactThumbnail: {
    width: 120,
    height: 68,
    borderRadius: BorderRadius.sm,
  },
  compactContent: {
    flex: 1,
    marginLeft: Spacing.sm,
    justifyContent: 'center',
  },
  compactTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    lineHeight: Typography.fontSize.sm * Typography.lineHeight.normal,
  },
  compactChannel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
});

// Memoization comparison function for better performance
const areEqual = (prevProps: VideoCardProps, nextProps: VideoCardProps): boolean => {
  // Compare primitive props
  if (prevProps.isFavorite !== nextProps.isFavorite) return false;
  if (prevProps.showMode !== nextProps.showMode) return false;
  if (prevProps.compact !== nextProps.compact) return false;

  // Compare video object by id
  const prevId = 'id' in prevProps.video ? prevProps.video.id : prevProps.video;
  const nextId = 'id' in nextProps.video ? nextProps.video.id : nextProps.video;
  if (prevId !== nextId) return false;

  // If same id, check if content changed
  if ('videoInfo' in prevProps.video && 'videoInfo' in nextProps.video) {
    if (prevProps.video.title !== nextProps.video.title) return false;
  }

  return true;
};

export const VideoCard = memo(VideoCardComponent, areEqual);

export default VideoCard;
