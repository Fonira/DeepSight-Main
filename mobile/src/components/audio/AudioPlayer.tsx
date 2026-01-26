import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useTheme } from '../../contexts/ThemeContext';
import { ttsApi } from '../../services/api';

interface Voice {
  id: string;
  name: string;
  preview_url: string;
}

interface AudioPlayerProps {
  visible: boolean;
  onClose: () => void;
  text: string;
  title?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  visible,
  onClose,
  text,
  title = 'Summary',
}) => {
  const { colors } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  // Load available voices
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const response = await ttsApi.getVoices();
        setVoices(response.voices || []);
      } catch (err) {
        // Use default voices if API fails
        setVoices([
          { id: 'alloy', name: 'Alloy', preview_url: '' },
          { id: 'echo', name: 'Echo', preview_url: '' },
          { id: 'fable', name: 'Fable', preview_url: '' },
          { id: 'onyx', name: 'Onyx', preview_url: '' },
          { id: 'nova', name: 'Nova', preview_url: '' },
          { id: 'shimmer', name: 'Shimmer', preview_url: '' },
        ]);
      }
    };
    if (visible) {
      loadVoices();
    }
  }, [visible]);

  // Configure audio
  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });
    };
    setupAudio();
  }, []);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);

      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  }, []);

  const generateAudio = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Truncate text if too long
      const truncatedText = text.substring(0, 4000);
      const response = await ttsApi.generateAudio(truncatedText, selectedVoice);
      setAudioUrl(response.audio_url);
      await loadAudio(response.audio_url);
    } catch (err) {
      console.error('TTS error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadAudio = async (url: string) => {
    setIsLoading(true);
    try {
      // Unload existing sound
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
    } catch (err) {
      console.error('Load audio error:', err);
      setError('Failed to load audio');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!sound) {
      await generateAudio();
      return;
    }

    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  const handleSeek = async (forward: boolean) => {
    if (!sound) return;

    const seekAmount = 10000; // 10 seconds
    const newPosition = forward
      ? Math.min(position + seekAmount, duration)
      : Math.max(position - seekAmount, 0);

    await sound.setPositionAsync(newPosition);
  };

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedSelector(false);
    if (sound) {
      await sound.setRateAsync(speed, true);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleClose = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
    setAudioUrl(null);
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setError(null);
    onClose();
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.bgPrimary,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 8,
    },
    playerContainer: {
      alignItems: 'center',
    },
    artwork: {
      width: 120,
      height: 120,
      borderRadius: 16,
      backgroundColor: colors.accentPrimary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    trackTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    voiceSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
    },
    voiceText: {
      fontSize: 14,
      color: colors.textSecondary,
      marginRight: 4,
    },
    progressContainer: {
      width: '100%',
      marginBottom: 24,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.accentPrimary,
      borderRadius: 2,
    },
    timeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    timeText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
    },
    controlButton: {
      padding: 12,
    },
    playButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.accentPrimary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: colors.accentError,
      textAlign: 'center',
      marginBottom: 16,
    },
    voiceModal: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    voiceModalContent: {
      backgroundColor: colors.bgPrimary,
      borderRadius: 16,
      maxHeight: '60%',
    },
    voiceModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    voiceModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    voiceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    voiceItemSelected: {
      backgroundColor: colors.accentPrimary + '10',
    },
    voiceName: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    speedSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: colors.bgCard,
      borderRadius: 16,
      marginLeft: 8,
    },
    speedText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    speedModalContent: {
      backgroundColor: colors.bgPrimary,
      borderRadius: 16,
      maxHeight: '50%',
    },
    speedModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    speedModalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    speedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    speedItemSelected: {
      backgroundColor: colors.accentPrimary + '10',
    },
    speedValue: {
      fontSize: 16,
      color: colors.textPrimary,
    },
    generateButton: {
      backgroundColor: colors.accentPrimary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 24,
      marginTop: 16,
    },
    generateButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  const progress = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title}>Écouter le résumé</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerContainer}>
            <View style={styles.artwork}>
              <Ionicons name="musical-notes" size={48} color={colors.accentPrimary} />
            </View>

            <Text style={styles.trackTitle} numberOfLines={2}>
              {title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
              <TouchableOpacity
                style={styles.voiceSelector}
                onPress={() => setShowVoiceSelector(true)}
              >
                <Text style={styles.voiceText}>
                  Voix: {voices.find(v => v.id === selectedVoice)?.name || selectedVoice}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.speedSelector}
                onPress={() => setShowSpeedSelector(true)}
              >
                <Text style={styles.speedText}>{playbackSpeed}x</Text>
                <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            </View>

            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {audioUrl && sound ? (
              <>
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatTime(position)}</Text>
                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                  </View>
                </View>

                <View style={styles.controls}>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => handleSeek(false)}
                  >
                    <Ionicons name="play-back" size={28} color={colors.textPrimary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={handlePlayPause}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Ionicons
                        name={isPlaying ? 'pause' : 'play'}
                        size={28}
                        color="#fff"
                      />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => handleSeek(true)}
                  >
                    <Ionicons name="play-forward" size={28} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={generateAudio}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.generateButtonText}>Générer l'audio</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Voice Selector Modal */}
      <Modal
        visible={showVoiceSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVoiceSelector(false)}
      >
        <TouchableOpacity
          style={styles.voiceModal}
          activeOpacity={1}
          onPress={() => setShowVoiceSelector(false)}
        >
          <View style={styles.voiceModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.voiceModalHeader}>
              <Text style={styles.voiceModalTitle}>Choisir une voix</Text>
              <TouchableOpacity onPress={() => setShowVoiceSelector(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {voices.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceItem,
                    voice.id === selectedVoice && styles.voiceItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedVoice(voice.id);
                    setShowVoiceSelector(false);
                    // Clear existing audio when voice changes
                    if (sound) {
                      sound.unloadAsync();
                      setSound(null);
                      setAudioUrl(null);
                    }
                  }}
                >
                  <Text style={styles.voiceName}>{voice.name}</Text>
                  {voice.id === selectedVoice && (
                    <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Speed Selector Modal */}
      <Modal
        visible={showSpeedSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedSelector(false)}
      >
        <TouchableOpacity
          style={styles.voiceModal}
          activeOpacity={1}
          onPress={() => setShowSpeedSelector(false)}
        >
          <View style={styles.speedModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.speedModalHeader}>
              <Text style={styles.speedModalTitle}>Vitesse de lecture</Text>
              <TouchableOpacity onPress={() => setShowSpeedSelector(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {PLAYBACK_SPEEDS.map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.speedItem,
                    speed === playbackSpeed && styles.speedItemSelected,
                  ]}
                  onPress={() => handleSpeedChange(speed)}
                >
                  <Text style={styles.speedValue}>
                    {speed === 1.0 ? 'Normal' : `${speed}x`}
                  </Text>
                  {speed === playbackSpeed && (
                    <Ionicons name="checkmark" size={20} color={colors.accentPrimary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};
