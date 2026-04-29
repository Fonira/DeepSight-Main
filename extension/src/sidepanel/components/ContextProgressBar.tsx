// extension/src/sidepanel/components/ContextProgressBar.tsx
//
// Barre de progression montrant l'état du streaming context côté agent
// pendant un voice call. Alimentée par `useStreamingVideoContext`.
//
// États visuels :
//  - phase fournie → label dynamique reflétant l'étape pipeline
//    (searching / transcriptReceived / mistralAnalyzing / complete).
//  - sinon (back-compat) → fallback historique
//    "Analyse en cours · X% du transcript reçu" / "Analyse complète".
//
// A11y (N2) : role="progressbar" + aria-valuenow + aria-label pour annonce
// vocale lecteur d'écran lors des updates SSE.
import React from "react";
import { useTranslation } from "../../i18n/useTranslation";
import type { ContextPhase } from "../hooks/useStreamingVideoContext";

interface Props {
  /** 0–100 */
  progress: number;
  complete: boolean;
  /** Phase du pipeline backend. Si fourni, drive le label à la place du %. */
  phase?: ContextPhase;
  /** Nombre de transcript chunks reçus (utilisé si phase=transcriptReceived). */
  transcriptChunksReceived?: number;
  /** Total transcript chunks (utilisé si phase=transcriptReceived). */
  transcriptChunksTotal?: number;
}

export function ContextProgressBar({
  progress,
  complete,
  phase,
  transcriptChunksReceived = 0,
  transcriptChunksTotal = 0,
}: Props): JSX.Element {
  const { t } = useTranslation();
  const rounded = Math.round(progress);

  // Construction des libellés (visible + aria) selon la phase si fournie,
  // sinon comportement back-compat (label "Analyse en cours · X%").
  let label: string;
  let ariaLabel: string;
  if (phase) {
    switch (phase) {
      case "searching":
        label = t.voiceCall.ctxBar.phaseSearching;
        ariaLabel = t.voiceCall.ctxBar.ariaPhaseSearching;
        break;
      case "transcriptReceived":
        label = t.voiceCall.ctxBar.phaseTranscriptReceived
          .replace("{n}", String(transcriptChunksReceived))
          .replace("{total}", String(transcriptChunksTotal));
        ariaLabel = t.voiceCall.ctxBar.ariaPhaseTranscriptReceived
          .replace("{n}", String(transcriptChunksReceived))
          .replace("{total}", String(transcriptChunksTotal));
        break;
      case "mistralAnalyzing":
        label = t.voiceCall.ctxBar.phaseMistralAnalyzing;
        ariaLabel = t.voiceCall.ctxBar.ariaPhaseMistralAnalyzing;
        break;
      case "complete":
      default:
        label = t.voiceCall.ctxBar.phaseComplete;
        ariaLabel = t.voiceCall.ctxBar.ariaPhaseComplete;
        break;
    }
  } else {
    label = complete
      ? t.voiceCall.ctxBar.complete
      : t.voiceCall.ctxBar.inProgress.replace("{percent}", String(rounded));
    ariaLabel = complete
      ? t.voiceCall.ctxBar.ariaComplete
      : t.voiceCall.ctxBar.ariaInProgress.replace("{percent}", String(rounded));
  }

  const dotState = complete || phase === "complete" ? "complete" : "live";
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
        <span className={`ds-ctx-bar__dot ${dotState}`} />
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
