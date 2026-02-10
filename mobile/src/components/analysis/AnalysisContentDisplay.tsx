/**
 * AnalysisContentDisplay - Professional Markdown Analysis Display
 *
 * Renders analysis content with:
 * - Full markdown support (headers, bold, lists, etc.)
 * - Clickable timecodes [MM:SS]
 * - Styled epistemic markers (SOLIDE, PLAUSIBLE, etc.)
 * - Theme-aware colors
 * - Professional typography
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

// Epistemic marker definitions
const EPISTEMIC_MARKERS: Record<string, { color: string; bgColor: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  'SOLIDE': { color: '#22C55E', bgColor: '#22C55E20', icon: 'checkmark-circle', label: 'Établi' },
  'PLAUSIBLE': { color: '#3B82F6', bgColor: '#3B82F620', icon: 'help-circle', label: 'Probable' },
  'INCERTAIN': { color: '#F59E0B', bgColor: '#F59E0B20', icon: 'alert-circle', label: 'Incertain' },
  'A VERIFIER': { color: '#EF4444', bgColor: '#EF444420', icon: 'warning', label: 'À vérifier' },
  'À VÉRIFIER': { color: '#EF4444', bgColor: '#EF444420', icon: 'warning', label: 'À vérifier' },
};

// Timecode regex pattern
const TIMECODE_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

interface AnalysisContentDisplayProps {
  content: string;
  onTimecodePress?: (seconds: number) => void;
  showEmptyState?: boolean;
  emptyStateMessage?: string;
}

export const AnalysisContentDisplay: React.FC<AnalysisContentDisplayProps> = ({
  content,
  onTimecodePress,
  showEmptyState = false,
  emptyStateMessage = 'Aucune analyse disponible',
}) => {
  const { colors, isDark } = useTheme();
  const { t } = useLanguage();

  // Parse timecodes and convert to clickable format
  const parseTimecode = (match: string): number => {
    const parts = match.replace(/[\[\]]/g, '').split(':').map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parts[0] * 60 + parts[1];
  };

  // Pre-process content to handle special markers
  const processedContent = useMemo(() => {
    if (!content) return '';

    let processed = content;

    // Clean [[concept]] markers - convert to bold
    processed = processed.replace(/\[\[([^\]]+)\]\]/g, '**$1**');

    // Note: Timecodes will be handled by custom renderer
    // Epistemic markers will be styled via custom rules

    return processed;
  }, [content]);

  // Pure white color for dark mode to ensure maximum readability
  const pureWhite = isDark ? '#FFFFFF' : colors.textPrimary;
  const emphasisColor = isDark ? '#E8E8F0' : colors.textSecondary;

  // Create markdown styles based on theme
  const markdownStyles = useMemo(() => StyleSheet.create({
    body: {
      color: pureWhite,
      fontSize: 16,
      lineHeight: 26,
      fontFamily: Typography.fontFamily.body,
    },
    heading1: {
      color: pureWhite,
      fontSize: 22,
      fontFamily: Typography.fontFamily.bodySemiBold,
      marginTop: 20,
      marginBottom: 12,
      lineHeight: 30,
    },
    heading2: {
      color: pureWhite,
      fontSize: 19,
      fontFamily: Typography.fontFamily.bodySemiBold,
      marginTop: 18,
      marginBottom: 10,
      lineHeight: 26,
    },
    heading3: {
      color: pureWhite,
      fontSize: 17,
      fontFamily: Typography.fontFamily.bodySemiBold,
      marginTop: 16,
      marginBottom: 8,
      lineHeight: 24,
    },
    paragraph: {
      color: pureWhite,
      fontSize: 16,
      lineHeight: 26,
      marginBottom: 14,
      fontFamily: Typography.fontFamily.body,
    },
    strong: {
      fontFamily: Typography.fontFamily.bodySemiBold,
      color: pureWhite,
    },
    em: {
      fontStyle: 'italic',
      color: emphasisColor,
    },
    bullet_list: {
      marginBottom: 12,
    },
    ordered_list: {
      marginBottom: 12,
    },
    bullet_list_icon: {
      color: colors.accentPrimary,
      fontSize: 16,
      marginRight: 8,
      marginTop: 4,
    },
    ordered_list_icon: {
      color: colors.accentPrimary,
      fontSize: 16,
      fontFamily: Typography.fontFamily.bodySemiBold,
      marginRight: 8,
    },
    textgroup: {
      color: pureWhite,
    },
    text: {
      color: pureWhite,
    },
    bullet_list_content: {
      flex: 1,
      color: pureWhite,
    },
    ordered_list_content: {
      flex: 1,
      color: pureWhite,
    },
    list_item: {
      flexDirection: 'row',
      marginBottom: 8,
      color: pureWhite,
    },
    softbreak: {
      color: pureWhite,
    },
    hardbreak: {
      color: pureWhite,
    },
    s: {
      color: emphasisColor,
      textDecorationLine: 'line-through',
    },
    image: {
      width: '100%' as any,
      borderRadius: BorderRadius.md,
      marginVertical: 8,
    },
    blockquote: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.bgTertiary,
      borderLeftColor: colors.accentPrimary,
      borderLeftWidth: 4,
      paddingLeft: 16,
      paddingVertical: 12,
      marginVertical: 12,
      borderRadius: BorderRadius.sm,
    },
    code_inline: {
      backgroundColor: colors.bgTertiary,
      color: colors.accentSecondary,
      fontFamily: 'monospace',
      fontSize: 14,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    code_block: {
      backgroundColor: colors.bgTertiary,
      padding: 12,
      borderRadius: BorderRadius.md,
      marginVertical: 12,
    },
    fence: {
      backgroundColor: colors.bgTertiary,
      padding: 12,
      borderRadius: BorderRadius.md,
      marginVertical: 12,
    },
    link: {
      color: colors.accentPrimary,
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: colors.border,
      height: 1,
      marginVertical: 16,
    },
    table: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BorderRadius.sm,
      marginVertical: 12,
    },
    tr: {
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    th: {
      backgroundColor: colors.bgTertiary,
      padding: 8,
      fontFamily: Typography.fontFamily.bodySemiBold,
    },
    td: {
      padding: 8,
    },
  }), [colors, pureWhite, emphasisColor, isDark]);

  // Custom renderer for timecodes
  const renderTimecode = (timecode: string) => {
    const seconds = parseTimecode(timecode);
    return (
      <TouchableOpacity
        key={timecode}
        onPress={() => onTimecodePress?.(seconds)}
        style={[styles.timecodeButton, { backgroundColor: colors.accentPrimary + '20' }]}
      >
        <Ionicons name="play" size={12} color={colors.accentPrimary} />
        <Text style={[styles.timecodeText, { color: colors.accentPrimary }]}>
          {timecode.replace(/[\[\]]/g, '')}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render epistemic badge
  const renderEpistemicBadge = (marker: string) => {
    const config = EPISTEMIC_MARKERS[marker.toUpperCase()];
    if (!config) return null;

    return (
      <View style={[styles.epistemicBadge, { backgroundColor: config.bgColor }]}>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={[styles.epistemicText, { color: config.color }]}>
          {marker}
        </Text>
      </View>
    );
  };

  // Custom text renderer to handle timecodes and epistemic markers inline
  const renderTextWithTimecodes = (text: string) => {
    if (!text) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    // Find all timecodes
    const regex = new RegExp(TIMECODE_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
      // Add text before timecode
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        parts.push(
          <Text key={`text-${key++}`} style={{ color: pureWhite, fontSize: 16 }}>
            {beforeText}
          </Text>
        );
      }

      // Add timecode button
      const timecode = match[0];
      const seconds = parseTimecode(timecode);
      parts.push(
        <TouchableOpacity
          key={`tc-${key++}`}
          onPress={() => onTimecodePress?.(seconds)}
          style={[styles.inlineTimecode, { backgroundColor: colors.accentPrimary + '15' }]}
        >
          <Text style={[styles.inlineTimecodeText, { color: colors.accentPrimary }]}>
            {timecode.replace(/[\[\]]/g, '')}
          </Text>
        </TouchableOpacity>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`text-${key++}`} style={{ color: pureWhite, fontSize: 16 }}>
          {text.slice(lastIndex)}
        </Text>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  // Custom rules for markdown rendering
  const rules = {
    text: (node: any, children: any, parent: any, styles: any) => {
      const text = node.content;
      const baseStyle = { color: pureWhite };

      // Check for timecodes
      if (TIMECODE_REGEX.test(text)) {
        return (
          <Text key={node.key} style={[styles.text, baseStyle]}>
            {renderTextWithTimecodes(text)}
          </Text>
        );
      }

      // Check for epistemic markers
      for (const marker of Object.keys(EPISTEMIC_MARKERS)) {
        if (text.includes(marker)) {
          const markerRegex = new RegExp(`(${marker})`, 'gi');
          const parts = text.split(markerRegex);

          return (
            <Text key={node.key} style={[styles.text, baseStyle]}>
              {parts.map((part: string, idx: number) => {
                if (EPISTEMIC_MARKERS[part.toUpperCase()]) {
                  return renderEpistemicBadge(part);
                }
                return <Text key={idx} style={baseStyle}>{part}</Text>;
              })}
            </Text>
          );
        }
      }

      return <Text key={node.key} style={[styles.text, baseStyle]}>{text}</Text>;
    },
  };

  // Empty state
  if (showEmptyState || !content) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bgElevated }]}>
        <Ionicons name="document-text-outline" size={48} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {emptyStateMessage}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Markdown
        style={markdownStyles}
        rules={rules}
      >
        {processedContent}
      </Markdown>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    minHeight: 150,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  timecodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginVertical: 4,
  },
  timecodeText: {
    fontSize: 13,
    fontFamily: Typography.fontFamily.bodyMedium,
    marginLeft: 4,
  },
  inlineTimecode: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  inlineTimecodeText: {
    fontSize: 14,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  epistemicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  epistemicText: {
    fontSize: 12,
    fontFamily: Typography.fontFamily.bodySemiBold,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
});

export default AnalysisContentDisplay;
