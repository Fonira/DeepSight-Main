/**
 * featureFlags — Wrapper léger autour de GET /api/features pour gating UI.
 *
 * Cache 5 min (le flag change rarement). Fallback `true` (optimistic) si erreur
 * réseau ou endpoint absent — la UI reste visible et le backend renvoie 404
 * gracieux quand le flag est OFF (cf. Phase 1 backend).
 */

import { API_BASE_URL } from "../constants/config";

interface FeatureFlagsResponse {
  semantic_search_v1?: boolean;
  // Autres flags peuvent s'ajouter au besoin sans breaking change.
}

let cache: { value: FeatureFlagsResponse; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  try {
    const res = await fetch(`${API_BASE_URL}/api/features`);
    if (!res.ok) throw new Error("flags fetch failed");
    const value = (await res.json()) as FeatureFlagsResponse;
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  } catch {
    // Optimistic fallback : on laisse l'UI visible. Le backend renverra 404
    // sur les endpoints quand le flag est OFF — l'UI gère l'erreur gracieusement.
    return { semantic_search_v1: true };
  }
}

export async function isSemanticSearchV1Enabled(): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags.semantic_search_v1 ?? true;
}

/**
 * Vide le cache des feature flags.
 * Utile pour les tests et lors du logout/login (re-check).
 */
export function clearFeatureFlagsCache(): void {
  cache = null;
}
