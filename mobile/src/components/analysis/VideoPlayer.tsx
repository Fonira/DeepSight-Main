import React, { useCallback } from "react";
import {
  View,
  Pressable,
  Linking,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";

interface VideoPlayerProps {
  videoId: string;
  title: string;
  scrollY: SharedValue<number>;
  platform?: "youtube" | "tiktok";
  thumbnail?: string;
}

const EXPANDED_HEIGHT = 200;
const COLLAPSE_START = 50;
const COLLAPSE_END = 150;

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  title,
  scrollY,
  platform = "youtube",
  thumbnail,
}) => {
  const { colors } = useTheme();
  const isTikTok = platform === "tiktok";

  const animatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      scrollY.value,
      [0, COLLAPSE_START, COLLAPSE_END],
      [EXPANDED_HEIGHT, EXPANDED_HEIGHT, 0],
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

  const thumbnailUrl = isTikTok
    ? thumbnail || undefined
    : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  const openVideo = useCallback(() => {
    const url = isTikTok
      ? `https://www.tiktok.com/video/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;
    Linking.openURL(url);
  }, [videoId, isTikTok]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={openVideo}
        style={[styles.pressable, { backgroundColor: colors.bgSecondary }]}
        accessibilityLabel={`Regarder ${title} sur ${isTikTok ? "TikTok" : "YouTube"}`}
        accessibilityRole="button"
      >
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={styles.thumbnail}
            contentFit="cover"
            placeholder={undefined}
            transition={200}
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderBg]}>
            <Ionicons name="musical-notes" size={40} color="#06b6d4" />
          </View>
        )}
        <View style={styles.playOverlay}>
          <View
            style={[styles.playButton, { backgroundColor: "rgba(0,0,0,0.7)" }]}
          >
            <Ionicons name="play" size={32} color="#ffffff" />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: borderRadius.lg,
    marginHorizontal: sp.lg,
    marginBottom: sp.md,
  },
  pressable: {
    flex: 1,
    borderRadius: borderRadius.lg,
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholderBg: {
    backgroundColor: "rgba(6,182,212,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 4,
  },
});

export default VideoPlayer;
