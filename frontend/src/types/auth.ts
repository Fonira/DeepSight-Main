/**
 * Auth V2 types — Wave 1 (re-auth, sessions, "stay signed in")
 *
 * Consume backend Sprint C + Wave 1 V2 (PR #533 et suite).
 * Endpoint: POST /api/auth/reauth → { reauth_token, expires_in }
 * Client must then re-call sensitive endpoint with header X-Reauth-Token.
 */

/**
 * Audience scope du re-auth token côté backend.
 * Doit matcher `ReauthAudience` dans backend/src/auth/schemas.py.
 */
export type ReauthAudience =
  | "billing"
  | "delete"
  | "change-email"
  | "change-password";

/**
 * Réponse du backend pour POST /api/auth/reauth.
 * - `reauth_token` : JWT scopé à passer en header X-Reauth-Token (TTL 5 min).
 * - `expires_in`   : durée de vie en secondes (typiquement 300).
 */
export interface ReauthResponse {
  reauth_token: string;
  expires_in: number;
}
