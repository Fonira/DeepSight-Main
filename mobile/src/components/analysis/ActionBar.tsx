import React, { useCallback } from 'react';
import { View, Pressable, Text, Share, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { springs } from '../../theme/animations';
import { historyApi } from '../../services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ActionBarProps {
  summaryId: string;
  title: string;
  videoId: string;
  isFavorite: boolean;
  onFavoriteChange: (isFavorite: boolean) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  summaryId,
  title,
  videoId,
  isFavorite,
  onFavoriteChange,
}) => {
  const { colors } = useTheme();
  const router = useRouter();

  const favScale = useSharedValue(1);
  const shareScale = useSharedValue(1);
  const studyScale = useSharedValue(1);

  const favAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favScale.value }],
  }));
  const shareAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shareScale.value }],
  }));
  const studyAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: studyScale.value }],
  }));

  const handleFavorite = useCallback(async () => {
    favScale.value = withSpring(0.85, springs.button);
    setTimeout(() => {
      favScale.value = withSpring(1, springs.button);
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await historyApi.toggleFavorite(summaryId);
      onFavoriteChange(result.isFavorite);
    } catch {
      // Silent fail
    }
  }, [summaryId, onFavoriteChange, favScale]);

  const handleShare = useCallback(async () => {
    shareScale.value = withSpring(0.85, springs.button);
    setTimeout(() => {
      shareScale.value = withSpring(1, springs.button);
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        title,
        message: `${title}\nhttps://www.youtube.com/watch?v=${videoId}`,
      });
    } catch {
      // User cancelled
    }
  }, [title, videoId, shareScale]);

  const handleStudy = useCallback(() => {
    studyScale.value = withSpring(0.85, springs.button);
    setTimeout(() => {
      studyScale.value = withSpring(1, springs.button);
    }, 100);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(tabs)/study');
  }, [router, studyScale]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.glassBg,
          borderColor: colors.glassBorder,
        },
      ]}
    >
      <AnimatedPressable
        onPress={handleFavorite}
        style={[styles.actionButton, favAnimStyle]}
        accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        accessibilityRole="button"
      >
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={22}
          color={isFavorite ? '#f59e0b' : colors.textSecondary}
        />
        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
          Favori
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={handleShare}
        style={[styles.actionButton, shareAnimStyle]}
        accessibilityLabel="Partager l'analyse"
        accessibilityRole="button"
      >
        <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
          Partager
        </Text>
      </AnimatedPressable>

      <AnimatedPressable
        onPress={handleStudy}
        style={[styles.actionButton, studyAnimStyle]}
        accessibilityLabel="Outils d'étude"
        accessibilityRole="button"
      >
        <Ionicons name="book-outline" size={22} color={colors.textSecondary} />
        <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>
          Étudier
        </Text>
      </AnimatedPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: sp.md,
    marginHorizontal: sp.lg,
    marginBottom: sp.sm,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: sp.lg,
    paddingVertical: sp.xs,
  },
  actionLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
});

export default ActionBar;
