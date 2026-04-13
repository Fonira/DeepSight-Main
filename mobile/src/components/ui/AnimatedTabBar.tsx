import React, { useCallback, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

export interface TabItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface AnimatedTabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
  style?: object;
}

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TabButton: React.FC<{
  tab: TabItem;
  index: number;
  isActive: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent, index: number) => void;
}> = ({ tab, index, isActive, onPress, onLayout }) => {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <AnimatedPressable
      style={[styles.tab, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLayout={(e) => onLayout(e, index)}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Ionicons
        name={tab.icon}
        size={20}
        color={isActive ? colors.accentPrimary : colors.textTertiary}
      />
      <Text
        style={[
          styles.tabLabel,
          {
            color: isActive ? colors.accentPrimary : colors.textTertiary,
            fontFamily: isActive ? fontFamily.bodySemiBold : fontFamily.body,
          },
        ]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </AnimatedPressable>
  );
};

export const AnimatedTabBar: React.FC<AnimatedTabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
  style,
}) => {
  const { colors } = useTheme();
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Store tab layouts
  const tabLayouts = React.useRef<{ x: number; width: number }[]>([]);

  const handleTabLayout = useCallback(
    (e: LayoutChangeEvent, index: number) => {
      const { x, width } = e.nativeEvent.layout;
      tabLayouts.current[index] = { x, width };

      // If this is the active tab, position the indicator
      const activeIndex = tabs.findIndex((t) => t.id === activeTab);
      if (index === activeIndex) {
        indicatorX.value = x;
        indicatorWidth.value = width;
      }
    },
    [activeTab, tabs, indicatorX, indicatorWidth],
  );

  // Animate indicator when active tab changes
  useEffect(() => {
    const activeIndex = tabs.findIndex((t) => t.id === activeTab);
    const layout = tabLayouts.current[activeIndex];
    if (layout) {
      indicatorX.value = withSpring(layout.x, SPRING_CONFIG);
      indicatorWidth.value = withSpring(layout.width, SPRING_CONFIG);
    }
  }, [activeTab, tabs, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const handleTabPress = useCallback(
    (tabId: string) => {
      Haptics.selectionAsync();
      onTabPress(tabId);
    },
    [onTabPress],
  );

  return (
    <View
      style={[styles.container, { borderBottomColor: colors.border }, style]}
    >
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.id}
          tab={tab}
          index={index}
          isActive={activeTab === tab.id}
          onPress={() => handleTabPress(tab.id)}
          onLayout={handleTabLayout}
        />
      ))}
      {/* Animated sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: colors.accentPrimary },
          indicatorStyle,
        ]}
      />
      {/* Glow effect under indicator */}
      <Animated.View
        style={[
          styles.indicatorGlow,
          { backgroundColor: colors.accentPrimary },
          indicatorStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderBottomWidth: 1,
    position: "relative",
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: sp.md,
    gap: sp.xs,
  },
  tabLabel: {
    fontSize: fontSize.sm,
  },
  indicator: {
    position: "absolute",
    bottom: -1,
    height: 2.5,
    borderRadius: 2,
  },
  indicatorGlow: {
    position: "absolute",
    bottom: -1,
    height: 4,
    borderRadius: 4,
    opacity: 0.3,
  },
});

export default AnimatedTabBar;
