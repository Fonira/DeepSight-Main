import React from "react";
import { motion } from "framer-motion";
import { Minus, X } from "lucide-react";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../hooks/useTranslation";
import { DraggableTutorWindow } from "./DraggableTutorWindow";
import { TUTOR_IDLE_SIZE } from "./tutorConstants";

interface TutorIdleProps {
  onClick: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const SPINNER_SIZE = 28;
const WHEEL_SIZE = 26;

const stopPropagation = (e: React.PointerEvent | React.MouseEvent) => {
  e.stopPropagation();
};

export const TutorIdle: React.FC<TutorIdleProps> = ({
  onClick,
  onMinimize,
  onClose,
}) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const tt = t.tutor;

  if (!currentWord) return null;

  const minimizeLabel =
    tt.mini_chat.minimize ?? (language === "fr" ? "Réduire" : "Minimize");
  const closeLabel = language === "fr" ? "Fermer" : "Close";

  return (
    <DraggableTutorWindow
      size={TUTOR_IDLE_SIZE}
      className="hidden lg:block z-40 cursor-grab active:cursor-grabbing"
    >
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        className="relative w-full h-full rounded-2xl border border-accent-primary/15 bg-bg-secondary/95 backdrop-blur-xl px-3 pt-7 pb-3 hover:border-accent-primary/40 transition-colors"
      >
        {/* Header drag-handle (boutons toolbar) */}
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

        {/* Contenu cliquable pour ouvrir le Tuteur */}
        <button
          type="button"
          onPointerDown={stopPropagation}
          onClick={onClick}
          className="w-full text-left cursor-pointer"
          aria-label={language === "fr" ? "Ouvrir le Tuteur" : "Open the Tutor"}
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className="relative"
              style={{ width: SPINNER_SIZE, height: SPINNER_SIZE }}
            >
              <img
                src="/spinner-cosmic.jpg"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover rounded-full"
                style={{
                  maskImage:
                    "radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)",
                  WebkitMaskImage:
                    "radial-gradient(circle, transparent 35%, rgba(0,0,0,0.4) 45%, black 55%)",
                  mixBlendMode: "screen",
                }}
              />
              <img
                src="/spinner-wheel.jpg"
                alt=""
                aria-hidden="true"
                style={{
                  width: WHEEL_SIZE,
                  height: WHEEL_SIZE,
                  position: "relative",
                  zIndex: 2,
                  mixBlendMode: "screen",
                  opacity: 0.85,
                  filter: "brightness(1.2) contrast(1.25) saturate(1.1)",
                  animation: "tutor-spin 8s linear infinite",
                }}
              />
            </div>
            <span className="font-display text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
              {language === "fr" ? "Le Tuteur" : "The Tutor"}
            </span>
          </div>
          <div className="font-display text-sm font-semibold text-text-primary leading-tight mb-1">
            {currentWord.term}
          </div>
          <div className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
            {currentWord.shortDefinition}
          </div>
        </button>

        <style>{`
          @keyframes tutor-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </motion.div>
    </DraggableTutorWindow>
  );
};
