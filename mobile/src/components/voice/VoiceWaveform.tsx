/**
 * VoiceWaveform — 5-bar animated audio visualizer for voice chat.
 *
 * Pure Reanimated 4.1 worklets (no JS setInterval).
 * Staggered pulse on each bar (delay 0, 80, 160, 240, 320ms).
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../../contexts/ThemeContext";

// ─── Types ─────────────────────────────────────────────────────────────────

type WaveformSize = "small" | "medium" | "large";

interface VoiceWaveformProps {
  /** When true, bars pulse; when false, all bars stay at rest (scaleY 0.3). */
  isActive: boolean;
  /** Bar color — defaults to theme accent primary. */
  color?: string;
  /** Visual size preset. */
  size?: WaveformSize;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const BAR_COUNT = 5;
const BAR_DELAYS = [0, 80, 160, 240, 320] as const;

interface SizeSpec {
  barWidth: number;
  barHeight: number;
}

const SIZE_MAP: Record<WaveformSize, SizeSpec> = {
  small: { barWidth: 4, barHeight: 20 },
  medium: { barWidth: 6, barHeight: 32 },
  large: { barWidth: 8, barHeight: 48 },
};

const REST_SCALE = 0.3;
const PEAK_SCALE = 1;
const PULSE_DURATION = 400;

// ─── Single bar (one for each index) ───────────────────────────────────────

interface WaveformBarProps {
  index: number;
  isActive: boolean;
  color: string;
  width: number;
  height: number;
}

const WaveformBar: React.FC<WaveformBarProps> = React.memo(
  ({ index, isActive, color, width, height }) => {
    const scaleY = useSharedValue(REST_SCALE);

    useEffect(() => {
      if (isActive) {
        scaleY.value = withDelay(
          BAR_DELAYS[index] ?? 0,
          withRepeat(
            withSequence(
              withTiming(PEAK_SCALE, {
                duration: PULSE_DURATION,
                easing: Easing.inOut(Easing.ease),
              }),
              withTiming(REST_SCALE, {
                duration: PULSE_DURATION,
                easing: Easing.inOut(Easing.ease),
              }),
            ),
            -1,
            false,
          ),
        );
      } else {
        scaleY.value = withTiming(REST_SCALE, { duration: 200 });
      }
    }, [isActive, index, scaleY]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scaleY: scaleY.value }],
    }));

    return (
      <Animated.View
        style={[
          styles.bar,
          {
            width,
            height,
            backgroundColor: color,
            borderRadius: width / 2,
          },
          animatedStyle,
        ]}
      />
    );
  },
);

WaveformBar.displayName = "WaveformBar";

// ─── Main component ────────────────────────────────────────────────────────

const VoiceWaveformInner: React.FC<VoiceWaveformProps> = ({
  isActive,
  color,
  size = "medium",
}) => {
  const { colors } = useTheme();
  const spec = SIZE_MAP[size];
  const barColor = color ?? colors.accentPrimary;

  return (
    <View
      style={[styles.container, { height: spec.barHeight }]}
      accessibilityRole="image"
      accessibilityLabel={
        isActive ? "Waveform audio active" : "Waveform audio au repos"
      }
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <WaveformBar
          key={i}
          index={i}
          isActive={isActive}
          color={barColor}
          width={spec.barWidth}
          height={spec.barHeight}
        />
      ))}
    </View>
  );
};

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bar: {
    // Dimensions + backgroundColor + borderRadius set inline (dynamic per size).
  },
});

export const VoiceWaveform = React.memo(VoiceWaveformInner);
VoiceWaveform.displayName = "VoiceWaveform";

export default VoiceWaveform;
