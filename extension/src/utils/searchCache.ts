/**
 * searchCache — Cache local des 5 dernières queries de recherche.
 *
 * Stocké dans `chrome.storage.local` clé `recent_queries` (cf. spec § 6.3).
 * Pas de sync cross-device en V1 (cf. spec « Pas de sync cross-device pour V1 »).
 * Le serveur expose `/api/search/recent-queries` pour le miroir cross-device,
 * consommé par le tier web — l'extension reste 100 % locale pour minimiser
 * la latence à l'ouverture du sidepanel.
 *
 * LRU stratégie :
 *   - push : nouvelle query → head, dedup, max 5
 *   - get  : retourne array trié (head = most recent)
 *   - clear: wipe entry
 */

import Browser from "./browser-polyfill";

const STORAGE_KEY = "recent_queries";
const MAX_QUERIES = 5;

export async function getCachedQueries(): Promise<string[]> {
  try {
    const data = (await Browser.storage.local.get(STORAGE_KEY)) as {
      [STORAGE_KEY]?: string[];
    };
    const queries = data[STORAGE_KEY];
    return Array.isArray(queries) ? queries.slice(0, MAX_QUERIES) : [];
  } catch {
    return [];
  }
}

export async function pushCachedQuery(query: string): Promise<void> {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = await getCachedQueries();
  const deduped = existing.filter((q) => q !== trimmed);
  const next = [trimmed, ...deduped].slice(0, MAX_QUERIES);
  try {
    await Browser.storage.local.set({ [STORAGE_KEY]: next });
  } catch {
    // Storage quota or permission error — fail silently.
  }
}

export async function clearCachedQueries(): Promise<void> {
  try {
    await Browser.storage.local.remove(STORAGE_KEY);
  } catch {
    // Ignore errors on clear.
  }
}
