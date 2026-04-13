/**
 * MultiAnswerQuiz - Mode Quiz plein écran avec support multi-réponses
 *
 * Différences vs QuizGame :
 * - Checkbox multi-sélection quand correctIndices.length > 1
 * - Bouton "Valider" pour les questions multi-réponses (pas d'auto-avance)
 * - Auto-avance conservée pour les questions à réponse unique
 * - Scoring partiel : max(0, hits - misses) / correctCount
 * - Badge "X bonnes réponses" sur les questions multi-réponses
 * - Rétro-compatible avec l'ancien format QuizQuestionV2 (correctIndex seul)
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useStudy } from "../../hooks/useStudy";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { springs, duration } from "../../theme/animations";
import type { QuizQuestionV2 } from "../../types/v2";

// ─── Props ────────────────────────────────────────────────────────────────────

interface MultiAnswerQuizProps {
  summaryId: string;
  onClose: () => void;
}

// ─── Internal Types ───────────────────────────────────────────────────────────

interface AnswerRecord {
  questionIndex: number;
  /** Selected indices (1 for single, multiple for multi) */
  selectedIndices: number[];
  /** Partial score for this question [0..1] */
  partialScore: number;
  /** Whether all correct answers were found and no wrong selected */
  perfect: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve correctIndices from question — backward-compatible */
function getCorrectIndices(q: QuizQuestionV2): number[] {
  if (q.correctIndices && q.correctIndices.length > 0) return q.correctIndices;
  return [q.correctIndex];
}

/**
 * Partial scoring:
 * - Hits: selected indices that are correct
 * - Misses: selected indices that are wrong
 * - Score = max(0, hits - misses) / totalCorrect  → range [0..1]
 */
function computeScore(selected: number[], correct: number[]): number {
  if (selected.length === 0) return 0;
  const correctSet = new Set(correct);
  const hits = selected.filter((i) => correctSet.has(i)).length;
  const misses = selected.filter((i) => !correctSet.has(i)).length;
  return Math.max(0, (hits - misses) / correct.length);
}

const ADVANCE_DELAY_SINGLE = 1800; // ms auto-advance pour réponse unique
const ADVANCE_DELAY_MULTI = 2500; // ms auto-advance après validation multi

// ─── Component ────────────────────────────────────────────────────────────────

export const MultiAnswerQuiz: React.FC<MultiAnswerQuizProps> = ({
  summaryId,
  onClose,
}) => {
  const { colors } = useTheme();
  const { generateQuiz, saveProgress } = useStudy(summaryId);

  const [questions, setQuestions] = useState<QuizQuestionV2[]>([]);
  const [index, setIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(),
  );
  const [confirmed, setConfirmed] = useState(false); // true after user validated
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const shake = useSharedValue(0);
  const scoreScale = useSharedValue(1);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await generateQuiz();
      if (mounted) {
        setQuestions(result);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, [generateQuiz]);

  // Derived
  const current = questions[index] ?? null;
  const correctIndices = current ? getCorrectIndices(current) : [];
  const isMultiAnswer = correctIndices.length > 1;

  // Total score = sum of partialScores
  const totalScore = answers.reduce((acc, a) => acc + a.partialScore, 0);
  const displayScore = `${totalScore.toFixed(1)} / ${index + (confirmed ? 1 : 0)}`;

  // ─── Commit answer (called after selection for single, or Valider for multi) ─

  const commitAnswer = useCallback(
    (selected: number[]) => {
      if (!current) {
        if (__DEV__)
          console.warn(
            "[Quiz] commitAnswer called with null question — skipping",
          );
        return;
      }
      const correct = getCorrectIndices(current);
      const partialScore = computeScore(selected, correct);
      const perfect = partialScore === 1;

      if (perfect) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        scoreScale.value = withSequence(
          withTiming(1.3, { duration: duration.fast }),
          withSpring(1, springs.gentle),
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        shake.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(0, { duration: 50 }),
        );
      }

      setConfirmed(true);
      const record: AnswerRecord = {
        questionIndex: index,
        selectedIndices: selected,
        partialScore,
        perfect,
      };
      setAnswers((prev) => [...prev, record]);

      const delay = isMultiAnswer ? ADVANCE_DELAY_MULTI : ADVANCE_DELAY_SINGLE;
      advanceTimer.current = setTimeout(() => {
        if (index + 1 >= questions.length) {
          const finalTotal = answers.length + 1;
          const finalScore =
            answers.reduce((a, b) => a + b.partialScore, 0) + partialScore;
          saveProgress({
            quizScore: Math.round(finalScore),
            quizTotal: finalTotal,
          });
          setFinished(true);
        } else {
          setIndex((prev) => prev + 1);
          setSelectedIndices(new Set());
          setConfirmed(false);
        }
      }, delay);
    },
    [
      current,
      index,
      questions.length,
      answers,
      isMultiAnswer,
      saveProgress,
      shake,
      scoreScale,
    ], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Toggle selection (pre-confirm) ──────────────────────────────────────

  const handleToggle = useCallback(
    (optIdx: number) => {
      if (confirmed) return;

      Haptics.selectionAsync();

      if (isMultiAnswer) {
        // Checkbox: toggle
        setSelectedIndices((prev) => {
          const next = new Set(prev);
          if (next.has(optIdx)) {
            next.delete(optIdx);
          } else {
            next.add(optIdx);
          }
          return next;
        });
      } else {
        // Single answer: immediately confirm
        setSelectedIndices(new Set([optIdx]));
        commitAnswer([optIdx]);
      }
    },
    [confirmed, isMultiAnswer, commitAnswer],
  );

  const handleValidate = useCallback(() => {
    if (selectedIndices.size === 0 || confirmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    commitAnswer(Array.from(selectedIndices));
  }, [selectedIndices, confirmed, commitAnswer]);

  const handleRestart = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setIndex(0);
    setSelectedIndices(new Set());
    setConfirmed(false);
    setAnswers([]);
    setFinished(false);
  }, []);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <QuizHeader onClose={onClose} scoreLabel="" progressLabel="" />
        <View style={styles.center}>
          <Ionicons
            name="help-circle-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Génération du quiz...
          </Text>
        </View>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <QuizHeader onClose={onClose} scoreLabel="" progressLabel="" />
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.textMuted}
          />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Aucune question disponible
          </Text>
        </View>
      </View>
    );
  }

  // ─── Finished screen ─────────────────────────────────────────────────────

  if (finished) {
    const finalScore = answers.reduce((acc, a) => acc + a.partialScore, 0);
    const pct =
      answers.length > 0 ? Math.round((finalScore / answers.length) * 100) : 0;

    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <QuizHeader onClose={onClose} scoreLabel="" progressLabel="" />
        <ScrollView contentContainerStyle={styles.finishScroll}>
          <Ionicons
            name={pct >= 60 ? "trophy" : "school"}
            size={64}
            color={pct >= 60 ? colors.accentWarning : colors.accentPrimary}
          />
          <Text style={[styles.finishTitle, { color: colors.textPrimary }]}>
            Quiz terminé !
          </Text>
          <Text style={[styles.finishScore, { color: colors.accentPrimary }]}>
            {pct}%
          </Text>
          <Text style={[styles.finishDetail, { color: colors.textSecondary }]}>
            {finalScore.toFixed(1)} / {answers.length} points
          </Text>

          {/* Per-question review */}
          <View style={styles.reviewList}>
            {answers.map((a, i) => {
              const q = questions[a.questionIndex];
              const correct = getCorrectIndices(q);
              const isMulti = correct.length > 1;
              return (
                <Animated.View
                  key={i}
                  entering={FadeInDown.delay(i * 70).duration(250)}
                >
                  <View
                    style={[
                      styles.reviewItem,
                      { backgroundColor: colors.bgElevated },
                    ]}
                  >
                    <Ionicons
                      name={
                        a.perfect
                          ? "checkmark-circle"
                          : a.partialScore > 0
                            ? "ellipse-outline"
                            : "close-circle"
                      }
                      size={20}
                      color={
                        a.perfect
                          ? colors.accentSuccess
                          : a.partialScore > 0
                            ? colors.accentWarning
                            : colors.accentError
                      }
                    />
                    <View style={styles.reviewContent}>
                      <Text
                        style={[
                          styles.reviewText,
                          { color: colors.textPrimary },
                        ]}
                        numberOfLines={2}
                      >
                        {q.question}
                      </Text>
                      {isMulti && (
                        <Text
                          style={[
                            styles.reviewSub,
                            { color: colors.textTertiary },
                          ]}
                        >
                          {a.partialScore.toFixed(1)} pt — {correct.length}{" "}
                          bonnes réponses
                        </Text>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>

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
        </ScrollView>
      </View>
    );
  }

  // ─── Quiz screen ──────────────────────────────────────────────────────────

  const perfectCount = answers.filter((a) => a.perfect).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <Animated.View style={scoreAnimStyle}>
        <QuizHeader
          onClose={onClose}
          scoreLabel={`${perfectCount} ✓ / ${displayScore}`}
          progressLabel={`${index + 1}/${questions.length}`}
        />
      </Animated.View>

      {/* Progress bar */}
      <View
        style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}
      >
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.accentPrimary,
              width: `${((index + 1) / questions.length) * 100}%`,
            },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Multi-answer badge */}
        {isMultiAnswer && (
          <Animated.View
            entering={FadeIn.duration(200)}
            style={styles.multiBadge}
          >
            <View
              style={[
                styles.multiBadgeInner,
                {
                  backgroundColor: `${colors.accentWarning}18`,
                  borderColor: `${colors.accentWarning}40`,
                },
              ]}
            >
              <Ionicons
                name="checkbox-outline"
                size={14}
                color={colors.accentWarning}
              />
              <Text
                style={[styles.multiBadgeText, { color: colors.accentWarning }]}
              >
                {correctIndices.length} bonnes réponses — sélectionne-les toutes
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Question */}
        <Animated.View style={shakeStyle}>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>
            {current.question}
          </Text>
        </Animated.View>

        {/* Options */}
        {current.options.map((option, optIdx) => {
          const isSelected = selectedIndices.has(optIdx);
          const isCorrect = confirmed && correctIndices.includes(optIdx);
          const isWrong =
            confirmed && isSelected && !correctIndices.includes(optIdx);
          const isMissed =
            confirmed && !isSelected && correctIndices.includes(optIdx);

          let bgColor = colors.bgElevated;
          let borderColor = colors.border;

          if (isCorrect) {
            bgColor = `${colors.accentSuccess}20`;
            borderColor = colors.accentSuccess;
          } else if (isWrong) {
            bgColor = `${colors.accentError}20`;
            borderColor = colors.accentError;
          } else if (isMissed) {
            bgColor = `${colors.accentWarning}15`;
            borderColor = colors.accentWarning;
          } else if (isSelected && !confirmed) {
            bgColor = `${colors.accentPrimary}20`;
            borderColor = colors.accentPrimary;
          }

          return (
            <Pressable
              key={optIdx}
              style={[
                styles.optionBtn,
                { backgroundColor: bgColor, borderColor },
              ]}
              onPress={() => handleToggle(optIdx)}
              disabled={confirmed}
              accessibilityRole={isMultiAnswer ? "checkbox" : "radio"}
              accessibilityState={{ checked: isSelected }}
            >
              {/* Checkbox / radio indicator */}
              <View
                style={[
                  styles.optionIndicator,
                  {
                    borderColor:
                      isSelected || isCorrect ? borderColor : colors.border,
                    backgroundColor:
                      isSelected && !confirmed
                        ? `${colors.accentPrimary}30`
                        : "transparent",
                    borderRadius: isMultiAnswer ? 4 : 14,
                  },
                ]}
              >
                {isSelected && !confirmed && (
                  <Ionicons
                    name={isMultiAnswer ? "checkmark" : "radio-button-on"}
                    size={14}
                    color={colors.accentPrimary}
                  />
                )}
                {confirmed && isCorrect && (
                  <Ionicons
                    name="checkmark"
                    size={14}
                    color={colors.accentSuccess}
                  />
                )}
                {confirmed && isWrong && (
                  <Ionicons name="close" size={14} color={colors.accentError} />
                )}
              </View>

              <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                {option}
              </Text>

              {/* Status icon */}
              {confirmed && (isCorrect || isWrong || isMissed) && (
                <Ionicons
                  name={
                    isCorrect
                      ? "checkmark-circle"
                      : isMissed
                        ? "alert-circle"
                        : "close-circle"
                  }
                  size={20}
                  color={
                    isCorrect
                      ? colors.accentSuccess
                      : isMissed
                        ? colors.accentWarning
                        : colors.accentError
                  }
                />
              )}
            </Pressable>
          );
        })}

        {/* Validate button — only for multi-answer, pre-confirm */}
        {isMultiAnswer && !confirmed && (
          <Pressable
            style={[
              styles.validateBtn,
              {
                backgroundColor:
                  selectedIndices.size > 0
                    ? colors.accentPrimary
                    : colors.bgTertiary,
              },
            ]}
            onPress={handleValidate}
            disabled={selectedIndices.size === 0}
          >
            <Text
              style={[
                styles.validateBtnText,
                {
                  color:
                    selectedIndices.size > 0 ? "#ffffff" : colors.textMuted,
                },
              ]}
            >
              Valider ma sélection ({selectedIndices.size}/
              {correctIndices.length})
            </Text>
          </Pressable>
        )}

        {/* Explanation */}
        {confirmed && current.explanation ? (
          <Animated.View
            entering={FadeInDown.duration(300)}
            style={styles.explanationBox}
          >
            <View
              style={[
                styles.explanationCard,
                { backgroundColor: `${colors.accentWarning}10` },
              ]}
            >
              <View style={styles.explanationHeader}>
                <Ionicons name="bulb" size={18} color={colors.accentWarning} />
                <Text
                  style={[
                    styles.explanationTitle,
                    { color: colors.accentWarning },
                  ]}
                >
                  Explication
                </Text>
              </View>
              <Text
                style={[
                  styles.explanationText,
                  { color: colors.textSecondary },
                ]}
              >
                {current.explanation}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <View style={{ height: sp["4xl"] }} />
      </ScrollView>
    </View>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface QuizHeaderProps {
  onClose: () => void;
  scoreLabel: string;
  progressLabel: string;
}

const QuizHeader: React.FC<QuizHeaderProps> = ({
  onClose,
  scoreLabel,
  progressLabel,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={onClose}
        style={styles.closeBtn}
        accessibilityLabel="Fermer"
      >
        <Ionicons name="close" size={28} color={colors.textPrimary} />
      </Pressable>
      <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
        {scoreLabel}
      </Text>
      <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
        {progressLabel}
      </Text>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sp["4xl"],
  },
  topBar: {
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
  scoreLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    textAlign: "center",
    flex: 1,
  },
  progressLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    minWidth: 40,
    textAlign: "right",
  },
  progressBar: {
    height: 4,
    marginHorizontal: sp.lg,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: sp.lg,
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: sp.lg,
  },
  multiBadge: {
    marginBottom: sp.md,
  },
  multiBadgeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.xs,
    paddingVertical: sp.xs + 2,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  multiBadgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  questionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.4,
    marginBottom: sp["2xl"],
  },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: sp.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginBottom: sp.sm,
    gap: sp.md,
  },
  optionIndicator: {
    width: 28,
    height: 28,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optionText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.4,
  },
  validateBtn: {
    marginTop: sp.md,
    paddingVertical: sp.md + 2,
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  validateBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  explanationBox: {
    marginTop: sp.md,
  },
  explanationCard: {
    padding: sp.lg,
    borderRadius: borderRadius.md,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    marginBottom: sp.sm,
  },
  explanationTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  explanationText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: fontSize.sm * 1.5,
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
  finishScroll: {
    alignItems: "center",
    paddingHorizontal: sp.lg,
    paddingTop: sp["3xl"],
    paddingBottom: sp["4xl"],
  },
  finishTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["2xl"],
    marginTop: sp.lg,
  },
  finishScore: {
    fontFamily: fontFamily.display,
    fontSize: fontSize["5xl"],
    marginTop: sp.sm,
  },
  finishDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    marginTop: sp.xs,
  },
  reviewList: {
    width: "100%",
    marginTop: sp["2xl"],
    gap: sp.sm,
  },
  reviewItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp.sm,
    padding: sp.md,
    borderRadius: borderRadius.md,
  },
  reviewContent: {
    flex: 1,
  },
  reviewText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  reviewSub: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  finishActions: {
    gap: sp.md,
    marginTop: sp["3xl"],
    width: "100%",
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

export default MultiAnswerQuiz;
