import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { springs } from '@/theme/animations';
import { formatRelativeDate } from '@/utils/formatDate';
import type { AnalysisSummary } from '@/types';

const DELETE_THRESHOLD = -80;

interface AnalysisCardProps {
  summary: AnalysisSummary;
  isFavorite: boolean;
  onPress: () => void;
  onDelete: (id: string) => void;
}

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '';
  const min = Math.floor(seconds / 60);
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${m > 0 ? m.toString().padStart(2, '0') : ''}`;
  }
  return `${min}min`;
};

export const AnalysisCard: React.FC<AnalysisCardProps> = ({
  summary,
  isFavorite,
  onPress,
  onDelete,
}) => {
  const { colors } = useTheme();
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  const thumbnailUrl =
    summary.thumbnail ||
    `https://img.youtube.com/vi/${summary.videoId}/mqdefault.jpg`;

  const subtitle = [summary.channel, formatDuration(summary.duration)]
    .filter(Boolean)
    .join(' \u00B7 ');

  const confirmDelete = useCallback(() => {
    Alert.alert(
      "Supprimer l'analyse",
      'Cette action est irr\u00E9versible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => {
            translateX.value = withSpring(0, springs.gentle);
          },
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => onDelete(summary.id),
        },
      ],
    );
  }, [summary.id, onDelete, translateX]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-120, e.translationX));
    })
    .onEnd(() => {
      if (translateX.value < DELETE_THRESHOLD) {
        translateX.value = withSpring(DELETE_THRESHOLD, springs.gentle);
        runOnJS(confirmDelete)();
      } else {
        translateX.value = withSpring(0, springs.gentle);
      }
    });

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  const deleteAnimStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -20 ? 1 : 0,
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, springs.gentle);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, springs.gentle);
  }, [scale]);

  return (
    <View style={styles.swipeWrapper}>
      {/* Delete button behind the card */}
      <Animated.View
        style={[
          styles.deleteContainer,
          { backgroundColor: colors.accentError },
          deleteAnimStyle,
        ]}
      >
        <Pressable
          onPress={confirmDelete}
          style={styles.deleteButton}
          accessibilityLabel="Supprimer cette analyse"
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteText}>Supprimer</Text>
        </Pressable>
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.glassBg,
              borderColor: colors.glassBorder,
            },
            cardAnimStyle,
          ]}
        >
          <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.cardInner}
            accessibilityLabel={`Analyse : ${summary.title}`}
            accessibilityRole="button"
          >
            {/* Thumbnail */}
            <Image
              source={{ uri: thumbnailUrl }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={200}
            />

            {/* Text content */}
            <View style={styles.textContainer}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {summary.title}
              </Text>
              {subtitle ? (
                <Text
                  style={[styles.subtitle, { color: colors.textTertiary }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              ) : null}
              {summary.createdAt ? (
                <Text style={[styles.date, { color: colors.textMuted }]}>
                  {formatRelativeDate(summary.createdAt)}
                </Text>
              ) : null}
            </View>

            {/* Favorite indicator */}
            {isFavorite && (
              <View style={styles.favoriteIcon}>
                <Ionicons name="star" size={14} color={colors.accentWarning} />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  swipeWrapper: {
    marginBottom: sp.sm,
    overflow: 'hidden',
    borderRadius: borderRadius.lg,
  },
  deleteContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: sp.lg,
    borderRadius: borderRadius.lg,
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    color: '#fff',
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardInner: {
    flexDirection: 'row',
    padding: sp.md,
    alignItems: 'center',
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: borderRadius.sm,
    backgroundColor: '#1a1a25',
  },
  textContainer: {
    flex: 1,
    marginLeft: sp.md,
  },
  title: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.35,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  date: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  favoriteIcon: {
    position: 'absolute',
    top: sp.sm,
    right: sp.sm,
  },
});
