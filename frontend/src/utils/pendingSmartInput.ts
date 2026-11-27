/**
 * Passage de la saisie du dashboard minimal vers le dashboard complet (legacy).
 *
 * Le dashboard minimal (accueil par défaut) ne sait lancer que l'analyse d'une
 * URL. Les modes recherche, texte, images et bibliothèque sont implémentés dans
 * DashboardPageLegacy : on y transmet la saisie via sessionStorage puis on
 * ouvre /dashboard?legacy=1, qui la pré-remplit.
 */
import type { SmartInputValue } from "../components/SmartInputBar";

const STORAGE_KEY = "ds_pending_smart_input";

export const LEGACY_DASHBOARD_PATH = "/dashboard?legacy=1";

export function savePendingSmartInput(value: SmartInputValue): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Quota dépassé (images lourdes) : on transmet au moins le texte saisi.
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...value, images: undefined }),
      );
    } catch {
      // sessionStorage indisponible (navigation privée stricte) : rien à faire.
    }
  }
}

export function takePendingSmartInput(): SmartInputValue | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "mode" in parsed &&
      typeof (parsed as { mode: unknown }).mode === "string"
    ) {
      return parsed as SmartInputValue;
    }
  } catch {
    // JSON corrompu ou stockage indisponible : on ignore.
  }
  return null;
}
