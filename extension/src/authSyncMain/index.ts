// This script runs in the MAIN world (page context) on www.deepsightsynthesis.com.
// It can access the page's localStorage but NOT chrome.* APIs.
// It communicates with the isolated-world authSync script via postMessage.

export {}; // Make this a module so declare global works

declare global {
  interface Window {
    __DEEPSIGHT_EXTENSION_PRESENT__: boolean;
  }
}

window.__DEEPSIGHT_EXTENSION_PRESENT__ = true;

// Clés du site actuel (frontend/src/services/api.ts + hooks/useAuth.ts), puis
// anciennes clés : le site écrit `access_token` / `refresh_token` et met
// l'utilisateur en cache dans `cached_user` = {user, timestamp}. L'extension
// lisait `accessToken` / `refreshToken` / `user`, jamais écrites → la
// synchronisation web → extension ne se déclenchait plus.
const ACCESS_TOKEN_KEYS = ["access_token", "accessToken"];
const REFRESH_TOKEN_KEYS = ["refresh_token", "refreshToken"];
const USER_KEYS = ["cached_user", "user"];

/** Le site est une SPA : une connexion ne recharge pas la page. */
const RESYNC_INTERVAL_MS = 5000;
const INITIAL_DELAY_MS = 2000;

let lastSyncedAccessToken: string | null = null;

function readFirst(keys: string[]): string | null {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) return value;
  }
  return null;
}

function readUser(): Record<string, unknown> | null {
  const raw = readFirst(USER_KEYS);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  // cached_user = { user, timestamp }
  if (typeof record.user === "object" && record.user !== null) {
    return record.user as Record<string, unknown>;
  }
  return record;
}

export function syncAuth(): void {
  try {
    const accessToken = readFirst(ACCESS_TOKEN_KEYS);
    const refreshToken = readFirst(REFRESH_TOKEN_KEYS);
    if (!accessToken || !refreshToken) return;
    if (accessToken === lastSyncedAccessToken) return;
    const user = readUser();
    if (!user) return;

    lastSyncedAccessToken = accessToken;
    window.postMessage(
      {
        type: "DEEPSIGHT_AUTH_SUCCESS",
        payload: { accessToken, refreshToken, user },
      },
      window.location.origin,
    );
  } catch (e) {
    console.error("[DeepSight] Failed to read localStorage:", e);
  }
}

// Wait for page to fully initialize localStorage, then follow SPA logins.
setTimeout(syncAuth, INITIAL_DELAY_MS);
setInterval(syncAuth, RESYNC_INTERVAL_MS);
