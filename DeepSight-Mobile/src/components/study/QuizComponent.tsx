import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';
import { GlassCard } from '../ui/GlassCard';
import { Button } from '../ui/Button';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface QuizComponentProps {
  questions: QuizQuestion[];
  isLoading?: boolean;
  onComplete?: (score: number, total: number) => void;
  onRetry?: () => void;
}

interface QuizState {
  currentIndex: number;
  selectedAnswer: number | null;
  showResult: boolean;
  answers: { questionIndex: number; selected: number; isCorrect: boolean }[];
  isComplete: boolean;
}

export const QuizComponent: React.FC<QuizComponentProps> = ({
  questions,
  isLoading = false,
  onComplete,
  onRetry,
}) => {
  const { colors } = useTheme();

  const [state, setState] = useState<QuizState>({
    currentIndex: 0,
    selectedAnswer: null,
    showResult: false,
    answers: [],
    isComplete: false,
  });

  // Animation values
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const currentQuestion = questions[state.currentIndex];
  const score = state.answers.filter(a => a.isCorrect).length;

  const handleSelectAnswer = useCallback((index: number) => {
    if (state.showResult) return;

    Haptics.selectionAsync();
    setState(prev => ({ ...prev, selectedAnswer: index }));
  }, [state.showResult]);

  const handleValidate = useCallback(() => {
    if (state.selectedAnswer === null) return;

    const isCorrect = state.selectedAnswer === currentQuestion.correct;

    Haptics.impactAsync(
      isCorrect ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Heavy
    );

    // Animate feedback
    if (isCorrect) {
      scale.value = withSequence(
        withTiming(1.05, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    } else {
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }

    setState(prev => ({
      ...prev,
      showResult: true,
      answers: [
        ...prev.answers,
        {
          questionIndex: prev.currentIndex,
          selected: prev.selectedAnswer!,
          isCorrect,
        },
      ],
    }));
  }, [state.selectedAnswer, state.currentIndex, currentQuestion?.correct, scale, shake]);

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();

    if (state.currentIndex + 1 >= questions.length) {
      const finalScore = state.answers.filter(a => a.isCorrect).length;
      setState(prev => ({ ...prev, isComplete: true }));
      onComplete?.(finalScore, questions.length);
    } else {
      setState(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        selectedAnswer: null,
        showResult: false,
      }));
    }
  }, [state.currentIndex, state.answers, questions.length, onComplete]);

  const handleRetry = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState({
      currentIndex: 0,
      selectedAnswer: null,
      showResult: false,
      answers: [],
      isComplete: false,
    });
    onRetry?.();
  }, [onRetry]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Génération du quiz...
        </Text>
      </View>
    );
  }

  // No questions
  if (!questions || questions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="help-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Aucune question disponible
        </Text>
      </View>
    );
  }

  // Quiz complete - show results
  if (state.isComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const resultMessage =
      percentage >= 80 ? 'Excellent travail !' :
      percentage >= 60 ? 'Bon travail !' :
      percentage >= 40 ? 'Continuez vos efforts !' : 'Révisez le contenu et réessayez';

    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.resultsContainer}>
        <GlassCard padding="xl" borderRadius="xl">
          <View style={styles.resultsContent}>
            <Ionicons
              name={percentage >= 60 ? 'trophy' : 'school'}
              size={64}
              color={percentage >= 60 ? colors.accentWarning : colors.accentPrimary}
            />
            <Text style={[styles.resultsTitle, { color: colors.textPrimary }]}>
              Quiz terminé !
            </Text>
            <Text style={[styles.resultsScore, { color: colors.accentPrimary }]}>
              {score}/{questions.length}
            </Text>
            <Text style={[styles.resultsPercentage, { color: colors.textSecondary }]}>
              {percentage}% de bonnes réponses
            </Text>
            <Text style={[styles.resultsMessage, { color: colors.textTertiary }]}>
              {resultMessage}
            </Text>

            <Button
              title="Recommencer"
              onPress={handleRetry}
              fullWidth
              style={styles.retryButton}
            />
          </View>
        </GlassCard>

        {/* Answer review */}
        <Text style={[styles.reviewTitle, { color: colors.textPrimary }]}>
          Révision des réponses
        </Text>
        {state.answers.map((answer, index) => (
          <Animated.View
            key={index}
            entering={FadeInDown.delay(index * 100).duration(300)}
          >
            <GlassCard padding="md" borderRadius="md" style={styles.reviewCard}>
              <View style={styles.reviewHeader}>
                <Ionicons
                  name={answer.isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={answer.isCorrect ? colors.accentSuccess : colors.accentError}
                />
                <Text style={[styles.reviewQuestion, { color: colors.textPrimary }]} numberOfLines={2}>
                  {questions[answer.questionIndex].question}
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        ))}
      </Animated.View>
    );
  }

  // Current question
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Progress */}
      <View style={styles.progressSection}>
        <Text style={[styles.progressText, { color: colors.textSecondary }]}>
          Question {state.currentIndex + 1}/{questions.length}
        </Text>
        <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((state.currentIndex + 1) / questions.length) * 100}%`,
                backgroundColor: colors.accentPrimary,
              },
            ]}
          />
        </View>
      </View>

      {/* Question */}
      <Animated.View style={[styles.questionCard, shakeStyle]}>
        <GlassCard padding="lg" borderRadius="lg">
          <Text style={[styles.questionText, { color: colors.textPrimary }]}>
            {currentQuestion.question}
          </Text>
        </GlassCard>
      </Animated.View>

      {/* Options */}
      <Animated.View style={scaleStyle}>
        {currentQuestion.options.map((option, index) => {
          const isSelected = state.selectedAnswer === index;
          const isCorrect = state.showResult && index === currentQuestion.correct;
          const isWrong = state.showResult && isSelected && index !== currentQuestion.correct;

          let backgroundColor = colors.bgElevated;
          let borderColor = colors.border;
          let iconColor = colors.textTertiary;

          if (isCorrect) {
            backgroundColor = `${colors.accentSuccess}20`;
            borderColor = colors.accentSuccess;
            iconColor = colors.accentSuccess;
          } else if (isWrong) {
            backgroundColor = `${colors.accentError}20`;
            borderColor = colors.accentError;
            iconColor = colors.accentError;
          } else if (isSelected && !state.showResult) {
            backgroundColor = `${colors.accentPrimary}20`;
            borderColor = colors.accentPrimary;
            iconColor = colors.accentPrimary;
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                {
                  backgroundColor,
                  borderColor,
                },
              ]}
              onPress={() => handleSelectAnswer(index)}
              disabled={state.showResult}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIndex, { backgroundColor: borderColor }]}>
                <Text style={styles.optionIndexText}>
                  {String.fromCharCode(65 + index)}
                </Text>
              </View>
              <Text
                style={[styles.optionText, { color: colors.textPrimary }]}
                numberOfLines={3}
              >
                {option}
              </Text>
              {state.showResult && (isCorrect || isWrong) && (
                <Ionicons
                  name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={iconColor}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

      {/* Explanation (shown after answer) */}
      {state.showResult && currentQuestion.explanation && (
        <Animated.View entering={FadeInDown.duration(300)}>
          <GlassCard padding="md" borderRadius="md" style={styles.explanationCard}>
            <View style={styles.explanationHeader}>
              <Ionicons name="bulb" size={20} color={colors.accentWarning} />
              <Text style={[styles.explanationTitle, { color: colors.accentWarning }]}>
                Explication
              </Text>
            </View>
            <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
              {currentQuestion.explanation}
            </Text>
          </GlassCard>
        </Animated.View>
      )}

      {/* Action button */}
      <View style={styles.actionContainer}>
        {!state.showResult ? (
          <Button
            title="Valider"
            onPress={handleValidate}
            disabled={state.selectedAnswer === null}
            fullWidth
          />
        ) : (
          <Button
            title={state.currentIndex + 1 >= questions.length ? 'Voir les résultats' : 'Question suivante'}
            onPress={handleNext}
            fullWidth
            icon={<Ionicons name="arrow-forward" size={20} color="#FFFFFF" />}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
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
    paddingVertical: Spacing.xxxl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  progressSection: {
    marginBottom: Spacing.lg,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginBottom: Spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  questionCard: {
    marginBottom: Spacing.lg,
  },
  questionText: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: Typography.fontSize.lg * 1.5,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  optionIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionIndexText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  optionText: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
  },
  explanationCard: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  explanationTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginLeft: Spacing.sm,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  actionContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xxl,
  },
  resultsContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  resultsContent: {
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: Typography.fontSize['2xl'],
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.lg,
  },
  resultsScore: {
    fontSize: Typography.fontSize['4xl'],
    fontFamily: Typography.fontFamily.display,
    marginTop: Spacing.md,
  },
  resultsPercentage: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
  resultsMessage: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.xl,
  },
  reviewTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  reviewCard: {
    marginBottom: Spacing.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewQuestion: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginLeft: Spacing.sm,
  },
});

export default QuizComponent;
