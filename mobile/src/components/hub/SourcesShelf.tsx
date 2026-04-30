// mobile/src/components/hub/SourcesShelf.tsx
//
// Pill horizontal "PLATEFORMES SUPPORTEES" + 4 logos.
// Mirror du composant web. Mistral logo non present dans assets/platforms - on utilise
// `mistral-logo-white.png` qui existe deja.

import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { fontFamily } from "@/theme/typography";

interface Props {
  /** Compact (mobile/extension) - smaller logos & padding. Defaults true on mobile. */
  compact?: boolean;
  label?: string;
}

const SOURCES = [
  {
    src: require("@/assets/platforms/youtube-icon-red.png"),
    alt: "YouTube",
    rounded: false,
    boost: 0,
  },
  {
    src: require("@/assets/platforms/tiktok-note-color.png"),
    alt: "TikTok",
    rounded: true,
    boost: 0,
  },
  {
    src: require("@/assets/platforms/tournesol-logo.png"),
    alt: "Tournesol",
    rounded: true,
    boost: 0,
  },
  {
    src: require("@/assets/platforms/mistral-logo-white.png"),
    alt: "Mistral",
    rounded: false,
    boost: 4,
  },
] as const;

export const SourcesShelf: React.FC<Props> = ({
  compact = true,
  label = "PLATEFORMES SUPPORTEES",
}) => {
  const sz = compact ? 14 : 16;
  return (
    <View style={[styles.wrapper, compact ? styles.padCompact : styles.padReg]}>
      <Text style={[styles.label, { fontSize: 9 }]}>{label}</Text>
      {SOURCES.map((s) => (
        <Image
          key={s.alt}
          source={s.src}
          style={{
            width: sz + s.boost,
            height: sz,
            opacity: 0.9,
            borderRadius: s.rounded ? 3 : 0,
          }}
          accessibilityLabel={s.alt}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignSelf: "center",
  },
  padCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  padReg: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    fontFamily: fontFamily.mono,
    color: "#6b6b7d",
    letterSpacing: 1.4,
  },
});
