/**
 * DebateVSLayout — Layout adaptatif 1+N pour le débat IA v2
 *
 * Sprint Débat IA v2 — Wave 3 D
 *   - N=0 : empty state (debate failed à trouver une perspective)
 *   - N=1 : card A centrée hero (max-width, animation slide-up). VS circle absent.
 *   - N=2 : VS face-à-face existant (1fr_auto_1fr grid avec VS circle pulse).
 *   - N=3 : grid 1+N — A en haut full-width hero treatment, B1+B2 en dessous (2 cols).
 *
 * Backward-compat : si la prop `perspectives` est vide, l'appelant peut soit
 * dériver une perspective implicite depuis `video_b_*` (cas v1), soit afficher
 * l'empty state (N=0).
 *
 * Responsive : desktop côte à côte (lg:), mobile empilé.
 */

import React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { DebateVideoCard } from "./DebateVideoCard";
import type {
  DebateArgument,
  DebatePerspective,
  VideoPlatform,
} from "../../types/debate";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DebateVSLayoutVideoA {
  title: string;
  channel: string;
  thumbnail: string;
  videoId: string;
  platform: VideoPlatform;
  thesis: string;
  arguments: DebateArgument[];
}

export interface DebateVSLayoutProps {
  /** Vidéo A (source) — toujours présente */
  videoA: DebateVSLayoutVideoA;
  /** 0 à 3 perspectives. 0 = empty state, 1 = hero, 2 = VS, 3 = grid 1+N */
  perspectives: DebatePerspective[];
  /** Optionnel : flag de chargement (skeleton) */
  isLoading?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Map index 0..N de perspective → side "b" (toutes les perspectives sont "côté B") */
const PERSPECTIVE_SIDE = "b" as const;

/** Map ease tuple pour Framer (compatibilité TS) */
const EASE_OUT: [number, number, number, number] = [0.4, 0, 0.2, 1];

// ─── Sub-components ────────────────────────────────────────────────────────────

const VSCircle: React.FC<{ delay?: number }> = ({ delay = 0.3 }) => (
  <motion.div
    initial={{ scale: 0, rotate: -180 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ delay, duration: 0.5, type: "spring", stiffness: 200 }}
    className="relative"
    aria-hidden="true"
  >
    {/* Pulse ring */}
    <motion.div
      className="absolute inset-0 rounded-full bg-white/10"
      animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
    <div className="relative w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
      <span className="text-white font-bold text-lg lg:text-xl tracking-tight">
        VS
      </span>
    </div>
  </motion.div>
);

const PerspectiveCard: React.FC<{
  perspective: DebatePerspective;
  index: number;
  variant: "single" | "grid";
}> = ({ perspective, index, variant }) => {
  const xOffset = index === 0 ? 40 : -40;
  return (
    <motion.div
      initial={
        variant === "single"
          ? { opacity: 0, x: xOffset }
          : { opacity: 0, y: 20 }
      }
      animate={
        variant === "single" ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 }
      }
      transition={{
        duration: 0.5,
        delay: variant === "grid" ? 0.15 * index : 0,
        ease: EASE_OUT,
      }}
      data-testid={`debate-perspective-${index}`}
    >
      <DebateVideoCard
        side={PERSPECTIVE_SIDE}
        title={perspective.video_title ?? `Perspective ${index + 1}`}
        channel={perspective.video_channel ?? ""}
        thumbnail={perspective.video_thumbnail ?? ""}
        videoId={perspective.video_id}
        platform={(perspective.platform as VideoPlatform) ?? "youtube"}
        thesis={perspective.thesis ?? ""}
        arguments={perspective.arguments ?? []}
      />
    </motion.div>
  );
};

const VideoAHero: React.FC<{
  videoA: DebateVSLayoutVideoA;
  variant: "centered" | "topfull";
}> = ({ videoA, variant }) => {
  const widthClass =
    variant === "centered"
      ? "max-w-2xl mx-auto"
      : "w-full"; /* topfull spans grid */
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className={widthClass}
      data-testid="debate-video-a"
    >
      <DebateVideoCard
        side="a"
        title={videoA.title}
        channel={videoA.channel}
        thumbnail={videoA.thumbnail}
        videoId={videoA.videoId}
        platform={videoA.platform}
        thesis={videoA.thesis}
        arguments={videoA.arguments}
      />
    </motion.div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const DebateVSLayout: React.FC<DebateVSLayoutProps> = ({
  videoA,
  perspectives,
  isLoading = false,
}) => {
  const n = perspectives.length;

  // ─── Loading skeleton ───
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
        <div className="h-96 rounded-xl bg-white/5" />
        <div className="h-96 rounded-xl bg-white/5" />
      </div>
    );
  }

  // ─── N=0 : Empty state ───
  if (n === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl p-8 text-center"
        data-testid="debate-empty-state"
        role="status"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="text-base font-semibold text-white mb-2">
          Aucune perspective trouvée
        </h3>
        <p className="text-sm text-text-muted leading-relaxed max-w-md mx-auto">
          DeepSight n&apos;a pas pu trouver de perspective pertinente pour cette
          vidéo. Tu peux réessayer en mode manuel en collant l&apos;URL
          d&apos;une seconde vidéo.
        </p>
      </motion.div>
    );
  }

  // ─── N=1 : Hero card centrée (vidéo A seule en grand format) ───
  // On affiche A en hero ET la première perspective en dessous (centered).
  // Layout unique : pas de VS, pas de grid — juste 2 cards empilées centrées.
  if (n === 1) {
    return (
      <div className="space-y-6 lg:space-y-8" data-testid="debate-layout-n1">
        <VideoAHero videoA={videoA} variant="centered" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
          className="max-w-2xl mx-auto"
          data-testid="debate-perspective-0"
        >
          <DebateVideoCard
            side={PERSPECTIVE_SIDE}
            title={perspectives[0].video_title ?? "Perspective 1"}
            channel={perspectives[0].video_channel ?? ""}
            thumbnail={perspectives[0].video_thumbnail ?? ""}
            videoId={perspectives[0].video_id}
            platform={(perspectives[0].platform as VideoPlatform) ?? "youtube"}
            thesis={perspectives[0].thesis ?? ""}
            arguments={perspectives[0].arguments ?? []}
          />
        </motion.div>
      </div>
    );
  }

  // ─── N=2 : VS face-à-face (statu quo v1) ───
  if (n === 2) {
    return (
      <div
        className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 lg:gap-4 items-start"
        data-testid="debate-layout-n2"
      >
        {/* Vidéo A — slide in from left */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          data-testid="debate-video-a"
        >
          <DebateVideoCard
            side="a"
            title={videoA.title}
            channel={videoA.channel}
            thumbnail={videoA.thumbnail}
            videoId={videoA.videoId}
            platform={videoA.platform}
            thesis={videoA.thesis}
            arguments={videoA.arguments}
          />
        </motion.div>

        {/* VS Circle (uniquement N=2) */}
        <div
          className="flex items-center justify-center lg:pt-24"
          data-testid="debate-vs-circle"
        >
          <VSCircle />
        </div>

        {/* Vidéo B (perspective unique) — slide in from right */}
        <PerspectiveCard
          perspective={perspectives[0]}
          index={0}
          variant="single"
        />
      </div>
    );
  }

  // ─── N=3 : Grid 1+N — A en hero full-width, B1+B2 en dessous (2 cols) ───
  return (
    <div className="space-y-6 lg:space-y-8" data-testid="debate-layout-n3">
      <VideoAHero videoA={videoA} variant="topfull" />
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6"
        data-testid="debate-perspectives-grid"
      >
        {perspectives.slice(0, 2).map((p, i) => (
          <PerspectiveCard
            key={p.id}
            perspective={p}
            index={i}
            variant="grid"
          />
        ))}
      </div>
    </div>
  );
};
