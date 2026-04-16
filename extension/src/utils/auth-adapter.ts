// Cross-browser OAuth adapter
// Chrome/Edge/Firefox: Browser.identity.launchWebAuthFlow (via webextension-polyfill)
// Safari: window.open fallback + polling (identity API unavailable on Safari Web Extensions)

import Browser, { hasIdentityAPI } from "./browser-polyfill";
import { GOOGLE_CLIENT_ID } from "./config";

// Injected by webpack DefinePlugin — "chrome" | "firefox" | "safari"
// Falls back to "chrome" if undefined (e.g. legacy builds, non-define test runners).
declare const __TARGET_BROWSER__: string;
const TARGET_BROWSER: string =
  typeof __TARGET_BROWSER__ !== "undefined" ? __TARGET_BROWSER__ : "chrome";

function getRedirectURL(): string {
  try {
    return (
      Browser.identity?.getRedirectURL() ??
      "https://www.deepsightsynthesis.com/auth/callback"
    );
  } catch {
    return "https://www.deepsightsynthesis.com/auth/callback";
  }
}

function buildGoogleAuthUrl(): string {
  const redirectUri = getRedirectURL();
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "token",
    scope: "email profile",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function launchOAuthFlow(
  interactive: boolean = true,
): Promise<string> {
  // Safari: identity API is absent — use a popup window + polling.
  // Determined at build time via webpack DefinePlugin, with a runtime
  // feature-detection safety net for edge cases (e.g. Safari builds that
  // somehow expose a broken identity shim).
  if (TARGET_BROWSER === "safari" || !hasIdentityAPI()) {
    return launchOAuthPopup();
  }

  // Chrome, Edge, Brave, Opera, Firefox — Promise-based Browser.identity.
  const redirectUrl = await Browser.identity.launchWebAuthFlow({
    url: buildGoogleAuthUrl(),
    interactive,
  });
  if (!redirectUrl) {
    throw new Error("No redirect URL received");
  }
  return redirectUrl;
}

function launchOAuthPopup(): Promise<string> {
  return new Promise((resolve, reject) => {
    const width = 500;
    const height = 600;
    const left = Math.round(screen.width / 2 - width / 2);
    const top = Math.round(screen.height / 2 - height / 2);

    const popup = window.open(
      buildGoogleAuthUrl(),
      "DeepSight_OAuth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`,
    );

    if (!popup) {
      reject(new Error("Popup blocked — please allow popups for DeepSight"));
      return;
    }

    const checkInterval = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(checkInterval);
          reject(new Error("OAuth cancelled by user"));
          return;
        }
        const url = popup.location.href;
        if (url && (url.includes("access_token=") || url.includes("code="))) {
          clearInterval(checkInterval);
          popup.close();
          resolve(url);
        }
      } catch {
        // Cross-origin — still waiting for redirect back to our domain
      }
    }, 500);

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      try {
        popup.close();
      } catch {
        /* ignore */
      }
      reject(new Error("OAuth timeout — please try again"));
    }, 300000);
  });
}

// Extract access token from redirect URL
export function extractTokenFromUrl(url: string): string | null {
  try {
    const hash = new URL(url).hash;
    const params = new URLSearchParams(hash.substring(1));
    return params.get("access_token");
  } catch {
    return null;
  }
}
