// extension/src/sidepanel/components/ConnectingView.tsx
//
// Vue affichée pendant que la session voice est en cours de création
// côté backend (~1-2s). Mic pulsant + barre indéterminée + reassure.
import React from "react";

export function ConnectingView(): JSX.Element {
  return (
    <div className="ds-connecting" data-testid="ds-connecting">
      <div className="ds-connecting__mic" aria-hidden>
        🎙️
      </div>
      <h2>Connexion à l'agent…</h2>
      <p>
        DeepSight commence à analyser la vidéo en parallèle. L'appel démarre
        dans une seconde.
      </p>
      <div className="ds-connecting__bar" aria-hidden>
        <div />
      </div>
    </div>
  );
}
