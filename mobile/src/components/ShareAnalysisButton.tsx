/**
 * ShareAnalysisButton — Reusable share button for analyses
 * Uses React Native Share API to open native share sheet.
 */

import React, { useState, useCallback } from 'react';
import { TouchableOpacity, Share, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { shareApi } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface ShareAnalysisButtonProps {
  videoId: string;
  title?: string;
  verdict?: string;
  size?: number;
  color?: string;
  style?: object;
}

export const ShareAnalysisButton: React.FC<ShareAnalysisButtonProps> = React.memo(({
  videoId,
  title,
  verdict,
  size = 22,
  color,
  style,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const iconColor = color || colors.textTertiary;

  const handleShare = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { share_url } = await shareApi.createShareLink(videoId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const message = [
        title ? `\u{1F3AF} DeepSight \u2014 ${title}` : '\u{1F3AF} DeepSight Analysis',
        verdict ? `\u{1F4A1} ${verdict}` : '',
        '',
        `\u{1F517} ${share_url}`,
      ].filter(Boolean).join('\n');

      await Share.share({
        message,
        url: share_url, // iOS only
        title: title ? `DeepSight \u2014 ${title}` : 'DeepSight Analysis',
      });
    } catch (err: any) {
      // User cancelled is not an error
      if (err?.message !== 'User did not share') {
        Alert.alert('Error', 'Failed to create share link');
      }
    } finally {
      setLoading(false);
    }
  }, [videoId, title, verdict, loading]);

  return (
    <TouchableOpacity
      onPress={handleShare}
      disabled={loading}
      style={[styles.button, style]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel="Share analysis"
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name="share-outline" size={size} color={iconColor} />
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    padding: 4,
  },
});
