import React from "react";
import { motion } from "framer-motion";
import { Minus, X, Type } from "lucide-react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../hooks/useTranslation";
import { DraggableTutorWindow } from "./DraggableTutorWindow";
import { TUTOR_PROMPTING_SIZE } from "./tutorConstants";

interface TutorPromptingProps {
  onStart: () => void;
  onCancel: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const stopPropagation = (e: React.PointerEvent | React.MouseEvent) => {
  e.stopPropagation();
};

export const TutorPrompting: React.FC<TutorPromptingProps> = ({
  onStart,
  onCancel,
  onMinimize,
  onClose,
}) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const { t } = useTranslation();

  if (!currentWord) return null;
  const tt = t.tutor;
  const minimizeLabel =
    tt.mini_chat.minimize ?? (language === "fr" ? "Réduire" : "Minimize");
  const closeLabel = language === "fr" ? "Fermer" : "Close";

  return (
    <DraggableTutorWindow
      size={TUTOR_PROMPTING_SIZE}
      className="z-40 cursor-grab active:cursor-grabbing"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-label={tt.title}
        className="relative w-full h-full rounded-2xl border border-accent-primary/40 bg-bg-secondary/97 backdrop-blur-xl px-3 pt-7 pb-3 shadow-lg shadow-black/40"
      >
        {/* Toolbar minimize/close */}
        <div className="absolute top-1 right-1 flex items-center gap-0.5 z-10">
          <button
            type="button"
            onPointerDown={stopPropagation}
            onClick={onMinimize}
            className="text-text-tertiary hover:text-text-primary p-1 transition-colors"
            aria-label={minimizeLabel}
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onPointerDown={stopPropagation}
            onClick={onClose}
            className="text-text-tertiary hover:text-red-400 p-1 transition-colors"
            aria-label={closeLabel}
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-start justify-between mb-2">
          <div className="font-display text-sm font-semibold text-text-primary leading-tight pr-12">
            {currentWord.term}
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-3 italic">
          {tt.prompting.ask}
        </p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onPointerDown={stopPropagation}
            onClick={onStart}
            className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-accent-primary/10 hover:bg-accent-primary/20 text-accent-primary text-xs font-medium transition-colors border border-accent-primary/20"
          >
            <span className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5" />
              {tt.prompting.start}
            </span>
            <span className="text-[10px] text-text-tertiary">
              ~{tt.prompting.start_duration}
            </span>
          </button>
          <button
            type="button"
            onPointerDown={stopPropagation}
            onClick={onCancel}
            className="text-[11px] text-text-tertiary hover:text-text-secondary transition-colors py-1"
          >
            {tt.prompting.back}
          </button>
        </div>
      </motion.div>
    </DraggableTutorWindow>
  );
};
