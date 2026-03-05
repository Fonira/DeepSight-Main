import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { BorderRadius, Typography } from '../../constants/theme';
import type { VideoPlatform } from '../../types';

// HD official logos — loaded via require for reliable bundling
const YOUTUBE_ICON_RED = require('@/assets/platforms/youtube-icon-red.png');
const TIKTOK_NOTE_COLOR = require('@/assets/platforms/tiktok-note-color.png');
const TIKTOK_NOTE_WHITE = require('@/assets/platforms/tiktok-note-white.png');

interface PlatformBadgeProps {
  platform?: VideoPlatform;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  /** When true, uses a solid dark background for visibility on thumbnails */
  overlay?: boolean;
  style?: ViewStyle;
}

const PLATFORM_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  youtube: {
    label: 'YouTube',
    color: '#FF0000',
    bgColor: 'rgba(255, 0, 0, 0.15)',
    borderColor: 'rgba(255, 0, 0, 0.30)',
  },
  tiktok: {
    label: 'TikTok',
    color: '#25F4EE',
    bgColor: 'rgba(37, 244, 238, 0.15)',
    borderColor: 'rgba(37, 244, 238, 0.30)',
  },
};

// Image sizes tuned per badge size — YouTube is wider (16:11 ratio), TikTok is square-ish
const SIZE_MAP = {
  xs: { yt: { w: 16, h: 12 }, tt: { w: 13, h: 13 }, fontSize: 9, pv: 3, ph: 6, gap: 3 },
  sm: { yt: { w: 20, h: 14 }, tt: { w: 16, h: 16 }, fontSize: 10, pv: 4, ph: 8, gap: 4 },
  md: { yt: { w: 26, h: 18 }, tt: { w: 20, h: 20 }, fontSize: 12, pv: 5, ph: 10, gap: 5 },
} as const;

export const PlatformBadge: React.FC<PlatformBadgeProps> = ({
  platform = 'youtube',
  size = 'sm',
  showLabel = true,
  overlay = false,
  style,
}) => {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.youtube;
  const s = SIZE_MAP[size];

  const backgroundColor = overlay ? 'rgba(0, 0, 0, 0.75)' : config.bgColor;
  const borderColor = overlay ? 'rgba(255, 255, 255, 0.20)' : config.borderColor;

  // Pick the right image source
  const isYoutube = platform === 'youtube';
  const imageSource = isYoutube
    ? YOUTUBE_ICON_RED
    : (overlay ? TIKTOK_NOTE_WHITE : TIKTOK_NOTE_COLOR);
  const imgSize = isYoutube ? s.yt : s.tt;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor,
          borderColor,
          paddingVertical: s.pv,
          paddingHorizontal: s.ph,
        },
        style,
      ]}
    >
      <Image
        source={imageSource}
        style={{ width: imgSize.w, height: imgSize.h }}
        contentFit="contain"
      />
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: overlay ? '#FFFFFF' : config.color,
              fontSize: s.fontSize,
              marginLeft: s.gap,
            },
          ]}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
};

/**
 * Détecte la plateforme à partir de l'URL ou du videoId
 */
export const detectPlatformFromUrl = (url?: string, videoId?: string): VideoPlatform => {
  if (!url && !videoId) return 'youtube';
  const text = url || videoId || '';
  if (
    text.includes('tiktok.com') ||
    text.includes('vm.tiktok') ||
    text.includes('m.tiktok')
  ) {
    return 'tiktok';
  }
  // Les video IDs TikTok sont des longs nombres (>15 chiffres)
  if (/^\d{15,}$/.test(text)) return 'tiktok';
  return 'youtube';
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: Typography.fontFamily.bodySemiBold,
    letterSpacing: 0.3,
  },
});

export default PlatformBadge;
