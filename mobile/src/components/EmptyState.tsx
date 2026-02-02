import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui';
import { Spacing, Typography, Colors } from '../constants/theme';
import {
  EmptyHistoryIllustration,
  EmptyFavoritesIllustration,
  StartAnalysisIllustration,
} from './illustrations';

type IllustrationType = 'history' | 'favorites' | 'analysis' | 'none';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: IllustrationType;
  illustrationSize?: number;
}

const getIllustration = (type: IllustrationType, size: number, colors: any) => {
  switch (type) {
    case 'history':
      return <EmptyHistoryIllustration size={size} primaryColor={colors.accentPrimary} />;
    case 'favorites':
      return <EmptyFavoritesIllustration size={size} primaryColor={colors.accentError} />;
    case 'analysis':
      return <StartAnalysisIllustration size={size} primaryColor={colors.accentPrimary} />;
    default:
      return null;
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'file-tray-outline',
  title,
  description,
  actionLabel,
  onAction,
  illustration = 'none',
  illustrationSize = 180,
}) => {
  const { colors } = useTheme();
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(100, withSpring(1));
  }, []);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const illustrationComponent = getIllustration(illustration, illustrationSize, colors);

  return (
    <View style={styles.container}>
      <Animated.View style={containerAnimatedStyle}>
        {illustrationComponent ? (
          <Animated.View 
            entering={FadeIn.duration(400)}
            style={styles.illustrationContainer}
          >
            {illustrationComponent}
          </Animated.View>
        ) : (
          <Animated.View 
            entering={FadeInDown.duration(400).delay(100)}
            style={[styles.iconContainer, { backgroundColor: colors.bgElevated }]}
          >
            <Ionicons name={icon} size={48} color={colors.textTertiary} />
          </Animated.View>
        )}
      </Animated.View>

      <Animated.Text 
        entering={FadeInDown.duration(400).delay(200)}
        style={[styles.title, { color: colors.textPrimary }]}
      >
        {title}
      </Animated.Text>

      {description && (
        <Animated.Text 
          entering={FadeInDown.duration(400).delay(300)}
          style={[styles.description, { color: colors.textSecondary }]}
        >
          {description}
        </Animated.Text>
      )}

      {actionLabel && onAction && (
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Button
            title={actionLabel}
            onPress={onAction}
            style={styles.button}
          />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  illustrationContainer: {
    marginBottom: Spacing.lg,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  description: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.base * Typography.lineHeight.relaxed,
    marginBottom: Spacing.lg,
  },
  button: {
    marginTop: Spacing.md,
  },
});

export default EmptyState;
