/**
 * SunflowerLayer v3.1 — mobile mascot avec tige + feuilles + tête héliotrope.
 *
 * react-native-svg : viewBox 200×280, tige bezier Q verte courbée vers le
 * soleil, 2 feuilles vertes, tête pivote autour de son point d'attache à la
 * tige (G rotation interne). Reanimated pour le halo bioluminescent pulsant
 * la nuit + opacité globale.
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

const FLOWER_WIDTH = 60;
const SVG_HEIGHT = Math.round((FLOWER_WIDTH * 280) / 200); // 84
const HALO_SIZE = Math.round(FLOWER_WIDTH * 1.6);
const TRANSITION_MS = 1500;
const PULSE_MS = 4000;

const HALO_RGBA: Record<SunflowerPhase, { color: string; pulse: boolean }> = {
  dawn: { color: "rgba(255,179,71,0.32)", pulse: false },
  day: { color: "transparent", pulse: false },
  dusk: { color: "rgba(255,140,66,0.32)", pulse: false },
  night: { color: "rgba(139,92,246,0.45)", pulse: true },
};

// ── Geometry from lighting-engine ─────────────────────────────────────────
const {
  headCenterX,
  headCenterY,
  stemBaseX,
  stemBaseY,
  stemTipDefaultX,
  stemTipY,
  innerR,
  petalLen,
  petalCountOuter,
  petalCountInner,
  stemGreen,
  leafGreen,
  leafGreenDark,
} = SUNFLOWER_GEOMETRY;

// ── Petal paths (relative to head center 100,100) ─────────────────────────
const OUTER_PETAL_PATH =
  `M ${headCenterX} ${headCenterY - innerR} ` +
  `C ${headCenterX - 13} ${headCenterY - innerR - 8}, ` +
  `${headCenterX - 13} ${headCenterY - innerR - petalLen + 6}, ` +
  `${headCenterX} ${headCenterY - innerR - petalLen} ` +
  `C ${headCenterX + 13} ${headCenterY - innerR - petalLen + 6}, ` +
  `${headCenterX + 13} ${headCenterY - innerR - 8}, ` +
  `${headCenterX} ${headCenterY - innerR} Z`;
const INNER_LEN = petalLen - 8;
const INNER_PETAL_PATH =
  `M ${headCenterX} ${headCenterY - innerR + 2} ` +
  `C ${headCenterX - 9} ${headCenterY - innerR - 4}, ` +
  `${headCenterX - 9} ${headCenterY - innerR - INNER_LEN + 4}, ` +
  `${headCenterX} ${headCenterY - innerR - INNER_LEN} ` +
  `C ${headCenterX + 9} ${headCenterY - innerR - INNER_LEN + 4}, ` +
  `${headCenterX + 9} ${headCenterY - innerR - 4}, ` +
  `${headCenterX} ${headCenterY - innerR + 2} Z`;

const OUTER_ANGLES = Array.from(
  { length: petalCountOuter },
  (_, i) => (i * 360) / petalCountOuter,
);
const INNER_OFFSET = 360 / petalCountInner / 2;
const INNER_ANGLES = Array.from(
  { length: petalCountInner },
  (_, i) => (i * 360) / petalCountInner + INNER_OFFSET,
);

const SEEDS: { x: number; y: number }[] = [{ x: headCenterX, y: headCenterY }];
for (let i = 0; i < 6; i++) {
  const a = (i * 60 * Math.PI) / 180;
  SEEDS.push({
    x: headCenterX + Math.cos(a) * 11,
    y: headCenterY + Math.sin(a) * 11,
  });
}
for (let i = 0; i < 6; i++) {
  const a = ((i * 60 + 30) * Math.PI) / 180;
  SEEDS.push({
    x: headCenterX + Math.cos(a) * 21,
    y: headCenterY + Math.sin(a) * 21,
  });
}

interface SunflowerSvgProps {
  width: number;
  height: number;
  phase: SunflowerPhase;
  rotation: number;
}

function SunflowerSvg({ width, height, phase, rotation }: SunflowerSvgProps) {
  const c = SUNFLOWER_PALETTES[phase];
  const petalScale = SUNFLOWER_PETAL_SCALE[phase];

  const sinRot = Math.sin((rotation * Math.PI) / 180);
  const stemTipX = stemTipDefaultX + sinRot * 18;
  const stemMidX = stemTipDefaultX + sinRot * 28;
  const stemMidY = (stemBaseY + stemTipY) / 2;

  const stemPath = `M ${stemBaseX} ${stemBaseY} Q ${stemMidX.toFixed(2)} ${stemMidY} ${stemTipX.toFixed(2)} ${stemTipY}`;

  const leafLeftX = stemBaseX - 4 + sinRot * 4;
  const leafLeftY = 230;
  const leafLeftPath =
    `M ${leafLeftX} ${leafLeftY} ` +
    `C ${leafLeftX - 38} ${leafLeftY - 8}, ` +
    `${leafLeftX - 42} ${leafLeftY + 12}, ` +
    `${leafLeftX - 8} ${leafLeftY + 14} ` +
    `C ${leafLeftX - 18} ${leafLeftY + 6}, ` +
    `${leafLeftX - 22} ${leafLeftY - 2}, ` +
    `${leafLeftX} ${leafLeftY} Z`;

  const leafRightX = stemBaseX + 4 + sinRot * 8;
  const leafRightY = 195;
  const leafRightPath =
    `M ${leafRightX} ${leafRightY} ` +
    `C ${leafRightX + 36} ${leafRightY - 12}, ` +
    `${leafRightX + 42} ${leafRightY + 6}, ` +
    `${leafRightX + 8} ${leafRightY + 14} ` +
    `C ${leafRightX + 20} ${leafRightY + 4}, ` +
    `${leafRightX + 24} ${leafRightY - 4}, ` +
    `${leafRightX} ${leafRightY} Z`;

  const headTranslateX = stemTipX - headCenterX;
  const headTranslateY = stemTipY - headCenterY - innerR + 4;

  const pivotX = headCenterX;
  const pivotY = headCenterY + innerR;

  return (
    <Svg width={width} height={height} viewBox={`0 0 200 280`}>
      <Path
        d={stemPath}
        stroke={stemGreen}
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d={leafLeftPath}
        fill={leafGreen}
        stroke={c.stroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Path
        d={leafRightPath}
        fill={leafGreenDark}
        stroke={c.stroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <G x={headTranslateX} y={headTranslateY}>
        <G origin={`${pivotX}, ${pivotY}`} rotation={rotation}>
          <G origin={`${headCenterX}, ${headCenterY}`} scale={petalScale}>
            {INNER_ANGLES.map((angle) => (
              <G
                key={`in-${angle}`}
                origin={`${headCenterX}, ${headCenterY}`}
                rotation={angle}
              >
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
              <G
                key={`out-${angle}`}
                origin={`${headCenterX}, ${headCenterY}`}
                rotation={angle}
              >
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
            cx={headCenterX}
            cy={headCenterY}
            r={innerR}
            fill={c.core}
            stroke={c.stroke}
            strokeWidth={3}
          />
          <Circle
            cx={headCenterX}
            cy={headCenterY}
            r={innerR - 4}
            fill={c.coreShadow}
            opacity={0.6}
          />
          {SEEDS.map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={3} fill={c.seed} />
          ))}
        </G>
      </G>
    </Svg>
  );
}

const HEAD_Y_IN_SVG_PX = (SVG_HEIGHT * 100) / 280;
const SVG_TOP = HALO_SIZE / 2 - HEAD_Y_IN_SVG_PX;

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  const phase = getSunflowerPhase(preset.frameIndex);
  const rotation = getSunflowerRotation(preset.frameIndex);
  const flowerOpacity =
    getSunflowerOpacity(preset.frameIndex) * preset.beam.opacity;
  const halo = HALO_RGBA[phase];

  const opacity = useSharedValue(flowerOpacity);
  const haloPulse = useSharedValue(halo.pulse ? 0.5 : 1);

  useEffect(() => {
    opacity.value = withTiming(flowerOpacity, {
      duration: TRANSITION_MS,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [flowerOpacity, opacity]);

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
        <SunflowerSvg
          width={FLOWER_WIDTH}
          height={SVG_HEIGHT}
          phase={phase}
          rotation={rotation}
        />
      </Animated.View>
    </View>
  );
}

export default SunflowerLayer;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 86,
    right: 16,
    width: HALO_SIZE,
    height: HALO_SIZE,
    overflow: "visible",
  },
  halo: {
    position: "absolute",
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
  },
  flower: {
    position: "absolute",
    top: SVG_TOP,
    left: HALO_SIZE / 2 - FLOWER_WIDTH / 2,
    width: FLOWER_WIDTH,
    height: SVG_HEIGHT,
  },
});
