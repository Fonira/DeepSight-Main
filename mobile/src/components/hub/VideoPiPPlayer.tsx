// mobile/src/components/hub/VideoPiPPlayer.tsx
//
// PiP video draggable + expandable.
// Compact (collapsed): 112x64 carre avec bouton expand.
// Expanded: full screen overlay au-dessus du chat avec bouton shrink.
// Drag implemente via PanResponder (pas de Reanimated gesture handler ici - plus simple).

import React, { useRef } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily } from "@/theme/typography";

interface Props {
  thumbnailUrl: string | null;
  title: string;
  durationSecs: number;
  expanded: boolean;
  onExpand: () => void;
  onShrink: () => void;
  onSeek?: (secs: number) => void;
  seekTo?: number | null;
}

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const VideoPiPPlayer: React.FC<Props> = ({
  thumbnailUrl,
  title,
  durationSecs,
  expanded,
  onExpand,
  onShrink,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !expanded,
      onMoveShouldSetPanResponder: () => !expanded,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any).__getValue?.() ?? 0,
          y: (pan.y as any).__getValue?.() ?? 0,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      },
    }),
  ).current;

  if (expanded) {
    return (
      <View style={styles.expandedRoot} testID="hub-pip">
        {thumbnailUrl ? (
          <Image
            source={{ uri: thumbnailUrl }}
            style={StyleSheet.absoluteFillObject as any}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.expandedCenter}>
          <View style={styles.expandedPlayCircle}>
            <Ionicons name="play" size={36} color="#ffffff" />
          </View>
        </View>
        <Pressable
          onPress={onShrink}
          accessibilityLabel="Reduire"
          style={styles.shrinkBtn}
        >
          <Ionicons name="contract" size={18} color="#ffffff" />
        </Pressable>
        <View style={styles.expandedFooter}>
          <Text style={styles.expandedTitle}>{title}</Text>
          <Text style={styles.expandedTime}>00:00 / {fmt(durationSecs)}</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.compactRoot,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }],
        },
      ]}
      testID="hub-pip"
    >
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={[StyleSheet.absoluteFillObject as any, { opacity: 0.9 }]}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.compactCenter}>
        <View style={styles.compactPlayCircle}>
          <Ionicons name="play" size={10} color="#ffffff" />
        </View>
      </View>
      <Pressable
        onPress={onExpand}
        accessibilityLabel="Agrandir"
        style={styles.expandBtn}
      >
        <Ionicons name="expand" size={10} color="#ffffff" />
      </Pressable>
      <Text style={styles.compactTime}>{fmt(durationSecs)}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  compactRoot: {
    position: "relative",
    width: 112,
    height: 64,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    flexShrink: 0,
  },
  compactCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  compactPlayCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandBtn: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  compactTime: {
    position: "absolute",
    bottom: 2,
    right: 4,
    fontFamily: fontFamily.mono,
    fontSize: 8,
    color: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  expandedRoot: {
    position: "absolute",
    top: 16,
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    zIndex: 30,
  },
  expandedCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  expandedPlayCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  shrinkBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandedFooter: {
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  expandedTitle: {
    fontSize: 13,
    color: "#e8e8f0",
    marginBottom: 6,
    fontFamily: fontFamily.bodyMedium,
  },
  expandedTime: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255,255,255,0.65)",
  },
});
