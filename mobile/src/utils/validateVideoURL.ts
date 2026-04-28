/**
 * Validation et parsing d'URLs vidéo (YouTube + TikTok).
 *
 * Mirror du validator backend (`backend/src/voice/url_validator.py`) pour
 * éviter d'envoyer des URLs invalides au backend (UX : feedback immédiat).
 */

const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|vm\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/(\d+)|t\/([A-Za-z0-9]+)|v\/(\d+)|([A-Za-z0-9]+)\/?)/;

export function validateVideoURL(url: string): boolean {
  return YOUTUBE_RE.test(url) || TIKTOK_RE.test(url);
}

export interface ParsedVideoURL {
  platform: "youtube" | "tiktok";
  videoId: string;
}

export function parseVideoURL(url: string): ParsedVideoURL | null {
  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) return { platform: "youtube", videoId: ytMatch[1] };
  const ttMatch = url.match(TIKTOK_RE);
  if (ttMatch) {
    const id = ttMatch[1] || ttMatch[2] || ttMatch[3] || ttMatch[4];
    if (id) return { platform: "tiktok", videoId: id };
  }
  return null;
}
