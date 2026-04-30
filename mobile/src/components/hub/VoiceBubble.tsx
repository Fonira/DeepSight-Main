// mobile/src/components/hub/VoiceBubble.tsx
//
// Voice bubble gold avec play/pause, waveform et transcript karaoke collapsible.
// La progression utilise un setInterval (pas requestAnimationFrame en JS thread sur RN).
// Reanimated 4 utilise pour le chevron du bouton transcript et le collapse.

import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { fontFamily } from "@/theme/typography";
import { VoiceWaveformBars } from "./VoiceWaveformBars";

interface Props {
  durationSecs: number;
  /** Sampled bar heights in px. */
  bars: number[];
  transcript?: string;
  /** Right side bubble (user PTT) vs left (AI voice). */
  side?: "user" | "ai";
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const TICK_MS = 60; // ~16fps - assez fluide pour une waveform de 8-15s
const PLAYED_COLOR = "#c8903a";

export const VoiceBubble: React.FC<Props> = ({
  durationSecs,
  bars,
  transcript,
  side = "user",
}) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  // Animated transcript collapse
  const transcriptHeight = useSharedValue(0);
  const transcriptOpacity = useSharedValue(0);
  const transcriptStyle = useAnimatedStyle(() => ({
    maxHeight: transcriptHeight.value,
    opacity: transcriptOpacity.value,
  }));

  useEffect(() => {
    if (!playing) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    startedAtRef.current = Date.now() - progress * durationSecs * 1000;
    tickRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const p = Math.min(elapsed / durationSecs, 1);
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        setProgress(0);
      }
    }, TICK_MS);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationSecs]);

  useEffect(() => {
    if (showTranscript) {
      transcriptHeight.value = withTiming(400, {
        duration: 220,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      });
      transcriptOpacity.value = withTiming(1, { duration: 220 });
    } else {
      transcriptHeight.value = withTiming(0, { duration: 200 });
      transcriptOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [showTranscript, transcriptHeight, transcriptOpacity]);

  const cur = playing ? progress * durationSecs : durationSecs;
  const isUser = side === "user";
  const words = transcript ? transcript.split(/\s+/) : [];

  return (
    <View style={[styles.column, isUser ? styles.alignEnd : styles.alignStart]}>
      <View style={[styles.pill, isUser ? styles.pillUser : styles.pillAi]}>
        <Pressable
          onPress={() => setPlaying((p) => !p)}
          accessibilityLabel={playing ? "pause" : "lecture"}
          style={styles.playBtn}
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={14}
            color="#ffffff"
            style={!playing ? { marginLeft: 1 } : undefined}
          />
        </Pressable>
        <VoiceWaveformBars bars={bars} progress={progress} playing={playing} />
        <Text style={styles.timer}>{formatTime(cur)}</Text>
      </View>

      {transcript ? (
        <Pressable
          onPress={() => setShowTranscript((s) => !s)}
          style={styles.toggleBtn}
        >
          <Text style={styles.toggleText}>
            {showTranscript
              ? "↑ masquer le transcript"
              : "↓ afficher le transcript"}
          </Text>
        </Pressable>
      ) : null}

      {transcript ? (
        <Animated.View style={[styles.transcriptWrap, transcriptStyle]}>
          <View
            style={[
              styles.transcriptBox,
              isUser ? styles.transcriptUser : styles.transcriptAi,
            ]}
            accessibilityLabel="transcript"
          >
            <Text
              style={[
                styles.transcriptText,
                isUser ? styles.textRight : styles.textLeft,
              ]}
            >
              {words.map((w, i) => {
                const wp = i / words.length;
                const active =
                  playing &&
                  wp <= progress &&
                  (i + 1) / words.length > progress;
                const past = wp < progress;
                return (
                  <Text
                    key={i}
                    style={{
                      color: active
                        ? "#ffffff"
                        : past
                          ? PLAYED_COLOR
                          : "rgba(255,255,255,0.55)",
                      fontWeight: active ? "700" : "400",
                    }}
                  >
                    {w}{" "}
                  </Text>
                );
              })}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  column: {
    flexDirection: "column",
    maxWidth: 320,
  },
  alignEnd: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  alignStart: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 10,
  },
  pillUser: {
    backgroundColor: "rgba(200,144,58,0.10)",
    borderColor: "rgba(200,144,58,0.20)",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 14,
  },
  pillAi: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.10)",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#c8903a",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  timer: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "rgba(255,255,255,0.55)",
  },
  toggleBtn: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  toggleText: {
    fontSize: 11,
    color: "#c8903a",
  },
  transcriptWrap: {
    overflow: "hidden",
    marginTop: 6,
    maxWidth: "100%",
  },
  transcriptBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  transcriptUser: {
    alignSelf: "flex-end",
  },
  transcriptAi: {
    alignSelf: "flex-start",
  },
  transcriptText: {
    fontSize: 13,
    lineHeight: 19,
  },
  textRight: {
    textAlign: "right",
  },
  textLeft: {
    textAlign: "left",
  },
});
