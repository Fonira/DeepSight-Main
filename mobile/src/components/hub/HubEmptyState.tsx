/**
 * HubEmptyState — empty state du tab Hub.
 *
 * Affiché quand aucune `summaryId` n'est sélectionnée et qu'aucun fallback
 * "last conv" n'a été résolu (par hub.tsx). 2 CTA :
 *   - Coller un lien YouTube/TikTok → onPasteUrl(url) (parent appelle videoApi.quickChat)
 *   - Choisir une conversation existante → onPickConv() (parent ouvre ConversationsDrawer)
 *
 * Pattern URL input inspiré du Quick Chat block de mobile/app/(tabs)/index.tsx.
 *
 * Spec : `docs/superpowers/specs/2026-05-04-mobile-hub-tab-unified-design.md` §4.6
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { palette } from "@/theme/colors";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize } from "@/theme/typography";

interface HubEmptyStateProps {
  onPickConv: () => void;
  onPasteUrl: (url: string) => void;
}

export const HubEmptyState: React.FC<HubEmptyStateProps> = ({
  onPickConv,
  onPasteUrl,
}) => {
  const { colors } = useTheme();
  const [url, setUrl] = useState("");

  const handleSubmit = () => {
    const trimmed = url.trim();
    const isValid =
      trimmed.includes("youtube.com") ||
      trimmed.includes("youtu.be") ||
      trimmed.includes("tiktok.com");
    if (!isValid) {
      Alert.alert("Lien invalide", "Colle un lien YouTube ou TikTok.");
      return;
    }
    onPasteUrl(trimmed);
    setUrl("");
  };

  const trimmedHasValue = url.trim().length > 0;

  return (
    <View style={styles.root}>
      <Ionicons
        name="chatbubbles-outline"
        size={64}
        color={colors.textTertiary}
      />
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        Aucune conversation
      </Text>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        Colle un lien YouTube ou TikTok, ou choisis une conversation existante.
      </Text>

      {/* CTA 1 — URL paste */}
      <View
        style={[
          styles.urlRow,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder="https://youtube.com/... ou tiktok.com/..."
          placeholderTextColor={colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        <Pressable
          style={[
            styles.urlBtn,
            {
              backgroundColor: trimmedHasValue
                ? palette.indigo
                : colors.bgSecondary,
            },
          ]}
          onPress={handleSubmit}
          disabled={!trimmedHasValue}
          accessibilityLabel="Lancer la conversation"
        >
          <Ionicons
            name="arrow-forward"
            size={20}
            color={trimmedHasValue ? "#fff" : colors.textMuted}
          />
        </Pressable>
      </View>

      {/* CTA 2 — Pick conv */}
      <Pressable
        style={[
          styles.pickConv,
          {
            backgroundColor: colors.bgElevated,
            borderColor: colors.border,
          },
        ]}
        onPress={onPickConv}
      >
        <Ionicons name="list-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.pickConvText, { color: colors.textSecondary }]}>
          Choisir une conversation
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp.xl,
    gap: sp.md,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    marginTop: sp.md,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: sp.lg,
  },
  urlRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 4,
    width: "100%",
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: sp.md,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  urlBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  pickConv: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    paddingVertical: sp.md,
    paddingHorizontal: sp.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  pickConvText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});

export default HubEmptyState;
