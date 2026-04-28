import React, { useEffect, useRef, useCallback, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  runOnJS,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { videoApi } from "../../services/api";
import { useAnalysisStore } from "../../stores/analysisStore";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// DeepSight spinner assets — wheel only (cosmic background removed to avoid double-logo overlay)
const SPINNER_WHEEL = require("../../../assets/images/spinner-wheel.jpg");

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
  { label: "Connexion au serveur", icon: "cloud-outline", targetProgress: 5 },
  {
    label: "Récupération des métadonnées",
    icon: "information-circle-outline",
    targetProgress: 15,
  },
  {
    label: "Extraction de la transcription",
    icon: "document-text-outline",
    targetProgress: 40,
  },
  {
    label: "Analyse IA en cours",
    icon: "sparkles-outline",
    targetProgress: 85,
  },
  { label: "Terminé !", icon: "checkmark-circle-outline", targetProgress: 100 },
];

// Spinner dimensions
const SPINNER_SIZE = 180;
const RING_SIZE = SPINNER_SIZE + 16;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Fake progress curve — fast at start, slows down, climbs to 98% before real completion lands
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
  { time: 110000, progress: 91 },
  { time: 130000, progress: 93 },
  { time: 160000, progress: 95 },
  { time: 200000, progress: 97 },
  { time: 260000, progress: 98 },
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
  "Patience, la qualité prend du temps...",
  "Analyse approfondie en cours...",
  "Extraction des points clés...",
  "Évaluation de la fiabilité...",
  "Structuration du résumé...",
  "Vérification des sources...",
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
  const wheelRotation = useSharedValue(0);

  const [displayProgress, setDisplayProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [failedError, setFailedError] = useState<string | null>(null);
  const failCountRef = useRef(0);

  const startTimeRef = useRef(Date.now());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realProgressRef = useRef(0);
  const completedRef = useRef(false);
  const summaryIdRef = useRef<string | undefined>(undefined);

  // Wheel rotation animation (continuous spin)
  useEffect(() => {
    wheelRotation.value = withRepeat(
      withTiming(360, { duration: 5000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [wheelRotation]);

  // Rotate motivational messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % MOTIVATIONAL_MESSAGES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Update display + animated progress
  const updateProgress = useCallback(
    (progress: number) => {
      setDisplayProgress(Math.round(progress));
      animProgress.value = withTiming(progress / 100, {
        duration: 800,
        easing: Easing.out(Easing.cubic),
      });
    },
    [animProgress],
  );

  // Handle completion animation
  // ⚠️ Ne PAS appeler store.completeAnalysis() ici : ça mettrait status="completed",
  // ce qui ferait disparaître l'overlay immédiatement (showStreamingOverlay devient false)
  // et démontrerait ce composant avant que le setTimeout/onComplete s'exécute.
  // Résultat : onComplete jamais appelé, summary_id jamais transmis à l'écran parent.
  // C'est handleStreamingComplete (parent) qui fera resetAnalysis() après réception du summaryId.
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setIsCompleted(true);

    // Animate to 100%
    updateProgress(100);

    // Fade out after celebration, then propagate summary_id to parent
    const timer = setTimeout(() => {
      fadeAnim.value = withTiming(0, { duration: 400 });
      scaleAnim.value = withTiming(0.9, { duration: 400 }, () => {
        runOnJS(onComplete)(summaryIdRef.current);
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [updateProgress, fadeAnim, scaleAnim, onComplete]);

  // Poll backend for real status
  useEffect(() => {
    if (!taskId || completedRef.current) return;

    const poll = async () => {
      try {
        const status = await videoApi.getStatus(taskId);

        if (completedRef.current) return;

        // Successful poll — reset failure counter
        failCountRef.current = 0;

        // Update real progress from backend
        if (status.progress > realProgressRef.current) {
          realProgressRef.current = status.progress;
          store.setProgress(status.progress);
        }

        if (status.summary_id) {
          summaryIdRef.current = status.summary_id;
        }

        if (status.status === "cancelled") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
          onCancel();
          return;
        }

        if (status.status === "completed") {
          summaryIdRef.current = status.summary_id || summaryIdRef.current;
          handleComplete();
        } else if (status.status === "failed") {
          // On ne propage PAS l'échec au store immédiatement pour éviter que
          // [id].tsx tente de fetcher avec le task_id (≠ summary_id) et affiche une erreur.
          // On affiche l'erreur dans l'overlay après 3 échecs consécutifs.
          failCountRef.current += 1;
          if (failCountRef.current >= 3) {
            setFailedError(
              status.error || "L'analyse a échoué. Veuillez réessayer.",
            );
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
          }
        }
      } catch (error: unknown) {
        // Log detailed error info for debugging
        if (__DEV__) {
          const apiErr = error as {
            status?: number;
            code?: string;
            message?: string;
          };
          console.warn(
            "[Polling] Status check failed:",
            JSON.stringify({
              status: apiErr.status,
              code: apiErr.code,
              message: apiErr.message ?? String(error),
              taskId,
            }),
          );
        }

        // If 401/session expired, don't count as poll failure — token refresh will handle it
        const apiErr = error as { status?: number; code?: string };
        if (apiErr.status === 401 || apiErr.code === "SESSION_EXPIRED") {
          return; // Let RetryService/token refresh handle it
        }

        // If 404, the task doesn't exist (server restarted or wrong user)
        if (apiErr.status === 404) {
          failCountRef.current += 1;
          if (failCountRef.current >= 3) {
            setFailedError(
              "La tâche d'analyse n'a pas été trouvée. Le serveur a peut-être redémarré. Veuillez relancer l'analyse.",
            );
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
          }
          return;
        }

        // Network/timeout errors — silently retry next cycle (transient)
        failCountRef.current += 1;
        if (failCountRef.current >= 10) {
          setFailedError("Connexion perdue — on réessaie dans un instant");
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
        }
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

      // Cap at 98% until real completion (backend posts progress=100 only at the very end)
      const cappedProgress = Math.min(effectiveProgress, 98);
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

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_CIRCUMFERENCE * (1 - animProgress.value),
  }));

  const wheelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${wheelRotation.value}deg` }],
  }));

  // ── Écran d'erreur définitif (après 3 sondages 'failed') ──────────────────
  if (failedError) {
    return (
      <View style={[styles.overlay, { backgroundColor: colors.bgPrimary }]}>
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={palette.red ?? "#ef4444"}
        />
        <Text style={[styles.errorTitle, { color: colors.textPrimary }]}>
          Analyse échouée
        </Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
          {failedError}
        </Text>
        <Pressable
          onPress={onCancel}
          style={[
            styles.cancelButton,
            { borderColor: colors.border, marginTop: sp["2xl"] },
          ]}
          accessibilityLabel="Retour"
          accessibilityRole="button"
        >
          <Text style={[styles.cancelText, { color: colors.textTertiary }]}>
            Retour
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.overlay,
        { backgroundColor: colors.bgPrimary },
        containerStyle,
      ]}
    >
      {/* DeepSight Spinner + Progress Ring */}
      <View style={styles.spinnerWrapper}>
        {/* Thin progress ring around the spinner */}
        <Svg width={RING_SIZE} height={RING_SIZE} style={styles.progressRing}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.border}
            strokeWidth={RING_STROKE}
            fill="none"
            opacity={0.4}
          />
          <AnimatedCircle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={isCompleted ? palette.green : colors.accentPrimary}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={RING_CIRCUMFERENCE}
            animatedProps={ringProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>

        {/* Wheel (rotating) — single layer, no static background overlay */}
        <Animated.View style={[styles.spinnerImageWrapper, wheelStyle]}>
          <Image
            source={SPINNER_WHEEL}
            style={styles.spinnerWheel}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Percentage overlay */}
        <View style={styles.percentageContainer}>
          <Text style={styles.progressText}>{displayProgress}%</Text>
        </View>
      </View>

      {/* Motivational message */}
      <Text style={[styles.motivationalText, { color: colors.textTertiary }]}>
        {isCompleted
          ? "Analyse terminée !"
          : MOTIVATIONAL_MESSAGES[messageIndex]}
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
                name={
                  isStepComplete || (isCompleted && index === STEPS.length - 1)
                    ? "checkmark-circle"
                    : step.icon
                }
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
                <View
                  style={[
                    styles.activeDot,
                    { backgroundColor: palette.indigo },
                  ]}
                />
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
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    paddingHorizontal: sp["3xl"],
  },
  spinnerWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRing: {
    position: "absolute",
  },
  spinnerImageWrapper: {
    position: "absolute",
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
    overflow: "hidden",
  },
  spinnerWheel: {
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
    borderRadius: SPINNER_SIZE / 2,
    opacity: 1,
  },
  percentageContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: SPINNER_SIZE,
    height: SPINNER_SIZE,
  },
  progressText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize["3xl"],
    color: "#ffffff",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  motivationalText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.md,
    marginBottom: sp["3xl"],
    textAlign: "center",
    minHeight: 20,
  },
  stepsContainer: {
    width: "100%",
    gap: sp.lg,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
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
    marginTop: sp["4xl"],
    paddingVertical: sp.md,
    paddingHorizontal: sp["2xl"],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  cancelText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
  },
  errorTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xl,
    marginTop: sp.lg,
    textAlign: "center",
  },
  errorMessage: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    textAlign: "center",
    marginTop: sp.sm,
    lineHeight: fontSize.sm * 1.5,
  },
});

export default StreamingOverlay;
