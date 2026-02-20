import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useCredits } from '@/hooks/useCredits';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

export const CreditBar: React.FC = () => {
  const { colors } = useTheme();
  const { used, total, percent, isCritical } = useCredits();
  const [trackWidth, setTrackWidth] = useState(0);

  const remainingPercent = Math.max(100 - percent, 0);

  const barColor =
    remainingPercent > 50
      ? palette.green
      : remainingPercent > 20
      ? palette.amber
      : palette.red;

  const widthAnim = useSharedValue(0);

  useEffect(() => {
    if (trackWidth > 0) {
      widthAnim.value = withTiming(
        (remainingPercent / 100) * trackWidth,
        { duration: 800 },
      );
    }
  }, [remainingPercent, trackWidth, widthAnim]);

  const barAnimStyle = useAnimatedStyle(() => ({
    width: widthAnim.value,
  }));

  const handlePress = useCallback(() => {
    if (isCritical) {
      router.push('/(tabs)/profile');
    }
  }, [isCritical]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isCritical}
      style={styles.container}
      accessibilityLabel={`${used} crédits utilisés sur ${total}`}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {used}/{total} crédits
        </Text>
        {isCritical && (
          <Text style={[styles.warning, { color: palette.red }]}>
            Presque épuisé
          </Text>
        )}
      </View>
      <View
        style={[styles.track, { backgroundColor: colors.bgTertiary }]}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[styles.bar, { backgroundColor: barColor }, barAnimStyle]}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: sp.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp.xs,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  warning: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
  track: {
    height: 6,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  bar: {
    height: 6,
    borderRadius: borderRadius.full,
  },
});

export default CreditBar;
