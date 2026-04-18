/**
 * ThumbnailImage — Video thumbnail with YouTube quality cascade on 404.
 *
 * Tries `maxresdefault` first (best quality), falls back to `hqdefault` →
 * `mqdefault` → `default` if higher resolutions 404. When all cascades fail
 * or when the source is non-YouTube, renders the provided `fallback` node.
 */

import React, { useState, useEffect, useMemo } from "react";

interface ThumbnailImageProps {
  /** Primary URL — typically resolved via resolveThumbnailUrl(). */
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Node rendered when all cascade URLs fail or src is empty. */
  fallback: React.ReactNode;
  loading?: "eager" | "lazy";
  draggable?: boolean;
}

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/i\.ytimg\.com\/vi\/([^/]+)\//);
  return match ? match[1] : null;
}

function buildCascade(src: string | null | undefined): string[] {
  if (!src) return [];
  const videoId = extractYouTubeVideoId(src);
  if (!videoId) return [src];
  // YouTube cascade: try progressively lower qualities before giving up
  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/default.jpg`,
  ];
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  src,
  alt,
  className,
  fallback,
  loading = "eager",
  draggable = false,
}) => {
  const cascade = useMemo(() => buildCascade(src), [src]);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset cascade when src changes
  useEffect(() => {
    setIndex(0);
    setFailed(false);
  }, [src]);

  if (!src || failed || cascade.length === 0) {
    return <>{fallback}</>;
  }

  return (
    <img
      src={cascade[index]}
      alt={alt}
      className={className}
      loading={loading}
      draggable={draggable}
      onError={() => {
        if (index < cascade.length - 1) {
          setIndex(index + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
};
