/**
 * StreamingAnalysisDisplay - Affichage en temps réel de la progression d'analyse
 * Avec étapes détaillées, progression token par token et effet typing
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import type { StreamStep, StreamStatus, VideoMetadata, StreamError } from '../../hooks/useAnalysisStream';
import { useFormattedDuration } from '../../hooks/useAnalysisStream';

interface StreamingAnalysisDisplayProps {
  status: StreamStatus;
  progress: number;
  text: string;
  metadata: VideoMetadata | null;
  steps: StreamStep[];
  error: StreamError | null;
  duration: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const StreamingAnalysisDisplay: React.FC<StreamingAnalysisDisplayProps> = ({
  status,
  progress,
  text,
  metadata,
  steps,
  error,
  duration,
  onRetry,
  onCancel,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const formattedDuration = useFormattedDuration(duration);

  // Animation values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cursorAnim = useRef(new Animated.Value(0)).current;

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Pulse animation for active step
  useEffect(() => {
    if (status === 'analyzing' || status === 'connecting' || status === 'transcript') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [status, pulseAnim]);

  // Cursor blink animation
  useEffect(() => {
    if (status === 'analyzing' && text) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      blink.start();
      return () => blink.stop();
    }
  }, [status, text, cursorAnim]);

  const getStepIcon = (step: StreamStep): keyof typeof Ionicons.glyphMap => {
    switch (step.id) {
      case 'connect':
        return 'wifi-outline';
      case 'metadata':
        return 'information-circle-outline';
      case 'transcript':
        return 'document-text-outline';
      case 'analysis':
        return 'sparkles-outline';
      case 'complete':
        return 'checkmark-circle-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const getStepStatusColor = (stepStatus: StreamStep['status']) => {
    switch (stepStatus) {
      case 'complete':
        return colors.accentSuccess;
      case 'active':
        return colors.accentPrimary;
      case 'error':
        return colors.accentError;
      default:
        return colors.textTertiary;
    }
  };

  const getStatusMessage = (): string => {
    switch (status) {
      case 'connecting':
        return language === 'fr' ? 'Connexion au serveur...' : 'Connecting to server...';
      case 'metadata':
        return language === 'fr' ? 'Récupération des métadonnées...' : 'Fetching metadata...';
      case 'transcript':
        return language === 'fr' ? 'Extraction de la transcription...' : 'Extracting transcript...';
      case 'analyzing':
        return language === 'fr' ? 'Analyse en cours...' : 'Analyzing...';
      case 'complete':
        return language === 'fr' ? 'Analyse terminée !' : 'Analysis complete!';
      case 'error':
        return error?.message || (language === 'fr' ? 'Une erreur est survenue' : 'An error occurred');
      case 'paused':
        return language === 'fr' ? 'En pause' : 'Paused';
      case 'cancelled':
        return language === 'fr' ? 'Annulé' : 'Cancelled';
      default:
        return language === 'fr' ? 'En attente...' : 'Waiting...';
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bgElevated }]}>
      {/* Header with metadata */}
      {metadata && (
        <View style={styles.metadataContainer}>
          <Text style={[styles.metadataTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {metadata.title}
          </Text>
          <Text style={[styles.metadataChannel, { color: colors.textSecondary }]}>
            {metadata.channel}
          </Text>
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: status === 'error' ? colors.accentError : colors.accentPrimary,
                width: progressWidth,
              },
            ]}
          />
        </View>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {Math.round(progress)}%
          </Text>
          <Text style={[styles.durationText, { color: colors.textTertiary }]}>
            {formattedDuration}
          </Text>
        </View>
      </View>

      {/* Status message */}
      <View style={styles.statusContainer}>
        <Animated.View style={{ transform: [{ scale: status !== 'complete' && status !== 'error' ? pulseAnim : 1 }] }}>
          <Ionicons
            name={
              status === 'complete'
                ? 'checkmark-circle'
                : status === 'error'
                ? 'alert-circle'
                : 'sync'
            }
            size={20}
            color={
              status === 'complete'
                ? colors.accentSuccess
                : status === 'error'
                ? colors.accentError
                : colors.accentPrimary
            }
          />
        </Animated.View>
        <Text style={[styles.statusText, { color: colors.textPrimary }]}>
          {getStatusMessage()}
        </Text>
      </View>

      {/* Steps list */}
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View key={step.id} style={styles.stepRow}>
            {/* Step connector line */}
            {index > 0 && (
              <View
                style={[
                  styles.stepConnector,
                  {
                    backgroundColor:
                      steps[index - 1].status === 'complete'
                        ? colors.accentSuccess
                        : colors.bgTertiary,
                  },
                ]}
              />
            )}

            {/* Step icon */}
            <View
              style={[
                styles.stepIconContainer,
                {
                  backgroundColor:
                    step.status === 'complete'
                      ? `${colors.accentSuccess}20`
                      : step.status === 'active'
                      ? `${colors.accentPrimary}20`
                      : `${colors.textTertiary}10`,
                  borderColor: getStepStatusColor(step.status),
                },
              ]}
            >
              {step.status === 'active' ? (
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <Ionicons
                    name={getStepIcon(step)}
                    size={16}
                    color={getStepStatusColor(step.status)}
                  />
                </Animated.View>
              ) : (
                <Ionicons
                  name={step.status === 'complete' ? 'checkmark' : getStepIcon(step)}
                  size={16}
                  color={getStepStatusColor(step.status)}
                />
              )}
            </View>

            {/* Step label */}
            <Text
              style={[
                styles.stepLabel,
                {
                  color:
                    step.status === 'active'
                      ? colors.textPrimary
                      : step.status === 'complete'
                      ? colors.accentSuccess
                      : colors.textTertiary,
                  fontFamily:
                    step.status === 'active'
                      ? Typography.fontFamily.bodySemiBold
                      : Typography.fontFamily.body,
                },
              ]}
            >
              {language === 'fr' ? step.label : step.labelEn}
            </Text>
          </View>
        ))}
      </View>

      {/* Streaming text preview */}
      {status === 'analyzing' && text && (
        <View style={[styles.textPreviewContainer, { backgroundColor: colors.bgTertiary }]}>
          <ScrollView
            style={styles.textPreviewScroll}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.textPreview, { color: colors.textPrimary }]}>
              {text.slice(-500)}
              <Animated.Text style={{ opacity: cursorAnim, color: colors.accentPrimary }}>
                ▋
              </Animated.Text>
            </Text>
          </ScrollView>
        </View>
      )}

      {/* Error state with retry */}
      {status === 'error' && error?.retryable && onRetry && (
        <View style={styles.errorActions}>
          <Text style={[styles.errorCode, { color: colors.textTertiary }]}>
            {error.code}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  metadataContainer: {
    marginBottom: Spacing.md,
  },
  metadataTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginBottom: Spacing.xs,
  },
  metadataChannel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
  progressContainer: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  progressText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  durationText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statusText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  stepsContainer: {
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.xs,
    position: 'relative',
  },
  stepConnector: {
    position: 'absolute',
    left: 15,
    top: -16,
    width: 2,
    height: 16,
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
    fontSize: Typography.fontSize.sm,
  },
  textPreviewContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    maxHeight: 120,
    marginTop: Spacing.sm,
  },
  textPreviewScroll: {
    maxHeight: 100,
  },
  textPreview: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.sm * 1.5,
  },
  errorActions: {
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  errorCode: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.xs,
  },
});

export default StreamingAnalysisDisplay;
