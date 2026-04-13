import React, { memo, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../contexts/ThemeContext";
import { Badge } from "./ui";
import { ThumbnailImage } from "./ui/ThumbnailImage";
import { PlatformBadge, detectPlatformFromUrl } from "./ui/PlatformBadge";
import { BorderRadius, Spacing, Typography } from "../constants/theme";
import {
  formatDuration,
  formatRelativeTime,
  truncateText,
} from "../utils/formatters";
import type { AnalysisSummary, VideoInfo, VideoPlatform } from "../types";

interface VideoCardProps {
  video: AnalysisSummary | VideoInfo;
  onPress?: () => void;
  onFavoritePress?: () => void;
  onLongPress?: () => void;
  isFavorite?: boolean;
  showMode?: boolean;
  compact?: boolean;
  /** Hero mode: full-width thumbnail card for first item in list */
  hero?: boolean;
}

// Epistemic confidence badge
const EPISTEMIC_BADGE: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  high: { label: "SOLIDE", bg: "rgba(34,197,94,0.15)", text: "#4ade80" },
  medium: { label: "PLAUSIBLE", bg: "rgba(59,130,246,0.15)", text: "#60a5fa" },
  low: { label: "INCERTAIN", bg: "rgba(245,158,11,0.15)", text: "#fbbf24" },
  risky: { label: "À VÉRIFIER", bg: "rgba(239,68,68,0.15)", text: "#f87171" },
};

const VideoCardComponent: React.FC<VideoCardProps> = ({
  video,
  onPress,
  onFavoritePress,
  onLongPress,
  isFavorite = false,
  showMode = true,
  compact = false,
  hero = false,
}) => {
  const { colors } = useTheme();
  const pressScale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.97, {
      damping: 15,
      stiffness: 400,
      mass: 0.5,
    });
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, {
      damping: 12,
      stiffness: 300,
      mass: 0.5,
    });
  }, [pressScale]);

  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pressScale.value },
      { translateY: interpolate(pressScale.value, [0.97, 1], [2, 0], "clamp") },
    ],
  }));

  // Determine if the video prop is an AnalysisSummary or a VideoInfo
  // AnalysisSummary has 'title' at root level, VideoInfo has 'videoInfo' sub-object
  const isAnalysisSummary = !("videoInfo" in video);

  const analysisSummary: AnalysisSummary | null = isAnalysisSummary
    ? (video as AnalysisSummary)
    : null;

  const videoInfo: VideoInfo = isAnalysisSummary
    ? {
        id: (video as AnalysisSummary).videoId || (video as AnalysisSummary).id,
        title: (video as AnalysisSummary).title || "",
        description: "",
        thumbnail: (video as AnalysisSummary).thumbnail || "",
        channel: (video as AnalysisSummary).channel || "",
        channelId: "",
        duration: (video as AnalysisSummary).duration || 0,
        publishedAt: "",
        viewCount: 0,
      }
    : (video as any).videoInfo || video;

  // Detect platform from data or URL heuristics
  const platform: VideoPlatform =
    analysisSummary?.platform ||
    detectPlatformFromUrl(analysisSummary?.video_url, analysisSummary?.videoId);

  // DEBUG — supprimer après validation
  if (__DEV__) {
    console.log(
      `[VideoCard] "${videoInfo.title?.slice(0, 30)}" → platform=${platform}, raw=${analysisSummary?.platform}, url=${analysisSummary?.video_url?.slice(0, 40)}, isAS=${isAnalysisSummary}`,
    );
  }

  const handleFavoritePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFavoritePress?.();
  };

  // Epistemic confidence from analysis data (optional backend fields)
  const rawSummary = analysisSummary as unknown as Record<
    string,
    unknown
  > | null;
  const confidence =
    (rawSummary?.confidence_level as string | undefined) ||
    (rawSummary?.epistemic_level as string | undefined);
  const epistemicBadge = confidence ? EPISTEMIC_BADGE[confidence] : null;

  // Hero card: large thumbnail + prominent layout for first item
  if (hero) {
    return (
      <Animated.View style={pressAnimStyle}>
        <Pressable
          style={[styles.heroContainer, { backgroundColor: colors.bgCard }]}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={500}
        >
          <View style={styles.heroThumbnailContainer}>
            <ThumbnailImage
              uri={videoInfo.thumbnail}
              videoId={videoInfo.id}
              style={styles.heroThumbnail}
            />
            <View style={styles.platformOverlay}>
              <PlatformBadge
                platform={platform}
                size="sm"
                showLabel={false}
                overlay
              />
            </View>
            {typeof videoInfo.duration === "number" &&
              videoInfo.duration > 0 && (
                <View
                  style={[
                    styles.duration,
                    { backgroundColor: "rgba(0,0,0,0.8)" },
                  ]}
                >
                  <Text style={styles.durationText}>
                    {formatDuration(videoInfo.duration)}
                  </Text>
                </View>
              )}
          </View>

          <View style={styles.heroContent}>
            <View style={styles.header}>
              <Text
                style={[styles.heroTitle, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {videoInfo.title}
              </Text>
              {onFavoritePress && (
                <Pressable
                  onPress={handleFavoritePress}
                  style={styles.favoriteButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={22}
                    color={
                      isFavorite ? colors.accentError : colors.textTertiary
                    }
                  />
                </Pressable>
              )}
            </View>

            <Text style={[styles.channel, { color: colors.textSecondary }]}>
              {videoInfo.channel}
            </Text>

            <View style={styles.footer}>
              <View style={styles.badges}>
                <PlatformBadge platform={platform} size="sm" showLabel />
                {showMode && analysisSummary?.mode && (
                  <Badge
                    label={analysisSummary.mode}
                    variant="primary"
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
            {epistemicBadge && (
              <View
                style={[
                  styles.epistemicBadge,
                  { backgroundColor: epistemicBadge.bg },
                ]}
              >
                <Text
                  style={[styles.epistemicText, { color: epistemicBadge.text }]}
                >
                  {epistemicBadge.label}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  if (compact) {
    return (
      <Animated.View style={pressAnimStyle}>
        <Pressable
          style={[styles.compactContainer, { backgroundColor: colors.bgCard }]}
          onPress={onPress}
          onLongPress={onLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={500}
        >
          <View style={styles.compactThumbnailWrap}>
            <ThumbnailImage
              uri={videoInfo.thumbnail}
              videoId={videoInfo.id}
              style={styles.compactThumbnail}
            />
            {/* Platform badge overlay compact */}
            <View style={styles.compactPlatformOverlay}>
              <PlatformBadge
                platform={platform}
                size="xs"
                showLabel={false}
                overlay
              />
            </View>
          </View>
          <View style={styles.compactContent}>
            <Text
              style={[styles.compactTitle, { color: colors.textPrimary }]}
              numberOfLines={2}
            >
              {videoInfo.title}
            </Text>
            <View style={styles.compactFooter}>
              <Text
                style={[styles.compactChannel, { color: colors.textTertiary }]}
                numberOfLines={1}
              >
                {videoInfo.channel}
              </Text>
              {onFavoritePress && (
                <Pressable
                  onPress={handleFavoritePress}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={16}
                    color={
                      isFavorite ? colors.accentError : colors.textTertiary
                    }
                  />
                </Pressable>
              )}
            </View>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        style={[styles.container, { backgroundColor: colors.bgCard }]}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={500}
      >
        <View style={styles.thumbnailContainer}>
          <ThumbnailImage
            uri={videoInfo.thumbnail}
            videoId={videoInfo.id}
            style={styles.thumbnail}
          />
          {/* Platform badge overlay */}
          <View style={styles.platformOverlay}>
            <PlatformBadge
              platform={platform}
              size="sm"
              showLabel={false}
              overlay
            />
          </View>
          {typeof videoInfo.duration === "number" && videoInfo.duration > 0 && (
            <View
              style={[styles.duration, { backgroundColor: "rgba(0,0,0,0.8)" }]}
            >
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
              <Pressable
                onPress={handleFavoritePress}
                style={styles.favoriteButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={22}
                  color={isFavorite ? colors.accentError : colors.textTertiary}
                />
              </Pressable>
            )}
          </View>

          <Text style={[styles.channel, { color: colors.textSecondary }]}>
            {videoInfo.channel}
          </Text>

          <View style={styles.footer}>
            <View style={styles.badges}>
              <PlatformBadge platform={platform} size="sm" showLabel />
              {showMode && analysisSummary?.mode && (
                <Badge
                  label={analysisSummary.mode}
                  variant="primary"
                  size="sm"
                  style={{ marginLeft: Spacing.xs }}
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
              {truncateText(analysisSummary.content.replace(/[#*`]/g, ""), 150)}
            </Text>
          )}
          {epistemicBadge && (
            <View
              style={[
                styles.epistemicBadge,
                { backgroundColor: epistemicBadge.bg },
              ]}
            >
              <Text
                style={[styles.epistemicText, { color: epistemicBadge.text }]}
              >
                {epistemicBadge.label}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  thumbnailContainer: {
    position: "relative",
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  platformOverlay: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 2,
  },
  duration: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
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
  // Hero styles
  heroContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  heroThumbnailContainer: {
    position: "relative",
    aspectRatio: 16 / 9,
  },
  heroThumbnail: {
    width: "100%",
    height: "100%",
  },
  heroContent: {
    padding: Spacing.md,
  },
  heroTitle: {
    flex: 1,
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: Typography.fontSize.lg * Typography.lineHeight.normal,
    marginRight: Spacing.sm,
  },
  // Compact styles
  compactContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
  },
  compactThumbnailWrap: {
    position: "relative",
  },
  compactThumbnail: {
    width: 140,
    height: 80,
    borderRadius: BorderRadius.md,
  },
  compactPlatformOverlay: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 2,
  },
  compactContent: {
    flex: 1,
    marginLeft: Spacing.sm,
    justifyContent: "center",
  },
  compactFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
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
  epistemicBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    marginTop: Spacing.sm,
  },
  epistemicText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
    letterSpacing: 0.5,
  },
});

// Memoization comparison function for better performance
const areEqual = (
  prevProps: VideoCardProps,
  nextProps: VideoCardProps,
): boolean => {
  // Compare primitive props
  if (prevProps.isFavorite !== nextProps.isFavorite) return false;
  if (prevProps.showMode !== nextProps.showMode) return false;
  if (prevProps.compact !== nextProps.compact) return false;
  if (prevProps.hero !== nextProps.hero) return false;

  // Compare video object by id
  const prevId = "id" in prevProps.video ? prevProps.video.id : prevProps.video;
  const nextId = "id" in nextProps.video ? nextProps.video.id : nextProps.video;
  if (prevId !== nextId) return false;

  // If same id, check if content changed
  if ("videoInfo" in prevProps.video && "videoInfo" in nextProps.video) {
    if (prevProps.video.title !== nextProps.video.title) return false;
  }

  return true;
};

export const VideoCard = memo(VideoCardComponent, areEqual);

export default VideoCard;
