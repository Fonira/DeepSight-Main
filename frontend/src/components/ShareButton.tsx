/**
 * ShareButton — Reusable share button for analyses
 * Uses Web Share API when available, fallback to clipboard copy.
 */

import { useState, useCallback } from "react";
import { Share2, Check, Loader2 } from "lucide-react";
import { shareApi } from "../services/api";

interface ShareButtonProps {
  videoId: string;
  videoTitle?: string;
  className?: string;
  iconOnly?: boolean;
}

export function ShareButton({ videoId, videoTitle, className = "", iconOnly = false }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    if (loading) return;
    setLoading(true);

    try {
      const { share_url } = await shareApi.createShareLink(videoId);

      if (navigator.share) {
        await navigator.share({
          title: videoTitle ? `DeepSight — ${videoTitle}` : "DeepSight Analysis",
          url: share_url,
        });
      } else {
        await navigator.clipboard.writeText(share_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err: any) {
      // User cancelled share dialog
      if (err?.name === "AbortError") return;

      // Fallback: try clipboard
      try {
        const { share_url } = await shareApi.createShareLink(videoId);
        await navigator.clipboard.writeText(share_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        console.error("Share failed");
      }
    } finally {
      setLoading(false);
    }
  }, [videoId, videoTitle, loading]);

  if (iconOnly) {
    return (
      <button
        onClick={handleShare}
        disabled={loading}
        className={`p-2 rounded-lg hover:bg-bg-secondary transition-colors text-text-secondary hover:text-accent-primary disabled:opacity-50 ${className}`}
        title={copied ? "Link copied!" : "Share analysis"}
        aria-label="Share analysis"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : copied ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border-primary hover:bg-bg-secondary transition-colors text-text-secondary hover:text-text-primary disabled:opacity-50 ${className}`}
      aria-label="Share analysis"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : copied ? (
        <Check className="w-4 h-4 text-green-400" />
      ) : (
        <Share2 className="w-4 h-4" />
      )}
      <span>{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}
