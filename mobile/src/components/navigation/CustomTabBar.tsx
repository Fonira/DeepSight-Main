/**
 * CustomTabBar - Premium animated tab bar
 * Features: animated indicator, spring animations, haptic feedback, blur background
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { springs } from '../../theme/animations';

interface TabConfig {
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  Dashboard: { icon: 'home-outline', iconFocused: 'home', label: 'Accueil' },
  History: { icon: 'time-outline', iconFocused: 'time', label: 'Historique' },
  Upgrade: { icon: 'diamond-outline', iconFocused: 'diamond', label: 'Plans' },
  Profile: { icon: 'person-outline', iconFocused: 'person', label: 'Profil' },
};

const AnimatedIcon: React.FC<{
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  color: string;
}> = ({ focused, icon, iconFocused, color }) => {
  const scale = useSharedValue(focused ? 1 : 0.9);

  useEffect(() => {
    scale.value = withSpring(focused ? 1.05 : 0.9, springs.scale);
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Ionicons name={focused ? iconFocused : icon} size={20} color={color} />
    </Animated.View>
  );
};

export const CustomTabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  // Animated indicator position
  const tabWidth = useSharedValue(0);
  const indicatorX = useSharedValue(0);
  const tabCount = state.routes.length;

  useEffect(() => {
    if (tabWidth.value > 0) {
      indicatorX.value = withSpring(
        state.index * (tabWidth.value / tabCount),
        springs.slide,
      );
    }
  }, [state.index, tabWidth, tabCount, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: tabWidth.value / tabCount,
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    tabWidth.value = event.nativeEvent.layout.width;
    indicatorX.value = state.index * (event.nativeEvent.layout.width / tabCount);
  };

  const bottomPadding = insets.bottom > 0 ? insets.bottom : sp.sm;

  const tabBarContent = (
    <View
      style={[
        styles.container,
        {
          paddingBottom: bottomPadding,
          borderTopColor: colors.border,
        },
      ]}
      onLayout={handleLayout}
    >
      {/* Animated indicator */}
      <Animated.View
        style={[
          styles.indicator,
          indicatorStyle,
          { backgroundColor: colors.accentPrimary },
        ]}
      />

      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const config = TAB_CONFIG[route.name] || {
          icon: 'help-outline' as const,
          iconFocused: 'help' as const,
          label: route.name,
        };

        return (
          <Pressable
            key={route.key}
            onPress={() => {
              Haptics.selectionAsync();
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            }}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={config.label}
          >
            <AnimatedIcon
              focused={isFocused}
              icon={config.icon}
              iconFocused={config.iconFocused}
              color={isFocused ? colors.accentPrimary : colors.textMuted}
            />
            <Text
              style={[
                styles.label,
                {
                  color: isFocused ? colors.accentPrimary : colors.textMuted,
                  fontFamily: isFocused ? fontFamily.bodySemiBold : fontFamily.body,
                },
              ]}
              numberOfLines={1}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // iOS gets blur background
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.wrapper}>
        <BlurView
          intensity={isDark ? 50 : 80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(10,10,15,0.7)' : 'rgba(255,255,255,0.8)' }]} />
        {tabBarContent}
      </View>
    );
  }

  // Android gets solid background
  return (
    <View style={[styles.wrapper, { backgroundColor: isDark ? colors.bgSecondary : colors.bgPrimary }]}>
      {tabBarContent}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    paddingTop: sp.sm,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp.sm,
    gap: 2,
  },
  label: {
    fontSize: fontSize['2xs'],
    textAlign: 'center',
  },
});

export default CustomTabBar;
