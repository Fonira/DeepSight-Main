// extension/src/sidepanel/components/ContextProgressBar.tsx
//
// Barre de progression montrant l'état du streaming context côté agent
// pendant un voice call. Alimentée par `useStreamingVideoContext`.
//
// États visuels :
//  - complete=false → dot pulsant + "Analyse en cours · X% du transcript reçu"
//  - complete=true  → dot fixe + "Analyse complète"
//
// A11y (N2) : role="progressbar" + aria-valuenow + aria-label pour annonce
// vocale lecteur d'écran lors des updates SSE.
import React from "react";
import { useTranslation } from "../../i18n/useTranslation";

interface Props {
  /** 0–100 */
  progress: number;
  complete: boolean;
}

export function ContextProgressBar({ progress, complete }: Props): JSX.Element {
  const { t } = useTranslation();
  const rounded = Math.round(progress);
  const label = complete
    ? t.voiceCall.ctxBar.complete
    : t.voiceCall.ctxBar.inProgress.replace("{percent}", String(rounded));
  const ariaLabel = complete
    ? t.voiceCall.ctxBar.ariaComplete
    : t.voiceCall.ctxBar.ariaInProgress.replace("{percent}", String(rounded));
  return (
    <div
      className="ds-ctx-bar"
      data-testid="ds-ctx-bar"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-label={ariaLabel}
    >
      <div className="ds-ctx-bar__label">
        <span className={`ds-ctx-bar__dot ${complete ? "complete" : "live"}`} />
        <span>{label}</span>
      </div>
      <div className="ds-ctx-bar__track">
        <div
          className="ds-ctx-bar__fill"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </div>
  );
}
