/**
 * EndedToast — Toast "✅ Appel terminé · X:XX min" auto-dismiss 3s.
 *
 * Affiché quand `voiceMode === 'ended'`. Animation Reanimated FadeIn
 * (300ms) puis FadeOut (300ms) après 3s.
 *
 * Le auto-dismiss vers `voiceMode = 'off'` est géré par useConversation
 * (state machine). Ce composant ne fait que l'affichage.
 */

import React from "react";
import { Text, StyleSheet } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";

interface EndedToastProps {
  durationSeconds: number;
}

const formatDuration = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export const EndedToast: React.FC<EndedToastProps> = ({ durationSeconds }) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(300)}
      testID="ended-toast"
      style={[
        styles.container,
        {
          backgroundColor: "rgba(16,185,129,0.10)",
          borderColor: "rgba(16,185,129,0.30)",
        },
      ]}
    >
      <Ionicons
        name="checkmark-circle-outline"
        size={18}
        color={palette.green}
      />
      <Text style={[styles.label, { color: colors.textPrimary }]}>
        Appel terminé · {formatDuration(durationSeconds)} min
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    marginHorizontal: sp.lg,
    marginVertical: sp.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
});

export default EndedToast;
