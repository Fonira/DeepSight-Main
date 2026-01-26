/**
 * TimecodeText - Composant pour afficher du texte avec des timecodes cliquables
 * Les timestamps au format [MM:SS] ou [HH:MM:SS] deviennent interactifs
 */

import React, { useMemo, useCallback } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  TextStyle,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { Typography } from '../../constants/theme';

// Regex pour capturer les timestamps
// Supporte: [2:34], [02:34], [1:02:34], (2:34), 2:34
const TIMESTAMP_REGEX = /(?:\[|\()?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?/g;

interface TimecodeTextProps {
  content: string;
  onTimecodePress: (seconds: number) => void;
  style?: TextStyle;
  timecodeStyle?: TextStyle;
  numberOfLines?: number;
}

interface TextPart {
  type: 'text' | 'timecode';
  content: string;
  seconds?: number;
}

export const TimecodeText: React.FC<TimecodeTextProps> = ({
  content,
  onTimecodePress,
  style,
  timecodeStyle,
  numberOfLines,
}) => {
  const { colors } = useTheme();

  // Parse le contenu et identifie les timecodes
  const parts = useMemo((): TextPart[] => {
    const result: TextPart[] = [];
    let lastIndex = 0;

    // Reset regex index
    TIMESTAMP_REGEX.lastIndex = 0;

    let match;
    while ((match = TIMESTAMP_REGEX.exec(content)) !== null) {
      // Ajouter le texte avant le timestamp
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Calculer les secondes
      const hours = match[3] ? parseInt(match[1], 10) : 0;
      const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;

      // Ajouter le timestamp
      result.push({
        type: 'timecode',
        content: match[0],
        seconds: totalSeconds,
      });

      lastIndex = match.index + match[0].length;
    }

    // Ajouter le texte restant
    if (lastIndex < content.length) {
      result.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    return result;
  }, [content]);

  const handleTimecodePress = useCallback((seconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTimecodePress(seconds);
  }, [onTimecodePress]);

  // Si pas de timecodes, rendre simplement le texte
  const hasTimecodes = parts.some(p => p.type === 'timecode');
  if (!hasTimecodes) {
    return (
      <Text style={[styles.text, style]} numberOfLines={numberOfLines}>
        {content}
      </Text>
    );
  }

  return (
    <Text style={[styles.text, style]} numberOfLines={numberOfLines}>
      {parts.map((part, index) => {
        if (part.type === 'timecode' && part.seconds !== undefined) {
          return (
            <Text
              key={index}
              style={[
                styles.timecode,
                { color: colors.accentPrimary, backgroundColor: `${colors.accentPrimary}15` },
                timecodeStyle,
              ]}
              onPress={() => handleTimecodePress(part.seconds!)}
            >
              {part.content}
            </Text>
          );
        }
        return (
          <Text key={index}>{part.content}</Text>
        );
      })}
    </Text>
  );
};

// Version avec rendu en blocs (pour les listes de chapitres)
interface TimecodeListItemProps {
  timestamp: string;
  title: string;
  onPress: (seconds: number) => void;
}

export const TimecodeListItem: React.FC<TimecodeListItemProps> = ({
  timestamp,
  title,
  onPress,
}) => {
  const { colors } = useTheme();

  // Parse le timestamp
  const seconds = useMemo(() => {
    const match = timestamp.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return 0;

    const hours = match[3] ? parseInt(match[1], 10) : 0;
    const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
    const secs = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
    return hours * 3600 + minutes * 60 + secs;
  }, [timestamp]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(seconds);
  }, [onPress, seconds]);

  return (
    <TouchableOpacity
      style={[styles.listItem, { backgroundColor: colors.bgElevated }]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.timestampBadge, { backgroundColor: `${colors.accentPrimary}20` }]}>
        <Text style={[styles.timestampText, { color: colors.accentPrimary }]}>
          {timestamp}
        </Text>
      </View>
      <Text style={[styles.titleText, { color: colors.textPrimary }]} numberOfLines={2}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

// Utilitaire pour formater les secondes en timestamp
export const formatTimestamp = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Utilitaire pour parser un timestamp en secondes
export const parseTimestamp = (timestamp: string): number => {
  const match = timestamp.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return 0;

  const hours = match[3] ? parseInt(match[1], 10) : 0;
  const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
  return hours * 3600 + minutes * 60 + seconds;
};

const styles = StyleSheet.create({
  text: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    lineHeight: Typography.fontSize.base * 1.6,
  },
  timecode: {
    fontFamily: Typography.fontFamily.bodyMedium,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
    gap: 12,
  },
  timestampBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  timestampText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
    fontVariant: ['tabular-nums'],
  },
  titleText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
  },
});

export default TimecodeText;
