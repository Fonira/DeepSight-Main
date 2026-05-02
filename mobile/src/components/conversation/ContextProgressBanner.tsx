/**
 * ContextProgressBanner — Barre de progression du contexte vidéo streaming.
 *
 * Affiché uniquement quand `useConversation.streaming === true` (mode Quick
 * Voice Call V3 sur vidéo fraîche). Visualise les events SSE
 * `transcript_chunk` / `analysis_partial` / `ctx_complete`.
 *
 * Repris de la section `contextProgressContainer` de `VoiceScreen.tsx`.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface ContextProgressBannerProps {
  progress: number; // 0-100
  complete: boolean;
}

export const ContextProgressBanner: React.FC<ContextProgressBannerProps> = ({
  progress,
  complete,
}) => {
  return (
    <View
      testID="context-progress-banner"
      style={[
        styles.container,
        {
          backgroundColor: "rgba(245,180,0,0.08)",
          borderColor: "rgba(245,180,0,0.25)",
        },
      ]}
    >
      {!complete ? (
        <>
          <Text style={[styles.label, { color: "#f5b400" }]}>
            🎙️ J'écoute la vidéo en même temps que toi · Analyse en cours :{" "}
            {Math.floor(progress)}%
          </Text>
          <View
            style={[
              styles.track,
              { backgroundColor: "rgba(255,255,255,0.08)" },
            ]}
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: "#f5b400",
                  width: `${Math.max(0, Math.min(100, progress))}%`,
                },
              ]}
            />
          </View>
        </>
      ) : (
        <Text style={[styles.label, { color: "#f5b400" }]}>
          ✓ Contexte vidéo complet
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginHorizontal: sp.lg,
    marginTop: sp.xs,
    marginBottom: sp.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    marginBottom: sp.xs,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
  },
});

export default ContextProgressBanner;
