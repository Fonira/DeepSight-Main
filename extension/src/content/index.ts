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
import { YouTubeAudioController } from "./youtubeAudioController";
import {
  injectVoiceCallButton,
  removeVoiceCallButton,
} from "./voiceCallInjector";

// Audio ducking pendant les voice calls — instance unique par tab.
const audioController = new YouTubeAudioController();
// Defensive : `chrome.runtime.onMessage` peut ne pas exister dans certains
// contextes de test où le mock chrome est minimaliste.
if (chrome?.runtime?.onMessage?.addListener) {
  chrome.runtime.onMessage.addListener((msg: { type?: string }) => {
    if (msg?.type === "DUCK_AUDIO") audioController.attach();
    if (msg?.type === "RESTORE_AUDIO") audioController.detach();
  });
}

let lastUrl = location.href;

/**
 * Vérifie si l'URL est une page YouTube watch (`/watch`). On exclut TikTok
 * pour V1 — l'injection se fait uniquement sur YouTube.
 */
const isYouTubeWatchUrl = (url: string): boolean => {
  try {
    const u = new URL(url);
    return /(?:^|\.)youtube\.com$/.test(u.hostname) && u.pathname === "/watch";
  } catch {
    return false;
  }
};

/**
 * Synchronise la présence du bouton Quick Voice Call avec l'URL courante :
 * - sur /watch → injecte (idempotent côté injector)
 * - ailleurs   → retire si présent
 */
const syncVoiceCallButton = (url: string): void => {
  if (isYouTubeWatchUrl(url)) {
    void injectVoiceCallButton();
  } else {
    removeVoiceCallButton();
  }
};

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
  syncVoiceCallButton(url);
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

// Initial injection if landing directly on a watch page.
syncVoiceCallButton(lastUrl);
