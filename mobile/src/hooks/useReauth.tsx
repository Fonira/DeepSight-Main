/**
 * 🪝 useReauth — Auth V2 Wave 1 Mobile Step 2
 *
 * Hook React Native qui ouvre `PasswordReauthBottomSheet` à la demande,
 * attend que l'utilisateur entre son mot de passe (POST /api/auth/reauth)
 * et resolve la Promise avec le `reauth_token` à passer en header
 * `X-Reauth-Token` sur l'endpoint sensible cible.
 *
 * Cache mémoire (PAS expo-secure-store) : si un token précédent est encore
 * valide pour la même audience (TTL 5 min côté backend, on garde 30s
 * de marge), on le retourne immédiatement sans ré-ouvrir le sheet.
 *
 * Mirror du pattern web (frontend/src/hooks/useReauth.tsx).
 *
 * Usage :
 *   const { requestReauth, sheet } = useReauth();
 *   // Monter `{sheet}` quelque part dans l'arbre (ex. le screen courant).
 *   const token = await requestReauth("billing");
 *   await api.changePlan({...}, { headers: { "X-Reauth-Token": token }});
 */
import React, { useCallback, useRef, useState } from "react";
import { PasswordReauthBottomSheet } from "../components/auth/PasswordReauthBottomSheet";
import type { ReauthAudience } from "../types/auth";

/**
 * Marge de sécurité retirée du TTL pour éviter d'envoyer un token
 * qui expirerait pendant le vol réseau.
 */
const EXPIRY_SAFETY_MARGIN_MS = 30_000;

/** Backend TTL fixé à 5 min — cf. ReauthResponse côté backend. */
const REAUTH_TTL_MS = 5 * 60 * 1000;

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
   * Ouvre le BottomSheet de re-auth et résout avec un `reauth_token` valide.
   * Si un token précédent pour la même `audience` est encore valide en
   * cache, il est retourné sans ouvrir le sheet.
   *
   * @throws Error si l'utilisateur annule le sheet.
   */
  requestReauth: (audience: ReauthAudience) => Promise<string>;
  /**
   * Élément React à monter dans l'arbre (rend le BottomSheet).
   * Typiquement à placer dans le composant qui consomme le hook.
   */
  sheet: React.ReactElement | null;
}

/**
 * @internal — exporté pour tests.
 */
export function _isTokenValid(cached: CachedToken | null): boolean {
  if (!cached) return false;
  return Date.now() < cached.expiresAt;
}

export function useReauth(): UseReauthReturn {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  // Cache mémoire par audience (Map = scope sub-key clé).
  const cacheRef = useRef<Map<ReauthAudience, CachedToken>>(new Map());

  const requestReauth = useCallback(
    (audience: ReauthAudience): Promise<string> => {
      // Cache hit ?
      const cached = cacheRef.current.get(audience) ?? null;
      if (_isTokenValid(cached)) {
        return Promise.resolve(cached!.token);
      }
      // Sinon ouvrir le sheet.
      return new Promise<string>((resolve, reject) => {
        setPending({ audience, resolve, reject });
      });
    },
    [],
  );

  const handleSuccess = useCallback(
    (token: string) => {
      if (!pending) return;
      const expiresAt = Date.now() + REAUTH_TTL_MS - EXPIRY_SAFETY_MARGIN_MS;
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

  const sheet = pending ? (
    <PasswordReauthBottomSheet
      visible
      audience={pending.audience}
      onSuccess={handleSuccess}
      onCancel={handleCancel}
    />
  ) : null;

  return { requestReauth, sheet };
}

export default useReauth;
