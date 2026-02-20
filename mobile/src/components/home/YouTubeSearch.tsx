import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAnalysisStore } from '@/stores/analysisStore';
import { videoApi } from '@/services/api';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize, textStyles } from '@/theme/typography';

interface VideoResult {
  video_id: string;
  title: string;
  channel: string;
  thumbnail_url: string;
  duration: number;
  view_count: number;
  quality_score: number;
  tournesol_score: number;
  published_at: string | null;
  is_tournesol_pick: boolean;
}

interface YouTubeSearchProps {
  onOptionsPress: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M vues`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K vues`;
  return `${count} vues`;
}

export const YouTubeSearch: React.FC<YouTubeSearchProps> = ({ onOptionsPress }) => {
  const { colors } = useTheme();
  const options = useAnalysisStore((s) => s.options);
  const startAnalysisAction = useAnalysisStore((s) => s.startAnalysis);
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || isSearching) return;

    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const response = await videoApi.discoverSearch(trimmed, {
        limit: 20,
        language: options.language || 'fr,en',
        sort_by: 'quality',
      });
      setResults(response.videos || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur de recherche';
      setError(message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, isSearching, options.language]);

  const handleAnalyze = useCallback(async (video: VideoResult) => {
    if (analyzingId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzingId(video.video_id);
    setError(null);

    try {
      const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
      const response = await videoApi.analyze({
        url: videoUrl,
        mode: options.mode,
        language: options.language,
        model: 'mistral',
        category: 'auto',
      });

      const taskId = response.task_id;
      if (!taskId) throw new Error('Pas de task_id retourné');

      startAnalysisAction(taskId);
      router.push({
        pathname: '/(tabs)/analysis/[id]',
        params: { id: taskId },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'analyse";
      setError(message);
    } finally {
      setAnalyzingId(null);
    }
  }, [analyzingId, options, startAnalysisAction]);

  const renderResult = useCallback(({ item }: { item: VideoResult }) => {
    const isAnalyzing = analyzingId === item.video_id;

    return (
      <Pressable
        onPress={() => handleAnalyze(item)}
        disabled={!!analyzingId}
        style={({ pressed }) => [
          styles.resultCard,
          {
            backgroundColor: colors.bgSecondary,
            borderColor: colors.border,
            opacity: pressed ? 0.7 : analyzingId && !isAnalyzing ? 0.5 : 1,
          },
        ]}
        accessibilityLabel={`Analyser ${item.title}`}
      >
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.thumbnail}
            contentFit="cover"
            transition={200}
          />
          {item.duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(item.duration)}
              </Text>
            </View>
          )}
          {item.is_tournesol_pick && (
            <View style={[styles.tournesolBadge, { backgroundColor: palette.amber }]}>
              <Text style={styles.tournesolText}>🌻</Text>
            </View>
          )}
          {isAnalyzing && (
            <View style={styles.analyzingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
              <Text style={styles.analyzingText}>Analyse...</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.resultInfo}>
          <Text
            style={[styles.resultTitle, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          <Text
            style={[styles.resultChannel, { color: colors.textTertiary }]}
            numberOfLines={1}
          >
            {item.channel}
          </Text>
          <View style={styles.resultMeta}>
            {item.view_count > 0 && (
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatViews(item.view_count)}
              </Text>
            )}
            {item.quality_score > 0 && (
              <View style={[styles.scoreBadge, { backgroundColor: colors.bgTertiary }]}>
                <Ionicons name="star" size={10} color={palette.amber} />
                <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
                  {item.quality_score}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Analyze arrow */}
        <View style={styles.analyzeArrow}>
          <Ionicons name="arrow-forward-circle" size={28} color={palette.indigo} />
        </View>
      </Pressable>
    );
  }, [analyzingId, colors, handleAnalyze]);

  return (
    <View style={styles.wrapper}>
      {/* Search bar */}
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor: colors.glassBg,
            borderColor: query.length > 0 ? palette.indigo : colors.glassBorder,
          },
        ]}
      >
        <Ionicons
          name="search-outline"
          size={20}
          color={query.length > 0 ? palette.indigo : colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Rechercher une vidéo YouTube..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          accessibilityLabel="Recherche YouTube"
        />
        {query.length > 0 && (
          <Pressable
            onPress={() => {
              setQuery('');
              setResults([]);
              setHasSearched(false);
              setError(null);
            }}
            style={styles.clearButton}
            accessibilityLabel="Effacer la recherche"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={handleSearch}
          disabled={!query.trim() || isSearching}
          style={[
            styles.searchButton,
            {
              backgroundColor: query.trim() ? palette.indigo : colors.bgTertiary,
            },
          ]}
          accessibilityLabel="Lancer la recherche"
        >
          {isSearching ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons
              name="search"
              size={18}
              color={query.trim() ? '#ffffff' : colors.textMuted}
            />
          )}
        </Pressable>
      </View>

      {/* Options link */}
      <Pressable onPress={onOptionsPress} style={styles.optionsLink}>
        <Text style={[styles.optionsText, { color: colors.textTertiary }]}>
          Options avancées
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </Pressable>

      {/* Error */}
      {error && (
        <Text style={[styles.error, { color: colors.accentError }]}>{error}</Text>
      )}

      {/* Info gratuit */}
      {!hasSearched && (
        <View style={[styles.infoBanner, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={16} color={palette.indigo} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            La recherche est gratuite et ne consomme pas de crédits
          </Text>
        </View>
      )}

      {/* Results */}
      {hasSearched && results.length === 0 && !isSearching && !error && (
        <View style={styles.emptyState}>
          <Ionicons name="videocam-off-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Aucune vidéo trouvée
          </Text>
        </View>
      )}

      {results.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {results.length} résultat{results.length > 1 ? 's' : ''}
          </Text>
          <Text style={[styles.resultsTip, { color: colors.textMuted }]}>
            Appuie pour analyser
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.video_id}
        renderItem={renderResult}
        scrollEnabled={false}
        contentContainerStyle={styles.resultsList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: sp.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingLeft: sp.md,
    minHeight: 52,
    overflow: 'hidden',
  },
  searchIcon: {
    marginRight: sp.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamily.body,
    fontSize: fontSize.base,
    paddingVertical: sp.md,
  },
  clearButton: {
    padding: sp.sm,
  },
  searchButton: {
    width: 48,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sp.sm,
    alignSelf: 'flex-start',
  },
  optionsText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.sm,
    marginRight: sp.xs,
  },
  error: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    marginTop: sp.sm,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: sp.md,
    gap: sp.sm,
  },
  infoText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: sp['2xl'],
    gap: sp.sm,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sp.lg,
    marginBottom: sp.sm,
  },
  resultsCount: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  resultsTip: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  resultsList: {
    gap: sp.sm,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  thumbnailContainer: {
    width: 120,
    height: 68,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  durationText: {
    color: '#ffffff',
    fontFamily: fontFamily.mono,
    fontSize: 10,
  },
  tournesolBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tournesolText: {
    fontSize: 10,
  },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  analyzingText: {
    color: '#ffffff',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
  },
  resultInfo: {
    flex: 1,
    marginLeft: sp.sm,
    gap: 2,
  },
  resultTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    lineHeight: 18,
  },
  resultChannel: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    marginTop: 2,
  },
  metaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 3,
  },
  scoreText: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: 10,
  },
  analyzeArrow: {
    marginLeft: sp.sm,
  },
});

export default YouTubeSearch;
