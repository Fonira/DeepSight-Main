/**
 * Normalisation des miniatures renvoyées par l'API.
 *
 * Depuis la relance, les miniatures stockées sur le VPS sont servies en absolu :
 *   https://api.deepsightsynthesis.com/api/thumbnails/thumbnails/<video_id>/card.webp
 * Avant (THUMBNAIL_BASE_URL vide), l'API enregistrait « /thumbnails/... » : chemin
 * relatif résolu nulle part (404) et fichiers non persistés. expo-image ne sait pas
 * charger un chemin relatif.
 */
import { API_BASE_URL } from "../constants/config";

const API_THUMBNAILS_PREFIX = "/api/thumbnails";

export interface ThumbnailVideoRef {
  videoId?: string | null;
  platform?: string | null;
}

/** Miniature du CDN YouTube (fiable), si la vidéo est une vidéo YouTube connue. */
export function youtubeThumbnailUrl(video?: ThumbnailVideoRef): string | undefined {
  if (!video?.videoId) return undefined;
  if (video.platform && video.platform !== "youtube") return undefined;
  return `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`;
}

/**
 * - URL absolue (R2, CDN, /api/thumbnails) : inchangée ;
 * - « /api/thumbnails/... » relative : préfixée par l'URL de l'API ;
 * - ancienne « /thumbnails/... » : miniature YouTube si possible, sinon chemin
 *   corrigé sous /api/thumbnails ;
 * - vide ou inconnue : miniature YouTube si possible.
 */
export function resolveThumbnailUrl(
  url: string | null | undefined,
  video?: ThumbnailVideoRef,
): string | undefined {
  const youtube = youtubeThumbnailUrl(video);
  const trimmed = url?.trim();
  if (!trimmed) return youtube;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith(`${API_THUMBNAILS_PREFIX}/`)) {
    return `${API_BASE_URL}${trimmed}`;
  }
  if (trimmed.startsWith("/thumbnails/")) {
    return youtube ?? `${API_BASE_URL}${API_THUMBNAILS_PREFIX}${trimmed}`;
  }
  return youtube;
}
