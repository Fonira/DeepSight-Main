/**
 * FactRevealCard — Glassmorphic card revealed after catching a mole.
 * Shows term, definition, category, wiki link. Dismissible.
 */

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, ExternalLink, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../contexts/LanguageContext";
import type { LoadingWord } from "../../contexts/LoadingWordContext";
import { CAT_ICONS, FACT_CARD_WIDTH } from "./whackAMoleConstants";
import { easings } from "../ui/motion";

interface FactRevealCardProps {
  fact: LoadingWord;
  position: { x: number; y: number };
  streak: number;
  onDismiss: () => void;
  prefersReducedMotion: boolean;
}

export const FactRevealCard: React.FC<FactRevealCardProps> = ({
  fact,
  position,
  streak,
  onDismiss,
  prefersReducedMotion,
}) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const emoji = CAT_ICONS[fact.category] || "📚";
  const isClickable = fact.source === "history" && fact.summaryId;

  // Focus trap + Escape dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    cardRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const handleTermClick = () => {
    if (isClickable) {
      navigate(`/hub?summary=${fact.summaryId}&open_summary=1`);
      onDismiss();
    }
  };

  return (
    <motion.div
      ref={cardRef}
      tabIndex={-1}
      className="fixed z-30 outline-none"
      style={{
        left: position.x,
        top: position.y,
        width: FACT_CARD_WIDTH,
      }}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.8, y: 10 }
      }
      animate={
        prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
      }
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
      transition={{
        duration: prefersReducedMotion ? 0.2 : 0.35,
        ease: prefersReducedMotion ? "easeOut" : easings.spring,
      }}
    >
      <div className="relative rounded-2xl overflow-hidden border border-accent-primary/15 shadow-lg shadow-black/30">
        {/* Glass background */}
        <div className="absolute inset-0 bg-bg-secondary/95 backdrop-blur-xl" />

        {/* Content */}
        <div className="relative p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{emoji}</span>
              <span className="font-display text-[11px] font-semibold text-accent-primary uppercase tracking-wider">
                {language === "fr" ? "Le saviez-vous ?" : "Did you know?"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {streak > 1 && (
                <span className="flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                  <Zap className="w-3 h-3" />
                  {streak}x
                </span>
              )}
              <button
                onClick={onDismiss}
                className="p-1 rounded-md text-text-tertiary hover:text-red-400 hover:bg-white/5 transition-all"
                aria-label={language === "fr" ? "Fermer" : "Close"}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Term */}
          <button
            onClick={handleTermClick}
            disabled={!isClickable}
            className={`font-display text-base font-semibold text-text-primary text-left leading-tight block ${
              isClickable
                ? "hover:text-accent-primary cursor-pointer transition-colors"
                : ""
            }`}
          >
            {fact.term}
          </button>

          {/* Definition */}
          <p className="text-sm text-text-secondary leading-relaxed">
            {fact.definition || fact.shortDefinition}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-1">
            {fact.wikiUrl && (
              <a
                href={fact.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-accent-info transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Source
              </a>
            )}
            {fact.source === "history" && (
              <span className="text-[10px] text-accent-primary/50 ml-auto">
                📜 {language === "fr" ? "Vos analyses" : "Your analyses"}
              </span>
            )}
          </div>
        </div>

        {/* Top glow border */}
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-accent-primary/30 to-transparent" />
      </div>
    </motion.div>
  );
};
