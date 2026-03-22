import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  formatRelativeTime,
  formatDuration,
  getYouTubeThumbnail,
} from '@/utils/formatters';
import type { AnalysisSummary } from '@/types';
import { palette } from '@/theme/colors';
import { sp, borderRadius } from '@/theme/spacing';
import { fontFamily, fontSize } from '@/theme/typography';

interface RecentCarouselProps {
  title: string;
  items: AnalysisSummary[];
  isLoading?: boolean;
  showEmpty?: boolean;
}

const CARD_WIDTH = 180;
const CARD_HEIGHT = 140;
const IMAGE_HEIGHT = 80;

// ─── Individual carousel card ───

const CarouselItem = React.memo(({ item }: { item: AnalysisSummary }) => {
  const { colors } = useTheme();

  // YouTube: fallback vers le thumbnail standard si pas de thumbnail custom
  // TikTok: pas de fallback YouTube — essayer oEmbed côté client
  const staticThumbnail =
    item.thumbnail ||
    (item.platform !== 'tiktok' && item.videoId
      ? getYouTubeThumbnail(item.videoId, 'medium')
      : null);

  // TikTok oEmbed fallback: fetch thumbnail côté client (device IP non bloqué)
  const [tiktokThumb, setTiktokThumb] = useState<string | null>(null);
  useEffect(() => {
    if (staticThumbnail || item.platform !== 'tiktok' || !item.video_url) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(item.video_url!)}`,
        );
        if (!resp.ok) return;
        const data = await resp.json();
        if (!cancelled && data.thumbnail_url) {
          setTiktokThumb(data.thumbnail_url);
        }
      } catch {
        // Silent — placeholder will show
      }
    })();
    return () => { cancelled = true; };
  }, [staticThumbnail, item.platform, item.video_url]);

  const thumbnail = staticThumbnail || tiktokThumb;

  const handlePress = useCallback(() => {
    router.push({
      pathname: '/(tabs)/analysis/[id]',
      params: { id: item.id },
    });
  }, [item.id]);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
      accessibilityLabel={item.title}
    >
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={styles.cardImage}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.cardImage,
            styles.cardImageFallback,
            { backgroundColor: item.platform === 'tiktok' ? '#010101' : colors.bgTertiary },
          ]}
        >
          {item.platform === 'tiktok' ? (
            <View style={styles.tiktokBadgeLarge}>
              <Text style={styles.tiktokBadgeText}>TikTok</Text>
            </View>
          ) : (
            <Ionicons
              name="play-circle-outline"
              size={28}
              color={colors.textMuted}
            />
          )}
        </View>
      )}
      <View style={styles.cardContent}>
        <Text
          style={[styles.cardTitle, { color: colors.textPrimary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.cardMeta}>
          {item.duration != null && item.duration > 0 && (
            <Text style={[styles.cardMetaText, { color: colors.textMuted }]}>
              {formatDuration(item.duration)}
            </Text>
          )}
          {item.createdAt && (
            <Text style={[styles.cardMetaText, { color: colors.textMuted }]}>
              {formatRelativeTime(item.createdAt)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
});

CarouselItem.displayName = 'CarouselItem';

// ─── Skeleton loading ───

const SkeletonCards: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View style={styles.skeletonRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.card,
            {
              backgroundColor: colors.bgSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Skeleton
            width={CARD_WIDTH}
            height={IMAGE_HEIGHT}
            borderRadius={0}
          />
          <View style={styles.cardContent}>
            <Skeleton width="90%" height={12} />
            <Skeleton width="60%" height={10} style={{ marginTop: sp.xs }} />
          </View>
        </View>
      ))}
    </View>
  );
};

// ─── Empty state ───

const EmptyCard: React.FC = () => {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: colors.bgCard,
          borderColor: colors.border,
        },
      ]}
    >
      <Ionicons name="sparkles-outline" size={28} color={palette.indigo} />
      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
        Analyse ta{'\n'}première vidéo
      </Text>
    </View>
  );
};

// ─── Separator ───

const ItemSeparator = () => <View style={styles.separator} />;

// ─── Main carousel ───

export const RecentCarousel: React.FC<RecentCarouselProps> = ({
  title,
  items,
  isLoading = false,
  showEmpty = false,
}) => {
  const { colors } = useTheme();

  const renderItem = useCallback(
    ({ item }: { item: AnalysisSummary }) => <CarouselItem item={item} />,
    [],
  );

  const keyExtractor = useCallback(
    (item: AnalysisSummary) => item.id,
    [],
  );

  if (!isLoading && items.length === 0 && !showEmpty) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>

      {isLoading ? (
        <SkeletonCards />
      ) : items.length === 0 && showEmpty ? (
        <EmptyCard />
      ) : (
        <View style={styles.listContainer}>
          <FlashList
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={ItemSeparator}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: sp.xl,
  },
  sectionTitle: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.lg,
    marginBottom: sp.md,
  },
  listContainer: {
    height: CARD_HEIGHT,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    width: CARD_WIDTH,
    height: IMAGE_HEIGHT,
  },
  cardImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
    padding: sp.sm,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.3,
  },
  cardMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardMetaText: {
    fontFamily: fontFamily.body,
    fontSize: 10,
  },
  separator: {
    width: sp.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: sp.md,
  },
  emptyCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sp.sm,
  },
  emptyText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  tiktokBadgeLarge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tiktokBadgeText: {
    color: '#000',
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.sm,
    letterSpacing: -0.3,
  },
});

export default RecentCarousel;
