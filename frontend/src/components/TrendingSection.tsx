/**
 * TrendingSection — Most-analyzed videos on DeepSight
 * Glassmorphism card grid with period tabs.
 */

import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, Users, BarChart3, Clock } from "lucide-react";
import { trendingApi } from "../services/api";
import type { TrendingVideo, TrendingResponse } from "../services/api";
import { ThumbnailImage } from "./ThumbnailImage";

interface TrendingSectionProps {
  onVideoSelect?: (videoId: string) => void;
  language?: "fr" | "en";
}

const PERIODS = [
  { value: "7d" as const, label: { fr: "7 jours", en: "7 days" } },
  { value: "30d" as const, label: { fr: "30 jours", en: "30 days" } },
  { value: "all" as const, label: { fr: "Toutes", en: "All time" } },
];

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, "0")}`;
  return `${m}min`;
};

export const TrendingSection: React.FC<TrendingSectionProps> = ({
  onVideoSelect,
  language = "fr",
}) => {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [data, setData] = useState<TrendingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trendingApi.getTrending(period);
      setData(result);
    } catch (err) {
      setError(
        language === "fr"
          ? "Impossible de charger les tendances"
          : "Failed to load trending",
      );
    } finally {
      setLoading(false);
    }
  }, [period, language]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const t = {
    title: language === "fr" ? "Tendances DeepSight" : "DeepSight Trending",
    subtitle:
      language === "fr"
        ? "Les vidéos les plus analysées par la communauté"
        : "Most analyzed videos by the community",
    analyses: language === "fr" ? "analyses" : "analyses",
    users: language === "fr" ? "utilisateurs" : "users",
    noData:
      language === "fr"
        ? "Pas encore assez de données. Lancez une analyse !"
        : "Not enough data yet. Start an analysis!",
    cached: language === "fr" ? "vidéos en cache" : "cached videos",
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <TrendingUp className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{t.title}</h2>
            <p className="text-sm text-white/50">{t.subtitle}</p>
          </div>
        </div>

        {/* Period tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                period === p.value
                  ? "bg-orange-500/20 text-orange-300"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {p.label[language]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden animate-pulse"
            >
              <div className="aspect-video bg-white/10" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-white/40">{error}</div>
      ) : !data?.videos?.length ? (
        <div className="text-center py-12 text-white/40">{t.noData}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.videos.map((video) => (
              <TrendingCard
                key={video.video_id}
                video={video}
                language={language}
                onClick={() => onVideoSelect?.(video.video_id)}
                labels={t}
              />
            ))}
          </div>

          {/* Footer stats */}
          {data.total_cached_videos > 0 && (
            <div className="mt-4 text-center text-xs text-white/30">
              {data.total_cached_videos} {t.cached}
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface TrendingCardProps {
  video: TrendingVideo;
  language: "fr" | "en";
  onClick: () => void;
  labels: { analyses: string; users: string };
}

const TrendingCard: React.FC<TrendingCardProps> = ({
  video,
  onClick,
  labels,
}) => {
  return (
    <button
      onClick={onClick}
      className="group rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden
                 hover:bg-white/[0.06] hover:border-white/[0.12] transition-all text-left w-full
                 backdrop-blur-sm"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden">
        <ThumbnailImage
          thumbnailUrl={video.thumbnail_url ?? undefined}
          videoId={video.video_id}
          title={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {video.duration && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/80 rounded text-[10px] text-white/80 font-mono">
            {formatDuration(video.duration)}
          </span>
        )}
        {/* Analysis count badge */}
        <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-orange-500/90 rounded-full text-[10px] text-white font-semibold flex items-center gap-1">
          <BarChart3 className="w-3 h-3" />
          {video.analysis_count}
        </span>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-medium text-white/90 line-clamp-2 leading-tight">
          {video.title}
        </h3>
        <p className="text-xs text-white/40 truncate">{video.channel}</p>

        <div className="flex items-center gap-3 text-[10px] text-white/30 pt-1">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {video.unique_users} {labels.users}
          </span>
          {video.avg_reliability_score !== null && (
            <span className="flex items-center gap-1">
              {video.avg_reliability_score >= 7
                ? "🟢"
                : video.avg_reliability_score >= 4
                  ? "🟡"
                  : "🔴"}
              {video.avg_reliability_score}/10
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default TrendingSection;
