// ── Navigation helpers for YouTube SPA ──

import { extractVideoId } from '../utils/video';

export function isVideoPage(): boolean {
  const url = window.location.href;
  return url.includes('youtube.com/watch') || url.includes('tiktok.com/');
}

export function getCurrentVideoId(): string | null {
  return extractVideoId(window.location.href);
}

type NavCallback = (videoId: string | null) => void;

export function watchNavigation(callback: NavCallback): void {
  let lastVideoId = getCurrentVideoId();

  function handleNav(): void {
    const newVideoId = getCurrentVideoId();
    if (newVideoId !== lastVideoId) {
      lastVideoId = newVideoId;
      setTimeout(() => callback(newVideoId), 500);
    }
  }

  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(history, args);
    handleNav();
  };

  window.addEventListener('popstate', handleNav);
  document.addEventListener('yt-navigate-finish', handleNav);
  document.addEventListener('yt-page-data-updated', handleNav);
}
