/**
 * FlashcardDeck - Mode Flashcards plein écran
 * Flip 3D Reanimated + Swipe GestureHandler + Haptics
 */

import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolation,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useStudy } from "../../hooks/useStudy";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { springs, duration } from "../../theme/animations";
import { MicroConfetti } from "./MicroConfetti";
import { FlashcardProgress } from "./FlashcardProgress";
import type { Flashcard } from "../../types/v2";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 100;

interface FlashcardDeckProps {
  summaryId: string;
  onClose: () => void;
}

export const FlashcardDeck: React.FC<FlashcardDeckProps> = ({
  summaryId,
  onClose,
}) => {
  const { colors } = useTheme();
  const { generateFlashcards, saveProgress } = useStudy(summaryId);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [known, setKnown] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Animation values
  const flipY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const entryY = useSharedValue(30);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await generateFlashcards();
      if (mounted) {
        setCards(result);
        setLoading(false);
        entryY.value = withSpring(0, springs.bouncy);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [generateFlashcards, entryY]);

  const advanceCard = useCallback(
    (isKnown: boolean) => {
      if (isKnown) {
        setKnown((prev) => prev + 1);
        setShowConfetti(true);
      }
      setIsFlipped(false);
      flipY.value = 0;

      if (index + 1 >= cards.length) {
        const finalKnown = isKnown ? known + 1 : known;
        saveProgress({
          flashcardsCompleted: finalKnown,
          flashcardsTotal: cards.length,
        });
        setFinished(true);
      } else {
        setIndex((prev) => prev + 1);
        setShowConfetti(false);
        entryY.value = 30;
        entryY.value = withSpring(0, springs.bouncy);
      }
    },
    [index, cards.length, known, saveProgress, flipY, entryY],
  );

  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const target = isFlipped ? 0 : 180;
    flipY.value = withSpring(target, springs.gentle);
    setIsFlipped(!isFlipped);
  }, [isFlipped, flipY]);

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          SCREEN_WIDTH,
          { duration: duration.base },
          () => {
            runOnJS(Haptics.notificationAsync)(
              Haptics.NotificationFeedbackType.Success,
            );
            translateX.value = 0;
            cardOpacity.value = 1;
            runOnJS(advanceCard)(true);
          },
        );
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(
          -SCREEN_WIDTH,
          { duration: duration.base },
          () => {
            runOnJS(Haptics.notificationAsync)(
              Haptics.NotificationFeedbackType.Error,
            );
            translateX.value = 0;
            cardOpacity.value = 1;
            runOnJS(advanceCard)(false);
          },
        );
      } else {
        translateX.value = withSpring(0, springs.gentle);
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(handleFlip)();
  });

  const composed = Gesture.Race(panGesture, tapGesture);

  // Animated styles
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    // Scale down slightly at midpoint of flip for depth illusion
    const flipScale = interpolate(
      flipY.value,
      [0, 90, 180],
      [1, 0.92, 1],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: entryY.value },
        { rotateZ: `${rotate}deg` },
        { scale: flipScale },
      ],
    };
  });

  const frontStyle = useAnimatedStyle(() => {
    const shadowDepth = interpolate(
      flipY.value,
      [0, 90],
      [8, 24],
      Extrapolation.CLAMP,
    );
    const shadowX = interpolate(
      flipY.value,
      [0, 90],
      [0, 8],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ perspective: 1200 }, { rotateY: `${flipY.value}deg` }],
      opacity: interpolate(flipY.value, [0, 89, 90, 180], [1, 1, 0, 0]),
      backfaceVisibility: "hidden" as const,
      shadowOffset: { width: shadowX, height: shadowDepth },
      shadowOpacity: interpolate(
        flipY.value,
        [0, 45, 90],
        [0.15, 0.25, 0.35],
        Extrapolation.CLAMP,
      ),
      shadowRadius: shadowDepth * 1.2,
      elevation: shadowDepth,
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const shadowDepth = interpolate(
      flipY.value,
      [90, 180],
      [24, 8],
      Extrapolation.CLAMP,
    );
    const shadowX = interpolate(
      flipY.value,
      [90, 180],
      [-8, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: `${flipY.value - 180}deg` },
      ],
      opacity: interpolate(flipY.value, [0, 89, 90, 180], [0, 0, 1, 1]),
      backfaceVisibility: "hidden" as const,
      shadowOffset: { width: shadowX, height: shadowDepth },
      shadowOpacity: interpolate(
        flipY.value,
        [90, 135, 180],
        [0.35, 0.25, 0.15],
        Extrapolation.CLAMP,
      ),
      shadowRadius: shadowDepth * 1.2,
      elevation: shadowDepth,
    };
  });

  // Restart
  const handleRestart = useCallback(() => {
    setIndex(0);
    setKnown(0);
    setFinished(false);
    setIsFlipped(false);
    flipY.value = 0;
    entryY.value = 30;
    entryY.value = withSpring(0, springs.bouncy);
  }, [flipY, entryY]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <CloseButton onClose={onClose} />
        <View style={styles.center}>
          <Ionicons name="albums-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Génération des flashcards...
          </Text>
        </View>
      </View>
    );
  }

  if (cards.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <CloseButton onClose={onClose} />
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Aucune flashcard disponible
          </Text>
        </View>
      </View>
    );
  }

  if (finished) {
    const pct = cards.length > 0 ? Math.round((known / cards.length) * 100) : 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <CloseButton onClose={onClose} />
        <View style={styles.center}>
          <Ionicons
            name={pct >= 60 ? "trophy" : "school"}
            size={64}
            color={pct >= 60 ? colors.accentWarning : colors.accentPrimary}
          />
          <Text style={[styles.finishTitle, { color: colors.textPrimary }]}>
            Terminé !
          </Text>
          <Text style={[styles.finishScore, { color: colors.accentPrimary }]}>
            {known}/{cards.length}
          </Text>
          <Text style={[styles.finishPct, { color: colors.textSecondary }]}>
            {pct}% maîtrisé
          </Text>
          <View style={styles.finishActions}>
            <Pressable
              style={[
                styles.finishBtn,
                { backgroundColor: colors.accentPrimary },
              ]}
              onPress={handleRestart}
            >
              <Text style={styles.finishBtnText}>Recommencer</Text>
            </Pressable>
            <Pressable
              style={[styles.finishBtn, { backgroundColor: colors.bgElevated }]}
              onPress={onClose}
            >
              <Text
                style={[styles.finishBtnText, { color: colors.textPrimary }]}
              >
                Fermer
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  const currentCard = cards[index];

  return (
    <GestureHandlerRootView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityLabel="Fermer"
        >
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </Pressable>
        <FlashcardProgress
          progress={(index + 1) / cards.length}
          size={52}
          strokeWidth={4}
          label={`${index + 1}/${cards.length}`}
        />
        <View style={{ width: 28 }} />
      </View>

      {/* Swipe hints */}
      <View style={styles.hints}>
        <Text style={[styles.hintText, { color: colors.accentError }]}>
          ← À revoir
        </Text>
        <Text style={[styles.hintText, { color: colors.accentSuccess }]}>
          Maîtrisé →
        </Text>
      </View>

      {/* Confetti burst on correct answer */}
      <MicroConfetti
        trigger={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />

      {/* Card */}
      <View style={styles.cardArea}>
        <GestureDetector gesture={composed}>
          <Animated.View style={[styles.cardWrapper, cardStyle]}>
            {/* Front */}
            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgElevated,
                  borderColor: colors.border,
                },
                frontStyle,
              ]}
            >
              <Text style={[styles.cardLabel, { color: colors.accentPrimary }]}>
                QUESTION
              </Text>
              <Text style={[styles.cardText, { color: colors.textPrimary }]}>
                {currentCard.front}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textMuted }]}>
                Tapez pour retourner
              </Text>
            </Animated.View>

            {/* Back */}
            <Animated.View
              style={[
                styles.card,
                styles.cardBack,
                {
                  backgroundColor: colors.bgElevated,
                  borderColor: colors.accentSecondary,
                },
                backStyle,
              ]}
            >
              <Text style={[styles.cardLabel, { color: colors.accentSuccess }]}>
                RÉPONSE
              </Text>
              <Text style={[styles.cardText, { color: colors.textPrimary }]}>
                {currentCard.back}
              </Text>
              <Text style={[styles.tapHint, { color: colors.textMuted }]}>
                Glissez pour continuer
              </Text>
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
};

const CloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={28} color={colors.textPrimary} />
      </Pressable>
      <View style={{ flex: 1 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sp["4xl"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  progress: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  hints: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: sp["3xl"],
    marginTop: sp.lg,
  },
  hintText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: sp.xl,
  },
  cardWrapper: {
    width: SCREEN_WIDTH - sp.xl * 4,
    aspectRatio: 0.65,
  },
  card: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    padding: sp["3xl"],
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
  },
  cardBack: {
    position: "absolute",
  },
  cardLabel: {
    position: "absolute",
    top: sp.lg,
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    letterSpacing: 1,
  },
  cardText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    textAlign: "center",
    lineHeight: fontSize.lg * 1.5,
  },
  tapHint: {
    position: "absolute",
    bottom: sp.lg,
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp.md,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  finishTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xl"],
    marginTop: sp.lg,
  },
  finishScore: {
    fontFamily: fontFamily.display,
    fontSize: fontSize["4xl"],
  },
  finishPct: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
  },
  finishActions: {
    gap: sp.md,
    marginTop: sp["3xl"],
    width: "80%",
  },
  finishBtn: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  finishBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: "#ffffff",
  },
});

export default FlashcardDeck;
