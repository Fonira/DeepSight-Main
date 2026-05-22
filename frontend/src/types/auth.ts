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

/**
 * Représentation publique d'une session utilisateur exposée via
 * `GET /api/auth/sessions`. Doit matcher `UserSessionResponse` dans
 * `backend/src/auth/schemas.py`.
 *
 * - `id`            : UUID String(36) — utilisé pour `DELETE /sessions/{id}`.
 * - `device_label`  : label parsé du user-agent (ex: "Chrome on macOS").
 * - `ip_hash`       : SHA-256(ip + salt) tronqué — pas l'IP brute.
 * - `user_agent`    : User-Agent brut (debug uniquement).
 * - `last_seen_at`  : ISO timestamp de la dernière activité observée.
 * - `created_at`    : ISO timestamp d'émission initiale.
 * - `current`       : true si c'est la session associée au JWT courant.
 */
export interface UserSession {
  id: string;
  device_label?: string | null;
  ip_hash?: string | null;
  user_agent?: string | null;
  last_seen_at: string;
  created_at: string;
  current: boolean;
}
