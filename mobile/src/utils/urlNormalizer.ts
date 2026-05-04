/**
 * urlNormalizer — Client-side video URL normalization (mobile / Expo RN).
 *
 * Mirrors backend/src/voice/url_validator.py::normalize_url + parse_video_url
 * and frontend/src/utils/urlNormalizer.ts (kept in sync intentionally — this
 * project deliberately duplicates instead of sharing a workspace package).
 *
 * Accepts ANY format the user might paste from a YouTube/TikTok share sheet:
 *   - canonical https URLs (web, mobile m.*, youtu.be, vm.tiktok.com, /shorts/, /embed/)
 *   - mobile native schemes  (vnd.youtube://, youtube://, tiktok://, snssdk*)
 *   - Android intent links   (intent://...#Intent;...;end)
 *
 * Returns null when the input doesn't match a known YouTube/TikTok pattern.
 */

export type NormalizedVideoUrl = {
  platform: "youtube" | "tiktok";
  canonicalUrl: string;
  videoId: string;
};

// ── canonical regexes (mirror backend) ─────────────────────────────
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TIKTOK_VM_RE = /^https?:\/\/vm\.tiktok\.com\/([A-Za-z0-9]+)\/?/;
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/(\d+)|t\/([A-Za-z0-9]+)|v\/(\d+))/;

// ── mobile/intent rewrite regexes ──────────────────────────────────
const YT_SCHEME_RE =
  /^(?:vnd\.youtube|youtube):\/\/(?:watch\?v=|.*[?&]v=)([a-zA-Z0-9_-]{11})/i;
const YT_SCHEME_BARE_RE = /^(?:vnd\.youtube|youtube):([a-zA-Z0-9_-]{11})$/i;
const INTENT_RE = /^intent:\/\/(.+?)#Intent;/i;
const TIKTOK_SNSSDK_RE = /^snssdk\d+:\/\/aweme\/detail\/(\d+)/i;
const TIKTOK_SCHEME_VIDEO_RE = /^tiktok:\/\/[^/]*\/?(?:.*?\/)?video\/(\d+)/i;
const TIKTOK_SCHEME_AWEME_RE = /^tiktok:\/\/aweme\/detail\/(\d+)/i;

/**
 * Normalize a raw URL/scheme/intent string into a canonical HTTPS URL.
 * Pass-through for unknown patterns (returns the trimmed input).
 */
export function normalizeUrl(raw: string): string {
  if (!raw) return raw;
  const url = raw.trim();
  if (!url) return url;

  let m = url.match(YT_SCHEME_RE);
  if (m) return `https://www.youtube.com/watch?v=${m[1]}`;
  m = url.match(YT_SCHEME_BARE_RE);
  if (m) return `https://www.youtube.com/watch?v=${m[1]}`;

  m = url.match(TIKTOK_SNSSDK_RE);
  if (m) return `https://www.tiktok.com/@_/video/${m[1]}`;
  m = url.match(TIKTOK_SCHEME_AWEME_RE);
  if (m) return `https://www.tiktok.com/@_/video/${m[1]}`;
  m = url.match(TIKTOK_SCHEME_VIDEO_RE);
  if (m) return `https://www.tiktok.com/@_/video/${m[1]}`;

  m = url.match(INTENT_RE);
  if (m) {
    const body = m[1];
    if (body.includes("://")) return normalizeUrl(body);
    return `https://${body}`;
  }

  return url;
}

/**
 * Detect (platform, canonicalUrl, videoId) from any user-pasted string.
 * Returns null if the input isn't a recognized YouTube/TikTok video.
 */
export function normalizeVideoUrl(raw: string): NormalizedVideoUrl | null {
  if (!raw) return null;
  const url = normalizeUrl(raw);
  if (!url) return null;

  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) {
    return {
      platform: "youtube",
      canonicalUrl: url,
      videoId: ytMatch[1],
    };
  }

  const ttVmMatch = url.match(TIKTOK_VM_RE);
  if (ttVmMatch) {
    return {
      platform: "tiktok",
      canonicalUrl: url,
      videoId: ttVmMatch[1],
    };
  }

  const ttMatch = url.match(TIKTOK_RE);
  if (ttMatch) {
    const videoId = ttMatch[1] ?? ttMatch[2] ?? ttMatch[3];
    if (videoId) {
      return {
        platform: "tiktok",
        canonicalUrl: url,
        videoId,
      };
    }
  }

  return null;
}
