// extension/src/sidepanel/components/CallActiveView.tsx
//
// Vue affichée pendant un voice call actif. Montre :
//   - Indicateur live + temps écoulé MM:SS
//   - Pseudo-waveform (cosmétique)
//   - Bouton Mute (toggle micro côté navigateur)
//   - Bouton Raccrocher (déclenche endSession + UpgradeCTA si trial)
//
// A11y (N2) : aria-label sur les 2 boutons d'action + role="timer" sur
// elapsed pour que les lecteurs d'écran annoncent le temps écoulé.
import React from "react";
import { useTranslation } from "../../i18n/useTranslation";

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
  const { t } = useTranslation();
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");
  return (
    <div className="ds-call-active" data-testid="ds-call-active">
      <header className="ds-call-active__header">
        <div className="ds-call-active__indicator" aria-hidden />
        <span className="ds-call-active__label">
          {t.voiceCall.callActive.live}
        </span>
        <span className="ds-call-active__elapsed" role="timer" aria-live="off">
          · {mm}:{ss}
        </span>
      </header>
      <div className="ds-call-active__waveform" aria-hidden>
        {[30, 80, 50, 90, 40, 70, 55].map((h, i) => (
          <span key={i} style={{ height: `${h}%` }} />
        ))}
      </div>
      <footer className="ds-call-active__footer">
        <button
          type="button"
          className="ds-call-active__mute"
          onClick={onMute}
          aria-label={t.voiceCall.callActive.muteAriaLabel}
        >
          {t.voiceCall.callActive.mute}
        </button>
        <button
          type="button"
          onClick={onHangup}
          className="ds-call-active__hangup ds-hangup"
          aria-label={t.voiceCall.callActive.hangupAriaLabel}
        >
          {t.voiceCall.callActive.hangup}
        </button>
      </footer>
    </div>
  );
}
