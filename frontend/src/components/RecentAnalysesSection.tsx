/**
 * DEEP SIGHT — RecentAnalysesSection
 * Affiche les 3 dernières analyses en format compact horizontal.
 * Design : une rangée de 3 cartes avec mini-thumbnail + titre.
 * Objectif : accès rapide sans pousser Tournesol hors de vue.
 */

import React, { useState, useEffect } from "react";
import { Clock, Play, History } from "lucide-react";
import { videoApi } from "../services/api";
import type { Summary } from "../services/api";
import { ThumbnailImage } from "./ThumbnailImage";
import { sanitizeTitle } from "../utils/sanitize";

interface RecentAnalysesSectionProps {
  language: "fr" | "en";
  onVideoSelect: (videoId: string) => void;
  /** Navigate to the analysis conversation in the hub (e.g. /hub?summary=summaryId) */
  onOpenAnalysis?: (summaryId: number, videoId: string) => void;
  hidden?: boolean;
}

function formatRelativeTime(dateStr: string, lang: "fr" | "en"): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (lang === "fr") {
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `${diffDays}j`;
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    });
  }
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const RecentAnalysesSection: React.FC<RecentAnalysesSectionProps> = ({
  language,
  onVideoSelect,
  onOpenAnalysis,
  hidden = false,
}) => {
  const [recent, setRecent] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      try {
        const { items } = await videoApi.getHistory({ limit: 3, page: 1 });
        if (!cancelled) setRecent(items || []);
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  if (hidden || loading || recent.length === 0) return null;

  return (
    <div className="mb-6 animate-fadeIn">
      {/* Header compact */}
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-text-tertiary" />
        <span className="text-sm font-medium text-text-secondary">
          {language === "fr" ? "Récents" : "Recent"}
        </span>
      </div>

      {/* 3 cartes compactes en row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {recent.map((item) => (
          <button
            key={item.id}
            data-recent-analysis-id={item.id}
            onClick={() =>
              onOpenAnalysis
                ? onOpenAnalysis(item.id, item.video_id)
                : onVideoSelect(item.video_id)
            }
            className="group flex items-center gap-3 p-2 rounded-xl bg-bg-secondary/50 border border-border-subtle hover:border-accent-primary/30 hover:bg-bg-secondary transition-all duration-200 text-left"
          >
            {/* Mini thumbnail */}
            <div className="relative w-20 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-bg-tertiary">
              <ThumbnailImage
                thumbnailUrl={item.thumbnail_url}
                videoId={item.video_id}
                title={item.video_title}
                category={item.category}
                className="w-full h-full object-cover"
              />
              {/* Play icon on hover */}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-3.5 h-3.5 text-white ml-0.5" fill="white" />
              </div>
              {/* Duration */}
              {item.video_duration ? (
                <div className="absolute bottom-0.5 right-0.5 px-1 py-px rounded bg-black/70 text-white text-[9px] font-medium leading-tight">
                  {formatDuration(item.video_duration)}
                </div>
              ) : null}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-xs font-medium text-text-primary line-clamp-2 leading-snug group-hover:text-accent-primary transition-colors">
                {sanitizeTitle(item.video_title)}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-text-tertiary">
                <span className="truncate">
                  {sanitizeTitle(item.video_channel)}
                </span>
                <span className="flex-shrink-0">·</span>
                <span className="flex-shrink-0 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {formatRelativeTime(item.created_at, language)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
