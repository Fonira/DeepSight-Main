/**
 * CollapsibleSection — Smooth animated expand/collapse
 *
 * Uses Reanimated 3 height animation (not LayoutAnimation).
 * Measures content height, then animates between 0 and measured height.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnUI,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface CollapsibleSectionProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const ANIM_CONFIG = {
  duration: 250,
  easing: Easing.bezier(0.4, 0, 0.2, 1),
};

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = true,
}) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [contentHeight, setContentHeight] = useState(0);
  const height = useSharedValue(defaultOpen ? 1 : 0);
  const rotation = useSharedValue(defaultOpen ? 1 : 0);

  const onLayout = useCallback(
    (e: { nativeEvent: { layout: { height: number } } }) => {
      const measured = e.nativeEvent.layout.height;
      if (measured > 0 && measured !== contentHeight) {
        setContentHeight(measured);
      }
    },
    [contentHeight],
  );

  const toggle = useCallback(() => {
    Haptics.selectionAsync();
    const next = !isOpen;
    setIsOpen(next);
    height.value = withTiming(next ? 1 : 0, ANIM_CONFIG);
    rotation.value = withTiming(next ? 1 : 0, ANIM_CONFIG);
  }, [isOpen, height, rotation]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    height: contentHeight > 0 ? height.value * contentHeight : undefined,
    opacity: height.value,
  }));

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${isOpen ? 'ouvert' : 'fermé'}`}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={colors.accentPrimary}
              style={styles.icon}
            />
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title}
          </Text>
        </View>
        <Animated.View style={animatedChevronStyle}>
          <Ionicons name="chevron-up" size={18} color={colors.textTertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.content, animatedContentStyle, { overflow: 'hidden' }]}>
        <View
          onLayout={contentHeight === 0 ? onLayout : undefined}
          style={styles.contentInner}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: sp.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sp.md,
    minHeight: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: sp.sm,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  content: {},
  contentInner: {
    paddingBottom: sp.md,
  },
});

export default CollapsibleSection;
