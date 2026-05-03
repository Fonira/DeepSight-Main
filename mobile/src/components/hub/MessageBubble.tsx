// mobile/src/components/hub/MessageBubble.tsx
//
// Bulle message Hub (text user, text AI, voice user/AI).
// User: bulle indigo-tinted right. AI: pas de bulle - label "DeepSight" mono + texte light.
// Voice avec audio_duration_secs > 0 -> rendre via VoiceBubble.

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily } from "@/theme/typography";
import type { HubMessage } from "./types";
import { VoiceBubble } from "./VoiceBubble";

interface Props {
  msg: HubMessage;
  /** Optional sampled bars override; otherwise use a deterministic default. */
  bars?: number[];
}

const DEFAULT_BARS = [
  6, 14, 9, 20, 11, 16, 8, 18, 12, 22, 9, 15, 7, 19, 11, 14, 8, 17, 10, 13, 6,
  21, 9, 12, 15, 8, 17, 10,
];

const MessageBubbleComponent: React.FC<Props> = ({ msg, bars }) => {
  const isUser = msg.role === "user";
  const isVoiceBubble =
    (msg.source === "voice_user" || msg.source === "voice_agent") &&
    typeof msg.audio_duration_secs === "number" &&
    msg.audio_duration_secs > 0;

  if (isVoiceBubble) {
    return (
      <View style={[styles.row, isUser ? styles.rowEnd : styles.rowStart]}>
        <VoiceBubble
          durationSecs={msg.audio_duration_secs as number}
          bars={bars ?? DEFAULT_BARS}
          transcript={msg.content}
          side={isUser ? "user" : "ai"}
        />
      </View>
    );
  }

  const isVoiceText =
    msg.source === "voice_user" || msg.source === "voice_agent";

  if (isUser) {
    return (
      <View style={[styles.row, styles.rowEnd]}>
        <View style={styles.userBubble} testID={`hub-msg-${msg.source}`}>
          {isVoiceText ? (
            <View style={styles.voiceTagRow}>
              <Ionicons name="mic" size={10} color="#06b6d4" />
              <Text style={styles.voiceTagText}>VOCAL</Text>
              {typeof msg.time_in_call_secs === "number" ? (
                <Text style={styles.voiceTagTime}>
                  {" · "}
                  {Math.floor(msg.time_in_call_secs / 60)}:
                  {Math.floor(msg.time_in_call_secs % 60)
                    .toString()
                    .padStart(2, "0")}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.userText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  // AI text - pas de bulle, label "DeepSight" mono + texte
  return (
    <View style={[styles.row, styles.rowStart]}>
      <View style={styles.aiCol} testID={`hub-msg-${msg.source}`}>
        <Text style={styles.aiLabel}>
          {isVoiceText ? "DeepSight · reponse vocale" : "DeepSight"}
        </Text>
        <Text style={styles.aiText}>{msg.content}</Text>
      </View>
    </View>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    width: "100%",
  },
  rowEnd: {
    justifyContent: "flex-end",
  },
  rowStart: {
    justifyContent: "flex-start",
  },
  userBubble: {
    maxWidth: "85%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.20)",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 14,
  },
  userText: {
    color: "#e8e8f0",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fontFamily.body,
  },
  aiCol: {
    maxWidth: "92%",
    flexDirection: "column",
  },
  aiLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: "#6b6b7d",
    marginBottom: 6,
  },
  aiText: {
    color: "#e8e8f0",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: fontFamily.body,
  },
  voiceTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  voiceTagText: {
    fontFamily: fontFamily.mono,
    fontSize: 10,
    color: "#06b6d4",
    letterSpacing: 1,
  },
  voiceTagTime: {
    fontSize: 10,
    color: "rgba(6,182,212,0.6)",
    fontFamily: fontFamily.mono,
  },
});
