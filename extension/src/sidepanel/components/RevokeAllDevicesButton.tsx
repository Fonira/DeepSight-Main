// extension/src/sidepanel/components/RevokeAllDevicesButton.tsx
//
// Bouton "Déconnecter tous les autres appareils" — Sprint Auth V2 Step 1.
//
// Consomme DELETE /api/auth/sessions (PR #533 backend) via le service worker
// (action REVOKE_ALL_OTHER_SESSIONS). La session courante reste valide ; toutes
// les autres sessions de l'utilisateur sont révoquées (refresh tokens hashés
// dans la blocklist Redis côté backend).
//
// UX :
//  - Click → window.confirm pour valider l'intention
//  - Pendant l'appel → bouton désactivé + libellé "Révocation…"
//  - Succès → message vert inline ("✅ N sessions révoquées")
//  - Erreur → message rouge inline (message backend ou fallback générique)
//  - Si onSuccess fourni, appelé après réponse OK (ex: refresh /me)
//
// Le composant est self-contained (pas de toast App-level requis) : le feedback
// reste local à la section "Sécurité" du sidepanel, cohérent avec le pattern
// des cards d'analyse existantes.
import React, { useState } from "react";
import Browser from "../../utils/browser-polyfill";
import type { MessageResponse } from "../../types";
import { useTranslation } from "../../i18n/useTranslation";

export interface RevokeAllDevicesButtonProps {
  /** Callback optionnel appelé après révocation réussie (ex: rafraîchir /me). */
  onSuccess?: () => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const LABELS = {
  fr: {
    title: "Sécurité",
    desc: "Si vous avez perdu un appareil ou suspectez un accès non autorisé, déconnectez toutes les autres sessions. Votre session actuelle reste active.",
    button: "Déconnecter tous les autres appareils",
    loading: "Révocation…",
    confirm:
      "Toutes vos autres sessions seront déconnectées (mobile, web, autres extensions). Continuer ?",
    errorFallback: "Échec de la révocation. Réessayer plus tard.",
    sessionExpired: "Session expirée — reconnectez-vous.",
    networkError: "Erreur réseau — réessayer plus tard.",
  },
  en: {
    title: "Security",
    desc: "If you lost a device or suspect unauthorized access, sign out all other sessions. Your current session stays active.",
    button: "Sign out all other devices",
    loading: "Revoking…",
    confirm:
      "All your other sessions will be signed out (mobile, web, other extensions). Continue?",
    errorFallback: "Revocation failed. Try again later.",
    sessionExpired: "Session expired — please log in again.",
    networkError: "Network error — try again later.",
  },
} as const;

export const RevokeAllDevicesButton: React.FC<RevokeAllDevicesButtonProps> = ({
  onSuccess,
}) => {
  const { language } = useTranslation();
  const l = LABELS[language] ?? LABELS.fr;
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleClick = async (): Promise<void> => {
    if (status.kind === "loading") return;
    // Confirmation native — suffisant pour Step 1 (UI modal custom = Step 2).
    if (!window.confirm(l.confirm)) return;

    setStatus({ kind: "loading" });
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({ action: "REVOKE_ALL_OTHER_SESSIONS" });

      if (response?.success) {
        const result = response.result as { message?: string } | undefined;
        setStatus({
          kind: "success",
          message: result?.message ?? l.button,
        });
        onSuccess?.();
        return;
      }

      // success === false → message d'erreur backend ou fallback.
      const errorMsg = response?.error ?? l.errorFallback;
      // SESSION_EXPIRED est levé par apiRequest quand le refresh échoue.
      const friendly =
        errorMsg === "SESSION_EXPIRED"
          ? l.sessionExpired
          : errorMsg === "NETWORK_ERROR"
            ? l.networkError
            : errorMsg;
      setStatus({ kind: "error", message: friendly });
    } catch (e) {
      setStatus({
        kind: "error",
        message: (e as Error).message || l.errorFallback,
      });
    }
  };

  const isLoading = status.kind === "loading";

  return (
    <div className="v3-card" data-testid="revoke-all-devices-card">
      <div className="v3-card-eyebrow">{l.title}</div>
      <p className="v3-card-desc">{l.desc}</p>
      <button
        type="button"
        className="v3-button-secondary"
        onClick={handleClick}
        disabled={isLoading}
        aria-label={l.button}
        data-testid="revoke-all-devices-btn"
      >
        {isLoading ? l.loading : l.button}
      </button>
      {status.kind === "success" && (
        <p
          role="status"
          aria-live="polite"
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#86efac",
          }}
          data-testid="revoke-all-devices-success"
        >
          {status.message}
        </p>
      )}
      {status.kind === "error" && (
        <p
          role="alert"
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#fca5a5",
          }}
          data-testid="revoke-all-devices-error"
        >
          {status.message}
        </p>
      )}
    </div>
  );
};
