// Cross-browser API abstraction
// Chrome uses chrome.*, Firefox uses browser.* (Promise-based)
// webextension-polyfill normalizes both to the Promise-based browser.* API

import Browser from "webextension-polyfill";

export default Browser;

// Re-export types for convenience
export type { Runtime, Storage, Tabs, Alarms } from "webextension-polyfill";

// Helper: detect current browser
export type BrowserName =
  | "chrome"
  | "firefox"
  | "safari"
  | "edge"
  | "opera"
  | "brave";

export function detectBrowser(): BrowserName {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("firefox")) return "firefox";
  if (
    ua.includes("safari") &&
    !ua.includes("chrome") &&
    !ua.includes("chromium")
  )
    return "safari";
  if (ua.includes("edg/")) return "edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "opera";
  // Brave detection
  if (
    (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } })
      .brave
  )
    return "brave";
  return "chrome";
}

// Helper: check if identity API is available (not on Safari)
export function hasIdentityAPI(): boolean {
  try {
    return (
      typeof Browser.identity !== "undefined" &&
      typeof Browser.identity.launchWebAuthFlow === "function"
    );
  } catch {
    return false;
  }
}

// Helper: get runtime URL (works cross-browser)
export function getRuntimeURL(path: string): string {
  return Browser.runtime.getURL(path);
}
