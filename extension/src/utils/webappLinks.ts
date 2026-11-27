/**
 * Liens « Ouvrir dans l'app » vers le site DeepSight.
 *
 * Source unique des routes du front actuel (frontend/src/App.tsx). Les
 * anciennes URL de l'extension — /summary/:id, /hub/analysis/:id, /library,
 * /mobile, /analyze, /study/<videoId> — n'existent plus et tombaient sur la
 * page 404 ; /pricing et /register sont des alias qui perdent la query
 * string (UTM) lors de la redirection.
 */

import { WEBAPP_URL } from "./config";

/** Onglets du Hub adressables via `?tab=` (frontend/src/components/hub/types.ts). */
export type HubTab =
  | "synthesis"
  | "quiz"
  | "flashcards"
  | "reliability"
  | "geo"
  | "visual"
  | "chat";

/** Features proposées en CTA après une synthèse (clés de PlanFeatures). */
export type WebFeature =
  | "flashcards"
  | "mind_maps"
  | "web_search"
  | "exports"
  | "playlists";

export const HOME_URL = WEBAPP_URL;
export const DASHBOARD_URL = `${WEBAPP_URL}/dashboard`;
export const HUB_URL = `${WEBAPP_URL}/hub`;
export const HISTORY_URL = `${WEBAPP_URL}/hub?view=history`;
export const STUDY_HUB_URL = `${WEBAPP_URL}/study`;
export const UPGRADE_URL = `${WEBAPP_URL}/upgrade`;
export const REGISTER_URL = `${WEBAPP_URL}/login?tab=register`;
export const FORGOT_PASSWORD_URL = `${WEBAPP_URL}/forgot-password`;
export const PRIVACY_URL = `${WEBAPP_URL}/legal/privacy`;
export const TERMS_URL = `${WEBAPP_URL}/legal/cgu`;

/** Page d'upgrade avec paramètres de suivi (UTM, feature…). */
export function upgradeUrl(params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return UPGRADE_URL;
  return `${UPGRADE_URL}?${new URLSearchParams(params).toString()}`;
}

/** Une analyse dans le Hub (`/hub?conv=<summaryId>[&tab=…]`). */
export function analysisUrl(summaryId: number, tab?: HubTab): string {
  const params = new URLSearchParams({ conv: String(summaryId) });
  if (tab) params.set("tab", tab);
  return `${HUB_URL}?${params.toString()}`;
}

/** Mode étude (quiz + flashcards) d'une analyse. */
export function studyUrl(summaryId: number): string {
  return `${STUDY_HUB_URL}/${encodeURIComponent(String(summaryId))}`;
}

/**
 * Où ouvrir une feature web pour une analyse donnée :
 *  - flashcards        → mode étude
 *  - cartes mentales,
 *    exports           → vue « Analyse complète » (même lien que le Hub web)
 *  - recherche web     → chat du Hub (la recherche web s'y active)
 *  - playlists         → tableau de bord (création de playlist)
 */
export function featureUrl(summaryId: number, feature: WebFeature): string {
  switch (feature) {
    case "flashcards":
      return studyUrl(summaryId);
    case "mind_maps":
    case "exports":
      return `${DASHBOARD_URL}?id=${encodeURIComponent(String(summaryId))}&legacy=1`;
    case "web_search":
      return analysisUrl(summaryId, "chat");
    case "playlists":
      return DASHBOARD_URL;
  }
}
