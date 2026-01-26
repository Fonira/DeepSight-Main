/**
 * FlashcardsComponent - Cartes flash interactives avec animation flip 3D
 * Support des gestes swipe et progression
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

interface Flashcard {
  front: string;
  back: string;
}

interface FlashcardsComponentProps {
  flashcards: Flashcard[];
  onComplete?: () => void;
  onProgress?: (current: number, total: number) => void;
  isLoading?: boolean;
}

export const FlashcardsComponent: React.FC<FlashcardsComponentProps> = ({
  flashcards,
  onComplete,
  onProgress,
  isLoading = false,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set());

  // Animation values
  const flipAnim = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // Flip animation interpolation
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [1, 0],
  });

  const backOpacity = flipAnim.interpolate({
    inputRange: [89, 90],
    outputRange: [0, 1],
  });

  // Reset flip when card changes
  useEffect(() => {
    if (isFlipped) {
      setIsFlipped(false);
      flipAnim.setValue(0);
    }
  }, [currentIndex]);

  // Report progress
  useEffect(() => {
    onProgress?.(currentIndex + 1, flashcards.length);
  }, [currentIndex, flashcards.length, onProgress]);

  // Flip card animation
  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    Animated.spring(flipAnim, {
      toValue: isFlipped ? 0 : 180,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();

    setIsFlipped(!isFlipped);
  }, [isFlipped, flipAnim]);

  // Navigate to next card
  const goToNext = useCallback((markAs?: 'known' | 'unknown') => {
    if (markAs === 'known') {
      setKnownCards(prev => new Set(prev).add(currentIndex));
      setUnknownCards(prev => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    } else if (markAs === 'unknown') {
      setUnknownCards(prev => new Set(prev).add(currentIndex));
      setKnownCards(prev => {
        const next = new Set(prev);
        next.delete(currentIndex);
        return next;
      });
    }

    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Completed all cards
      onComplete?.();
    }
  }, [currentIndex, flashcards.length, onComplete]);

  // Navigate to previous card
  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // Shuffle cards
  const handleShuffle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentIndex(0);
    setKnownCards(new Set());
    setUnknownCards(new Set());
    setIsFlipped(false);
    flipAnim.setValue(0);
  }, [flipAnim]);

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
      },
      onPanResponderGrant: () => {
        Animated.spring(cardScale, {
          toValue: 0.95,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        panX.setValue(gestureState.dx);
        panY.setValue(gestureState.dy * 0.3);
      },
      onPanResponderRelease: (_, gestureState) => {
        Animated.spring(cardScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();

        if (gestureState.dx > SWIPE_THRESHOLD) {
          // Swipe right - mark as known
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.timing(panX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            panX.setValue(0);
            panY.setValue(0);
            goToNext('known');
          });
        } else if (gestureState.dx < -SWIPE_THRESHOLD) {
          // Swipe left - mark as unknown
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.timing(panX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            panX.setValue(0);
            panY.setValue(0);
            goToNext('unknown');
          });
        } else if (Math.abs(gestureState.dy) < 10 && Math.abs(gestureState.dx) < 10) {
          // Tap - flip card
          handleFlip();
        }

        // Reset position
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        Animated.spring(panY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bgElevated }]}>
        <Ionicons name="albums-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {language === 'fr' ? 'Génération des flashcards...' : 'Generating flashcards...'}
        </Text>
      </View>
    );
  }

  if (flashcards.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgElevated }]}>
        <Ionicons name="albums-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {language === 'fr' ? 'Aucune flashcard disponible' : 'No flashcards available'}
        </Text>
      </View>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  const cardRotation = panX.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  return (
    <View style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.accentPrimary, width: `${progress}%` },
            ]}
          />
        </View>
        <View style={styles.progressStats}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {currentIndex + 1} / {flashcards.length}
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statBadge, { backgroundColor: `${colors.accentSuccess}20` }]}>
              <Ionicons name="checkmark" size={12} color={colors.accentSuccess} />
              <Text style={[styles.statText, { color: colors.accentSuccess }]}>
                {knownCards.size}
              </Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: `${colors.accentError}20` }]}>
              <Ionicons name="close" size={12} color={colors.accentError} />
              <Text style={[styles.statText, { color: colors.accentError }]}>
                {unknownCards.size}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Swipe hints */}
      <View style={styles.swipeHints}>
        <View style={styles.swipeHint}>
          <Ionicons name="arrow-back" size={16} color={colors.accentError} />
          <Text style={[styles.swipeHintText, { color: colors.accentError }]}>
            {language === 'fr' ? 'À revoir' : 'Review'}
          </Text>
        </View>
        <View style={styles.swipeHint}>
          <Text style={[styles.swipeHintText, { color: colors.accentSuccess }]}>
            {language === 'fr' ? 'Maîtrisé' : 'Known'}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentSuccess} />
        </View>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={[
            styles.cardWrapper,
            {
              transform: [
                { translateX: panX },
                { translateY: panY },
                { rotate: cardRotation },
                { scale: cardScale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Front of card */}
          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
                transform: [{ rotateY: frontInterpolate }],
                opacity: frontOpacity,
              },
            ]}
          >
            <View style={[styles.cardLabel, { backgroundColor: `${colors.accentPrimary}20` }]}>
              <Text style={[styles.cardLabelText, { color: colors.accentPrimary }]}>
                {language === 'fr' ? 'QUESTION' : 'QUESTION'}
              </Text>
            </View>
            <Text style={[styles.cardContent, { color: colors.textPrimary }]}>
              {currentCard.front}
            </Text>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              {language === 'fr' ? 'Tapez pour voir la réponse' : 'Tap to see answer'}
            </Text>
          </Animated.View>

          {/* Back of card */}
          <Animated.View
            style={[
              styles.card,
              styles.cardBack,
              {
                backgroundColor: colors.bgElevated,
                borderColor: colors.accentSuccess,
                transform: [{ rotateY: backInterpolate }],
                opacity: backOpacity,
              },
            ]}
          >
            <View style={[styles.cardLabel, { backgroundColor: `${colors.accentSuccess}20` }]}>
              <Text style={[styles.cardLabelText, { color: colors.accentSuccess }]}>
                {language === 'fr' ? 'RÉPONSE' : 'ANSWER'}
              </Text>
            </View>
            <Text style={[styles.cardContent, { color: colors.textPrimary }]}>
              {currentCard.back}
            </Text>
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>
              {language === 'fr' ? 'Glissez gauche ou droite' : 'Swipe left or right'}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Navigation buttons */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.bgElevated }]}
          onPress={goToPrevious}
          disabled={currentIndex === 0}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={currentIndex === 0 ? colors.textMuted : colors.textPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: `${colors.accentError}20` }]}
          onPress={() => goToNext('unknown')}
        >
          <Ionicons name="close" size={24} color={colors.accentError} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shuffleButton, { backgroundColor: colors.bgElevated }]}
          onPress={handleShuffle}
        >
          <Ionicons name="shuffle" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: `${colors.accentSuccess}20` }]}
          onPress={() => goToNext('known')}
        >
          <Ionicons name="checkmark" size={24} color={colors.accentSuccess} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: colors.bgElevated }]}
          onPress={() => goToNext()}
          disabled={currentIndex === flashcards.length - 1}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={currentIndex === flashcards.length - 1 ? colors.textMuted : colors.textPrimary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  statText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  swipeHints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  swipeHintText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    width: SCREEN_WIDTH - Spacing.xl * 2,
    aspectRatio: 0.7,
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardBack: {
    position: 'absolute',
  },
  cardLabel: {
    position: 'absolute',
    top: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
  },
  cardLabelText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cardContent: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    lineHeight: Typography.fontSize.lg * 1.5,
  },
  tapHint: {
    position: 'absolute',
    bottom: Spacing.lg,
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FlashcardsComponent;
