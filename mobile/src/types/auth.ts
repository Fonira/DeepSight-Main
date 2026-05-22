/**
 * Auth V2 types — Wave 1 Mobile (re-auth, sessions, "stay signed in")
 *
 * Mirror of frontend/src/types/auth.ts. Consume backend Sprint C + Wave 1 V2
 * (PR #533 et suite). Endpoint: POST /api/auth/reauth → { reauth_token, expires_in }
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
 * Représentation d'une session active multi-appareils — Wave 1 V2 (Step 3).
 *
 * Mirror du schema backend `UserSession` (PR #533) et frontend
 * `frontend/src/types/auth.ts`. Consommé par la page « Mes appareils »
 * (GET /api/auth/sessions, DELETE /api/auth/sessions/{id},
 *  DELETE /api/auth/sessions) pour permettre la révocation individuelle
 * ou globale (sauf session courante).
 *
 * - `id`              : identifiant opaque de la session (UUID côté backend).
 * - `device_label`    : libellé lisible (ex. "Chrome on macOS", "iPhone").
 *                       Optionnel — peut être null/absent si non détecté.
 * - `ip_hash`         : hash SHA-256 tronqué de l'IP (jamais l'IP en clair).
 *                       Optionnel.
 * - `user_agent`      : User-Agent brut de la requête login.
 *                       Optionnel, principalement debug.
 * - `last_seen_at`    : ISO 8601 — dernière requête vue avec ce refresh token.
 * - `created_at`      : ISO 8601 — création de la session (login initial).
 * - `current`         : true si c'est la session de l'appel en cours
 *                       (le bouton "Révoquer" est masqué pour cette session).
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

/**
 * Réponse générique des endpoints DELETE /api/auth/sessions{/{id}}.
 */
export interface MessageResponse {
  success: boolean;
  message: string;
}
