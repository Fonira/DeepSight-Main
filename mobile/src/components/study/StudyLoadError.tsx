/**
 * État d'erreur des flashcards / quiz : message lisible + bouton Réessayer
 * (avant : toute erreur s'affichait « Aucune flashcard / question disponible »).
 */
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface StudyLoadErrorProps {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}

export const StudyLoadError: React.FC<StudyLoadErrorProps> = ({
  message,
  retryLabel,
  onRetry,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
      <Text
        style={[styles.message, { color: colors.textSecondary }]}
        accessibilityRole="alert"
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={[styles.retryButton, { borderColor: colors.accentPrimary }]}
        accessibilityRole="button"
        accessibilityLabel={retryLabel}
        testID="study-load-error-retry"
      >
        <Text style={[styles.retryText, { color: colors.accentPrimary }]}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp["2xl"],
    gap: sp.lg,
  },
  message: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: sp["2xl"],
    paddingVertical: sp.md,
  },
  retryText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
});
