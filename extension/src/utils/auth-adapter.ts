// Cross-browser OAuth adapter
// Chrome/Edge: chrome.identity.launchWebAuthFlow
// Firefox: browser.identity.launchWebAuthFlow (via polyfill)
// Safari: window.open fallback + polling

import { detectBrowser, hasIdentityAPI } from "./browser-polyfill";
import { GOOGLE_CLIENT_ID } from "./config";

// __TARGET_BROWSER__ is injected by webpack DefinePlugin
declare const __TARGET_BROWSER__: string;

function getRedirectURL(): string {
  try {
    if (typeof chrome !== "undefined" && chrome.identity?.getRedirectURL) {
      return chrome.identity.getRedirectURL();
    }
  } catch {
    /* not available */
  }
  return `https://www.deepsightsynthesis.com/auth/callback`;
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
  // Chrome, Edge, Brave, Opera — use chrome.identity
  if (hasIdentityAPI()) {
    return new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: buildGoogleAuthUrl(), interactive },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!redirectUrl) {
            reject(new Error("No redirect URL received"));
            return;
          }
          resolve(redirectUrl);
        },
      );
    });
  }

  // Firefox via webextension-polyfill
  const browser = detectBrowser();
  if (browser === "firefox") {
    const Browser = (await import("webextension-polyfill")).default;
    const redirectUrl = await Browser.identity.launchWebAuthFlow({
      url: buildGoogleAuthUrl(),
      interactive,
    });
    return redirectUrl;
  }

  // Safari / fallback — popup window
  return launchOAuthPopup();
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
