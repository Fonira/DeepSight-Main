/**
 * VoiceControls — Zone de contrôles voice en bas du ConversationScreen.
 *
 * 4 états selon `voiceMode` :
 * - 'off' : card avec icône mic gris + label "Appel non démarré"
 * - 'live' : waveform + timer + minutes restantes + 2 boutons (Mute, End)
 * - 'ended' : ne rend rien (l'EndedToast s'affiche par-dessus)
 * - 'quota_exceeded' : card warning + bouton "Acheter des minutes"
 *
 * Les composants visuels (PulsingCircle, WaveformPlaceholder) sont repris
 * du legacy `VoiceScreen.tsx` (sera supprimé en Task 7).
 */

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import VoiceAddonModal from "../voice/VoiceAddonModal";
import type { VoiceMode } from "../../hooks/useConversation";

interface VoiceControlsProps {
  voiceMode: VoiceMode;
  isMuted: boolean;
  elapsedSeconds: number;
  remainingMinutes: number;
  onToggleMute: () => void;
  onEnd: () => void;
}

const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ─── Waveform animée (état 'live') ───
const WaveformBar: React.FC<{
  targetHeight: number;
  color: string;
  index: number;
}> = ({ targetHeight, color, index }) => {
  const barScale = useSharedValue(targetHeight);

  useEffect(() => {
    barScale.value = withDelay(
      index * 80,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: 400 + index * 40,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(targetHeight * 0.4, {
            duration: 400 + index * 40,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      ),
    );
  }, [barScale, targetHeight, index]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: barScale.value }],
  }));

  return (
    <Animated.View
      style={[styles.waveBar, { backgroundColor: color }, barStyle]}
    />
  );
};

const Waveform: React.FC<{ color: string }> = ({ color }) => {
  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8];
  return (
    <View style={styles.waveRow}>
      {bars.map((h, i) => (
        <WaveformBar key={i} targetHeight={h} color={color} index={i} />
      ))}
    </View>
  );
};

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  voiceMode,
  isMuted,
  elapsedSeconds,
  remainingMinutes,
  onToggleMute,
  onEnd,
}) => {
  const { colors } = useTheme();
  const [addonVisible, setAddonVisible] = useState(false);

  if (voiceMode === "ended") {
    // L'EndedToast est rendu séparément par le parent.
    return null;
  }

  if (voiceMode === "off") {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.bgCard,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="mic-outline" size={18} color={colors.textTertiary} />
        <Text style={[styles.offLabel, { color: colors.textTertiary }]}>
          Appel non démarré
        </Text>
      </View>
    );
  }

  if (voiceMode === "quota_exceeded") {
    return (
      <View
        style={[
          styles.container,
          styles.quotaContainer,
          {
            backgroundColor: "rgba(239,68,68,0.10)",
            borderColor: "rgba(239,68,68,0.30)",
          },
        ]}
      >
        <Text style={[styles.quotaLabel, { color: "#fca5a5" }]}>
          ⚠ Quota voice épuisé
        </Text>
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
                () => {},
              );
            }
            setAddonVisible(true);
          }}
          style={({ pressed }) => [
            styles.upgradeBtn,
            {
              backgroundColor: colors.accentPrimary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Acheter des minutes"
        >
          <Text style={[styles.upgradeBtnText, { color: palette.white }]}>
            Acheter des minutes
          </Text>
        </Pressable>
        <VoiceAddonModal
          visible={addonVisible}
          onClose={() => setAddonVisible(false)}
        />
      </View>
    );
  }

  // voiceMode === 'live'
  const handleEnd = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
    onEnd();
  };

  return (
    <View
      style={[
        styles.container,
        styles.liveContainer,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Mute */}
      <Pressable
        onPress={onToggleMute}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: isMuted ? colors.bgTertiary : colors.bgSecondary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isMuted ? "Réactiver micro" : "Couper micro"}
      >
        <Ionicons
          name={isMuted ? "mic-off" : "mic"}
          size={20}
          color={isMuted ? palette.red : colors.textPrimary}
        />
      </Pressable>

      {/* Waveform + timer */}
      <View style={styles.centerInfo}>
        <Waveform color={colors.accentPrimary} />
        <Text style={[styles.timer, { color: colors.textSecondary }]}>
          {formatTime(elapsedSeconds)} ·{" "}
          {Math.max(0, Math.floor(remainingMinutes))} min
        </Text>
      </View>

      {/* End */}
      <Pressable
        onPress={handleEnd}
        style={({ pressed }) => [
          styles.endBtn,
          { opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Terminer l'appel"
      >
        <Ionicons name="stop" size={18} color={palette.white} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: sp.lg,
    marginVertical: sp.xs,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
  },
  liveContainer: {
    justifyContent: "space-between",
  },
  quotaContainer: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: sp.sm,
  },
  offLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  quotaLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    textAlign: "center",
  },
  upgradeBtn: {
    paddingVertical: sp.sm,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  upgradeBtnText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  centerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: sp.sm,
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 24,
  },
  waveBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  timer: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
  },
  endBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: palette.red,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default VoiceControls;
