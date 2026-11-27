/**
 * Lecture de l'expiration d'un JWT côté extension.
 *
 * Aucune vérification de signature : le backend reste seul juge de la
 * validité. On s'en sert uniquement pour rafraîchir l'access token AVANT
 * qu'il n'expire (60 min depuis le Sprint C) au lieu d'attendre le 401.
 */

/** Expiration du JWT en millisecondes epoch, ou `null` si illisible. */
export function getJwtExpiryMs(token: string | null | undefined): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp * 1000
      : null;
  } catch {
    return null;
  }
}

/**
 * `true` si le token expire dans moins de `marginMs` (ou est déjà expiré).
 * Un token dont l'expiration est illisible est considéré comme valide : le
 * 401 éventuel déclenchera le refresh habituel.
 */
export function expiresWithin(
  token: string | null | undefined,
  marginMs: number,
  now: number = Date.now(),
): boolean {
  const expiry = getJwtExpiryMs(token);
  return expiry !== null && expiry - now <= marginMs;
}
