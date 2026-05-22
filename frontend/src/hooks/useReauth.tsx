/**
 * 🪝 useReauth — Auth V2 Wave 1 Step 1 hook
 *
 * Hook React qui ouvre `PasswordReauthModal` à la demande, attend que
 * l'utilisateur entre son mot de passe (POST /api/auth/reauth) et resolve
 * la Promise avec le `reauth_token` à passer en header `X-Reauth-Token`
 * sur l'endpoint sensible cible.
 *
 * Cache mémoire (PAS localStorage) : si un token précédent est encore
 * valide pour la même audience (TTL 5 min côté backend, on garde 30s
 * de marge), on le retourne immédiatement sans ré-ouvrir la modal.
 *
 * Usage :
 *   const { requestReauth, modal } = useReauth();
 *   // Monter `{modal}` quelque part dans l'arbre (ex. dans le layout)
 *   const token = await requestReauth("billing");
 *   await api.changePlan({...}, { headers: { "X-Reauth-Token": token }});
 */

import { useCallback, useRef, useState } from "react";
import type { ReauthAudience } from "../types/auth";
import { PasswordReauthModal } from "../components/auth/PasswordReauthModal";

/**
 * Marge de sécurité retirée du TTL pour éviter d'envoyer un token
 * qui expirerait pendant le vol réseau.
 */
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

interface CachedToken {
  token: string;
  /** Date.now() epoch ms when the token expires (already - safety margin) */
  expiresAt: number;
}

interface PendingRequest {
  audience: ReauthAudience;
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}

export interface UseReauthReturn {
  /**
   * Ouvre la modal de re-auth et résout avec un `reauth_token` valide.
   * Si un token précédent pour la même `audience` est encore valide en
   * cache, il est retourné sans ouvrir la modal.
   *
   * @throws Error si l'utilisateur annule la modal.
   */
  requestReauth: (audience: ReauthAudience) => Promise<string>;
  /**
   * Élément React à monter dans l'arbre (rend la modal en portail).
   * Typiquement à placer dans le composant qui consomme le hook.
   */
  modal: React.ReactElement | null;
}

/**
 * @internal — exporté pour tests
 */
export function _isTokenValid(cached: CachedToken | null): boolean {
  if (!cached) return false;
  return Date.now() < cached.expiresAt;
}

export function useReauth(): UseReauthReturn {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  // Cache mémoire par audience (Map = scope sub-key clé)
  const cacheRef = useRef<Map<ReauthAudience, CachedToken>>(new Map());

  const requestReauth = useCallback(
    (audience: ReauthAudience): Promise<string> => {
      // Cache hit ?
      const cached = cacheRef.current.get(audience) ?? null;
      if (_isTokenValid(cached)) {
        return Promise.resolve(cached!.token);
      }
      // Sinon ouvrir la modal
      return new Promise<string>((resolve, reject) => {
        setPending({ audience, resolve, reject });
      });
    },
    [],
  );

  const handleSuccess = useCallback(
    (token: string) => {
      if (!pending) return;
      // Backend renvoie expires_in en secondes. Par défaut côté backend
      // (Sprint C V2) = 300s = 5 min. On garde une marge de 30s.
      // Le service api.requestReauth retourne uniquement le token —
      // pour la durée on suppose 5 min puisque le hook n'a pas accès
      // à expires_in via l'API. Cf. spec backend ReauthResponse.
      const ttlMs = 5 * 60 * 1000;
      const expiresAt = Date.now() + ttlMs - EXPIRY_SAFETY_MARGIN_MS;
      cacheRef.current.set(pending.audience, { token, expiresAt });
      pending.resolve(token);
      setPending(null);
    },
    [pending],
  );

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.reject(new Error("Reauth cancelled by user"));
    setPending(null);
  }, [pending]);

  const modal = pending ? (
    <PasswordReauthModal
      open={true}
      audience={pending.audience}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  ) : null;

  return { requestReauth, modal };
}

export default useReauth;
