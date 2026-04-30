// mobile/src/components/hub/SummaryCollapsible.tsx
//
// Card resume video collapsible. Badge "RESUME" indigo mono + chevron rotate Reanimated.
// Content deroulant avec citations cyan tappables (seek video).

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { fontFamily } from "@/theme/typography";
import type { HubSummaryContext } from "./types";

interface Props {
  context: HubSummaryContext;
  onCitationClick?: (timestampSecs: number) => void;
}

const formatTs = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

export const SummaryCollapsible: React.FC<Props> = ({
  context,
  onCitationClick,
}) => {
  const [open, setOpen] = useState(false);
  const chevronRotate = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotate.value}deg` }],
  }));
  const contentStyle = useAnimatedStyle(() => ({
    maxHeight: contentHeight.value,
    opacity: contentOpacity.value,
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    chevronRotate.value = withTiming(next ? 180 : 0, {
      duration: 200,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    contentHeight.value = withTiming(next ? 600 : 0, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    contentOpacity.value = withTiming(next ? 1 : 0, { duration: 200 });
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel="Toggle resume"
      >
        <View style={styles.badge}>
          <Text style={styles.badgeText}>RESUME</Text>
        </View>
        <Text style={styles.headerText} numberOfLines={1}>
          {context.short_summary}
        </Text>
        <Animated.View style={chevronStyle}>
          <Ionicons
            name="chevron-down"
            size={14}
            color="rgba(255,255,255,0.45)"
          />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.content, contentStyle]}>
        <Text style={styles.contentText}>
          Trois niveaux discutes : <Text style={styles.bold}>phenomenale</Text>,
          fonctionnelle et le <Text style={styles.bold}>hard problem</Text> de
          Chalmers. Position personnelle : ouverte mais sceptique sur les LLMs
          comme conscients.
        </Text>
        {context.citations.length > 0 ? (
          <View style={styles.citationsRow}>
            {context.citations.map((c, i) => (
              <Pressable
                key={i}
                onPress={() => onCitationClick?.(c.ts)}
                style={styles.citation}
                accessibilityLabel={`Aller a ${formatTs(c.ts)}`}
              >
                <Text style={styles.citationTs}>{formatTs(c.ts)}</Text>
                <Text style={styles.citationLabel}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  badgeText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: "#6366f1",
  },
  headerText: {
    flex: 1,
    fontSize: 14,
    fontFamily: fontFamily.bodyMedium,
    color: "rgba(255,255,255,0.85)",
  },
  content: {
    overflow: "hidden",
  },
  contentText: {
    fontSize: 13,
    lineHeight: 20,
    color: "rgba(255,255,255,0.65)",
    marginTop: 12,
    fontFamily: fontFamily.body,
  },
  bold: {
    color: "#e8e8f0",
    fontFamily: fontFamily.bodyBold,
  },
  citationsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  citation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "rgba(6,182,212,0.10)",
  },
  citationTs: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "#06b6d4",
  },
  citationLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.body,
  },
});
