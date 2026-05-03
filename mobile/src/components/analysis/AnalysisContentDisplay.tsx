/**
 * AnalysisContentDisplay - Premium Markdown Analysis Display v2
 *
 * Renders analysis content with:
 * - Full markdown support (headers, bold, lists, blockquotes, tables, code)
 * - Clickable timecodes [MM:SS] with play icon
 * - Epistemic markers → premium callout cards (SOLIDE, PLAUSIBLE, INCERTAIN, A VERIFIER)
 * - Auto-emoji headers based on section keywords
 * - Streaming support with blinking cursor
 * - Copy-to-clipboard button
 * - Theme-aware dark-first design
 * - Professional typography (DM Sans + JetBrains Mono)
 */

import React, { useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  FadeIn,
  FadeInDown,
  SlideInUp,
  withSpring,
} from "react-native-reanimated";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius as br } from "../../theme/spacing";
import { fontFamily, fontSize, lineHeight } from "../../theme/typography";
import { palette } from "../../theme/colors";
import { AnalysisSkeleton } from "../ui/SkeletonLoader";

// ── Types ──────────────────────────────────────────────────────────────────

interface AnalysisContentDisplayProps {
  content?: string | null;
  onTimecodePress?: (seconds: number) => void;
  /** Streaming mode */
  isStreaming?: boolean;
  streamingText?: string;
  /** Loading / Error states */
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Legacy props — compat with old AnalysisScreen */
  showEmptyState?: boolean;
  emptyStateMessage?: string;
  /** ScrollView paddingBottom — défaut 120 (compat). Le parent (analysis/[id])
   *  peut injecter `useTabBarFootprint()` pour aligner avec la TabBar globale. */
  bottomPadding?: number;
}

// ── Epistemic Markers ──────────────────────────────────────────────────────

const EPISTEMIC_MARKERS: Record<
  string,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    emoji: string;
  }
> = {
  SOLIDE: {
    color: "#22C55E",
    bgColor: "rgba(34, 197, 94, 0.10)",
    borderColor: "rgba(34, 197, 94, 0.25)",
    icon: "checkmark-circle",
    label: "Établi",
    emoji: "✅",
  },
  PLAUSIBLE: {
    color: "#3B82F6",
    bgColor: "rgba(59, 130, 246, 0.10)",
    borderColor: "rgba(59, 130, 246, 0.25)",
    icon: "help-circle",
    label: "Probable",
    emoji: "🔵",
  },
  INCERTAIN: {
    color: "#F59E0B",
    bgColor: "rgba(245, 158, 11, 0.10)",
    borderColor: "rgba(245, 158, 11, 0.25)",
    icon: "alert-circle",
    label: "Incertain",
    emoji: "🟡",
  },
  "A VERIFIER": {
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    icon: "warning",
    label: "À vérifier",
    emoji: "🔴",
  },
  "À VÉRIFIER": {
    color: "#EF4444",
    bgColor: "rgba(239, 68, 68, 0.10)",
    borderColor: "rgba(239, 68, 68, 0.25)",
    icon: "warning",
    label: "À vérifier",
    emoji: "🔴",
  },
};

// ── Section emojis ─────────────────────────────────────────────────────────

const SECTION_EMOJIS: Record<string, string> = {
  résumé: "📝",
  summary: "📝",
  synthèse: "📝",
  introduction: "🎬",
  contexte: "🌍",
  context: "🌍",
  analyse: "🔬",
  analysis: "🔬",
  "points clés": "🎯",
  "key points": "🎯",
  "points forts": "💪",
  strengths: "💪",
  "points faibles": "⚠️",
  weaknesses: "⚠️",
  limites: "⚠️",
  conclusion: "🏁",
  recommandations: "💡",
  recommendations: "💡",
  sources: "📚",
  références: "📚",
  references: "📚",
  "fact-check": "🔍",
  vérification: "🔍",
  arguments: "⚖️",
  méthodologie: "🧪",
  methodology: "🧪",
  données: "📊",
  data: "📊",
  statistiques: "📊",
  opinion: "💬",
  avis: "💬",
  biais: "🎭",
  bias: "🎭",
  nuances: "🎨",
  perspectives: "👁️",
  timeline: "📅",
  chronologie: "📅",
  définitions: "📖",
  glossaire: "📖",
};

const TIMECODE_REGEX = /\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]/g;

const getHeaderEmoji = (text: string): string => {
  const lower = text
    .toLowerCase()
    .trim()
    .replace(/^#+\s*/, "");
  for (const [keyword, emoji] of Object.entries(SECTION_EMOJIS)) {
    if (lower.includes(keyword)) return emoji;
  }
  return "📌";
};

// ── BlinkingCursor ─────────────────────────────────────────────────────────

const BlinkingCursor: React.FC = () => {
  const opacity = useSharedValue(1);
  React.useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[
        {
          width: 2,
          height: 18,
          backgroundColor: palette.indigo,
          marginLeft: 2,
          borderRadius: 1,
        },
        style,
      ]}
    />
  );
};

// ── Component ──────────────────────────────────────────────────────────────

export const AnalysisContentDisplay: React.FC<AnalysisContentDisplayProps> = ({
  content,
  onTimecodePress,
  isStreaming = false,
  streamingText = "",
  isLoading = false,
  error,
  onRetry,
  showEmptyState = false,
  emptyStateMessage,
  bottomPadding = 120,
}) => {
  const { colors, isDark } = useTheme();
  const displayText = isStreaming ? streamingText : content || "";

  // ── Pre-process markdown ───────────────────────────────────────────────
  const processedContent = useMemo(() => {
    if (!displayText) return "";
    let processed = displayText;
    // [[concept]] → bold
    processed = processed.replace(/\[\[([^\]]+)\]\]/g, "**$1**");
    return processed;
  }, [displayText]);

  // ── Colors ─────────────────────────────────────────────────────────────
  const textColor = isDark ? "#FFFFFF" : colors.textPrimary;
  const emphasisColor = isDark ? "#E0E0F0" : colors.textSecondary;
  const subtleBg = isDark ? colors.bgCard : colors.bgSecondary;
  const borderFaint = colors.border;

  // ── Timecode parser ────────────────────────────────────────────────────
  const parseTimecodeToSeconds = (match: string): number => {
    const parts = match
      .replace(/[\[\]]/g, "")
      .split(":")
      .map(Number);
    return parts.length === 3
      ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts[0] * 60 + parts[1];
  };

  const renderTextWithTimecodes = (text: string) => {
    if (!text) return null;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;
    const regex = new RegExp(TIMECODE_REGEX.source, "g");
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`t-${key++}`} style={{ color: textColor }}>
            {text.slice(lastIndex, match.index)}
          </Text>,
        );
      }
      const seconds = parseTimecodeToSeconds(match[0]);
      parts.push(
        <Pressable
          key={`tc-${key++}`}
          onPress={() => {
            Haptics.selectionAsync();
            onTimecodePress?.(seconds);
          }}
          style={localStyles.timecodeBtn}
        >
          <Ionicons
            name="play"
            size={10}
            color="#60A5FA"
            style={{ marginRight: 3 }}
          />
          <Text style={localStyles.timecodeText}>
            {match[0].replace(/[\[\]]/g, "")}
          </Text>
        </Pressable>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(
        <Text key={`t-${key++}`} style={{ color: textColor }}>
          {text.slice(lastIndex)}
        </Text>,
      );
    }
    return parts.length > 0 ? parts : text;
  };

  // ── Epistemic callout (with subtle entrance animation) ─────────────────
  const renderEpistemicCallout = (marker: string) => {
    const config = EPISTEMIC_MARKERS[marker.toUpperCase()];
    if (!config) return null;
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[
          localStyles.epistemicCallout,
          {
            backgroundColor: config.bgColor,
            borderLeftColor: config.color,
            borderColor: config.borderColor,
          },
        ]}
      >
        <Text style={localStyles.epistemicEmoji}>{config.emoji}</Text>
        <Ionicons name={config.icon} size={14} color={config.color} />
        <Text style={[localStyles.epistemicLabel, { color: config.color }]}>
          {config.label}
        </Text>
      </Animated.View>
    );
  };

  // ── Markdown styles ────────────────────────────────────────────────────
  const markdownStyles = useMemo(
    () =>
      StyleSheet.create({
        body: {
          color: textColor,
          fontSize: fontSize.base,
          lineHeight: fontSize.base * lineHeight.relaxed,
          fontFamily: fontFamily.body,
        },
        heading1: {
          color: textColor,
          fontSize: fontSize["2xl"],
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp["2xl"],
          marginBottom: sp.lg,
          lineHeight: fontSize["2xl"] * lineHeight.snug,
          borderBottomWidth: 1,
          borderBottomColor: borderFaint,
          paddingBottom: sp.sm,
        },
        heading2: {
          color: textColor,
          fontSize: fontSize.xl,
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp.xl,
          marginBottom: sp.md,
          lineHeight: fontSize.xl * lineHeight.snug,
        },
        heading3: {
          color: isDark ? "#A5B4FC" : palette.indigo,
          fontSize: fontSize.lg,
          fontFamily: fontFamily.bodySemiBold,
          marginTop: sp.lg,
          marginBottom: sp.sm,
          lineHeight: fontSize.lg * lineHeight.snug,
        },
        paragraph: {
          color: textColor,
          fontSize: fontSize.base,
          lineHeight: fontSize.base * lineHeight.relaxed,
          marginBottom: sp.lg,
          fontFamily: fontFamily.body,
        },
        strong: {
          fontFamily: fontFamily.bodySemiBold,
          color: isDark ? "#F0F0FF" : colors.textPrimary,
        },
        em: {
          fontStyle: "italic",
          color: emphasisColor,
        },
        // Lists
        bullet_list: { marginBottom: sp.md, marginLeft: sp.xs },
        ordered_list: { marginBottom: sp.md, marginLeft: sp.xs },
        bullet_list_icon: {
          color: palette.violet,
          fontSize: 8,
          marginRight: sp.sm,
          marginTop: 10,
        },
        ordered_list_icon: {
          color: palette.violet,
          fontSize: fontSize.sm,
          fontFamily: fontFamily.bodySemiBold,
          marginRight: sp.sm,
        },
        list_item: {
          flexDirection: "row",
          marginBottom: sp.sm,
          color: textColor,
          paddingLeft: sp.xs,
        },
        bullet_list_content: { flex: 1, color: textColor },
        ordered_list_content: { flex: 1, color: textColor },
        // Text
        textgroup: { color: textColor },
        text: { color: textColor },
        softbreak: { color: textColor },
        hardbreak: { color: textColor },
        s: { color: emphasisColor, textDecorationLine: "line-through" },
        // Blockquote
        blockquote: {
          backgroundColor: isDark
            ? "rgba(139, 92, 246, 0.06)"
            : "rgba(139, 92, 246, 0.04)",
          borderLeftColor: palette.violet,
          borderLeftWidth: 3,
          paddingLeft: sp.lg,
          paddingRight: sp.md,
          paddingVertical: sp.md,
          marginVertical: sp.md,
          borderRadius: br.sm,
        },
        // Code
        code_inline: {
          backgroundColor: isDark
            ? "rgba(139, 92, 246, 0.12)"
            : "rgba(139, 92, 246, 0.08)",
          color: "#A78BFA",
          fontFamily: fontFamily.mono,
          fontSize: fontSize.sm,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 5,
        },
        code_block: {
          backgroundColor: isDark ? "rgba(0,0,0,0.35)" : colors.bgTertiary,
          padding: sp.md,
          borderRadius: br.md,
          marginVertical: sp.md,
          borderWidth: 1,
          borderColor: borderFaint,
          fontFamily: fontFamily.mono,
          fontSize: fontSize.sm,
        },
        fence: {
          backgroundColor: isDark ? "rgba(0,0,0,0.35)" : colors.bgTertiary,
          padding: sp.md,
          borderRadius: br.md,
          marginVertical: sp.md,
          borderWidth: 1,
          borderColor: borderFaint,
          fontFamily: fontFamily.mono,
          fontSize: fontSize.sm,
        },
        // Links
        link: { color: "#60A5FA", textDecorationLine: "underline" },
        // HR
        hr: {
          backgroundColor: borderFaint,
          height: 1,
          marginVertical: sp.xl,
        },
        // Table
        table: {
          borderWidth: 1,
          borderColor: borderFaint,
          borderRadius: br.md,
          marginVertical: sp.md,
          overflow: "hidden",
        },
        tr: {
          borderBottomWidth: 1,
          borderColor: borderFaint,
        },
        th: {
          backgroundColor: isDark
            ? "rgba(139, 92, 246, 0.08)"
            : "rgba(139, 92, 246, 0.05)",
          padding: sp.sm,
          fontFamily: fontFamily.bodySemiBold,
        },
        td: { padding: sp.sm },
        // Image
        image: {
          width: "100%" as any,
          borderRadius: br.md,
          marginVertical: sp.sm,
        },
      }),
    [textColor, emphasisColor, borderFaint, isDark, colors, subtleBg],
  );

  // ── Custom rules ───────────────────────────────────────────────────────
  const rules = useMemo(
    () => ({
      heading1: (node: any, children: any, _parent: any, styles: any) => {
        const rawText =
          node.children?.map((c: any) => c.content || "").join("") || "";
        const emoji = getHeaderEmoji(rawText);
        return (
          <View key={node.key}>
            <Text style={styles.heading1}>
              {emoji} {children}
            </Text>
          </View>
        );
      },
      heading2: (node: any, children: any, _parent: any, styles: any) => {
        const rawText =
          node.children?.map((c: any) => c.content || "").join("") || "";
        const emoji = getHeaderEmoji(rawText);
        return (
          <Text key={node.key} style={styles.heading2}>
            {emoji} {children}
          </Text>
        );
      },
      text: (node: any, _children: any, _parent: any, styles: any) => {
        const text: string = node.content;

        // Timecodes
        if (TIMECODE_REGEX.test(text)) {
          return (
            <Text key={node.key} style={styles.text}>
              {renderTextWithTimecodes(text)}
            </Text>
          );
        }

        // Epistemic markers
        for (const marker of Object.keys(EPISTEMIC_MARKERS)) {
          if (text.toUpperCase().includes(marker)) {
            const markerRegex = new RegExp(`\\[?(${marker})\\]?`, "gi");
            const parts = text.split(markerRegex);
            return (
              <Text key={node.key} style={styles.text}>
                {parts.map((part: string, idx: number) => {
                  if (EPISTEMIC_MARKERS[part.toUpperCase()]) {
                    return (
                      <React.Fragment key={`ep-${idx}`}>
                        {renderEpistemicCallout(part)}
                      </React.Fragment>
                    );
                  }
                  return (
                    <Text key={`txt-${idx}`} style={{ color: textColor }}>
                      {part}
                    </Text>
                  );
                })}
              </Text>
            );
          }
        }

        return (
          <Text key={node.key} style={[styles.text, { color: textColor }]}>
            {text}
          </Text>
        );
      },
    }),
    [textColor, onTimecodePress],
  );

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return <AnalysisSkeleton />;
  }

  // ── Error state ────────────────────────────────────────────────────────
  if (error) {
    return (
      <Animated.View
        style={localStyles.stateContainer}
        entering={FadeInDown.duration(400).springify()}
      >
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={colors.accentError}
        />
        <Text style={[localStyles.stateText, { color: colors.textSecondary }]}>
          {error}
        </Text>
        {onRetry && (
          <Pressable
            onPress={onRetry}
            style={[
              localStyles.retryBtn,
              { backgroundColor: colors.accentPrimary },
            ]}
            accessibilityLabel="Réessayer"
            accessibilityRole="button"
          >
            <Text style={localStyles.retryBtnText}>Réessayer</Text>
          </Pressable>
        )}
      </Animated.View>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (showEmptyState || !displayText) {
    return (
      <Animated.View
        style={localStyles.stateContainer}
        entering={FadeIn.duration(400)}
      >
        <Ionicons
          name="document-text-outline"
          size={48}
          color={colors.textMuted}
        />
        <Text style={[localStyles.stateText, { color: colors.textTertiary }]}>
          {emptyStateMessage || "Aucun contenu disponible"}
        </Text>
      </Animated.View>
    );
  }

  // ── Copy button animation ────────────────────────────────────────────
  const copyScale = useSharedValue(1);
  const copyAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: copyScale.value }],
  }));
  const handleCopyAnimated = useCallback(async () => {
    if (!displayText) return;
    copyScale.value = withSpring(0.9, { damping: 15, stiffness: 400 }, () => {
      copyScale.value = withSpring(1, { damping: 15, stiffness: 400 });
    });
    await Clipboard.setStringAsync(displayText);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [displayText, copyScale]);

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <Animated.View style={localStyles.wrapper} entering={FadeIn.duration(400)}>
      {/* Copy button */}
      <Animated.View
        style={[copyAnimStyle]}
        entering={FadeInDown.delay(200).duration(300)}
      >
        <Pressable
          onPress={handleCopyAnimated}
          style={[
            localStyles.copyBtn,
            { backgroundColor: colors.bgCard, borderColor: colors.border },
          ]}
          accessibilityLabel="Copier le résumé"
          accessibilityRole="button"
        >
          <Ionicons
            name="copy-outline"
            size={14}
            color={colors.textSecondary}
          />
          <Text
            style={[localStyles.copyLabel, { color: colors.textSecondary }]}
          >
            Copier
          </Text>
        </Pressable>
      </Animated.View>

      <ScrollView
        style={localStyles.scroll}
        contentContainerStyle={[localStyles.scrollContent, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.delay(100).duration(500).springify().damping(18)}
        >
          <Markdown style={markdownStyles} rules={rules}>
            {processedContent}
          </Markdown>

          {isStreaming && (
            <View style={localStyles.cursorRow}>
              <BlinkingCursor />
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────

const localStyles = StyleSheet.create({
  wrapper: { flex: 1 },
  // Copy button
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    paddingVertical: sp.xs,
    paddingHorizontal: sp.md,
    borderRadius: br.md,
    borderWidth: 1,
    marginBottom: sp.sm,
    marginRight: sp.lg,
  },
  copyLabel: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: sp.lg,
  },
  // Cursor
  cursorRow: {
    flexDirection: "row",
    marginTop: sp.xs,
  },
  // States
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: sp.md,
    paddingHorizontal: sp["3xl"],
  },
  stateText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: sp.md,
    paddingHorizontal: sp["2xl"],
    borderRadius: br.lg,
    marginTop: sp.sm,
  },
  retryBtnText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    color: "#ffffff",
  },
  // Timecodes
  timecodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.25)",
    backgroundColor: "rgba(59, 130, 246, 0.10)",
    marginHorizontal: 2,
  },
  timecodeText: {
    fontSize: 13,
    fontFamily: fontFamily.bodySemiBold,
    color: "#60A5FA",
  },
  // Epistemic callout
  epistemicCallout: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.md,
    paddingVertical: 6,
    borderRadius: br.sm,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginHorizontal: 2,
    marginVertical: 3,
    gap: 5,
  },
  epistemicEmoji: {
    fontSize: 12,
  },
  epistemicLabel: {
    fontSize: 11,
    fontFamily: fontFamily.bodySemiBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});

export default AnalysisContentDisplay;
