import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  type SharedValue,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  FadeIn,
  SlideInDown,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type BottomSheet from "@gorhom/bottom-sheet";
import { useTheme } from "@/contexts/ThemeContext";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";
import { palette } from "@/theme/colors";
import { duration } from "@/theme/animations";
import { VoiceQuotaBadge } from "./VoiceQuotaBadge";
import { VoiceSettings } from "./VoiceSettings";
import VoiceAddonModal from "./VoiceAddonModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceMessage {
  text: string;
  source: "user" | "ai";
}

interface VoiceScreenProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  voiceStatus:
    | "idle"
    | "connecting"
    | "listening"
    | "thinking"
    | "speaking"
    | "error"
    | "quota_exceeded";
  isSpeaking: boolean;
  messages: VoiceMessage[];
  elapsedSeconds: number;
  remainingMinutes: number;
  onStart: () => void;
  onStop: () => void;
  onMuteToggle: () => void;
  isMuted: boolean;
  error?: string;
  /** Quick Voice Call mobile V3 — affiche la barre de progression contexte streaming. */
  streaming?: boolean;
  /** 0-100, progression du contexte vidéo (utilisé si `streaming=true`). */
  contextProgress?: number;
  /** True quand `[CTX COMPLETE]` reçu — bascule UI vers "Contexte vidéo complet". */
  contextComplete?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTime = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const formatMinutes = (minutes: number): string => {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Pulsing circle animation for the "listening" state */
const PulsingCircle: React.FC<{ color: string }> = ({ color }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withRepeat(
      withSpring(1.3, { damping: 8, stiffness: 80, mass: 1 }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.15, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (scale.value - 1) * 0.3 }],
  }));

  return (
    <View style={styles.pulseContainer}>
      <Animated.View
        style={[styles.pulseRingOuter, { borderColor: color }, ringStyle]}
      />
      <Animated.View
        style={[styles.pulseRing, { borderColor: color }, ringStyle]}
      />
      <Animated.View
        style={[styles.pulseCore, { backgroundColor: color }, innerStyle]}
      >
        <Ionicons name="mic" size={36} color={palette.white} />
      </Animated.View>
    </View>
  );
};

/** Three animated dots for "thinking" state */
const ThinkingDots: React.FC<{ color: string }> = ({ color }) => {
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const bounce = (sv: SharedValue<number>, delay: number) => {
      sv.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-10, { duration: 300, easing: Easing.out(Easing.ease) }),
            withTiming(0, { duration: 300, easing: Easing.in(Easing.ease) }),
          ),
          -1,
          false,
        ),
      );
    };
    bounce(dot1, 0);
    bounce(dot2, 150);
    bounce(dot3, 300);
  }, [dot1, dot2, dot3]);

  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1.value }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2.value }],
  }));
  const s3 = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3.value }],
  }));

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, s1]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, s2]} />
      <Animated.View style={[styles.dot, { backgroundColor: color }, s3]} />
    </View>
  );
};

/** Single animated bar — extracted to respect Rules of Hooks */
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

/** Simple waveform placeholder for "speaking" state */
const WaveformPlaceholder: React.FC<{ color: string }> = ({ color }) => {
  const bars = [0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8, 0.3];

  return (
    <View style={styles.waveRow}>
      {bars.map((h, i) => (
        <WaveformBar key={i} targetHeight={h} color={color} index={i} />
      ))}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const VoiceScreen: React.FC<VoiceScreenProps> = ({
  visible,
  onClose,
  videoTitle,
  channelName,
  voiceStatus,
  isSpeaking: _isSpeaking,
  messages,
  elapsedSeconds,
  remainingMinutes,
  onStart,
  onStop,
  onMuteToggle,
  isMuted,
  error,
  streaming = false,
  contextProgress = 0,
  contextComplete = false,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const settingsSheetRef = useRef<BottomSheet>(null);
  const [addonVisible, setAddonVisible] = useState(false);

  const handleOpenSettings = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    settingsSheetRef.current?.expand();
  }, []);

  const handleOpenAddon = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setAddonVisible(true);
  }, []);

  // Haptic feedback on start / stop
  const handleStart = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onStart();
  }, [onStart]);

  const handleStop = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    onStop();
  }, [onStop]);

  // Whether the session is active (not idle / not error states)
  const isActive =
    voiceStatus !== "idle" &&
    voiceStatus !== "error" &&
    voiceStatus !== "quota_exceeded";

  // ------- Centre content by status -------
  const renderCenter = () => {
    switch (voiceStatus) {
      case "idle":
        return (
          <Pressable
            onPress={handleStart}
            style={({ pressed }) => [
              styles.startButton,
              {
                backgroundColor: colors.accentPrimary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons name="mic" size={28} color={palette.white} />
            <Text style={[styles.startText, { color: palette.white }]}>
              Démarrer
            </Text>
          </Pressable>
        );

      case "connecting":
        return (
          <View style={styles.centerColumn}>
            <ActivityIndicator size="large" color={colors.accentPrimary} />
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
              Connexion...
            </Text>
          </View>
        );

      case "listening":
        return (
          <View style={styles.centerColumn}>
            <PulsingCircle color={colors.accentPrimary} />
            <Text
              style={[
                styles.statusLabel,
                { color: colors.textSecondary, marginTop: sp["2xl"] },
              ]}
            >
              À l'écoute...
            </Text>
          </View>
        );

      case "thinking":
        return (
          <View style={styles.centerColumn}>
            <ThinkingDots color={colors.accentPrimary} />
            <Text
              style={[
                styles.statusLabel,
                { color: colors.textSecondary, marginTop: sp.xl },
              ]}
            >
              Réflexion...
            </Text>
          </View>
        );

      case "speaking":
        return (
          <View style={styles.centerColumn}>
            <WaveformPlaceholder color={colors.accentPrimary} />
            <Text
              style={[
                styles.statusLabel,
                { color: colors.textSecondary, marginTop: sp.xl },
              ]}
            >
              DeepSight parle...
            </Text>
          </View>
        );

      case "error":
        return (
          <View style={styles.centerColumn}>
            <Ionicons name="alert-circle" size={48} color={palette.red} />
            <Text style={[styles.errorText, { color: palette.red }]}>
              {error || "Une erreur est survenue"}
            </Text>
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [
                styles.retryButton,
                { borderColor: palette.red, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.retryLabel, { color: palette.red }]}>
                Réessayer
              </Text>
            </Pressable>
          </View>
        );

      case "quota_exceeded":
        return (
          <View style={styles.centerColumn}>
            <Ionicons
              name="timer-outline"
              size={48}
              color={colors.accentWarning}
            />
            <Text style={[styles.errorText, { color: colors.textPrimary }]}>
              Quota de conversation vocale atteint
            </Text>
            <Pressable
              onPress={handleOpenAddon}
              style={({ pressed }) => [
                styles.upgradeButton,
                {
                  backgroundColor: colors.accentPrimary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Acheter un pack de minutes vocales"
            >
              <Text style={[styles.upgradeLabel, { color: palette.white }]}>
                Acheter des minutes
              </Text>
            </Pressable>
          </View>
        );

      default:
        return null;
    }
  };

  // ------- Transcript bubble renderer -------
  const renderMessage = useCallback(
    ({ item }: { item: VoiceMessage }) => {
      const isUser = item.source === "user";
      return (
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAI,
            {
              backgroundColor: isUser
                ? colors.accentPrimary
                : colors.bgTertiary,
            },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? palette.white : colors.textPrimary },
            ]}
          >
            {item.text}
          </Text>
        </View>
      );
    },
    [colors],
  );

  const keyExtractor = useCallback(
    (_item: VoiceMessage, index: number) => `voice-msg-${index}`,
    [],
  );

  // ------- Timer display -------
  const timerDisplay = useMemo(() => {
    return `${formatTime(elapsedSeconds)} / ${formatMinutes(remainingMinutes)} restantes`;
  }, [elapsedSeconds, remainingMinutes]);

  // ------- Render -------
  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(duration.slow)}
        style={[styles.root, { backgroundColor: colors.bgPrimary }]}
      >
        <Animated.View
          entering={SlideInDown.duration(duration.slower).springify()}
          style={[
            styles.innerContainer,
            {
              paddingTop: insets.top + sp.sm,
              paddingBottom: insets.bottom + sp.sm,
            },
          ]}
        >
          {/* ---- Header ---- */}
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text
                numberOfLines={1}
                style={[styles.videoTitle, { color: colors.textPrimary }]}
              >
                {videoTitle}
              </Text>
              {channelName ? (
                <Text
                  numberOfLines={1}
                  style={[styles.channelName, { color: colors.textTertiary }]}
                >
                  {channelName}
                </Text>
              ) : null}
            </View>
            <VoiceQuotaBadge
              minutesRemaining={remainingMinutes}
              onPress={handleOpenAddon}
            />
            <Pressable
              onPress={handleOpenSettings}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: colors.bgTertiary,
                  opacity: pressed ? 0.7 : 1,
                  marginLeft: sp.sm,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Paramètres vocaux"
            >
              <Ionicons
                name="settings-outline"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeButton,
                {
                  backgroundColor: colors.bgTertiary,
                  opacity: pressed ? 0.7 : 1,
                  marginLeft: sp.xs,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* ---- Context progress (Quick Voice Call mobile V3) ---- */}
          {streaming ? (
            <View
              testID="context-progress-bar"
              style={[
                styles.contextProgressContainer,
                {
                  backgroundColor: "rgba(245,180,0,0.08)",
                  borderColor: "rgba(245,180,0,0.25)",
                },
              ]}
            >
              {!contextComplete ? (
                <>
                  <Text
                    style={[styles.contextProgressLabel, { color: "#f5b400" }]}
                  >
                    🎙️ J'écoute la vidéo en même temps que toi · Analyse en
                    cours: {Math.floor(contextProgress)}%
                  </Text>
                  <View
                    style={[
                      styles.contextProgressTrack,
                      { backgroundColor: "rgba(255,255,255,0.08)" },
                    ]}
                  >
                    <View
                      style={[
                        styles.contextProgressFill,
                        {
                          backgroundColor: "#f5b400",
                          width: `${Math.max(0, Math.min(100, contextProgress))}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text
                  style={[styles.contextProgressLabel, { color: "#f5b400" }]}
                >
                  ✓ Contexte vidéo complet
                </Text>
              )}
            </View>
          ) : null}

          {/* ---- Centre ---- */}
          <View style={styles.center}>{renderCenter()}</View>

          {/* ---- Transcript ---- */}
          {messages.length > 0 && (
            <View style={styles.transcriptContainer}>
              <FlatList
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                inverted
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.transcriptContent}
              />
            </View>
          )}

          {/* ---- Footer ---- */}
          {isActive && (
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {/* Mute button */}
              <Pressable
                onPress={onMuteToggle}
                style={({ pressed }) => [
                  styles.footerButton,
                  {
                    backgroundColor: isMuted
                      ? colors.bgTertiary
                      : colors.bgSecondary,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color={isMuted ? palette.red : colors.textPrimary}
                />
              </Pressable>

              {/* Timer */}
              <Text style={[styles.timer, { color: colors.textSecondary }]}>
                {timerDisplay}
              </Text>

              {/* End button */}
              <Pressable
                onPress={handleStop}
                style={({ pressed }) => [
                  styles.endButton,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="stop" size={20} color={palette.white} />
              </Pressable>
            </View>
          )}
        </Animated.View>

        {/* Voice settings bottom sheet */}
        <VoiceSettings bottomSheetRef={settingsSheetRef} />
      </Animated.View>

      {/* Voice addon purchase modal */}
      <VoiceAddonModal
        visible={addonVisible}
        onClose={() => setAddonVisible(false)}
      />
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: sp.lg,
  },

  // Header
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitles: {
    flex: 1,
    marginRight: sp.md,
  },
  videoTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  channelName: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },

  // Context progress (Quick Voice Call mobile V3)
  contextProgressContainer: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginTop: sp.xs,
    marginBottom: sp.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  contextProgressLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    marginBottom: sp.xs,
  },
  contextProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  contextProgressFill: {
    height: "100%",
    borderRadius: 2,
  },

  // Centre
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerColumn: {
    alignItems: "center",
    justifyContent: "center",
  },
  statusLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.lg,
    marginTop: sp.lg,
  },

  // Start button
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: sp.lg,
    borderRadius: 40,
    gap: sp.sm,
  },
  startText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },

  // Error state
  errorText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    textAlign: "center",
    marginTop: sp.lg,
    marginHorizontal: sp["3xl"],
  },
  retryButton: {
    marginTop: sp.xl,
    paddingHorizontal: sp["2xl"],
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
  },
  retryLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },

  // Quota exceeded
  upgradeButton: {
    marginTop: sp.xl,
    paddingHorizontal: sp["2xl"],
    paddingVertical: sp.md,
    borderRadius: borderRadius.lg,
  },
  upgradeLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },

  // Pulse animation
  pulseContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRingOuter: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 70,
    borderWidth: 1,
  },
  pulseRing: {
    position: "absolute",
    top: 15,
    left: 15,
    right: 15,
    bottom: 15,
    borderRadius: 55,
    borderWidth: 2,
  },
  pulseCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  // Thinking dots
  dotsRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    height: 40,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },

  // Waveform
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 60,
  },
  waveBar: {
    width: 6,
    height: 40,
    borderRadius: 3,
  },

  // Transcript
  transcriptContainer: {
    maxHeight: 200,
  },
  transcriptContent: {
    paddingVertical: sp.sm,
    gap: sp.sm,
  },
  bubble: {
    maxWidth: "80%",
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.lg,
  },
  bubbleUser: {
    alignSelf: "flex-end",
    borderBottomRightRadius: borderRadius.sm,
  },
  bubbleAI: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: borderRadius.sm,
  },
  bubbleText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
  },

  // Footer
  footer: {
    height: 80,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: sp.sm,
  },
  footerButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  timer: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.sm,
  },
  endButton: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.full,
    backgroundColor: palette.red,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default VoiceScreen;
