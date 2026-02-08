/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🔗 DEEP LINKING SERVICE — Handle incoming links and navigation                    ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Parse YouTube URLs for analysis                                                  ║
 * ║  - Handle shared content                                                            ║
 * ║  - Process push notification deep links                                             ║
 * ║  - Universal link handling                                                          ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import * as Linking from 'expo-linking';
import { Platform, Share } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ParsedLink {
  type: LinkType;
  route: string;
  params: Record<string, string>;
  originalUrl: string;
}

export enum LinkType {
  ANALYSIS = 'analysis',
  YOUTUBE = 'youtube',
  PLAYLIST = 'playlist',
  HISTORY = 'history',
  PAYMENT = 'payment',
  SETTINGS = 'settings',
  AUTH = 'auth',
  SHARE = 'share',
  UNKNOWN = 'unknown',
}

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

// YouTube playlist pattern
const PLAYLIST_PATTERN = /(?:https?:\/\/)?(?:www\.)?youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/;

// DeepSight URL patterns
const DEEPSIGHT_PATTERNS = {
  analysis: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)analysis\/([^/?]+)/,
  playlist: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)playlists\/([^/?]+)/,
  history: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)history/,
  settings: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)settings/,
  upgrade: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)upgrade/,
  paymentSuccess: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)payment\/success/,
  paymentCancel: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)payment\/cancel/,
  login: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)login/,
  register: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)register/,
  verifyEmail: /^(?:deepsight:\/\/|https?:\/\/(?:www\.)?deepsightsynthesis\.com\/)verify-email/,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Extract YouTube playlist ID from URL
 */
export function extractYouTubePlaylistId(url: string): string | null {
  const match = url.match(PLAYLIST_PATTERN);
  return match ? match[1] : null;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_PATTERNS.some(pattern => pattern.test(url)) || PLAYLIST_PATTERN.test(url);
}

/**
 * Build a YouTube watch URL from video ID
 */
export function buildYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Parse query parameters from URL
 */
function parseQueryParams(url: string): Record<string, string> {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    // Try to parse manually if URL is malformed
    const queryIndex = url.indexOf('?');
    if (queryIndex === -1) return {};

    const queryString = url.slice(queryIndex + 1);
    const params: Record<string, string> = {};

    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      if (key) {
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      }
    });

    return params;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse an incoming URL and determine its type and navigation target
 */
export function parseDeepLink(url: string): ParsedLink {
  const originalUrl = url;
  const params = parseQueryParams(url);

  // Check for YouTube URLs first
  const videoId = extractYouTubeVideoId(url);
  if (videoId) {
    return {
      type: LinkType.YOUTUBE,
      route: 'Analysis',
      params: { videoUrl: buildYouTubeUrl(videoId), videoId },
      originalUrl,
    };
  }

  const playlistId = extractYouTubePlaylistId(url);
  if (playlistId) {
    return {
      type: LinkType.YOUTUBE,
      route: 'PlaylistDetail',
      params: { playlistId, isYouTubePlaylist: 'true' },
      originalUrl,
    };
  }

  // Check for DeepSight patterns
  for (const [key, pattern] of Object.entries(DEEPSIGHT_PATTERNS)) {
    const match = url.match(pattern);
    if (match) {
      switch (key) {
        case 'analysis':
          return {
            type: LinkType.ANALYSIS,
            route: 'Analysis',
            params: { summaryId: match[1], ...params },
            originalUrl,
          };
        case 'playlist':
          return {
            type: LinkType.PLAYLIST,
            route: 'PlaylistDetail',
            params: { playlistId: match[1], ...params },
            originalUrl,
          };
        case 'history':
          return {
            type: LinkType.HISTORY,
            route: 'MainTabs',
            params: { screen: 'History', ...params },
            originalUrl,
          };
        case 'settings':
          return {
            type: LinkType.SETTINGS,
            route: 'Settings',
            params,
            originalUrl,
          };
        case 'upgrade':
          return {
            type: LinkType.PAYMENT,
            route: 'Upgrade',
            params,
            originalUrl,
          };
        case 'paymentSuccess':
          return {
            type: LinkType.PAYMENT,
            route: 'PaymentSuccess',
            params,
            originalUrl,
          };
        case 'paymentCancel':
          return {
            type: LinkType.PAYMENT,
            route: 'PaymentCancel',
            params,
            originalUrl,
          };
        case 'login':
          return {
            type: LinkType.AUTH,
            route: 'Login',
            params,
            originalUrl,
          };
        case 'register':
          return {
            type: LinkType.AUTH,
            route: 'Register',
            params,
            originalUrl,
          };
        case 'verifyEmail':
          return {
            type: LinkType.AUTH,
            route: 'VerifyEmail',
            params: { email: params.email || '', ...params },
            originalUrl,
          };
      }
    }
  }

  // Unknown link type
  return {
    type: LinkType.UNKNOWN,
    route: '',
    params,
    originalUrl,
  };
}

/**
 * Get the initial URL that launched the app
 */
export async function getInitialUrl(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    return url;
  } catch (error) {
    console.error('[DeepLinking] Error getting initial URL:', error);
    return null;
  }
}

/**
 * Subscribe to incoming deep links
 */
export function subscribeToDeepLinks(
  callback: (parsedLink: ParsedLink) => void
): () => void {
  const subscription = Linking.addEventListener('url', (event) => {
    const parsedLink = parseDeepLink(event.url);
    callback(parsedLink);
  });

  return () => {
    subscription.remove();
  };
}

/**
 * Create a shareable deep link for an analysis
 */
export function createAnalysisLink(summaryId: string): string {
  return `https://www.deepsightsynthesis.com/analysis/${summaryId}`;
}

/**
 * Create a shareable deep link for a playlist
 */
export function createPlaylistLink(playlistId: string): string {
  return `https://www.deepsightsynthesis.com/playlists/${playlistId}`;
}

/**
 * Share an analysis with native share sheet
 */
export async function shareAnalysis(
  summaryId: string,
  title: string,
  message?: string
): Promise<boolean> {
  try {
    const url = createAnalysisLink(summaryId);
    const shareMessage = message || `Découvre cette analyse DeepSight: ${title}`;

    const result = await Share.share(
      Platform.OS === 'ios'
        ? { url, message: shareMessage }
        : { message: `${shareMessage}\n\n${url}` },
      { dialogTitle: 'Partager l\'analyse' }
    );

    return result.action === Share.sharedAction;
  } catch (error) {
    console.error('[DeepLinking] Share failed:', error);
    return false;
  }
}

/**
 * Open a URL in the browser
 */
export async function openUrl(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[DeepLinking] Failed to open URL:', error);
    return false;
  }
}

/**
 * Open app settings
 */
export async function openAppSettings(): Promise<void> {
  await Linking.openSettings();
}

export const DeepLinking = {
  parseDeepLink,
  getInitialUrl,
  subscribeToDeepLinks,
  extractYouTubeVideoId,
  extractYouTubePlaylistId,
  isYouTubeUrl,
  buildYouTubeUrl,
  createAnalysisLink,
  createPlaylistLink,
  shareAnalysis,
  openUrl,
  openAppSettings,
  LinkType,
};

export default DeepLinking;
