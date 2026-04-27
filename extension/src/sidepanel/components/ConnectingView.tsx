// extension/src/sidepanel/components/ConnectingView.tsx
//
// Vue affichée pendant que la session voice est en cours de création
// côté backend (~1-2s). Mic pulsant + barre indéterminée + reassure.
//
// A11y (N2) : role="status" + aria-live="polite" pour annoncer la phase
// aux lecteurs d'écran.
import React from "react";
import { useTranslation } from "../../i18n/useTranslation";

export function ConnectingView(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div
      className="ds-connecting"
      data-testid="ds-connecting"
      role="status"
      aria-live="polite"
      aria-label={t.voiceCall.connecting.ariaStatus}
    >
      <div className="ds-connecting__mic" aria-hidden>
        🎙️
      </div>
      <h2>{t.voiceCall.connecting.title}</h2>
      <p>{t.voiceCall.connecting.subtitle}</p>
      <div className="ds-connecting__bar" aria-hidden>
        <div />
      </div>
    </div>
  );
}
