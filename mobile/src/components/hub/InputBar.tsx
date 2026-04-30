// mobile/src/components/hub/InputBar.tsx
//
// Barre d'entree bottom : + / TextInput / si vide : phone + mic-hold sinon : send indigo.
// MicHold = Pressable onPressIn / onPressOut, ouvre full call si > 0.4s.
// Tooltip "ENREGISTREMENT" rouge en absolute top via Reanimated FadeIn.

import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { fontFamily } from "@/theme/typography";

interface Props {
  onSend: (text: string) => void;
  onCallToggle: () => void;
  /** Callback quand l'user release le mic apres > 0.4s. */
  onPttHoldComplete: (durationSecs: number) => void;
  disabled?: boolean;
}

export const InputBar: React.FC<Props> = ({
  onSend,
  onCallToggle,
  onPttHoldComplete,
  disabled,
}) => {
  const [val, setVal] = useState("");
  const [holding, setHolding] = useState(false);
  const [duration, setDuration] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    if (!holding) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    startedAtRef.current = Date.now();
    setDuration(0);
    tickRef.current = setInterval(() => {
      setDuration((Date.now() - startedAtRef.current) / 1000);
    }, 80);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [holding]);

  const startHold = () => {
    if (disabled) return;
    setHolding(true);
  };

  const endHold = () => {
    if (holding && duration > 0.4) {
      onPttHoldComplete(duration);
    }
    setHolding(false);
    setDuration(0);
  };

  const send = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setVal("");
    Keyboard.dismiss();
  };

  const hasText = val.trim().length > 0;

  return (
    <View style={styles.bar}>
      <Pressable accessibilityLabel="Pieces jointes" style={styles.iconBtn}>
        <Ionicons name="add" size={20} color="rgba(255,255,255,0.45)" />
      </Pressable>

      <TextInput
        value={val}
        onChangeText={setVal}
        onSubmitEditing={send}
        placeholder="Posez votre question - ou maintenez le micro…"
        placeholderTextColor="rgba(255,255,255,0.35)"
        editable={!disabled}
        returnKeyType="send"
        multiline={false}
        style={styles.input}
        accessibilityLabel="Champ de saisie"
      />

      {hasText ? (
        <Pressable
          onPress={send}
          disabled={disabled}
          accessibilityLabel="Envoyer"
          style={[styles.sendBtn, disabled && styles.sendBtnDisabled]}
        >
          <Ionicons name="send" size={16} color="#ffffff" />
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={onCallToggle}
            accessibilityLabel="Mode Full Call"
            style={styles.iconBtn}
          >
            <Ionicons name="call" size={18} color="rgba(255,255,255,0.55)" />
          </Pressable>
          <Pressable
            onPressIn={startHold}
            onPressOut={endHold}
            accessibilityLabel="Maintenir pour enregistrer"
            style={[
              styles.micBtn,
              holding ? styles.micBtnHolding : styles.micBtnRest,
            ]}
          >
            <Ionicons
              name="mic"
              size={18}
              color={holding ? "#ffffff" : "#6366f1"}
            />
          </Pressable>
        </>
      )}

      {holding ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={styles.recordTip}
        >
          <Text style={styles.recordTipText}>
            ● ENREGISTREMENT · {duration.toFixed(1)}s
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: "#e8e8f0",
    fontSize: 14,
    fontFamily: fontFamily.body,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnRest: {
    backgroundColor: "rgba(99,102,241,0.15)",
  },
  micBtnHolding: {
    backgroundColor: "#ef4444",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.5)",
    transform: [{ scale: 1.12 }],
  },
  recordTip: {
    position: "absolute",
    bottom: "100%",
    right: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ef4444",
    borderRadius: 12,
  },
  recordTipText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: fontFamily.mono,
  },
});
