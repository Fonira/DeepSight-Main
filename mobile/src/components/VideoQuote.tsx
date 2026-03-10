/**
 * VideoQuote — Styled blockquote for video citations
 *
 * Design: indigo 3px left border + subtle surface bg + quote icon
 * Used to display notable quotes from video transcripts.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { useTheme } from '../contexts/ThemeContext';
import { palette } from '../theme/colors';
import { sp, borderRadius } from '../theme/spacing';
import { fontFamily, fontSize } from '../theme/typography';

interface VideoQuoteProps {
  /** The quoted text */
  text: string;
  /** Optional timestamp label (e.g. "2:34") */
  timestamp?: string;
  /** Animation delay index */
  index?: number;
}

export const VideoQuote: React.FC<VideoQuoteProps> = ({
  text,
  timestamp,
  index = 0,
}) => {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInLeft.delay(index * 80).duration(300).springify()}
      style={[
        styles.container,
        {
          backgroundColor: `${palette.indigo}08`,
          borderLeftColor: palette.indigo,
        },
      ]}
    >
      <Ionicons
        name="chatbubble-outline"
        size={14}
        color={`${palette.indigo}80`}
        style={styles.quoteIcon}
      />

      <View style={styles.content}>
        <Text
          style={[
            styles.text,
            { color: colors.textPrimary },
          ]}
        >
          {text}
        </Text>

        {timestamp && (
          <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
            {timestamp}
          </Text>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    marginVertical: sp.xs,
  },
  quoteIcon: {
    marginRight: sp.sm,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  text: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    fontStyle: 'italic',
    lineHeight: fontSize.sm * 1.5,
  },
  timestamp: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginTop: sp.xs,
    alignSelf: 'flex-end',
  },
});

export default VideoQuote;
