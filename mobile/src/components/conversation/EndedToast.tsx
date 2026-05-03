/**
 * EndedToast — Toast "Appel terminé · X:XX min" auto-dismiss 3s.
 *
 * Affiché quand `voiceMode === 'ended'`. Animation Reanimated FadeInDown
 * springify (300ms) puis FadeOut (200ms) après ~3s.
 *
 * Polish (mai 2026) :
 * - haptics.success fired au mount
 * - barre progress qui se vide visuellement (3s) — feedback de auto-dismiss
 * - FadeInDown entering (springify) + FadeOut exiting plus court
 *
 * Le auto-dismiss vers `voiceMode = 'off'` est géré par useConversation
 * (state machine). Ce composant ne fait que l'affichage.
 */

import React, { useEffect } from "react";
import { Text, View, StyleSheet } from "react-native";
import Animated, {
  FadeInDown,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { haptics } from "../../utils/haptics";

interface EndedToastProps {
  durationSeconds: number;
  /** Auto-dismiss duration (ms). Defaults to 3000. */
  autoDismissMs?: number;
}

const formatDuration = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const EndedToast: React.FC<EndedToastProps> = ({
  durationSeconds,
  autoDismissMs = 3000,
}) => {
  const { colors } = useTheme();
  const progress = useSharedValue(1);

  // Haptic success au mount + démarrage de la barre progress (1 → 0)
  useEffect(() => {
    haptics.success();
    progress.value = withTiming(0, {
      duration: autoDismissMs,
      easing: Easing.linear,
    });
  }, [progress, autoDismissMs]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, progress.value * 100)}%`,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify()}
      exiting={FadeOut.duration(200)}
      testID="ended-toast"
      style={[
        styles.container,
        {
          backgroundColor: "rgba(16,185,129,0.10)",
          borderColor: "rgba(16,185,129,0.30)",
        },
      ]}
    >
      <View style={styles.row}>
        <Ionicons
          name="checkmark-circle-outline"
          size={18}
          color={palette.green}
        />
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          Appel terminé · {formatDuration(durationSeconds)} min
        </Text>
      </View>
      <View
        style={[
          styles.progressTrack,
          { backgroundColor: "rgba(16,185,129,0.15)" },
        ]}
      >
        <Animated.View
          testID="ended-toast-progress"
          style={[
            styles.progressFill,
            { backgroundColor: palette.green },
            progressStyle,
          ]}
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: sp.lg,
    paddingTop: sp.md,
    paddingBottom: sp.sm,
    marginHorizontal: sp.lg,
    marginVertical: sp.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.sm,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  progressTrack: {
    height: 2,
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 1,
  },
});

export default EndedToast;
