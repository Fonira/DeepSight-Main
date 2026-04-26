import React from "react";

interface Props {
  title: string;
  thumbnail: string;
  platform: "youtube" | "tiktok";
  onAnalyze: () => void;
}

export function VideoDetectedCard({
  title,
  thumbnail,
  platform,
  onAnalyze,
}: Props): JSX.Element {
  return (
    <div
      style={{
        padding: 16,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
        margin: 16,
      }}
    >
      {thumbnail && (
        <img
          src={thumbnail}
          alt={title}
          style={{ width: "100%", borderRadius: 8, marginBottom: 12 }}
        />
      )}
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 12 }}>
        {platform.toUpperCase()}
      </div>
      <button
        onClick={onAnalyze}
        style={{
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff",
          border: "none",
          padding: "10px 16px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          width: "100%",
        }}
      >
        Analyser cette vidéo
      </button>
    </div>
  );
}
