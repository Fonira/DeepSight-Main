import React, { useCallback, useMemo } from "react";
import {
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { palette } from "@/theme/colors";
import { fontFamily, fontSize } from "@/theme/typography";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Timing config — fast & intentional, no springy bounce */
const ANIM_CONFIG = {
  duration: 180,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
} as const;

const ICON_SIZE = 22;
const TAB_BAR_HEIGHT = 56;

/** Tab definitions — only routes listed here appear in the bar */
const TAB_META: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    iconFocused: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  index: { icon: "home-outline", iconFocused: "home", label: "Accueil" },
  library: { icon: "time-outline", iconFocused: "time", label: "Historique" },
  study: { icon: "book-outline", iconFocused: "book", label: "Étude" },
  subscription: {
    icon: "sparkles-outline",
    iconFocused: "sparkles",
    label: "Abo",
  },
  profile: {
    icon: "settings-outline",
    iconFocused: "settings",
    label: "Profil",
  },
};

// ---------------------------------------------------------------------------
// TabItem (each tab icon + label + animations)
// ---------------------------------------------------------------------------

interface TabItemProps {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  width: number;
  isDark: boolean;
}

function TabItem({
  routeName,
  isFocused,
  onPress,
  onLongPress,
  width,
  isDark,
}: TabItemProps) {
  const meta = TAB_META[routeName];
  if (!meta) return null;

  // Shared value that drives all animations for this tab
  const progress = useSharedValue(isFocused ? 1 : 0);

  // Scale on press (not persistent — just a tap impulse)
  const scalePress = useSharedValue(1);

  React.useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, ANIM_CONFIG);
  }, [isFocused, progress]);

  const handlePressIn = useCallback(() => {
    scalePress.value = withTiming(0.88, {
      duration: 100,
      easing: Easing.out(Easing.quad),
    });
  }, [scalePress]);

  const handlePressOut = useCallback(() => {
    scalePress.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.quad),
    });
  }, [scalePress]);

  // Active gold, inactive muted
  const activeColor = palette.gold;
  const inactiveColor = isDark
    ? "rgba(245, 240, 232, 0.35)"
    : "rgba(42, 36, 32, 0.4)";

  // Icon animated style: scale + color
  const iconAnimStyle = useAnimatedStyle(() => {
    const scale = interpolate(progress.value, [0, 1], [1, 1.08]);
    return {
      transform: [{ scale: scale * scalePress.value }],
      opacity: interpolate(progress.value, [0, 1], [0.6, 1]),
    };
  });

  const iconColorStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
  }));

  // Label animated style
  const labelAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.4, 0.9]),
    color: interpolateColor(
      progress.value,
      [0, 1],
      [inactiveColor, activeColor],
    ),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.96, 1]) }],
  }));

  // Dot indicator
  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: progress.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tab, { width }]}
      hitSlop={{ top: 8, bottom: 8 }}
      android_ripple={null}
    >
      <Animated.View style={[styles.iconContainer, iconAnimStyle]}>
        <Animated.Text style={iconColorStyle}>
          <Ionicons
            name={isFocused ? meta.iconFocused : meta.icon}
            size={ICON_SIZE}
          />
        </Animated.Text>
      </Animated.View>

      <Animated.Text style={[styles.label, labelAnimStyle]} numberOfLines={1}>
        {meta.label}
      </Animated.Text>

      {/* Gold dot under active tab */}
      <Animated.View style={[styles.dot, dotStyle]} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// CustomTabBar
// ---------------------------------------------------------------------------

/**
 * Props injected by Expo Router's <Tabs tabBar={...} />.
 * We accept `any` to avoid the duplicate-@react-navigation/core type
 * mismatch that happens with Expo Router's hoisted dependency graph.
 * The runtime shape is BottomTabBarProps — we destructure what we need.
 */
interface TabBarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  descriptors: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  navigation: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  insets?: any;
}

export function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isDark } = useTheme();

  // Only show routes that have a TAB_META entry
  const visibleRoutes = useMemo(
    () =>
      (state.routes as Array<{ key: string; name: string }>).filter(
        (route) => route.name in TAB_META,
      ),
    [state.routes],
  );

  const tabWidth = width / visibleRoutes.length;

  // Find active index among visible routes
  const activeVisibleIndex = useMemo(() => {
    const activeRoute = state.routes[state.index];
    return visibleRoutes.findIndex(
      (r: { key: string }) => r.key === activeRoute?.key,
    );
  }, [state.index, state.routes, visibleRoutes]);

  const handleTabPress = useCallback(
    (routeName: string, routeKey: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const event = navigation.emit({
        type: "tabPress",
        target: routeKey,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  const handleTabLongPress = useCallback(
    (routeKey: string) => {
      navigation.emit({
        type: "tabLongPress",
        target: routeKey,
      });
    },
    [navigation],
  );

  // Bottom padding: safe area on iOS (notch), small fixed on Android
  const bottomPadding = Platform.select({
    ios: Math.max(insets.bottom, 0),
    android: 4,
    default: 0,
  });

  const bgColor = isDark ? "#0a0a0f" : "#FAF7F2";
  const borderColor = isDark
    ? "rgba(200, 144, 58, 0.12)"
    : "rgba(166, 120, 40, 0.12)";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderTopColor: borderColor,
          paddingBottom: bottomPadding,
        },
      ]}
    >
      <View style={styles.tabRow}>
        {visibleRoutes.map(
          (route: { key: string; name: string }, index: number) => (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={activeVisibleIndex === index}
              onPress={() => handleTabPress(route.name, route.key)}
              onLongPress={() => handleTabLongPress(route.key)}
              width={tabWidth}
              isDark={isDark}
            />
          ),
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tabRow: {
    flexDirection: "row",
    height: TAB_BAR_HEIGHT,
    alignItems: "center",
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    height: TAB_BAR_HEIGHT,
    gap: 3,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    height: 24,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize["2xs"],
    letterSpacing: 0.1,
    textAlign: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.gold,
    marginTop: 2,
  },
});
