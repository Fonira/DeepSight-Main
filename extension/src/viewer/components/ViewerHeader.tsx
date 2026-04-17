import React from "react";
import type { Summary } from "../../types";
import { CATEGORY_ICONS } from "../../types";

interface Props {
  summary: Summary;
}

interface VideoRef {
  id: string | null;
  platform: "youtube" | "tiktok" | "unknown";
}

function extractVideoRef(url: string | undefined): VideoRef {
  if (!url) return { id: null, platform: "unknown" };

  const yt = url.match(/[?&]v=([^&]+)/);
  if (yt) return { id: yt[1], platform: "youtube" };

  const ytShort = url.match(/youtu\.be\/([^?&]+)/);
  if (ytShort) return { id: ytShort[1], platform: "youtube" };

  const tt = url.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
  if (tt) return { id: tt[1], platform: "tiktok" };

  return { id: null, platform: "unknown" };
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return "v-badge v-badge-score";
  if (score >= 60) return "v-badge v-badge-score warn";
  return "v-badge v-badge-score low";
}

function scoreIcon(score: number): string {
  if (score >= 80) return "\u2705";
  if (score >= 60) return "\u26A0\uFE0F";
  return "\u2753";
}

export const ViewerHeader: React.FC<Props> = ({ summary }) => {
  const ref = extractVideoRef(summary.video_url);

  const thumbnailUrl = (() => {
    if (summary.thumbnail_url) return summary.thumbnail_url;
    if (ref.platform === "youtube" && ref.id) {
      return `https://img.youtube.com/vi/${ref.id}/maxresdefault.jpg`;
    }
    return null;
  })();

  const categoryIcon = CATEGORY_ICONS[summary.category] ?? "\u{1F4CB}";
  const score = summary.reliability_score;

  const reliabilityLabel =
    score >= 80
      ? "Source fiable"
      : score >= 60
        ? "Fiabilité modérée"
        : "À vérifier";

  const reliabilityColor =
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <header className="v-header">
      {thumbnailUrl && (
        <div className="v-header-thumb">
          <img
            src={thumbnailUrl}
            alt={summary.video_title}
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="v-header-body">
        <h1 className="v-header-title">{summary.video_title}</h1>
        {summary.video_channel && (
          <p className="v-header-channel">{summary.video_channel}</p>
        )}
        <div className="v-header-badges">
          <span className="v-badge">
            {categoryIcon} {summary.category}
          </span>
          <span className={scoreBadgeClass(score)}>
            {scoreIcon(score)} {score}%
          </span>
          {summary.tournesol?.found &&
            summary.tournesol.tournesol_score !== null && (
              <span className="v-badge">
                {"\uD83C\uDF3B"} Tournesol{" "}
                {summary.tournesol.tournesol_score > 0 ? "+" : ""}
                {Math.round(summary.tournesol.tournesol_score)}
              </span>
            )}
        </div>
        <div className="v-header-reliability">
          <div className="v-reliability-label">
            <span>Fiabilité — {reliabilityLabel}</span>
            <span className="v-reliability-value">{score}%</span>
          </div>
          <div className="v-reliability-bar">
            <div
              className="v-reliability-fill"
              style={{
                width: `${Math.max(0, Math.min(100, score))}%`,
                background: reliabilityColor,
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
};
