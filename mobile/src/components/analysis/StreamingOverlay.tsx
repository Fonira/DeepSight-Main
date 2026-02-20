import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize } from '../../theme/typography';
import { palette } from '../../theme/colors';
import { videoApi } from '../../services/api';
import { useAnalysisStore } from '../../stores/analysisStore';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StreamingOverlayProps {
  taskId: string;
  onCancel: () => void;
  onComplete: (summaryId?: string) => void;
}

interface StepConfig {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  targetProgress: number;
}

const STEPS: StepConfig[] = [
  { label: 'Connexion au serveur', icon: 'cloud-outline', targetProgress: 5 },
  { label: 'Récupération des métadonnées', icon: 'information-circle-outline', targetProgress: 15 },
  { label: 'Extraction de la transcription', icon: 'document-text-outline', targetProgress: 40 },
  { label: 'Analyse IA en cours', icon: 'sparkles-outline', targetProgress: 85 },
  { label: 'Terminé !', icon: 'checkmark-circle-outline', targetProgress: 100 },
];

const CIRCLE_SIZE = 140;
const STROKE_WIDTH = 8;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Fake progress curve — fast at start, slows down, never reaches 95% until real completion
const FAKE_PROGRESS_TIMELINE = [
  { time: 0, progress: 2 },
  { time: 1500, progress: 8 },
  { time: 3000, progress: 15 },
  { time: 5000, progress: 22 },
  { time: 8000, progress: 32 },
  { time: 12000, progress: 42 },
  { time: 18000, progress: 55 },
  { time: 25000, progress: 65 },
  { time: 35000, progress: 73 },
  { time: 50000, progress: 80 },
  { time: 70000, progress: 85 },
  { time: 90000, progress: 88 },
  { time: 120000, progress: 90 },
  { time: 180000, progress: 92 },
];

function getFakeProgress(elapsedMs: number): number {
  for (let i = FAKE_PROGRESS_TIMELINE.length - 1; i >= 0; i--) {
    if (elapsedMs >= FAKE_PROGRESS_TIMELINE[i].time) {
      if (i === FAKE_PROGRESS_TIMELINE.length - 1) {
        return FAKE_PROGRESS_TIMELINE[i].progress;
      }
      // Interpolate between this point and the next
      const current = FAKE_PROGRESS_TIMELINE[i];
      const next = FAKE_PROGRESS_TIMELINE[i + 1];
      const ratio = (elapsedMs - current.time) / (next.time - current.time);
      return current.progress + (next.progress - current.progress) * ratio;
    }
  }
  return 0;
}

function getActiveStep(progress: number): number {
  for (let i = STEPS.length - 1; i >= 0; i--) {
    if (progress >= STEPS[i].targetProgress) return i;
  }
  return 0;
}

const MOTIVATIONAL_MESSAGES = [
  'Patience, la qualité prend du temps...',
  'Analyse approfondie en cours...',
  'Extraction des points clés...',
  'Évaluation de la fiabilité...',
  'Structuration du résumé...',
  'Vérification des sources...',
];

export const StreamingOverlay: React.FC<StreamingOverlayProps> = ({
  taskId,
  onCancel,
  onComplete,
}) => {
  const { colors } = useTheme();
  const store = useAnalysisStore();
  const animProgress = useSharedValue(0);
  const fadeAnim = useSharedValue(1);
  const scaleAnim = useSharedValue(1);
  const pulseAnim = useSharedValue(1);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const startTimeRef = useRef(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realProgressRef = useRef(0);
  const completedRef = useRef(false);
  const summaryIdRef = useRef<string | undefined>(undefined);

  // Pulse animation
  useEffect(() => {
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }, [pulseAnim]);

  // Rotate motivational messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update display + animated progress
  const updateProgress = useCallback((progress: number) => {
    setDisplayProgress(Math.round(progress));
    animProgress.value = withTiming(progress / 100, {
      duration: 800,
      easing: Easing.out(Easing.cubic),
    });
  }, [animProgress]);

  // Handle completion animation
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsCompleted(true);

    // Animate to 100%
    updateProgress(100);
    store.completeAnalysis();

    // Fade out after celebration
    const timer = setTimeout(() => {
      fadeAnim.value = withTiming(0, { duration: 400 });
      scaleAnim.value = withTiming(0.9, { duration: 400 }, () => {
        runOnJS(onComplete)(summaryIdRef.current);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [updateProgress, store, fadeAnim, scaleAnim, onComplete]);

  // Poll backend for real status
  useEffect(() => {
    if (!taskId || completedRef.current) return;

    const poll = async () => {
      try {
        const status = await videoApi.getStatus(taskId);

        if (completedRef.current) return;

        // Update real progress from backend
        if (status.progress > realProgressRef.current) {
          realProgressRef.current = status.progress;
          store.setProgress(status.progress);
        }

        if (status.summary_id) {
          summaryIdRef.current = status.summary_id;
        }

        if (status.status === 'completed') {
          summaryIdRef.current = status.summary_id || summaryIdRef.current;
          handleComplete();
        } else if (status.status === 'failed') {
          store.failAnalysis(status.error || 'Analyse échouée');
          // Don't block — let fake progress handle graceful display
        }
      } catch {
        // Polling error — silently retry next cycle
        if (__DEV__) console.warn('[Polling] Status check failed');
      }
    };

    // First poll immediately
    poll();

    // Then every 3 seconds
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [taskId, store, handleComplete]);

  // Fake progress ticker — runs every 500ms, always moves forward
  useEffect(() => {
    if (completedRef.current) return;

    fakeProgressRef.current = setInterval(() => {
      if (completedRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const fakeProgress = getFakeProgress(elapsed);
      const realProgress = realProgressRef.current;

      // Use whichever is higher: fake or real
      const effectiveProgress = Math.max(fakeProgress, realProgress);

      // Cap at 94% until real completion
      const cappedProgress = Math.min(effectiveProgress, 94);
      updateProgress(cappedProgress);
    }, 500);

    return () => {
      if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
    };
  }, [updateProgress]);

  const activeStep = getActiveStep(displayProgress);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ scale: scaleAnim.value }],
  }));

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - animProgress.value),
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: colors.bgPrimary },
        containerStyle,
      ]}
    >
      {/* Progress Circle */}
      <Animated.View style={pulseStyle}>
        <View style={styles.circleContainer}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={isCompleted ? palette.green : palette.indigo}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={circleProps}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.circleTextContainer}>
            <Text style={[styles.progressText, { color: colors.textPrimary }]}>
              {displayProgress}%
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Motivational message */}
      <Text style={[styles.motivationalText, { color: colors.textTertiary }]}>
        {isCompleted ? 'Analyse terminée !' : MOTIVATIONAL_MESSAGES[messageIndex]}
      </Text>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const isStepComplete = index < activeStep;
          const isActive = index === activeStep;

          let iconColor = colors.textMuted;
          let textColor = colors.textMuted;
          if (isStepComplete || (isCompleted && index === STEPS.length - 1)) {
            iconColor = palette.green;
            textColor = palette.green;
          } else if (isActive) {
            iconColor = palette.indigo;
            textColor = colors.textPrimary;
          }

          return (
            <View key={step.label} style={styles.stepRow}>
              <Ionicons
                name={isStepComplete || (isCompleted && index === STEPS.length - 1)
                  ? 'checkmark-circle'
                  : step.icon}
                size={20}
                color={iconColor}
              />
              <Text
                style={[
                  styles.stepLabel,
                  { color: textColor },
                  isActive && styles.stepLabelActive,
                ]}
              >
                {step.label}
              </Text>
              {isActive && !isCompleted && (
                <View style={[styles.activeDot, { backgroundColor: palette.indigo }]} />
              )}
            </View>
          );
        })}
      </View>

      {/* Cancel button */}
      {!isCompleted && (
        <Pressable
          onPress={onCancel}
          style={[styles.cancelButton, { borderColor: colors.border }]}
          accessibilityLabel="Annuler l'analyse"
          accessibilityRole="button"
        >
          <Text style={[styles.cancelText, { color: colors.textTertiary }]}>
            Annuler
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    paddingHorizontal: sp['3xl'],
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleTextContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize['2xl'],
  },
  motivationalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.md,
    marginBottom: sp['3xl'],
    textAlign: 'center',
    minHeight: 20,
  },
  stepsContainer: {
    width: '100%',
    gap: sp.lg,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.md,
  },
  stepLabel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    flex: 1,
  },
  stepLabelActive: {
    fontFamily: fontFamily.bodyMedium,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  cancelButton: {
    marginTop: sp['4xl'],
    paddingVertical: sp.md,
    paddingHorizontal: sp['2xl'],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  cancelText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
});

export default StreamingOverlay;
