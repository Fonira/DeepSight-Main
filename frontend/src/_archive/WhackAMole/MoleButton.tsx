/**
 * MoleButton — The clickable glowing orb that appears randomly on screen.
 * Glassmorphic circle with category emoji, pulsing glow ring, SVG countdown.
 */

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOLE_SIZE, MOLE_EMOJI_SIZE, CAT_ICONS } from "./whackAMoleConstants";
import { easings } from "../ui/motion";

interface MoleButtonProps {
  position: { x: number; y: number };
  category: string;
  phase: "visible" | "caught" | "missed";
  visibleDuration: number;
  prefersReducedMotion: boolean;
  onCatch: () => void;
}

const RING_RADIUS = 24;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const MoleButton: React.FC<MoleButtonProps> = ({
  position,
  category,
  phase,
  visibleDuration,
  prefersReducedMotion,
  onCatch,
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const emoji = CAT_ICONS[category] || "📚";

  // Focus the button on spawn for accessibility
  useEffect(() => {
    if (phase === "visible") {
      const timer = setTimeout(() => buttonRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  return (
    <AnimatePresence mode="wait">
      {phase === "visible" && (
        <motion.button
          ref={buttonRef}
          key="mole-visible"
          onClick={onCatch}
          className="fixed z-30 flex items-center justify-center rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{
            left: position.x,
            top: position.y,
            width: MOLE_SIZE,
            height: MOLE_SIZE,
          }}
          initial={{ opacity: 0, scale: 0, filter: "blur(8px)" }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            ...(prefersReducedMotion
              ? {}
              : {
                  y: [0, -6, 0],
                  rotate: [0, 2, -2, 0],
                }),
          }}
          exit={{ opacity: 0, scale: 0, filter: "blur(4px)" }}
          transition={{
            opacity: { duration: 0.4, ease: easings.spring },
            scale: { duration: 0.4, ease: easings.spring },
            filter: { duration: 0.4 },
            ...(prefersReducedMotion
              ? {}
              : {
                  y: {
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4,
                  },
                  rotate: {
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.4,
                  },
                }),
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label={`Attrape-moi pour découvrir un fait ! ${emoji}`}
        >
          {/* Glass background */}
          <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-lg shadow-black/20" />

          {/* Pulsing glow ring */}
          <motion.div
            className="absolute inset-[-3px] rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, #6366f1, #8b5cf6, #06b6d4, #6366f1)",
              opacity: 0.4,
            }}
            animate={prefersReducedMotion ? {} : { opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-[1px] rounded-full bg-[#0a0a0f]" />

          {/* SVG Countdown ring */}
          <svg
            className="absolute inset-[-4px]"
            width={MOLE_SIZE + 8}
            height={MOLE_SIZE + 8}
            style={{ transform: "rotate(-90deg)" }}
          >
            <motion.circle
              cx={(MOLE_SIZE + 8) / 2}
              cy={(MOLE_SIZE + 8) / 2}
              r={RING_RADIUS}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              initial={{ strokeDashoffset: 0, stroke: "#6366f1" }}
              animate={{
                strokeDashoffset: RING_CIRCUMFERENCE,
                stroke: ["#6366f1", "#8b5cf6", "#ef4444"],
              }}
              transition={{
                strokeDashoffset: {
                  duration: visibleDuration / 1000,
                  ease: "linear",
                },
                stroke: { duration: visibleDuration / 1000, ease: "linear" },
              }}
            />
          </svg>

          {/* Emoji */}
          <span
            className="relative z-10 select-none"
            style={{ fontSize: MOLE_EMOJI_SIZE }}
          >
            {emoji}
          </span>
        </motion.button>
      )}

      {phase === "caught" && (
        <motion.div
          key="mole-caught"
          className="fixed z-30 flex items-center justify-center"
          style={{
            left: position.x,
            top: position.y,
            width: MOLE_SIZE,
            height: MOLE_SIZE,
          }}
          initial={{ scale: 1 }}
          animate={{
            scale: [1, 1.3, 0.9, 1.05, 0],
            rotate: [0, 0, 0, 0, 360],
            opacity: [1, 1, 1, 1, 0],
          }}
          transition={{ duration: 0.5, times: [0, 0.15, 0.3, 0.5, 1] }}
        >
          <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/5 border border-white/10" />
          <div className="absolute inset-[-3px] rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 opacity-50" />
          <div className="absolute inset-[1px] rounded-full bg-[#0a0a0f]" />
          <span
            className="relative z-10 select-none"
            style={{ fontSize: MOLE_EMOJI_SIZE }}
          >
            {emoji}
          </span>
        </motion.div>
      )}

      {phase === "missed" && (
        <motion.div
          key="mole-missed"
          className="fixed z-30 flex items-center justify-center pointer-events-none"
          style={{
            left: position.x,
            top: position.y,
            width: MOLE_SIZE,
            height: MOLE_SIZE,
          }}
          initial={{ scale: 1, opacity: 1 }}
          animate={{
            scale: 0,
            opacity: 0,
            rotate: [0, -15, 10, -5, 0],
            filter: "blur(4px)",
          }}
          transition={{ duration: 0.4, ease: "easeIn" }}
        >
          <div className="absolute inset-0 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 opacity-50" />
          <span
            className="relative z-10 select-none opacity-50"
            style={{ fontSize: MOLE_EMOJI_SIZE }}
          >
            {emoji}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
