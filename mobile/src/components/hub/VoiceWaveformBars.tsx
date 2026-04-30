// mobile/src/components/hub/VoiceWaveformBars.tsx
//
// Bars d'amplitude statiques (proto). Or quand "joue" (i/total <= progress),
// gris sinon. La "tete de lecture" (bar courante) scale x1.25.
// Pas Reanimated ici - re-render sur progress change suffit (pose pendant ~8s max).

import React from "react";
import { StyleSheet, View } from "react-native";

interface Props {
  /** Hauteurs en px (sampled). Conserve un tableau stable pour ne pas re-mount. */
  bars: number[];
  /** 0..1 - progression de lecture. */
  progress: number;
  /** True quand on joue - met en evidence la "tete de lecture" (bar courante). */
  playing: boolean;
}

const PLAYED_COLOR = "#c8903a";
const UNPLAYED_COLOR = "rgba(168,168,184,0.5)";

const VoiceWaveformBarsInner: React.FC<Props> = ({
  bars,
  progress,
  playing,
}) => {
  return (
    <View style={styles.row}>
      {bars.map((h, i) => {
        const ratio = i / bars.length;
        const played = ratio <= progress;
        const isHead = playing && Math.abs(ratio - progress) < 0.04;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: h,
                backgroundColor: played ? PLAYED_COLOR : UNPLAYED_COLOR,
                transform: [{ scaleY: isHead ? 1.25 : 1 }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: 2,
  },
  bar: {
    width: 2,
    borderRadius: 1,
  },
});

export const VoiceWaveformBars = React.memo(VoiceWaveformBarsInner);
VoiceWaveformBars.displayName = "VoiceWaveformBars";
