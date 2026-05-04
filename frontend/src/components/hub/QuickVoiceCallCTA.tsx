/**
 * QuickVoiceCallCTA — hero CTA pour lancer un appel vocal sur le Hub web.
 *
 * Remplace l'ancienne icône Phone discrète dans InputBar par un bouton
 * dominant, immédiatement repérable au premier coup d'œil sur la page.
 *
 * Variantes :
 *  - `hero` (défaut) : carte large, ~64px, gradient violet→indigo, glow,
 *    halo radial, pulse léger. À placer en haut du contenu Hub.
 *  - `compact` : variante réduite (h-14, label seul), pour les contextes
 *    où l'espace vertical est contraint (placeholder vide, mobile).
 *
 * Trigger : appelle `onStart()` qui doit déclencher `setVoiceCallOpen(true)`
 * côté HubPage, exactement comme le faisait l'ancien micro-bouton.
 */
import React from "react";
import { motion } from "framer-motion";
import { PhoneCall } from "lucide-react";

interface Props {
  onStart: () => void;
  /**
   * `hero` (défaut) — carte large pour le top du Hub.
   * `compact` — version moins haute pour les espaces réduits.
   */
  variant?: "hero" | "compact";
  /** Texte secondaire optionnel (sous-titre / hint). */
  hint?: string;
  /** Désactive le bouton (ex. pas de conv active, voice non disponible). */
  disabled?: boolean;
  className?: string;
}

const DEFAULT_HINT = "Parlez à DeepSight, en français, en temps réel.";

export const QuickVoiceCallCTA: React.FC<Props> = ({
  onStart,
  variant = "hero",
  hint = DEFAULT_HINT,
  disabled = false,
  className = "",
}) => {
  const isHero = variant === "hero";

  return (
    <div
      className={
        "w-full flex justify-center " +
        (isHero ? "px-4 sm:px-6 pt-4 pb-2 " : "px-4 py-2 ") +
        className
      }
    >
      <motion.button
        type="button"
        aria-label="Démarrer un appel vocal avec DeepSight"
        onClick={onStart}
        disabled={disabled}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        whileHover={disabled ? undefined : { scale: 1.01 }}
        whileTap={disabled ? undefined : { scale: 0.99 }}
        className={
          "group relative w-full max-w-3xl overflow-hidden rounded-2xl " +
          "border border-violet-500/30 " +
          "bg-gradient-to-br from-violet-500/25 via-indigo-500/20 to-cyan-400/10 " +
          "backdrop-blur-xl " +
          "shadow-[0_0_60px_-15px_rgba(139,92,246,0.55)] " +
          "transition-all duration-300 " +
          "hover:border-violet-400/60 hover:shadow-[0_0_80px_-10px_rgba(139,92,246,0.7)] " +
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f] " +
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[0_0_60px_-15px_rgba(139,92,246,0.55)] " +
          (isHero ? "h-16 sm:h-[68px] px-5 sm:px-7 " : "h-14 px-5 ")
        }
      >
        {/* Halo radial animé en fond */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 50%, rgba(139,92,246,0.35) 0%, rgba(99,102,241,0.15) 35%, rgba(6,182,212,0.05) 65%, transparent 100%)",
          }}
        />

        {/* Sweep brillance au hover */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 group-hover:opacity-100 group-hover:translate-x-[400%] transition-all duration-1000 ease-out"
        />

        <span className="relative flex items-center gap-3 sm:gap-4 w-full">
          {/* Pastille icône avec pulse */}
          <span className="relative flex-shrink-0">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-violet-400/40 animate-ping"
            />
            <span
              className={
                "relative grid place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/40 " +
                (isHero ? "w-11 h-11 sm:w-12 sm:h-12 " : "w-9 h-9 ")
              }
            >
              <PhoneCall
                className={
                  "text-white drop-shadow-sm " +
                  (isHero ? "w-5 h-5 sm:w-[22px] sm:h-[22px]" : "w-4 h-4")
                }
                aria-hidden="true"
              />
            </span>
          </span>

          {/* Textes */}
          <span className="flex-1 min-w-0 text-left">
            <span
              className={
                "block font-semibold text-white tracking-tight " +
                (isHero ? "text-base sm:text-lg" : "text-sm sm:text-base")
              }
            >
              Démarrer un appel vocal
            </span>
            {isHero && (
              <span className="hidden sm:block text-xs text-white/65 mt-0.5 truncate">
                {hint}
              </span>
            )}
          </span>

          {/* Badge "Live" + chevron */}
          <span className="flex-shrink-0 hidden sm:flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/85">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              Live
            </span>
          </span>
        </span>
      </motion.button>
    </div>
  );
};
