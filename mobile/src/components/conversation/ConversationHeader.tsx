/**
 * ConversationHeader — header du ConversationScreen :
 * title (videoTitle) + plateforme badge + VoiceQuotaBadge + settings + close.
 *
 * Repris du pattern header de VoiceScreen.tsx (lignes 502-560).
 */

import React from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { VoiceQuotaBadge } from "../voice/VoiceQuotaBadge";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

type Platform_ = "youtube" | "tiktok" | "live";

interface ConversationHeaderProps {
  videoTitle: string;
  channelName?: string;
  platform: Platform_;
  remainingMinutes: number;
  onOpenSettings: () => void;
  onOpenAddon: () => void;
  onClose: () => void;
}

const platformBadge = (p: Platform_) => {
  if (p === "tiktok")
    return { label: "TikTok", bg: "#010101", border: "#333" };
  if (p === "live")
    return { label: "Live", bg: "rgba(245,180,0,0.20)", border: "#f5b400" };
  return { label: "YT", bg: "#FF0000", border: "#FF0000" };
};

export const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  videoTitle,
  channelName,
  platform,
  remainingMinutes,
  onOpenSettings,
  onOpenAddon,
  onClose,
}) => {
  const { colors } = useTheme();
  const badge = platformBadge(platform);

  const handleSettings = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onOpenSettings();
  };

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.titles}>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: colors.textPrimary }]}
        >
          {videoTitle}
        </Text>
        {channelName ? (
          <Text
            numberOfLines={1}
            style={[styles.channel, { color: colors.textTertiary }]}
          >
            {channelName}
          </Text>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={styles.badgeText}>{badge.label}</Text>
      </View>
      <VoiceQuotaBadge
        minutesRemaining={remainingMinutes}
        onPress={onOpenAddon}
      />
      <Pressable
        onPress={handleSettings}
        hitSlop={12}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: colors.bgTertiary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Paramètres vocaux"
      >
        <Ionicons
          name="settings-outline"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: colors.bgTertiary,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={20} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    gap: sp.xs,
    borderBottomWidth: 1,
  },
  titles: {
    flex: 1,
    marginRight: sp.xs,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  channel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize["2xs"],
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    color: "#ffffff",
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default ConversationHeader;
