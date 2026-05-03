import React from "react";
import { motion } from "framer-motion";
import { X, Type, Mic } from "lucide-react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useTranslation } from "../../hooks/useTranslation";
import type { TutorMode } from "../../types/tutor";

interface TutorPromptingProps {
  onMode: (mode: TutorMode) => void;
  onCancel: () => void;
}

export const TutorPrompting: React.FC<TutorPromptingProps> = ({
  onMode,
  onCancel,
}) => {
  const { currentWord } = useLoadingWord();
  const { t } = useTranslation();

  if (!currentWord) return null;
  const tt = t.tutor;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="fixed top-3 right-3 z-40 w-[220px] rounded-2xl border border-accent-primary/40 bg-bg-secondary/97 backdrop-blur-xl p-3 shadow-lg shadow-black/40"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="font-display text-sm font-semibold text-text-primary leading-tight">
          {currentWord.term}
        </div>
        <button
          onClick={onCancel}
          className="text-text-tertiary hover:text-red-400 transition-colors p-0.5 -mt-0.5 -mr-0.5"
          aria-label={tt.prompting.back}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-xs text-text-secondary mb-3 italic">
        {tt.prompting.ask}
      </p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => onMode("text")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-medium transition-colors border border-accent-primary/20"
        >
          <span className="flex items-center gap-2">
            <Type className="w-3.5 h-3.5" />
            {tt.prompting.mode_text}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.prompting.mode_text_duration}
          </span>
        </button>
        <button
          onClick={() => onMode("voice")}
          className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-medium transition-colors border border-white/10"
        >
          <span className="flex items-center gap-2">
            <Mic className="w-3.5 h-3.5" />
            {tt.prompting.mode_voice}
          </span>
          <span className="text-[10px] text-text-tertiary">
            ~{tt.prompting.mode_voice_duration}
          </span>
        </button>
      </div>
    </motion.div>
  );
};
