/**
 * SunflowerLayer v3.1 — mobile mascot (60×60), react-native-svg.
 *
 * Inline SVG faithful to the official Tournesol logo. 4 phases (dawn / day /
 * dusk / night), heliotropic rotation animated via Reanimated, bioluminescent
 * halo at night via Reanimated infinite pulse.
 *
 *   - pointerEvents="none" → never blocks tab bar gestures
 *   - bottom: 86 → sits just above the tab bar
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import {
  getSunflowerPhase,
  getSunflowerRotation,
  getSunflowerOpacity,
  SUNFLOWER_PALETTES,
  SUNFLOWER_PETAL_SCALE,
  SUNFLOWER_GEOMETRY,
  type SunflowerPhase,
} from "@deepsight/lighting-engine";
import { useAmbientLightingContext } from "../../contexts/AmbientLightingContext";

const FLOWER_SIZE = 60;
const HALO_SIZE = Math.round(FLOWER_SIZE * 1.6);
const TRANSITION_MS = 1500;
const PULSE_MS = 4000;

// ── halo gradient stops per phase (RN doesn't read CSS gradients) ───────────
const HALO_RGBA: Record<SunflowerPhase, { color: string; pulse: boolean }> = {
  dawn: { color: "rgba(255,179,71,0.32)", pulse: false },
  day: { color: "transparent", pulse: false },
  dusk: { color: "rgba(255,140,66,0.32)", pulse: false },
  night: { color: "rgba(139,92,246,0.45)", pulse: true },
};

// ── precompute petal path (relative to viewBox 200×200, center 100,100) ─────
const { center: CX, innerR: INNER_R, petalLen: PETAL_LEN } = SUNFLOWER_GEOMETRY;
const OUTER_PETAL_PATH =
  `M ${CX} ${CX - INNER_R} ` +
  `C ${CX - 13} ${CX - INNER_R - 8}, ` +
  `${CX - 13} ${CX - INNER_R - PETAL_LEN + 6}, ` +
  `${CX} ${CX - INNER_R - PETAL_LEN} ` +
  `C ${CX + 13} ${CX - INNER_R - PETAL_LEN + 6}, ` +
  `${CX + 13} ${CX - INNER_R - 8}, ` +
  `${CX} ${CX - INNER_R} Z`;
const INNER_LEN = PETAL_LEN - 8;
const INNER_PETAL_PATH =
  `M ${CX} ${CX - INNER_R + 2} ` +
  `C ${CX - 9} ${CX - INNER_R - 4}, ` +
  `${CX - 9} ${CX - INNER_R - INNER_LEN + 4}, ` +
  `${CX} ${CX - INNER_R - INNER_LEN} ` +
  `C ${CX + 9} ${CX - INNER_R - INNER_LEN + 4}, ` +
  `${CX + 9} ${CX - INNER_R - 4}, ` +
  `${CX} ${CX - INNER_R + 2} Z`;

const OUTER_ANGLES = Array.from(
  { length: SUNFLOWER_GEOMETRY.petalCountOuter },
  (_, i) => (i * 360) / SUNFLOWER_GEOMETRY.petalCountOuter,
);
const INNER_OFFSET = 360 / SUNFLOWER_GEOMETRY.petalCountInner / 2;
const INNER_ANGLES = Array.from(
  { length: SUNFLOWER_GEOMETRY.petalCountInner },
  (_, i) => (i * 360) / SUNFLOWER_GEOMETRY.petalCountInner + INNER_OFFSET,
);

// 13 graines : 1 centre + 6 anneau interne (r=11) + 6 anneau externe (r=21, offset 30°)
const SEEDS: { x: number; y: number }[] = [{ x: CX, y: CX }];
for (let i = 0; i < 6; i++) {
  const a = (i * 60 * Math.PI) / 180;
  SEEDS.push({ x: CX + Math.cos(a) * 11, y: CX + Math.sin(a) * 11 });
}
for (let i = 0; i < 6; i++) {
  const a = ((i * 60 + 30) * Math.PI) / 180;
  SEEDS.push({ x: CX + Math.cos(a) * 21, y: CX + Math.sin(a) * 21 });
}

interface SunflowerSvgProps {
  size: number;
  phase: SunflowerPhase;
}

function SunflowerSvg({ size, phase }: SunflowerSvgProps) {
  const c = SUNFLOWER_PALETTES[phase];
  const petalScale = SUNFLOWER_PETAL_SCALE[phase];

  return (
    <Svg width={size} height={size} viewBox={`0 0 200 200`}>
      <G originX={CX} originY={CX} scale={petalScale}>
        {INNER_ANGLES.map((angle) => (
          <G key={`in-${angle}`} origin={`${CX}, ${CX}`} rotation={angle}>
            <Path
              d={INNER_PETAL_PATH}
              fill={c.petalInner}
              stroke={c.stroke}
              strokeWidth={2.5}
              strokeLinejoin="round"
              opacity={0.92}
            />
          </G>
        ))}
        {OUTER_ANGLES.map((angle) => (
          <G key={`out-${angle}`} origin={`${CX}, ${CX}`} rotation={angle}>
            <Path
              d={OUTER_PETAL_PATH}
              fill={c.petalOuter}
              stroke={c.stroke}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </G>
        ))}
      </G>
      <Circle
        cx={CX}
        cy={CX}
        r={INNER_R}
        fill={c.core}
        stroke={c.stroke}
        strokeWidth={3}
      />
      <Circle
        cx={CX}
        cy={CX}
        r={INNER_R - 4}
        fill={c.coreShadow}
        opacity={0.6}
      />
      {SEEDS.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={3} fill={c.seed} />
      ))}
    </Svg>
  );
}

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  const phase = getSunflowerPhase(preset.frameIndex);
  const targetRotation = getSunflowerRotation(preset.frameIndex);
  const flowerOpacity =
    getSunflowerOpacity(preset.frameIndex) * preset.beam.opacity;
  const halo = HALO_RGBA[phase];

  const rotation = useSharedValue(targetRotation);
  const opacity = useSharedValue(flowerOpacity);
  const haloPulse = useSharedValue(halo.pulse ? 0.5 : 1);

  useEffect(() => {
    rotation.value = withTiming(targetRotation, {
      duration: TRANSITION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    opacity.value = withTiming(flowerOpacity, {
      duration: TRANSITION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [targetRotation, flowerOpacity, rotation, opacity]);

  useEffect(() => {
    if (halo.pulse) {
      haloPulse.value = withRepeat(
        withTiming(1, {
          duration: PULSE_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      cancelAnimation(haloPulse);
      haloPulse.value = withTiming(1, { duration: TRANSITION_MS });
    }
    return () => cancelAnimation(haloPulse);
  }, [halo.pulse, haloPulse]);

  const flowerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: opacity.value,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: halo.pulse ? haloPulse.value : 0.6,
    transform: halo.pulse
      ? [{ scale: 0.95 + haloPulse.value * 0.13 }]
      : [{ scale: 1 }],
  }));

  if (!enabled) return null;

  return (
    <View
      testID="sunflower-mascot"
      pointerEvents="none"
      style={styles.container}
      accessible={false}
    >
      <Animated.View
        style={[styles.halo, { backgroundColor: halo.color }, haloStyle]}
        pointerEvents="none"
      />
      <Animated.View style={[styles.flower, flowerStyle]} pointerEvents="none">
        <SunflowerSvg size={FLOWER_SIZE} phase={phase} />
      </Animated.View>
    </View>
  );
}

export default SunflowerLayer;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 86 - (HALO_SIZE - FLOWER_SIZE) / 2,
    right: 16 - (HALO_SIZE - FLOWER_SIZE) / 2,
    width: HALO_SIZE,
    height: HALO_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
  },
  flower: {
    width: FLOWER_SIZE,
    height: FLOWER_SIZE,
  },
});
