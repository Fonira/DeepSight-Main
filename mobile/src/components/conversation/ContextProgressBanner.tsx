/**
 * ContextProgressBanner — Barre de progression du contexte vidéo streaming.
 *
 * Affiché uniquement quand `useConversation.streaming === true` (mode Quick
 * Voice Call V3 sur vidéo fraîche). Visualise les events SSE
 * `transcript_chunk` / `analysis_partial` / `ctx_complete`.
 *
 * Polish (mai 2026) :
 * - Pulse opacity sur le label tant que la barre n'est pas complete (effet "live")
 * - Shimmer animé sur la fill bar (overlay translateX)
 * - Animation d'entrée FadeIn / sortie FadeOut quand passage à complete
 * - Couleurs ambre #f5b400 sur fond sombre : ratio contraste ~9:1 (AAA)
 */

import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface ContextProgressBannerProps {
  progress: number; // 0-100
  complete: boolean;
}

const ACCENT = "#f5b400";

export const ContextProgressBanner: React.FC<ContextProgressBannerProps> = ({
  progress,
  complete,
}) => {
  // Pulse opacity sur le label tant que streaming actif
  const labelOpacity = useSharedValue(1);
  // Shimmer translate sur la fill bar
  const shimmerX = useSharedValue(-100);

  useEffect(() => {
    if (complete) {
      labelOpacity.value = withTiming(1, { duration: 200 });
      shimmerX.value = -100;
      return;
    }
    labelOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    shimmerX.value = withRepeat(
      withTiming(120, {
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      false,
    );
  }, [complete, labelOpacity, shimmerX]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmerX.value}%` as unknown as number }],
  }));

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
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
          <Animated.Text style={[styles.label, { color: ACCENT }, labelStyle]}>
            J'écoute la vidéo en même temps que toi · Analyse en cours :{" "}
            {Math.floor(clampedProgress)}%
          </Animated.Text>
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
                  backgroundColor: ACCENT,
                  width: `${clampedProgress}%`,
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[styles.shimmer, shimmerStyle]}
              />
            </View>
          </View>
        </>
      ) : (
        <Text style={[styles.label, { color: ACCENT }]}>
          ✓ Contexte vidéo complet
        </Text>
      )}
    </Animated.View>
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
    overflow: "hidden",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "60%",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});

export default ContextProgressBanner;
