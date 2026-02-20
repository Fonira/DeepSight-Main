import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useTheme } from '@/contexts/ThemeContext';
import { historyApi, playlistApi } from '@/services/api';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';
import { formatRelativeDate as formatDate } from '@/utils/formatDate';

interface PlaylistItem {
  id: string;
  name: string;
  video_count: number;
  created_at: string;
  thumbnail_urls: string[];
}

interface PlaylistDetailData {
  id: string;
  name: string;
  videos: Array<{
    summary_id: number;
    title: string;
    channel: string;
    thumbnail_url: string;
    duration: number;
    status: string;
  }>;
  meta_analysis: string | null;
  total_videos: number;
  created_at: string;
}

export const PlaylistSection: React.FC = () => {
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch playlist history
  const { data, isLoading, error } = useQuery({
    queryKey: ['playlist-history'],
    queryFn: () => historyApi.getPlaylistHistory(1, 50),
    staleTime: 5 * 60 * 1000,
  });

  const playlists = data?.items ?? [];

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={palette.indigo} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>
          Chargement des playlists...
        </Text>
      </View>
    );
  }

  if (error || playlists.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="albums-outline" size={32} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Aucune playlist analysée
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
          Analyse des playlists sur la version web pour les retrouver ici
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {playlists.map((playlist) => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          isExpanded={expandedId === playlist.id}
          onToggle={() =>
            setExpandedId((prev) => (prev === playlist.id ? null : playlist.id))
          }
        />
      ))}
    </View>
  );
};

// ──────────────────────────────────────────────
// Playlist Card (expandable)
// ──────────────────────────────────────────────

interface PlaylistCardProps {
  playlist: PlaylistItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  isExpanded,
  onToggle,
}) => {
  const { colors } = useTheme();

  // Fetch detail only when expanded
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['playlist-detail', playlist.id],
    queryFn: async () => {
      const res = await playlistApi.getPlaylist(playlist.id);
      return res as unknown as PlaylistDetailData;
    },
    enabled: isExpanded,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bgSecondary, borderColor: colors.border },
      ]}
    >
      {/* Card Header */}
      <Pressable
        onPress={onToggle}
        style={styles.cardHeader}
        accessibilityLabel={`Playlist ${playlist.name}`}
        accessibilityState={{ expanded: isExpanded }}
      >
        {/* Thumbnails mosaic */}
        <View style={styles.mosaic}>
          {playlist.thumbnail_urls.slice(0, 4).map((url, i) => (
            <Image
              key={i}
              source={{ uri: url }}
              style={styles.mosaicThumb}
              contentFit="cover"
              transition={150}
            />
          ))}
          {playlist.thumbnail_urls.length === 0 && (
            <View
              style={[styles.mosaicPlaceholder, { backgroundColor: colors.bgTertiary }]}
            >
              <Ionicons name="albums" size={24} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <Text
            style={[styles.cardTitle, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {playlist.name}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {playlist.video_count} vidéo{playlist.video_count > 1 ? 's' : ''}
            </Text>
            <Text style={[styles.metaDot, { color: colors.textMuted }]}>·</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {formatDate(playlist.created_at)}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </Pressable>

      {/* Expanded Detail */}
      {isExpanded && (
        <View style={[styles.detail, { borderTopColor: colors.border }]}>
          {detailLoading ? (
            <View style={styles.detailLoading}>
              <ActivityIndicator size="small" color={palette.indigo} />
            </View>
          ) : detail ? (
            <>
              {/* Meta analysis excerpt */}
              {detail.meta_analysis && (
                <View
                  style={[
                    styles.metaAnalysis,
                    { backgroundColor: colors.bgTertiary },
                  ]}
                >
                  <View style={styles.metaAnalysisHeader}>
                    <Ionicons name="sparkles" size={14} color={palette.indigo} />
                    <Text
                      style={[styles.metaAnalysisLabel, { color: palette.indigo }]}
                    >
                      Méta-analyse
                    </Text>
                  </View>
                  <Text
                    style={[styles.metaAnalysisText, { color: colors.textSecondary }]}
                    numberOfLines={6}
                  >
                    {detail.meta_analysis}
                  </Text>
                </View>
              )}

              {/* Videos list */}
              <Text style={[styles.videosLabel, { color: colors.textSecondary }]}>
                Vidéos analysées ({detail.videos?.length ?? 0})
              </Text>
              {(detail.videos || []).map((video, index) => (
                <View
                  key={video.summary_id || index}
                  style={[
                    styles.videoRow,
                    { borderBottomColor: colors.border },
                    index === (detail.videos?.length ?? 0) - 1 && styles.videoRowLast,
                  ]}
                >
                  <Image
                    source={{ uri: video.thumbnail_url }}
                    style={styles.videoThumb}
                    contentFit="cover"
                    transition={150}
                  />
                  <View style={styles.videoInfo}>
                    <Text
                      style={[styles.videoTitle, { color: colors.textPrimary }]}
                      numberOfLines={2}
                    >
                      {video.title}
                    </Text>
                    <Text
                      style={[styles.videoChannel, { color: colors.textTertiary }]}
                      numberOfLines={1}
                    >
                      {video.channel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          video.status === 'completed'
                            ? palette.green + '20'
                            : colors.bgTertiary,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        video.status === 'completed'
                          ? 'checkmark-circle'
                          : 'time-outline'
                      }
                      size={12}
                      color={
                        video.status === 'completed'
                          ? palette.green
                          : colors.textMuted
                      }
                    />
                  </View>
                </View>
              ))}

              {/* Read-only notice */}
              <View style={[styles.readOnlyNotice, { backgroundColor: colors.bgTertiary }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.readOnlyText, { color: colors.textMuted }]}>
                  L'analyse de playlists est disponible sur la version web
                </Text>
              </View>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: sp.sm,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sp.xl,
    gap: sp.sm,
  },
  loadingText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: sp['2xl'],
    gap: sp.sm,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.base,
  },
  emptySubtext: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: sp.xl,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.md,
    gap: sp.md,
  },
  mosaic: {
    width: 56,
    height: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    gap: 1,
  },
  mosaicThumb: {
    width: 27,
    height: 27,
  },
  mosaicPlaceholder: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.base,
    lineHeight: 20,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
  },
  metaDot: {
    fontSize: fontSize.xs,
  },
  detail: {
    borderTopWidth: 1,
    padding: sp.md,
    gap: sp.md,
  },
  detailLoading: {
    paddingVertical: sp.lg,
    alignItems: 'center',
  },
  metaAnalysis: {
    padding: sp.md,
    borderRadius: borderRadius.md,
    gap: sp.sm,
  },
  metaAnalysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.xs,
  },
  metaAnalysisLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
  },
  metaAnalysisText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  videosLabel: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
  },
  videoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sp.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: sp.sm,
  },
  videoRowLast: {
    borderBottomWidth: 0,
  },
  videoThumb: {
    width: 64,
    height: 36,
    borderRadius: borderRadius.sm,
  },
  videoInfo: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  videoChannel: {
    fontFamily: fontFamily.body,
    fontSize: 10,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: sp.sm,
    borderRadius: borderRadius.sm,
    gap: sp.xs,
  },
  readOnlyText: {
    fontFamily: fontFamily.body,
    fontSize: fontSize.xs,
    flex: 1,
  },
});

export default PlaylistSection;
