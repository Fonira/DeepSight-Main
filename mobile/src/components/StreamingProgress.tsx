import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Spacing, BorderRadius, Typography } from '../constants/theme';
import { AnimatedLogo } from './loading';

interface Step {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
}

interface StreamingProgressProps {
  currentStep: number; // 0-4
  progress: number; // 0-100
  statusMessage?: string;
  error?: string;
  /** Show animated spinner above the steps */
  showSpinner?: boolean;
  /** Show pulsing glow effect on spinner */
  showGlow?: boolean;
}

const STEPS: Step[] = [
  { id: 'connect', name: 'Connexion', nameEn: 'Connect', icon: 'wifi' },
  { id: 'metadata', name: 'Métadonnées', nameEn: 'Metadata', icon: 'information-circle' },
  { id: 'transcript', name: 'Transcription', nameEn: 'Transcript', icon: 'document-text' },
  { id: 'analysis', name: 'Analyse IA', nameEn: 'AI Analysis', icon: 'sparkles' },
  { id: 'complete', name: 'Terminé', nameEn: 'Complete', icon: 'checkmark-circle' },
];

const LOADING_PHRASES_FR = [
  "Extraction de la transcription...",
  "Récupération des métadonnées...",
  "Analyse du contenu principal...",
  "Détection de la langue...",
  "Analyse du ton et du registre...",
  "Identification des arguments clés...",
  "Vérification des sources citées...",
  "Analyse de la structure rhétorique...",
  "Évaluation de la fiabilité...",
  "Détection des biais potentiels...",
  "Cross-référencement des faits...",
  "Analyse de la cohérence logique...",
  "Extraction des points clés...",
  "Évaluation de la qualité pédagogique...",
  "Génération de la synthèse finale...",
  "Préparation des questions suggérées...",
  "Compilation du rapport d'analyse...",
];

const LOADING_PHRASES_EN = [
  "Extracting transcript...",
  "Retrieving metadata...",
  "Analyzing main content...",
  "Detecting language...",
  "Analyzing tone and register...",
  "Identifying key arguments...",
  "Verifying cited sources...",
  "Analyzing rhetorical structure...",
  "Evaluating reliability...",
  "Detecting potential biases...",
  "Cross-referencing facts...",
  "Analyzing logical consistency...",
  "Extracting key points...",
  "Evaluating pedagogical quality...",
  "Generating final synthesis...",
  "Preparing suggested questions...",
  "Compiling analysis report...",
];

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  currentStep,
  progress,
  statusMessage,
  error,
  showSpinner = true,
  showGlow = true,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  // Dynamic phrase state
  const phrases = isEn ? LOADING_PHRASES_EN : LOADING_PHRASES_FR;
  const phraseIndexRef = useRef(0);
  const [currentPhrase, setCurrentPhrase] = useState(phrases[0]);
  const phraseOpacity = useMemo(() => new Animated.Value(1), []);

  // Timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const startTimeRef = useRef(Date.now());

  // Animations
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);
  const gradientShift = useMemo(() => new Animated.Value(0), []);

  // Per-step checkmark scale animations
  const checkmarkScales = useMemo(
    () => STEPS.map(() => new Animated.Value(0)),
    []
  );

  // Animate checkmark when a step completes
  useEffect(() => {
    STEPS.forEach((_, i) => {
      if (i < currentStep) {
        Animated.spring(checkmarkScales[i], {
          toValue: 1,
          useNativeDriver: true,
          tension: 120,
          friction: 8,
        }).start();
      } else {
        checkmarkScales[i].setValue(0);
      }
    });
  }, [currentStep, checkmarkScales]);

  // Progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Active step pulse animation
  useEffect(() => {
    if (currentStep < 4 && !error) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [currentStep, error, pulseAnim]);

  // Gradient shimmer animation
  useEffect(() => {
    if (currentStep < 4 && !error) {
      const shimmer = Animated.loop(
        Animated.timing(gradientShift, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        })
      );
      shimmer.start();
      return () => shimmer.stop();
    }
  }, [currentStep, error, gradientShift]);

  // Rotating phrases with fade animation
  const cyclePhrase = useCallback(() => {
    Animated.timing(phraseOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      phraseIndexRef.current = (phraseIndexRef.current + 1) % phrases.length;
      setCurrentPhrase(phrases[phraseIndexRef.current]);
      Animated.timing(phraseOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  }, [phraseOpacity, phrases]);

  useEffect(() => {
    if (currentStep < 4 && !error) {
      const interval = setInterval(cyclePhrase, 3000);
      return () => clearInterval(interval);
    }
  }, [currentStep, error, cyclePhrase]);

  // Elapsed timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const ss = s < 10 ? `0${s}` : `${s}`;
    return `${m}:${ss}`;
  };

  const getStepStatus = (stepIndex: number) => {
    if (error && stepIndex === currentStep) return 'error';
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed': return colors.accentSuccess;
      case 'active': return colors.accentPrimary;
      case 'error': return colors.accentError;
      default: return colors.textMuted;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const isActive = currentStep < 4 && !error;

  return (
    <View style={styles.container}>
      {/* Timer badge (top right) */}
      <View style={styles.headerRow}>
        <View style={styles.spacer} />
        <View style={[styles.timerBadge, { backgroundColor: colors.bgSecondary, borderColor: colors.border + '60' }]}>
          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
          <Text style={[styles.timerText, { color: colors.textMuted }]}>
            {formatTime(elapsedSeconds)}
          </Text>
        </View>
      </View>

      {/* Animated Spinner — xl size */}
      {showSpinner && currentStep < 4 && !error && (
        <View style={styles.spinnerContainer}>
          <AnimatedLogo
            size="xl"
            speed="normal"
            showGlow={showGlow}
            loop
            autoPlay
          />
        </View>
      )}

      {/* Dynamic phrase */}
      {isActive && (
        <Animated.Text
          style={[
            styles.phraseText,
            { color: colors.textSecondary, opacity: phraseOpacity },
          ]}
          numberOfLines={1}
        >
          {currentPhrase}
        </Animated.Text>
      )}

      {/* Progress Bar — premium gradient */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.bgSecondary }]}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]}>
          {error ? (
            <View style={[styles.progressBarSolid, { backgroundColor: colors.accentError }]} />
          ) : (
            <LinearGradient
              colors={['#3b82f6', '#f59e0b', '#8b5cf6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.progressGradient}
            />
          )}
        </Animated.View>
      </View>

      {/* Progress percentage */}
      <Text style={[styles.progressText, { color: colors.textMuted }]}>
        {Math.round(progress)}%
      </Text>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const color = getStepColor(status);
          const isStepActive = status === 'active';
          const isCompleted = status === 'completed';

          return (
            <View key={step.id} style={styles.stepItem}>
              <Animated.View
                style={[
                  styles.stepIconContainer,
                  {
                    backgroundColor: (isCompleted || isStepActive) ? color + '22' : 'transparent',
                    borderColor: color,
                    transform: isStepActive ? [{ scale: pulseAnim }] : [],
                  },
                ]}
              >
                {isCompleted ? (
                  <Animated.View style={{ transform: [{ scale: checkmarkScales[index] }] }}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.accentSuccess} />
                  </Animated.View>
                ) : (
                  <Ionicons
                    name={status === 'error' ? 'close-circle' : (step.icon as any)}
                    size={16}
                    color={color}
                  />
                )}
              </Animated.View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: status === 'pending' ? colors.textMuted : color,
                    fontFamily: isStepActive
                      ? Typography.fontFamily.bodySemiBold
                      : Typography.fontFamily.body,
                  },
                ]}
                numberOfLines={1}
              >
                {isEn ? step.nameEn : step.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Connector Lines */}
      <View style={styles.connectorContainer}>
        {STEPS.slice(0, -1).map((_, index) => {
          const isCompleted = index < currentStep;
          return (
            <View
              key={index}
              style={[
                styles.connector,
                { backgroundColor: isCompleted ? colors.accentSuccess : colors.bgSecondary },
              ]}
            />
          );
        })}
      </View>

      {/* Status Message / Error */}
      {(statusMessage || error) && (
        <View
          style={[
            styles.messageContainer,
            {
              backgroundColor: error ? colors.accentError + '15' : colors.bgSecondary,
              borderColor: error ? colors.accentError + '40' : colors.border + '40',
            },
          ]}
        >
          <Ionicons
            name={error ? 'alert-circle' : 'information-circle'}
            size={16}
            color={error ? colors.accentError : colors.accentInfo}
          />
          <Text
            style={[
              styles.messageText,
              { color: error ? colors.accentError : colors.textSecondary },
            ]}
          >
            {error || statusMessage}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -Spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  timerText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  phraseText: {
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: -Spacing.xs,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarSolid: {
    flex: 1,
    borderRadius: 3,
  },
  progressGradient: {
    flex: 1,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.lg,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  stepIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepLabel: {
    fontSize: Typography.fontSize.xs,
    textAlign: 'center',
  },
  connectorContainer: {
    position: 'absolute',
    // Offset: container padding + headerRow height (~22) + gap*3 + spinner + phrase + progressBar + progressText + gap + stepContainer margin + half icon
    top: Spacing.lg + 22 + Spacing.md * 3 + 148 + 18 + 6 + 22 + Spacing.sm + 18,
    left: Spacing.lg + Spacing.sm + 18,
    right: Spacing.lg + Spacing.sm + 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  connector: {
    height: 2,
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  messageText: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
});

export default StreamingProgress;
