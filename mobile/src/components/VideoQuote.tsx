/**
 * VideoQuote — Styled blockquote for video citations
 *
 * Design: indigo (#6366f1) 3px left border + subtle surface background
 * + guillemets icon (French-style quotation marks).
 * Used to display notable quotes from video transcripts.
 */

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, { FadeInLeft } from "react-native-reanimated";
import { useTheme } from "@/contexts/ThemeContext";
import { palette } from "@/theme/colors";
import { sp, borderRadius } from "@/theme/spacing";
import { fontFamily, fontSize, lineHeight } from "@/theme/typography";

interface VideoQuoteProps {
  /** The quoted text */
  text: string;
  /** Optional timestamp label (e.g. "2:34") */
  timestamp?: string;
  /** Optional speaker / source attribution */
  speaker?: string;
  /** Animation delay index */
  index?: number;
}

const INDIGO = palette.indigo;
/** Slightly transparent indigo for backgrounds */
const INDIGO_BG_DARK = `${INDIGO}12`;
const INDIGO_BG_LIGHT = `${INDIGO}0A`;
const INDIGO_MUTED = `${INDIGO}60`;

export const VideoQuote: React.FC<VideoQuoteProps> = ({
  text,
  timestamp,
  speaker,
  index = 0,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <Animated.View
      entering={FadeInLeft.delay(index * 80)
        .duration(300)
        .springify()}
      style={[
        styles.container,
        {
          backgroundColor: isDark ? INDIGO_BG_DARK : INDIGO_BG_LIGHT,
          borderLeftColor: INDIGO,
        },
      ]}
    >
      {/* Guillemets icon */}
      <Text style={[styles.guillemets, { color: INDIGO_MUTED }]}>
        {"\u00AB"}
      </Text>

      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.textPrimary }]}>{text}</Text>

        {/* Footer: speaker and/or timestamp */}
        {(speaker || timestamp) && (
          <View style={styles.footer}>
            {speaker && (
              <Text style={[styles.speaker, { color: INDIGO_MUTED }]}>
                {speaker}
              </Text>
            )}
            {speaker && timestamp && (
              <Text style={[styles.separator, { color: colors.textMuted }]}>
                {" \u2022 "}
              </Text>
            )}
            {timestamp && (
              <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                {timestamp}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Closing guillemets at bottom-right for visual balance */}
      <Text style={[styles.guillemetsClose, { color: INDIGO_MUTED }]}>
        {"\u00BB"}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    paddingLeft: sp.md,
    paddingRight: sp.lg,
    paddingVertical: sp.md,
    marginVertical: sp.sm,
    position: "relative",
  },
  guillemets: {
    fontFamily: fontFamily.display,
    fontSize: fontSize["2xl"],
    lineHeight: fontSize["2xl"] * lineHeight.tight,
    marginRight: sp.sm,
    marginTop: -2,
    opacity: 0.8,
  },
  guillemetsClose: {
    fontFamily: fontFamily.display,
    fontSize: fontSize.lg,
    lineHeight: fontSize.lg * lineHeight.tight,
    alignSelf: "flex-end",
    marginLeft: sp.xs,
    marginBottom: -2,
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  text: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    fontStyle: "italic",
    lineHeight: fontSize.sm * lineHeight.relaxed,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: sp.sm,
  },
  speaker: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
  },
  separator: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  timestamp: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.xs,
  },
});

export default VideoQuote;
