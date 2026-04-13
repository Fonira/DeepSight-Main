/**
 * DEEP SIGHT — ConfidenceButtons
 * 4 boutons FSRS de rating après avoir vu la réponse.
 */
import React from "react";
import { motion } from "framer-motion";

interface ConfidenceButtonsProps {
  onRate: (rating: 1 | 2 | 3 | 4) => void;
  disabled?: boolean;
}

interface ButtonConfig {
  rating: 1 | 2 | 3 | 4;
  label: string;
  subtext: string;
  color: string;
  hoverBg: string;
}

const BUTTONS: ButtonConfig[] = [
  {
    rating: 1,
    label: "Oublié",
    subtext: "<1min",
    color: "text-red-400",
    hoverBg: "hover:bg-red-500/15",
  },
  {
    rating: 2,
    label: "Difficile",
    subtext: "~6min",
    color: "text-orange-400",
    hoverBg: "hover:bg-orange-500/15",
  },
  {
    rating: 3,
    label: "Bien",
    subtext: "~10min",
    color: "text-green-400",
    hoverBg: "hover:bg-green-500/15",
  },
  {
    rating: 4,
    label: "Facile",
    subtext: ">1j",
    color: "text-blue-400",
    hoverBg: "hover:bg-blue-500/15",
  },
];

export const ConfidenceButtons: React.FC<ConfidenceButtonsProps> = ({
  onRate,
  disabled = false,
}) => {
  return (
    <div
      className="grid grid-cols-4 gap-2"
      role="group"
      aria-label="Évaluer votre confiance"
    >
      {BUTTONS.map((btn) => (
        <motion.button
          key={btn.rating}
          type="button"
          disabled={disabled}
          onClick={() => onRate(btn.rating)}
          className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl transition-colors duration-200 ${btn.hoverBg} disabled:opacity-40 disabled:cursor-not-allowed`}
          whileHover={disabled ? undefined : { y: -2 }}
          whileTap={disabled ? undefined : { scale: 0.97 }}
          aria-label={`${btn.label} — intervalle ${btn.subtext}`}
        >
          <span className={`text-sm font-semibold ${btn.color}`}>
            {btn.label}
          </span>
          <span className="text-[10px] text-white/40">{btn.subtext}</span>
        </motion.button>
      ))}
    </div>
  );
};
