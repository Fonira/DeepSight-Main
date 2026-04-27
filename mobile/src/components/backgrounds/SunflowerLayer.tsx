/**
 * SunflowerLayer (mobile RN, v3)
 *
 * Pinned mascot at the bottom-right corner that follows the sun's daily
 * trajectory. Renders a single sprite sheet frame (24 frames × 2 sheets =
 * day/night) selected by `preset.frameIndex` from the engine.
 *
 *   - pointerEvents="none" → never blocks tab bar gestures
 *   - bottom: 86 → sits just above the tab bar
 *   - overflow:hidden + Image offset → cheap CSS-style sprite frame trick,
 *     no native module needed
 */
import React from "react";
import { Image, View, StyleSheet } from "react-native";
import { useAmbientLightingContext } from "../../contexts/AmbientLightingContext";

const GRID_COLS = 6;
const GRID_ROWS = 4; // 6 × 4 = 24 frames per sprite sheet
const DISPLAY_SIZE = 60;

// Sprite sheets pre-bundled at build time (Metro asset pipeline)
const SPRITE_DAY = require("../../../assets/ambient/sunflower-day.webp");
const SPRITE_NIGHT = require("../../../assets/ambient/sunflower-night.webp");

export function SunflowerLayer() {
  const { preset, enabled } = useAmbientLightingContext();
  if (!enabled) return null;

  const sprite = preset.nightMode === "glowing" ? SPRITE_NIGHT : SPRITE_DAY;
  const col = preset.frameIndex % GRID_COLS;
  const row = Math.floor(preset.frameIndex / GRID_COLS) % GRID_ROWS;

  return (
    <View
      testID="sunflower-mascot"
      pointerEvents="none"
      style={styles.container}
    >
      <Image
        source={sprite}
        style={[
          styles.sprite,
          {
            left: -col * DISPLAY_SIZE,
            top: -row * DISPLAY_SIZE,
          },
        ]}
        resizeMode="cover"
        accessible={false}
      />
    </View>
  );
}

export default SunflowerLayer;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 86, // above the tab bar
    right: 16,
    width: DISPLAY_SIZE,
    height: DISPLAY_SIZE,
    overflow: "hidden",
  },
  sprite: {
    position: "absolute",
    width: DISPLAY_SIZE * GRID_COLS,
    height: DISPLAY_SIZE * GRID_ROWS,
  },
});
