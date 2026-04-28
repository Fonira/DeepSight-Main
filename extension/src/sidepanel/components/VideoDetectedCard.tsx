import React from "react";

interface Props {
  title: string;
  thumbnail: string;
  platform: "youtube" | "tiktok";
  onAnalyze: () => void;
  loading?: boolean;
}

export function VideoDetectedCard({
  title,
  thumbnail,
  platform,
  onAnalyze,
  loading = false,
}: Props): JSX.Element {
  return (
    <div className="ds-analyze-card">
      {thumbnail && (
        <img src={thumbnail} alt={title} className="ds-analyze-thumbnail" />
      )}
      <div className="ds-analyze-title">{title}</div>
      <div className="ds-analyze-platform">{platform.toUpperCase()}</div>
      <button
        type="button"
        onClick={onAnalyze}
        disabled={loading}
        className="ds-analyze-btn"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="ds-analyze-spinner" aria-hidden="true" />
            <span>Analyse en cours…</span>
          </>
        ) : (
          <>
            <span className="ds-analyze-btn-icon" aria-hidden="true">
              ✨
            </span>
            <span>Analyser cette vidéo</span>
          </>
        )}
      </button>
    </div>
  );
}
