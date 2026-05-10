import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "../../hooks/useTranslation";
import { DraggableTutorWindow } from "./DraggableTutorWindow";
import { TUTOR_MINIMIZED_SIZE } from "./tutorConstants";

interface TutorMinimizedProps {
  onRestore: () => void;
  onClose: () => void;
}

const SPINNER_INNER = 32;

const stopPropagation = (e: React.PointerEvent | React.MouseEvent) => {
  e.stopPropagation();
};

/**
 * Pastille 48×48 quand le Tuteur est minimisé.
 * Spinner cosmic seul, draggable+snap. Clic pour restaurer, X pour fermer.
 */
export const TutorMinimized: React.FC<TutorMinimizedProps> = ({
  onRestore,
  onClose,
}) => {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const tt = t.tutor;
  const expandLabel =
    tt.mini_chat.expand ?? (language === "fr" ? "Agrandir" : "Expand");

  return (
    <DraggableTutorWindow
      size={TUTOR_MINIMIZED_SIZE}
      className="z-40 cursor-grab active:cursor-grabbing"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.7 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="group relative w-full h-full rounded-full border border-accent-primary/40 bg-bg-secondary/95 backdrop-blur-xl shadow-lg shadow-black/40 hover:border-accent-primary/70 transition-colors"
      >
        <button
          type="button"
          onPointerDown={stopPropagation}
          onClick={onRestore}
          className="absolute inset-0 w-full h-full rounded-full"
          aria-label={expandLabel}
        >
          <div
            className="absolute inset-0 m-auto"
            style={{ width: SPINNER_INNER, height: SPINNER_INNER }}
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
              className="absolute inset-0 m-auto"
              style={{
                width: SPINNER_INNER - 2,
                height: SPINNER_INNER - 2,
                mixBlendMode: "screen",
                opacity: 0.85,
                filter: "brightness(1.2) contrast(1.25) saturate(1.1)",
                animation: "tutor-spin 8s linear infinite",
              }}
            />
          </div>
        </button>
        <button
          type="button"
          onPointerDown={stopPropagation}
          onClick={onClose}
          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-bg-primary/95 text-text-tertiary hover:text-red-400 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
          aria-label={tt.mini_chat.close}
        >
          <X className="w-3 h-3" />
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

export default TutorMinimized;
