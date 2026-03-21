/**
 * TournesolRecommendations — Section de vidéos recommandées par Tournesol
 * Équivalent mobile de TournesolTrendingSection (Web)
 * Affiche un carousel horizontal de vidéos recommandées par la communauté
 * Click → lance l'analyse DeepSight de la vidéo
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { palette } from '@/theme/colors';

// Types Tournesol API
interface TournesolResult {
  entity: {
    uid: string;
    metadata: {
      name: string;
      video_id: string;
      uploader?: string;
      duration?: number;
      publication_date?: string;
      language?: string;
    };
  };
  collective_rating: {
    tournesol_score: number;
    n_comparisons: number;
    n_contributors: number;
    criteria_scores: { criteria: string; score: number }[];
  };
}

// API config — utilise le proxy backend (CORS)
const API_BASE = 'https://api.deepsightsynthesis.com';

interface Props {
  language?: 'fr' | 'en';
  limit?: number;
  /** Changer cette valeur force un re-fetch avec de nouvelles suggestions */
  refreshTrigger?: number;
}

// Pool total dans lequel on pioche aléatoirement
const POOL_SIZE = 200;

export function TournesolRecommendations({ language = 'fr', limit = 10, refreshTrigger = 0 }: Props) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [results, setResults] = useState<TournesolResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      // Offset aléatoire pour varier les suggestions à chaque chargement / pull-to-refresh
      const randomOffset = Math.floor(Math.random() * (POOL_SIZE - limit));
      const langParam = language === 'fr' ? '&metadata[language]=fr' : '';
      const url = `${API_BASE}/api/tournesol/recommendations/raw?limit=${limit}&offset=${randomOffset}${langParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      // Mélanger les résultats pour encore plus de variété
      const shuffled = (data.results || []).sort(() => Math.random() - 0.5);
      setResults(shuffled);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [language, limit, refreshTrigger]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleVideoPress = useCallback((videoId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/(tabs)/analysis/[id]',
      params: { id: `yt:${videoId}`, videoUrl: `https://www.youtube.com/watch?v=${videoId}` },
    } as any);
  }, [router]);

  const handleTournesolPress = useCallback(() => {
    Linking.openURL('https://tournesol.app');
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 50) return '#22c55e';
    if (score >= 20) return '#eab308';
    return colors.textTertiary;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={palette.yellow} />
      </View>
    );
  }

  if (error || results.length === 0) {
    return null; // Silently hide if no data
  }

  const renderCard = ({ item }: { item: TournesolResult }) => {
    const videoId = item.entity.metadata.video_id;
    const score = item.collective_rating.tournesol_score;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    return (
      <Pressable
        style={[styles.card, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}
        onPress={() => handleVideoPress(videoId)}
        accessibilityLabel={`Analyser: ${item.entity.metadata.name}`}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Image source={{ uri: thumbnail }} style={styles.thumbnail} contentFit="cover" />
          {/* Score badge */}
          <View style={[styles.scoreBadge, { backgroundColor: getScoreColor(score) + '20', borderColor: getScoreColor(score) + '40' }]}>
            <Text style={styles.sunflower}>{'\uD83C\uDF3B'}</Text>
            <Text style={[styles.scoreText, { color: getScoreColor(score) }]}>
              {score > 0 ? '+' : ''}{Math.round(score)}
            </Text>
          </View>
          {/* Duration */}
          {item.entity.metadata.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(item.entity.metadata.duration)}
              </Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.entity.metadata.name}
          </Text>
          <Text style={[styles.cardChannel, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.entity.metadata.uploader || 'YouTube'}
          </Text>
          <View style={styles.cardStats}>
            <Text style={[styles.cardStat, { color: colors.textMuted }]}>
              {item.collective_rating.n_contributors} {language === 'fr' ? 'votes' : 'votes'}
            </Text>
          </View>
        </View>

        {/* Analyze CTA */}
        <View style={[styles.analyzeCta, { backgroundColor: palette.indigo + '15' }]}>
          <Ionicons name="sparkles" size={12} color={palette.indigo} />
          <Text style={[styles.analyzeText, { color: palette.indigo }]}>
            {language === 'fr' ? 'Analyser' : 'Analyze'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.container}>
      {/* Header */}
      <Pressable style={styles.header} onPress={handleTournesolPress}>
        <View style={styles.headerLeft}>
          <Image
            source={require('@/assets/platforms/tournesol-logo.png')}
            style={styles.tournesolIcon}
            contentFit="contain"
          />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {language === 'fr' ? 'Recommandations Tournesol' : 'Tournesol Picks'}
          </Text>
        </View>
        <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
      </Pressable>
      <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
        {language === 'fr'
          ? 'Vidéos de qualité sélectionnées par la communauté'
          : 'Quality videos curated by the community'}
      </Text>

      {/* Horizontal carousel */}
      <FlatList
        data={results}
        renderItem={renderCard}
        keyExtractor={(item) => item.entity.uid}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={220}
        decelerationRate="fast"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: sp.xl,
  },
  loadingContainer: {
    paddingVertical: sp['2xl'],
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
  },
  tournesolIcon: {
    width: 22,
    height: 22,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
  },
  subtitle: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    marginBottom: sp.md,
  },
  list: {
    gap: sp.md,
    paddingRight: sp.lg,
  },
  card: {
    width: 200,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 200,
    height: 112,
  },
  scoreBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  sunflower: {
    fontSize: 10,
  },
  scoreText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  durationText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 10,
    color: '#fff',
  },
  cardInfo: {
    padding: sp.sm,
    gap: 2,
  },
  cardTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
  },
  cardChannel: {
    fontFamily: fontFamily.body,
    fontSize: 10,
  },
  cardStats: {
    flexDirection: 'row',
    gap: sp.sm,
    marginTop: 2,
  },
  cardStat: {
    fontFamily: fontFamily.body,
    fontSize: 10,
  },
  analyzeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    marginHorizontal: sp.sm,
    marginBottom: sp.sm,
    borderRadius: borderRadius.md,
  },
  analyzeText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 11,
  },
});
