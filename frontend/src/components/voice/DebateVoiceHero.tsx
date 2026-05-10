/**
 * DebateVoiceHero — Hero CTA card at top of DebatePage
 *
 * Displays the debate voice agent avatar, topic preview, and a large
 * call-to-action button to open the voice modal. Replaces the small
 * floating-bottom-right VoiceButton on the Débat page.
 */

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles, Lock } from "lucide-react";
import { DeepSightSpinner } from "../ui/DeepSightSpinner";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface DebateVoiceHeroProps {
  /** Avatar URL dynamique généré par le pipeline d'images */
  avatarUrl: string | null;
  /** Statut de génération de l'avatar */
  avatarStatus: "ready" | "generating" | "unavailable";
  /** Titre / sujet du débat à afficher sous le label agent */
  debateTopic: string | null;
  /** Callback d'ouverture du modal vocal */
  onOpen: () => void;
  /** Si false, affiche le CTA en mode locked (plan insuffisant) */
  voiceEnabled: boolean;
  /** Initiales de fallback (2 chars) */
  avatarFallback?: string;
  /** Callback de préchauffage (précharge SDK ElevenLabs). Appelé au mount + hover. */
  onPrewarm?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export const DebateVoiceHero: React.FC<DebateVoiceHeroProps> = ({
  avatarUrl,
  avatarStatus,
  debateTopic,
  onOpen,
  voiceEnabled,
  avatarFallback = "DB",
  onPrewarm,
}) => {
  // Prewarm dès le mount : précharge le SDK ElevenLabs en arrière-plan
  useEffect(() => {
    if (voiceEnabled && onPrewarm) onPrewarm();
  }, [voiceEnabled, onPrewarm]);

  const handleClick = () => {
    if (!voiceEnabled) return;
    onOpen();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 mb-8"
    >
      <div
        role="button"
        tabIndex={voiceEnabled ? 0 : -1}
        aria-disabled={!voiceEnabled}
        aria-label={
          voiceEnabled
            ? "Parler avec l'agent IA Débatteur"
            : "Agent vocal — Plan supérieur requis"
        }
        onClick={handleClick}
        onMouseEnter={() => voiceEnabled && onPrewarm?.()}
        onKeyDown={handleKeyDown}
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
        `}
      >
        {/* Glow halo animé */}
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
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-white/15 bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10"
              whileHover={voiceEnabled ? { scale: 1.04 } : undefined}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar de l'agent débatteur"
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : avatarStatus === "generating" ? (
                <div className="w-full h-full flex items-center justify-center bg-[#0b0b14]/60">
                  <DeepSightSpinner size={40} speed="normal" />
                </div>
              ) : (
                <span className="text-2xl font-bold text-text-primary uppercase">
                  {avatarFallback.slice(0, 2)}
                </span>
              )}
            </motion.div>

            {/* Pulse dot — ready indicator */}
            {voiceEnabled && avatarStatus === "ready" && (
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
                Agent IA Débatteur
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">
              {voiceEnabled
                ? "Discute du débat avec un modérateur IA"
                : "Agent vocal — Plan Étudiant+ requis"}
            </h3>
            {debateTopic && (
              <p className="text-xs sm:text-sm text-text-muted mt-1 truncate">
                Sujet : {debateTopic}
              </p>
            )}
          </div>

          {/* CTA button */}
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
              `}
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

export default DebateVoiceHero;
