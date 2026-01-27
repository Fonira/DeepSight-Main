import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { videoApi } from '../services/api';
import { Colors, Spacing, BorderRadius, Typography } from '../constants/theme';
import { Badge } from './ui';

interface DiscoveredVideo {
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  duration: number;
  views: number;
  published_at: string;
  quality_score?: number;
  tournesol_score?: number;
}

interface VideoDiscoveryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectVideo: (videoId: string, videoUrl: string) => void;
  onSelectMultiple?: (videos: DiscoveredVideo[]) => void;
  allowMultiSelect?: boolean;
  initialQuery?: string;
}

type SortOption = 'quality' | 'views' | 'date' | 'academic';

export const VideoDiscoveryModal: React.FC<VideoDiscoveryModalProps> = ({
  visible,
  onClose,
  onSelectVideo,
  onSelectMultiple,
  allowMultiSelect = false,
  initialQuery = '',
}) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const isEn = language === 'en';

  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<DiscoveredVideo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('quality');

  const sortOptions: { id: SortOption; label: string; labelEn: string }[] = [
    { id: 'quality', label: 'Qualité', labelEn: 'Quality' },
    { id: 'views', label: 'Vues', labelEn: 'Views' },
    { id: 'date', label: 'Date', labelEn: 'Date' },
    { id: 'academic', label: 'Académique', labelEn: 'Academic' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setSearchError(null);
    try {
      const response = await videoApi.discoverBest(searchQuery, {
        limit: 20,
        language,
        sort_by: sortBy,
      });
      // Map API response to DiscoveredVideo format
      const mappedVideos: DiscoveredVideo[] = (response.videos || []).map(v => ({
        video_id: (v as any).video_id || (v as any).id || '',
        title: v.title || '',
        channel: (v as any).channel || (v as any).channel_name || '',
        thumbnail: (v as any).thumbnail || (v as any).thumbnail_url || '',
        duration: (v as any).duration || 0,
        views: (v as any).views || (v as any).view_count || 0,
        published_at: (v as any).published_at || (v as any).publish_date || '',
        quality_score: v.quality_score,
        tournesol_score: (v as any).tournesol_score,
      }));
      setVideos(mappedVideos);
    } catch (error) {
      console.error('Failed to search videos:', error);
      setSearchError(isEn ? 'Failed to search videos. Please try again.' : 'Échec de la recherche. Veuillez réessayer.');
      setVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() && visible) {
      const debounce = setTimeout(handleSearch, 500);
      return () => clearTimeout(debounce);
    }
  }, [searchQuery, sortBy, visible]);

  // Auto-populate search query when modal opens with initialQuery
  useEffect(() => {
    if (visible && initialQuery && initialQuery.trim()) {
      setSearchQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const handleSelectVideo = (video: DiscoveredVideo) => {
    Haptics.selectionAsync();

    if (allowMultiSelect) {
      setSelectedVideos(prev => {
        if (prev.includes(video.video_id)) {
          return prev.filter(id => id !== video.video_id);
        }
        return [...prev, video.video_id];
      });
    } else {
      const url = `https://youtube.com/watch?v=${video.video_id}`;
      onSelectVideo(video.video_id, url);
      onClose();
    }
  };

  const handleConfirmMultiple = () => {
    if (onSelectMultiple) {
      const selected = videos.filter(v => selectedVideos.includes(v.video_id));
      onSelectMultiple(selected);
    }
    onClose();
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const getQualityColor = (score: number): string => {
    if (score >= 80) return Colors.accentSuccess;
    if (score >= 60) return '#84CC16';
    if (score >= 40) return Colors.accentWarning;
    return Colors.accentError;
  };

  const renderVideoItem = ({ item }: { item: DiscoveredVideo }) => {
    const isSelected = selectedVideos.includes(item.video_id);

    return (
      <TouchableOpacity
        style={[
          styles.videoItem,
          { backgroundColor: colors.bgElevated },
          isSelected && { borderColor: colors.accentPrimary, borderWidth: 2 },
        ]}
        onPress={() => handleSelectVideo(item)}
      >
        {allowMultiSelect && (
          <View style={[styles.checkbox, isSelected && { backgroundColor: colors.accentPrimary }]}>
            {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          </View>
        )}

        <View style={styles.thumbnailContainer}>
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.thumbnail}
            contentFit="cover"
          />
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
          </View>
        </View>

        <View style={styles.videoInfo}>
          <Text style={[styles.videoTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={[styles.channelName, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.channel}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.viewsText, { color: colors.textTertiary }]}>
              {formatViews(item.views)} {isEn ? 'views' : 'vues'}
            </Text>

            {item.quality_score !== undefined && (
              <View style={[styles.scoreBadge, { backgroundColor: getQualityColor(item.quality_score) + '20' }]}>
                <Ionicons name="star" size={10} color={getQualityColor(item.quality_score)} />
                <Text style={[styles.scoreText, { color: getQualityColor(item.quality_score) }]}>
                  {item.quality_score}
                </Text>
              </View>
            )}

            {item.tournesol_score !== undefined && item.tournesol_score > 0 && (
              <View style={[styles.scoreBadge, { backgroundColor: Colors.accentSecondary + '20' }]}>
                <Text style={[styles.scoreText, { color: Colors.accentSecondary }]}>
                  T:{item.tournesol_score}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: isDark ? Colors.bgSecondary : Colors.light.bgPrimary }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isEn ? 'Discover Videos' : 'Découvrir des vidéos'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={[styles.searchContainer, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={isEn ? 'Search topic or keywords...' : 'Rechercher un sujet ou mots-clés...'}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort Options */}
          <View style={styles.sortContainer}>
            <Text style={[styles.sortLabel, { color: colors.textSecondary }]}>
              {isEn ? 'Sort by:' : 'Trier par:'}
            </Text>
            <View style={styles.sortOptions}>
              {sortOptions.map(option => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.sortChip,
                    { backgroundColor: sortBy === option.id ? colors.accentPrimary : colors.bgElevated },
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSortBy(option.id);
                  }}
                >
                  <Text style={[
                    styles.sortChipText,
                    { color: sortBy === option.id ? '#FFFFFF' : colors.textSecondary },
                  ]}>
                    {isEn ? option.labelEn : option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Error Message */}
          {searchError && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color={Colors.accentError} />
              <Text style={[styles.errorText, { color: Colors.accentError }]}>{searchError}</Text>
              <TouchableOpacity onPress={handleSearch} style={styles.retryButton}>
                <Text style={[styles.retryText, { color: colors.accentPrimary }]}>
                  {isEn ? 'Retry' : 'Réessayer'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accentPrimary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {isEn ? 'Searching quality videos...' : 'Recherche de vidéos de qualité...'}
              </Text>
            </View>
          ) : !searchError && (
            <FlatList
              data={videos}
              renderItem={renderVideoItem}
              keyExtractor={item => item.video_id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                searchQuery.trim() ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {isEn ? 'No videos found' : 'Aucune vidéo trouvée'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="videocam-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {isEn ? 'Search for a topic to discover quality videos' : 'Recherchez un sujet pour découvrir des vidéos de qualité'}
                    </Text>
                  </View>
                )
              }
            />
          )}

          {/* Multi-select Footer */}
          {allowMultiSelect && selectedVideos.length > 0 && (
            <View style={[styles.footer, { backgroundColor: colors.bgElevated, borderTopColor: colors.border }]}>
              <Text style={[styles.selectedCount, { color: colors.textPrimary }]}>
                {selectedVideos.length} {isEn ? 'selected' : 'sélectionnée(s)'}
              </Text>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.accentPrimary }]}
                onPress={handleConfirmMultiple}
              >
                <Text style={styles.confirmButtonText}>
                  {isEn ? 'Add to Playlist' : 'Ajouter à la playlist'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '90%',
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingTop: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.fontSize.xl,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    paddingVertical: Spacing.md,
  },
  sortContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  sortLabel: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginBottom: Spacing.xs,
  },
  sortOptions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  sortChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  sortChipText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#888',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: 100,
    height: 56,
    borderRadius: BorderRadius.sm,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  videoInfo: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
    lineHeight: 18,
  },
  channelName: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  viewsText: {
    fontSize: Typography.fontSize.xs,
    fontFamily: Typography.fontFamily.body,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 2,
  },
  scoreText: {
    fontSize: 10,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    fontSize: Typography.fontSize.base,
    fontFamily: Typography.fontFamily.body,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.body,
    flex: 1,
  },
  retryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  retryText: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
  },
  selectedCount: {
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodyMedium,
  },
  confirmButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSize.sm,
    fontFamily: Typography.fontFamily.bodySemiBold,
  },
});

export default VideoDiscoveryModal;
