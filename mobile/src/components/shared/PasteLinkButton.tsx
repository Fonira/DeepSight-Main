/**
 * PasteLinkButton (mobile / Expo) — read clipboard via expo-clipboard,
 * normalize as YouTube/TikTok URL, insert via onPaste, surface inline
 * tooltip feedback (no Toast lib in mobile yet — use ephemeral inline text).
 */

import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { borderRadius, sp } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { normalizeVideoUrl } from "../../utils/urlNormalizer";

interface Labels {
  title: string;
  youtube: string;
  tiktok: string;
  raw: string;
  empty: string;
  denied: string;
}

const LABELS_FR: Labels = {
  title: "Coller le lien",
  youtube: "Lien YouTube détecté",
  tiktok: "Lien TikTok détecté",
  raw: "Pas un lien vidéo reconnu",
  empty: "Presse-papiers vide",
  denied: "Accès au presse-papiers refusé",
};

const LABELS_EN: Labels = {
  title: "Paste link",
  youtube: "YouTube link detected",
  tiktok: "TikTok link detected",
  raw: "Not a recognized video link",
  empty: "Clipboard is empty",
  denied: "Clipboard access denied",
};

export interface PasteLinkButtonProps {
  /** Called with text to insert (canonical URL when recognized, raw text otherwise). */
  onPaste: (text: string) => void;
  /** UI language. Default 'fr'. */
  language?: "fr" | "en";
  /** Disable the button. */
  disabled?: boolean;
  /** Compact size. Default 32×32. */
  size?: number;
}

export const PasteLinkButton: React.FC<PasteLinkButtonProps> = ({
  onPaste,
  language = "fr",
  disabled = false,
  size = 32,
}) => {
  const { colors } = useTheme();
  const t = language === "en" ? LABELS_EN : LABELS_FR;
  const [flash, setFlash] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const flashTooltip = useCallback((msg: string, ok: boolean) => {
    setFlash(msg);
    setSuccess(ok);
    setTimeout(() => {
      setFlash(null);
      setSuccess(false);
    }, 1600);
  }, []);

  const handlePress = useCallback(async () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {
      /* haptics may fail on iOS Simulator */
    });
    let raw = "";
    try {
      raw = await Clipboard.getStringAsync();
    } catch {
      flashTooltip(t.denied, false);
      return;
    }
    const trimmed = (raw || "").trim();
    if (!trimmed) {
      flashTooltip(t.empty, false);
      return;
    }
    const normalized = normalizeVideoUrl(trimmed);
    if (normalized) {
      onPaste(normalized.canonicalUrl);
      flashTooltip(
        normalized.platform === "youtube" ? t.youtube : t.tiktok,
        true,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {
          /* haptics may fail on iOS Simulator */
        },
      );
      return;
    }
    onPaste(trimmed);
    flashTooltip(t.raw, false);
  }, [disabled, onPaste, t, flashTooltip]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={t.title}
        style={({ pressed }) => [
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.bgElevated,
            opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons
          name={success ? "checkmark" : "clipboard-outline"}
          size={Math.round(size * 0.5)}
          color={success ? colors.accentSuccess : colors.textTertiary}
        />
      </Pressable>
      {flash !== null && (
        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: colors.bgCard,
              borderColor: colors.border,
            },
          ]}
          pointerEvents="none"
        >
          <Text style={[styles.tooltipText, { color: colors.textPrimary }]}>
            {flash}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    marginBottom: sp.xs,
    alignSelf: "center",
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 160,
    maxWidth: 240,
  },
  tooltipText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
    textAlign: "center",
  },
});

export default PasteLinkButton;
