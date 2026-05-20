/**
 * Sign in with Apple — wrapper TypeScript autour du SDK web AppleID.auth.js.
 *
 * Charge le script Apple à la demande, initialise le client, retourne une
 * promesse résolue avec `{ id_token, email?, full_name? }` après que l'user
 * autorise dans le popup.
 *
 * Note : Apple ne renvoie `user.email` / `user.name` QU'AU PREMIER sign-in
 * (ou aprés révocation depuis Settings > Apple ID > Password & Security >
 * Apps Using Apple ID). Les logins suivants ne contiennent que l'id_token.
 */

const APPLE_SDK_URL =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

interface AppleAuthInitOptions {
  clientId: string;
  scope: string;
  redirectURI: string;
  state?: string;
  usePopup: boolean;
}

interface AppleAuthResponse {
  authorization: {
    id_token: string;
    code: string;
    state: string;
  };
  user?: {
    email?: string;
    name?: {
      firstName?: string;
      lastName?: string;
    };
  };
}

interface AppleAuthError {
  error: string;
}

interface AppleIDAuth {
  init: (options: AppleAuthInitOptions) => void;
  signIn: () => Promise<AppleAuthResponse>;
}

interface AppleIDGlobal {
  auth: AppleIDAuth;
}

declare global {
  interface Window {
    AppleID?: AppleIDGlobal;
  }
}

export interface AppleSignInResult {
  id_token: string;
  email: string | null;
  full_name: string | null;
}

let sdkPromise: Promise<void> | null = null;

function loadAppleSDK(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Apple Sign In requires a browser"));
  }
  if (window.AppleID) {
    return Promise.resolve();
  }
  if (sdkPromise) {
    return sdkPromise;
  }
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${APPLE_SDK_URL}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Apple Sign In SDK")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = APPLE_SDK_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Apple Sign In SDK"));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function generateState(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isAppleAuthError(value: unknown): value is AppleAuthError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

/**
 * Déclenche le flow Sign in with Apple en popup web.
 *
 * @throws {Error} Si le SDK ne charge pas, si la config est invalide, ou si
 *   l'user annule (l'erreur "popup_closed_by_user" / "user_cancelled_authorize"
 *   est propagée comme une `Error` standard).
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  const clientId = import.meta.env.VITE_APPLE_CLIENT_ID as string | undefined;
  if (!clientId) {
    throw new Error(
      "VITE_APPLE_CLIENT_ID non configuré — Sign in with Apple indisponible.",
    );
  }
  // Apple SDK exige un redirectURI même en mode popup (validation, pas redirect réel).
  // On utilise window.location.origin pour pointer toujours sur le domaine courant.
  const redirectURI = window.location.origin;

  await loadAppleSDK();
  if (!window.AppleID) {
    throw new Error("Apple Sign In SDK indisponible après chargement.");
  }

  const state = generateState();
  window.AppleID.auth.init({
    clientId,
    scope: "name email",
    redirectURI,
    state,
    usePopup: true,
  });

  let response: AppleAuthResponse;
  try {
    response = await window.AppleID.auth.signIn();
  } catch (err: unknown) {
    if (isAppleAuthError(err)) {
      // Erreurs SDK Apple : popup_closed_by_user, user_cancelled_authorize, etc.
      throw new Error(`Apple Sign In annulé : ${err.error}`);
    }
    throw err instanceof Error ? err : new Error("Apple Sign In a échoué");
  }

  if (!response.authorization?.id_token) {
    throw new Error("Apple n'a pas retourné d'id_token.");
  }
  if (response.authorization.state !== state) {
    throw new Error("State CSRF mismatch — abandon Apple Sign In.");
  }

  const name = response.user?.name;
  const fullName =
    name && (name.firstName || name.lastName)
      ? `${name.firstName ?? ""} ${name.lastName ?? ""}`.trim() || null
      : null;

  return {
    id_token: response.authorization.id_token,
    email: response.user?.email ?? null,
    full_name: fullName,
  };
}
