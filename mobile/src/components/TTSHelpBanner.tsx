/**
 * TTSHelpBanner — One-time help banner explaining TTS features (mobile)
 */

import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Spacing, Typography, BorderRadius } from "../constants/theme";

const STORAGE_KEY = "deepsight_tts_help_seen";

export const TTSHelpBanner: React.FC = () => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val !== "true") setVisible(true);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(STORAGE_KEY, "true").catch(() => {});
  };

  if (!visible) return null;

  const content =
    language === "fr"
      ? "Lecture vocale — Écoutez les réponses de l'IA à voix haute. Activez le mode vocal dans la barre d'outils pour une lecture automatique, ou appuyez sur ▶ sur chaque réponse. Contrôlez la vitesse (1x à 3x), changez la langue (FR/EN) et la voix. Disponible dès le plan Pro."
      : "Voice Mode — Listen to AI responses read aloud. Enable voice mode in the toolbar for automatic playback, or tap ▶ on any response. Control speed (1x to 3x), switch language (FR/EN) and voice. Available from Pro plan.";

  const buttonText = language === "fr" ? "Compris" : "Got it";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.accentPrimary + "10",
          borderColor: colors.accentPrimary + "30",
        },
      ]}
    >
      <TouchableOpacity style={styles.closeButton} onPress={dismiss}>
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      <Text style={[styles.text, { color: colors.textSecondary }]}>
        🎙️ {content}
      </Text>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.accentPrimary + "15",
            borderColor: colors.accentPrimary + "30",
          },
        ]}
        onPress={dismiss}
      >
        <Text style={[styles.buttonText, { color: colors.accentPrimary }]}>
          {buttonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  closeButton: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    padding: 4,
    zIndex: 1,
  },
  text: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: 20,
    paddingRight: Spacing.lg,
  },
  button: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  buttonText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default TTSHelpBanner;
