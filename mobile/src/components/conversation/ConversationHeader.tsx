/**
 * ConversationHeader — header du ConversationScreen :
 * title (videoTitle) + plateforme badge + VoiceQuotaBadge + settings + close.
 *
 * Repris du pattern header de VoiceScreen.tsx (lignes 502-560).
 *
 * Polish (mai 2026) :
 * - Settings icon : rotation 90° au press (Reanimated withSpring)
 * - Title onPress : scroll horizontal smooth pour les titres tronqués (long videos)
 * - Press scale 0.92 sur close button
 * - haptics.light sur settings, selection sur title, light sur close
 * - VoiceQuotaBadge déjà animé via son onPress (haptic interne)
 */

import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { VoiceQuotaBadge } from "../voice/VoiceQuotaBadge";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { haptics } from "../../utils/haptics";

type Platform_ = "youtube" | "tiktok" | "live";

interface ConversationHeaderProps {
  videoTitle: string;
  channelName?: string;
  platform: Platform_;
  remainingMinutes: number;
  onOpenSettings: () => void;
  onOpenAddon: () => void;
  /** Hub tab : burger ouvre ConversationsDrawer. Si null/absent : pas de burger. */
  onMenuPress?: () => void;
  /** Modal mode : close button. Si null/absent : pas de close. */
  onClose?: () => void;
}

const platformBadge = (p: Platform_) => {
  if (p === "tiktok") return { label: "TikTok", bg: "#010101", border: "#333" };
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
  onMenuPress,
  onClose,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const badge = platformBadge(platform);

  // Settings icon rotation
  const settingsRotation = useSharedValue(0);
  const settingsStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${settingsRotation.value}deg` }],
  }));

  // Close button press scale
  const closeScale = useSharedValue(1);
  const closeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeScale.value }],
  }));

  // Title horizontal scroll (overflow long titles)
  const titleScrollRef = useRef<ScrollView | null>(null);
  const [titleContentWidth, setTitleContentWidth] = useState(0);
  const [titleViewportWidth, setTitleViewportWidth] = useState(0);
  const [titleScrollX, setTitleScrollX] = useState(0);

  const titleOverflows = titleContentWidth > titleViewportWidth + 4;

  const handleSettings = () => {
    haptics.light();
    settingsRotation.value = withSpring(settingsRotation.value === 0 ? 90 : 0, {
      damping: 12,
      stiffness: 220,
    });
    onOpenSettings();
  };

  const handleClosePressIn = () => {
    closeScale.value = withTiming(0.92, { duration: 80 });
  };
  const handleClosePressOut = () => {
    closeScale.value = withSpring(1, { damping: 12, stiffness: 240 });
  };
  const handleClose = () => {
    haptics.light();
    onClose?.();
  };

  const handleMenu = () => {
    haptics.light();
    onMenuPress?.();
  };

  const handleTitlePress = () => {
    if (!titleOverflows || !titleScrollRef.current) return;
    haptics.selection();
    // Toggle between start (0) and end of overflowing content
    const targetX =
      titleScrollX > 4
        ? 0
        : Math.max(0, titleContentWidth - titleViewportWidth);
    titleScrollRef.current.scrollTo({ x: targetX, animated: true });
  };

  const handleTitleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setTitleScrollX(e.nativeEvent.contentOffset.x);
  };

  const handleTitleLayout = (e: LayoutChangeEvent) => {
    setTitleViewportWidth(e.nativeEvent.layout.width);
  };

  return (
    <View
      style={[
        styles.header,
        {
          borderBottomColor: colors.border,
          paddingTop: insets.top + sp.sm,
        },
      ]}
    >
      {onMenuPress ? (
        <Pressable
          onPress={handleMenu}
          hitSlop={12}
          testID="header-menu"
          style={({ pressed }) => [
            styles.iconBtn,
            {
              backgroundColor: colors.bgTertiary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Conversations"
        >
          <Ionicons
            name="menu-outline"
            size={24}
            color={colors.textSecondary}
          />
        </Pressable>
      ) : null}
      <Pressable
        style={styles.titles}
        onPress={handleTitlePress}
        onLayout={handleTitleLayout}
        accessibilityRole="header"
        accessibilityLabel={`${videoTitle}${channelName ? ` — ${channelName}` : ""}`}
      >
        <ScrollView
          ref={titleScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={titleOverflows}
          onScroll={handleTitleScroll}
          onContentSizeChange={(w) => setTitleContentWidth(w)}
          scrollEventThrottle={16}
          contentContainerStyle={styles.titleScrollContent}
        >
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {videoTitle}
          </Text>
        </ScrollView>
        {channelName ? (
          <Text
            numberOfLines={1}
            style={[styles.channel, { color: colors.textTertiary }]}
          >
            {channelName}
          </Text>
        ) : null}
      </Pressable>
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
        testID="header-settings"
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
        <Animated.View style={settingsStyle}>
          <Ionicons
            name="settings-outline"
            size={18}
            color={colors.textSecondary}
          />
        </Animated.View>
      </Pressable>
      {onClose ? (
        <Animated.View style={closeStyle}>
          <Pressable
            onPress={handleClose}
            onPressIn={handleClosePressIn}
            onPressOut={handleClosePressOut}
            hitSlop={12}
            testID="header-close"
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
        </Animated.View>
      ) : null}
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
  titleScrollContent: {
    alignItems: "center",
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
