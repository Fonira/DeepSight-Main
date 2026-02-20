import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { sp, borderRadius } from '../../theme/spacing';
import { fontFamily, fontSize, lineHeight } from '../../theme/typography';
import { palette } from '../../theme/colors';
import { Badge } from '../ui/Badge';
import { AnalysisSkeleton } from '../ui/SkeletonLoader';

interface SummaryViewProps {
  content: string | undefined;
  isStreaming?: boolean;
  streamingText?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

const EPISTEMIC_MARKERS: Record<string, { variant: 'success' | 'primary' | 'warning' | 'error'; label: string }> = {
  '[SOLIDE]': { variant: 'success', label: 'SOLIDE' },
  '[PLAUSIBLE]': { variant: 'primary', label: 'PLAUSIBLE' },
  '[INCERTAIN]': { variant: 'warning', label: 'INCERTAIN' },
  '[A VERIFIER]': { variant: 'error', label: 'A VERIFIER' },
  '[À VÉRIFIER]': { variant: 'error', label: 'À VÉRIFIER' },
};

const BlinkingCursor: React.FC = () => {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: 2, height: 18, backgroundColor: palette.indigo, marginLeft: 2 },
        style,
      ]}
    />
  );
};

export const SummaryView: React.FC<SummaryViewProps> = ({
  content,
  isStreaming = false,
  streamingText = '',
  isLoading = false,
  error,
  onRetry,
}) => {
  const { colors } = useTheme();
  const displayText = isStreaming ? streamingText : (content || '');

  const handleCopy = useCallback(async () => {
    if (!displayText) return;
    await Clipboard.setStringAsync(displayText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [displayText]);

  // Parse content into segments with epistemic markers replaced by badges
  const parsedContent = useMemo(() => {
    if (!displayText) return [];

    const markerPattern = /\[(SOLIDE|PLAUSIBLE|INCERTAIN|A VERIFIER|À VÉRIFIER)\]/g;
    const segments: Array<{ type: 'text' | 'badge'; value: string; variant?: 'success' | 'primary' | 'warning' | 'error' }> = [];
    let lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = markerPattern.exec(displayText)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: displayText.slice(lastIndex, match.index) });
      }
      const key = `[${match[1]}]`;
      const marker = EPISTEMIC_MARKERS[key];
      if (marker) {
        segments.push({ type: 'badge', value: marker.label, variant: marker.variant });
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < displayText.length) {
      segments.push({ type: 'text', value: displayText.slice(lastIndex) });
    }

    return segments;
  }, [displayText]);

  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.accentError} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
          {error}
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: colors.accentPrimary }]}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (!displayText) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
          Aucun contenu disponible
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Copy button */}
      <Pressable
        onPress={handleCopy}
        style={[styles.copyButton, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
        accessibilityLabel="Copier le résumé"
        accessibilityRole="button"
      >
        <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
        <Text style={[styles.copyLabel, { color: colors.textSecondary }]}>
          Copier
        </Text>
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.summaryText, { color: colors.textPrimary }]}>
          {parsedContent.map((segment, index) => {
            if (segment.type === 'badge') {
              return (
                <View key={index} style={styles.inlineBadge}>
                  <Badge label={segment.value} variant={segment.variant} size="sm" />
                </View>
              );
            }
            return <Text key={index}>{segment.value}</Text>;
          })}
          {isStreaming && <BlinkingCursor />}
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    paddingVertical: sp.xs,
    paddingHorizontal: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: sp.md,
    marginRight: sp.lg,
  },
  copyLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: sp.lg,
    paddingBottom: 120,
  },
  summaryText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    lineHeight: fontSize.base * lineHeight.relaxed,
  },
  inlineBadge: {
    marginHorizontal: 2,
    transform: [{ translateY: 3 }],
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
    paddingHorizontal: sp['3xl'],
  },
  errorText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: sp.md,
    paddingHorizontal: sp['2xl'],
    borderRadius: borderRadius.lg,
    marginTop: sp.sm,
  },
  retryText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: '#ffffff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.md,
  },
  emptyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
  },
});

export default SummaryView;
