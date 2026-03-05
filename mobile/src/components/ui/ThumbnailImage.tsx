/**
 * ThumbnailImage — Composant robuste pour les thumbnails vidéo
 * Gère les fallbacks YouTube (maxres → hq → mq → sd) et un placeholder gris
 * quand aucune image n'est disponible.
 */

import React, { useState, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

interface ThumbnailImageProps {
  /** URL directe de la thumbnail (priority 1) */
  uri?: string | null;
  /** ID de la vidéo YouTube pour générer les fallbacks */
  videoId?: string | null;
  style?: any;
  contentFit?: 'cover' | 'contain' | 'fill';
  transition?: number;
}

/**
 * Génère une liste d'URLs YouTube ordonnée par qualité décroissante.
 * Si l'une fail (404), on passe à la suivante via onError.
 */
const getYouTubeFallbacks = (videoId: string): string[] => [
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
  `https://img.youtube.com/vi/${videoId}/default.jpg`,
];

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  uri,
  videoId,
  style,
  contentFit = 'cover',
  transition = 200,
}) => {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const urls = useMemo(() => {
    const list: string[] = [];
    // Priority 1: explicit URI
    if (uri && uri.length > 0) {
      list.push(uri);
    }
    // Priority 2: YouTube fallbacks from videoId
    if (videoId && videoId.length > 0 && videoId !== 'undefined') {
      list.push(...getYouTubeFallbacks(videoId));
    }
    return list;
  }, [uri, videoId]);

  const currentUrl = urls[fallbackIndex];

  const handleError = () => {
    if (fallbackIndex < urls.length - 1) {
      setFallbackIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  // No valid URL at all → show placeholder
  if (!currentUrl || hasError) {
    return (
      <View style={[style, styles.placeholder]}>
        <Ionicons name="image-outline" size={32} color="rgba(255,255,255,0.3)" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: currentUrl }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      onError={handleError}
      recyclingKey={currentUrl}
      cachePolicy="memory-disk"
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
