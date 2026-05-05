import React, { useCallback, useState } from "react";
import { View, Pressable, StyleSheet, Text, Platform } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { TikTokEmbed } from "./TikTokEmbed";

interface VideoPlayerProps {
  videoId: string;
  title: string;
  scrollY: SharedValue<number>;
  platform?: "youtube" | "tiktok" | "text";
  thumbnail?: string;
}

const COMPACT_HEIGHT = 80;
const COLLAPSE_START = 50;
const COLLAPSE_END = 150;

const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/**
 * Determine whether we have enough information to render a usable player.
 * Pure helper exported for testability and reuse.
 */
function canRender(
  videoId: string,
  platform: "youtube" | "tiktok" | "text" | undefined,
  thumbnail: string | undefined,
): boolean {
  if (!videoId) return false;
  if (platform === "youtube") {
    return YOUTUBE_ID_REGEX.test(videoId);
  }
  if (platform === "tiktok") {
    // TikTok thumbnails are not predictable from videoId — backend must provide one
    return Boolean(thumbnail);
  }
  return false;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  scrollY,
  platform = "youtube",
  thumbnail,
}) => {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isTikTok = platform === "tiktok";
  const visible = canRender(videoId, platform, thumbnail);

  // Compact-mode collapse-on-scroll animation. Disabled in expanded mode so the
  // embed stays visible while the user scrolls the analysis content.
  const animatedStyle = useAnimatedStyle(() => {
    if (expanded) {
      return { height: undefined as unknown as number, opacity: 1 };
    }
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_START, COLLAPSE_END],
      [COMPACT_HEIGHT, COMPACT_HEIGHT, 0],
      "clamp",
    );
    const opacity = interpolate(
      scrollY.value,
      [0, COLLAPSE_START, COLLAPSE_END],
      [1, 1, 0],
      "clamp",
    );
    return { height, opacity };
  });

  const handleExpand = useCallback(() => setExpanded(true), []);
  const handleClose = useCallback(() => setExpanded(false), []);

  if (!visible) return null;

  const thumbnailUrl = isTikTok
    ? thumbnail
    : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  if (expanded) {
    return (
      <View
        testID="video-player-expanded"
        style={[
          styles.expandedContainer,
          { backgroundColor: colors.bgSecondary },
        ]}
      >
        {isTikTok ? (
          <TikTokEmbed videoId={videoId} />
        ) : (
          <YoutubePlayer
            testID="youtube-iframe"
            height={210}
            videoId={videoId}
            play={false}
            webViewProps={{
              allowsInlineMediaPlayback: true,
              mediaPlaybackRequiresUserAction: false,
            }}
          />
        )}
        <Pressable
          testID="video-player-close"
          onPress={handleClose}
          style={[styles.closeButton, { backgroundColor: "rgba(0,0,0,0.65)" }]}
          accessibilityLabel="Fermer le lecteur vidéo"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Ionicons name="close" size={20} color="#ffffff" />
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View
      testID="video-player-compact"
      style={[styles.compactContainer, animatedStyle]}
    >
      <Pressable
        testID="video-player-compact-pressable"
        onPress={handleExpand}
        style={[
          styles.compactPressable,
          { backgroundColor: colors.bgSecondary },
        ]}
        accessibilityLabel={`Lire ${title} en ${isTikTok ? "TikTok" : "YouTube"}`}
        accessibilityRole="button"
      >
        <View style={styles.thumbWrap}>
          {thumbnailUrl ? (
            <Image
              testID="video-player-thumbnail"
              source={{ uri: thumbnailUrl }}
              style={styles.thumbImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View
              testID="video-player-thumbnail-placeholder"
              style={[styles.thumbImage, styles.placeholderBg]}
            >
              <Ionicons name="musical-notes" size={20} color="#06b6d4" />
            </View>
          )}
          <View style={styles.smallPlayBadge}>
            <Ionicons name="play" size={14} color="#ffffff" />
          </View>
        </View>

        <Text
          numberOfLines={2}
          style={[styles.compactTitle, { color: colors.textPrimary }]}
        >
          {title}
        </Text>

        <View style={styles.platformBadge}>
          <Ionicons
            name={isTikTok ? "logo-tiktok" : "logo-youtube"}
            size={18}
            color={isTikTok ? "#FF0050" : "#FF0000"}
          />
        </View>

        <View
          style={[styles.playCta, { backgroundColor: colors.accentPrimary }]}
        >
          <Ionicons name="play" size={16} color="#ffffff" />
        </View>
      </Pressable>
    </Animated.View>
  );
};

const COMPACT_THUMB_WIDTH = (COMPACT_HEIGHT * 16) / 9; // ≈ 142
const COMPACT_THUMB_HEIGHT = COMPACT_HEIGHT - sp.sm * 2; // padded square-ish on the row

const styles = StyleSheet.create({
  // ─── Compact mode ─────────────────────────────────────────────────────────
  compactContainer: {
    height: COMPACT_HEIGHT,
    overflow: "hidden",
    borderRadius: borderRadius.lg,
    marginHorizontal: sp.lg,
    marginBottom: sp.md,
  },
  compactPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.sm,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.lg,
    gap: sp.sm,
  },
  thumbWrap: {
    width: COMPACT_THUMB_WIDTH,
    height: COMPACT_THUMB_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.4)",
    position: "relative",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    backgroundColor: "rgba(6,182,212,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  smallPlayBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  compactTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
  },
  platformBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  playCta: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 2,
  },
  // ─── Expanded (embed) mode ────────────────────────────────────────────────
  expandedContainer: {
    overflow: "hidden",
    borderRadius: borderRadius.lg,
    marginHorizontal: sp.lg,
    marginBottom: sp.md,
    position: "relative",
    // Ensure WebView/iframe child renders correctly on Android
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
  },
  closeButton: {
    position: "absolute",
    top: sp.sm,
    right: sp.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});

export default VideoPlayer;
