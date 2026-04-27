// extension/src/sidepanel/components/ContextProgressBar.tsx
//
// Barre de progression montrant l'état du streaming context côté agent
// pendant un voice call. Alimentée par `useStreamingVideoContext`.
//
// États visuels :
//  - complete=false → dot pulsant + "Analyse en cours · X% du transcript reçu"
//  - complete=true  → dot fixe + "Analyse complète"
import React from "react";

interface Props {
  /** 0–100 */
  progress: number;
  complete: boolean;
}

export function ContextProgressBar({ progress, complete }: Props): JSX.Element {
  const rounded = Math.round(progress);
  const label = complete
    ? "Analyse complète"
    : `Analyse en cours · ${rounded}% du transcript reçu`;
  return (
    <div className="ds-ctx-bar" data-testid="ds-ctx-bar">
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
