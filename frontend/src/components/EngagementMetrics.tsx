/**
 * 📊 ENGAGEMENT METRICS v1.0 — Compact inline badges
 * ═══════════════════════════════════════════════════════════════════════════════
 * Displays view count, likes, comments, shares, followers, and engagement rate
 * as glassmorphism badges. Supports compact mode for history list views.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React from "react";

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

/**
 * Format numbers for display: 1234567 → "1.2M", 12345 → "12.3K", 999 → "999"
 */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Get color class for engagement rate badge
 */
function getEngagementRateColor(rate: number): string {
  if (rate > 5) return "text-emerald-400";
  if (rate >= 1) return "text-yellow-400";
  return "text-white/50";
}

interface BadgeProps {
  icon: string;
  value: string;
  label: string;
  colorClass?: string;
}

const Badge: React.FC<BadgeProps> = ({
  icon,
  value,
  label,
  colorClass = "text-white/70",
}) => (
  <span
    className={`inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-xs ${colorClass} select-none`}
    title={label}
  >
    <span className="text-[11px]">{icon}</span>
    <span>{value}</span>
  </span>
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
  // Return null if no metrics available at all
  const hasAnyMetric =
    (viewCount != null && viewCount > 0) ||
    (likeCount != null && likeCount > 0) ||
    (commentCount != null && commentCount > 0) ||
    (shareCount != null && shareCount > 0) ||
    (channelFollowerCount != null && channelFollowerCount > 0) ||
    (engagementRate != null && engagementRate > 0);

  if (!hasAnyMetric) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Views — always shown if available */}
      {viewCount != null && viewCount > 0 && (
        <Badge
          icon={platform === "tiktok" ? "👁" : "▶"}
          value={formatCount(viewCount)}
          label={`${viewCount.toLocaleString()} vues`}
        />
      )}

      {/* Likes */}
      {likeCount != null && likeCount > 0 && (
        <Badge
          icon="👍"
          value={formatCount(likeCount)}
          label={`${likeCount.toLocaleString()} likes`}
        />
      )}

      {/* Compact mode stops here */}
      {!compact && (
        <>
          {/* Comments */}
          {commentCount != null && commentCount > 0 && (
            <Badge
              icon="💬"
              value={formatCount(commentCount)}
              label={`${commentCount.toLocaleString()} commentaires`}
            />
          )}

          {/* Shares */}
          {shareCount != null && shareCount > 0 && (
            <Badge
              icon="🔄"
              value={formatCount(shareCount)}
              label={`${shareCount.toLocaleString()} partages`}
            />
          )}

          {/* Channel followers */}
          {channelFollowerCount != null && channelFollowerCount > 0 && (
            <Badge
              icon="👤"
              value={formatCount(channelFollowerCount)}
              label={`${channelFollowerCount.toLocaleString()} abonnés`}
            />
          )}

          {/* Engagement rate */}
          {engagementRate != null && engagementRate > 0 && (
            <Badge
              icon="📊"
              value={`${engagementRate.toFixed(1)}%`}
              label={`Taux d'engagement : ${engagementRate.toFixed(2)}%`}
              colorClass={getEngagementRateColor(engagementRate)}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EngagementMetrics;
