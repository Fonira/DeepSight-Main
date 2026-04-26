// extension/src/content/index.ts
//
// Content script — URL detector only.
//
// Mission: observe YouTube/TikTok URL changes (SPA via history.pushState) and
// notify the background service worker. The SW relays to the sidebar so it
// can sync with the currently displayed video.
//
// Replaces the previous Shadow DOM widget (757 lines) — no on-page UI anymore.
//
// Lifecycle:
//   1. Initial detection at script load (document_idle).
//   2. MutationObserver throttled to 500ms watches DOM for SPA changes.
//   3. popstate listener catches back/forward navigation.

import { detectPlatform } from "../utils/video";

let lastUrl = location.href;

const notifyUrlChange = (): void => {
  const url = location.href;
  if (url === lastUrl) return;
  lastUrl = url;
  chrome.runtime
    .sendMessage({
      action: "URL_CHANGED",
      payload: { url, platform: detectPlatform(url) },
    })
    .catch(() => {
      // Service worker may not be ready — silently ignored.
    });
};

let throttleTimer: number | null = null;
const throttledNotify = (): void => {
  if (throttleTimer !== null) return;
  throttleTimer = window.setTimeout(() => {
    notifyUrlChange();
    throttleTimer = null;
  }, 500);
};

new MutationObserver(throttledNotify).observe(document, {
  subtree: true,
  childList: true,
});
window.addEventListener("popstate", notifyUrlChange);

// Initial detection at script load — send the current URL.
chrome.runtime
  .sendMessage({
    action: "URL_CHANGED",
    payload: { url: lastUrl, platform: detectPlatform(lastUrl) },
  })
  .catch(() => {});
