/**
 * ConversationInput — Champ de saisie unifié + bouton Send + bouton Mic.
 *
 * Comportement du bouton Mic dépend de `voiceMode` :
 * - 'off' : tap = `onMicTap` (le caller ouvre `Alert.alert` confirm puis start)
 * - 'live' : tap = `onMicTap` (le caller appelle toggleMute)
 * - 'ended' / 'quota_exceeded' : bouton désactivé visuellement
 *
 * Affiche une quotaText en bas (questions chat ou minutes voice restantes).
 */

import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import type { VoiceMode } from "../../hooks/useConversation";

interface ConversationInputProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  onMicTap: () => void;
  isLoading: boolean;
  voiceMode: VoiceMode;
  isMuted: boolean;
  quotaText: string;
}

export const ConversationInput: React.FC<ConversationInputProps> = ({
  inputText,
  setInputText,
  onSend,
  onMicTap,
  isLoading,
  voiceMode,
  isMuted,
  quotaText,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const canSend = inputText.trim().length > 0 && !isLoading;

  // Placeholder dynamique selon voiceMode
  const placeholder =
    voiceMode === "live" ? "Écris pendant l'appel..." : "Pose une question...";

  // Bouton mic — couleur + icône selon voiceMode + isMuted
  let micIcon: React.ComponentProps<typeof Ionicons>["name"] = "mic-outline";
  let micColor = colors.textMuted;
  let micBg = colors.bgElevated;

  if (voiceMode === "live") {
    micIcon = isMuted ? "mic-off" : "mic";
    micColor = isMuted ? palette.red : palette.white;
    micBg = isMuted ? colors.bgElevated : palette.indigo;
  } else if (voiceMode === "off") {
    micIcon = "mic-outline";
    micColor = colors.textTertiary;
    micBg = colors.bgElevated;
  }

  const micDisabled = voiceMode === "ended" || voiceMode === "quota_exceeded";

  return (
    <View
      style={[
        styles.inputWrapper,
        // Edge-to-edge: l'input gère son propre bottom safe area car
        // ConversationScreen ne pad plus.
        { paddingBottom: Math.max(insets.bottom, sp.sm) },
      ]}
    >
      <View
        style={[
          styles.inputRow,
          { backgroundColor: colors.bgCard, borderColor: colors.border },
        ]}
      >
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.textInput, { color: colors.textPrimary }]}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={onSend}
          blurOnSubmit={false}
          accessibilityLabel="Champ de message"
        />
        <Pressable
          onPress={onMicTap}
          disabled={micDisabled}
          style={[
            styles.micButton,
            { backgroundColor: micBg, opacity: micDisabled ? 0.4 : 1 },
          ]}
          accessibilityLabel={
            voiceMode === "live"
              ? isMuted
                ? "Réactiver le micro"
                : "Couper le micro"
              : "Démarrer un appel vocal"
          }
          accessibilityRole="button"
        >
          <Ionicons name={micIcon} size={18} color={micColor} />
        </Pressable>
        <Pressable
          onPress={onSend}
          disabled={!canSend}
          style={[
            styles.sendButton,
            { backgroundColor: canSend ? palette.indigo : colors.bgElevated },
          ]}
          accessibilityLabel="Envoyer"
          accessibilityRole="button"
        >
          <Ionicons
            name="send"
            size={18}
            color={canSend ? "#ffffff" : colors.textMuted}
          />
        </Pressable>
      </View>
      <Text style={[styles.quotaText, { color: colors.textMuted }]}>
        {quotaText}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
    paddingTop: sp.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingLeft: sp.lg,
    paddingRight: sp.xs,
    paddingVertical: sp.xs,
    gap: sp.xs,
  },
  textInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    maxHeight: 100,
    paddingVertical: sp.sm,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quotaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
    textAlign: "center",
    marginTop: sp.xs,
  },
});

export default ConversationInput;
