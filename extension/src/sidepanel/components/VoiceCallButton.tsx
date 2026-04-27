// extension/src/sidepanel/components/VoiceCallButton.tsx
//
// Wrapper React idempotent autour de `renderVoiceCallButton` (DOM pur).
// Utilisé dans MainView (sidepanel) pour exposer le 🎙️ Quick Voice Call
// directement à côté de Quick Chat.
//
// Le composant lui-même n'a pas de logique métier : il délègue à la fonction
// DOM existante pour garder une seule source de vérité (style + texte +
// envoi du message OPEN_VOICE_CALL).
//
// Re-render : à chaque changement de props, on vide le container et on
// re-injecte. C'est OK car `renderVoiceCallButton` est pure.
//
// Affichage conditionnel : si pas de videoId, on n'affiche rien (le bouton
// n'a pas de sens hors d'une page YouTube/TikTok).
import React, { useEffect, useRef } from "react";
import {
  renderVoiceCallButton,
  type VoiceCallButtonOpts,
} from "../../content/widget";

export interface VoiceCallButtonProps {
  /** Plan utilisateur — détermine le badge affiché. */
  plan: "free" | "pro" | "expert";
  /** True si l'utilisateur free a déjà consommé son essai. */
  trialUsed?: boolean;
  /** Minutes consommées ce mois-ci (utilisé pour le plan expert). */
  monthlyMinutesUsed?: number;
  /** Video ID détecté sur l'onglet courant. Si absent → pas de rendu. */
  videoId?: string;
  /** Titre de la vidéo (display dans la voice view). */
  videoTitle?: string;
}

export const VoiceCallButton: React.FC<VoiceCallButtonProps> = ({
  plan,
  trialUsed,
  monthlyMinutesUsed,
  videoId,
  videoTitle,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!videoId) {
      // Pas de vidéo détectée → pas de bouton (cas non-watch page).
      root.innerHTML = "";
      return;
    }
    // Reset avant injection pour rester idempotent (chaque appel ajoute un
    // bouton, donc on doit nettoyer le précédent à chaque re-render).
    root.innerHTML = "";
    const opts: VoiceCallButtonOpts = {
      plan,
      trialUsed,
      monthlyMinutesUsed,
      videoId,
      videoTitle,
    };
    void renderVoiceCallButton(root, opts);
    return () => {
      root.innerHTML = "";
    };
  }, [plan, trialUsed, monthlyMinutesUsed, videoId, videoTitle]);

  return <div ref={rootRef} className="ds-voice-call-button-wrapper" />;
};
