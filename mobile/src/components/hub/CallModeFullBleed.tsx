// mobile/src/components/hub/CallModeFullBleed.tsx
//
// Mode appel plein ecran : orbe gradient violet/indigo/cyan + 2 rings concentriques.
// Top bar : back chevron + label "FULL CALL" + timer mono.
// Live transcript en bas. 3 boutons controls : mute / hangup (rouge) / clavier.
// Reanimated 4 pour la sequence d'animations (slide-up entry, ring scale, glow).

import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";
import { fontFamily } from "@/theme/typography";

interface Props {
  open: boolean;
  onClose: () => void;
  summaryId: number | null;
  title: string | null;
  subtitle: string | null;
  language?: "fr" | "en";
}

const SAMPLE_AGENT_LINE =
  "Lex articule trois niveaux : phenomenale, fonctionnelle et le hard problem. Le hard problem, formule par Chalmers, c'est…";
const SAMPLE_USER_LINE = "…en attente de votre prochaine question.";

export const CallModeFullBleed: React.FC<Props> = ({
  open,
  onClose,
  title,
  subtitle,
}) => {
  const [muted, setMuted] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [tick, setTick] = useState(0);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reanimated shared values for orb + rings
  const ringOuter = useSharedValue(1);
  const ringMid = useSharedValue(1);
  const orbScale = useSharedValue(0.7);

  useEffect(() => {
    if (!open) return;
    setTick(0);
    setAiSpeaking(false);
    tickIntervalRef.current = setInterval(() => {
      setTick((t) => t + 1);
      setAiSpeaking((s) => (Math.random() > 0.4 ? !s : s));
    }, 1200);
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      cancelAnimation(ringOuter);
      cancelAnimation(ringMid);
      cancelAnimation(orbScale);
      return;
    }
    ringOuter.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    ringMid.value = withRepeat(
      withSequence(
        withTiming(1.15, {
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
  }, [open, ringOuter, ringMid, orbScale]);

  // animate orb based on aiSpeaking
  useEffect(() => {
    const target = aiSpeaking ? 0.95 : 0.75;
    orbScale.value = withTiming(target, { duration: 400 });
  }, [aiSpeaking, orbScale]);

  const ringOuterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringOuter.value }],
    opacity: aiSpeaking ? 0.7 : 0.4,
  }));
  const ringMidStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringMid.value }],
    opacity: aiSpeaking ? 0.5 : 0.25,
  }));
  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: orbScale.value }],
  }));

  const elapsedSecs = Math.floor((tick * 1.2) % 60);
  const elapsedMins = Math.floor((tick * 1.2) / 60);

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        entering={SlideInDown.duration(320).easing(
          Easing.bezier(0.4, 0, 0.2, 1),
        )}
        exiting={SlideOutDown.duration(280)}
        style={styles.root}
      >
        <LinearGradient
          colors={["#0a0a0f", "#0f0a1f"]}
          style={StyleSheet.absoluteFillObject as any}
        />
        {/* Ambient gradient layer */}
        <View
          style={[
            styles.ambient,
            aiSpeaking ? styles.ambientSpeaking : styles.ambientIdle,
          ]}
        />

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Fermer"
            style={styles.topBtn}
          >
            <Ionicons name="chevron-down" size={20} color="#e8e8f0" />
          </Pressable>
          <View style={styles.topCenter}>
            <Text style={styles.topLabel}>FULL CALL</Text>
            <Text style={styles.topTimer}>
              {elapsedMins}:{String(elapsedSecs).padStart(2, "0")}
            </Text>
          </View>
          <View style={styles.topBtnSpacer} />
        </View>

        {/* Orb */}
        <View style={styles.orbWrap}>
          <View style={styles.orbContainer}>
            {/* outer ring */}
            <Animated.View style={[styles.ringOuter, ringOuterStyle]} />
            {/* mid ring */}
            <Animated.View style={[styles.ringMid, ringMidStyle]} />
            {/* core */}
            <Animated.View style={[styles.orbCore, orbStyle]}>
              <LinearGradient
                colors={["#8b5cf6", "#6366f1", "#06b6d4"]}
                start={{ x: 0.35, y: 0.3 }}
                end={{ x: 1, y: 1 }}
                style={styles.orbGradient}
              />
            </Animated.View>
          </View>
        </View>

        {/* Live transcript */}
        <View style={styles.transcriptWrap}>
          <Text style={styles.transcriptLabel}>
            {aiSpeaking ? "DEEPSIGHT PARLE" : "VOUS ECOUTEZ"}
          </Text>
          <Text
            style={[
              styles.transcriptText,
              aiSpeaking ? styles.transcriptActive : styles.transcriptIdle,
            ]}
          >
            {aiSpeaking ? SAMPLE_AGENT_LINE : SAMPLE_USER_LINE}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <Pressable
            onPress={() => setMuted((m) => !m)}
            accessibilityLabel={muted ? "Activer micro" : "Couper micro"}
            style={[
              styles.ctrlBtn,
              muted ? styles.ctrlBtnMuted : styles.ctrlBtnNormal,
            ]}
          >
            <Ionicons
              name={muted ? "mic-off" : "mic"}
              size={22}
              color={muted ? "#ef4444" : "#e8e8f0"}
            />
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Raccrocher"
            style={styles.hangupBtn}
          >
            <Ionicons name="call" size={24} color="#ffffff" />
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Clavier"
            style={styles.ctrlBtnNormal}
          >
            <Ionicons name="keypad" size={22} color="#e8e8f0" />
          </Pressable>
        </View>

        {title ? (
          <Text style={styles.fineTitle}>
            {title}
            {subtitle ? ` · ${subtitle}` : ""}
          </Text>
        ) : null}
      </Animated.View>
    </Modal>
  );
};

const ORB_SIZE = 220;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: "hidden",
  },
  ambient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
  },
  ambientSpeaking: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  ambientIdle: {
    backgroundColor: "rgba(139,92,246,0.08)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  topBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnSpacer: {
    width: 36,
  },
  topCenter: {
    alignItems: "center",
  },
  topLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    fontFamily: fontFamily.mono,
    letterSpacing: 1.2,
  },
  topTimer: {
    fontSize: 13,
    color: "#e8e8f0",
    marginTop: 2,
    fontFamily: fontFamily.mono,
  },
  orbWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orbContainer: {
    position: "relative",
    width: ORB_SIZE,
    height: ORB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ringOuter: {
    position: "absolute",
    width: ORB_SIZE + 40,
    height: ORB_SIZE + 40,
    borderRadius: (ORB_SIZE + 40) / 2,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.35)",
  },
  ringMid: {
    position: "absolute",
    width: ORB_SIZE + 80,
    height: ORB_SIZE + 80,
    borderRadius: (ORB_SIZE + 80) / 2,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.30)",
  },
  orbCore: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: "hidden",
  },
  orbGradient: {
    flex: 1,
    borderRadius: ORB_SIZE / 2,
  },
  transcriptWrap: {
    paddingHorizontal: 32,
    paddingBottom: 20,
    minHeight: 80,
  },
  transcriptLabel: {
    fontSize: 10,
    fontFamily: fontFamily.mono,
    letterSpacing: 1.4,
    color: "rgba(255,255,255,0.40)",
    textAlign: "center",
    marginBottom: 8,
  },
  transcriptText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: fontFamily.body,
    minHeight: 48,
  },
  transcriptActive: {
    color: "#e8e8f0",
  },
  transcriptIdle: {
    color: "rgba(255,255,255,0.40)",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
  },
  ctrlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlBtnMuted: {
    backgroundColor: "rgba(239,68,68,0.18)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.40)",
  },
  ctrlBtnNormal: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  hangupBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "135deg" }],
  },
  fineTitle: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.30)",
    fontFamily: fontFamily.mono,
  },
});
