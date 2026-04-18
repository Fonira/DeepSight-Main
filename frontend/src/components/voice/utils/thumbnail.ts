/**
 * thumbnail — Resolve video thumbnail URL with YouTube fallback cascade.
 *
 * Some analyses have a null `thumbnail_url` in DB (older rows, Supadata
 * metadata fails, TikTok without thumbnail, etc.). For YouTube, we can
 * rebuild a URL from the video_id. The <ThumbnailImage> component also
 * handles an in-DOM cascade (maxres → hq → mq → default) when a provided
 * URL returns 404.
 */

type ThumbnailSource = {
  thumbnail_url?: string | null;
  video_id?: string | null;
  platform?: string | null;
};

/**
 * Resolve the primary thumbnail URL. Falls back to YouTube's maxresdefault
 * when the platform is "youtube" and video_id is known.
 * Returns null if no thumbnail can be determined — caller should render a
 * visual fallback (icon, gradient).
 */
export function resolveThumbnailUrl(
  source: ThumbnailSource | null | undefined,
): string | null {
  if (!source) return null;
  if (source.thumbnail_url && source.thumbnail_url.trim().length > 0) {
    return source.thumbnail_url;
  }
  if (
    source.platform?.toLowerCase() === "youtube" &&
    source.video_id &&
    source.video_id.trim().length > 0
  ) {
    return `https://i.ytimg.com/vi/${source.video_id}/maxresdefault.jpg`;
  }
  return null;
}

/**
 * Ordered list of YouTube thumbnail qualities to try when a higher-quality
 * URL returns 404. Use with <ThumbnailImage> onError cascade.
 */
export const YOUTUBE_FALLBACK_QUALITIES = [
  "maxresdefault",
  "hqdefault",
  "mqdefault",
  "default",
] as const;

export function buildYouTubeThumbnailUrl(
  videoId: string,
  quality: (typeof YOUTUBE_FALLBACK_QUALITIES)[number] = "maxresdefault",
): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}
