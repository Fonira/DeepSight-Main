/**
 * 🍪 CookieBanner — Bandeau RGPD pour le consentement cookies
 *
 * Conforme RGPD :
 * - Affichage au premier visit (pas de cookies avant consentement)
 * - Choix Accepter / Refuser / Personnaliser
 * - Stockage du choix en localStorage
 * - Bloque les analytics tant que non accepté
 * - Lien vers la politique de confidentialité
 */

import React, { useState, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface CookiePreferences {
  essential: boolean; // Toujours true, non modifiable
  analytics: boolean; // PostHog, etc.
  marketing: boolean; // Tracking publicitaire (futur)
  consentDate: string; // ISO date du consentement
  version: number; // Version du bandeau (pour re-demander si changement)
}

const CONSENT_STORAGE_KEY = "deepsight_cookie_consent";
const CONSENT_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getStoredConsent(): CookiePreferences | null {
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return null;
    const parsed: CookiePreferences = JSON.parse(stored);
    // Re-demander si la version a changé
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(prefs: CookiePreferences): void {
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Safari private mode */
  }
}

/** Vérifie si l'utilisateur a donné son consentement analytics */
export function hasAnalyticsConsent(): boolean {
  const consent = getStoredConsent();
  return consent?.analytics === true;
}

/** Vérifie si un consentement a été donné (quel qu'il soit) */
export function hasGivenConsent(): boolean {
  return getStoredConsent() !== null;
}

/**
 * Efface le consentement existant et rouvre le bandeau.
 * Permet à l'utilisateur de revenir sur son choix depuis MyAccount.
 */
export function resetCookieConsent(): void {
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    /* Safari private mode */
  }
  // Notifier les services analytics qu'ils doivent se désactiver
  window.dispatchEvent(
    new CustomEvent("cookie-consent-updated", {
      detail: { essential: true, analytics: false, marketing: false },
    }),
  );
  // Re-afficher le banner
  window.dispatchEvent(new CustomEvent("cookie-banner-show"));
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);

  useEffect(() => {
    // Afficher seulement si pas de consentement stocké
    const consent = getStoredConsent();
    if (!consent) {
      // Petit délai pour ne pas bloquer le rendu initial
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listener pour réouverture manuelle (depuis MyAccount → resetCookieConsent)
  useEffect(() => {
    const handler = () => {
      // Reset les checkboxes à leurs valeurs précédentes (ou défaut false)
      const consent = getStoredConsent();
      setAnalyticsChecked(consent?.analytics ?? false);
      setMarketingChecked(consent?.marketing ?? false);
      setShowDetails(true);
      setVisible(true);
    };
    window.addEventListener("cookie-banner-show", handler);
    return () => window.removeEventListener("cookie-banner-show", handler);
  }, []);

  const saveAndClose = useCallback(
    (
      prefs: Omit<CookiePreferences, "consentDate" | "version" | "essential">,
    ) => {
      const fullPrefs: CookiePreferences = {
        essential: true,
        analytics: prefs.analytics,
        marketing: prefs.marketing,
        consentDate: new Date().toISOString(),
        version: CONSENT_VERSION,
      };
      storeConsent(fullPrefs);
      setVisible(false);

      // Dispatch un événement custom pour que les services analytics puissent réagir
      window.dispatchEvent(
        new CustomEvent("cookie-consent-updated", { detail: fullPrefs }),
      );
    },
    [],
  );

  const handleAcceptAll = useCallback(() => {
    saveAndClose({ analytics: true, marketing: true });
  }, [saveAndClose]);

  const handleRefuseAll = useCallback(() => {
    saveAndClose({ analytics: false, marketing: false });
  }, [saveAndClose]);

  const handleSavePreferences = useCallback(() => {
    saveAndClose({ analytics: analyticsChecked, marketing: marketingChecked });
  }, [saveAndClose, analyticsChecked, marketingChecked]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 sm:p-6 pointer-events-none">
      <div
        className="
          pointer-events-auto mx-auto max-w-2xl
          bg-bg-secondary border border-border-default rounded-2xl
          shadow-xl
          p-5 sm:p-6
          animate-in slide-in-from-bottom-4 duration-500
        "
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span
            className="text-2xl flex-shrink-0"
            role="img"
            aria-label="cookie"
          >
            🍪
          </span>
          <div>
            <h3 className="text-white font-semibold text-base leading-tight">
              Nous respectons votre vie privée
            </h3>
            <p className="text-text-muted text-sm mt-1 leading-relaxed">
              DeepSight utilise des cookies essentiels au fonctionnement du
              site. Avec votre accord, nous utilisons aussi des cookies
              d'analyse pour améliorer votre expérience.{" "}
              <a
                href="/legal?tab=cookies"
                className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
              >
                Politique de cookies
              </a>
            </p>
          </div>
        </div>

        {/* Détails personnalisation */}
        {showDetails && (
          <div className="mb-4 space-y-3 pl-9">
            {/* Essentiels — toujours actifs */}
            <label className="flex items-center gap-3 cursor-not-allowed opacity-70">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-4 h-4 rounded accent-blue-500"
              />
              <div>
                <span className="text-text-primary text-sm font-medium">
                  Essentiels
                </span>
                <span className="text-text-muted text-xs ml-2">
                  — toujours actifs
                </span>
              </div>
            </label>

            {/* Analytics */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-text-primary text-sm font-medium">
                  Analyse d'usage
                </span>
                <span className="text-text-muted text-xs ml-2">
                  — comprendre comment vous utilisez DeepSight
                </span>
              </div>
            </label>

            {/* Marketing */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={marketingChecked}
                onChange={(e) => setMarketingChecked(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500 cursor-pointer"
              />
              <div>
                <span className="text-text-primary text-sm font-medium">
                  Marketing
                </span>
                <span className="text-text-muted text-xs ml-2">
                  — publicités pertinentes (désactivé pour le moment)
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 pl-0 sm:pl-9">
          {!showDetails ? (
            <>
              <button
                onClick={handleAcceptAll}
                className="
                  flex-1 sm:flex-none px-5 py-2.5 rounded-xl
                  bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                  text-white text-sm font-medium
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50
                "
              >
                Tout accepter
              </button>
              <button
                onClick={handleRefuseAll}
                className="
                  flex-1 sm:flex-none px-5 py-2.5 rounded-xl
                  bg-bg-tertiary hover:bg-bg-hover active:bg-bg-active
                  text-text-secondary hover:text-text-primary text-sm font-medium
                  border border-border-default
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-accent-primary/30
                "
              >
                Tout refuser
              </button>
              <button
                onClick={() => setShowDetails(true)}
                className="\r\n                  flex-1 sm:flex-none px-5 py-2.5 rounded-xl\r\n                  text-text-muted hover:text-text-secondary text-sm\r\n                  transition-colors duration-200\r\n                  focus:outline-none focus:ring-2 focus:ring-white/20\r\n                "
              >
                Personnaliser
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSavePreferences}
                className="
                  flex-1 sm:flex-none px-5 py-2.5 rounded-xl
                  bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                  text-white text-sm font-medium
                  transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500/50
                "
              >
                Enregistrer mes choix
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className="\r\n                  flex-1 sm:flex-none px-5 py-2.5 rounded-xl\r\n                  text-text-muted hover:text-text-secondary text-sm\r\n                  transition-colors duration-200\r\n                  focus:outline-none focus:ring-2 focus:ring-white/20\r\n                "
              >
                Retour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
