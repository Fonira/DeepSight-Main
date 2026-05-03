import React from "react";
import { motion } from "framer-motion";
import { useLoadingWord } from "../../contexts/LoadingWordContext";
import { useLanguage } from "../../contexts/LanguageContext";

interface TutorIdleProps {
  onClick: () => void;
}

const SPINNER_SIZE = 28;
const WHEEL_SIZE = 26;

export const TutorIdle: React.FC<TutorIdleProps> = ({ onClick }) => {
  const { currentWord } = useLoadingWord();
  const { language } = useLanguage();

  if (!currentWord) return null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="fixed top-3 right-3 z-40 hidden lg:block w-[200px] text-left rounded-2xl border border-accent-primary/15 bg-bg-secondary/95 backdrop-blur-xl p-3 hover:border-accent-primary/40 transition-colors cursor-pointer"
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
      <style>{`
        @keyframes tutor-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </motion.button>
  );
};
