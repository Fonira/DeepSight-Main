import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysisStore } from '@/stores/analysisStore';
import { videoApi } from '@/services/api';
import { validateYouTubeUrl, getYouTubeThumbnail } from '@/utils/formatters';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

interface URLInputProps {
  onOptionsPress: () => void;
}

export const URLInput: React.FC<URLInputProps> = ({ onOptionsPress }) => {
  const { colors } = useTheme();
  const options = useAnalysisStore((s) => s.options);
  const startAnalysisAction = useAnalysisStore((s) => s.startAnalysis);
  const inputRef = useRef<TextInput>(null);

  const [url, setUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);

  const validation = validateYouTubeUrl(url);
  const videoId = validation.videoId;
  const thumbnailUri = videoId
    ? getYouTubeThumbnail(videoId, 'medium')
    : null;

  // Check clipboard for YouTube URL
  const checkClipboard = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && validateYouTubeUrl(text).isValid && text !== url) {
        setClipboardUrl(text);
      } else {
        setClipboardUrl(null);
      }
    } catch {
      // Clipboard access may fail silently
    }
  }, [url]);

  useEffect(() => {
    checkClipboard();
  }, [checkClipboard]);

  const handlePaste = useCallback(() => {
    if (clipboardUrl) {
      setUrl(clipboardUrl);
      setClipboardUrl(null);
      setError(null);
    }
  }, [clipboardUrl]);

  const handleChangeText = useCallback((text: string) => {
    setUrl(text);
    setError(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!validation.isValid || isAnalyzing) return;

    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await videoApi.analyze({
        url,
        mode: options.mode,
        language: options.language,
        model: 'mistral',
        category: 'auto',
      });

      const taskId = response.task_id;
      if (!taskId) throw new Error('Pas de task_id retourné');

      startAnalysisAction(taskId);
      router.push({
        pathname: '/(tabs)/analysis/[id]',
        params: { id: taskId },
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors de l'analyse";
      setError(message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [url, validation.isValid, isAnalyzing, options, startAnalysisAction]);

  const canAnalyze = validation.isValid && !isAnalyzing;

  return (
    <View style={styles.wrapper}>
      {/* Main input row */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.glassBg,
            borderColor:
              validation.isValid
                ? palette.indigo
                : url.length > 0 && !validation.isValid
                ? colors.accentError
                : colors.glassBorder,
          },
        ]}
      >
        <Ionicons
          name="link-outline"
          size={20}
          color={validation.isValid ? palette.indigo : colors.textMuted}
          style={styles.linkIcon}
        />

        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.textPrimary }]}
          placeholder="Colle un lien YouTube"
          placeholderTextColor={colors.textMuted}
          value={url}
          onChangeText={handleChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={canAnalyze ? handleAnalyze : undefined}
          onFocus={checkClipboard}
          accessibilityLabel="Lien YouTube"
        />

        {/* Clipboard paste button */}
        {clipboardUrl && !url && (
          <Pressable
            onPress={handlePaste}
            style={[
              styles.pasteButton,
              { backgroundColor: colors.bgElevated },
            ]}
            accessibilityLabel="Coller le lien YouTube du presse-papier"
          >
            <Text style={[styles.pasteText, { color: palette.indigo }]}>
              Coller
            </Text>
          </Pressable>
        )}

        {/* Analyze button */}
        <Pressable
          onPress={handleAnalyze}
          disabled={!canAnalyze}
          style={styles.analyzeButton}
          accessibilityLabel="Analyser la vidéo"
        >
          <LinearGradient
            colors={
              canAnalyze
                ? [palette.indigo, palette.violet]
                : [colors.bgTertiary, colors.bgTertiary]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.analyzeGradient,
              !canAnalyze && styles.analyzeDisabled,
            ]}
          >
            {isAnalyzing ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text
                style={[
                  styles.analyzeText,
                  { color: canAnalyze ? '#ffffff' : colors.textMuted },
                ]}
              >
                Analyser
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>

      {/* Mini preview when URL is valid */}
      {videoId && thumbnailUri && (
        <View
          style={[
            styles.preview,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.previewThumbnail}
            contentFit="cover"
            transition={200}
          />
          <Text
            style={[styles.previewId, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {videoId}
          </Text>
        </View>
      )}

      {/* Error message */}
      {error && (
        <Text style={[styles.error, { color: colors.accentError }]}>
          {error}
        </Text>
      )}

      {/* Options link */}
      <Pressable onPress={onOptionsPress} style={styles.optionsLink}>
        <Text style={[styles.optionsText, { color: colors.textTertiary }]}>
          Options avancées
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.textTertiary}
        />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: sp.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingLeft: sp.md,
    minHeight: 52,
    overflow: 'hidden',
  },
  linkIcon: {
    marginRight: sp.sm,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    paddingVertical: sp.md,
  },
  pasteButton: {
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    borderRadius: borderRadius.sm,
    marginRight: sp.sm,
  },
  pasteText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  analyzeButton: {
    alignSelf: 'stretch',
  },
  analyzeGradient: {
    paddingHorizontal: sp.xl,
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minWidth: 100,
  },
  analyzeDisabled: {
    opacity: 0.6,
  },
  analyzeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
  },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.sm,
    padding: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  previewThumbnail: {
    width: 48,
    height: 36,
    borderRadius: borderRadius.sm,
  },
  previewId: {
    flex: 1,
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
    marginLeft: sp.sm,
  },
  error: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.sm,
  },
  optionsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.sm,
    alignSelf: 'flex-start',
  },
  optionsText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginRight: sp.xs,
  },
});

export default URLInput;
