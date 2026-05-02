// extension/src/sidepanel/components/EndedToast.tsx
//
// Toast affiché 3s après hangup : "✅ Appel termine · MM:SS".
// Mirror du EndedToast mobile (Reanimated FadeIn/FadeOut) : ici on
// utilise une CSS transition sur opacity + transform (Y) — l'animation
// de disparition est gérée par le caller qui démonte le composant à 3s.

import React, { useEffect, useState } from "react";

interface EndedToastProps {
  /** Durée de l'appel en secondes — affichée dans le toast. */
  durationSec: number;
  visible: boolean;
}

function formatMMSS(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const EndedToast: React.FC<EndedToastProps> = ({
  durationSec,
  visible,
}) => {
  // CSS transition fade-in : on rend toujours, mais on flippe la classe.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (visible) {
      // Force a reflow before adding the visible class to allow the
      // CSS transition to play smoothly.
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className={`ds-ended-toast${mounted ? " is-visible" : ""}`}
      role="status"
      aria-live="polite"
      data-testid="ended-toast"
    >
      <span className="ds-ended-toast-icon" aria-hidden="true">
        {"✅"}
      </span>
      <span className="ds-ended-toast-label">
        Appel termine
        {durationSec > 0 ? ` · ${formatMMSS(durationSec)}` : ""}
      </span>
    </div>
  );
};
