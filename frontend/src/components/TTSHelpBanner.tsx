/**
 * TTSHelpBanner — One-time help banner explaining TTS features
 * Shown once, dismissed permanently via localStorage
 */

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "deepsight_tts_help_seen";

interface TTSHelpBannerProps {
  language?: "fr" | "en";
  className?: string;
}

export const TTSHelpBanner: React.FC<TTSHelpBannerProps> = ({
  language = "fr",
  className = "",
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "true") {
        setVisible(true);
      }
    } catch {
      // Private mode
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Private mode
    }
  };

  if (!visible) return null;

  const content =
    language === "fr"
      ? {
          text: "Lecture vocale — Écoutez les réponses de l'IA à voix haute. Activez le mode vocal dans la barre d'outils pour une lecture automatique, ou appuyez sur ▶ sur chaque réponse. Contrôlez la vitesse (1x à 3x), changez la langue (FR/EN) et la voix. Disponible dès le plan Étudiant.",
          button: "Compris",
        }
      : {
          text: "Voice Mode — Listen to AI responses read aloud. Enable voice mode in the toolbar for automatic playback, or tap ▶ on any response. Control speed (1x to 3x), switch language (FR/EN) and voice. Available from Student plan.",
          button: "Got it",
        };

  return (
    <div
      className={`
      relative rounded-xl px-4 py-3 mx-2 mb-3
      bg-gradient-to-r from-indigo-500/10 to-violet-500/10
      border border-indigo-500/20
      ${className}
    `}
    >
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-text-tertiary hover:text-text-secondary transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <p className="text-sm text-text-secondary leading-relaxed pr-6">
        <span className="text-indigo-400 font-medium">🎙️ </span>
        {content.text}
      </p>
      <button
        onClick={dismiss}
        className="mt-2 px-3 py-1 rounded-lg text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors"
      >
        {content.button}
      </button>
    </div>
  );
};
