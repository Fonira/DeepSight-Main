// ── Third-party extension detection ──
// Detects common extensions that can interfere with DeepSight's UI/theme

export interface DetectedExtensions {
  darkReader: boolean;
  adBlocker: boolean;
  enhancerForYoutube: boolean;
  sponsorBlock: boolean;
  returnYoutubeDislike: boolean;
}

let cachedResult: DetectedExtensions | null = null;

/**
 * Detect third-party extensions via DOM selectors.
 * Results are cached until refreshDetection() is called.
 */
export function detectExtensions(): DetectedExtensions {
  const result: DetectedExtensions = {
    darkReader: detectDarkReader(),
    adBlocker: detectAdBlocker(),
    enhancerForYoutube: detectEnhancerForYoutube(),
    sponsorBlock: detectSponsorBlock(),
    returnYoutubeDislike: detectReturnYoutubeDislike(),
  };

  cachedResult = result;
  return result;
}

/**
 * Returns cached detection results, or runs detection if no cache exists.
 */
export function getCachedExtensions(): DetectedExtensions {
  if (cachedResult) return cachedResult;
  return detectExtensions();
}

/**
 * Force a re-scan, clearing the cache.
 */
export function refreshDetection(): DetectedExtensions {
  cachedResult = null;
  return detectExtensions();
}

// ── Individual detectors ──

function detectDarkReader(): boolean {
  const html = document.documentElement;

  if (html.hasAttribute("data-darkreader-mode")) return true;
  if (html.hasAttribute("data-darkreader-scheme")) return true;
  if (document.querySelector('meta[name="darkreader"]')) return true;
  if (document.querySelector("style.darkreader")) return true;

  return false;
}

function detectAdBlocker(): boolean {
  const secondary = document.getElementById("secondary");
  if (!secondary) return false;

  // Check if the element is hidden by an ad blocker
  // offsetParent is null when display:none OR any ancestor has display:none
  // Exclude false positives: if the element itself has display:none, it's not an ad blocker
  const computedStyle = getComputedStyle(secondary);
  if (computedStyle.display === "none") return false;

  return secondary.offsetParent === null;
}

function detectEnhancerForYoutube(): boolean {
  if (document.querySelector('[class*="enhancer-for-youtube"]')) return true;
  if (document.getElementById("efyt-not-interest")) return true;

  return false;
}

function detectSponsorBlock(): boolean {
  if (document.querySelector(".sponsorSkipButton")) return true;
  if (document.getElementById("sponsorblock-bar")) return true;
  if (document.querySelector('[class*="sponsorBlock"]')) return true;

  return false;
}

function detectReturnYoutubeDislike(): boolean {
  if (document.getElementById("return-youtube-dislike")) return true;
  if (document.querySelector('[class*="ryd-"]')) return true;

  return false;
}
