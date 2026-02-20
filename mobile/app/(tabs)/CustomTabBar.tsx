import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { darkColors, palette } from '@/theme/colors';
import { sp } from '@/theme/spacing';

interface TabBarIconProps {
  name: keyof typeof Ionicons.glyphMap;
  isFocused: boolean;
  color: string;
}

function TabBarIcon({ name, isFocused, color }: TabBarIconProps) {
  return (
    <Ionicons
      name={name}
      size={24}
      color={color}
      style={{ opacity: isFocused ? 1 : 0.6 }}
    />
  );
}

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export function CustomTabBar({
  state,
  descriptors,
  navigation,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const tabWidth = width / state.routes.length;
  const indicatorPosition = useSharedValue(state.index * tabWidth);

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
  }));

  const handleTabPress = (index: number, routeName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const event = navigation.emit({
      type: 'tabPress',
      target: routeName,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }

    indicatorPosition.value = withSpring(index * tabWidth, {
      damping: 12,
      mass: 1,
      overshootClamping: false,
    });
  };

  const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
    index: 'home',
    library: 'book',
    study: 'school',
    profile: 'person',
  };

  return (
    <View
      style={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom, sp.sm) },
      ]}
    >
      <BlurView intensity={85} style={styles.blurContainer}>
        <View style={styles.tabBarContent}>
          {/* Animated Indicator Background */}
          <Animated.View
            style={[
              styles.indicator,
              { width: tabWidth },
              indicatorAnimatedStyle,
            ]}
          >
            <View style={styles.indicatorInner} />
          </Animated.View>

          {/* Tab Items */}
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const iconName = tabIcons[route.name] || 'home';

            return (
              <TouchableOpacity
                key={route.key}
                activeOpacity={1}
                style={[styles.tab, { width: tabWidth }]}
                onPress={() => handleTabPress(index, route.name)}
              >
                <TabBarIcon
                  name={iconName}
                  isFocused={isFocused}
                  color={
                    isFocused
                      ? palette.indigo
                      : 'rgba(255, 255, 255, 0.4)'
                  }
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: darkColors.border,
  },
  blurContainer: {
    overflow: 'hidden',
    backgroundColor: 'rgba(12, 12, 26, 0.85)',
  },
  tabBarContent: {
    flexDirection: 'row',
    position: 'relative',
    height: 60,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    backgroundColor: palette.indigo,
  },
  indicatorInner: {
    flex: 1,
    backgroundColor: palette.indigo,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
