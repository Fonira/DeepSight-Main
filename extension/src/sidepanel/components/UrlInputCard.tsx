import React, { useState } from "react";
import { detectPlatform } from "../../utils/video";

interface Props {
  onSubmit: (url: string) => void;
  loading?: boolean;
}

export function UrlInputCard({
  onSubmit,
  loading = false,
}: Props): JSX.Element {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const isDisabled = loading || url.trim().length === 0;

  return (
    <div className="ds-analyze-card">
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="URL YouTube ou TikTok"
        className="ds-analyze-input"
        disabled={loading}
        aria-label="URL de la vidéo à analyser"
        spellCheck={false}
        autoComplete="off"
      />
      {error && (
        <div className="ds-analyze-error" role="alert">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={isDisabled}
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
