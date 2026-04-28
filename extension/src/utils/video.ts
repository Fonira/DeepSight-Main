/**
 * 🎬 VIDEO UTILS — YouTube + TikTok detection & extraction
 */

export type VideoPlatform = "youtube" | "tiktok";

// ── YouTube ──

/**
 * Extrait l'ID vidéo YouTube depuis une URL — supporte tous les formats :
 *  - https://www.youtube.com/watch?v=ID
 *  - https://www.youtube.com/watch?app=desktop&v=ID  ← ordre params variable
 *  - https://www.youtube.com/watch?v=ID&t=42s
 *  - https://youtu.be/ID
 *  - https://www.youtube.com/embed/ID
 *  - https://www.youtube.com/shorts/ID
 *
 * Bug history : l'ancien regex `youtube\.com\/watch\?v=` cassait dès qu'un
 * param précédait `v=` (ex: `?app=desktop&v=ID`). On parse maintenant via
 * URL + searchParams pour être robuste à l'ordre des params.
 */
export function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    // Hostname youtube.com (avec ou sans sous-domaine www., m., music.)
    if (/(?:^|\.)youtube\.com$/.test(u.hostname)) {
      // Standard /watch?…&v=ID&… — parse via URLSearchParams
      const v = u.searchParams.get("v");
      if (v) return v;
      // /embed/ID
      const embedMatch = u.pathname.match(/^\/embed\/([^/?#]+)/);
      if (embedMatch) return embedMatch[1];
      // /shorts/ID
      const shortsMatch = u.pathname.match(/^\/shorts\/([^/?#]+)/);
      if (shortsMatch) return shortsMatch[1];
    }
    // Short URL youtu.be/ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return id || null;
    }
  } catch {
    return null;
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
  return extractYouTubeVideoId(url) !== null;
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
