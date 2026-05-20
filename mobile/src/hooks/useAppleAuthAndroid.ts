/**
 * useAppleAuthAndroid — Sign in with Apple via web OAuth flow (Android-specific).
 *
 * Pourquoi ce hook existe :
 * Apple ne fournit PAS de SDK natif Android. Sur iOS, on utilise
 * `expo-apple-authentication` (PR #520) qui ouvre la sheet systeme native. Sur
 * Android, on doit passer par le flow OAuth web standard, identique au flow web
 * AppleID.auth.js — mais adapte au contexte mobile.
 *
 * Flow technique :
 *   1. Generation d'un `state` random (CSRF) + nonce (replay protection).
 *   2. Ouverture de `https://appleid.apple.com/auth/authorize` dans un Custom
 *      Tab Android (via `expo-web-browser` openAuthSessionAsync).
 *   3. Apple authentifie l'utilisateur puis fait un `form_post` vers le redirect
 *      URI HTTPS configure cote Apple Dev Console :
 *      https://api.deepsightsynthesis.com/api/auth/apple/callback/native
 *   4. Le backend (cf. backend/src/auth/router.py::apple_callback_native) recoit
 *      le POST form-encoded, et retourne une page HTML qui auto-redirige vers
 *      `deepsight://auth/apple/callback?id_token=...&code=...&state=...`.
 *   5. `openAuthSessionAsync` detecte le deeplink `deepsight://` et resolve
 *      avec l'URL — on parse les query params et on retourne le payload.
 *
 * Pourquoi pas `expo-auth-session` AuthRequest :
 * AuthRequest est concu pour le flow OAuth standard `response_mode=query` ou
 * `fragment`, mais Apple impose `response_mode=form_post` quand on demande les
 * scopes `name` ou `email`. C'est pourquoi on assemble l'URL d'autorisation a
 * la main et on relie sur le bridge backend pour la conversion form_post →
 * deeplink.
 *
 * Notes Apple :
 * - L'`identityToken` (`id_token`) est un JWT signe RS256 par Apple, audience
 *   = APPLE_CLIENT_ID (Service ID = `com.deepsightsynthesis.signin`).
 * - `user` n'est envoye QU'AU PREMIER sign-in, sous forme de JSON Apple :
 *   `{"name":{"firstName":"X","lastName":"Y"},"email":"..."}`.
 * - L'`email` peut etre un alias prive `@privaterelay.appleid.com` si l'user
 *   a active Hide My Email.
 */

import { useCallback } from "react";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

// Service ID web Apple — utilise comme `client_id` dans le flow OAuth web.
// MUST match `APPLE_CLIENT_ID` backend (config Hetzner) + `Service ID` config
// dans Apple Dev Console. Si on doit changer ca un jour il faudra coordonner
// les 3 endroits.
const APPLE_SERVICE_ID = "com.deepsightsynthesis.signin";

// Endpoint Apple OAuth authorize. Constant, ne change jamais.
const APPLE_AUTHORIZE_ENDPOINT = "https://appleid.apple.com/auth/authorize";

// Bridge backend : Apple POST form-encoded → HTML deeplink mobile.
// MUST etre configure comme Return URL dans Apple Dev Console pour ce
// Service ID. Pour les builds dev pointant sur backend local, ca ne marchera
// PAS — Apple n'accepte que des URLs HTTPS publiques dans la Service ID
// config. Solution : utiliser un tunnel ngrok ou pointer sur prod.
const APPLE_CALLBACK_BRIDGE =
  "https://api.deepsightsynthesis.com/api/auth/apple/callback/native";

// Custom scheme intercepte par l'app via expo-linking. Doit matcher le
// `scheme` du app.json + l'intent filter Android.
const DEEPLINK_RETURN_URL = "deepsight://auth/apple/callback";

export interface AppleAuthAndroidResult {
  identityToken: string;
  authorizationCode?: string;
  state: string;
  email?: string | null;
  fullName?: string | null;
}

export type AppleAuthAndroidStatus =
  | { type: "success"; result: AppleAuthAndroidResult }
  | { type: "cancel" }
  | { type: "error"; message: string };

/**
 * Genere un random hex URL-safe via expo-crypto.
 * Sert pour `state` (CSRF) et `nonce` (replay protection cote serveur).
 *
 * On utilise hex plutot que base64url parce que `btoa`/`atob` ne sont pas
 * disponibles sur tous les runtimes React Native (cf. TokenManager.ts qui
 * fait son propre fallback). Hex est universel et toujours URL-safe — un peu
 * plus verbeux (2x) mais on s'en moque pour un random de 32 bytes.
 */
async function generateRandomString(length: number = 32): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Parse Apple's `user` JSON string (envoye sur first sign-in seulement) en
 * { email, fullName }. Tolere les formats partiels et les erreurs JSON sans
 * crasher le flow d'auth.
 */
function parseAppleUserJson(
  raw: string | null,
): { email: string | null; fullName: string | null } {
  if (!raw) return { email: null, fullName: null };
  try {
    const parsed = JSON.parse(raw);
    const firstName = parsed?.name?.firstName ?? "";
    const lastName = parsed?.name?.lastName ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || null;
    const email = parsed?.email ?? null;
    return { email, fullName };
  } catch {
    return { email: null, fullName: null };
  }
}

/**
 * Parse l'URL deeplink retournee par `openAuthSessionAsync` apres le bridge
 * backend. Format :
 *   deepsight://auth/apple/callback?id_token=...&code=...&state=...&user=<urlencoded JSON>
 *   ou (erreur) :
 *   deepsight://auth/apple/callback?error=...
 */
function parseCallbackUrl(url: string): AppleAuthAndroidStatus {
  // expo-linking `Linking.parse` casserait sur un scheme custom dans certains
  // builds — on parse les query params manuellement via URL.
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return { type: "error", message: "URL deeplink sans parametres" };
  }
  const query = url.slice(queryIndex + 1);
  const params = new URLSearchParams(query);

  const error = params.get("error");
  if (error) {
    if (error === "user_cancelled_authorize") {
      return { type: "cancel" };
    }
    return { type: "error", message: `Apple: ${error}` };
  }

  const identityToken = params.get("id_token");
  const state = params.get("state");
  if (!identityToken) {
    return { type: "error", message: "Aucun id_token recu d'Apple" };
  }
  if (!state) {
    return { type: "error", message: "Aucun state recu d'Apple" };
  }

  const { email, fullName } = parseAppleUserJson(params.get("user"));

  return {
    type: "success",
    result: {
      identityToken,
      authorizationCode: params.get("code") ?? undefined,
      state,
      email,
      fullName,
    },
  };
}

/**
 * Construit l'URL d'autorisation Apple avec tous les params requis.
 * Exporte pour testabilite + reusability future (extension Chrome?).
 */
export function buildAppleAuthorizeUrl(params: {
  state: string;
  nonce: string;
}): string {
  const searchParams = new URLSearchParams({
    response_type: "code id_token",
    response_mode: "form_post", // OBLIGATOIRE avec scope name/email
    client_id: APPLE_SERVICE_ID,
    redirect_uri: APPLE_CALLBACK_BRIDGE,
    scope: "name email",
    state: params.state,
    nonce: params.nonce,
  });
  return `${APPLE_AUTHORIZE_ENDPOINT}?${searchParams.toString()}`;
}

/**
 * Hook React qui expose `signInWithAppleAndroid()` — lance le flow OAuth web
 * Apple et resolve avec l'identityToken (id_token) + claims optionnels.
 *
 * Usage cote ecran login :
 *
 *   const { signInWithAppleAndroid } = useAppleAuthAndroid();
 *   const status = await signInWithAppleAndroid();
 *   if (status.type === "success") {
 *     await loginWithApple({
 *       identityToken: status.result.identityToken,
 *       email: status.result.email,
 *       fullName: status.result.fullName,
 *     });
 *   }
 */
export function useAppleAuthAndroid(): {
  signInWithAppleAndroid: () => Promise<AppleAuthAndroidStatus>;
} {
  const signInWithAppleAndroid =
    useCallback(async (): Promise<AppleAuthAndroidStatus> => {
      try {
        const state = await generateRandomString(32);
        const nonce = await generateRandomString(32);
        const authorizeUrl = buildAppleAuthorizeUrl({ state, nonce });

        // openAuthSessionAsync ouvre un Custom Tab Android (ou ASWebAuthenticationSession iOS)
        // et resolve quand l'URL atteint le `returnUrl` (custom scheme).
        const result = await WebBrowser.openAuthSessionAsync(
          authorizeUrl,
          DEEPLINK_RETURN_URL,
        );

        if (result.type === "cancel" || result.type === "dismiss") {
          return { type: "cancel" };
        }

        if (result.type !== "success" || !result.url) {
          return {
            type: "error",
            message: "Connexion Apple interrompue",
          };
        }

        const parsed = parseCallbackUrl(result.url);

        // CSRF check : le `state` retourne doit matcher celui qu'on a envoye.
        if (parsed.type === "success" && parsed.result.state !== state) {
          return {
            type: "error",
            message: "Mismatch state OAuth (CSRF protection)",
          };
        }

        return parsed;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur connexion Apple";
        return { type: "error", message };
      }
    }, []);

  return { signInWithAppleAndroid };
}
