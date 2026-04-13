import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";

interface EngagementMetricsProps {
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  channelFollowerCount?: number | null;
  engagementRate?: number | null;
  platform?: string;
  compact?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

const MetricBadge: React.FC<{
  emoji: string;
  value: string;
  bgColor: string;
  textColor: string;
}> = ({ emoji, value, bgColor, textColor }) => (
  <View style={[styles.badge, { backgroundColor: bgColor }]}>
    <Text style={styles.badgeEmoji}>{emoji}</Text>
    <Text style={[styles.badgeText, { color: textColor }]}>{value}</Text>
  </View>
);

export const EngagementMetrics: React.FC<EngagementMetricsProps> = ({
  viewCount,
  likeCount,
  commentCount,
  shareCount,
  channelFollowerCount,
  engagementRate,
  platform,
  compact = false,
}) => {
  const { colors } = useTheme();

  const hasAnyMetric =
    viewCount != null ||
    likeCount != null ||
    commentCount != null ||
    shareCount != null ||
    channelFollowerCount != null ||
    engagementRate != null;

  if (!hasAnyMetric) return null;

  const badgeBg = colors.glassBg;
  const textColor = colors.textSecondary;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {viewCount != null && (
        <MetricBadge
          emoji={platform === "tiktok" ? "👁" : "👁"}
          value={formatCount(viewCount)}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
      {likeCount != null && (
        <MetricBadge
          emoji={platform === "tiktok" ? "❤️" : "👍"}
          value={formatCount(likeCount)}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
      {commentCount != null && (
        <MetricBadge
          emoji="💬"
          value={formatCount(commentCount)}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
      {shareCount != null && (
        <MetricBadge
          emoji="🔗"
          value={formatCount(shareCount)}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
      {channelFollowerCount != null && (
        <MetricBadge
          emoji="👥"
          value={formatCount(channelFollowerCount)}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
      {engagementRate != null && (
        <MetricBadge
          emoji="📈"
          value={`${engagementRate.toFixed(1)}%`}
          bgColor={badgeBg}
          textColor={textColor}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: sp.sm - 2, // 6px
    alignItems: "center",
  },
  containerCompact: {
    gap: sp.xs,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
    borderRadius: borderRadius.full,
    gap: sp.xs,
  },
  badgeEmoji: {
    fontSize: fontSize.xs,
  },
  badgeText: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.xs,
    lineHeight: fontSize.xs * 1.35,
  },
});

export default EngagementMetrics;
