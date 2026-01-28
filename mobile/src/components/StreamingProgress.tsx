import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
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

export const StreamingProgress: React.FC<StreamingProgressProps> = ({
  currentStep,
  progress,
  statusMessage,
  error,
  showSpinner = true,
  showGlow = true,
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  // Animations
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const pulseAnim = useMemo(() => new Animated.Value(1), []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    if (currentStep < 4 && !error) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [currentStep, error, pulseAnim]);

  const getStepStatus = (stepIndex: number) => {
    if (error && stepIndex === currentStep) return 'error';
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'active';
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return colors.accentSuccess;
      case 'active':
        return colors.accentPrimary;
      case 'error':
        return colors.accentError;
      default:
        return colors.textMuted;
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {/* Animated Spinner */}
      {showSpinner && currentStep < 4 && !error && (
        <View style={styles.spinnerContainer}>
          <AnimatedLogo
            size="lg"
            speed="normal"
            showGlow={showGlow}
            loop
            autoPlay
          />
        </View>
      )}

      {/* Progress Bar */}
      <View style={[styles.progressBarContainer, { backgroundColor: colors.bgSecondary }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressWidth,
              backgroundColor: error ? colors.accentError : colors.accentPrimary,
            },
          ]}
        />
      </View>

      {/* Steps */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const status = getStepStatus(index);
          const color = getStepColor(status);
          const isActive = status === 'active';

          return (
            <View key={step.id} style={styles.stepItem}>
              <Animated.View
                style={[
                  styles.stepIconContainer,
                  {
                    backgroundColor: status === 'completed' || status === 'active' ? color + '20' : 'transparent',
                    borderColor: color,
                    transform: isActive ? [{ scale: pulseAnim }] : [],
                  },
                ]}
              >
                <Ionicons
                  name={status === 'completed' ? 'checkmark' : status === 'error' ? 'close' : (step.icon as any)}
                  size={16}
                  color={color}
                />
              </Animated.View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: status === 'pending' ? colors.textMuted : color,
                    fontFamily: isActive ? Typography.fontFamily.bodySemiBold : Typography.fontFamily.body,
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
                {
                  backgroundColor: isCompleted
                    ? colors.accentSuccess
                    : colors.bgSecondary,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Status Message */}
      {(statusMessage || error) && (
        <View
          style={[
            styles.messageContainer,
            {
              backgroundColor: error
                ? colors.accentError + '15'
                : colors.bgSecondary,
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
              {
                color: error
                  ? colors.accentError
                  : colors.textSecondary,
              },
            ]}
          >
            {error || statusMessage}
          </Text>
        </View>
      )}

      {/* Progress Percentage */}
      <Text style={[styles.progressText, { color: colors.textMuted }]}>
        {Math.round(progress)}%
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  spinnerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  stepIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    top: Spacing.lg + 4 + 16, // padding + progress bar + half icon
    left: Spacing.lg + Spacing.sm + 16, // padding + paddingHorizontal + half icon
    right: Spacing.lg + Spacing.sm + 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  connector: {
    height: 2,
    flex: 1,
    marginHorizontal: 4,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  messageText: {
    flex: 1,
    fontFamily: Typography.fontFamily.body,
    fontSize: Typography.fontSize.sm,
  },
  progressText: {
    fontFamily: Typography.fontFamily.bodyMedium,
    fontSize: Typography.fontSize.lg,
    textAlign: 'center',
  },
});

export default StreamingProgress;
