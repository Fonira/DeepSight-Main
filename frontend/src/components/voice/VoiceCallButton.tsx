/**
 * VoiceCallButton — Bouton réutilisable pour ouvrir la voice modal.
 *
 * Consomme `VoiceCallProvider` via `useVoiceCall()`. Quatre variantes :
 *
 *  - `hero`   → reproduit l'`AnalysisVoiceHero` (bandeau large CTA)
 *  - `header` → bouton compact 40×40 + label "Appeler" (ChatPage header)
 *  - `fab`    → floating button mobile-style
 *  - `inline` → bouton aligné dans une action bar
 *
 * Spec ElevenLabs ecosystem #2 §b.
 */

import React, { useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Lock, Phone, Sparkles, Play } from "lucide-react";
import { useVoiceCall } from "./VoiceCallProvider";
import { ThumbnailImage } from "./utils/ThumbnailImage";
import { resolveThumbnailUrl } from "./utils/thumbnail";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type VoiceCallButtonVariant = "hero" | "header" | "fab" | "inline";
export type VoiceCallButtonSize = "sm" | "md" | "lg";

export interface VoiceCallButtonProps {
  variant: VoiceCallButtonVariant;
  size?: VoiceCallButtonSize;
  /** Override du label (défaut dépend de la variante). */
  label?: string;
  /** Classe additionnelle pour positionnement. */
  className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const VoiceCallButton: React.FC<VoiceCallButtonProps> = ({
  variant,
  size = "md",
  label,
  className = "",
}) => {
  const { openModal, prewarm, voiceEnabled, videoTitle, thumbnailUrl, videoId, platform } =
    useVoiceCall();

  // Prewarm dès le mount (fire-and-forget, le SDK sera dans le cache au moment du clic).
  useEffect(() => {
    if (voiceEnabled) prewarm();
  }, [voiceEnabled, prewarm]);

  const handleClick = useCallback(() => {
    if (!voiceEnabled) return;
    openModal();
  }, [voiceEnabled, openModal]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const handleMouseEnter = useCallback(() => {
    if (voiceEnabled) prewarm();
  }, [voiceEnabled, prewarm]);

  // ─────────────────────────────────────────────────────────────────────────
  // Variant: header — compact 40×40 + label "Appeler"
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "header") {
    const text = label ?? "Appeler";
    const sizeClass =
      size === "sm" ? "h-8 px-2 text-xs" : size === "lg" ? "h-11 px-4 text-base" : "h-10 px-3 text-sm";
    return (
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        aria-disabled={!voiceEnabled}
        aria-label={
          voiceEnabled
            ? `${text} l'agent vocal`
            : "Chat vocal — Plan supérieur requis"
        }
        className={`
          inline-flex items-center gap-2 rounded-lg border ${sizeClass}
          ${
            voiceEnabled
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent hover:shadow-lg hover:shadow-indigo-500/30"
              : "bg-white/5 border-white/10 text-white/40 cursor-not-allowed"
          }
          transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
          ${className}
        `.trim()}
      >
        {voiceEnabled ? (
          <Phone className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
        <span className="font-medium">{text}</span>
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variant: fab — floating action button bottom-right
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "fab") {
    const sizeClass = size === "sm" ? "w-10 h-10" : size === "lg" ? "w-16 h-16" : "w-14 h-14";
    return (
      <motion.button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        aria-disabled={!voiceEnabled}
        aria-label={
          voiceEnabled
            ? "Ouvrir le chat vocal"
            : "Chat vocal — Plan supérieur requis"
        }
        className={`
          fixed bottom-6 right-6 z-40 ${sizeClass}
          flex items-center justify-center rounded-full
          ${
            voiceEnabled
              ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
              : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
          }
          transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
          ${className}
        `.trim()}
        whileHover={voiceEnabled ? { scale: 1.05 } : undefined}
        whileTap={voiceEnabled ? { scale: 0.95 } : undefined}
      >
        {voiceEnabled ? (
          <Mic className="w-5 h-5" />
        ) : (
          <Lock className="w-5 h-5" />
        )}
      </motion.button>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variant: inline — bouton dans une action bar
  // ─────────────────────────────────────────────────────────────────────────
  if (variant === "inline") {
    const text = label ?? "Parler à l'agent";
    return (
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        aria-disabled={!voiceEnabled}
        aria-label={voiceEnabled ? text : "Chat vocal — Plan supérieur requis"}
        className={`
          inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
          ${
            voiceEnabled
              ? "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
              : "bg-white/5 border border-white/10 text-white/40 cursor-not-allowed"
          }
          transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
          ${className}
        `.trim()}
      >
        {voiceEnabled ? (
          <Mic className="w-4 h-4" />
        ) : (
          <Lock className="w-4 h-4" />
        )}
        <span>{text}</span>
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Variant: hero — bandeau CTA large (reproduit AnalysisVoiceHero)
  // ─────────────────────────────────────────────────────────────────────────
  // Resolve thumbnail with YouTube fallback — older analyses without
  // thumbnail_url still display the video preview in the hero.
  const resolvedThumb = resolveThumbnailUrl({
    thumbnail_url: thumbnailUrl,
    video_id: videoId,
    platform,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative w-full ${className}`}
    >
      <div
        role="button"
        tabIndex={voiceEnabled ? 0 : -1}
        aria-disabled={!voiceEnabled}
        aria-label={
          voiceEnabled
            ? "Parler avec l'agent IA"
            : "Agent vocal — Plan supérieur requis"
        }
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        className={`
          relative group overflow-hidden rounded-2xl
          border border-white/10
          bg-gradient-to-br from-indigo-500/[0.08] via-violet-500/[0.06] to-fuchsia-500/[0.08]
          backdrop-blur-sm
          p-5 sm:p-6
          ${
            voiceEnabled
              ? "cursor-pointer hover:border-indigo-400/40 hover:from-indigo-500/[0.12] hover:via-violet-500/[0.10] hover:to-fuchsia-500/[0.12] transition-all"
              : "opacity-60 cursor-not-allowed"
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]
        `.trim()}
      >
        {voiceEnabled && (
          <motion.div
            aria-hidden="true"
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, rgba(139, 92, 246, 0.18), transparent 70%)",
            }}
            animate={{ opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="relative flex items-center gap-4 sm:gap-6">
          {/* Avatar preview */}
          <div className="relative flex-shrink-0">
            <motion.div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/20"
              whileHover={voiceEnabled ? { scale: 1.04 } : undefined}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <ThumbnailImage
                src={resolvedThumb}
                alt="Miniature de la vidéo"
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/20 via-violet-500/20 to-fuchsia-500/20">
                    <Play className="w-10 h-10 text-white/70" />
                  </div>
                }
              />
            </motion.div>

            {voiceEnabled && (
              <motion.span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-[#0a0a0f]"
                animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            )}
          </div>

          {/* Copy */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-violet-300" />
              <span className="text-[11px] uppercase tracking-wider font-semibold text-violet-300/90">
                Agent IA Vocal
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">
              {voiceEnabled
                ? label ?? "Discute de l'analyse avec un agent IA"
                : "Agent vocal — Plan supérieur requis"}
            </h3>
            {videoTitle && (
              <p className="text-xs sm:text-sm text-white/50 mt-1 truncate">
                Vidéo : {videoTitle}
              </p>
            )}
          </div>

          {/* CTA */}
          <div className="flex-shrink-0">
            <motion.div
              className={`
                flex items-center gap-2 sm:gap-3
                px-4 sm:px-6 py-3 sm:py-4 rounded-xl
                font-semibold text-sm sm:text-base
                transition-shadow
                ${
                  voiceEnabled
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50"
                    : "bg-white/5 border border-white/10 text-white/40"
                }
              `.trim()}
              whileHover={voiceEnabled ? { scale: 1.03 } : undefined}
              whileTap={voiceEnabled ? { scale: 0.97 } : undefined}
            >
              {voiceEnabled ? (
                <>
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Parler maintenant</span>
                  <span className="sm:hidden">Parler</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Verrouillé</span>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default VoiceCallButton;
