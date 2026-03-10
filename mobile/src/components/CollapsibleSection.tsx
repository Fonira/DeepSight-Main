/**
 * CollapsibleSection — Smooth animated expand/collapse
 *
 * Uses Reanimated 3 height animation with spring physics (not LayoutAnimation).
 * Measures content height, then animates between 0 and measured height.
 * Chevron rotates smoothly on toggle.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

interface CollapsibleSectionProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/** Spring config: snappy but smooth, slight bounce */
const SPRING_CONFIG = {
  damping: 18,
  stiffness: 160,
  mass: 0.8,
  overshootClamping: false,
};

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  children,
  defaultOpen = true,
}) => {
  const { colors } = useTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const progress = useSharedValue(defaultOpen ? 1 : 0);

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
    const next = progress.value < 0.5 ? 1 : 0;
    progress.value = withSpring(next, SPRING_CONFIG);
  }, [progress]);

  const animatedContentStyle = useAnimatedStyle(() => {
    if (contentHeight === 0) {
      return { opacity: progress.value };
    }
    return {
      height: interpolate(progress.value, [0, 1], [0, contentHeight]),
      opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 1]),
      overflow: 'hidden' as const,
    };
  });

  const animatedChevronStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` },
    ],
  }));

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          pressed && { opacity: 0.7 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${progress.value > 0.5 ? 'ouvert' : 'fermé'}`}
        accessibilityHint="Appuyez pour ouvrir ou fermer la section"
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
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        </View>
        <Animated.View style={[styles.chevronWrapper, animatedChevronStyle]}>
          <Ionicons name="chevron-up" size={18} color={colors.textTertiary} />
        </Animated.View>
      </Pressable>

      <Animated.View style={animatedContentStyle}>
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
    marginRight: sp.sm,
  },
  icon: {
    marginRight: sp.sm,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    flexShrink: 1,
  },
  chevronWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  contentInner: {
    paddingBottom: sp.md,
  },
});

export default CollapsibleSection;
