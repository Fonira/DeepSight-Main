/**
 * QuizGame - Mode Quiz plein écran
 * Questions à choix multiples, animations Reanimated, haptics
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStudy } from '../../hooks/useStudy';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { springs, duration } from '../../theme/animations';
import type { QuizQuestionV2 } from '../../types/v2';

interface QuizGameProps {
  summaryId: string;
  onClose: () => void;
}

interface AnswerRecord {
  questionIndex: number;
  selected: number;
  correct: boolean;
}

const ADVANCE_DELAY = 2000;

export const QuizGame: React.FC<QuizGameProps> = ({ summaryId, onClose }) => {
  const { colors } = useTheme();
  const { generateQuiz, saveProgress } = useStudy(summaryId);

  const [questions, setQuestions] = useState<QuizQuestionV2[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
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

  const score = answers.filter(a => a.correct).length;

  const handleSelect = useCallback((optionIndex: number) => {
    if (showResult || selected !== null) return;
    Haptics.selectionAsync();
    setSelected(optionIndex);

    const isCorrect = optionIndex === questions[index].correctIndex;

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      scoreScale.value = withSequence(
        withTiming(1.3, { duration: duration.fast }),
        withSpring(1, springs.gentle)
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }

    setShowResult(true);
    setAnswers(prev => [...prev, { questionIndex: index, selected: optionIndex, correct: isCorrect }]);

    // Auto-advance
    advanceTimer.current = setTimeout(() => {
      if (index + 1 >= questions.length) {
        const finalScore = isCorrect ? score + 1 : score;
        saveProgress({ quizScore: finalScore, quizTotal: questions.length });
        setFinished(true);
      } else {
        setIndex(prev => prev + 1);
        setSelected(null);
        setShowResult(false);
      }
    }, ADVANCE_DELAY);
  }, [showResult, selected, questions, index, score, saveProgress, shake, scoreScale]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const scoreAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scoreScale.value }],
  }));

  const handleRestart = useCallback(() => {
    setIndex(0);
    setSelected(null);
    setShowResult(false);
    setAnswers([]);
    setFinished(false);
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header onClose={onClose} label="" />
        <View style={styles.center}>
          <Ionicons name="help-circle-outline" size={48} color={colors.textMuted} />
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
        <Header onClose={onClose} label="" />
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Aucune question disponible
          </Text>
        </View>
      </View>
    );
  }

  if (finished) {
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header onClose={onClose} label="" />
        <ScrollView contentContainerStyle={styles.finishScroll}>
          <Ionicons
            name={pct >= 60 ? 'trophy' : 'school'}
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
            {score}/{questions.length} réponses correctes
          </Text>

          {/* Review answers */}
          <View style={styles.reviewList}>
            {answers.map((a, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 80)}>
                <View style={[styles.reviewItem, { backgroundColor: colors.bgElevated }]}>
                  <Ionicons
                    name={a.correct ? 'checkmark-circle' : 'close-circle'}
                    size={20}
                    color={a.correct ? colors.accentSuccess : colors.accentError}
                  />
                  <Text
                    style={[styles.reviewText, { color: colors.textPrimary }]}
                    numberOfLines={2}
                  >
                    {questions[a.questionIndex].question}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>

          <View style={styles.finishActions}>
            <Pressable
              style={[styles.finishBtn, { backgroundColor: colors.accentPrimary }]}
              onPress={handleRestart}
            >
              <Text style={styles.finishBtnText}>Recommencer</Text>
            </Pressable>
            <Pressable
              style={[styles.finishBtn, { backgroundColor: colors.bgElevated }]}
              onPress={onClose}
            >
              <Text style={[styles.finishBtnText, { color: colors.textPrimary }]}>
                Fermer
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const current = questions[index];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header + Score */}
      <View style={styles.topBar}>
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </Pressable>
        <Animated.View style={scoreAnimStyle}>
          <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>
            {score}/{index + (showResult ? 1 : 0)}
          </Text>
        </Animated.View>
        <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
          {index + 1}/{questions.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
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

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Question */}
        <Animated.View style={shakeStyle}>
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>
            {current.question}
          </Text>
        </Animated.View>

        {/* Options */}
        {current.options.map((option, optIdx) => {
          const isSelected = selected === optIdx;
          const isCorrect = showResult && optIdx === current.correctIndex;
          const isWrong = showResult && isSelected && optIdx !== current.correctIndex;

          let bgColor = colors.bgElevated;
          let borderColor = colors.border;
          if (isCorrect) {
            bgColor = `${colors.accentSuccess}20`;
            borderColor = colors.accentSuccess;
          } else if (isWrong) {
            bgColor = `${colors.accentError}20`;
            borderColor = colors.accentError;
          } else if (isSelected && !showResult) {
            bgColor = `${colors.accentPrimary}20`;
            borderColor = colors.accentPrimary;
          }

          return (
            <Pressable
              key={optIdx}
              style={[styles.optionBtn, { backgroundColor: bgColor, borderColor }]}
              onPress={() => handleSelect(optIdx)}
              disabled={showResult}
            >
              <View style={[styles.optionLetter, { backgroundColor: borderColor }]}>
                <Text style={styles.optionLetterText}>
                  {String.fromCharCode(65 + optIdx)}
                </Text>
              </View>
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                {option}
              </Text>
              {(isCorrect || isWrong) && (
                <Ionicons
                  name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={22}
                  color={isCorrect ? colors.accentSuccess : colors.accentError}
                />
              )}
            </Pressable>
          );
        })}

        {/* Explanation */}
        {showResult && current.explanation ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.explanationBox}>
            <View style={[styles.explanationCard, { backgroundColor: `${colors.accentWarning}10` }]}>
              <View style={styles.explanationHeader}>
                <Ionicons name="bulb" size={18} color={colors.accentWarning} />
                <Text style={[styles.explanationTitle, { color: colors.accentWarning }]}>
                  Explication
                </Text>
              </View>
              <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
                {current.explanation}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <View style={{ height: sp['4xl'] }} />
      </ScrollView>
    </View>
  );
};

const Header: React.FC<{ onClose: () => void; label: string }> = ({ onClose, label }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fermer">
        <Ionicons name="close" size={28} color={colors.textPrimary} />
      </Pressable>
      <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={{ width: 28 }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: sp['4xl'],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sp.lg,
    paddingBottom: sp.sm,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  progressLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  progressBar: {
    height: 4,
    marginHorizontal: sp.lg,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: sp.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: sp.lg,
  },
  questionText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    lineHeight: fontSize.xl * 1.4,
    marginBottom: sp['2xl'],
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    marginBottom: sp.sm,
    gap: sp.md,
  },
  optionLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetterText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  optionText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * 1.4,
  },
  explanationBox: {
    marginTop: sp.md,
  },
  explanationCard: {
    padding: sp.lg,
    borderRadius: borderRadius.md,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
  finishScroll: {
    alignItems: 'center',
    paddingHorizontal: sp.lg,
    paddingTop: sp['3xl'],
    paddingBottom: sp['4xl'],
  },
  finishTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['2xl'],
    marginTop: sp.lg,
  },
  finishScore: {
    fontFamily: fontFamily.display,
    fontSize: fontSize['5xl'],
    marginTop: sp.sm,
  },
  finishDetail: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.lg,
    marginTop: sp.xs,
  },
  reviewList: {
    width: '100%',
    marginTop: sp['2xl'],
    gap: sp.sm,
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    padding: sp.md,
    borderRadius: borderRadius.md,
  },
  reviewText: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  finishActions: {
    gap: sp.md,
    marginTop: sp['3xl'],
    width: '100%',
  },
  finishBtn: {
    paddingVertical: sp.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  finishBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
    color: '#ffffff',
  },
});

export default QuizGame;
