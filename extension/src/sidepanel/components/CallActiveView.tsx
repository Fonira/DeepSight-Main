// extension/src/sidepanel/components/CallActiveView.tsx
//
// Vue affichée pendant un voice call actif. Montre :
//   - Indicateur live + temps écoulé MM:SS
//   - Pseudo-waveform (cosmétique)
//   - Bouton Mute (toggle micro côté navigateur)
//   - Bouton Raccrocher (déclenche endSession + UpgradeCTA si trial)
import React from "react";

interface Props {
  elapsedSec: number;
  onMute: () => void;
  onHangup: () => void;
}

export function CallActiveView({
  elapsedSec,
  onMute,
  onHangup,
}: Props): JSX.Element {
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  return (
    <div className="ds-call-active" data-testid="ds-call-active">
      <header className="ds-call-active__header">
        <div className="ds-call-active__indicator" aria-hidden />
        <span className="ds-call-active__label">En appel</span>
        <span className="ds-call-active__elapsed">
          · {mm}:{ss}
        </span>
      </header>
      <div className="ds-call-active__waveform" aria-hidden>
        {[30, 80, 50, 90, 40, 70, 55].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <footer className="ds-call-active__footer">
        <button type="button" className="ds-call-active__mute" onClick={onMute}>
          🔇 Mute
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="ds-call-active__hangup ds-hangup"
        >
          📞 Raccrocher
        </button>
      </footer>
    </div>
  );
}
