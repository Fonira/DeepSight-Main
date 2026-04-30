// mobile/src/components/hub/DeepSightLogo.tsx
//
// Mobile mirror du DeepSightLogo web. RN ne supporte pas `conic-gradient` nativement,
// donc on approxime le halo cosmique avec :
//   1. Un wrap blur (LinearGradient diagonal cool) - pose pour 80% du visuel
//   2. Une ring overlay (LinearGradient verticale) en transparence - donne la sensation conic
//   3. L'image cosmique ronde par-dessus
// Palette indigo/violet/cyan + accents chauds (yellow/red/green) pour donner la sensation conic spectrum.

import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface Props {
  size?: number;
}

export const DeepSightLogo: React.FC<Props> = ({ size = 36 }) => {
  const ringSize = size + 6; // -3px inset cote web

  return (
    <View
      style={[styles.wrapper, { width: ringSize, height: ringSize }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="DeepSight"
    >
      {/* Halo principal cool (cyan -> indigo -> violet) + accents chauds (red/yellow/green) - approxime le conic spectrum */}
      <LinearGradient
        colors={[
          "#06b6d4",
          "#6366f1",
          "#8b5cf6",
          "#ef4444",
          "#f59e0b",
          "#10b981",
          "#06b6d4",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.halo,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
          },
        ]}
      />
      {/* Second gradient cross-axis pour donner la sensation conic */}
      <LinearGradient
        colors={["transparent", "rgba(129,140,248,0.45)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.haloCross,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
          },
        ]}
      />
      <Image
        source={require("@/assets/images/deepsight-logo-cosmic.png")}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  halo: {
    position: "absolute",
    opacity: 0.65,
    // approximation de filter:blur(6px) avec opacity + larger area
  },
  haloCross: {
    position: "absolute",
    opacity: 0.5,
  },
  image: {
    position: "relative",
    zIndex: 1,
    // approximation de boxShadow + inset
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.15)",
  },
});
