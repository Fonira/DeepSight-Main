// ── Theme detection — hardened against Dark Reader interference ──

import { getCachedExtensions } from "./coexistence";

/**
 * Detect YouTube theme using a priority chain that resists
 * third-party extension interference (Dark Reader, etc.).
 *
 * Priority:
 * 1. html[dark] attribute (native YouTube — most reliable)
 * 2. prefers-color-scheme media query (OS-level — untouched by extensions)
 * 3. YouTube CSS var --yt-spec-base-background (ONLY if Dark Reader is NOT active)
 * 4. getComputedStyle(body).backgroundColor RGB (ONLY if Dark Reader is NOT active)
 */
export function detectTheme(): "dark" | "light" {
  const html = document.documentElement;

  // Priority 1: Native YouTube dark attribute (most reliable)
  if (html.getAttribute("dark") === "true" || html.hasAttribute("dark")) {
    return "dark";
  }

  // Priority 2: OS-level preference (not affected by extensions)
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  // Priority 3 & 4: Only trust computed styles when Dark Reader is NOT active
  const extensions = getCachedExtensions();
  if (!extensions.darkReader) {
    // Priority 3: YouTube CSS variable
    const ytBg = getComputedStyle(html)
      .getPropertyValue("--yt-spec-base-background")
      .trim();
    if (ytBg.includes("#0f") || ytBg.includes("#18") || ytBg.includes("#21")) {
      return "dark";
    }

    // Priority 4: Body background color RGB
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    if (
      bodyBg.includes("rgb(15,") ||
      bodyBg.includes("rgb(24,") ||
      bodyBg.includes("rgb(33,")
    ) {
      return "dark";
    }
  }

  return "light";
}

type ThemeCallback = (theme: "dark" | "light") => void;

let mediaQueryCleanup: (() => void) | null = null;

/**
 * Watch for theme changes via DOM mutations AND prefers-color-scheme changes.
 */
export function watchTheme(callback: ThemeCallback): void {
  // Watch YouTube DOM attribute changes
  const observer = new MutationObserver(() => {
    callback(detectTheme());
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dark", "class"],
  });

  // Watch OS-level color scheme changes (catches system toggle,
  // unaffected by Dark Reader)
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (): void => {
    callback(detectTheme());
  };
  mediaQuery.addEventListener("change", handleChange);

  // Store cleanup so it could be called later if needed
  mediaQueryCleanup = () => {
    mediaQuery.removeEventListener("change", handleChange);
    observer.disconnect();
  };
}

/**
 * Stop watching theme changes. Call on cleanup/navigation.
 */
export function stopWatchingTheme(): void {
  if (mediaQueryCleanup) {
    mediaQueryCleanup();
    mediaQueryCleanup = null;
  }
}
