/**
 * TTS (Text-to-Speech) Player Component for DeepSight Mobile
 *
 * Features:
 * - Play/Pause/Stop controls
 * - Speed control
 * - Voice selection
 * - Plan-based access gating
 * - Progress tracking
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { hasFeature, getMinPlanForFeature, getPlanInfo } from '../../config/planPrivileges';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';

interface TTSPlayerProps {
  text: string;
  title?: string;
  onUpgradePress?: () => void;
  compact?: boolean;
}

interface Voice {
  identifier: string;
  name: string;
  quality: Speech.VoiceQuality;
  language: string;
}

const SPEECH_RATES = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1.0 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2.0 },
];

export const TTSPlayer: React.FC<TTSPlayerProps> = ({
  text,
  title,
  onUpgradePress,
  compact = false,
}) => {
  const { colors } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [rate, setRate] = useState(1.0);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [progress, setProgress] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // Check if user has access to TTS
  const userPlan = user?.plan || 'free';
  const hasAccess = hasFeature(userPlan, 'ttsAudio');

  // Load available voices on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const availableVoices = await Speech.getAvailableVoicesAsync();
        // Filter for French and English voices
        const filteredVoices = availableVoices.filter(
          (v) => v.language.startsWith('fr') || v.language.startsWith('en')
        );
        setVoices(filteredVoices);

        // Auto-select a voice based on current language
        const preferredLang = language === 'fr' ? 'fr' : 'en';
        const defaultVoice = filteredVoices.find(
          (v) => v.language.startsWith(preferredLang) && v.quality === Speech.VoiceQuality.Enhanced
        ) || filteredVoices.find((v) => v.language.startsWith(preferredLang));

        if (defaultVoice) {
          setSelectedVoice(defaultVoice.identifier);
        }
      } catch (error) {
        if (__DEV__) { console.warn('Failed to load TTS voices:', error); }
      }
    };

    loadVoices();
  }, [language]);

  // Calculate estimated duration based on text length and rate
  useEffect(() => {
    // Average speaking rate is about 150 words per minute
    const words = text.split(/\s+/).length;
    const minutes = words / (150 * rate);
    setEstimatedDuration(Math.ceil(minutes * 60));
  }, [text, rate]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handlePlay = useCallback(async () => {
    if (!hasAccess) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isPaused) {
      // Resume is not supported in expo-speech, so we restart
      setIsPaused(false);
    }

    const options: Speech.SpeechOptions = {
      rate,
      pitch: 1.0,
      language: language === 'fr' ? 'fr-FR' : 'en-US',
      voice: selectedVoice || undefined,
      onStart: () => {
        setIsPlaying(true);
        setProgress(0);
      },
      onDone: () => {
        setIsPlaying(false);
        setProgress(100);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onStopped: () => {
        setIsPlaying(false);
      },
      onError: () => {
        setIsPlaying(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      },
    };

    await Speech.speak(text, options);
  }, [hasAccess, isPaused, rate, language, selectedVoice, text]);

  const handlePause = useCallback(() => {
    Haptics.selectionAsync();
    Speech.stop();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  const handleStop = useCallback(() => {
    Haptics.selectionAsync();
    Speech.stop();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  }, []);

  const handleRateChange = useCallback((newRate: number) => {
    Haptics.selectionAsync();
    setRate(newRate);
    // If currently playing, restart with new rate
    if (isPlaying) {
      handleStop();
    }
  }, [isPlaying, handleStop]);

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If user doesn't have access, show upgrade prompt
  if (!hasAccess) {
    const minPlan = getMinPlanForFeature('ttsAudio');
    const planInfo = getPlanInfo(minPlan);
    const planName = planInfo.name[language as 'fr' | 'en'] || planInfo.name.fr;

    if (compact) {
      return (
        <TouchableOpacity
          style={[styles.compactLockedButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
          onPress={onUpgradePress}
        >
          <Ionicons name="lock-closed" size={14} color={colors.textTertiary} />
          <Text style={[styles.compactLockedText, { color: colors.textTertiary }]}>
            TTS ({planName}+)
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.lockedContainer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
        <View style={styles.lockedHeader}>
          <Ionicons name="volume-high-outline" size={24} color={colors.textTertiary} />
          <Text style={[styles.lockedTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Lecture audio' : 'Audio Playback'}
          </Text>
        </View>
        <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
          {language === 'fr'
            ? `La lecture audio est disponible avec le plan ${planName} ou supérieur.`
            : `Audio playback is available with the ${planName} plan or higher.`
          }
        </Text>
        {onUpgradePress && (
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: colors.accentPrimary }]}
            onPress={onUpgradePress}
          >
            <Text style={styles.upgradeButtonText}>
              {language === 'fr' ? 'Voir les plans' : 'View Plans'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Compact mode
  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.bgSecondary }]}>
        <TouchableOpacity
          style={[styles.compactPlayButton, { backgroundColor: colors.accentPrimary }]}
          onPress={isPlaying ? handleStop : handlePlay}
        >
          <Ionicons
            name={isPlaying ? 'stop' : 'play'}
            size={16}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>
          {isPlaying
            ? (language === 'fr' ? 'Lecture...' : 'Playing...')
            : 'TTS'
          }
        </Text>
        {isPlaying && (
          <TouchableOpacity onPress={() => setShowSettings(true)}>
            <Ionicons name="settings-outline" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accentPrimary + '20' }]}>
          <Ionicons name="volume-high-outline" size={20} color={colors.accentPrimary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {title || (language === 'fr' ? 'Lecture audio' : 'Audio Playback')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {estimatedDuration > 0 && `~${formatDuration(estimatedDuration)}`}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Ionicons name="settings-outline" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: colors.bgTertiary }]}
          onPress={handleStop}
          disabled={!isPlaying && !isPaused}
        >
          <Ionicons
            name="stop"
            size={24}
            color={isPlaying || isPaused ? colors.textPrimary : colors.textTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.playButton,
            { backgroundColor: isPlaying ? colors.accentWarning : colors.accentPrimary },
          ]}
          onPress={isPlaying ? handlePause : handlePlay}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={32}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <View style={[styles.rateButton, { backgroundColor: colors.bgTertiary }]}>
          <Text style={[styles.rateText, { color: colors.textPrimary }]}>
            {rate}x
          </Text>
        </View>
      </View>

      {/* Status */}
      {isPlaying && (
        <View style={styles.statusContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.bgTertiary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.accentPrimary, width: `${progress}%` },
              ]}
            />
          </View>
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {language === 'fr' ? 'Lecture en cours...' : 'Playing...'}
          </Text>
        </View>
      )}

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.bgPrimary }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Paramètres audio' : 'Audio Settings'}
            </Text>
            <TouchableOpacity onPress={() => setShowSettings(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Speed */}
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {language === 'fr' ? 'Vitesse de lecture' : 'Playback Speed'}
            </Text>
            <View style={styles.rateOptions}>
              {SPEECH_RATES.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.rateOption,
                    { backgroundColor: colors.bgSecondary },
                    rate === option.value && {
                      borderColor: colors.accentPrimary,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => handleRateChange(option.value)}
                >
                  <Text
                    style={[
                      styles.rateOptionText,
                      { color: rate === option.value ? colors.accentPrimary : colors.textPrimary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Voice Selection */}
            {voices.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {language === 'fr' ? 'Voix' : 'Voice'}
                </Text>
                <View style={styles.voiceOptions}>
                  {voices.slice(0, 6).map((voice) => (
                    <TouchableOpacity
                      key={voice.identifier}
                      style={[
                        styles.voiceOption,
                        { backgroundColor: colors.bgSecondary },
                        selectedVoice === voice.identifier && {
                          borderColor: colors.accentPrimary,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => setSelectedVoice(voice.identifier)}
                    >
                      <Text
                        style={[styles.voiceName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {voice.name}
                      </Text>
                      <Text style={[styles.voiceLanguage, { color: colors.textTertiary }]}>
                        {voice.language}
                      </Text>
                      {voice.quality === Speech.VoiceQuality.Enhanced && (
                        <View style={[styles.qualityBadge, { backgroundColor: colors.accentSuccess + '20' }]}>
                          <Text style={[styles.qualityText, { color: colors.accentSuccess }]}>
                            HD
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  compactPlayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactLabel: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  compactLockedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  compactLockedText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  lockedContainer: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  lockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  lockedTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  lockedText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.md,
  },
  upgradeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  subtitle: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  settingsButton: {
    padding: Spacing.xs,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  rateButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  statusContainer: {
    marginTop: Spacing.md,
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
  statusText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  modalContent: {
    padding: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  rateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rateOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rateOptionText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  voiceOptions: {
    gap: Spacing.sm,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: Spacing.sm,
  },
  voiceName: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  voiceLanguage: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  qualityBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  qualityText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default TTSPlayer;
