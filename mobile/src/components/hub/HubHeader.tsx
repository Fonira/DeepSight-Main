// mobile/src/components/hub/HubHeader.tsx
//
// Header sticky : burger drawer + DeepSightLogo + titre/sous-titre + slot PiP top-right.

import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fontFamily } from "@/theme/typography";
import { DeepSightLogo } from "./DeepSightLogo";

interface Props {
  onMenuClick: () => void;
  title: string;
  subtitle?: string;
  /** Source video active - drive l'icone plateforme inline dans subtitle. */
  videoSource?: "youtube" | "tiktok" | null;
  pipSlot?: React.ReactNode;
}

const SOURCE_ICON: Record<
  "youtube" | "tiktok",
  { src: ReturnType<typeof require>; alt: string }
> = {
  youtube: {
    src: require("@/assets/platforms/youtube-icon-red.png"),
    alt: "YouTube",
  },
  tiktok: {
    src: require("@/assets/platforms/tiktok-note-color.png"),
    alt: "TikTok",
  },
};

export const HubHeader: React.FC<Props> = ({
  onMenuClick,
  title,
  subtitle,
  videoSource,
  pipSlot,
}) => {
  const sourceIcon =
    videoSource && SOURCE_ICON[videoSource] ? SOURCE_ICON[videoSource] : null;

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onMenuClick}
        accessibilityLabel="Conversations"
        style={styles.menuBtn}
      >
        <Ionicons name="menu" size={20} color="rgba(255,255,255,0.65)" />
      </Pressable>
      <DeepSightLogo size={36} />
      <View style={styles.titleCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <View style={styles.subtitleRow}>
            {sourceIcon ? (
              <Image
                source={sourceIcon.src}
                style={styles.sourceIcon}
                accessibilityLabel={sourceIcon.alt}
              />
            ) : null}
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          </View>
        ) : null}
      </View>
      {pipSlot ? <View style={styles.pipSlot}>{pipSlot}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.02)",
    zIndex: 10,
  },
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    color: "#ffffff",
    fontFamily: fontFamily.bodyMedium,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  sourceIcon: {
    width: 12,
    height: 12,
    opacity: 0.9,
  },
  subtitle: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    flexShrink: 1,
  },
  pipSlot: {
    flexShrink: 0,
  },
});
