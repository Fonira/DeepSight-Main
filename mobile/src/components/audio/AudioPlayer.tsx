import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('alloy');
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  // Use expo-audio hooks for audio playback
  const player = useAudioPlayer(audioUrl || undefined);
  const status = useAudioPlayerStatus(player);

  // Track if we need to apply playback speed after loading
  const pendingSpeedRef = useRef<number | null>(null);

  // Apply playback speed when player is ready
  useEffect(() => {
    if (player && audioUrl && pendingSpeedRef.current !== null) {
      player.setPlaybackRate(pendingSpeedRef.current);
      pendingSpeedRef.current = null;
    }
  }, [player, audioUrl]);

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

  const generateAudio = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // Truncate text if too long
      const truncatedText = text.substring(0, 4000);
      const response = await ttsApi.generateAudio(truncatedText, selectedVoice);
      setAudioUrl(response.audio_url);
      // Set pending speed to be applied when player loads
      pendingSpeedRef.current = playbackSpeed;
    } catch (err) {
      console.error('TTS error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate audio');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = async () => {
    if (!audioUrl) {
      await generateAudio();
      return;
    }

    if (!player) return;

    if (status?.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const handleSeek = async (forward: boolean) => {
    if (!player || !status) return;

    const seekAmount = 10; // 10 seconds
    const currentTime = status.currentTime || 0;
    const duration = status.duration || 0;

    const newPosition = forward
      ? Math.min(currentTime + seekAmount, duration)
      : Math.max(currentTime - seekAmount, 0);

    player.seekTo(newPosition);
  };

  const handleSpeedChange = async (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedSelector(false);
    if (player) {
      player.setPlaybackRate(speed);
    }
  };

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.floor(seconds);
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (player) {
      player.pause();
    }
    setAudioUrl(null);
    setError(null);
    onClose();
  };

  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setShowVoiceSelector(false);
    // Clear existing audio when voice changes
    if (audioUrl) {
      if (player) {
        player.pause();
      }
      setAudioUrl(null);
    }
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

  const duration = status?.duration || 0;
  const position = status?.currentTime || 0;
  const isPlaying = status?.playing || false;
  const isLoading = status?.isLoaded === false && audioUrl !== null;
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

            {audioUrl && player ? (
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
                  onPress={() => handleVoiceChange(voice.id)}
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
