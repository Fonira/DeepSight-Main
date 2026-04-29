/**
 * URL validator for Quick Voice Call mobile V3 — mirrors backend
 * voice.url_validator.parse_video_url regex. YouTube + TikTok only.
 * Rejects non-video TikTok pages (discover, explore, profiles).
 * Hostname case-sensitive.
 */

const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TIKTOK_VM_RE = /^https?:\/\/vm\.tiktok\.com\/([A-Za-z0-9]+)\/?/;
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/(\d+)|t\/([A-Za-z0-9]+)|v\/(\d+))/;

export type VideoPlatform = "youtube" | "tiktok";

export interface ParsedVideoURL {
  platform: VideoPlatform;
  videoId: string;
}

export function parseVideoURL(url: string): ParsedVideoURL | null {
  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) return { platform: "youtube", videoId: ytMatch[1] };

  const vmMatch = url.match(TIKTOK_VM_RE);
  if (vmMatch) return { platform: "tiktok", videoId: vmMatch[1] };

  const ttMatch = url.match(TIKTOK_RE);
  if (ttMatch) {
    const id = ttMatch[1] ?? ttMatch[2] ?? ttMatch[3];
    if (id) return { platform: "tiktok", videoId: id };
  }

  return null;
}

export function validateVideoURL(url: string): boolean {
  return parseVideoURL(url) !== null;
}
