/**
 * 🎓 TutorPrompting — Card 220×180 mode selector.
 *
 * Phase `prompting` du composant Tutor. Affiche le concept + 2 boutons :
 *   - Texte (~30s)  → mode "text"
 *   - Voix  (~5min) → mode "voice"
 *
 * Bouton fermeture (X) → cancel → retour idle.
 */

import React from "react";
import { motion } from "framer-motion";
import { X, Type, Mic } from "lucide-react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { TutorSessionMode } from "../../types/tutor";

interface TutorPromptingProps {
  onMode: (mode: TutorSessionMode) => void;
  onCancel: () => void;
}

const COPY = {
  fr: {
    back: "Retour",
    ask: "On en parle ?",
    mode_text: "Texte",
    mode_text_duration: "30s",
    mode_voice: "Voix",
    mode_voice_duration: "5 min",
  },
  en: {
    back: "Back",
    ask: "Want to discuss?",
    mode_text: "Text",
    mode_text_duration: "30s",
    mode_voice: "Voice",
    mode_voice_duration: "5 min",
  },
};

export const TutorPrompting: React.FC<TutorPromptingProps> = ({
  onMode,
  onCancel,
}) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const tt = COPY[language === "fr" ? "fr" : "en"];

  if (!currentWord) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed top-3 right-3 z-40 w-[220px] rounded-2xl border border-accent-primary/40 bg-bg-secondary/95 backdrop-blur-xl p-3 shadow-lg shadow-black/40"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-display text-sm font-semibold text-text-primary leading-tight">
          {currentWord.term}
        </div>
        <button
          onClick={onCancel}
          className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 -mt-0.5 -mr-0.5"
          aria-label={tt.back}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-text-secondary mb-3 italic">{tt.ask}</p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onMode("text")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-medium transition-colors border border-accent-primary/20"
        >
          <span className="flex items-center gap-2">
            <Type className="w-3.5 h-3.5" />
            {tt.mode_text}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.mode_text_duration}
          </span>
        </button>
        <button
          onClick={() => onMode("voice")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-medium transition-colors border border-white/10"
        >
          <span className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5" />
            {tt.mode_voice}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.mode_voice_duration}
          </span>
        </button>
      </div>
    </motion.div>
  );
};

export default TutorPrompting;
