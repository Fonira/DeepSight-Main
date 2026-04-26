import React, { useState } from "react";
import { detectPlatform } from "../../utils/video";

interface Props {
  onSubmit: (url: string) => void;
}

export function UrlInputCard({ onSubmit }: Props): JSX.Element {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    const trimmed = url.trim();
    if (!trimmed) return;
    const platform = detectPlatform(trimmed);
    if (!platform) {
      setError("URL invalide. Colle une URL YouTube ou TikTok.");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div
      style={{
        padding: 16,
        margin: 16,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 12,
      }}
    >
      <input
        value={url}
        onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
        placeholder="URL YouTube ou TikTok"
        style={{
          width: "100%",
          padding: 10,
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#fff",
          fontSize: 13,
          marginBottom: 8,
          boxSizing: "border-box",
        }}
      />
      {error && (
        <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>
          {error}
        </div>
      )}
      <button
        onClick={handleSubmit}
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
        Analyser
      </button>
    </div>
  );
}
