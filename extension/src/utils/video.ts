/**
 * 🎬 VIDEO UTILS — YouTube + TikTok detection & extraction
 */

export type VideoPlatform = "youtube" | "tiktok";

// ── YouTube ──

const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
  /youtube\.com\/shorts\/([^&?\s]+)/,
];

export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
}

// ── TikTok ──

const TIKTOK_PATTERNS = [
  /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
  /vm\.tiktok\.com\/([\w-]+)/i,
  /m\.tiktok\.com\/v\/(\d+)/i,
  /tiktok\.com\/t\/([\w-]+)/i,
  /tiktok\.com\/video\/(\d+)/i,
];

export function extractTikTokVideoId(url: string): string | null {
  for (const pattern of TIKTOK_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isTikTokUrl(url: string): boolean {
  return TIKTOK_PATTERNS.some((p) => p.test(url));
}

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_ID_PATTERNS.some((p) => p.test(url));
}

// ── Multi-platform ──

export function detectPlatform(url: string): VideoPlatform | null {
  if (isYouTubeUrl(url)) return "youtube";
  if (isTikTokUrl(url)) return "tiktok";
  return null;
}

export function extractVideoId(url: string): string | null {
  return extractYouTubeVideoId(url) || extractTikTokVideoId(url);
}

export function getThumbnailUrl(
  videoId: string,
  platform?: VideoPlatform,
): string | null {
  if (platform === "tiktok") return null; // TikTok thumbnails come from backend
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
}

export function getVideoUrl(
  videoId: string,
  platform: VideoPlatform = "youtube",
): string {
  if (platform === "tiktok") return `https://www.tiktok.com/video/${videoId}`;
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function detectCurrentPagePlatform(): VideoPlatform | null {
  const hostname = window.location.hostname;
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
    return "youtube";
  if (hostname.includes("tiktok.com")) return "tiktok";
  return null;
}
